// §14 AdMob integration boundary.
//
// Real ads require the Google Mobile Ads Capacitor plugin (e.g. @capacitor-community/admob)
// plus YOUR own AdMob app id + ad-unit ids. Until those are configured, every method falls
// back to a no-op or the built-in simulated rewarded ad, so dev/web keeps working.
// NO live ad ids ship in this repo — set them via configure() at app start.
//
// Policy (sprint §14): rewarded + interstitial + app-open allowed; banners are LOBBY-ONLY;
// never show intrusive ads during active gameplay.

export type AdUnit = 'rewarded' | 'interstitial' | 'banner' | 'appOpen';

export interface AdConfig {
  enabled: boolean;                     // master switch — flip on once ids + plugin are set
  appId: string;                        // AdMob application id
  units: Record<AdUnit, string>;        // ad-unit ids
  testMode: boolean;                    // use Google test ads while integrating
}

const DEFAULT_CONFIG: AdConfig = {
  enabled: false,
  appId: '',
  units: { rewarded: '', interstitial: '', banner: '', appOpen: '' },
  testMode: true,
};

export class AdService {
  private cfg: AdConfig = DEFAULT_CONFIG;
  private plugin: any = null; // assign the AdMob plugin instance once installed

  /** Configure ad ids + toggle. Call once at startup (see main.ts). */
  configure(partial: Partial<AdConfig>): void { this.cfg = { ...this.cfg, ...partial }; }

  /** Inject the native AdMob plugin (from @capacitor-community/admob) when available. */
  attachPlugin(plugin: any): void { this.plugin = plugin; }

  isEnabled(): boolean { return this.cfg.enabled && !!this.plugin; }

  /**
   * Show a rewarded ad. Resolves true when the reward should be granted.
   * `simulate(done)` runs the built-in 5s reward modal used on web / when ads are off.
   */
  async showRewarded(simulate: (done: () => void) => void): Promise<boolean> {
    if (this.isEnabled() && this.cfg.units.rewarded) {
      try {
        // await this.plugin.prepareRewardVideoAd({ adId: this.cfg.units.rewarded, isTesting: this.cfg.testMode });
        // const result = await this.plugin.showRewardVideoAd();
        // return !!result?.rewarded;
        return true; // TODO: wire the plugin call above once ids are set
      } catch { return false; }
    }
    return new Promise<boolean>(resolve => simulate(() => resolve(true)));
  }

  /** Interstitial between screens (e.g. returning to the lobby). No-op until enabled. */
  async showInterstitial(): Promise<void> {
    if (!this.isEnabled() || !this.cfg.units.interstitial) return;
    try {
      // await this.plugin.prepareInterstitial({ adId: this.cfg.units.interstitial, isTesting: this.cfg.testMode });
      // await this.plugin.showInterstitial();
    } catch { /* ignore ad failures */ }
  }

  /** Lobby-only banner. No-op until enabled; never call during active gameplay. */
  async showBanner(): Promise<void> {
    if (!this.isEnabled() || !this.cfg.units.banner) return;
    try {
      // await this.plugin.showBanner({ adId: this.cfg.units.banner, isTesting: this.cfg.testMode, position: 'BOTTOM_CENTER' });
    } catch { /* */ }
  }

  async hideBanner(): Promise<void> {
    if (!this.isEnabled()) return;
    try { /* await this.plugin.hideBanner(); */ } catch { /* */ }
  }
}

export const ads = new AdService();
