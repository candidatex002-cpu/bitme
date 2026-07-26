import { db } from '../db/Database';
import { CouponDefinition, CouponReward } from '../types';

// §7 Centralized, server-driven Coupon Management.
//
// Admins manage coupon DEFINITIONS (templates) at runtime — create / edit / enable /
// disable / expiry / regional availability / eligibility / redemption limits — and every
// redemption is tracked. Players CLAIM a definition, which mints a personal voucher
// (CouponReward) straight onto their profile so it appears in Inventory → Coupons with
// no manual DB edits. `autoGrant` definitions are issued the instant a player is eligible.
//
// No brand is hard-coded in the client: the definition carries the provider label, and the
// whole catalog lives on the backend so partners are configured without shipping code.

export interface CouponDefInput {
  title: string;
  storeName: string;
  discountText: string;
  icon?: string;
  enabled?: boolean;
  expiryDate?: string;
  regions?: string[] | 'all';
  minLevel?: number;
  minPrestige?: number;
  costStars?: number;
  redemptionLimit?: number;
  perUserLimit?: number;
  autoGrant?: boolean;
}

export type ClaimResult =
  | { success: true; message: string; voucher: CouponReward; profile: any }
  | { success: false; message: string };

export class CouponService {
  // ---------------------------------------------------------------- admin CRUD
  static list(): CouponDefinition[] {
    return db.listCouponDefs();
  }

  static create(input: CouponDefInput): CouponDefinition {
    const now = new Date().toISOString();
    const def: CouponDefinition = {
      id: `cpn_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      title: String(input.title || 'Untitled Coupon').slice(0, 80),
      storeName: String(input.storeName || 'Partner').slice(0, 60),
      discountText: String(input.discountText || '').slice(0, 120),
      icon: input.icon || '🎟️',
      enabled: input.enabled ?? true,
      expiryDate: input.expiryDate || '2026-12-31',
      regions: input.regions ?? 'all',
      minLevel: Math.max(1, Math.floor(input.minLevel ?? 1)),
      minPrestige: Math.max(0, Math.floor(input.minPrestige ?? 0)),
      costStars: Math.max(0, Math.floor(input.costStars ?? 0)),
      redemptionLimit: Math.floor(input.redemptionLimit ?? -1),
      perUserLimit: Math.max(1, Math.floor(input.perUserLimit ?? 1)),
      redemptionCount: 0,
      autoGrant: input.autoGrant ?? false,
      createdAt: now,
      updatedAt: now,
    };
    return db.upsertCouponDef(def);
  }

  static update(id: string, patch: Partial<CouponDefInput>): CouponDefinition | null {
    const def = db.getCouponDef(id);
    if (!def) return null;
    const next: CouponDefinition = {
      ...def,
      ...('title' in patch ? { title: String(patch.title).slice(0, 80) } : {}),
      ...('storeName' in patch ? { storeName: String(patch.storeName).slice(0, 60) } : {}),
      ...('discountText' in patch ? { discountText: String(patch.discountText).slice(0, 120) } : {}),
      ...('icon' in patch ? { icon: String(patch.icon) } : {}),
      ...('enabled' in patch ? { enabled: !!patch.enabled } : {}),
      ...('expiryDate' in patch ? { expiryDate: String(patch.expiryDate) } : {}),
      ...('regions' in patch ? { regions: patch.regions as any } : {}),
      ...('minLevel' in patch ? { minLevel: Math.max(1, Math.floor(patch.minLevel as number)) } : {}),
      ...('minPrestige' in patch ? { minPrestige: Math.max(0, Math.floor(patch.minPrestige as number)) } : {}),
      ...('costStars' in patch ? { costStars: Math.max(0, Math.floor(patch.costStars as number)) } : {}),
      ...('redemptionLimit' in patch ? { redemptionLimit: Math.floor(patch.redemptionLimit as number) } : {}),
      ...('perUserLimit' in patch ? { perUserLimit: Math.max(1, Math.floor(patch.perUserLimit as number)) } : {}),
      ...('autoGrant' in patch ? { autoGrant: !!patch.autoGrant } : {}),
      updatedAt: new Date().toISOString(),
    };
    return db.upsertCouponDef(next);
  }

  static setEnabled(id: string, enabled: boolean): CouponDefinition | null {
    return this.update(id, { enabled });
  }

  static remove(id: string): boolean {
    return db.deleteCouponDef(id);
  }

  static redemptions(definitionId?: string) {
    return db.getCouponRedemptions(definitionId);
  }

  // ---------------------------------------------------------------- eligibility
  private static inRegion(def: CouponDefinition, region: string): boolean {
    return def.regions === 'all' || def.regions.includes(region);
  }

  private static isExpired(def: CouponDefinition): boolean {
    const t = Date.parse(def.expiryDate);
    return Number.isFinite(t) && t < Date.now();
  }

  // Full reason-returning eligibility check used by both claim() and availability listing.
  static eligibility(def: CouponDefinition, userId: string, region: string): { ok: boolean; reason?: string } {
    if (!def.enabled) return { ok: false, reason: 'Coupon is not currently available' };
    if (this.isExpired(def)) return { ok: false, reason: 'Coupon has expired' };
    if (!this.inRegion(def, region)) return { ok: false, reason: 'Not available in your region' };
    if (def.redemptionLimit >= 0 && def.redemptionCount >= def.redemptionLimit) return { ok: false, reason: 'Fully redeemed' };
    const profile = db.getProfile(userId);
    if (!profile) return { ok: false, reason: 'Profile not found' };
    if (profile.level < def.minLevel) return { ok: false, reason: `Requires account level ${def.minLevel}` };
    if (profile.prestige < def.minPrestige) return { ok: false, reason: `Requires prestige ${def.minPrestige}` };
    if (db.countUserCouponRedemptions(def.id, userId) >= def.perUserLimit) return { ok: false, reason: 'Already claimed' };
    return { ok: true };
  }

  // Coupons a player is allowed to claim right now, with dynamic star cost + eligibility flags.
  static availableFor(userId: string, region: string = 'Global') {
    return db.listCouponDefs()
      .filter(d => d.enabled && !this.isExpired(d))
      .map(d => {
        const elig = this.eligibility(d, userId, region);
        return {
          id: d.id, title: d.title, storeName: d.storeName, discountText: d.discountText, icon: d.icon,
          costStars: d.costStars, expiryDate: d.expiryDate, minLevel: d.minLevel, minPrestige: d.minPrestige,
          eligible: elig.ok, reason: elig.reason,
        };
      });
  }

  // Mint a personal voucher onto the player's profile and record the redemption.
  private static issue(userId: string, def: CouponDefinition): CouponReward {
    const profile = db.getProfile(userId)!;
    const voucher: CouponReward = {
      id: `rdm_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      storeName: def.storeName,
      discountText: def.discountText,
      promoCode: 'AP-' + Math.random().toString(36).slice(2, 6).toUpperCase() + '-' + Math.random().toString(36).slice(2, 6).toUpperCase(),
      expiryDate: def.expiryDate,
      icon: def.icon,
      definitionId: def.id,
    };
    db.updateProfile(userId, { coupons: [...(profile.coupons || []), voucher] });
    def.redemptionCount += 1;
    def.updatedAt = new Date().toISOString();
    db.upsertCouponDef(def);
    db.recordCouponRedemption({ definitionId: def.id, userId, voucherId: voucher.id, promoCode: voucher.promoCode, redeemedAt: new Date().toISOString() });
    return voucher;
  }

  // Player claims a coupon → charges Stars (if any) and drops the voucher into their inventory.
  static claim(userId: string, couponId: string, region: string = 'Global'): ClaimResult {
    const def = db.getCouponDef(couponId);
    if (!def) return { success: false, message: 'Coupon not found' };
    const elig = this.eligibility(def, userId, region);
    if (!elig.ok) return { success: false, message: elig.reason || 'Not eligible' };
    const profile = db.getProfile(userId)!;
    if (def.costStars > 0 && profile.stars < def.costStars) return { success: false, message: 'Not enough Stars' };
    if (def.costStars > 0) db.updateProfile(userId, { stars: profile.stars - def.costStars });
    const voucher = this.issue(userId, def);
    return { success: true, message: `Claimed “${def.title}”`, voucher, profile: db.getProfile(userId) };
  }

  // §7 Auto-grant: silently issue any `autoGrant` coupon the player is newly eligible for
  // (free — these are earned rewards, not purchases). Called after progression events so the
  // coupon appears in the inventory with zero manual intervention. Returns issued vouchers.
  static autoGrantEligible(userId: string, region: string = 'Global'): CouponReward[] {
    const issued: CouponReward[] = [];
    for (const def of db.listCouponDefs()) {
      if (!def.autoGrant) continue;
      const elig = this.eligibility(def, userId, region);
      if (elig.ok) issued.push(this.issue(userId, def));
    }
    return issued;
  }
}
