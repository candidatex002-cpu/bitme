import { db } from '../db/Database';
import { gameConfig } from '../config/GameConfig';
import { ProgressionService } from './ProgressionService';
import { CouponService } from './CouponService';
import { PlayerProfile, PlayerStats, ModeStat, StatMode, MatchRecord } from '../types';

// §V7 Centralized, server-authoritative match completion + statistics.
//
// One place records EVERYTHING that happens when a match ends: permanent general stats,
// combat stats, per-mode stats, mission progress, leaderboard, rewards (stars/XP/evo-XP),
// auto-granted coupons, and the persisted match-history record. The client's reported
// numbers are only accepted after clamping AND — when the player was in a real server match —
// being bounded by what the server itself observed (see `serverPeak`). Nothing here trusts
// the client blindly.

export interface MatchInput {
  score?: number; kills?: number; deaths?: number; placement?: number;
  survivalSeconds?: number; distanceKm?: number; areasVisited?: number;
  cherriesEaten?: number; applesEaten?: number; frogsEaten?: number; powerupsEaten?: number;
  damageDealt?: number; damageReceived?: number; killStreak?: number;
  mode?: string; map?: string;
}

export interface ServerPeak { score: number; kills: number; killStreak: number; survivalSeconds: number; }

export interface MatchResult {
  profile: PlayerProfile;
  match: MatchRecord;
  earnedStars: number; earnedXP: number; earnedEvoXP: number;
  levelsGained: number;
  scoreEvolution: string;
  grantedCoupons: any[];
  authoritative: { score: number; kills: number; survivalSeconds: number };
}

const clamp = (v: any, min: number, max: number): number => {
  const n = Number(v);
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, n));
};

// Normalize a UI/backend mode label to the five stat buckets V7 tracks independently.
function toStatMode(mode?: string): StatMode {
  switch ((mode || '').toLowerCase()) {
    case 'explorer': case 'story': return 'explorer';
    case 'battle_royale': case 'battleroyale': case 'br': return 'battle_royale';
    case 'team': case 'team_battle': return 'team';
    case 'nokia': case 'classic': case 'classic_snake': return 'classic';
    default: return 'free_roam';
  }
}

function emptyModeStat(): ModeStat {
  return { matchesPlayed: 0, wins: 0, losses: 0, highestScore: 0, kills: 0, deaths: 0, longestSurvivalSeconds: 0, stars: 0, missionsCompleted: 0 };
}

export class StatsService {
  // Live-derived fields the UI shows (never stored, so they can't drift).
  static derive(stats: PlayerStats) {
    const winRate = stats.matchesPlayed > 0 ? Math.round((stats.matchesWon / stats.matchesPlayed) * 100) : 0;
    const kd = stats.totalDeaths > 0 ? +(stats.totalKills / stats.totalDeaths).toFixed(2) : stats.totalKills;
    return { winRate, kd };
  }

  static withDerived(profile?: PlayerProfile) {
    if (!profile) return profile;
    return { ...profile, derivedStats: this.derive(profile.stats) };
  }

  // The single entry point for finishing a match. `serverPeak` is the authoritative
  // score/kills the simulation observed (null for offline / local-engine play).
  static recordMatch(userId: string, raw: MatchInput, serverPeak: ServerPeak | null): MatchResult | null {
    const profile = db.getProfile(userId);
    if (!profile) return null;

    const cl = gameConfig.economy.clamps;
    // Client values, clamped to sane bounds first.
    let score = clamp(raw.score, 0, cl.maxScore);
    let kills = clamp(raw.kills, 0, cl.maxKills);
    let survivalSeconds = clamp(raw.survivalSeconds, 0, cl.maxSurvivalSeconds);
    let killStreak = clamp(raw.killStreak ?? kills, 0, cl.maxKills);
    // Server truth wins when the player was actually in a server match.
    if (serverPeak) {
      score = Math.min(score, serverPeak.score);
      kills = Math.min(kills, serverPeak.kills);
      killStreak = Math.min(Math.max(killStreak, serverPeak.killStreak), serverPeak.kills || killStreak);
      survivalSeconds = Math.min(survivalSeconds || serverPeak.survivalSeconds, serverPeak.survivalSeconds);
    }
    const deaths = clamp(raw.deaths, 0, 50) || 1; // a completed match implies at least one death
    const placement = Math.round(clamp(raw.placement, 1, 100));
    const distanceKm = clamp(raw.distanceKm, 0, cl.maxDistanceKm);
    const cherries = Math.round(clamp(raw.cherriesEaten, 0, 10000));
    const apples = Math.round(clamp(raw.applesEaten, 0, 10000));
    const frogs = Math.round(clamp(raw.frogsEaten, 0, 10000));
    const powerups = Math.round(clamp(raw.powerupsEaten, 0, 10000));
    const stars = Math.round(clamp((raw as any).starsCollected ?? 0, 0, 100000));
    const damageDealt = clamp(raw.damageDealt, 0, 1_000_000);
    const damageReceived = clamp(raw.damageReceived, 0, 1_000_000);
    const areasVisited = Math.round(clamp(raw.areasVisited, 0, 50));
    const statMode = toStatMode(raw.mode);
    const won = placement === 1;

    // ---- Rewards (config-driven formula) ----
    const m = gameConfig.economy.match;
    const earnedStars = Math.floor(score / m.starsPerScore) + kills * m.starsPerKill + (won ? m.starsWinBonus : 0);
    const earnedXP = Math.floor(score / m.xpPerScore) + kills * m.xpPerKill + (won ? m.xpWinBonus : 0);
    const earnedEvoXP = Math.floor(score / m.evoXpPerScore) + kills * m.evoXpPerKill + (won ? m.evoXpWinBonus : 0);

    // ---- General stats (additive + peaks) ----
    const s = { ...profile.stats } as PlayerStats;
    s.matchesPlayed += 1;
    s.matchesWon += won ? 1 : 0;
    s.matchesLost += won ? 0 : 1;
    s.totalKills += kills;
    s.totalDeaths += deaths;
    s.totalFoodEaten += cherries + apples + frogs;
    s.highestScore = Math.max(s.highestScore, score);
    s.survivalTimeSeconds += survivalSeconds;
    s.longestSurvivalSeconds = Math.max(s.longestSurvivalSeconds, survivalSeconds);
    s.totalDistanceKm = +(s.totalDistanceKm + distanceKm).toFixed(3);
    s.totalStars += stars;
    s.cherriesCollected += cherries;
    s.applesCollected += apples;
    s.frogsCollected += frogs;
    s.powerupsCollected += powerups;
    s.longestKillStreak = Math.max(s.longestKillStreak, killStreak);
    s.mostKillsInMatch = Math.max(s.mostKillsInMatch, kills);
    s.totalDamageDealt += damageDealt;
    s.totalDamageReceived += damageReceived;
    s.mostDamageDealt = Math.max(s.mostDamageDealt, damageDealt);
    s.mostDamageReceived = Math.max(s.mostDamageReceived, damageReceived);

    // ---- Per-mode stats ----
    const modeStats = { ...(profile.modeStats || {}) };
    const ms: ModeStat = { ...emptyModeStat(), ...(modeStats[statMode] || {}) };
    ms.matchesPlayed += 1;
    ms.wins += won ? 1 : 0;
    ms.losses += won ? 0 : 1;
    ms.highestScore = Math.max(ms.highestScore, score);
    ms.kills += kills;
    ms.deaths += deaths;
    ms.longestSurvivalSeconds = Math.max(ms.longestSurvivalSeconds, survivalSeconds);
    ms.stars += stars;
    if (statMode === 'battle_royale') {
      if (placement <= 3) ms.top3 = (ms.top3 || 0) + 1;
      ms.highestRank = Math.min(ms.highestRank ?? 999, placement);
    }
    if (statMode === 'team') {
      ms.assists = (ms.assists || 0) + Math.round(clamp((raw as any).assists, 0, 50));
      if (won) ms.mvp = (ms.mvp || 0) + (Math.round(clamp((raw as any).mvp, 0, 1)));
      ms.highestTeamScore = Math.max(ms.highestTeamScore || 0, Math.round(clamp((raw as any).teamScore, 0, cl.maxScore)));
    }
    if (statMode === 'classic') {
      ms.longestSnake = Math.max(ms.longestSnake || 0, Math.round(clamp((raw as any).longestSnake, 0, 1000)));
      if (won || survivalSeconds > 0) ms.bestTimeSeconds = Math.max(ms.bestTimeSeconds || 0, survivalSeconds);
    }
    modeStats[statMode] = ms;

    // Persist stats + modeStats in one write.
    db.updateProfile(userId, { stats: s, modeStats });

    // ---- Mission + achievement telemetry (server-authoritative) ----
    if (cherries) db.incrementCollectible(userId, 'cherry', cherries);
    if (apples) db.incrementCollectible(userId, 'apple', apples);
    if (frogs) db.incrementCollectible(userId, 'frog', frogs);
    if (kills) db.incrementCollectible(userId, 'kill', kills);
    if (stars) db.incrementCollectible(userId, 'star', stars);
    db.incrementCollectible(userId, 'match', 1);
    db.incrementCollectible(userId, 'survive', survivalSeconds);
    db.incrementCollectible(userId, 'distance', distanceKm);
    if (won) db.incrementCollectible(userId, 'win', 1);
    db.recordPeakMetric(userId, 'score', score);
    if (areasVisited > 0) db.recordPeakMetric(userId, 'explore', areasVisited);
    db.updateLeaderboard(userId, profile.displayName, score, won);

    // ---- Progression (server-authoritative XP / evolution) ----
    const { profile: leveled, levelsGained } = db.grantRewards(userId, { stars: earnedStars, xp: earnedXP, evoXp: earnedEvoXP });

    // ---- Auto-granted coupons ----
    const grantedCoupons = CouponService.autoGrantEligible(userId, leveled?.preferredRegion || 'Global');
    if (grantedCoupons.length) {
      const fresh = db.getProfile(userId)!;
      db.updateProfile(userId, { stats: { ...fresh.stats, couponsEarned: fresh.stats.couponsEarned + grantedCoupons.length } });
    }

    // ---- Match history record ----
    const rewardsText = `⭐${earnedStars} · XP ${earnedXP}` + (grantedCoupons.length ? ` · 🎟️×${grantedCoupons.length}` : '');
    const match: MatchRecord = {
      id: `mh_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      at: new Date().toISOString(),
      mode: statMode,
      durationSeconds: survivalSeconds,
      score, kills, deaths,
      stars, xp: earnedXP, evoXp: earnedEvoXP,
      rank: placement,
      rewards: rewardsText,
      map: raw.map,
      result: won ? 'win' : 'loss',
    };
    db.addMatchRecord(userId, match);

    const finalProfile = db.getProfile(userId)!;
    return {
      profile: finalProfile,
      match,
      earnedStars, earnedXP, earnedEvoXP, levelsGained,
      scoreEvolution: ProgressionService.scoreToEvolution(score),
      grantedCoupons,
      authoritative: { score, kills, survivalSeconds },
    };
  }
}
