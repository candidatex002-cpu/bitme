import { Evolution, EvolutionRequirement, RankInfo, SCORE_EVOLUTION_THRESHOLDS } from '../types';
import { gameConfig } from '../config/GameConfig';

// §12 All progression tunables now come from the central config (JSON-overridable).
export const MAX_LEVEL = gameConfig.progression.maxLevel;

// Evolution XP awarded per mission category on claim
export const MISSION_EVO_XP: Record<string, number> = gameConfig.progression.missionEvoXp;

// Evolution ladder — gated by BOTH account level and Evolution XP (never by score alone).
// Score milestones are for the in-match visual stage only (see SCORE_EVOLUTION_THRESHOLDS).
// `minPrestige` gates the endgame stages (Legend = 1, King = 2).
export const EVOLUTION_REQS: EvolutionRequirement[] = gameConfig.progression.evolutionLadder.map(
  ({ evolution, level, evoXp }) => ({ evolution, level, evoXp })
);
const EVO_MIN_PRESTIGE: Record<string, number> = Object.fromEntries(
  gameConfig.progression.evolutionLadder.map(r => [r.evolution, r.minPrestige])
);

// Rank ladder by account level band; each band has 3 divisions (III -> I).
const RANK_TIERS: Array<{ tier: string; min: number; max: number; color: string }> = [
  { tier: 'Bronze',   min: 1,   max: 100,  color: '#b45309' },
  { tier: 'Silver',   min: 101, max: 250,  color: '#94a3b8' },
  { tier: 'Gold',     min: 251, max: 450,  color: '#f59e0b' },
  { tier: 'Platinum', min: 451, max: 650,  color: '#14b8a6' },
  { tier: 'Diamond',  min: 651, max: 850,  color: '#38bdf8' },
  { tier: 'Master',   min: 851, max: 1000, color: '#a855f7' },
];

export class ProgressionService {
  // XP required to advance FROM `level` to `level+1`. Long-term curve.
  static xpToNext(level: number): number {
    if (level >= MAX_LEVEL) return Infinity;
    return gameConfig.progression.xpBase + (level - 1) * gameConfig.progression.xpPerLevel;
  }

  // Apply XP, rolling level-ups. Returns the new level/xp and how many levels gained.
  static applyXp(level: number, xp: number, gained: number): { level: number; xp: number; levelsGained: number } {
    let lvl = level;
    let cur = xp + gained;
    let gainedLevels = 0;
    while (lvl < MAX_LEVEL && cur >= this.xpToNext(lvl)) {
      cur -= this.xpToNext(lvl);
      lvl++;
      gainedLevels++;
    }
    if (lvl >= MAX_LEVEL) cur = 0;
    return { level: lvl, xp: cur, levelsGained: gainedLevels };
  }

  static unlockedEvolutions(level: number, evoXp: number, prestige: number): Evolution[] {
    return EVOLUTION_REQS.filter(r =>
      prestige >= (EVO_MIN_PRESTIGE[r.evolution] ?? 0) && level >= r.level && evoXp >= r.evoXp
    ).map(r => r.evolution);
  }

  static nextEvolution(level: number, evoXp: number, prestige: number): EvolutionRequirement | null {
    const unlocked = new Set(this.unlockedEvolutions(level, evoXp, prestige));
    return EVOLUTION_REQS.find(r => !unlocked.has(r.evolution)) || null;
  }

  static getRank(level: number, prestige: number): RankInfo {
    if (prestige >= 1) {
      const roman = ['I', 'II', 'III', 'IV', 'V'][Math.min(4, prestige - 1)];
      return { tier: 'Legend', division: roman, label: `Legend ${roman}`, color: '#a855f7' };
    }
    const band = RANK_TIERS.find(t => level >= t.min && level <= t.max) || RANK_TIERS[0];
    const span = (band.max - band.min) / 3;
    const within = level - band.min;
    const div = within < span ? 'III' : within < span * 2 ? 'II' : 'I';
    return { tier: band.tier, division: div, label: `${band.tier} ${div}`, color: band.color };
  }

  /**
   * Maps a match score to the in-match visual evolution stage.
   * This is purely cosmetic / display — the permanent evolution ladder is separate.
   */
  static scoreToEvolution(score: number): Evolution {
    let stage: Evolution = 'Baby';
    for (const t of SCORE_EVOLUTION_THRESHOLDS) {
      if (score >= t.scoreMin) stage = t.stage;
    }
    return stage;
  }

  /**
   * Evo XP to grant when a mission of the given category is claimed.
   */
  static missionEvoXp(category: string): number {
    return MISSION_EVO_XP[category] ?? 5;
  }
}
