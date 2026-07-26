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

// The opening legend, shown as swipeable slides on first launch (and replayable).
export const LEGEND_SLIDES = [
  { icon: '👑', title: 'The Great Serpent Kingdom', text: 'Long before humans built cities, the world belonged to seven ancient serpent kingdoms — united under the Emerald Anaconda King and his Crown of Nature, which kept the forests alive and the rivers flowing.' },
  { icon: '🐍', title: 'The Betrayal', text: 'One night the Venom Order struck. The king vanished, the queen disappeared, the castle fell — and the Crown shattered into hundreds of glowing Star Fragments scattered across the world.' },
  { icon: '🥚', title: 'You', text: 'You are the royal hatchling who escaped in the last egg. You remember nothing — only the royal symbol on your head that older snakes still recognise. Some help you. Some fear you. Some want you gone.' },
  { icon: '⭐', title: 'Your Mission', text: 'Recover the Star Fragments, Ancient Eggs and Royal Relics. Restore the Seven Kingdoms. Rebuild the fallen castle. And one day — reclaim the throne of Anaconda Park.' },
];
