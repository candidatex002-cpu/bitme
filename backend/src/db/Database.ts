import { UserAccount, PlayerProfile, PlayerStats, MissionObjective, Achievement, AntiCheatViolation, ProgressMetric, Evolution, CouponDefinition, CouponRedemption, SocialGraph, MatchRecord } from '../types';
import { ProgressionService } from '../services/ProgressionService';
import { SupabaseSync } from './SupabaseSync';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';

export class Database {
  private users: Map<string, UserAccount> = new Map();
  private profiles: Map<string, PlayerProfile> = new Map();
  private missions: Map<string, MissionObjective[]> = new Map();
  private achievements: Map<string, Achievement[]> = new Map();
  private auditLogs: AntiCheatViolation[] = [];
  private globalLeaderboard: Map<string, { displayName: string; score: number; wins: number }> = new Map();
  // §7 Server-driven coupon system — admin-managed definitions + redemption ledger.
  private couponDefs: Map<string, CouponDefinition> = new Map();
  private couponRedemptions: CouponRedemption[] = [];
  // §8 Social graph — per-user friends / pending requests / blocks (persisted).
  private social: Map<string, SocialGraph> = new Map();
  // §V7 Per-user match history (most-recent-first, capped).
  private matchHistory: Map<string, MatchRecord[]> = new Map();

  // §10 File-based persistence — profiles/progress/leaderboard survive restarts.
  // Swap load()/flush() for a Postgres/Redis client to go fully cloud/multi-node.
  private readonly dataFile: string;
  private saveTimer: NodeJS.Timeout | null = null;
  private dirty = false;

  constructor() {
    this.dataFile = process.env.DATA_FILE || path.join(process.cwd(), 'data', 'anaconda-db.json');
    this.seedDefaultData();
    this.load();
    this.hydrateFromCloud(); // §11 Supabase (async, best-effort) overrides the local snapshot
    this.registerFlushHooks();
  }

  // §11 Pull the latest snapshot from Supabase on boot (if configured).
  private async hydrateFromCloud() {
    if (!SupabaseSync.configured()) return;
    const data = await SupabaseSync.loadSnapshot();
    if (data) { this.applySnapshot(data); console.log('[supabase] hydrated cloud snapshot'); }
  }

  // ------------------------------------------------------------- persistence
  private registerFlushHooks() {
    const flush = () => this.flush();
    process.once('beforeExit', flush);
    process.once('SIGINT', () => { this.flush(); process.exit(0); });
    process.once('SIGTERM', () => { this.flush(); process.exit(0); });
  }

  private markDirty() {
    this.dirty = true;
    if (this.saveTimer) return;
    this.saveTimer = setTimeout(() => { this.saveTimer = null; this.flush(); }, 1500); // debounce disk writes
  }

  private flush() {
    if (!this.dirty) return;
    this.dirty = false;
    const snapshot = {
      v: 1,
      users: Array.from(new Set(this.users.values())),          // id + username alias share one object
      profiles: Array.from(this.profiles.values()),
      missions: Array.from(this.missions.entries()),
      achievements: Array.from(this.achievements.entries()),
      leaderboard: Array.from(this.globalLeaderboard.entries()),
      couponDefs: Array.from(this.couponDefs.values()),
      couponRedemptions: this.couponRedemptions,
      social: Array.from(this.social.entries()),
      matchHistory: Array.from(this.matchHistory.entries()),
    };
    try {
      fs.mkdirSync(path.dirname(this.dataFile), { recursive: true });
      const tmp = this.dataFile + '.tmp';
      fs.writeFileSync(tmp, JSON.stringify(snapshot));
      fs.renameSync(tmp, this.dataFile); // atomic replace
    } catch { /* read-only / serverless FS — persistence off, in-memory still works */ }
    SupabaseSync.saveSnapshot(snapshot); // §11 mirror to the cloud (no-op unless configured)
  }

  // Populate the in-memory maps from a persisted snapshot (file or cloud).
  private applySnapshot(data: any) {
    if (data.users) for (const u of data.users) { this.users.set(u.id, u); this.users.set(u.username.toLowerCase(), u); }
    if (data.profiles) for (const p of data.profiles) this.profiles.set(p.userId, p);
    if (data.missions) for (const [k, v] of data.missions) this.missions.set(k, v);
    if (data.achievements) for (const [k, v] of data.achievements) this.achievements.set(k, v);
    if (data.leaderboard) for (const [k, v] of data.leaderboard) this.globalLeaderboard.set(k, v);
    if (data.couponDefs) for (const d of data.couponDefs) this.couponDefs.set(d.id, d);
    if (data.couponRedemptions) this.couponRedemptions = data.couponRedemptions;
    if (data.social) for (const [k, v] of data.social) this.social.set(k, v);
    if (data.matchHistory) for (const [k, v] of data.matchHistory) this.matchHistory.set(k, v);
  }

  private load() {
    try {
      if (!fs.existsSync(this.dataFile)) return;
      this.applySnapshot(JSON.parse(fs.readFileSync(this.dataFile, 'utf8')));
    } catch { /* corrupt/unreadable — fall back to seeded defaults */ }
  }

  // ------------------------------------------------------------- templates
  private defaultMissions(): MissionObjective[] {
    return [
      // DAILY — story quests (Legend of the Lost Crown)
      { id: 'ms_cherry', title: '🍒 Feed the Hungry Village', description: 'Gather 30 cherries for the starving village', category: 'daily', metric: 'cherry', icon: '🍒', targetCount: 30, currentCount: 0, rewardStars: 150, rewardXP: 120, rewardEvoXP: 40, isCompleted: false, isClaimed: false },
      { id: 'ms_frog', title: '🐸 A Feast for the Frog Chef', description: 'Bring 10 frogs to the royal kitchen', category: 'daily', metric: 'frog', icon: '🐸', targetCount: 10, currentCount: 0, rewardStars: 150, rewardXP: 120, rewardEvoXP: 40, isCompleted: false, isClaimed: false },
      { id: 'ms_star', title: '⭐ Recover Lost Crown Fragments', description: 'Reclaim 100 shattered Star Fragments', category: 'daily', metric: 'star', icon: '⭐', targetCount: 100, currentCount: 0, rewardStars: 200, rewardXP: 150, rewardEvoXP: 50, isCompleted: false, isClaimed: false },
      { id: 'ms_eat', title: '🛡️ Defeat 5 Venom Soldiers', description: 'Drive back 5 soldiers of the Venom Order', category: 'daily', metric: 'kill', icon: '🛡️', targetCount: 5, currentCount: 0, rewardStars: 250, rewardXP: 180, rewardEvoXP: 60, isCompleted: false, isClaimed: false },
      { id: 'ms_boost', title: '⚡ Master the Royal Dash', description: 'Use the royal dash 20 times', category: 'daily', metric: 'boost', icon: '⚡', targetCount: 20, currentCount: 0, rewardStars: 120, rewardXP: 90, rewardEvoXP: 30, isCompleted: false, isClaimed: false },
      { id: 'ms_win', title: '👑 Claim a Royal Victory', description: 'Finish #1 to honour the crown', category: 'daily', metric: 'win', icon: '👑', targetCount: 1, currentCount: 0, rewardStars: 300, rewardXP: 220, rewardEvoXP: 80, isCompleted: false, isClaimed: false },
      // WEEKLY — chapter goals
      { id: 'ms_cherry1k', title: '🍒 Restore the Great Orchard', description: 'Harvest 1000 cherries this week', category: 'weekly', metric: 'cherry', icon: '🍒', targetCount: 1000, currentCount: 0, rewardStars: 800, rewardXP: 500, rewardEvoXP: 200, isCompleted: false, isClaimed: false },
      { id: 'ms_travel', title: '🗺️ Explore the Ancient Roads', description: 'Travel 50 km along the old kingdom roads', category: 'weekly', metric: 'distance', icon: '🗺️', targetCount: 50, currentCount: 0, rewardStars: 700, rewardXP: 450, rewardEvoXP: 180, isCompleted: false, isClaimed: false },
      { id: 'ms_win20', title: '👑 Rally the Seven Kingdoms', description: 'Win 20 matches to unite the clans', category: 'weekly', metric: 'win', icon: '👑', targetCount: 20, currentCount: 0, rewardStars: 1000, rewardXP: 700, rewardEvoXP: 300, isCompleted: false, isClaimed: false },
      { id: 'ms_treasure25', title: '🎁 Unearth Royal Relics', description: 'Recover 25 lost royal relics', category: 'weekly', metric: 'treasure', icon: '🎁', targetCount: 25, currentCount: 0, rewardStars: 900, rewardXP: 600, rewardEvoXP: 250, isCompleted: false, isClaimed: false },
      // EVENT — the Venom siege
      { id: 'ms_survive', title: '⏳ Endure the Venom Siege', description: 'Survive 30 minutes against the Venom Order', category: 'event', metric: 'survive', icon: '⏳', targetCount: 1800, currentCount: 0, rewardStars: 1200, rewardXP: 800, rewardEvoXP: 300, isCompleted: false, isClaimed: false },
      { id: 'ms_score5k', title: '🐉 Awaken the Titan Within', description: 'Reach 5,000 score in a single match', category: 'event', metric: 'score', icon: '🐉', targetCount: 5000, currentCount: 0, rewardStars: 2000, rewardXP: 1000, rewardEvoXP: 500, isCompleted: false, isClaimed: false },
    ];
  }

  private defaultAchievements(): Achievement[] {
    return [
      { id: 'ach_first', title: 'First Steps', description: 'Reach Score 100', tier: 'bronze', metric: 'score', target: 100, progress: 0, isUnlocked: false, rewardStars: 100, icon: '⭐' },
      { id: 'ach_cherry', title: 'Cherry Lover', description: 'Collect 500 Cherries', tier: 'silver', metric: 'cherry', target: 500, progress: 0, isUnlocked: false, rewardStars: 500, icon: '🍒' },
      { id: 'ach_hunter', title: 'Snake Hunter', description: 'Eat 50 Snakes', tier: 'gold', metric: 'kill', target: 50, progress: 0, isUnlocked: false, rewardStars: 800, icon: '💀' },
      { id: 'ach_explorer', title: 'World Explorer', description: 'Visit all areas of the park', tier: 'gold', metric: 'explore', target: 6, progress: 0, isUnlocked: false, rewardStars: 600, icon: '🗺️' },
      { id: 'ach_champion', title: 'Park Champion', description: 'Reach Score 10,000', tier: 'diamond', metric: 'score', target: 10000, progress: 0, isUnlocked: false, rewardStars: 2000, icon: '🏆' },
    ];
  }

  // §V7 Full zeroed statistics — one place so every new profile has the complete shape.
  public static defaultStats(): PlayerStats {
    return {
      matchesPlayed: 0, matchesWon: 0, matchesLost: 0, totalFoodEaten: 0, highestScore: 0,
      survivalTimeSeconds: 0, longestSurvivalSeconds: 0, totalDistanceKm: 0, totalStars: 0,
      cherriesCollected: 0, applesCollected: 0, frogsCollected: 0, powerupsCollected: 0, couponsEarned: 0,
      totalKills: 0, totalDeaths: 0, longestKillStreak: 0, mostKillsInMatch: 0,
      totalDamageDealt: 0, totalDamageReceived: 0, mostDamageDealt: 0, mostDamageReceived: 0, bossKills: 0,
    };
  }

  private seedDefaultData() {
    const demoUser: UserAccount = {
      id: 'usr_ranger_alpha',
      username: 'RangerAlpha',
      email: 'alpha@anacondapark.io',
      passwordHash: bcrypt.hashSync('Anaconda2026!', 10),
      isGuest: false,
      createdAt: new Date().toISOString(),
    };

    const demoProfile: PlayerProfile = {
      userId: demoUser.id,
      displayName: 'Apex Anaconda',
      avatarUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=AnacondaAlpha',
      level: 176, xp: 3450, evolutionXp: 2100, prestige: 0, rating: 1420, stars: 1250, tickets: 15,
      equippedSkin: 'Forest', equippedEvolution: 'Young', unlockedEvolutions: ['Baby', 'Young'], equippedTrail: 'Jungle Glow',
      equippedAccessory: undefined, unlockedAccessories: [],
      stats: { ...Database.defaultStats(), matchesPlayed: 42, matchesWon: 11, matchesLost: 31, totalKills: 156, totalFoodEaten: 4200, highestScore: 18500, survivalTimeSeconds: 14200, cherriesCollected: 320, totalStars: 5200 },
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

    // §7 Example coupon definitions — generic partner labels only (no hard-coded real brands).
    // Admins edit/add these at runtime; nothing here is baked into the client.
    const now = new Date().toISOString();
    const seedCoupons: CouponDefinition[] = [
      { id: 'cpn_partner_cafe', title: '10% Off at Partner Cafe', storeName: 'Approved Food Partner', discountText: '10% off your next order', icon: '☕', enabled: true, expiryDate: '2026-12-31', regions: 'all', minLevel: 3, minPrestige: 0, costStars: 800, redemptionLimit: 500, perUserLimit: 1, redemptionCount: 0, autoGrant: false, createdAt: now, updatedAt: now },
      { id: 'cpn_partner_retail', title: 'Partner Retail Voucher', storeName: 'Approved Retail Partner', discountText: '₹100 store credit', icon: '🛍️', enabled: true, expiryDate: '2026-12-31', regions: ['India', 'Global'], minLevel: 8, minPrestige: 0, costStars: 2000, redemptionLimit: 200, perUserLimit: 1, redemptionCount: 0, autoGrant: false, createdAt: now, updatedAt: now },
      { id: 'cpn_welcome', title: 'Welcome Explorer Gift', storeName: 'Anaconda Park', discountText: 'Free seasonal trail effect', icon: '🎁', enabled: true, expiryDate: '2026-12-31', regions: 'all', minLevel: 1, minPrestige: 0, costStars: 0, redemptionLimit: -1, perUserLimit: 1, redemptionCount: 0, autoGrant: true, createdAt: now, updatedAt: now },
    ];
    for (const c of seedCoupons) this.couponDefs.set(c.id, c);
  }

  public createUser(username: string, email: string, passwordHash: string, isGuest: boolean = false): { user: UserAccount; profile: PlayerProfile } {
    const id = `usr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const user: UserAccount = { id, username, email, passwordHash, isGuest, createdAt: new Date().toISOString() };

    const profile: PlayerProfile = {
      userId: id,
      displayName: username,
      avatarUrl: `https://api.dicebear.com/7.x/bottts/svg?seed=${username}`,
      level: 1, xp: 0, evolutionXp: 0, prestige: 0, rating: 1000, stars: 500, tickets: 5,
      equippedSkin: 'Forest', equippedEvolution: 'Baby', unlockedEvolutions: ['Baby'], equippedTrail: 'Classic Dust',
      equippedAccessory: undefined, unlockedAccessories: [],
      stats: Database.defaultStats(),
      modeStats: {},
    };

    this.users.set(id, user);
    this.users.set(username.toLowerCase(), user);
    this.profiles.set(id, profile);
    this.missions.set(id, this.defaultMissions());
    this.achievements.set(id, this.defaultAchievements());
    this.markDirty();

    return { user, profile };
  }

  // §V7 Grant a consumable/collectible item into the player's inventory (additive).
  public grantItem(userId: string, itemId: string, qty = 1): PlayerProfile | undefined {
    const profile = this.profiles.get(userId);
    if (!profile) return undefined;
    const inv = { ...(profile.inventory || {}) };
    inv[itemId] = (inv[itemId] || 0) + qty;
    return this.updateProfile(userId, { inventory: inv });
  }

  public getUserByUsername(username: string): UserAccount | undefined { return this.users.get(username.toLowerCase()); }
  public getUserById(id: string): UserAccount | undefined { return this.users.get(id); }
  public getProfile(userId: string): PlayerProfile | undefined { return this.profiles.get(userId); }

  public updateProfile(userId: string, updates: Partial<PlayerProfile>): PlayerProfile | undefined {
    const existing = this.profiles.get(userId);
    if (!existing) return undefined;
    const updated = { ...existing, ...updates };
    this.profiles.set(userId, updated);
    this.markDirty();
    return updated;
  }

  // ------------------------------------------------------------- missions
  public getMissions(userId: string): MissionObjective[] {
    if (!this.missions.has(userId)) this.missions.set(userId, this.defaultMissions());
    return this.missions.get(userId)!;
  }

  public getAchievements(userId: string): Achievement[] {
    if (!this.achievements.has(userId)) this.achievements.set(userId, this.defaultAchievements());
    return this.achievements.get(userId)!;
  }

  // Additive or max-based progress against a metric across missions + achievements.
  public incrementCollectible(userId: string, metric: ProgressMetric, amount: number = 1) {
    this.applyProgress(userId, metric, amount, false);
  }

  // score-style metrics record the peak value rather than a sum.
  public recordPeakMetric(userId: string, metric: ProgressMetric, value: number) {
    this.applyProgress(userId, metric, value, true);
  }

  private applyProgress(userId: string, metric: ProgressMetric, amount: number, isPeak: boolean) {
    const missions = this.getMissions(userId);
    for (const m of missions) {
      if (m.metric !== metric || m.isCompleted) continue;
      const next = isPeak ? Math.max(m.currentCount, amount) : m.currentCount + amount;
      m.currentCount = Math.min(m.targetCount, next);
      if (m.currentCount >= m.targetCount) m.isCompleted = true;
    }
    const achs = this.getAchievements(userId);
    for (const a of achs) {
      if (a.metric !== metric || a.isUnlocked) continue;
      const next = isPeak ? Math.max(a.progress, amount) : a.progress + amount;
      a.progress = Math.min(a.target, next);
      if (a.progress >= a.target) {
        a.isUnlocked = true;
        const profile = this.getProfile(userId);
        if (profile) this.updateProfile(userId, { stars: profile.stars + a.rewardStars });
      }
    }
    this.markDirty();
  }

  public claimMissionReward(userId: string, missionId: string): { success: boolean; stars: number; xp: number; evoXp: number; updatedMissions: MissionObjective[]; profile?: PlayerProfile } {
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
  public grantRewards(userId: string, r: { stars?: number; xp?: number; evoXp?: number }): { profile?: PlayerProfile; levelsGained: number } {
    const profile = this.getProfile(userId);
    if (!profile) return { levelsGained: 0 };

    const evoXp = profile.evolutionXp + (r.evoXp || 0);
    const leveled = ProgressionService.applyXp(profile.level, profile.xp, r.xp || 0);
    const unlocked = ProgressionService.unlockedEvolutions(leveled.level, evoXp, profile.prestige);
    const merged = Array.from(new Set([...profile.unlockedEvolutions, ...unlocked])) as PlayerProfile['unlockedEvolutions'];

    const updated = this.updateProfile(userId, {
      stars: profile.stars + (r.stars || 0),
      xp: leveled.xp,
      level: leveled.level,
      evolutionXp: evoXp,
      unlockedEvolutions: merged,
    });
    return { profile: updated, levelsGained: leveled.levelsGained };
  }

  public equipEvolution(userId: string, evolution: Evolution): { success: boolean; message: string; profile?: PlayerProfile } {
    const profile = this.getProfile(userId);
    if (!profile) return { success: false, message: 'No profile' };
    if (!profile.unlockedEvolutions.includes(evolution)) return { success: false, message: `${evolution} not unlocked yet` };
    return { success: true, message: `Now playing as ${evolution}`, profile: this.updateProfile(userId, { equippedEvolution: evolution }) };
  }

  public prestige(userId: string): { success: boolean; message: string; profile?: PlayerProfile } {
    const profile = this.getProfile(userId);
    if (!profile) return { success: false, message: 'No profile' };
    if (profile.level < 1000) return { success: false, message: 'Reach Level 1000 to Prestige' };
    const prestige = profile.prestige + 1;
    const unlocked = ProgressionService.unlockedEvolutions(1000, profile.evolutionXp, prestige);
    const merged = Array.from(new Set([...profile.unlockedEvolutions, ...unlocked])) as PlayerProfile['unlockedEvolutions'];
    const updated = this.updateProfile(userId, {
      level: 1, xp: 0, prestige, tickets: profile.tickets + 10, stars: profile.stars + 5000, unlockedEvolutions: merged,
    });
    return { success: true, message: `Prestige ${prestige} unlocked! Kept all skins & evolutions.`, profile: updated };
  }

  // ------------------------------------------------------------- audit + leaderboard
  public recordAuditLog(log: AntiCheatViolation) {
    this.auditLogs.unshift(log);
    if (this.auditLogs.length > 500) this.auditLogs.pop();
  }

  public getAuditLogs(): AntiCheatViolation[] { return this.auditLogs; }

  public updateLeaderboard(userId: string, displayName: string, score: number, won: boolean) {
    const existing = this.globalLeaderboard.get(userId);
    const newScore = Math.max(existing?.score || 0, score);
    const newWins = (existing?.wins || 0) + (won ? 1 : 0);
    this.globalLeaderboard.set(userId, { displayName, score: newScore, wins: newWins });
    this.markDirty();
  }

  public getLeaderboard(): Array<{ rank: number; userId: string; displayName: string; score: number; wins: number }> {
    return Array.from(this.globalLeaderboard.entries())
      .map(([userId, data]) => ({ userId, ...data }))
      .sort((a, b) => b.score - a.score)
      .map((entry, index) => ({ rank: index + 1, ...entry }));
  }

  // §V7 Category leaderboards derived from persisted profiles. `userIds` (optional) scopes
  // the board — used for the Friends leaderboard. `region` scopes the Local board.
  public getCategoryLeaderboard(
    category: string,
    limit = 50,
    filter?: { userIds?: string[]; region?: string }
  ): Array<{ rank: number; userId: string; displayName: string; avatar: string; level: number; value: number }> {
    const metricOf: Record<string, (p: PlayerProfile) => number> = {
      level: p => p.level * 1_000_000 + p.prestige * 1000 + p.xp / 1000,
      score: p => p.stats.highestScore,
      kills: p => p.stats.totalKills,
      wins: p => p.stats.matchesWon,
      survival: p => p.stats.longestSurvivalSeconds,
      stars: p => p.stats.totalStars,
      explorer: p => (p.modeStats?.explorer?.chaptersCompleted || 0) * 1000 + (p.modeStats?.explorer?.highestScore || 0) / 1000,
    };
    const metric = metricOf[category] || metricOf.score;
    let entries = Array.from(this.profiles.values());
    if (filter?.userIds) { const set = new Set(filter.userIds); entries = entries.filter(p => set.has(p.userId)); }
    if (filter?.region) entries = entries.filter(p => (p.preferredRegion || p.country) === filter.region);
    return entries
      .map(p => ({ userId: p.userId, displayName: p.displayName, avatar: (p as any).avatar || '🐍', level: p.level, value: Math.round(metric(p)) }))
      .sort((a, b) => b.value - a.value)
      .slice(0, limit)
      .map((e, i) => ({ rank: i + 1, ...e }));
  }

  // ------------------------------------------------------------- §7 coupons
  public listCouponDefs(): CouponDefinition[] { return Array.from(this.couponDefs.values()); }
  public getCouponDef(id: string): CouponDefinition | undefined { return this.couponDefs.get(id); }
  public upsertCouponDef(def: CouponDefinition): CouponDefinition { this.couponDefs.set(def.id, def); this.markDirty(); return def; }
  public deleteCouponDef(id: string): boolean { const ok = this.couponDefs.delete(id); if (ok) this.markDirty(); return ok; }

  public recordCouponRedemption(r: CouponRedemption) {
    this.couponRedemptions.unshift(r);
    if (this.couponRedemptions.length > 5000) this.couponRedemptions.pop();
    this.markDirty();
  }
  public getCouponRedemptions(definitionId?: string): CouponRedemption[] {
    return definitionId ? this.couponRedemptions.filter(r => r.definitionId === definitionId) : this.couponRedemptions;
  }
  public countUserCouponRedemptions(definitionId: string, userId: string): number {
    return this.couponRedemptions.filter(r => r.definitionId === definitionId && r.userId === userId).length;
  }

  // ------------------------------------------------------------- §V7 match history
  public addMatchRecord(userId: string, record: MatchRecord) {
    const list = this.matchHistory.get(userId) || [];
    list.unshift(record);
    if (list.length > 50) list.length = 50; // keep the most recent 50
    this.matchHistory.set(userId, list);
    this.markDirty();
  }
  public getMatchHistory(userId: string, limit = 25): MatchRecord[] {
    return (this.matchHistory.get(userId) || []).slice(0, limit);
  }

  // ------------------------------------------------------------- §8 social graph
  public getSocial(userId: string): SocialGraph {
    let g = this.social.get(userId);
    if (!g) { g = { friends: [], incoming: [], outgoing: [], blocked: [] }; this.social.set(userId, g); }
    return g;
  }
  public saveSocial() { this.markDirty(); }
}

export const db = new Database();
