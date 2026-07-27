// 🐍 Anaconda Park — "The Legend of the Lost Crown"
// Story data + helpers shared across the app. Pure data; no side effects.

export interface PrinceRank { min: number; max: number; title: string; motto: string; icon: string; }

// Each account-level band is a stage of the lost prince growing into the rightful king.
export const PRINCE_RANKS: PrinceRank[] = [
  { min: 1, max: 50, title: 'Baby Prince', motto: 'I will survive.', icon: '🥚' },
  { min: 51, max: 200, title: 'Young Explorer', motto: 'I will discover the truth.', icon: '🐍' },
  { min: 201, max: 500, title: 'Royal Guardian', motto: 'I will protect the kingdoms.', icon: '🛡️' },
  { min: 501, max: 800, title: 'Elite Commander', motto: 'I will unite the clans.', icon: '⚔️' },
  { min: 801, max: 1000, title: 'Titan King', motto: 'I am worthy of the crown.', icon: '👑' },
];

export function princeRank(level: number): PrinceRank {
  return PRINCE_RANKS.find(r => level >= r.min && level <= r.max) || PRINCE_RANKS[PRINCE_RANKS.length - 1];
}

export interface Chapter { n: number; title: string; desc: string; unlockLevel: number; icon: string; }
export const CHAPTERS: Chapter[] = [
  { n: 1, title: 'The Lost Prince',        desc: 'A royal egg survives the fall of the kingdom.',      unlockLevel: 1,   icon: '🥚' },
  { n: 2, title: 'Forest of Memories',     desc: 'Echoes of the old kingdom stir among the trees.',    unlockLevel: 60,  icon: '🌳' },
  { n: 3, title: 'The Sleeping Giant',     desc: 'An ancient guardian slumbers beneath the hills.',    unlockLevel: 130, icon: '⛰️' },
  { n: 4, title: 'Temple of Wisdom',       desc: 'Old scrolls reveal the secret of the Crown.',        unlockLevel: 220, icon: '📜' },
  { n: 5, title: 'The Broken Crown',       desc: 'Star Fragments lie scattered across the world.',      unlockLevel: 340, icon: '⭐' },
  { n: 6, title: 'The Seven Kingdoms',     desc: 'Reunite the clans under a single banner.',           unlockLevel: 500, icon: '🗺️' },
  { n: 7, title: 'The Final Guardian',     desc: 'The Venom Emperor blocks the road home.',            unlockLevel: 700, icon: '🐉' },
  { n: 8, title: 'The Return of the King', desc: 'Reclaim the throne of Anaconda Park.',                unlockLevel: 900, icon: '👑' },
];

export function currentChapter(level: number): number {
  let c = 1;
  for (const ch of CHAPTERS) if (level >= ch.unlockLevel) c = ch.n;
  return c;
}

// The royal castle rebuilds itself as the prince grows — ruins at Lv1, alive by Lv1000.
export interface CastlePart { key: string; name: string; level: number; icon: string; }
export const CASTLE_PARTS: CastlePart[] = [
  { key: 'bridge',  name: 'Bridge Restored',        level: 50,   icon: '🌉' },
  { key: 'gates',   name: 'Gates Rebuilt',          level: 200,  icon: '🚪' },
  { key: 'gardens', name: 'Gardens Revived',        level: 500,  icon: '🌷' },
  { key: 'towers',  name: 'Towers Reconstructed',   level: 800,  icon: '🏯' },
  { key: 'throne',  name: 'Throne Room Reopened',   level: 1000, icon: '👑' },
];
export function castleProgress(level: number): number {
  const done = CASTLE_PARTS.filter(p => level >= p.level).length;
  return Math.round((done / CASTLE_PARTS.length) * 100);
}

export const KINGDOMS = [
  { name: 'Forest',  icon: '🌳' }, { name: 'Ocean', icon: '🌊' }, { name: 'Volcano', icon: '🔥' },
  { name: 'Ice',     icon: '❄️' }, { name: 'Blossom', icon: '🌸' }, { name: 'Shadow', icon: '🌑' }, { name: 'Sky', icon: '✨' },
];

export const NPCS = [
  { name: 'Wise Turtle',      icon: '🐢', role: 'Gives quests' },
  { name: 'Ancient Owl',      icon: '🦉', role: 'Explains history' },
  { name: 'Fox Merchant',     icon: '🦊', role: 'Sells items' },
  { name: 'Frog Chef',        icon: '🐸', role: 'Trades food' },
  { name: 'Bee Queen',        icon: '🐝', role: 'Seasonal missions' },
  { name: 'Lizard Blacksmith', icon: '🦎', role: 'Upgrades gear' },
];

export const BOSSES = [
  { name: 'Forest Titan',  icon: '🌳', kingdom: 'Forest' },
  { name: 'Sea Serpent',   icon: '🌊', kingdom: 'Ocean' },
  { name: 'Lava Dragon',   icon: '🔥', kingdom: 'Volcano' },
  { name: 'Ice Leviathan', icon: '❄️', kingdom: 'Ice' },
  { name: 'Shadow Cobra',  icon: '🌑', kingdom: 'Shadow' },
  { name: 'Thunder Viper', icon: '⚡', kingdom: 'Sky' },
  { name: 'Venom Emperor', icon: '👑', kingdom: 'Final' },
];

export const SEASONS = [
  { n: 1, title: 'The Lost Prince' },
  { n: 2, title: 'Rise of the Venom Order' },
  { n: 3, title: 'The Seven Kingdoms' },
  { n: 4, title: 'The Crown Awakens' },
  { n: 5, title: 'The Final War' },
  { n: 6, title: 'A New Era' },
];
export const CURRENT_SEASON = 1;

// §milestone Offline copy of the journey ladder.
//
// The SERVER owns these — it grades every claim and pays every reward from
// `gameConfig.milestones`. This copy exists so a build with no backend reachable can still
// show the timeline, narrate the beats and celebrate them against local progress. A backend
// test asserts the two lists stay identical, so they cannot drift apart silently.
export interface MilestoneDef {
  id: string; chapter: number; icon: string; title: string; story: string;
  metric: 'score' | 'kills' | 'stars' | 'survival' | 'areas' | 'level';
  target: number; rewardStars: number; rewardXp: number; rewardEvoXp: number; modes: string[];
}

export const MILESTONES: MilestoneDef[] = [
  { id: 'ex_hatch',    chapter: 1, icon: '🥚', title: 'The Egg Cracks',          story: 'You slip from the last royal egg into a world that has forgotten your name.',            metric: 'score',    target: 100,   rewardStars: 50,   rewardXp: 40,  rewardEvoXp: 10,  modes: ['explorer'] },
  { id: 'ex_forage',   chapter: 1, icon: '🍒', title: 'First Forage',            story: 'Cherries. Small, sweet, and the first thing that has ever been yours.',                  metric: 'score',    target: 300,   rewardStars: 75,   rewardXp: 60,  rewardEvoXp: 15,  modes: ['explorer'] },
  { id: 'ex_shed',     chapter: 1, icon: '🐍', title: 'The First Shed',          story: 'Your old skin splits. Underneath, the royal mark shows clearly for the first time.',     metric: 'score',    target: 500,   rewardStars: 120,  rewardXp: 100, rewardEvoXp: 25,  modes: ['explorer'] },
  { id: 'ex_fragment', chapter: 2, icon: '⭐', title: 'A Fragment of the Crown', story: 'It hums when you touch it. Somewhere, a broken crown remembers being whole.',           metric: 'stars',    target: 5,     rewardStars: 150,  rewardXp: 120, rewardEvoXp: 40,  modes: ['explorer'] },
  { id: 'ex_scout',    chapter: 2, icon: '🗡️', title: 'The Order Notices',       story: 'A Venom scout falls beneath you. They know the heir is alive now — and so do you.',    metric: 'kills',    target: 1,     rewardStars: 180,  rewardXp: 150, rewardEvoXp: 50,  modes: ['explorer'] },
  { id: 'ex_grove',    chapter: 2, icon: '🌳', title: 'Into the Deep Grove',     story: 'These trees are older than the betrayal. They lean in as you pass, and they whisper.',  metric: 'score',    target: 1500,  rewardStars: 250,  rewardXp: 200, rewardEvoXp: 60,  modes: ['explorer'] },
  { id: 'ex_rivers',   chapter: 3, icon: '🏞️', title: 'Crossing the Riverlands', story: 'Water you cannot see the bottom of. You cross it anyway. That is the whole story.',    metric: 'areas',    target: 3,     rewardStars: 300,  rewardXp: 240, rewardEvoXp: 75,  modes: ['explorer'] },
  { id: 'ex_endure',   chapter: 3, icon: '⏳', title: 'The Long Night',          story: 'You survive long enough to watch the light change. Few hatchlings ever do.',            metric: 'survival', target: 180,   rewardStars: 350,  rewardXp: 280, rewardEvoXp: 90,  modes: ['explorer'] },
  { id: 'ex_guardian', chapter: 3, icon: '🛡️', title: "The Guardian's Gaze",     story: 'Something ancient beneath the hills opens one eye, considers you, and does not close it.', metric: 'score', target: 3000, rewardStars: 450, rewardXp: 360, rewardEvoXp: 120, modes: ['explorer'] },
  { id: 'ex_fire',     chapter: 4, icon: '🔥', title: 'Trial by Fire',           story: 'The Volcano Kingdom tests every heir who passes. Most of them stay there.',             metric: 'score',    target: 5000,  rewardStars: 600,  rewardXp: 500, rewardEvoXp: 180, modes: ['explorer'] },
  { id: 'ex_hunter',   chapter: 4, icon: '⚔️', title: 'No Longer Prey',          story: 'Ten of the Order have fallen to you. The hunt has quietly changed direction.',          metric: 'kills',    target: 10,    rewardStars: 700,  rewardXp: 560, rewardEvoXp: 200, modes: ['explorer'] },
  { id: 'ex_titan',    chapter: 4, icon: '🐲', title: 'The Titan Rises',         story: 'You are no longer the thing that runs. You are the thing they run from.',               metric: 'score',    target: 8000,  rewardStars: 1000, rewardXp: 800, rewardEvoXp: 300, modes: ['explorer'] },

  { id: 'fr_bite',     chapter: 1, icon: '🍒', title: 'First Bite',              story: 'The park is enormous and you are very small. Start anyway.',                            metric: 'score',    target: 250,   rewardStars: 50,   rewardXp: 40,  rewardEvoXp: 10,  modes: ['free_roam'] },
  { id: 'fr_grow',     chapter: 1, icon: '🐍', title: 'Growing Strong',          story: 'Your coils thicken. The smaller ones start choosing another path.',                     metric: 'score',    target: 500,   rewardStars: 100,  rewardXp: 80,  rewardEvoXp: 20,  modes: ['free_roam'] },
  { id: 'fr_hunt',     chapter: 2, icon: '⚔️', title: 'First Hunt',              story: 'Head to head, and you did not blink. Neither did they — that was their mistake.',        metric: 'kills',    target: 1,     rewardStars: 150,  rewardXp: 120, rewardEvoXp: 35,  modes: ['free_roam'] },
  { id: 'fr_stars',    chapter: 2, icon: '⭐', title: 'Star Collector',          story: 'Ten fragments, all of them still warm. The crown is out there in pieces.',              metric: 'stars',    target: 10,    rewardStars: 200,  rewardXp: 160, rewardEvoXp: 50,  modes: ['free_roam'] },
  { id: 'fr_apex',     chapter: 3, icon: '👑', title: 'Apex Predator',           story: 'Five rivals down. The park has learned your shape.',                                    metric: 'kills',    target: 5,     rewardStars: 350,  rewardXp: 280, rewardEvoXp: 90,  modes: ['free_roam'] },
  { id: 'fr_titan',    chapter: 3, icon: '🐲', title: 'Titan of the Park',       story: 'You fill the horizon now. Somewhere a smaller snake is telling a story about you.',     metric: 'score',    target: 5000,  rewardStars: 600,  rewardXp: 480, rewardEvoXp: 170, modes: ['free_roam'] },
  { id: 'fr_legend',   chapter: 4, icon: '🏆', title: 'Legend of the Park',      story: 'Ten thousand. They will not say your name — they will just point.',                     metric: 'score',    target: 10000, rewardStars: 1200, rewardXp: 900, rewardEvoXp: 350, modes: ['free_roam'] },
];

// The opening legend, shown as swipeable slides on first launch (and replayable).
export const LEGEND_SLIDES = [
  { icon: '👑', title: 'The Great Serpent Kingdom', text: 'Long before humans built cities, the world belonged to seven ancient serpent kingdoms — united under the Emerald Anaconda King and his Crown of Nature, which kept the forests alive and the rivers flowing.' },
  { icon: '🐍', title: 'The Betrayal', text: 'One night the Venom Order struck. The king vanished, the queen disappeared, the castle fell — and the Crown shattered into hundreds of glowing Star Fragments scattered across the world.' },
  { icon: '🥚', title: 'You', text: 'You are the royal hatchling who escaped in the last egg. You remember nothing — only the royal symbol on your head that older snakes still recognise. Some help you. Some fear you. Some want you gone.' },
  { icon: '⭐', title: 'Your Mission', text: 'Recover the Star Fragments, Ancient Eggs and Royal Relics. Restore the Seven Kingdoms. Rebuild the fallen castle. And one day — reclaim the throne of Anaconda Park.' },
];
