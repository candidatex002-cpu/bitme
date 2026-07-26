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
import { presence } from './services/Presence';
import { sessionManager } from './services/GameSessionManager';
import { getModeConfig } from './services/GameSessionService';
import { ProgressionService } from './services/ProgressionService';
import { gameConfig, clientConfig } from './config/GameConfig';
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

interface SocketUser { userId: string; username: string; mode: GameMode; skin: string; evolution: string; region?: string; lastSeq: number; }
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

// §5 Username availability + first-time onboarding
app.get('/api/auth/username-check', (req, res) => res.json(AuthService.checkUsername(String(req.query.name || ''))));

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

app.get('/api/shop/catalog', (_req, res) => res.json(EconomyService.getCatalog()));

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

app.post('/api/shop/purchase', writeLimiter, (req, res) => {
  const a = auth(req, res); if (!a) return;
  if (!req.body?.itemId || typeof req.body.itemId !== 'string') return res.status(400).json({ error: 'itemId is required' });
  res.json(EconomyService.purchaseItem(a.userId, req.body.itemId));
});

app.post('/api/player/equip', (req, res) => {
  const a = auth(req, res); if (!a) return;
  const { skin } = req.body;
  const profile = db.updateProfile(a.userId, { equippedSkin: skin });
  res.json({ success: true, profile });
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

app.get('/api/achievements', (req, res) => {
  const a = auth(req, res); if (!a) return;
  res.json({ achievements: db.getAchievements(a.userId) });
});

// §V7 Leaderboards. No `category` → legacy global score board (back-compat). With a
// category → the redesigned typed board. `scope=friends` (auth) or `scope=local` filters.
const LEADERBOARD_CATEGORIES = ['level', 'score', 'kills', 'wins', 'survival', 'stars', 'explorer'];
app.get('/api/leaderboard', (req, res) => {
  const category = String(req.query.category || '');
  if (!category) return res.json({ leaderboard: db.getLeaderboard() }); // legacy shape

  if (!LEADERBOARD_CATEGORIES.includes(category)) return res.status(400).json({ error: 'Unknown category' });
  const scope = String(req.query.scope || 'global');
  if (scope === 'friends') {
    const a = auth(req, res); if (!a) return;
    const ids = [a.userId, ...db.getSocial(a.userId).friends];
    return res.json({ category, scope, entries: db.getCategoryLeaderboard(category, 100, { userIds: ids }) });
  }
  if (scope === 'local') {
    const region = String(req.query.region || 'Global');
    return res.json({ category, scope, region, entries: db.getCategoryLeaderboard(category, 100, { region }) });
  }
  res.json({ category, scope: 'global', entries: db.getCategoryLeaderboard(category, 100) });
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
app.post('/api/social/request', writeLimiter, (req, res) => {
  const a = auth(req, res); if (!a) return;
  const r = SocialService.sendRequest(a.userId, req.body?.username);
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
// Invite a friend to your current match — delivered live to their sockets if online.
app.post('/api/social/invite', writeLimiter, (req, res) => {
  const a = auth(req, res); if (!a) return;
  const otherId = String(req.body?.userId || '');
  if (!SocialService.canInvite(a.userId, otherId)) return res.status(400).json({ success: false, message: 'Friend is offline or not on your list' });
  const mode = connectedSockets.get([...connectedSockets].find(([, u]) => u.userId === a.userId)?.[0] || '')?.mode;
  for (const [sid, u] of connectedSockets) {
    if (u.userId === otherId) io.to(sid).emit('match_invite', { from: a.username, fromId: a.userId, mode });
  }
  res.json({ success: true, message: 'Invite sent' });
});

// Liveness/readiness probe for hosting platforms + uptime checks.
app.get('/health', (_req, res) => res.json({ status: 'ok', uptime: process.uptime(), modes: sessionManager.getActiveModeCount() }));

// Unknown API route → clean JSON 404 (never an HTML error page the client can't parse).
app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found' }));

// Central error handler — any thrown/next(err) returns JSON, never leaks a stack trace.
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[api-error]', err?.message || err);
  res.status(500).json({ error: 'Internal server error' });
});

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

    connectedSockets.set(socket.id, { userId: a.userId, username: a.username, mode, skin, evolution, region, lastSeq: 0 });
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

// Broadcast each active mode's world to its room @ 30 Hz
setInterval(() => {
  for (const session of sessionManager.getActiveSessions()) {
    const state = session.getState();
    io.to(state.mode).emit('game_state_tick', {
      tick: state.tick,
      timestamp: Date.now(),
      mode: state.mode,
      snakes: Object.values(state.snakes),
      food: Object.values(state.food),
      safeZone: state.safeZone,
      sanctuaryZone: state.sanctuaryZone,
      portals: state.portals,
      obstacles: state.obstacles,
      leaderboard: state.leaderboard,
      teamScores: state.teamScores,
      currentEvent: state.currentEvent,
    });
  }
}, 1000 / 30);

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(` ANACONDA PARK — AUTHORITATIVE SERVER RUNNING ON :${PORT}`);
  console.log(` Modes: Classic · Battle Royale · Team · Event  @ 30 Hz`);
  console.log(`=======================================================`);
});

export default app;
