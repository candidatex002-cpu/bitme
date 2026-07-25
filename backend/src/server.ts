import express from 'express';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import { AuthService } from './services/AuthService';
import { EconomyService } from './services/EconomyService';
import { MissionService } from './services/MissionService';
import { AdminService } from './services/AdminService';
import { RewardsService } from './services/RewardsService';
import { sessionManager } from './services/GameSessionManager';
import { getModeConfig } from './services/GameSessionService';
import { ProgressionService } from './services/ProgressionService';
import { GameMode, Evolution } from './types';
import { db } from './db/Database';

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new SocketIOServer(server, { cors: { origin: '*', methods: ['GET', 'POST'] } });

interface SocketUser { userId: string; username: string; mode: GameMode; skin: string; evolution: string; region?: string; }
const connectedSockets: Map<string, SocketUser> = new Map();

const VALID_MODES: GameMode[] = ['classic', 'battle_royale', 'team', 'event'];
const asMode = (m: any): GameMode => (VALID_MODES.includes(m) ? m : 'classic');

// Respawn pricing — mirrors the RESPAWN OPTIONS panel.
const RESPAWN_COST: Record<string, { stars: number; tickets: number; label: string }> = {
  stars: { stars: 20, tickets: 0, label: 'Stars' },
  ticket: { stars: 0, tickets: 1, label: 'Ticket' },
  ad: { stars: 0, tickets: 0, label: 'Watch Ad' },
  wait: { stars: 0, tickets: 0, label: 'Free Wait' },
};

const auth = (req: express.Request, res: express.Response) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) { res.status(401).json({ error: 'Unauthorized' }); return null; }
  const a = AuthService.verifyToken(token);
  if (!a) { res.status(401).json({ error: 'Invalid or expired token' }); return null; }
  return a;
};

// --------------------------------------------------------------- REST API
app.post('/api/auth/register', async (req, res) => {
  const { username, email, password } = req.body;
  if (!username || !email || !password) return res.status(400).json({ error: 'Missing required registration fields' });
  const result = await AuthService.register(username, email, password);
  if ('error' in result) return res.status(400).json(result);
  res.json(result);
});

app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Missing username or password' });
  const result = await AuthService.login(username, password);
  if ('error' in result) return res.status(400).json(result);
  res.json(result);
});

app.post('/api/auth/guest', (req, res) => res.json(AuthService.createGuestAccount()));

// §5 Username availability + first-time onboarding
app.get('/api/auth/username-check', (req, res) => res.json(AuthService.checkUsername(String(req.query.name || ''))));

app.post('/api/auth/onboard', (req, res) => {
  const { name, country, language } = req.body || {};
  const result = AuthService.onboardGuest(name, country, language);
  if ('error' in result) return res.status(400).json(result);
  res.json({ ...result, profile: withRank(result.profile) });
});

const withRank = (profile: any) => profile ? { ...profile, rank: ProgressionService.getRank(profile.level, profile.prestige), xpToNext: ProgressionService.xpToNext(profile.level), nextEvolution: ProgressionService.nextEvolution(profile.level, profile.evolutionXp, profile.prestige) } : profile;

app.get('/api/player/profile', (req, res) => {
  const a = auth(req, res); if (!a) return;
  res.json({ user: { id: a.userId, username: a.username, isGuest: a.isGuest }, profile: withRank(db.getProfile(a.userId)) });
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

app.post('/api/rewards/redeem', (req, res) => {
  const a = auth(req, res); if (!a) return;
  const { itemId, region } = req.body;
  const result = RewardsService.redeem(a.userId, itemId, region || 'Global');
  res.json({ ...result, profile: result.profile ? withRank(result.profile) : undefined });
});

app.post('/api/shop/purchase', (req, res) => {
  const a = auth(req, res); if (!a) return;
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
  res.json(MissionService.claimReward(a.userId, req.body.missionId));
});

app.get('/api/achievements', (req, res) => {
  const a = auth(req, res); if (!a) return;
  res.json({ achievements: db.getAchievements(a.userId) });
});

app.get('/api/leaderboard', (_req, res) => res.json({ leaderboard: db.getLeaderboard() }));

app.post('/api/ads/claim', (req, res) => {
  const a = auth(req, res); if (!a) return;
  const profile = db.getProfile(a.userId);
  if (!profile) return res.status(404).json({ error: 'Profile not found' });
  const bonusStars = 500, bonusTickets = 2;
  const updated = db.updateProfile(a.userId, { stars: profile.stars + bonusStars, tickets: profile.tickets + bonusTickets });
  res.json({ success: true, message: `Claimed Double Reward! +${bonusStars} Stars & +${bonusTickets} Tickets.`, bonusStars, bonusTickets, profile: updated });
});

app.post('/api/match/summary', (req, res) => {
  const a = auth(req, res); if (!a) return;
  const { score = 0, kills = 0, placement = 10, survivalSeconds = 60, distanceKm = 0, areasVisited = 0, cherriesEaten = 0 } = req.body;
  const profile = db.getProfile(a.userId);
  if (!profile) return res.status(404).json({ error: 'Profile not found' });

  const won = placement === 1;
  const earnedStars = Math.floor(score / 10) + kills * 50 + (won ? 500 : 0);
  const earnedXP = Math.floor(score / 5) + kills * 100 + (won ? 300 : 0);
  const earnedEvoXP = Math.floor(score / 50) + kills * 10 + (won ? 50 : 0);

  // Persistent stats
  db.updateProfile(a.userId, {
    stats: {
      matchesPlayed: profile.stats.matchesPlayed + 1,
      matchesWon: profile.stats.matchesWon + (won ? 1 : 0),
      totalKills: profile.stats.totalKills + kills,
      totalFoodEaten: profile.stats.totalFoodEaten + Math.floor(score / 2),
      highestScore: Math.max(profile.stats.highestScore, Math.round(score)),
      survivalTimeSeconds: profile.stats.survivalTimeSeconds + survivalSeconds,
      cherriesCollected: (profile.stats.cherriesCollected || 0) + cherriesEaten,
    },
  });

  // Mission + achievement telemetry
  db.incrementCollectible(a.userId, 'match', 1);
  db.incrementCollectible(a.userId, 'survive', survivalSeconds);
  db.incrementCollectible(a.userId, 'distance', distanceKm);
  if (won) db.incrementCollectible(a.userId, 'win', 1);
  db.recordPeakMetric(a.userId, 'score', Math.round(score));
  if (areasVisited > 0) db.recordPeakMetric(a.userId, 'explore', areasVisited);
  db.updateLeaderboard(a.userId, a.username, Math.round(score), won);

  // Server-authoritative XP / Evolution XP with account level-ups
  const { profile: updated, levelsGained } = db.grantRewards(a.userId, { stars: earnedStars, xp: earnedXP, evoXp: earnedEvoXP });

  const scoreEvolution = ProgressionService.scoreToEvolution(Math.round(score));
  res.json({ success: true, earnedStars, earnedXP, earnedEvoXP, levelsGained, placement, kills, score: Math.round(score), scoreEvolution, profile: withRank(updated) });
});

app.post('/api/match/abandon', (req, res) => {
  const a = auth(req, res); if (!a) return;
  sessionManager.findPlayerSession(a.userId)?.removePlayer(a.userId);
  res.json({ success: true, message: 'Match abandoned cleanly' });
});

app.get('/api/screens/:screenId', (req, res) => {
  const valid = ['menu', 'matchmaking', 'play', 'pause', 'gameover', 'respawn', 'ad-reward', 'spectate'];
  if (!valid.includes(req.params.screenId)) return res.status(404).json({ error: `Screen not found` });
  res.json({ screenId: req.params.screenId, status: 'active', config: { adInventoryReady: true, region: 'North America East 30Hz' } });
});

app.get('/api/admin/telemetry', (_req, res) => {
  res.json({ telemetry: AdminService.getTelemetry(sessionManager.getActiveModeCount(), connectedSockets.size), auditLogs: AdminService.getAuditLogs() });
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

    connectedSockets.set(socket.id, { userId: a.userId, username: a.username, mode, skin, evolution, region });
    socket.join(mode);

    const session = sessionManager.getSession(mode);
    const snake = session.registerPlayer(a.userId, a.username, skin, false, evolution, region);
    socket.emit('authenticated', { userId: a.userId, snake, mode, region, config: session.getConfig() });
  });

  socket.on('client_input', (data: { seq: number; angle: number; boosting: boolean }) => {
    const user = connectedSockets.get(socket.id);
    if (!user) return;
    sessionManager.getSession(user.mode).handlePlayerInput(user.userId, data.angle, !!data.boosting, data.seq);
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
