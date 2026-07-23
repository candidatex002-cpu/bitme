"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.db = exports.Database = void 0;
const ProgressionService_1 = require("../services/ProgressionService");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
class Database {
    users = new Map();
    profiles = new Map();
    missions = new Map();
    achievements = new Map();
    auditLogs = [];
    globalLeaderboard = new Map();
    constructor() {
        this.seedDefaultData();
    }
    // ------------------------------------------------------------- templates
    defaultMissions() {
        return [
            // DAILY
            { id: 'ms_cherry', title: 'Collect 30 Cherries', description: 'Snack on 30 cherries', category: 'daily', metric: 'cherry', icon: '🍒', targetCount: 30, currentCount: 0, rewardStars: 150, rewardXP: 120, rewardEvoXP: 40, isCompleted: false, isClaimed: false },
            { id: 'ms_frog', title: 'Catch 10 Frogs', description: 'Gobble 10 frogs', category: 'daily', metric: 'frog', icon: '🐸', targetCount: 10, currentCount: 0, rewardStars: 150, rewardXP: 120, rewardEvoXP: 40, isCompleted: false, isClaimed: false },
            { id: 'ms_star', title: 'Collect 100 Stars', description: 'Gather 100 star pickups', category: 'daily', metric: 'star', icon: '⭐', targetCount: 100, currentCount: 0, rewardStars: 200, rewardXP: 150, rewardEvoXP: 50, isCompleted: false, isClaimed: false },
            { id: 'ms_eat', title: 'Defeat 5 Snakes', description: 'Take down 5 rival snakes', category: 'daily', metric: 'kill', icon: '🐍', targetCount: 5, currentCount: 0, rewardStars: 250, rewardXP: 180, rewardEvoXP: 60, isCompleted: false, isClaimed: false },
            { id: 'ms_boost', title: 'Use Boost 20 Times', description: 'Sprint with boost 20 times', category: 'daily', metric: 'boost', icon: '⚡', targetCount: 20, currentCount: 0, rewardStars: 120, rewardXP: 90, rewardEvoXP: 30, isCompleted: false, isClaimed: false },
            { id: 'ms_win', title: 'Win One Match', description: 'Finish #1 in any mode', category: 'daily', metric: 'win', icon: '🏆', targetCount: 1, currentCount: 0, rewardStars: 300, rewardXP: 220, rewardEvoXP: 80, isCompleted: false, isClaimed: false },
            // WEEKLY
            { id: 'ms_cherry1k', title: 'Collect 1000 Cherries', description: 'A whole week of cherries', category: 'weekly', metric: 'cherry', icon: '🍒', targetCount: 1000, currentCount: 0, rewardStars: 800, rewardXP: 500, rewardEvoXP: 200, isCompleted: false, isClaimed: false },
            { id: 'ms_travel', title: 'Travel 50 KM', description: 'Slither 50 kilometres', category: 'weekly', metric: 'distance', icon: '📍', targetCount: 50, currentCount: 0, rewardStars: 700, rewardXP: 450, rewardEvoXP: 180, isCompleted: false, isClaimed: false },
            { id: 'ms_win20', title: 'Win 20 Matches', description: 'Claim 20 victories this week', category: 'weekly', metric: 'win', icon: '👑', targetCount: 20, currentCount: 0, rewardStars: 1000, rewardXP: 700, rewardEvoXP: 300, isCompleted: false, isClaimed: false },
            { id: 'ms_treasure25', title: 'Open 25 Treasure Chests', description: 'Crack 25 gift boxes', category: 'weekly', metric: 'treasure', icon: '🎁', targetCount: 25, currentCount: 0, rewardStars: 900, rewardXP: 600, rewardEvoXP: 250, isCompleted: false, isClaimed: false },
            // EVENT
            { id: 'ms_survive', title: 'Survive 30 Minutes', description: 'Total survival time across matches', category: 'event', metric: 'survive', icon: '⏱️', targetCount: 1800, currentCount: 0, rewardStars: 1200, rewardXP: 800, rewardEvoXP: 300, isCompleted: false, isClaimed: false },
            { id: 'ms_score5k', title: 'Score 5,000 in a Match', description: 'Reach 5,000 score in one match', category: 'event', metric: 'score', icon: '🐉', targetCount: 5000, currentCount: 0, rewardStars: 2000, rewardXP: 1000, rewardEvoXP: 500, isCompleted: false, isClaimed: false },
        ];
    }
    defaultAchievements() {
        return [
            { id: 'ach_first', title: 'First Steps', description: 'Reach Score 100', tier: 'bronze', metric: 'score', target: 100, progress: 0, isUnlocked: false, rewardStars: 100, icon: '⭐' },
            { id: 'ach_cherry', title: 'Cherry Lover', description: 'Collect 500 Cherries', tier: 'silver', metric: 'cherry', target: 500, progress: 0, isUnlocked: false, rewardStars: 500, icon: '🍒' },
            { id: 'ach_hunter', title: 'Snake Hunter', description: 'Eat 50 Snakes', tier: 'gold', metric: 'kill', target: 50, progress: 0, isUnlocked: false, rewardStars: 800, icon: '💀' },
            { id: 'ach_explorer', title: 'World Explorer', description: 'Visit all areas of the park', tier: 'gold', metric: 'explore', target: 6, progress: 0, isUnlocked: false, rewardStars: 600, icon: '🗺️' },
            { id: 'ach_champion', title: 'Park Champion', description: 'Reach Score 10,000', tier: 'diamond', metric: 'score', target: 10000, progress: 0, isUnlocked: false, rewardStars: 2000, icon: '🏆' },
        ];
    }
    seedDefaultData() {
        const demoUser = {
            id: 'usr_ranger_alpha',
            username: 'RangerAlpha',
            email: 'alpha@anacondapark.io',
            passwordHash: bcryptjs_1.default.hashSync('Anaconda2026!', 10),
            isGuest: false,
            createdAt: new Date().toISOString(),
        };
        const demoProfile = {
            userId: demoUser.id,
            displayName: 'Apex Anaconda',
            avatarUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=AnacondaAlpha',
            level: 176, xp: 3450, evolutionXp: 2100, prestige: 0, rating: 1420, stars: 1250, tickets: 15,
            equippedSkin: 'Forest', equippedEvolution: 'Young', unlockedEvolutions: ['Baby', 'Young'], equippedTrail: 'Jungle Glow',
            stats: { matchesPlayed: 42, matchesWon: 11, totalKills: 156, totalFoodEaten: 4200, highestScore: 18500, survivalTimeSeconds: 14200, cherriesCollected: 320 },
        };
        this.users.set(demoUser.id, demoUser);
        this.users.set(demoUser.username.toLowerCase(), demoUser);
        this.profiles.set(demoUser.id, demoProfile);
        this.missions.set(demoUser.id, this.defaultMissions());
        this.achievements.set(demoUser.id, this.defaultAchievements());
        this.globalLeaderboard.set('usr_ranger_alpha', { displayName: 'Apex Anaconda', score: 18500, wins: 11 });
        this.globalLeaderboard.set('bot_1', { displayName: 'ViperKing', score: 16200, wins: 9 });
        this.globalLeaderboard.set('bot_2', { displayName: 'JunglePython', score: 14100, wins: 7 });
        this.globalLeaderboard.set('bot_3', { displayName: 'CobraNova', score: 12800, wins: 5 });
        this.globalLeaderboard.set('bot_4', { displayName: 'MambaMint', score: 9400, wins: 3 });
    }
    createUser(username, email, passwordHash, isGuest = false) {
        const id = `usr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        const user = { id, username, email, passwordHash, isGuest, createdAt: new Date().toISOString() };
        const profile = {
            userId: id,
            displayName: username,
            avatarUrl: `https://api.dicebear.com/7.x/bottts/svg?seed=${username}`,
            level: 1, xp: 0, evolutionXp: 0, prestige: 0, rating: 1000, stars: 500, tickets: 5,
            equippedSkin: 'Forest', equippedEvolution: 'Baby', unlockedEvolutions: ['Baby'], equippedTrail: 'Classic Dust',
            stats: { matchesPlayed: 0, matchesWon: 0, totalKills: 0, totalFoodEaten: 0, highestScore: 0, survivalTimeSeconds: 0, cherriesCollected: 0 },
        };
        this.users.set(id, user);
        this.users.set(username.toLowerCase(), user);
        this.profiles.set(id, profile);
        this.missions.set(id, this.defaultMissions());
        this.achievements.set(id, this.defaultAchievements());
        return { user, profile };
    }
    getUserByUsername(username) { return this.users.get(username.toLowerCase()); }
    getUserById(id) { return this.users.get(id); }
    getProfile(userId) { return this.profiles.get(userId); }
    updateProfile(userId, updates) {
        const existing = this.profiles.get(userId);
        if (!existing)
            return undefined;
        const updated = { ...existing, ...updates };
        this.profiles.set(userId, updated);
        return updated;
    }
    // ------------------------------------------------------------- missions
    getMissions(userId) {
        if (!this.missions.has(userId))
            this.missions.set(userId, this.defaultMissions());
        return this.missions.get(userId);
    }
    getAchievements(userId) {
        if (!this.achievements.has(userId))
            this.achievements.set(userId, this.defaultAchievements());
        return this.achievements.get(userId);
    }
    // Additive or max-based progress against a metric across missions + achievements.
    incrementCollectible(userId, metric, amount = 1) {
        this.applyProgress(userId, metric, amount, false);
    }
    // score-style metrics record the peak value rather than a sum.
    recordPeakMetric(userId, metric, value) {
        this.applyProgress(userId, metric, value, true);
    }
    applyProgress(userId, metric, amount, isPeak) {
        const missions = this.getMissions(userId);
        for (const m of missions) {
            if (m.metric !== metric || m.isCompleted)
                continue;
            const next = isPeak ? Math.max(m.currentCount, amount) : m.currentCount + amount;
            m.currentCount = Math.min(m.targetCount, next);
            if (m.currentCount >= m.targetCount)
                m.isCompleted = true;
        }
        const achs = this.getAchievements(userId);
        for (const a of achs) {
            if (a.metric !== metric || a.isUnlocked)
                continue;
            const next = isPeak ? Math.max(a.progress, amount) : a.progress + amount;
            a.progress = Math.min(a.target, next);
            if (a.progress >= a.target) {
                a.isUnlocked = true;
                const profile = this.getProfile(userId);
                if (profile)
                    this.updateProfile(userId, { stars: profile.stars + a.rewardStars });
            }
        }
    }
    claimMissionReward(userId, missionId) {
        const userMissions = this.getMissions(userId);
        const target = userMissions.find(m => m.id === missionId);
        if (!target || !target.isCompleted || target.isClaimed) {
            return { success: false, stars: 0, xp: 0, evoXp: 0, updatedMissions: userMissions };
        }
        target.isClaimed = true;
        const { profile } = this.grantRewards(userId, { stars: target.rewardStars, xp: target.rewardXP, evoXp: target.rewardEvoXP });
        return { success: true, stars: target.rewardStars, xp: target.rewardXP, evoXp: target.rewardEvoXP, updatedMissions: userMissions, profile };
    }
    // ------------------------------------------------------------- progression
    // Grants stars/xp/evoXp server-side, rolls account level-ups, and unlocks evolutions.
    grantRewards(userId, r) {
        const profile = this.getProfile(userId);
        if (!profile)
            return { levelsGained: 0 };
        const evoXp = profile.evolutionXp + (r.evoXp || 0);
        const leveled = ProgressionService_1.ProgressionService.applyXp(profile.level, profile.xp, r.xp || 0);
        const unlocked = ProgressionService_1.ProgressionService.unlockedEvolutions(leveled.level, evoXp, profile.prestige);
        const merged = Array.from(new Set([...profile.unlockedEvolutions, ...unlocked]));
        const updated = this.updateProfile(userId, {
            stars: profile.stars + (r.stars || 0),
            xp: leveled.xp,
            level: leveled.level,
            evolutionXp: evoXp,
            unlockedEvolutions: merged,
        });
        return { profile: updated, levelsGained: leveled.levelsGained };
    }
    equipEvolution(userId, evolution) {
        const profile = this.getProfile(userId);
        if (!profile)
            return { success: false, message: 'No profile' };
        if (!profile.unlockedEvolutions.includes(evolution))
            return { success: false, message: `${evolution} not unlocked yet` };
        return { success: true, message: `Now playing as ${evolution}`, profile: this.updateProfile(userId, { equippedEvolution: evolution }) };
    }
    prestige(userId) {
        const profile = this.getProfile(userId);
        if (!profile)
            return { success: false, message: 'No profile' };
        if (profile.level < 1000)
            return { success: false, message: 'Reach Level 1000 to Prestige' };
        const prestige = profile.prestige + 1;
        const unlocked = ProgressionService_1.ProgressionService.unlockedEvolutions(1000, profile.evolutionXp, prestige);
        const merged = Array.from(new Set([...profile.unlockedEvolutions, ...unlocked]));
        const updated = this.updateProfile(userId, {
            level: 1, xp: 0, prestige, tickets: profile.tickets + 10, stars: profile.stars + 5000, unlockedEvolutions: merged,
        });
        return { success: true, message: `Prestige ${prestige} unlocked! Kept all skins & evolutions.`, profile: updated };
    }
    // ------------------------------------------------------------- audit + leaderboard
    recordAuditLog(log) {
        this.auditLogs.unshift(log);
        if (this.auditLogs.length > 500)
            this.auditLogs.pop();
    }
    getAuditLogs() { return this.auditLogs; }
    updateLeaderboard(userId, displayName, score, won) {
        const existing = this.globalLeaderboard.get(userId);
        const newScore = Math.max(existing?.score || 0, score);
        const newWins = (existing?.wins || 0) + (won ? 1 : 0);
        this.globalLeaderboard.set(userId, { displayName, score: newScore, wins: newWins });
    }
    getLeaderboard() {
        return Array.from(this.globalLeaderboard.entries())
            .map(([userId, data]) => ({ userId, ...data }))
            .sort((a, b) => b.score - a.score)
            .map((entry, index) => ({ rank: index + 1, ...entry }));
    }
}
exports.Database = Database;
exports.db = new Database();
