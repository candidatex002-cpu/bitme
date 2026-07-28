import { db } from '../db/Database';
import { KINGDOMS, KingdomDef, NpcDef, QuestDef, kingdomByNumber, questById, npcById } from '../config/ExplorerContent';
import { PlayerProfile } from '../types';

// §explorer Campaign runtime: which kingdom you are in, who will talk to you, what they have
// asked for, and whether you have done it.
//
// Quest progress is NOT a new counter. It reads the same live progress metrics the rest of the
// game already credits (and already syncs from offline play), so a quest is a named target
// over a number the server is already proven to track. That means no new way to lose progress,
// and no second source of truth to drift.

export interface QuestView extends QuestDef {
  accepted: boolean;
  completed: boolean;
  claimed: boolean;
  progress: number;
  pct: number;
}

export interface NpcView extends NpcDef {
  // What this NPC says right now — greeting, quest brief, nudge, or their after-quest line.
  line: string;
  questState: 'none' | 'offer' | 'active' | 'ready' | 'done';
  quest?: QuestView;
}

export interface KingdomView {
  n: number; id: string; name: string; theme: string; icon: string;
  intro: string; outro: string; unlockLevel: number;
  unlocked: boolean; completed: boolean; current: boolean;
  questsDone: number; questsTotal: number;
  boss?: { id: string; name: string; icon: string; intro: string; unlockLevel: number; unlocked: boolean; defeated: boolean };
}

// Where quest/kingdom state lives on the profile. Kept in one bag so a campaign save is a
// single field rather than a scattering of flags.
export interface ExplorerState {
  kingdom: number;              // current kingdom number
  accepted: string[];           // quest ids accepted
  claimed: string[];            // quest ids claimed (rewards paid)
  kingdomsDone: number[];       // completed kingdom numbers
  bossesDefeated: string[];
  // Snapshot of a metric when a quest was accepted, so "collect 25 cherries" means 25 MORE —
  // not 25 total, which a returning player would already satisfy without playing.
  baseline: Record<string, number>;
}

const EMPTY: ExplorerState = { kingdom: 1, accepted: [], claimed: [], kingdomsDone: [], bossesDefeated: [], baseline: {} };

export class ExplorerService {
  static getState(profile: PlayerProfile): ExplorerState {
    const raw = (profile as any).explorer as Partial<ExplorerState> | undefined;
    return {
      kingdom: raw?.kingdom || 1,
      accepted: raw?.accepted || [],
      claimed: raw?.claimed || [],
      kingdomsDone: raw?.kingdomsDone || [],
      bossesDefeated: raw?.bossesDefeated || [],
      baseline: raw?.baseline || {},
    };
  }

  private static save(userId: string, state: ExplorerState) {
    db.updateProfile(userId, { explorer: state } as any);
  }

  // The player's lifetime value for a quest's metric — the same counter missions read.
  private static metricValue(profile: PlayerProfile, metric: string): number {
    const s: any = profile.stats || {};
    const generic = s.collectibles?.[metric];
    if (typeof generic === 'number') return generic;
    const named: Record<string, string> = {
      cherry: 'cherriesCollected', apple: 'applesCollected', frog: 'frogsCollected',
      star: 'totalStars', kill: 'totalKills',
    };
    return s[named[metric]] || 0;
  }

  // Progress counts from the moment the quest was accepted.
  private static questProgress(profile: PlayerProfile, state: ExplorerState, q: QuestDef): number {
    if (!state.accepted.includes(q.id)) return 0;
    const now = this.metricValue(profile, q.metric);
    const base = state.baseline[q.id] ?? now;
    return Math.max(0, Math.min(q.target, now - base));
  }

  static questView(profile: PlayerProfile, state: ExplorerState, q: QuestDef): QuestView {
    const progress = this.questProgress(profile, state, q);
    return {
      ...q,
      accepted: state.accepted.includes(q.id),
      completed: progress >= q.target,
      claimed: state.claimed.includes(q.id),
      progress,
      pct: q.target > 0 ? Math.min(100, Math.round((progress / q.target) * 100)) : 100,
    };
  }

  // A kingdom is unlocked by account level AND by finishing the one before it, so the story
  // cannot be entered halfway through.
  static kingdomUnlocked(profile: PlayerProfile, state: ExplorerState, k: KingdomDef): boolean {
    if ((profile.level || 1) < k.unlockLevel) return false;
    if (k.n === 1) return true;
    return state.kingdomsDone.includes(k.n - 1);
  }

  static kingdomView(profile: PlayerProfile, state: ExplorerState, k: KingdomDef): KingdomView {
    const done = k.quests.filter(q => state.claimed.includes(q.id)).length;
    const boss = k.boss ? {
      id: k.boss.id, name: k.boss.name, icon: k.boss.icon, intro: k.boss.intro,
      unlockLevel: k.boss.unlockLevel,
      // The boss is the kingdom's closing beat: its quests must be done first.
      unlocked: done >= k.quests.length && k.quests.length > 0 && (profile.level || 1) >= k.boss.unlockLevel,
      defeated: state.bossesDefeated.includes(k.boss.id),
    } : undefined;
    return {
      n: k.n, id: k.id, name: k.name, theme: k.theme, icon: k.icon,
      intro: k.intro, outro: k.outro, unlockLevel: k.unlockLevel,
      unlocked: this.kingdomUnlocked(profile, state, k),
      completed: state.kingdomsDone.includes(k.n),
      current: state.kingdom === k.n,
      questsDone: done, questsTotal: k.quests.length,
      boss,
    };
  }

  // What an NPC says right now, and the quest attached to them.
  static npcView(profile: PlayerProfile, state: ExplorerState, npc: NpcDef): NpcView {
    if (!npc.questId) return { ...npc, line: npc.greeting, questState: 'none' };
    const q = questById(npc.questId);
    if (!q) return { ...npc, line: npc.greeting, questState: 'none' };
    const view = this.questView(profile, state, q);

    if (view.claimed) return { ...npc, line: npc.afterQuest || npc.greeting, questState: 'done', quest: view };
    if (view.completed) return { ...npc, line: `${npc.afterQuest || 'You did it.'}`, questState: 'ready', quest: view };
    if (view.accepted) return { ...npc, line: `${q.brief} (${view.progress}/${q.target})`, questState: 'active', quest: view };
    return { ...npc, line: npc.greeting, questState: 'offer', quest: view };
  }

  // Everything the Explorer screen and the in-world HUD need, in one call.
  static overview(userId: string) {
    const profile = db.getProfile(userId);
    if (!profile) return null;
    const state = this.getState(profile);
    const kingdoms = KINGDOMS.map(k => this.kingdomView(profile, state, k));
    const current = kingdomByNumber(state.kingdom) || KINGDOMS[0];
    return {
      kingdom: this.kingdomView(profile, state, current),
      kingdoms,
      npcs: current.npcs.map(n => this.npcView(profile, state, n)),
      quests: current.quests.map(q => this.questView(profile, state, q)),
      // The one thing the player should do next — drives the HUD tracker.
      activeQuest: current.quests.map(q => this.questView(profile, state, q))
        .find(q => q.accepted && !q.claimed) || null,
    };
  }

  static acceptQuest(userId: string, questId: string) {
    const profile = db.getProfile(userId);
    if (!profile) return { success: false, message: 'Profile not found' };
    const q = questById(questId);
    if (!q) return { success: false, message: 'Unknown quest' };

    const state = this.getState(profile);
    const k = kingdomByNumber(q.kingdom)!;
    if (!this.kingdomUnlocked(profile, state, k)) return { success: false, message: `${k.name} is not open to you yet` };
    if (state.claimed.includes(questId)) return { success: false, message: 'Already completed' };
    if (state.accepted.includes(questId)) return { success: false, message: 'Already accepted' };

    state.accepted = [...state.accepted, questId];
    // Freeze the counter now, so the target means "this many MORE".
    state.baseline = { ...state.baseline, [questId]: this.metricValue(profile, q.metric) };
    this.save(userId, state);
    return { success: true, message: `Accepted: ${q.title}`, quest: this.questView(db.getProfile(userId)!, state, q) };
  }

  // Claim a finished quest. Server decides whether it is actually finished.
  static claimQuest(userId: string, questId: string) {
    const profile = db.getProfile(userId);
    if (!profile) return { success: false, message: 'Profile not found' };
    const q = questById(questId);
    if (!q) return { success: false, message: 'Unknown quest' };

    const state = this.getState(profile);
    if (state.claimed.includes(questId)) return { success: false, alreadyClaimed: true, message: 'Already claimed' };
    if (!state.accepted.includes(questId)) return { success: false, message: 'Accept the quest first' };

    const progress = this.questProgress(profile, state, q);
    if (progress < q.target) return { success: false, message: `Not finished — ${progress}/${q.target}` };

    // Record BEFORE paying, so a duplicate request racing this one cannot double-pay.
    state.claimed = [...state.claimed, questId];

    let kingdomCompleted = false;
    if (q.completesKingdom && !state.kingdomsDone.includes(q.kingdom)) {
      state.kingdomsDone = [...state.kingdomsDone, q.kingdom];
      kingdomCompleted = true;
      const next = kingdomByNumber(q.kingdom + 1);
      if (next) state.kingdom = next.n;
    }
    this.save(userId, state);

    const { profile: updated, levelsGained } = db.grantRewards(userId, {
      stars: q.rewardStars, xp: q.rewardXp, evoXp: q.rewardEvoXp,
    });

    return {
      success: true,
      message: q.title,
      rewards: { stars: q.rewardStars, xp: q.rewardXp, evoXp: q.rewardEvoXp },
      levelsGained,
      kingdomCompleted,
      unlockedKingdom: kingdomCompleted ? kingdomByNumber(q.kingdom + 1)?.name : undefined,
      nextQuest: q.unlocksQuest ? questById(q.unlocksQuest)?.title : undefined,
      profile: updated,
    };
  }

  // Where NPCs stand in world units, for the simulation to place them.
  static npcPlacements(worldSize: number) {
    return KINGDOMS.flatMap(k => k.npcs.map(n => ({
      ...n, kingdom: k.n,
      wx: n.at.x * worldSize, wy: n.at.y * worldSize,
    })));
  }
}

export { KINGDOMS, npcById };
