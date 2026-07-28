// §explorer The campaign, as data.
//
// Explorer is meant to be a journey through a living kingdom, not the Free-For-All arena with
// a different label. That difference is made of three things — places to reach, people to
// meet, and things they ask of you — so all three live here as content, editable without a
// code change (and overridable from game-config.json like everything else).
//
// Quest progress deliberately rides the EXISTING progress metrics (cherry, frog, kill, …),
// which are already credited live and already survive offline play. A quest is therefore just
// a named target over a counter the game is proven to track.

import { ProgressMetric } from '../types';

export type NpcRole = 'elder' | 'guard' | 'merchant' | 'villager' | 'trainer';

export interface NpcDef {
  id: string;
  name: string;
  role: NpcRole;
  icon: string;          // base glyph
  accessory?: string;    // hat/staff/armour — what makes an elder read differently to a guard
  // Where they stand, as a fraction of world size, so the layout survives a map resize.
  at: { x: number; y: number };
  greeting: string;      // said on approach, before any quest is offered
  questId?: string;      // the quest this NPC hands out
  afterQuest?: string;   // said once their quest is done
}

export interface QuestDef {
  id: string;
  kingdom: number;
  title: string;
  brief: string;         // why they are asking
  metric: ProgressMetric;
  target: number;
  rewardStars: number;
  rewardXp: number;
  rewardEvoXp: number;
  // Completing this unlocks the next step; the last quest of a kingdom opens the next kingdom.
  unlocksQuest?: string;
  completesKingdom?: boolean;
}

export interface BossDef {
  id: string;
  kingdom: number;
  name: string;
  icon: string;
  intro: string;
  // The account level the campaign expects before this fight is fair.
  unlockLevel: number;
  hp: number;
  speed: number;
  radius: number;
  score: number;         // its "size" for head-to-head resolution
}

export interface KingdomDef {
  n: number;
  id: string;
  name: string;
  theme: string;         // maps to a GameConfig map theme
  icon: string;
  intro: string;         // shown on entering
  outro: string;         // shown on completing
  unlockLevel: number;
  npcs: NpcDef[];
  quests: QuestDef[];
  boss?: BossDef;
}

export const KINGDOMS: KingdomDef[] = [
  {
    n: 1,
    id: 'emerald_hollow',
    name: 'Emerald Hollow',
    theme: 'forest',
    icon: '🌳',
    intro: 'A village of low green houses under the old trees. They have been waiting a long time for someone with your markings.',
    outro: 'Emerald Hollow stands. The bridge east is yours to cross.',
    unlockLevel: 1,
    npcs: [
      {
        id: 'npc_elder_moss', name: 'Elder Moss', role: 'elder', icon: '🐍', accessory: '🧙',
        at: { x: 0.50, y: 0.46 },
        greeting: 'You carry the old mark, little one. I did not think I would live to see it again. The Hollow is hungry — help us eat, and I will tell you what I know.',
        questId: 'q1_forage',
        afterQuest: 'The stores are full. Sit. The Crown was not lost, child — it was broken, and scattered on purpose.',
      },
      {
        id: 'npc_guard_bram', name: 'Guard Bram', role: 'guard', icon: '🐍', accessory: '🛡️',
        at: { x: 0.58, y: 0.52 },
        greeting: 'Stay behind me. The Venom Order sends scouts through the east treeline most nights, and I am one snake.',
        questId: 'q1_scouts',
        afterQuest: 'You fight like someone who has something to get back. Good. The bridge is clear.',
      },
      {
        id: 'npc_merchant_fen', name: 'Fen the Trader', role: 'merchant', icon: '🐍', accessory: '🎒',
        at: { x: 0.44, y: 0.54 },
        greeting: 'Star fragments, friend. I buy, I sell, I do not ask where they came from. Bring me some and we both eat.',
        questId: 'q1_fragments',
        afterQuest: 'Warm to the touch, still. Whatever the Crown was, it has not finished being it.',
      },
      {
        id: 'npc_villager_pip', name: 'Pip', role: 'villager', icon: '🐍', accessory: '🌸',
        at: { x: 0.53, y: 0.41 },
        greeting: 'Are you really the one from the egg? Elder Moss says not to bother you. I am bothering you.',
      },
      {
        id: 'npc_trainer_kess', name: 'Kess the Coil', role: 'trainer', icon: '🐍', accessory: '⚔️',
        at: { x: 0.47, y: 0.58 },
        greeting: 'Head to head is the only fight that matters out there. Bigger wins. So get bigger — that is the whole lesson.',
      },
    ],
    quests: [
      {
        id: 'q1_forage', kingdom: 1, title: 'Feed the Hollow',
        brief: 'Elder Moss needs the village stores filled before the cold.',
        metric: 'cherry', target: 25, rewardStars: 150, rewardXp: 120, rewardEvoXp: 40,
        unlocksQuest: 'q1_scouts',
      },
      {
        id: 'q1_scouts', kingdom: 1, title: 'Drive Back the Scouts',
        brief: 'Guard Bram cannot hold the east treeline alone.',
        metric: 'kill', target: 3, rewardStars: 250, rewardXp: 200, rewardEvoXp: 70,
        unlocksQuest: 'q1_fragments',
      },
      {
        id: 'q1_fragments', kingdom: 1, title: 'Fragments for Fen',
        brief: 'Fen trades in Star Fragments — and knows more than he admits.',
        metric: 'star', target: 8, rewardStars: 350, rewardXp: 280, rewardEvoXp: 100,
        completesKingdom: true,
      },
    ],
    boss: {
      id: 'boss_thornmaw', kingdom: 1, name: 'Thornmaw', icon: '🐲',
      intro: 'The treeline splits. What comes through it is not a scout.',
      unlockLevel: 50, hp: 600, speed: 200, radius: 30, score: 4000,
    },
  },
  // Kingdoms 2-7 are declared so progression, the map and the UI are real from day one.
  // Their NPCs and quests are the next content slice.
  { n: 2, id: 'sunken_reach',  name: 'Sunken Reach',  theme: 'riverlands',    icon: '🌊', intro: 'Water over the old road. The Reach drowned slowly, and something stayed.', outro: 'The Reach breathes again.',        unlockLevel: 60,  npcs: [], quests: [] },
  { n: 3, id: 'ashfall',       name: 'Ashfall',       theme: 'volcano',       icon: '🔥', intro: 'Warm stone underfoot. Nothing grows here and everything watches.',        outro: 'Ashfall cools behind you.',        unlockLevel: 130, npcs: [], quests: [] },
  { n: 4, id: 'white_silence', name: 'White Silence', theme: 'ice',           icon: '❄️', intro: 'Snow that has never been walked on. Your trail is the only one.',         outro: 'The Silence lets you pass.',       unlockLevel: 220, npcs: [], quests: [] },
  { n: 5, id: 'bloomfall',     name: 'Bloomfall',     theme: 'tropical',      icon: '🌸', intro: 'Colour after all that white. Bloomfall never heard the kingdom fell.',   outro: 'Bloomfall remembers your name.',   unlockLevel: 340, npcs: [], quests: [] },
  { n: 6, id: 'the_hush',      name: 'The Hush',      theme: 'swamp',         icon: '🌑', intro: 'No birds. No wind. The Venom Order made this quiet on purpose.',         outro: 'The Hush is broken.',              unlockLevel: 500, npcs: [], quests: [] },
  { n: 7, id: 'crown_spire',   name: 'Crown Spire',   theme: 'royal_castle',  icon: '👑', intro: 'Your castle. Ruined, occupied, and still standing — like you.',          outro: 'The throne of Anaconda Park is yours.', unlockLevel: 700, npcs: [], quests: [] },
];

export function kingdomByNumber(n: number): KingdomDef | undefined {
  return KINGDOMS.find(k => k.n === n);
}

export function questById(id: string): QuestDef | undefined {
  for (const k of KINGDOMS) {
    const q = k.quests.find(x => x.id === id);
    if (q) return q;
  }
  return undefined;
}

export function npcById(id: string): NpcDef | undefined {
  for (const k of KINGDOMS) {
    const n = k.npcs.find(x => x.id === id);
    if (n) return n;
  }
  return undefined;
}
