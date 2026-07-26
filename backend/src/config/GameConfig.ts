// §12 Single source of truth for tunable gameplay values.
//
// Everything here is data — no gameplay logic. Defaults live in code; an optional JSON
// file (GAME_CONFIG_FILE env, or backend/config/game-config.json) deep-overrides them at
// boot, so balancing, seasonal events, spawn rates, timers, rewards, XP curve and the
// evolution ladder can all change WITHOUT a code deploy. The client fetches the safe subset
// from /api/config so offline mirrors and UI ladders stay in sync with the server.

import fs from 'fs';
import path from 'path';
import { Evolution } from '../types';

export interface EvolutionReq { evolution: Evolution; level: number; evoXp: number; minPrestige: number; }

export interface GameConfig {
  progression: {
    maxLevel: number;
    xpBase: number;        // XP needed for level 1 → 2
    xpPerLevel: number;    // added per level
    missionEvoXp: { daily: number; weekly: number; event: number };
    evolutionLadder: EvolutionReq[];
  };
  economy: {
    // Match reward formula: reward = floor(score / perScore) + kills*perKill + (won ? winBonus : 0)
    match: {
      starsPerScore: number; starsPerKill: number; starsWinBonus: number;
      xpPerScore: number; xpPerKill: number; xpWinBonus: number;
      evoXpPerScore: number; evoXpPerKill: number; evoXpWinBonus: number;
    };
    // Anti-cheat clamps for client-reported match summaries.
    clamps: { maxScore: number; maxKills: number; maxSurvivalSeconds: number; maxDistanceKm: number };
    ad: { stars: number; tickets: number; cooldownMs: number };
    respawn: Record<string, { stars: number; tickets: number; label: string }>;
    // §V7 §9 Bonus for completing ALL daily missions (once per day). `item` lands in inventory.
    dailyBonus: { stars: number; xp: number; evoXp: number; item: string; itemName: string; itemIcon: string };
  };
  world: {
    size: number;
    foodCount: number;
    starTarget: number;
    starMax: number;
    sanctuaryRelocateSeconds: number;
    wormholeRelocateSeconds: number;
    eventDurationSeconds: number;
  };
  maps: {
    // Add a new playable theme by appending an entry here (or in game-config.json) — no code change.
    themes: MapTheme[];
    // Seasonal overlays auto-apply by month, or on-demand for festivals. `months` drives auto-select.
    seasons: MapSeason[];
  };
}

export interface MapTheme {
  id: string;
  name: string;
  sky: string;       // canvas background
  grid: string;      // terrain grid line color
  accent: string;    // UI accent / zone tint
  obstacleSet: string[]; // obstacle types that fit this biome
}

export interface MapSeason {
  id: string;
  name: string;
  tint: string;      // rgba overlay applied over the theme
  months: number[];  // 1-12; empty = festival/manual only
}

const DEFAULTS: GameConfig = {
  progression: {
    maxLevel: 1000,
    xpBase: 300,
    xpPerLevel: 80,
    missionEvoXp: { daily: 5, weekly: 25, event: 50 },
    evolutionLadder: [
      { evolution: 'Baby',   level: 1,    evoXp: 0,     minPrestige: 0 },
      { evolution: 'Young',  level: 51,   evoXp: 500,   minPrestige: 0 },
      { evolution: 'Teen',   level: 101,  evoXp: 1000,  minPrestige: 0 },
      { evolution: 'Adult',  level: 201,  evoXp: 2500,  minPrestige: 0 },
      { evolution: 'Elite',  level: 501,  evoXp: 8000,  minPrestige: 0 },
      { evolution: 'Titan',  level: 801,  evoXp: 20000, minPrestige: 0 },
      { evolution: 'Legend', level: 1000, evoXp: 40000, minPrestige: 1 },
      { evolution: 'King',   level: 1000, evoXp: 80000, minPrestige: 2 },
    ],
  },
  economy: {
    match: {
      starsPerScore: 10, starsPerKill: 50, starsWinBonus: 500,
      xpPerScore: 5, xpPerKill: 100, xpWinBonus: 300,
      evoXpPerScore: 50, evoXpPerKill: 10, evoXpWinBonus: 50,
    },
    clamps: { maxScore: 100000, maxKills: 100, maxSurvivalSeconds: 3600, maxDistanceKm: 500 },
    ad: { stars: 500, tickets: 2, cooldownMs: 30000 },
    respawn: {
      stars: { stars: 20, tickets: 0, label: 'Stars' },
      ticket: { stars: 0, tickets: 1, label: 'Ticket' },
      ad: { stars: 0, tickets: 0, label: 'Watch Ad' },
      wait: { stars: 0, tickets: 0, label: 'Free Wait' },
    },
    dailyBonus: { stars: 1000, xp: 500, evoXp: 100, item: 'rare_egg', itemName: 'Rare Egg', itemIcon: '🥚' },
  },
  world: {
    size: 6000,
    foodCount: 180,
    starTarget: 24,
    starMax: 30,
    sanctuaryRelocateSeconds: 300,
    wormholeRelocateSeconds: 120,
    eventDurationSeconds: 180,
  },
  maps: {
    themes: [
      { id: 'forest',       name: 'Forest',       sky: '#D4EEF9', grid: 'rgba(120,180,150,0.18)', accent: '#2E7D32', obstacleSet: ['tree', 'bush', 'pond', 'log', 'hill'] },
      { id: 'desert',       name: 'Desert',       sky: '#F6E7C1', grid: 'rgba(180,150,90,0.20)',  accent: '#B8860B', obstacleSet: ['cactus', 'rock', 'hill'] },
      { id: 'volcano',      name: 'Volcano',      sky: '#E7C7BE', grid: 'rgba(120,60,50,0.22)',   accent: '#C0392B', obstacleSet: ['rock', 'lava', 'hill'] },
      { id: 'snow',         name: 'Snow',         sky: '#EAF4FB', grid: 'rgba(150,180,210,0.22)', accent: '#5DADE2', obstacleSet: ['tree', 'rock', 'hill'] },
      { id: 'ice',          name: 'Ice',          sky: '#DFF4FA', grid: 'rgba(120,190,220,0.22)', accent: '#0097A7', obstacleSet: ['rock', 'pond', 'hill'] },
      { id: 'tropical',     name: 'Tropical',     sky: '#D2F5E3', grid: 'rgba(90,190,140,0.20)',  accent: '#12B886', obstacleSet: ['tree', 'bush', 'pond'] },
      { id: 'riverlands',   name: 'Riverlands',   sky: '#D2ECF6', grid: 'rgba(90,160,200,0.20)',  accent: '#1E88E5', obstacleSet: ['pond', 'log', 'bush'] },
      { id: 'swamp',        name: 'Swamp',        sky: '#DCE6C8', grid: 'rgba(110,130,70,0.22)',  accent: '#6B8E23', obstacleSet: ['poison', 'pond', 'log', 'bush'] },
      { id: 'ancient_ruins',name: 'Ancient Ruins',sky: '#E4DECB', grid: 'rgba(150,130,90,0.20)',  accent: '#8D6E63', obstacleSet: ['rock', 'hill', 'cactus'] },
      { id: 'royal_castle', name: 'Royal Castle', sky: '#E9E2F5', grid: 'rgba(150,120,200,0.20)', accent: '#7E57C2', obstacleSet: ['rock', 'hill', 'tree'] },
    ],
    seasons: [
      { id: 'spring',    name: 'Spring',    tint: 'rgba(120,220,150,0.05)', months: [3, 4, 5] },
      { id: 'summer',    name: 'Summer',    tint: 'rgba(255,220,120,0.05)', months: [6, 7, 8] },
      { id: 'autumn',    name: 'Autumn',    tint: 'rgba(220,150,80,0.06)',  months: [9, 10, 11] },
      { id: 'winter',    name: 'Winter',    tint: 'rgba(180,210,240,0.06)', months: [12, 1, 2] },
      { id: 'halloween', name: 'Halloween', tint: 'rgba(255,120,20,0.07)',  months: [] },
      { id: 'christmas', name: 'Christmas', tint: 'rgba(220,60,60,0.06)',   months: [] },
      { id: 'newyear',   name: 'New Year',  tint: 'rgba(255,215,0,0.06)',   months: [] },
      { id: 'ramadan',   name: 'Ramadan',   tint: 'rgba(120,180,220,0.06)', months: [] },
      { id: 'diwali',    name: 'Diwali',    tint: 'rgba(255,170,40,0.07)',  months: [] },
    ],
  },
};

// Deep-merge plain objects (arrays replace wholesale — a config file that lists the ladder
// replaces the whole ladder, which is what a content editor expects).
function deepMerge<T>(base: T, override: any): T {
  if (override === null || override === undefined) return base;
  if (Array.isArray(base) || typeof base !== 'object') return (override ?? base) as T;
  const out: any = { ...base };
  for (const k of Object.keys(override)) {
    out[k] = k in (base as any) ? deepMerge((base as any)[k], override[k]) : override[k];
  }
  return out;
}

function load(): GameConfig {
  const file = process.env.GAME_CONFIG_FILE || path.join(process.cwd(), 'config', 'game-config.json');
  try {
    if (fs.existsSync(file)) {
      const override = JSON.parse(fs.readFileSync(file, 'utf8'));
      console.log(`[config] Loaded gameplay overrides from ${file}`);
      return deepMerge(DEFAULTS, override);
    }
  } catch (e: any) {
    console.warn(`[config] Failed to read ${file}: ${e?.message || e} — using defaults.`);
  }
  return DEFAULTS;
}

export const gameConfig: GameConfig = load();

// Auto-select the current season by month (festivals are manual → not month-mapped).
export function activeSeasonId(now: Date = new Date()): string {
  const m = now.getMonth() + 1;
  const s = gameConfig.maps.seasons.find(se => se.months.includes(m));
  return s?.id || 'summer';
}

// The subset the client is allowed to see (no server-only secrets — this is all balancing data).
export function clientConfig() {
  return {
    progression: {
      maxLevel: gameConfig.progression.maxLevel,
      evolutionLadder: gameConfig.progression.evolutionLadder,
    },
    economy: { match: gameConfig.economy.match },
    world: gameConfig.world,
    maps: { themes: gameConfig.maps.themes, seasons: gameConfig.maps.seasons, activeSeason: activeSeasonId() },
  };
}
