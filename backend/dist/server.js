"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const http_1 = __importDefault(require("http"));
const socket_io_1 = require("socket.io");
const cors_1 = __importDefault(require("cors"));
const AuthService_1 = require("./services/AuthService");
const EconomyService_1 = require("./services/EconomyService");
const MissionService_1 = require("./services/MissionService");
const AdminService_1 = require("./services/AdminService");
const GameSessionManager_1 = require("./services/GameSessionManager");
const GameSessionService_1 = require("./services/GameSessionService");
const ProgressionService_1 = require("./services/ProgressionService");
const Database_1 = require("./db/Database");
const app = (0, express_1.default)();
app.use((0, cors_1.default)());
app.use(express_1.default.json());
const server = http_1.default.createServer(app);
const io = new socket_io_1.Server(server, { cors: { origin: '*', methods: ['GET', 'POST'] } });
const connectedSockets = new Map();
const VALID_MODES = ['classic', 'battle_royale', 'team', 'event'];
const asMode = (m) => (VALID_MODES.includes(m) ? m : 'classic');
// Respawn pricing — mirrors the RESPAWN OPTIONS panel.
const RESPAWN_COST = {
    stars: { stars: 20, tickets: 0, label: 'Stars' },
    ticket: { stars: 0, tickets: 1, label: 'Ticket' },
    ad: { stars: 0, tickets: 0, label: 'Watch Ad' },
    wait: { stars: 0, tickets: 0, label: 'Free Wait' },
};
const auth = (req, res) => {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
        res.status(401).json({ error: 'Unauthorized' });
        return null;
    }
    const a = AuthService_1.AuthService.verifyToken(token);
    if (!a) {
        res.status(401).json({ error: 'Invalid or expired token' });
        return null;
    }
    return a;
};
// --------------------------------------------------------------- REST API
app.post('/api/auth/register', async (req, res) => {
    const { username, email, password } = req.body;
    if (!username || !email || !password)
        return res.status(400).json({ error: 'Missing required registration fields' });
    const result = await AuthService_1.AuthService.register(username, email, password);
    if ('error' in result)
        return res.status(400).json(result);
    res.json(result);
});
app.post('/api/auth/login', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password)
        return res.status(400).json({ error: 'Missing username or password' });
    const result = await AuthService_1.AuthService.login(username, password);
    if ('error' in result)
        return res.status(400).json(result);
    res.json(result);
});
app.post('/api/auth/guest', (req, res) => res.json(AuthService_1.AuthService.createGuestAccount()));
const withRank = (profile) => profile ? { ...profile, rank: ProgressionService_1.ProgressionService.getRank(profile.level, profile.prestige), xpToNext: ProgressionService_1.ProgressionService.xpToNext(profile.level), nextEvolution: ProgressionService_1.ProgressionService.nextEvolution(profile.level, profile.evolutionXp, profile.prestige) } : profile;
app.get('/api/player/profile', (req, res) => {
    const a = auth(req, res);
    if (!a)
        return;
    res.json({ user: { id: a.userId, username: a.username, isGuest: a.isGuest }, profile: withRank(Database_1.db.getProfile(a.userId)) });
});
app.post('/api/player/evolution', (req, res) => {
    const a = auth(req, res);
    if (!a)
        return;
    const result = Database_1.db.equipEvolution(a.userId, req.body.evolution);
    res.json({ ...result, profile: withRank(result.profile) });
});
app.post('/api/player/prestige', (req, res) => {
    const a = auth(req, res);
    if (!a)
        return;
    const result = Database_1.db.prestige(a.userId);
    res.json({ ...result, profile: withRank(result.profile) });
});
app.get('/api/player/coupons', (req, res) => {
    const a = auth(req, res);
    if (!a)
        return;
    res.json({ coupons: Database_1.db.getProfile(a.userId)?.coupons || [] });
});
app.get('/api/modes', (_req, res) => {
    res.json({ modes: VALID_MODES.map(GameSessionService_1.getModeConfig) });
});
app.get('/api/world/events', (_req, res) => {
    const events = GameSessionManager_1.sessionManager.getActiveSessions().map(s => s.getState().currentEvent).filter(Boolean);
    res.json({ events });
});
app.get('/api/shop/catalog', (_req, res) => res.json(EconomyService_1.EconomyService.getCatalog()));
app.post('/api/shop/purchase', (req, res) => {
    const a = auth(req, res);
    if (!a)
        return;
    res.json(EconomyService_1.EconomyService.purchaseItem(a.userId, req.body.itemId));
});
app.post('/api/player/equip', (req, res) => {
    const a = auth(req, res);
    if (!a)
        return;
    const { skin } = req.body;
    const profile = Database_1.db.updateProfile(a.userId, { equippedSkin: skin });
    res.json({ success: true, profile });
});
app.post('/api/player/equip-accessory', (req, res) => {
    const a = auth(req, res);
    if (!a)
        return;
    const { accessoryId } = req.body;
    const profile = Database_1.db.getProfile(a.userId);
    if (!profile)
        return res.status(404).json({ error: 'Profile not found' });
    // null/undefined means unequip; otherwise set the accessory
    const updated = Database_1.db.updateProfile(a.userId, { equippedAccessory: accessoryId || undefined });
    res.json({ success: true, profile: withRank(updated) });
});
app.get('/api/missions', (req, res) => {
    const a = auth(req, res);
    if (!a)
        return;
    res.json({ missions: MissionService_1.MissionService.getUserMissions(a.userId) });
});
app.post('/api/missions/claim', (req, res) => {
    const a = auth(req, res);
    if (!a)
        return;
    res.json(MissionService_1.MissionService.claimReward(a.userId, req.body.missionId));
});
app.get('/api/achievements', (req, res) => {
    const a = auth(req, res);
    if (!a)
        return;
    res.json({ achievements: Database_1.db.getAchievements(a.userId) });
});
app.get('/api/leaderboard', (_req, res) => res.json({ leaderboard: Database_1.db.getLeaderboard() }));
app.post('/api/ads/claim', (req, res) => {
    const a = auth(req, res);
    if (!a)
        return;
    const profile = Database_1.db.getProfile(a.userId);
    if (!profile)
        return res.status(404).json({ error: 'Profile not found' });
    const bonusStars = 500, bonusTickets = 2;
    const updated = Database_1.db.updateProfile(a.userId, { stars: profile.stars + bonusStars, tickets: profile.tickets + bonusTickets });
    res.json({ success: true, message: `Claimed Double Reward! +${bonusStars} Stars & +${bonusTickets} Tickets.`, bonusStars, bonusTickets, profile: updated });
});
app.post('/api/match/summary', (req, res) => {
    const a = auth(req, res);
    if (!a)
        return;
    const { score = 0, kills = 0, placement = 10, survivalSeconds = 60, distanceKm = 0, areasVisited = 0, cherriesEaten = 0 } = req.body;
    const profile = Database_1.db.getProfile(a.userId);
    if (!profile)
        return res.status(404).json({ error: 'Profile not found' });
    const won = placement === 1;
    const earnedStars = Math.floor(score / 10) + kills * 50 + (won ? 500 : 0);
    const earnedXP = Math.floor(score / 5) + kills * 100 + (won ? 300 : 0);
    const earnedEvoXP = Math.floor(score / 50) + kills * 10 + (won ? 50 : 0);
    // Persistent stats
    Database_1.db.updateProfile(a.userId, {
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
    Database_1.db.incrementCollectible(a.userId, 'match', 1);
    Database_1.db.incrementCollectible(a.userId, 'survive', survivalSeconds);
    Database_1.db.incrementCollectible(a.userId, 'distance', distanceKm);
    if (won)
        Database_1.db.incrementCollectible(a.userId, 'win', 1);
    Database_1.db.recordPeakMetric(a.userId, 'score', Math.round(score));
    if (areasVisited > 0)
        Database_1.db.recordPeakMetric(a.userId, 'explore', areasVisited);
    Database_1.db.updateLeaderboard(a.userId, a.username, Math.round(score), won);
    // Server-authoritative XP / Evolution XP with account level-ups
    const { profile: updated, levelsGained } = Database_1.db.grantRewards(a.userId, { stars: earnedStars, xp: earnedXP, evoXp: earnedEvoXP });
    const scoreEvolution = ProgressionService_1.ProgressionService.scoreToEvolution(Math.round(score));
    res.json({ success: true, earnedStars, earnedXP, earnedEvoXP, levelsGained, placement, kills, score: Math.round(score), scoreEvolution, profile: withRank(updated) });
});
app.post('/api/match/abandon', (req, res) => {
    const a = auth(req, res);
    if (!a)
        return;
    GameSessionManager_1.sessionManager.findPlayerSession(a.userId)?.removePlayer(a.userId);
    res.json({ success: true, message: 'Match abandoned cleanly' });
});
app.get('/api/screens/:screenId', (req, res) => {
    const valid = ['menu', 'matchmaking', 'play', 'pause', 'gameover', 'respawn', 'ad-reward', 'spectate'];
    if (!valid.includes(req.params.screenId))
        return res.status(404).json({ error: `Screen not found` });
    res.json({ screenId: req.params.screenId, status: 'active', config: { adInventoryReady: true, region: 'North America East 30Hz' } });
});
app.get('/api/admin/telemetry', (_req, res) => {
    res.json({ telemetry: AdminService_1.AdminService.getTelemetry(GameSessionManager_1.sessionManager.getActiveModeCount(), connectedSockets.size), auditLogs: AdminService_1.AdminService.getAuditLogs() });
});
// --------------------------------------------------------------- realtime
io.on('connection', (socket) => {
    socket.on('authenticate', (data) => {
        const a = AuthService_1.AuthService.verifyToken(data.token);
        if (!a) {
            socket.emit('auth_error', { message: 'Authentication failed' });
            return;
        }
        const mode = asMode(data.mode);
        const profile = Database_1.db.getProfile(a.userId);
        const skin = data.skin || profile?.equippedSkin || 'Forest';
        const evolution = profile?.equippedEvolution || 'Baby';
        const region = (data.matchType === 'local' ? '📍 ' : '') + (data.region || 'Global');
        // Leave any previous mode room, join the new one
        const prev = connectedSockets.get(socket.id);
        if (prev && prev.mode !== mode) {
            socket.leave(prev.mode);
            GameSessionManager_1.sessionManager.findPlayerSession(a.userId)?.removePlayer(a.userId);
        }
        connectedSockets.set(socket.id, { userId: a.userId, username: a.username, mode, skin, evolution, region });
        socket.join(mode);
        const session = GameSessionManager_1.sessionManager.getSession(mode);
        const snake = session.registerPlayer(a.userId, a.username, skin, false, evolution, region);
        socket.emit('authenticated', { userId: a.userId, snake, mode, region, config: session.getConfig() });
    });
    socket.on('client_input', (data) => {
        const user = connectedSockets.get(socket.id);
        if (!user)
            return;
        GameSessionManager_1.sessionManager.getSession(user.mode).handlePlayerInput(user.userId, data.angle, !!data.boosting, data.seq);
    });
    socket.on('activate_ability', () => {
        const user = connectedSockets.get(socket.id);
        if (!user)
            return;
        const used = GameSessionManager_1.sessionManager.getSession(user.mode).activateAbility(user.userId);
        socket.emit('ability_result', { used });
    });
    socket.on('respawn', (data) => {
        const user = connectedSockets.get(socket.id);
        if (!user)
            return;
        const method = data?.method || 'wait';
        const cost = RESPAWN_COST[method] || RESPAWN_COST.wait;
        const profile = Database_1.db.getProfile(user.userId);
        if (!profile) {
            socket.emit('respawn_result', { success: false, message: 'No profile' });
            return;
        }
        if (profile.stars < cost.stars || profile.tickets < cost.tickets) {
            socket.emit('respawn_result', { success: false, message: `Not enough ${cost.label}` });
            return;
        }
        const updatedProfile = (cost.stars || cost.tickets)
            ? Database_1.db.updateProfile(user.userId, { stars: profile.stars - cost.stars, tickets: profile.tickets - cost.tickets })
            : profile;
        const snake = GameSessionManager_1.sessionManager.getSession(user.mode).respawnPlayer(user.userId, user.username, user.skin, user.evolution, user.region);
        socket.emit('respawn_result', { success: true, snake, profile: withRank(updatedProfile), method });
    });
    socket.on('disconnect', () => {
        const user = connectedSockets.get(socket.id);
        if (user) {
            GameSessionManager_1.sessionManager.getSession(user.mode).handlePlayerDisconnect(user.userId);
            connectedSockets.delete(socket.id);
        }
    });
});
// Broadcast each active mode's world to its room @ 30 Hz
setInterval(() => {
    for (const session of GameSessionManager_1.sessionManager.getActiveSessions()) {
        const state = session.getState();
        io.to(state.mode).emit('game_state_tick', {
            tick: state.tick,
            timestamp: Date.now(),
            mode: state.mode,
            snakes: Object.values(state.snakes),
            food: Object.values(state.food),
            safeZone: state.safeZone,
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
exports.default = app;
