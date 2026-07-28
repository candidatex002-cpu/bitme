import express from 'express';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import { AuthService } from './services/AuthService';
import { EconomyService } from './services/EconomyService';
import { MissionService } from './services/MissionService';
import { AdminService } from './services/AdminService';
import { RewardsService } from './services/RewardsService';
import { CouponService } from './services/CouponService';
import { SocialService } from './services/SocialService';
import { StatsService } from './services/StatsService';
import { MilestoneService } from './services/MilestoneService';
import { ExplorerService } from './services/ExplorerService';
import { presence } from './services/Presence';
import { sessionManager } from './services/GameSessionManager';
import { getModeConfig } from './services/GameSessionService';
import { ProgressionService } from './services/ProgressionService';
import { gameConfig, clientConfig, eventIsLive, activeSeasonId } from './config/GameConfig';
import { antiCheat } from './services/AntiCheatService';
import { GameMode, Evolution } from './types';
import { db } from './db/Database';

const app = express();

// CORS — locked to an allowlist when ALLOWED_ORIGINS is set (comma-separated),
// otherwise open for local dev. Set it in production to your web/app origins.
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '').split(',').map(o => o.trim()).filter(Boolean);
const corsOrigin: any = ALLOWED_ORIGINS.length ? ALLOWED_ORIGINS : '*';
app.use(cors({ origin: corsOrigin }));
app.use(express.json({ limit: '256kb' })); // cap body size — reject oversized payloads

const server = http.createServer(app);
const io = new SocketIOServer(server, { cors: { origin: corsOrigin, methods: ['GET', 'POST'] } });

// §sec Admin allowlist — comma-separated user ids in ADMIN_USER_IDS; the seeded demo
// ranger is included so a fresh dev install still has an admin.
const ADMIN_USER_IDS = new Set((process.env.ADMIN_USER_IDS || 'usr_ranger_alpha').split(',').map(s => s.trim()).filter(Boolean));

// §sec Dependency-free in-memory rate limiter (per client IP + route bucket). Protects
// auth (credential stuffing) and economy (reward farming) endpoints. Behind a proxy,
// trust the first X-Forwarded-For hop. Buckets self-expire; a sweep prevents unbounded growth.
const clientIp = (req: express.Request): string =>
  (req.headers['x-forwarded-for']?.toString().split(',')[0].trim()) || req.socket.remoteAddress || 'unknown';

function rateLimit(bucket: string, windowMs: number, max: number) {
  const hits = new Map<string, { count: number; reset: number }>();
  setInterval(() => { const now = Date.now(); for (const [k, v] of hits) if (v.reset < now) hits.delete(k); }, windowMs).unref?.();
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const key = bucket + ':' + clientIp(req);
    const now = Date.now();
    let e = hits.get(key);
    if (!e || e.reset < now) { e = { count: 0, reset: now + windowMs }; hits.set(key, e); }
    e.count++;
    if (e.count > max) {
      const retry = Math.ceil((e.reset - now) / 1000);
      res.setHeader('Retry-After', String(retry));
      return res.status(429).json({ error: `Too many requests — retry in ${retry}s` });
    }
    next();
  };
}

// Strict on auth (credential stuffing / guest-spam); looser on general economy writes.
const authLimiter = rateLimit('auth', 60_000, 20);
const writeLimiter = rateLimit('write', 60_000, 90);

interface SocketUser { userId: string; username: string; mode: GameMode; skin: string; evolution: string; region?: string; lastSeq: number; worldVersion: number; viewRadius: number; }
const connectedSockets: Map<string, SocketUser> = new Map();

const VALID_MODES: GameMode[] = ['classic', 'battle_royale', 'team', 'event'];
const asMode = (m: any): GameMode => (VALID_MODES.includes(m) ? m : 'classic');

// §12 Respawn pricing — sourced from the central config (mirrors the RESPAWN OPTIONS panel).
const RESPAWN_COST = gameConfig.economy.respawn;

const auth = (req: express.Request, res: express.Response) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) { res.status(401).json({ error: 'Unauthorized' }); return null; }
  const a = AuthService.verifyToken(token);
  if (!a) { res.status(401).json({ error: 'Invalid or expired token' }); return null; }
  return a;
};

// Admin-gated: valid token AND in the ADMIN_USER_IDS allowlist.
const adminAuth = (req: express.Request, res: express.Response) => {
  const a = auth(req, res); if (!a) return null;
  if (!ADMIN_USER_IDS.has(a.userId)) { res.status(403).json({ error: 'Forbidden — admin access required' }); return null; }
  return a;
};

// --------------------------------------------------------------- REST API
app.post('/api/auth/register', authLimiter, async (req, res) => {
  const { username, email, password } = req.body || {};
  if (!username || !email || !password) return res.status(400).json({ error: 'Missing required registration fields' });
  if (typeof password !== 'string' || password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
  const result = await AuthService.register(String(username), String(email), password);
  if ('error' in result) return res.status(400).json(result);
  res.json(result);
});

app.post('/api/auth/login', authLimiter, async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: 'Missing username or password' });
  const result = await AuthService.login(String(username), String(password));
  if ('error' in result) return res.status(400).json(result);
  res.json(result);
});

app.post('/api/auth/guest', authLimiter, (req, res) => res.json(AuthService.createGuestAccount()));

// §5 Username availability + first-time onboarding.
// §sec Rate-limited: this endpoint answers "does this account exist?", so leaving it open
// lets anyone enumerate the whole user base one guess at a time.
app.get('/api/auth/username-check', authLimiter, (req, res) => res.json(AuthService.checkUsername(String(req.query.name || ''))));

app.post('/api/auth/onboard', authLimiter, (req, res) => {
  const { name, country, language } = req.body || {};
  const result = AuthService.onboardGuest(name, country, language);
  if ('error' in result) return res.status(400).json(result);
  res.json({ ...result, profile: withRank(result.profile) });
});

const withRank = (profile: any) => profile ? { ...profile, rank: ProgressionService.getRank(profile.level, profile.prestige), xpToNext: ProgressionService.xpToNext(profile.level), nextEvolution: ProgressionService.nextEvolution(profile.level, profile.evolutionXp, profile.prestige), derivedStats: profile.stats ? StatsService.derive(profile.stats) : undefined } : profile;

app.get('/api/player/profile', (req, res) => {
  const a = auth(req, res); if (!a) return;
  const isAdmin = ADMIN_USER_IDS.has(a.userId);
  const rawProfile = db.getProfile(a.userId);
  res.json({ user: { id: a.userId, username: a.username, isGuest: a.isGuest, isAdmin }, profile: withRank(rawProfile ? { ...rawProfile, isAdmin } : rawProfile) });
});

app.post('/api/player/evolution', (req, res) => {
  const a = auth(req, res); if (!a) return;
  const result = db.equipEvolution(a.userId, req.body.evolution as Evolution);
  res.json({ ...result, profile: withRank(result.profile) });
});

app.post('/api/player/prestige', (req, res) => {
  const a = auth(req, res); if (!a) return;
  const result = db.prestige(a.userId);
  res.json({ ...result, profile: withRank(result.profile) });
});

app.get('/api/player/coupons', (req, res) => {
  const a = auth(req, res); if (!a) return;
  res.json({ coupons: db.getProfile(a.userId)?.coupons || [] });
});

app.get('/api/modes', (_req, res) => {
  res.json({ modes: VALID_MODES.map(getModeConfig) });
});

// §12 Public gameplay config — lets the client mirror server balancing (XP curve,
// evolution ladder, reward formula, world tunables) so offline play stays consistent.
app.get('/api/config', (_req, res) => res.json(clientConfig()));

app.get('/api/world/events', (_req, res) => {
  const events = sessionManager.getActiveSessions().map(s => s.getState().currentEvent).filter(Boolean);
  res.json({ events });
});

// Live-ops events feed for the Events screen: in-match world events currently running in a
// simulation, plus the scheduled calendar from config. Both are pure content — no user data —
// so a new event is a config edit, never a client release.
app.get('/api/events', (_req, res) => {
  const now = new Date();
  const live = sessionManager.getActiveSessions()
    .map(s => ({ session: s.getState().mode, event: s.getState().currentEvent }))
    .filter(e => !!e.event)
    .map(e => ({
      id: e.event!.id, icon: e.event!.icon, name: e.event!.title,
      description: e.event!.description, mode: e.session,
      timerSeconds: e.event!.timerSeconds, live: true,
    }));

  const scheduled = gameConfig.events.map(e => ({
    id: e.id, icon: e.icon, name: e.name, description: e.description,
    rewardHint: e.rewardHint, live: eventIsLive(e, now),
    months: e.months, startsAt: e.startsAt, endsAt: e.endsAt,
  }));

  res.json({ live, scheduled, season: activeSeasonId(now), serverTime: now.toISOString() });
});

// Cosmetics catalog. With a valid token it is annotated with THIS player's ownership,
// affordability and level gates; anonymously it is just the price list.
app.get('/api/shop/catalog', (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  const a = token ? AuthService.verifyToken(token) : null;
  res.json(EconomyService.getCatalog(a?.userId));
});

// §15 Rewards marketplace — region-aware catalog + Star redemption for digital rewards.
app.get('/api/rewards/catalog', (req, res) => {
  const region = (req.query.region as string) || 'Global';
  res.json(RewardsService.getCatalog(region));
});

app.post('/api/rewards/redeem', writeLimiter, (req, res) => {
  const a = auth(req, res); if (!a) return;
  const { itemId, region } = req.body || {};
  if (!itemId || typeof itemId !== 'string') return res.status(400).json({ error: 'itemId is required' });
  const result = RewardsService.redeem(a.userId, itemId, region || 'Global');
  res.json({ ...result, profile: result.profile ? withRank(result.profile) : undefined });
});

// Buy a skin. The price and every gate are resolved server-side from the config — the body
// carries only which skin, never what it costs.
app.post('/api/shop/purchase', writeLimiter, (req, res) => {
  const a = auth(req, res); if (!a) return;
  const skinId = req.body?.skinId ?? req.body?.itemId;
  if (!skinId || typeof skinId !== 'string') return res.status(400).json({ error: 'skinId is required' });
  const result = EconomyService.purchaseSkin(a.userId, skinId);
  res.status(result.success ? 200 : 400).json({ ...result, profile: result.profile ? withRank(result.profile) : undefined });
});

// §sec Equipping is gated on ownership. Previously this wrote `equippedSkin` unchecked, so
// any client could equip a legendary skin it had never bought.
app.post('/api/player/equip', (req, res) => {
  const a = auth(req, res); if (!a) return;
  const { skin } = req.body || {};
  if (!skin || typeof skin !== 'string') return res.status(400).json({ error: 'skin is required' });
  const result = EconomyService.equipSkin(a.userId, skin);
  res.status(result.success ? 200 : 403).json({ ...result, profile: result.profile ? withRank(result.profile) : undefined });
});

// §6 Edit profile — avatar/title/country/region freely; display name with a cooldown + rules.
const NAME_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;
app.post('/api/player/edit-profile', (req, res) => {
  const a = auth(req, res); if (!a) return;
  const profile = db.getProfile(a.userId);
  if (!profile) return res.status(404).json({ error: 'Profile not found' });
  const { displayName, avatar, title, country, region } = req.body || {};
  const updates: any = {};
  if (avatar !== undefined) updates.avatar = avatar;
  if (title !== undefined) updates.title = title;
  if (country !== undefined) updates.country = country;
  if (region !== undefined) updates.preferredRegion = region;

  if (displayName !== undefined && displayName !== profile.displayName) {
    const v = AuthService.validateUsername(String(displayName)); // reuse name rules (anti-impersonation)
    if (!v.ok) return res.status(400).json({ error: v.reason });
    const last = (profile as any).lastNameChange || 0;
    const remaining = NAME_COOLDOWN_MS - (Date.now() - last);
    if (last && remaining > 0) return res.status(400).json({ error: `You can change your display name again in ${Math.ceil(remaining / 86400000)} day(s)` });
    updates.displayName = String(displayName).trim();
    updates.lastNameChange = Date.now();
  }

  const updated = db.updateProfile(a.userId, updates);
  res.json({ success: true, profile: withRank(updated) });
});

app.post('/api/player/equip-accessory', (req, res) => {
  const a = auth(req, res); if (!a) return;
  const { accessoryId } = req.body;
  const profile = db.getProfile(a.userId);
  if (!profile) return res.status(404).json({ error: 'Profile not found' });
  // null/undefined means unequip; otherwise set the accessory
  const updated = db.updateProfile(a.userId, { equippedAccessory: accessoryId || undefined });
  res.json({ success: true, profile: withRank(updated) });
});

app.get('/api/missions', (req, res) => {
  const a = auth(req, res); if (!a) return;
  res.json({ missions: MissionService.getUserMissions(a.userId) });
});

app.post('/api/missions/claim', (req, res) => {
  const a = auth(req, res); if (!a) return;
  const result = MissionService.claimReward(a.userId, req.body.missionId);
  // §7 Claiming a mission may cross a coupon eligibility threshold — auto-grant if so.
  if (result.success) {
    const profile = db.getProfile(a.userId);
    const grantedCoupons = CouponService.autoGrantEligible(a.userId, profile?.preferredRegion || 'Global');
    return res.json({ ...result, grantedCoupons, profile: grantedCoupons.length ? withRank(db.getProfile(a.userId)) : withRank(result.profile) });
  }
  res.json(result);
});

// §V7 Auto-claim every completed-but-unclaimed mission (idempotent via the isClaimed gate,
// so rewards can never be granted twice). Called after a match so completions pay out.
app.post('/api/missions/claim-all', writeLimiter, (req, res) => {
  const a = auth(req, res); if (!a) return;
  let stars = 0, xp = 0, evoXp = 0; const claimed: string[] = [];
  for (const m of db.getMissions(a.userId)) {
    if (m.isCompleted && !m.isClaimed) {
      const r = db.claimMissionReward(a.userId, m.id);
      if (r.success) { stars += r.stars; xp += r.xp; evoXp += r.evoXp; claimed.push(m.id); }
    }
  }
  const profile = db.getProfile(a.userId);
  res.json({ success: true, claimed, stars, xp, evoXp, missions: db.getMissions(a.userId), profile: withRank(profile) });
});

// §V7 §9 Grant the all-daily-missions-complete bonus. Server validates completion AND that
// it hasn't been claimed today, so the Rare Egg + stars can be granted at most once per day.
app.post('/api/missions/daily-bonus', writeLimiter, (req, res) => {
  const a = auth(req, res); if (!a) return;
  const profile = db.getProfile(a.userId);
  if (!profile) return res.status(404).json({ error: 'Profile not found' });
  const daily = db.getMissions(a.userId).filter(m => m.category === 'daily');
  const allDone = daily.length > 0 && daily.every(m => m.isCompleted);
  const today = new Date().toISOString().slice(0, 10);
  if (!allDone) return res.json({ success: false, allDone: false, message: 'Finish all daily missions first' });
  if (profile.lastDailyBonus === today) return res.json({ success: false, alreadyClaimed: true, message: 'Daily bonus already claimed today' });
  const b = gameConfig.economy.dailyBonus;
  db.grantRewards(a.userId, { stars: b.stars, xp: b.xp, evoXp: b.evoXp });
  db.grantItem(a.userId, b.item, 1);
  const updated = db.updateProfile(a.userId, { lastDailyBonus: today });
  res.json({ success: true, rewards: { stars: b.stars, xp: b.xp, evoXp: b.evoXp, item: b.itemName, itemIcon: b.itemIcon }, profile: withRank(updated) });
});

// §milestone The journey timeline for a mode, annotated with this player's progress.
app.get('/api/milestones', (req, res) => {
  const a = auth(req, res); if (!a) return;
  const mode = String(req.query.mode || 'explorer');
  res.json(MilestoneService.overview(a.userId, mode));
});

// §milestone Bank a story checkpoint mid-match. The body says only WHICH milestone; whether
// it was actually earned is decided from the server's own observation of the live run, so a
// client can't checkpoint its way to rewards it never played for.
app.post('/api/match/checkpoint', writeLimiter, (req, res) => {
  const a = auth(req, res); if (!a) return;
  const id = String(req.body?.milestoneId || '');
  if (!id) return res.status(400).json({ success: false, message: 'milestoneId is required' });
  const r = MilestoneService.claim(a.userId, id);
  res.status(r.success || r.alreadyClaimed ? 200 : 400).json({ ...r, profile: r.profile ? withRank(r.profile) : undefined });
});

// §milestone Safety net at match end: bank anything whose target is met but that wasn't
// checkpointed live (a beat reached in the last seconds, or while briefly offline).
app.post('/api/match/checkpoint-all', writeLimiter, (req, res) => {
  const a = auth(req, res); if (!a) return;
  const mode = String(req.body?.mode || 'explorer');
  const claimed = MilestoneService.claimAllReached(a.userId, mode);
  res.json({
    success: true,
    claimed: claimed.map(c => ({ id: c.milestone!.id, title: c.milestone!.title, icon: c.milestone!.icon, rewards: c.rewards })),
    profile: withRank(db.getProfile(a.userId)),
  });
});

// §13 Offline progress sync. A client that played without a connection queues its gameplay
// increments and hands them over here. Clamped hard per metric per batch: an offline session
// is bounded by how much a human can physically collect, so anything beyond that is either a
// bug or a forgery and is trimmed rather than trusted.
const PROGRESS_SYNC_CAPS: Record<string, number> = {
  cherry: 2000, apple: 2000, frog: 1000, star: 1000, egg: 200, mushroom: 500,
  shield: 500, speed: 500, powerup: 1000, magnet: 500, fire: 500, gift: 200,
  treasure: 200, kill: 200, assist: 200, boost: 2000, heal: 1000,
};
app.post('/api/progress/sync', writeLimiter, (req, res) => {
  const a = auth(req, res); if (!a) return;
  const progress = req.body?.progress;
  if (!progress || typeof progress !== 'object') return res.status(400).json({ error: 'progress object is required' });

  const applied: Record<string, number> = {};
  for (const [metric, raw] of Object.entries(progress)) {
    const cap = PROGRESS_SYNC_CAPS[metric];
    if (!cap) continue; // unknown metric — ignore rather than let a client invent one
    const n = Math.floor(Number(raw));
    if (!Number.isFinite(n) || n <= 0) continue;
    const amount = Math.min(n, cap);
    db.incrementCollectible(a.userId, metric as any, amount);
    applied[metric] = amount;
  }

  res.json({
    success: true, applied,
    missions: db.getMissions(a.userId),
    achievements: db.getAchievements(a.userId),
    profile: withRank(db.getProfile(a.userId)),
  });
});

// --------------------------------------------------------------- §explorer campaign
// Current kingdom, its NPCs and what each is saying right now, quest progress, and the
// kingdom map. One call powers both the Explorer screen and the in-world HUD tracker.
app.get('/api/explorer/state', (req, res) => {
  const a = auth(req, res); if (!a) return;
  const ov = ExplorerService.overview(a.userId);
  if (!ov) return res.status(404).json({ error: 'Profile not found' });
  res.json(ov);
});

app.post('/api/explorer/quest/accept', writeLimiter, (req, res) => {
  const a = auth(req, res); if (!a) return;
  const r = ExplorerService.acceptQuest(a.userId, String(req.body?.questId || ''));
  res.status(r.success ? 200 : 400).json({ ...r, state: ExplorerService.overview(a.userId) });
});

// Whether the quest is actually finished is decided here, from counters the server credited.
app.post('/api/explorer/quest/claim', writeLimiter, (req, res) => {
  const a = auth(req, res); if (!a) return;
  const r: any = ExplorerService.claimQuest(a.userId, String(req.body?.questId || ''));
  res.status(r.success || r.alreadyClaimed ? 200 : 400).json({
    ...r,
    profile: r.profile ? withRank(r.profile) : undefined,
    state: ExplorerService.overview(a.userId),
  });
});

app.get('/api/achievements', (req, res) => {
  const a = auth(req, res); if (!a) return;
  res.json({ achievements: db.getAchievements(a.userId) });
});

// §V7 Leaderboards. No `category` → legacy global score board (back-compat). With a
// category → the redesigned typed board. `scope=friends` (auth) or `scope=local` filters.
const LEADERBOARD_CATEGORIES = ['level', 'score', 'kills', 'wins', 'survival', 'stars', 'explorer'];

// §sec A leaderboard is a public-facing view of OTHER people's accounts, so it publishes the
// bare minimum: rank, display name, avatar, level and the one metric being ranked. The raw
// `userId` is stripped — it was letting any caller harvest every account identifier in the
// database — and replaced with an `isYou` flag, which is all the UI ever needed it for.
const publicBoard = (entries: Array<{ rank: number; userId: string; displayName: string; avatar: string; level: number; value: number }>, viewerId?: string) =>
  entries.map(({ userId, ...e }) => ({ ...e, isYou: !!viewerId && userId === viewerId }));

app.get('/api/leaderboard', (req, res) => {
  const a = auth(req, res); if (!a) return; // §sec authenticated players only — no anonymous scraping
  const category = String(req.query.category || '');
  if (!category) {
    // Legacy global board — same treatment: no account ids on the wire.
    const legacy = db.getLeaderboard().map(({ userId, ...e }) => ({ ...e, isYou: userId === a.userId }));
    return res.json({ leaderboard: legacy });
  }

  if (!LEADERBOARD_CATEGORIES.includes(category)) return res.status(400).json({ error: 'Unknown category' });
  const scope = String(req.query.scope || 'global');
  if (scope === 'friends') {
    const ids = [a.userId, ...db.getSocial(a.userId).friends];
    return res.json({ category, scope, entries: publicBoard(db.getCategoryLeaderboard(category, 100, { userIds: ids }), a.userId) });
  }
  if (scope === 'local') {
    const region = String(req.query.region || 'Global');
    return res.json({ category, scope, region, entries: publicBoard(db.getCategoryLeaderboard(category, 100, { region }), a.userId) });
  }
  res.json({ category, scope: 'global', entries: publicBoard(db.getCategoryLeaderboard(category, 100), a.userId) });
});

app.get('/api/leaderboard/categories', (_req, res) => res.json({ categories: LEADERBOARD_CATEGORIES }));

app.post('/api/ads/claim', writeLimiter, (req, res) => {
  const a = auth(req, res); if (!a) return;
  const profile = db.getProfile(a.userId);
  if (!profile) return res.status(404).json({ error: 'Profile not found' });
  const { stars: bonusStars, tickets: bonusTickets, cooldownMs } = gameConfig.economy.ad;
  const last = profile.lastAdClaim || 0;
  const remaining = cooldownMs - (Date.now() - last);
  if (remaining > 0) return res.status(429).json({ error: `Please wait ${Math.ceil(remaining / 1000)}s before claiming another ad reward` });
  const updated = db.updateProfile(a.userId, { stars: profile.stars + bonusStars, tickets: profile.tickets + bonusTickets, lastAdClaim: Date.now() });
  res.json({ success: true, message: `Claimed Double Reward! +${bonusStars} Stars & +${bonusTickets} Tickets.`, bonusStars, bonusTickets, profile: withRank(updated) });
});


app.post('/api/match/summary', writeLimiter, (req, res) => {
  const a = auth(req, res); if (!a) return;
  // §sec Reward-farming guard. The server-observed peak is consumed on the first submission,
  // so a replayed call would be graded on client numbers alone and could mint the maximum
  // clamped payout every time. Wall-clock pacing is the thing a script cannot fake.
  const paced = antiCheat.validateMatchSubmission(a.userId, Number(req.body?.survivalSeconds) || 0);
  if (!paced.ok) {
    if (paced.retryAfterMs) res.setHeader('Retry-After', String(Math.ceil(paced.retryAfterMs / 1000)));
    return res.status(429).json({ error: paced.reason || 'Match result rejected' });
  }
  // §V7/§11 Server is the source of truth: bound the client report by what the simulation
  // actually observed for this player (null for offline / local-engine play).
  const serverPeak = sessionManager.consumePlayerPeak(a.userId);
  const result = StatsService.recordMatch(a.userId, req.body || {}, serverPeak);
  if (!result) return res.status(404).json({ error: 'Profile not found' });
  const { authoritative, ...rest } = result;
  res.json({
    success: true,
    earnedStars: rest.earnedStars, earnedXP: rest.earnedXP, earnedEvoXP: rest.earnedEvoXP,
    levelsGained: rest.levelsGained, scoreEvolution: rest.scoreEvolution,
    score: authoritative.score, kills: authoritative.kills, placement: rest.match.rank,
    grantedCoupons: rest.grantedCoupons, match: rest.match,
    profile: withRank(rest.profile),
  });
});

// §V7 Persisted match history for the Match History page.
app.get('/api/player/history', (req, res) => {
  const a = auth(req, res); if (!a) return;
  const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 25));
  res.json({ history: db.getMatchHistory(a.userId, limit) });
});

app.post('/api/match/abandon', (req, res) => {
  const a = auth(req, res); if (!a) return;
  sessionManager.consumePlayerPeak(a.userId); // discard server-observed peak on clean abandon
  sessionManager.findPlayerSession(a.userId)?.removePlayer(a.userId);
  res.json({ success: true, message: 'Match abandoned cleanly' });
});

app.get('/api/screens/:screenId', (req, res) => {
  if (!auth(req, res)) return; // §sec no reason for this to answer anonymous callers
  const valid = ['menu', 'matchmaking', 'play', 'pause', 'gameover', 'respawn', 'ad-reward', 'spectate'];
  if (!valid.includes(req.params.screenId)) return res.status(404).json({ error: `Screen not found` });
  res.json({ screenId: req.params.screenId, status: 'active', config: { adInventoryReady: true, region: 'North America East 30Hz' } });
});

app.get('/api/admin/telemetry', (req, res) => {
  if (!adminAuth(req, res)) return;
  res.json({ telemetry: AdminService.getTelemetry(sessionManager.getActiveModeCount(), connectedSockets.size), auditLogs: AdminService.getAuditLogs() });
});

// --------------------------------------------------------------- §7 Coupon Management
// Admin: full CRUD + enable/disable + redemption tracking. All admin-gated.
app.get('/api/admin/coupons', (req, res) => {
  if (!adminAuth(req, res)) return;
  res.json({ coupons: CouponService.list() });
});
app.post('/api/admin/coupons', (req, res) => {
  if (!adminAuth(req, res)) return;
  if (!req.body?.title || !req.body?.storeName) return res.status(400).json({ error: 'title and storeName are required' });
  res.json({ success: true, coupon: CouponService.create(req.body) });
});
app.patch('/api/admin/coupons/:id', (req, res) => {
  if (!adminAuth(req, res)) return;
  const updated = CouponService.update(req.params.id, req.body || {});
  if (!updated) return res.status(404).json({ error: 'Coupon not found' });
  res.json({ success: true, coupon: updated });
});
app.post('/api/admin/coupons/:id/enable', (req, res) => {
  if (!adminAuth(req, res)) return;
  const updated = CouponService.setEnabled(req.params.id, true);
  if (!updated) return res.status(404).json({ error: 'Coupon not found' });
  res.json({ success: true, coupon: updated });
});
app.post('/api/admin/coupons/:id/disable', (req, res) => {
  if (!adminAuth(req, res)) return;
  const updated = CouponService.setEnabled(req.params.id, false);
  if (!updated) return res.status(404).json({ error: 'Coupon not found' });
  res.json({ success: true, coupon: updated });
});
app.delete('/api/admin/coupons/:id', (req, res) => {
  if (!adminAuth(req, res)) return;
  res.json({ success: CouponService.remove(req.params.id) });
});
app.get('/api/admin/coupons/:id/redemptions', (req, res) => {
  if (!adminAuth(req, res)) return;
  res.json({ redemptions: CouponService.redemptions(req.params.id) });
});

// Player: list claimable coupons + claim one (server-driven grant into inventory).
app.get('/api/coupons/available', (req, res) => {
  const a = auth(req, res); if (!a) return;
  const region = (req.query.region as string) || 'Global';
  res.json({ coupons: CouponService.availableFor(a.userId, region) });
});
app.post('/api/coupons/claim', writeLimiter, (req, res) => {
  const a = auth(req, res); if (!a) return;
  if (!req.body?.couponId || typeof req.body.couponId !== 'string') return res.status(400).json({ error: 'couponId is required' });
  const result = CouponService.claim(a.userId, req.body.couponId, req.body?.region || 'Global');
  if (!result.success) return res.status(400).json(result);
  res.json({ ...result, profile: withRank(result.profile) });
});

// §8 Lobby presence heartbeat — keeps a player "online" for friends while browsing menus.
app.post('/api/presence/ping', (req, res) => {
  const a = auth(req, res); if (!a) return;
  presence.heartbeat(a.userId);
  res.json({ ok: true });
});

// --------------------------------------------------------------- §8 Social (server-driven)
app.get('/api/social/overview', (req, res) => {
  const a = auth(req, res); if (!a) return;
  res.json(SocialService.overview(a.userId));
});
// Accepts an exact username OR a shareable friend code — both arrive in the same field so
// the UI can offer a single "username or friend code" box.
app.post('/api/social/request', writeLimiter, (req, res) => {
  const a = auth(req, res); if (!a) return;
  const query = req.body?.query ?? req.body?.friendCode ?? req.body?.username;
  const r = SocialService.sendRequest(a.userId, query);
  res.status(r.success ? 200 : 400).json({ ...r, ...SocialService.overview(a.userId) });
});
app.post('/api/social/respond', (req, res) => {
  const a = auth(req, res); if (!a) return;
  const action = req.body?.action === 'accept' ? 'accept' : 'reject';
  const r = SocialService.respond(a.userId, String(req.body?.userId || ''), action);
  res.status(r.success ? 200 : 400).json({ ...r, ...SocialService.overview(a.userId) });
});
app.post('/api/social/unfriend', (req, res) => {
  const a = auth(req, res); if (!a) return;
  const r = SocialService.unfriend(a.userId, String(req.body?.userId || ''));
  res.json({ ...r, ...SocialService.overview(a.userId) });
});
app.post('/api/social/block', (req, res) => {
  const a = auth(req, res); if (!a) return;
  const r = SocialService.block(a.userId, String(req.body?.userId || ''));
  res.status(r.success ? 200 : 400).json({ ...r, ...SocialService.overview(a.userId) });
});
app.post('/api/social/unblock', (req, res) => {
  const a = auth(req, res); if (!a) return;
  const r = SocialService.unblock(a.userId, String(req.body?.userId || ''));
  res.json({ ...r, ...SocialService.overview(a.userId) });
});
// Invite a friend to play. The invite is PERSISTED, then also pushed live if they happen to
// be connected — so inviting someone who is away no longer just fails, it waits for them.
app.post('/api/social/invite', writeLimiter, (req, res) => {
  const a = auth(req, res); if (!a) return;
  const otherId = String(req.body?.userId || '');
  // Prefer the mode the sender is actually playing; fall back to what the client asked for.
  const liveMode = connectedSockets.get([...connectedSockets].find(([, u]) => u.userId === a.userId)?.[0] || '')?.mode;
  const mode = String(req.body?.mode || liveMode || 'free_roam');

  const result = SocialService.invite(a.userId, otherId, mode);
  if (!result.success) return res.status(400).json({ success: false, message: result.message });

  if (result.online) deliverInvites(otherId);
  res.json({ success: true, message: result.message, online: result.online });
});

// A recipient's pending invites.
app.get('/api/social/invites', (req, res) => {
  const a = auth(req, res); if (!a) return;
  res.json({ invites: SocialService.pendingInvites(a.userId) });
});

// Accept (returns the mode to launch) or decline. Consumes the invite either way.
app.post('/api/social/invites/respond', writeLimiter, (req, res) => {
  const a = auth(req, res); if (!a) return;
  const action = req.body?.action === 'accept' ? 'accept' : 'decline';
  const r = SocialService.respondToInvite(a.userId, String(req.body?.inviteId || ''), action);
  res.status(r.success ? 200 : 400).json({ ...r, invites: SocialService.pendingInvites(a.userId) });
});

// Liveness/readiness probe for hosting platforms + uptime checks.
// Exposed under BOTH paths on purpose: `/health` is what platform health checks hit, while
// `/api/health` is the one that survives a reverse proxy that only forwards `/api/*` — the
// client's latency probe uses that one so it works in every deployment shape.
const health = (_req: express.Request, res: express.Response) =>
  res.json({ status: 'ok', uptime: process.uptime(), modes: sessionManager.getActiveModeCount() });
app.get('/health', health);
app.get('/api/health', health);

// Unknown API route → clean JSON 404 (never an HTML error page the client can't parse).
app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found' }));

// Central error handler — any thrown/next(err) returns JSON, never leaks a stack trace.
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[api-error]', err?.message || err);
  res.status(500).json({ error: 'Internal server error' });
});

// §social Push a user's pending invites to every socket they have open. Called when an
// invite arrives for someone already online, and again as soon as they authenticate — which
// is what makes an invite sent while they were away actually reach them.
function deliverInvites(userId: string) {
  const invites = db.getMatchInvites(userId);
  if (!invites.length) return;
  const payload = { invites: SocialService.pendingInvites(userId) };
  let delivered = false;
  for (const [sid, u] of connectedSockets) {
    if (u.userId === userId) { io.to(sid).emit('match_invite', payload); delivered = true; }
  }
  if (delivered) db.markInvitesDelivered(userId);
}

// --------------------------------------------------------------- realtime
io.on('connection', (socket) => {
  socket.on('authenticate', (data: { token: string; skin?: string; mode?: GameMode; region?: string; matchType?: string }) => {
    const a = AuthService.verifyToken(data.token);
    if (!a) { socket.emit('auth_error', { message: 'Authentication failed' }); return; }

    const mode = asMode(data.mode);
    const profile = db.getProfile(a.userId);
    const skin = data.skin || profile?.equippedSkin || 'Forest';
    const evolution = profile?.equippedEvolution || 'Baby';
    const region = (data.matchType === 'local' ? '📍 ' : '') + (data.region || 'Global');

    // Leave any previous mode room, join the new one
    const prev = connectedSockets.get(socket.id);
    if (prev && prev.mode !== mode) {
      socket.leave(prev.mode);
      sessionManager.findPlayerSession(a.userId)?.removePlayer(a.userId);
    }

    // worldVersion 0 forces the first tick to carry the full obstacle/wormhole layout.
    connectedSockets.set(socket.id, { userId: a.userId, username: a.username, mode, skin, evolution, region, lastSeq: 0, worldVersion: 0, viewRadius: DEFAULT_VIEW_RADIUS });
    presence.add(a.userId); // §8 mark online for friends' status
    socket.join(mode);

    const session = sessionManager.getSession(mode);
    session.setOnPickupCallback((userId, foodId, foodType, updatedMissions) => {
      for (const [sid, conn] of connectedSockets) {
        if (conn.userId === userId) {
          io.to(sid).emit('pickup_event', {
            type: 'pickup_event',
            foodId,
            foodType,
            updatedMissions,
            profile: db.getProfile(userId),
          });
        }
      }
    });
    const snake = session.registerPlayer(a.userId, a.username, skin, false, evolution, region);
    socket.emit('authenticated', { userId: a.userId, snake, mode, region, config: session.getConfig() });
    // Anything a friend sent while this player was away lands now.
    deliverInvites(a.userId);
  });

  socket.on('client_input', (data: { seq: number; angle: number; boosting: boolean }) => {
    const user = connectedSockets.get(socket.id);
    if (!user) return;
    // §sec Replay/reorder protection — only accept strictly-increasing sequence numbers,
    // so a captured input frame can't be replayed and stale/duplicate frames are dropped.
    const seq = Number(data?.seq);
    if (!Number.isFinite(seq) || seq <= user.lastSeq) return;
    user.lastSeq = seq;
    sessionManager.getSession(user.mode).handlePlayerInput(user.userId, data.angle, !!data.boosting, seq);
  });

  // §net The client reports how much world it can actually see (viewport ÷ zoom). Clamped
  // here so it is only ever a bandwidth hint, never a way to demand extra world data.
  socket.on('view_radius', (data: { radius?: number }) => {
    const user = connectedSockets.get(socket.id);
    if (!user) return;
    const r = Number(data?.radius);
    if (!Number.isFinite(r)) return;
    user.viewRadius = Math.min(MAX_VIEW_RADIUS, Math.max(MIN_VIEW_RADIUS, r));
  });

  socket.on('activate_ability', () => {
    const user = connectedSockets.get(socket.id);
    if (!user) return;
    const used = sessionManager.getSession(user.mode).activateAbility(user.userId);
    socket.emit('ability_result', { used });
  });

  socket.on('respawn', (data: { method?: string }) => {
    const user = connectedSockets.get(socket.id);
    if (!user) return;
    const method = data?.method || 'wait';
    const cost = RESPAWN_COST[method] || RESPAWN_COST.wait;
    const profile = db.getProfile(user.userId);
    if (!profile) { socket.emit('respawn_result', { success: false, message: 'No profile' }); return; }
    if (profile.stars < cost.stars || profile.tickets < cost.tickets) {
      socket.emit('respawn_result', { success: false, message: `Not enough ${cost.label}` });
      return;
    }
    const updatedProfile = (cost.stars || cost.tickets)
      ? db.updateProfile(user.userId, { stars: profile.stars - cost.stars, tickets: profile.tickets - cost.tickets })
      : profile;

    const snake = sessionManager.getSession(user.mode).respawnPlayer(user.userId, user.username, user.skin, user.evolution, user.region);
    socket.emit('respawn_result', { success: true, snake, profile: withRank(updatedProfile), method });
  });

  // §12 Mobile pause — client backgrounded (home/lock/call): mark inactive, no damage.
  socket.on('player_pause', () => {
    const user = connectedSockets.get(socket.id);
    if (user) sessionManager.getSession(user.mode).setPlayerInactive(user.userId, true);
  });
  socket.on('player_resume', () => {
    const user = connectedSockets.get(socket.id);
    if (user) sessionManager.getSession(user.mode).setPlayerInactive(user.userId, false);
  });

  socket.on('disconnect', () => {
    const user = connectedSockets.get(socket.id);
    if (user) {
      sessionManager.getSession(user.mode).handlePlayerDisconnect(user.userId);
      connectedSockets.delete(socket.id);
      presence.remove(user.userId); // §8 last socket gone → offline
    }
  });
});

// §net Interest-managed broadcast @ 30 Hz.
//
// Each mode's shared snapshot is built ONCE per tick, then every connected socket gets a view
// tailored to it: food culled to what it could actually draw, and the near-static world layout
// (obstacles/wormholes) only when its cached copy is stale. Emitting per-socket costs a little
// more CPU than a room broadcast but cuts per-client bandwidth by roughly an order of
// magnitude, which is the resource that actually runs out first.
// A phone at full zoom-out sees ~900 world units; a 4K desktop sees ~4000. The client reports
// its own view radius (see the `view_radius` handler) so neither gets shortchanged: nothing
// ever pops into view, and small screens — the ones most likely on metered data — send far
// less. Clamped server-side so the value is never a lever a client can abuse.
const DEFAULT_VIEW_RADIUS = 2200;
const MIN_VIEW_RADIUS = 700;
const MAX_VIEW_RADIUS = 4400; // beyond half the world diagonal → effectively "send it all"
setInterval(() => {
  const shared = new Map<GameMode, ReturnType<typeof buildShared>>();
  function buildShared(session: ReturnType<typeof sessionManager.getSession>) {
    return session.buildSharedSnapshot();
  }
  for (const session of sessionManager.getActiveSessions()) {
    shared.set(session.getState().mode, buildShared(session));
  }

  const now = Date.now();
  for (const [sid, user] of connectedSockets) {
    const base = shared.get(user.mode);
    if (!base) continue;
    const session = sessionManager.getSession(user.mode);
    const head = session.getHeadPosition(user.userId);

    const radius = user.viewRadius || DEFAULT_VIEW_RADIUS;
    const payload: any = {
      ...base,
      timestamp: now,
      snakes: session.viewSnakes(base.snakes, head, radius),
      food: session.foodNear(head, radius),
    };
    // Ship the layout only when this client's cached version is behind.
    if (user.worldVersion !== base.worldVersion) {
      const layout = session.getWorldLayout();
      payload.obstacles = layout.obstacles;
      payload.portals = layout.portals;
      payload.npcs = layout.npcs; // §explorer villagers ride the cached layout — they never move
      user.worldVersion = base.worldVersion;
    }
    io.to(sid).emit('game_state_tick', payload);
  }
}, 1000 / 30);

const PORT = Number(process.env.PORT) || 4000;
// Bind all interfaces explicitly. Containerised hosts (Render/Railway/Fly) route to the
// container's external address, and a server bound only to loopback fails their health check
// with no useful error — it just never becomes reachable.
server.listen(PORT, '0.0.0.0', () => {
  console.log(`=======================================================`);
  console.log(` ANACONDA PARK — AUTHORITATIVE SERVER RUNNING ON :${PORT}`);
  console.log(` Modes: Classic · Battle Royale · Team · Event  @ 30 Hz`);
  console.log(`=======================================================`);
});

export default app;
