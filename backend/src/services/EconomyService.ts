import { db } from '../db/Database';
import { gameConfig, skinById, SkinDef } from '../config/GameConfig';

// Server-authoritative cosmetics shop.
//
// Skin definitions (and their prices) live in GameConfig, so a content editor can re-price or
// add a skin from game-config.json with no code change. Ownership lives on the profile as
// `unlockedSkins`. The client is never trusted for either: it can render a shop, but only the
// server decides what a player owns, what it costs, and whether they may equip it.

export interface ShopSkinView extends SkinDef {
  owned: boolean;
  equipped: boolean;
  affordable: boolean;
  levelMet: boolean;
  purchasable: boolean;
}

export interface PurchaseResult {
  success: boolean;
  message: string;
  profile?: any;
  skinId?: string;
}

export class EconomyService {
  // The full catalog annotated for one player. Without a userId it degrades to the raw price
  // list (the anonymous catalog view) — it never reveals anything about another account.
  public static getCatalog(userId?: string): { skins: ShopSkinView[]; starterSkins: string[] } {
    const profile = userId ? db.getProfile(userId) : undefined;
    const owned = new Set(profile?.unlockedSkins || gameConfig.cosmetics.starterSkins);
    const stars = profile?.stars ?? 0;
    const tickets = profile?.tickets ?? 0;
    const level = profile?.level ?? 1;

    const skins = gameConfig.cosmetics.skins.map((s): ShopSkinView => {
      const isOwned = owned.has(s.id);
      const affordable = stars >= s.costStars && tickets >= s.costTickets;
      const levelMet = level >= s.minLevel;
      return {
        ...s,
        owned: isOwned,
        equipped: profile?.equippedSkin === s.id,
        affordable,
        levelMet,
        purchasable: !isOwned && affordable && levelMet,
      };
    });
    return { skins, starterSkins: gameConfig.cosmetics.starterSkins };
  }

  public static ownsSkin(userId: string, skinId: string): boolean {
    const profile = db.getProfile(userId);
    if (!profile) return false;
    // A profile written before the ownership model falls back to the starter set.
    const owned = profile.unlockedSkins?.length ? profile.unlockedSkins : gameConfig.cosmetics.starterSkins;
    return owned.includes(skinId);
  }

  // Buy a skin. Every gate (existence, double-purchase, level, funds) is checked here and the
  // charge is derived from the config price — never from anything the client sent.
  public static purchaseSkin(userId: string, skinId: string): PurchaseResult {
    const skin = skinById(skinId);
    if (!skin) return { success: false, message: 'Unknown skin' };

    const profile = db.getProfile(userId);
    if (!profile) return { success: false, message: 'Player profile not found' };

    const owned = profile.unlockedSkins || [];
    if (owned.includes(skinId)) return { success: false, message: `You already own ${skin.name}` };
    if (profile.level < skin.minLevel) return { success: false, message: `${skin.name} unlocks at level ${skin.minLevel}` };
    if (profile.stars < skin.costStars || profile.tickets < skin.costTickets) {
      return { success: false, message: `Not enough ${profile.stars < skin.costStars ? 'stars' : 'tickets'}` };
    }

    const updated = db.updateProfile(userId, {
      stars: profile.stars - skin.costStars,
      tickets: profile.tickets - skin.costTickets,
      unlockedSkins: [...owned, skinId],
    });
    return { success: true, message: `Unlocked ${skin.name}!`, profile: updated, skinId };
  }

  // Equip an owned skin. Refuses anything the player has not actually unlocked.
  public static equipSkin(userId: string, skinId: string): PurchaseResult {
    if (!skinById(skinId)) return { success: false, message: 'Unknown skin' };
    if (!this.ownsSkin(userId, skinId)) return { success: false, message: 'You do not own that skin' };
    const updated = db.updateProfile(userId, { equippedSkin: skinId });
    if (!updated) return { success: false, message: 'Player profile not found' };
    return { success: true, message: `Equipped ${skinId}`, profile: updated, skinId };
  }
}
