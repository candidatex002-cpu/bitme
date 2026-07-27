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
    // §2 Competitive round pacing (Battle Royale / Team Battle). The storm is driven by this
    // one clock, so the HUD countdown and the shrinking zone can never drift apart.
    matchDurationSeconds: number;    // length of one competitive round
    zoneGraceSeconds: number;        // zone holds full size for this long after a round starts
    zoneIntermissionSeconds: number; // results window before the next round begins
    zoneStartPct: number;            // opening radius as a fraction of world size
    zoneFinalPct: number;            // fully-closed radius as a fraction of world size
    zoneCloseAtPct: number;          // point in the round (0-1) where the zone reaches final size
  };
  maps: {
    // Add a new playable theme by appending an entry here (or in game-config.json) — no code change.
    themes: MapTheme[];
    // Seasonal overlays auto-apply by month, or on-demand for festivals. `months` drives auto-select.
    seasons: MapSeason[];
  };
  cosmetics: {
    // Purchasable snake skins. `id` matches the client's visual definition (gradient/palette);
    // everything that costs the player something lives here, server-side, so pricing and
    // ownership can never be decided by the client.
    skins: SkinDef[];
    // Granted to every new account (and back-filled onto pre-ownership profiles).
    starterSkins: string[];
  };
  // Live-ops calendar. Scheduled events are pure data — add one here (or in game-config.json)
  // and it appears in the client's Events page with no code change.
  events: ScheduledEvent[];
  // §milestone Story checkpoints. Reaching one banks its reward IMMEDIATELY — that is the
  // auto-save: a crash or a quit mid-match can no longer erase what the run achieved.
  milestones: Milestone[];
  // §power Buff duration + stacking rules, shared by the server and the offline engine.
  powers: {
    baseSeconds: number;      // duration a pickup grants at level 1
    bonusPerLevels: number;   // +1s for every N account levels
    maxSeconds: number;       // ceiling on a SINGLE pickup's granted duration
    // Ceiling on ACCUMULATED time. Picking a power up again extends what is left rather than
    // replacing it, so without a cap a player could chain shields into permanent invincibility.
    maxStackedSeconds: number;
  };
}

export interface SkinDef {
  id: string;            // must match the client's skin id
  name: string;
  family: string;
  rarity: 'starter' | 'common' | 'rare' | 'epic' | 'legendary';
  costStars: number;
  costTickets: number;
  minLevel: number;
}

// §milestone A single story checkpoint on the journey to the throne.
//
// Milestones are LIFETIME and one-time: "The First Shed" happens once in a snake's story,
// not once per match. They can be claimed mid-match, which is what makes them checkpoints —
// the reward is banked the instant it is earned rather than at the match summary.
export interface Milestone {
  id: string;
  chapter: number;          // story chapter this beat belongs to
  icon: string;
  title: string;
  story: string;            // the narration shown on the timeline + celebration
  metric: MilestoneMetric;
  target: number;
  rewardStars: number;
  rewardXp: number;
  rewardEvoXp: number;
  modes: string[];          // UI modes this milestone appears in
}

// What a milestone measures. Each maps to a server-observed value — never a client claim.
export type MilestoneMetric = 'score' | 'kills' | 'stars' | 'survival' | 'areas' | 'level';

export interface ScheduledEvent {
  id: string;
  icon: string;
  name: string;
  description: string;
  // Month numbers (1-12) the event runs in; empty = always listed as upcoming.
  months: number[];
  // Optional ISO start/end for a precise window; takes precedence over `months`.
  startsAt?: string;
  endsAt?: string;
  rewardHint?: string;
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
    matchDurationSeconds: 180,
    zoneGraceSeconds: 15,
    zoneIntermissionSeconds: 8,
    zoneStartPct: 0.47,
    zoneFinalPct: 0.09,
    zoneCloseAtPct: 0.9,
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
  cosmetics: {
    starterSkins: ['Forest', 'Jungle'],
    skins: [
      { id: 'Forest',    name: 'Forest',    family: 'Forest',   rarity: 'starter',   costStars: 0,    costTickets: 0, minLevel: 1 },
      { id: 'Jungle',    name: 'Jungle',    family: 'Forest',   rarity: 'starter',   costStars: 0,    costTickets: 0, minLevel: 1 },
      { id: 'Ocean',     name: 'Ocean',     family: 'Ocean',    rarity: 'common',    costStars: 400,  costTickets: 0, minLevel: 1 },
      { id: 'Fire',      name: 'Fire',      family: 'Fire',     rarity: 'common',    costStars: 400,  costTickets: 0, minLevel: 1 },
      { id: 'Sakura',    name: 'Sakura',    family: 'Nature',   rarity: 'common',    costStars: 600,  costTickets: 0, minLevel: 3 },
      { id: 'Desert',    name: 'Desert',    family: 'Nature',   rarity: 'common',    costStars: 600,  costTickets: 0, minLevel: 3 },
      { id: 'Ice',       name: 'Ice',       family: 'Ocean',    rarity: 'rare',      costStars: 900,  costTickets: 0, minLevel: 5 },
      { id: 'Electric',  name: 'Electric',  family: 'Fire',     rarity: 'rare',      costStars: 900,  costTickets: 0, minLevel: 5 },
      { id: 'Shadow',    name: 'Shadow',    family: 'Mystical', rarity: 'rare',      costStars: 1200, costTickets: 0, minLevel: 8 },
      { id: 'Galaxy',    name: 'Galaxy',    family: 'Mystical', rarity: 'epic',      costStars: 1800, costTickets: 1, minLevel: 12 },
      { id: 'Christmas', name: 'Christmas', family: 'Seasonal', rarity: 'epic',      costStars: 1800, costTickets: 1, minLevel: 12 },
      { id: 'Halloween', name: 'Halloween', family: 'Seasonal', rarity: 'epic',      costStars: 1800, costTickets: 1, minLevel: 12 },
      { id: 'Golden',    name: 'Golden',    family: 'Elegant',  rarity: 'legendary', costStars: 3500, costTickets: 5, minLevel: 20 },
      { id: 'Royal',     name: 'Royal',     family: 'Elegant',  rarity: 'legendary', costStars: 3500, costTickets: 5, minLevel: 20 },
      { id: 'Mythical',  name: 'Mythical',  family: 'Mystical', rarity: 'legendary', costStars: 5000, costTickets: 8, minLevel: 25 },
    ],
  },
  // §milestone The journey, told in checkpoints. Explorer carries the full Lost Crown arc;
  // Free Roam gets a shorter arcade run of the same voice. Pure data — reorder, retitle or
  // re-price any of it from game-config.json without a code change.
  milestones: [
    // ---- Explorer: Chapter I — The Lost Prince ----
    { id: 'ex_hatch',     chapter: 1, icon: '🥚', title: 'The Egg Cracks',            story: 'You slip from the last royal egg into a world that has forgotten your name.',            metric: 'score',    target: 100,   rewardStars: 50,   rewardXp: 40,   rewardEvoXp: 10,  modes: ['explorer'] },
    { id: 'ex_forage',    chapter: 1, icon: '🍒', title: 'First Forage',              story: 'Cherries. Small, sweet, and the first thing that has ever been yours.',                  metric: 'score',    target: 300,   rewardStars: 75,   rewardXp: 60,   rewardEvoXp: 15,  modes: ['explorer'] },
    { id: 'ex_shed',      chapter: 1, icon: '🐍', title: 'The First Shed',            story: 'Your old skin splits. Underneath, the royal mark shows clearly for the first time.',     metric: 'score',    target: 500,   rewardStars: 120,  rewardXp: 100,  rewardEvoXp: 25,  modes: ['explorer'] },
    // ---- Chapter II — Forest of Memories ----
    { id: 'ex_fragment',  chapter: 2, icon: '⭐', title: 'A Fragment of the Crown',   story: 'It hums when you touch it. Somewhere, a broken crown remembers being whole.',           metric: 'stars',    target: 5,     rewardStars: 150,  rewardXp: 120,  rewardEvoXp: 40,  modes: ['explorer'] },
    { id: 'ex_scout',     chapter: 2, icon: '🗡️', title: 'The Order Notices',         story: 'A Venom scout falls beneath you. They know the heir is alive now — and so do you.',    metric: 'kills',    target: 1,     rewardStars: 180,  rewardXp: 150,  rewardEvoXp: 50,  modes: ['explorer'] },
    { id: 'ex_grove',     chapter: 2, icon: '🌳', title: 'Into the Deep Grove',       story: 'These trees are older than the betrayal. They lean in as you pass, and they whisper.',  metric: 'score',    target: 1500,  rewardStars: 250,  rewardXp: 200,  rewardEvoXp: 60,  modes: ['explorer'] },
    // ---- Chapter III — The Sleeping Giant ----
    { id: 'ex_rivers',    chapter: 3, icon: '🏞️', title: 'Crossing the Riverlands',   story: 'Water you cannot see the bottom of. You cross it anyway. That is the whole story.',    metric: 'areas',    target: 3,     rewardStars: 300,  rewardXp: 240,  rewardEvoXp: 75,  modes: ['explorer'] },
    { id: 'ex_endure',    chapter: 3, icon: '⏳', title: 'The Long Night',            story: 'You survive long enough to watch the light change. Few hatchlings ever do.',            metric: 'survival', target: 180,   rewardStars: 350,  rewardXp: 280,  rewardEvoXp: 90,  modes: ['explorer'] },
    { id: 'ex_guardian',  chapter: 3, icon: '🛡️', title: "The Guardian's Gaze",       story: 'Something ancient beneath the hills opens one eye, considers you, and does not close it.', metric: 'score', target: 3000, rewardStars: 450,  rewardXp: 360,  rewardEvoXp: 120, modes: ['explorer'] },
    // ---- Chapter IV — Trial and Titan ----
    { id: 'ex_fire',      chapter: 4, icon: '🔥', title: 'Trial by Fire',             story: 'The Volcano Kingdom tests every heir who passes. Most of them stay there.',             metric: 'score',    target: 5000,  rewardStars: 600,  rewardXp: 500,  rewardEvoXp: 180, modes: ['explorer'] },
    { id: 'ex_hunter',    chapter: 4, icon: '⚔️', title: 'No Longer Prey',            story: 'Ten of the Order have fallen to you. The hunt has quietly changed direction.',          metric: 'kills',    target: 10,    rewardStars: 700,  rewardXp: 560,  rewardEvoXp: 200, modes: ['explorer'] },
    { id: 'ex_titan',     chapter: 4, icon: '🐲', title: 'The Titan Rises',           story: 'You are no longer the thing that runs. You are the thing they run from.',               metric: 'score',    target: 8000,  rewardStars: 1000, rewardXp: 800,  rewardEvoXp: 300, modes: ['explorer'] },

    // ---- Free Roam: the same voice, a shorter arc ----
    { id: 'fr_bite',      chapter: 1, icon: '🍒', title: 'First Bite',                story: 'The park is enormous and you are very small. Start anyway.',                            metric: 'score',    target: 250,   rewardStars: 50,   rewardXp: 40,   rewardEvoXp: 10,  modes: ['free_roam'] },
    { id: 'fr_grow',      chapter: 1, icon: '🐍', title: 'Growing Strong',            story: 'Your coils thicken. The smaller ones start choosing another path.',                     metric: 'score',    target: 500,   rewardStars: 100,  rewardXp: 80,   rewardEvoXp: 20,  modes: ['free_roam'] },
    { id: 'fr_hunt',      chapter: 2, icon: '⚔️', title: 'First Hunt',                story: 'Head to head, and you did not blink. Neither did they — that was their mistake.',        metric: 'kills',    target: 1,     rewardStars: 150,  rewardXp: 120,  rewardEvoXp: 35,  modes: ['free_roam'] },
    { id: 'fr_stars',     chapter: 2, icon: '⭐', title: 'Star Collector',            story: 'Ten fragments, all of them still warm. The crown is out there in pieces.',              metric: 'stars',    target: 10,    rewardStars: 200,  rewardXp: 160,  rewardEvoXp: 50,  modes: ['free_roam'] },
    { id: 'fr_apex',      chapter: 3, icon: '👑', title: 'Apex Predator',             story: 'Five rivals down. The park has learned your shape.',                                    metric: 'kills',    target: 5,     rewardStars: 350,  rewardXp: 280,  rewardEvoXp: 90,  modes: ['free_roam'] },
    { id: 'fr_titan',     chapter: 3, icon: '🐲', title: 'Titan of the Park',         story: 'You fill the horizon now. Somewhere a smaller snake is telling a story about you.',     metric: 'score',    target: 5000,  rewardStars: 600,  rewardXp: 480,  rewardEvoXp: 170, modes: ['free_roam'] },
    { id: 'fr_legend',    chapter: 4, icon: '🏆', title: 'Legend of the Park',        story: 'Ten thousand. They will not say your name — they will just point.',                     metric: 'score',    target: 10000, rewardStars: 1200, rewardXp: 900,  rewardEvoXp: 350, modes: ['free_roam'] },
  ],
  powers: { baseSeconds: 5, bonusPerLevels: 8, maxSeconds: 10, maxStackedSeconds: 30 },
  events: [
    { id: 'evt_jungle_festival', icon: '🐍', name: 'Jungle Festival',    description: 'Double stars from every collectible all weekend.', months: [], rewardHint: '2× Stars' },
    { id: 'evt_monsoon',         icon: '🌧️', name: 'Monsoon Rush',        description: 'Frog & star spawns tripled across the reserve.',   months: [6, 7, 8], rewardHint: '3× Frogs & Stars' },
    { id: 'evt_halloween',       icon: '🎃', name: 'Halloween Hunt',      description: 'Pumpkin skins, spooky map tint and night hazards.', months: [10], rewardHint: 'Halloween skin' },
    { id: 'evt_winter',          icon: '🎄', name: 'Winter Wonderland',   description: 'Snow map, gift chests and festive accessories.',    months: [12], rewardHint: 'Christmas skin' },
    { id: 'evt_newyear',         icon: '🎆', name: 'New Year Fireworks',  description: 'Bonus XP on every match to start the year strong.',  months: [1], rewardHint: '2× XP' },
    { id: 'evt_spring_bloom',    icon: '🌸', name: 'Spring Bloom',        description: 'Sakura trails and flower-crown drops in the park.',  months: [3, 4], rewardHint: 'Flower Crown' },
  ],
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

export function skinById(id: string): SkinDef | undefined {
  return gameConfig.cosmetics.skins.find(s => s.id === id);
}

// A scheduled event is "live" inside its explicit ISO window, or during one of its months.
export function eventIsLive(e: ScheduledEvent, now: Date = new Date()): boolean {
  if (e.startsAt || e.endsAt) {
    const t = now.getTime();
    if (e.startsAt && t < Date.parse(e.startsAt)) return false;
    if (e.endsAt && t > Date.parse(e.endsAt)) return false;
    return true;
  }
  return e.months.includes(now.getMonth() + 1);
}

// The subset the client is allowed to see (no server-only secrets — this is all balancing data).
export function clientConfig() {
  return {
    progression: {
      maxLevel: gameConfig.progression.maxLevel,
      evolutionLadder: gameConfig.progression.evolutionLadder,
    },
    // `respawn` is published so the RESPAWN OPTIONS panel prices itself from the same source
    // the server charges from — a JSON override can't leave the UI advertising a stale cost.
    economy: { match: gameConfig.economy.match, respawn: gameConfig.economy.respawn },
    world: gameConfig.world,
    maps: { themes: gameConfig.maps.themes, seasons: gameConfig.maps.seasons, activeSeason: activeSeasonId() },
    // Skin pricing is published so the shop UI renders one source of truth — but ownership
    // and the actual charge are always decided server-side.
    cosmetics: { skins: gameConfig.cosmetics.skins, starterSkins: gameConfig.cosmetics.starterSkins },
    // §power Published so the offline engine grants and stacks buffs on the same curve.
    powers: gameConfig.powers,
    // §milestone Published so offline play can still show the journey and celebrate beats.
    // Reaching one is recorded locally and reconciled by the server on the next connection.
    milestones: gameConfig.milestones,
  };
}
