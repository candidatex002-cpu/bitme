import { db } from '../db/Database';
import { CouponReward } from '../types';

// §15 Rewards marketplace — players redeem Stars for digital rewards.
// The catalog is data-driven (NO hard-coded brand promises): each entry names an
// "approved provider" label. Wire real gift-card/partner fulfilment behind redeem().

export type RewardCategory = 'giftcard' | 'merch' | 'cosmetic' | 'eventpass' | 'partner';

export interface RewardItem {
  id: string;
  title: string;
  category: RewardCategory;
  icon: string;
  baseStarCost: number;
  regions: string[] | 'all';   // regional availability
  stock: number;               // -1 = unlimited
  minLevel: number;            // minimum redemption threshold (account level)
  provider: string;            // approved reward provider / partner label
  description: string;
}

export interface RewardView extends RewardItem {
  starCost: number;            // dynamic price after adjustments
  available: boolean;          // in the requested region AND in stock
  soldOut: boolean;
}

export class RewardsService {
  // Stock is in-memory config (resets on restart/redeploy). Redeemed vouchers persist
  // on the player profile. Move this table + stock into the DB for durable inventory.
  private static catalog: RewardItem[] = [
    { id: 'rw_giftcard_10', title: 'Digital Gift Card (10 credits)', category: 'giftcard', icon: '🎟️', baseStarCost: 5000, regions: 'all', stock: 50, minLevel: 5, provider: 'Approved Gift Provider', description: 'Redeemable digital gift credit via an authorized provider.' },
    { id: 'rw_giftcard_25', title: 'Digital Gift Card (25 credits)', category: 'giftcard', icon: '💳', baseStarCost: 12000, regions: ['Global', 'USA', 'Europe', 'India'], stock: 20, minLevel: 15, provider: 'Approved Gift Provider', description: 'Higher-value digital gift credit, region-gated.' },
    { id: 'rw_merch_tee', title: 'Anaconda Park T-Shirt', category: 'merch', icon: '👕', baseStarCost: 8000, regions: ['USA', 'Europe', 'India', 'Brazil'], stock: 15, minLevel: 10, provider: 'Official Merch Partner', description: 'Physical merch — shipping where the partner operates.' },
    { id: 'rw_bundle_cosmetic', title: 'Legend Cosmetic Bundle', category: 'cosmetic', icon: '✨', baseStarCost: 3000, regions: 'all', stock: -1, minLevel: 1, provider: 'In-Game', description: 'A bundle of premium skins & trails, granted instantly.' },
    { id: 'rw_eventpass', title: 'Seasonal Event Pass', category: 'eventpass', icon: '🎫', baseStarCost: 4000, regions: 'all', stock: -1, minLevel: 3, provider: 'In-Game', description: 'Unlocks the current season event track.' },
    { id: 'rw_partner_promo', title: 'Partner Promo Voucher', category: 'partner', icon: '🤝', baseStarCost: 2000, regions: ['India', 'Brazil'], stock: 30, minLevel: 5, provider: 'Regional Partner', description: 'A partner promotion available in select regions.' },
  ];

  // Dynamic pricing: scarce stock costs more; unlimited items stay at base price.
  private static dynamicCost(item: RewardItem): number {
    if (item.stock < 0) return item.baseStarCost;
    const scarcity = item.stock <= 5 ? 1.3 : item.stock <= 15 ? 1.12 : 1.0;
    return Math.round(item.baseStarCost * scarcity);
  }

  private static inRegion(item: RewardItem, region: string): boolean {
    return item.regions === 'all' || item.regions.includes(region);
  }

  public static getCatalog(region: string = 'Global'): { region: string; items: RewardView[] } {
    const items = this.catalog.map((item) => ({
      ...item,
      starCost: this.dynamicCost(item),
      soldOut: item.stock === 0,
      available: this.inRegion(item, region) && item.stock !== 0,
    }));
    return { region, items };
  }

  private static voucherCode(): string {
    return 'AP-' + Math.random().toString(36).slice(2, 6).toUpperCase() + '-' + Math.random().toString(36).slice(2, 6).toUpperCase();
  }

  public static redeem(userId: string, itemId: string, region: string = 'Global'): { success: boolean; message: string; voucher?: CouponReward; profile?: any } {
    const item = this.catalog.find((i) => i.id === itemId);
    if (!item) return { success: false, message: 'Reward not found' };
    if (!this.inRegion(item, region)) return { success: false, message: 'Not available in your region' };
    if (item.stock === 0) return { success: false, message: 'Out of stock' };

    const profile = db.getProfile(userId);
    if (!profile) return { success: false, message: 'Profile not found' };
    if (profile.level < item.minLevel) return { success: false, message: `Requires account level ${item.minLevel}` };

    const cost = this.dynamicCost(item);
    if (profile.stars < cost) return { success: false, message: 'Not enough Stars' };

    // Deduct stars, decrement stock, issue a persisted voucher on the profile.
    if (item.stock > 0) item.stock -= 1;
    const voucher: CouponReward = {
      id: `rdm_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      storeName: item.title,
      discountText: `Redeemed via ${item.provider}`,
      promoCode: this.voucherCode(),
      expiryDate: '2026-12-31',
      icon: item.icon,
    };
    const updated = db.updateProfile(userId, {
      stars: profile.stars - cost,
      coupons: [...(profile.coupons || []), voucher],
    });

    return { success: true, message: `Redeemed “${item.title}” — voucher ${voucher.promoCode}`, voucher, profile: updated };
  }
}
