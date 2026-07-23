import { db } from '../db/Database';

export interface ShopItem {
  id: string;
  name: string;
  category: 'skin' | 'trail' | 'emote';
  priceStars: number;
  priceTickets: number;
  previewColor: string;
  description: string;
}

export class EconomyService {
  private static catalog: ShopItem[] = [
    { id: 'skin_emerald', name: 'Emerald Anaconda', category: 'skin', priceStars: 0, priceTickets: 0, previewColor: '#2A9D8F', description: 'Standard sleek forest python' },
    { id: 'skin_golden', name: 'Golden Serpent', category: 'skin', priceStars: 1000, priceTickets: 10, previewColor: '#E9C46A', description: 'Shimmering gold scales from the sunlit reserve' },
    { id: 'skin_crimson', name: 'Crimson Viper', category: 'skin', priceStars: 2500, priceTickets: 25, previewColor: '#E76F51', description: 'Aggressive fiery viper aesthetics' },
    { id: 'skin_shadow', name: 'Shadow Cobra', category: 'skin', priceStars: 5000, priceTickets: 50, previewColor: '#264653', description: 'Stealth night hunter pattern' },
    { id: 'trail_glow', name: 'Jungle Glow', category: 'trail', priceStars: 800, priceTickets: 5, previewColor: '#A8DADC', description: 'Bioluminescent spore trail' },
    { id: 'trail_fire', name: 'Solar Flare', category: 'trail', priceStars: 1500, priceTickets: 15, previewColor: '#F4A261', description: 'Blazing particles behind your path' },
  ];

  public static getCatalog(): ShopItem[] {
    return this.catalog;
  }

  public static purchaseItem(userId: string, itemId: string): { success: boolean; message: string; profile?: any } {
    const item = this.catalog.find(i => i.id === itemId);
    if (!item) return { success: false, message: 'Item not found in catalog' };

    const profile = db.getProfile(userId);
    if (!profile) return { success: false, message: 'Player profile not found' };

    if (profile.stars < item.priceStars || profile.tickets < item.priceTickets) {
      return { success: false, message: 'Insufficient stars or battle pass tickets' };
    }

    const updated = db.updateProfile(userId, {
      stars: profile.stars - item.priceStars,
      tickets: profile.tickets - item.priceTickets,
      equippedSkin: item.category === 'skin' ? item.name : profile.equippedSkin,
      equippedTrail: item.category === 'trail' ? item.name : profile.equippedTrail,
    });

    return { success: true, message: `Successfully unlocked ${item.name}!`, profile: updated };
  }
}
