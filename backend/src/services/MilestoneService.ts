import { db } from '../db/Database';
import { gameConfig, Milestone, MilestoneMetric } from '../config/GameConfig';
import { sessionManager } from './GameSessionManager';
import { PlayerProfile } from '../types';

// §milestone Story checkpoints — the journey from lost hatchling to Titan King.
//
// Two properties make these "checkpoints" rather than achievements:
//
//   1. They can be claimed MID-MATCH. The reward lands the instant the beat is reached, so
//      closing the app, crashing or losing signal can no longer erase a run's progress. That
//      is the auto-save.
//   2. They are LIFETIME and one-time. "The First Shed" happens once in a snake's story, not
//      once per match, so the timeline reads as a journey instead of a scoreboard.
//
// Nothing here trusts the client. A claim is graded against the value the SERVER observed for
// the live run, taken together with permanently recorded stats — the request body carries only
// which milestone is being claimed.

export interface MilestoneView extends Milestone {
  reached: boolean;
  progress: number;   // current value toward `target`
  pct: number;        // 0-100, for the timeline bar
}

export interface ClaimResult {
  success: boolean;
  message: string;
  milestone?: Milestone;
  rewards?: { stars: number; xp: number; evoXp: number };
  levelsGained?: number;
  profile?: PlayerProfile;
  alreadyClaimed?: boolean;
}

export class MilestoneService {
  static forMode(mode: string): Milestone[] {
    return gameConfig.milestones.filter(m => m.modes.includes(mode));
  }

  static byId(id: string): Milestone | undefined {
    return gameConfig.milestones.find(m => m.id === id);
  }

  // The authoritative value for a metric: the best of what the live run has observed and what
  // the profile permanently records. Using the max means a checkpoint reached in an earlier
  // session still counts, while live progress is credited the moment it happens.
  private static value(metric: MilestoneMetric, profile: PlayerProfile, peak: { score: number; kills: number; survivalSeconds: number } | null): number {
    const s = profile.stats;
    switch (metric) {
      case 'score':    return Math.max(peak?.score ?? 0, s.highestScore || 0);
      case 'kills':    return Math.max(peak?.kills ?? 0, s.mostKillsInMatch || 0);
      case 'survival': return Math.max(peak?.survivalSeconds ?? 0, s.longestSurvivalSeconds || 0);
      case 'stars':    return s.totalStars || 0;
      case 'areas':    return (profile.modeStats?.explorer?.chaptersCompleted || 0) + (s.areasExplored || 0);
      case 'level':    return profile.level || 1;
      default:         return 0;
    }
  }

  // Every milestone for a mode, annotated with this player's progress — powers the timeline.
  static overview(userId: string, mode: string): { milestones: MilestoneView[]; reachedCount: number; total: number } {
    const profile = db.getProfile(userId);
    const defs = this.forMode(mode);
    if (!profile) {
      const blank = defs.map(m => ({ ...m, reached: false, progress: 0, pct: 0 }));
      return { milestones: blank, reachedCount: 0, total: defs.length };
    }
    const peak = sessionManager.getPlayerPeak(userId);
    const reached = new Set(profile.milestones || []);
    const milestones = defs.map((m): MilestoneView => {
      const progress = this.value(m.metric, profile, peak);
      return {
        ...m,
        reached: reached.has(m.id),
        progress: Math.min(progress, m.target),
        pct: m.target > 0 ? Math.min(100, Math.round((progress / m.target) * 100)) : 100,
      };
    });
    return { milestones, reachedCount: milestones.filter(m => m.reached).length, total: defs.length };
  }

  // Bank a checkpoint. Idempotent: a repeat claim is reported, never paid twice.
  static claim(userId: string, milestoneId: string): ClaimResult {
    const def = this.byId(milestoneId);
    if (!def) return { success: false, message: 'Unknown milestone' };

    const profile = db.getProfile(userId);
    if (!profile) return { success: false, message: 'Profile not found' };

    const reached = profile.milestones || [];
    if (reached.includes(def.id)) {
      return { success: false, alreadyClaimed: true, message: `${def.title} already reached`, milestone: def };
    }

    const peak = sessionManager.getPlayerPeak(userId);
    const have = this.value(def.metric, profile, peak);
    if (have < def.target) {
      return { success: false, message: `Not there yet — ${have}/${def.target}`, milestone: def };
    }

    // Record the beat FIRST so a duplicate request racing this one can't double-pay.
    db.updateProfile(userId, { milestones: [...reached, def.id] });
    const { profile: updated, levelsGained } = db.grantRewards(userId, {
      stars: def.rewardStars, xp: def.rewardXp, evoXp: def.rewardEvoXp,
    });

    return {
      success: true,
      message: def.title,
      milestone: def,
      rewards: { stars: def.rewardStars, xp: def.rewardXp, evoXp: def.rewardEvoXp },
      levelsGained,
      profile: updated,
    };
  }

  // Claim every milestone whose target is already met — used as a safety net when a match
  // ends, so a beat reached in the final seconds is never dropped.
  static claimAllReached(userId: string, mode: string): ClaimResult[] {
    const out: ClaimResult[] = [];
    for (const m of this.forMode(mode)) {
      const r = this.claim(userId, m.id);
      if (r.success) out.push(r);
    }
    return out;
  }
}
