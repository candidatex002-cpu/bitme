"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProgressionService = exports.EVOLUTION_REQS = exports.MAX_LEVEL = void 0;
exports.MAX_LEVEL = 1000;
// Evolution ladder — gated by BOTH account level and Evolution XP (never by score).
exports.EVOLUTION_REQS = [
    { evolution: 'Baby', level: 1, evoXp: 0 },
    { evolution: 'Young', level: 51, evoXp: 500 },
    { evolution: 'Adult', level: 201, evoXp: 2500 },
    { evolution: 'Elite', level: 501, evoXp: 8000 },
    { evolution: 'Titan', level: 801, evoXp: 20000 },
    { evolution: 'Legend', level: 1000, evoXp: 40000 }, // also requires prestige >= 1
];
// Rank ladder by account level band; each band has 3 divisions (III -> I).
const RANK_TIERS = [
    { tier: 'Bronze', min: 1, max: 100, color: '#b45309' },
    { tier: 'Silver', min: 101, max: 250, color: '#94a3b8' },
    { tier: 'Gold', min: 251, max: 450, color: '#f59e0b' },
    { tier: 'Platinum', min: 451, max: 650, color: '#14b8a6' },
    { tier: 'Diamond', min: 651, max: 850, color: '#38bdf8' },
    { tier: 'Master', min: 851, max: 1000, color: '#a855f7' },
];
class ProgressionService {
    // XP required to advance FROM `level` to `level+1`. Long-term curve.
    static xpToNext(level) {
        if (level >= exports.MAX_LEVEL)
            return Infinity;
        return 300 + (level - 1) * 80;
    }
    // Apply XP, rolling level-ups. Returns the new level/xp and how many levels gained.
    static applyXp(level, xp, gained) {
        let lvl = level;
        let cur = xp + gained;
        let gainedLevels = 0;
        while (lvl < exports.MAX_LEVEL && cur >= this.xpToNext(lvl)) {
            cur -= this.xpToNext(lvl);
            lvl++;
            gainedLevels++;
        }
        if (lvl >= exports.MAX_LEVEL)
            cur = 0;
        return { level: lvl, xp: cur, levelsGained: gainedLevels };
    }
    static unlockedEvolutions(level, evoXp, prestige) {
        return exports.EVOLUTION_REQS.filter(r => {
            if (r.evolution === 'Legend')
                return prestige >= 1 && level >= r.level && evoXp >= r.evoXp;
            return level >= r.level && evoXp >= r.evoXp;
        }).map(r => r.evolution);
    }
    static nextEvolution(level, evoXp, prestige) {
        const unlocked = new Set(this.unlockedEvolutions(level, evoXp, prestige));
        return exports.EVOLUTION_REQS.find(r => !unlocked.has(r.evolution)) || null;
    }
    static getRank(level, prestige) {
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
}
exports.ProgressionService = ProgressionService;
