import { GameClient, GameMode, GameStateTick, SnakeData, serverBase } from './game/GameClient.js';
import { Renderer } from './game/Renderer.js';
import { audio } from './game/AudioSystem.js';

const API = serverBase();

type Screen = 'app' | 'matchmaking' | 'play' | 'pause' | 'respawn' | 'gameover' | 'ad-reward';
type Page = 'home' | 'play' | 'missions' | 'inventory' | 'profile' | 'events' | 'social' | 'settings' | 'rewards';

interface SkinDef { id: string; name: string; grad: string; premium?: boolean; family?: string; }
// 15 skin families — each belongs to a themed group
const SKIN_FAMILIES: Array<{ family: string; icon: string; skins: SkinDef[] }> = [
  { family: 'Forest',    icon: '🌳', skins: [
    { id: 'Forest',    name: 'Forest',    grad: 'linear-gradient(90deg,#1B5E20,#8BC34A)' },
    { id: 'Jungle',    name: 'Jungle',    grad: 'linear-gradient(90deg,#2E7D32,#81C784)' },
  ]},
  { family: 'Ocean',     icon: '🌊', skins: [
    { id: 'Ocean',     name: 'Ocean',     grad: 'linear-gradient(90deg,#0D47A1,#64B5F6)' },
    { id: 'Ice',       name: 'Ice',       grad: 'linear-gradient(90deg,#0097A7,#E0F7FA)' },
  ]},
  { family: 'Fire',      icon: '🔥', skins: [
    { id: 'Fire',      name: 'Fire',      grad: 'linear-gradient(90deg,#C62828,#FFB74D)' },
    { id: 'Electric',  name: 'Electric',  grad: 'linear-gradient(90deg,#F57F17,#FFF9C4)' },
  ]},
  { family: 'Mystical',  icon: '🌌', skins: [
    { id: 'Galaxy',    name: 'Galaxy',    grad: 'linear-gradient(90deg,#0D0221,#E040FB)' },
    { id: 'Shadow',    name: 'Shadow',    grad: 'linear-gradient(90deg,#311B92,#9575CD)' },
    { id: 'Mythical',  name: 'Mythical',  grad: 'linear-gradient(90deg,#4A0072,#EA80FC)', premium: true },
  ]},
  { family: 'Elegant',   icon: '👑', skins: [
    { id: 'Golden',    name: 'Golden',    grad: 'linear-gradient(90deg,#FF8F00,#FFE082)', premium: true },
    { id: 'Royal',     name: 'Royal',     grad: 'linear-gradient(90deg,#311B92,#D1C4E9)', premium: true },
  ]},
  { family: 'Nature',    icon: '🌸', skins: [
    { id: 'Sakura',    name: 'Sakura',    grad: 'linear-gradient(90deg,#AD1457,#FCE4EC)' },
    { id: 'Desert',    name: 'Desert',    grad: 'linear-gradient(90deg,#8B5E0A,#F0D060)' },
  ]},
  { family: 'Seasonal',  icon: '🎄', skins: [
    { id: 'Christmas', name: 'Christmas', grad: 'linear-gradient(90deg,#C62828,#1B5E20)' },
    { id: 'Halloween', name: 'Halloween', grad: 'linear-gradient(90deg,#212121,#FF6D00)' },
  ]},
];
// Flat list for quick lookup
const SKINS: SkinDef[] = SKIN_FAMILIES.flatMap(f => f.skins);

interface AccessoryDef { id: string; name: string; icon: string; slot: string; rarity: string; seasonal?: boolean; }
const ACCESSORIES: AccessoryDef[] = [
  { id: 'flower_crown',    name: 'Flower Crown',     icon: '🌸', slot: 'hat', rarity: 'common' },
  { id: 'pirate_hat',      name: 'Pirate Hat',        icon: '🏴‍☠️', slot: 'hat', rarity: 'rare' },
  { id: 'wizard_hat',      name: 'Wizard Hat',        icon: '🎩', slot: 'hat', rarity: 'rare' },
  { id: 'headphones',      name: 'Headphones',        icon: '🎧', slot: 'hat', rarity: 'common' },
  { id: 'scarf',           name: 'Scarf',             icon: '🧣', slot: 'neck', rarity: 'common' },
  { id: 'backpack',        name: 'Tiny Backpack',     icon: '🎒', slot: 'back', rarity: 'rare' },
  { id: 'explorer_hat',    name: 'Explorer Hat',      icon: '🤠', slot: 'hat', rarity: 'common' },
  { id: 'christmas_hat',   name: 'Christmas Hat',     icon: '🎅', slot: 'hat', rarity: 'rare', seasonal: true },
  { id: 'ramadan_lantern', name: 'Ramadan Lantern',   icon: '🏮', slot: 'hat', rarity: 'epic', seasonal: true },
  { id: 'diwali_crown',    name: 'Diwali Crown',      icon: '👑', slot: 'hat', rarity: 'epic', seasonal: true },
  { id: 'golden_wings',    name: 'Golden Wings',      icon: '✨', slot: 'back', rarity: 'legendary' },
];

// 7-stage evolution ladder — driven by score milestones + Evo XP (not physical length)
const EVO_LADDER: Array<{ name: string; scoreReq: number; evoXpReq: number; desc: string }> = [
  { name: 'Baby',   scoreReq: 0,    evoXpReq: 0,     desc: 'Hatchling' },
  { name: 'Young',  scoreReq: 500,  evoXpReq: 500,   desc: 'Growing fast' },
  { name: 'Teen',   scoreReq: 1000, evoXpReq: 1000,  desc: 'Finding strength' },
  { name: 'Adult',  scoreReq: 1500, evoXpReq: 2500,  desc: 'Formidable force' },
  { name: 'Elite',  scoreReq: 2000, evoXpReq: 8000,  desc: 'Apex predator' },
  { name: 'Titan',  scoreReq: 2500, evoXpReq: 20000, desc: 'Legend of the park' },
  { name: 'Legend', scoreReq: 2500, evoXpReq: 40000, desc: '✨ Prestige required' },
];


const POWERUPS = [
  { icon: '🍒', name: 'Cherry', sub: 'Restores a little health', val: '+10' },
  { icon: '🍄', name: 'Mushroom', sub: 'Quick snack', val: '+15' },
  { icon: '🍎', name: 'Apple', sub: 'Solid score + heal', val: '+25' },
  { icon: '🐸', name: 'Frog', sub: 'Tasty catch', val: '+30' },
  { icon: '⭐', name: 'Star', sub: 'Big score boost', val: '+50' },
  { icon: '🥚', name: 'Egg', sub: 'Rare mystery prize', val: 'Prize' },
  { icon: '🛡️', name: 'Shield', sub: 'Blocks all damage 8s', val: 'Guard' },
  { icon: '⚡', name: 'Speed', sub: 'Faster for 6s', val: 'Boost' },
];

const MODE_META: Record<GameMode, { icon: string; name: string; tag: string; mood?: boolean }> = {
  classic: { icon: '👑', name: 'Classic', tag: 'Free For All', mood: true },
  battle_royale: { icon: '⚔️', name: 'Battle Royale', tag: 'Last Snake Standing' },
  team: { icon: '🛡️', name: 'Team Battle', tag: '4v4 Team' },
  event: { icon: '🏆', name: 'Event Mode', tag: 'Special Events' },
};

const REGIONS = ['🌍 Quick Match', '🇮🇳 India', '🇺🇸 USA', '🇯🇵 Japan', '🇧🇷 Brazil', '🇪🇺 Europe', '🇦🇺 Australia'];

const LANDMARKS = [
  { name: 'Starbucks', x: 665, y: 1445 }, { name: 'Pizza Hut', x: 2265, y: 1445 },
  { name: 'Park Cafe', x: 1465, y: 645 }, { name: 'Hospital', x: 565, y: 2345 },
  { name: 'College', x: 2365, y: 2245 }, { name: 'Bridge', x: 1565, y: 2445 },
];

interface Settings { sfx: boolean; music: boolean; largeText: boolean; reduceMotion: boolean; highContrast: boolean; controlSide: 'right' | 'left'; }

class AnacondaPark {
  private root: HTMLElement;
  private client = new GameClient();
  private renderer: Renderer | null = null;

  private token = '';
  private profile: any = null;
  private missions: any[] = [];
  private achievements: any[] = [];
  private leaderboard: any[] = [];

  private screen: Screen = 'app';
  private page: Page = 'home';
  private missionCat: 'daily' | 'weekly' | 'event' | 'achievements' = 'daily';
  private invTab: 'skins' | 'accessories' | 'powerups' | 'coupons' = 'skins';

  private selectedMode: GameMode = 'classic';
  private selectedSkin = 'Forest';
  private equippedAccessory = '';
  private matchType: 'global' | 'local' = 'global';
  private selectedRegion = '🌍 Quick Match';

  // §15 Rewards marketplace
  private rewards: any[] = [];
  private rewardRegion = 'Global';

  private settings: Settings = { sfx: true, music: true, largeText: false, reduceMotion: false, highContrast: false, controlSide: 'right' };

  // input
  private angle = 0; private boosting = false; private keys: Record<string, boolean> = {};
  private sendTimer: any = null; private joyActive = false;
  // §4 fixed joystick + §5 pinch-zoom touch tracking
  private joyId: number | null = null;
  private joyCenter = { x: 0, y: 0 };
  private readonly joyRadius = 52;
  private pinchDist = 0;

  // match state
  private matchStart = 0; private lastAlive = true; private lastSnake: SnakeData | null = null;
  private lastState: GameStateTick | null = null; private visitedAreas = new Set<string>(); private summary: any = null;
  private adTimer = 5; private adInterval: any = null; private respawnWait = 0; private respawnInterval: any = null;

  constructor() {
    this.root = document.getElementById('app')!;
    this.loadSettings();
    this.render();
    this.initGuest();
    window.addEventListener('resize', () => this.renderer?.resize());
    window.addEventListener('keydown', (e) => { if (e.code === 'Escape' && (this.screen === 'play' || this.screen === 'pause')) this.togglePause(); });
    this.bindLifecycle();
    // Browsers block audio until the user interacts — kick off the Home music on the
    // very first tap/click/keypress (idempotent; no-ops if music is turned off).
    ['pointerdown', 'keydown', 'touchstart'].forEach(ev => window.addEventListener(ev, () => audio.ensureMusic(), { passive: true }));
  }

  private toggleMusic() {
    this.settings.music = !this.settings.music;
    if (this.settings.music) audio.playClick();
    this.saveSettings(); // applySettings() calls audio.setMusicEnabled(...)
    this.render();
  }

  // §12 Mobile pause — home button, incoming call, lock screen, backgrounding all
  // fire visibilitychange/blur. We auto-pause, tell the server to mark us inactive
  // (no damage), and persist a resumable session snapshot.
  private bindLifecycle() {
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.autoPause(); });
    window.addEventListener('blur', () => this.autoPause());
    window.addEventListener('pagehide', () => this.saveSession());
  }
  private autoPause() {
    if (this.screen !== 'play') return;
    this.boosting = false;
    this.client.notifyPause(true);
    this.saveSession();
    this.setScreen('pause');
  }
  private saveSession() {
    if (this.screen !== 'play' && this.screen !== 'pause') return;
    try {
      localStorage.setItem('ap_session', JSON.stringify({
        at: Date.now(), mode: this.selectedMode, skin: this.selectedSkin,
        matchType: this.matchType, region: this.selectedRegion,
        score: Math.round(this.lastSnake?.score || 0),
      }));
    } catch { /* */ }
  }

  // ------------------------------------------------------------- settings
  private loadSettings() {
    try { const s = JSON.parse(localStorage.getItem('ap_settings') || '{}'); this.settings = { ...this.settings, ...s }; } catch { /* */ }
    // One-time migration: music is now an independent channel that plays from Home. Default it
    // ON for everyone once (older saves had a meaningless music:false), then respect the choice
    // the player makes via the Home 🎵 button / Settings from here on.
    if (!localStorage.getItem('ap_music_v2')) {
      this.settings.music = true;
      localStorage.setItem('ap_music_v2', '1');
      try { localStorage.setItem('ap_settings', JSON.stringify(this.settings)); } catch { /* */ }
    }
    this.applySettings();
  }
  private saveSettings() { localStorage.setItem('ap_settings', JSON.stringify(this.settings)); this.applySettings(); }
  private applySettings() {
    document.body.classList.toggle('a11y-large', this.settings.largeText);
    document.body.classList.toggle('a11y-contrast', this.settings.highContrast);
    if (audio.getMuted() === this.settings.sfx) audio.toggleMute();
    audio.setMusicEnabled(this.settings.music); // §music — independent of SFX
  }

  private animFrameId: number | null = null;

  // ------------------------------------------------------------- data
  // §10 Persist the session locally so progress survives app close / restart / offline.
  private persistSession() {
    try { if (this.token && this.profile) localStorage.setItem('ap_profile_cache', JSON.stringify({ token: this.token, profile: this.profile })); } catch { /* */ }
  }
  private loadCachedSession(): { token: string; profile: any } | null {
    try { const raw = localStorage.getItem('ap_profile_cache'); if (!raw) return null; const d = JSON.parse(raw); return d?.token && d?.profile ? d : null; } catch { return null; }
  }

  private async initGuest() {
    // Restore any cached session first so the player sees their progress instantly, even offline.
    const cached = this.loadCachedSession();
    if (cached) { this.token = cached.token; this.profile = cached.profile; this.selectedSkin = cached.profile?.equippedSkin || this.selectedSkin; this.render(); }
    try {
      if (!this.token) {
        const res = await fetch(API + '/api/auth/guest', { method: 'POST' });
        const data = await res.json();
        this.token = data.token;
        this.profile = data.profile;
      }
      this.selectedSkin = this.profile?.equippedSkin || 'Forest';
      await this.refreshProfile();
      await this.fetchAux();
      this.persistSession();
      this.render();
    } catch {
      if (this.profile) { this.persistSession(); this.render(); return; }
      this.token = 'guest_local_token';
      this.profile = {
        id: 'guest_1',
        displayName: 'Explorer',
        stars: 500,
        tickets: 5,
        level: 1,
        xp: 50,
        xpToNext: 300,
        evolutionXp: 0,
        equippedSkin: 'Forest',
        equippedEvolution: 'Baby',
        unlockedEvolutions: ['Baby'],
        stats: { matchesPlayed: 0, matchesWon: 0, totalKills: 0, totalFoodEaten: 0, highestScore: 0, survivalTimeSeconds: 0, cherriesCollected: 0 },
        rank: { label: 'Bronze I', color: '#b45309', tier: 'Bronze' }
      };
      this.render();
    }
  }

  private async fetchAux() {
    if (!this.token) return;
    const h = { Authorization: `Bearer ${this.token}` };
    try {
      const [m, a, lb] = await Promise.all([
        fetch(API + '/api/missions', { headers: h }), fetch(API + '/api/achievements', { headers: h }), fetch(API + '/api/leaderboard'),
      ]);
      this.missions = (await m.json()).missions || [];
      this.achievements = (await a.json()).achievements || [];
      this.leaderboard = (await lb.json()).leaderboard || [];
    } catch { /* */ }
  }

  private async refreshProfile() {
    // Only overwrite the cached profile when the server actually returns one (§10 — a 401
    // or an offline fetch must not wipe locally-persisted progress).
    try {
      const res = await fetch(API + '/api/player/profile', { headers: { Authorization: `Bearer ${this.token}` } });
      const data = await res.json();
      if (data?.profile) { this.profile = data.profile; this.persistSession(); }
    } catch { /* keep cached profile */ }
  }

  private rank() { return this.profile?.rank || { label: 'Bronze III', color: '#b45309', tier: 'Bronze' }; }

  // ------------------------------------------------------------- navigation
  private setScreen(s: Screen) { this.screen = s; this.render(); }
  private go(p: Page) { this.page = p; this.screen = 'app'; audio.playClick(); this.render(); if (p === 'rewards') this.loadRewards(); }

  private async equipSkin(id: string) {
    audio.playClick(); this.selectedSkin = id; if (this.profile) this.profile.equippedSkin = id;
    try { await fetch(API + '/api/player/equip', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.token}` }, body: JSON.stringify({ skin: id }) }); } catch { /* */ }
    this.render();
  }

  private async equipEvolution(evo: string) {
    audio.playClick();
    try {
      const res = await fetch(API + '/api/player/evolution', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.token}` }, body: JSON.stringify({ evolution: evo }) });
      const data = await res.json();
      if (data.success) { this.profile = data.profile; this.showToast(`🐍 ${data.message}`); audio.playChime(); } else this.showToast(`🔒 ${data.message}`);
    } catch { /* */ }
    this.render();
  }

  private async doPrestige() {
    audio.playClick();
    try {
      const res = await fetch(API + '/api/player/prestige', { method: 'POST', headers: { Authorization: `Bearer ${this.token}` } });
      const data = await res.json();
      if (data.success) { this.profile = data.profile; this.showToast(`👑 ${data.message}`); audio.playFanfare(); } else this.showToast(data.message);
    } catch { /* */ }
    this.render();
  }

  private async equipAccessory(id: string) {
    audio.playClick();
    // Tap again to unequip
    const newId = this.equippedAccessory === id ? '' : id;
    this.equippedAccessory = newId;
    if (this.profile) this.profile.equippedAccessory = newId || undefined;
    try {
      await fetch(API + '/api/player/equip-accessory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.token}` },
        body: JSON.stringify({ accessoryId: newId || null }),
      });
    } catch { /* */ }
    const acc = ACCESSORIES.find(a => a.id === newId);
    this.showToast(newId ? `${acc?.icon ?? '✨'} Equipped ${acc?.name ?? newId}` : '🎒 Accessory removed');
    this.render();
  }

  // ------------------------------------------------------------- match flow
  private startMatchmaking() {
    audio.playClick(); this.setScreen('matchmaking');
    let n = 3;
    const t = setInterval(() => { n--; const el = document.getElementById('mm-count'); if (el) el.innerText = String(n); if (n <= 0) { clearInterval(t); this.startMatch(); } }, 750);
  }

  private startMatch() {
    this.matchStart = Date.now(); this.lastAlive = true; this.visitedAreas.clear(); this.summary = null;
    this.setScreen('play');
    audio.startMusic();
    const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
    if (canvas) this.renderer = new Renderer(canvas);
    this.client.onStateUpdate = (s) => this.onTick(s);
    this.client.onRespawnResult = (r) => this.onRespawn(r);
    const region = this.matchType === 'local' ? 'Perambur' : this.selectedRegion.replace(/^[^\w]+/, '').trim() || 'Global';
    this.client.connect(this.token, this.selectedSkin, this.selectedMode, region, this.matchType);
    this.setupInput();
    this.startRenderLoop();
  }

  private startRenderLoop() {
    if (this.animFrameId) cancelAnimationFrame(this.animFrameId);
    const loop = () => {
      if (this.screen === 'play' || this.screen === 'pause' || this.screen === 'respawn') {
        if (this.renderer && this.lastState) {
          this.renderer.render(this.lastState, this.client.localUserId);
        }
        this.animFrameId = requestAnimationFrame(loop);
      }
    };
    this.animFrameId = requestAnimationFrame(loop);
  }

  private onTick(state: GameStateTick) {
    this.lastState = state;
    const me = state.snakes.find(s => s.id === this.client.localUserId);
    if (me) this.lastSnake = me;
    if (me && me.isAlive) for (const l of LANDMARKS) { const dx = me.head.x - l.x, dy = me.head.y - l.y; if (dx * dx + dy * dy < 240 * 240) this.visitedAreas.add(l.name); }
    if (me && !me.isAlive && this.lastAlive && this.screen === 'play') { this.lastAlive = false; audio.playDeath(); this.openRespawn(); return; }
    if (me && me.isAlive) this.lastAlive = true;
    if (this.screen === 'play') this.updateHUD(state, me);
  }

  private onRespawn(r: { success: boolean; message?: string; profile?: any }) {
    if (r.success) { if (r.profile) this.profile = r.profile; this.lastAlive = true; this.clearRespawnTimers(); audio.playChime(); this.setScreen('play'); this.setupInput(); }
    else this.showToast(`❌ ${r.message || 'Respawn failed'}`);
  }

  private openRespawn() {
    this.clearRespawnTimers(); this.respawnWait = 25; this.setScreen('respawn');
    this.respawnInterval = setInterval(() => {
      this.respawnWait--; const el = document.getElementById('respawn-wait'); if (el) el.innerText = `${this.respawnWait}s`;
      if (this.respawnWait <= 0) { this.clearRespawnTimers(); const btn = document.getElementById('respawn-wait-btn') as HTMLButtonElement; if (btn) { btn.disabled = false; const sub = btn.querySelector('.ro-sub'); if (sub) sub.textContent = 'Ready — free respawn!'; } }
    }, 1000);
  }
  private clearRespawnTimers() { if (this.respawnInterval) { clearInterval(this.respawnInterval); this.respawnInterval = null; } }

  private doRespawn(method: 'stars' | 'ticket' | 'ad' | 'wait') {
    audio.playClick();
    if (method === 'ad') { this.triggerAd(() => this.client.requestRespawn('ad')); return; }
    this.client.requestRespawn(method);
  }

  private async endMatch() {
    audio.playClick(); this.clearRespawnTimers(); this.teardownInput();
    const snake = this.lastSnake; const state = this.lastState;
    const survival = Math.max(5, Math.floor((Date.now() - this.matchStart) / 1000));
    const alive = state ? state.snakes.filter(s => s.isAlive).length : 8;
    const placement = alive + 1;
    const distanceKm = snake ? +((snake as any).distanceTravelled?.toFixed?.(2) || 0) : 0;
    try {
      const res = await fetch(API + '/api/match/summary', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.token}` }, body: JSON.stringify({ score: snake?.score || 0, kills: snake?.kills || 0, placement, survivalSeconds: survival, distanceKm, areasVisited: this.visitedAreas.size }) });
      const data = await res.json();
      this.summary = { score: Math.round(snake?.score || 0), kills: snake?.kills || 0, placement, survival, earnedStars: data.earnedStars || 0, earnedXP: data.earnedXP || 0, earnedEvoXP: data.earnedEvoXP || 0, levelsGained: data.levelsGained || 0 };
      if (data.profile) this.profile = data.profile;
      if (data.levelsGained > 0) this.showLevelUp(data.profile.level);
    } catch { this.summary = { score: Math.round(snake?.score || 0), kills: snake?.kills || 0, placement, survival, earnedStars: 0, earnedXP: 0, earnedEvoXP: 0, levelsGained: 0 }; }
    this.persistSession(); // §10 keep earned stars/XP across restarts
    await this.fetchAux(); this.client.disconnect(); this.setScreen('gameover');
  }

  private togglePause() {
    audio.playClick();
    if (this.screen === 'play') { this.client.notifyPause(true); this.saveSession(); this.setScreen('pause'); }
    else if (this.screen === 'pause') { this.client.notifyPause(false); this.setScreen('play'); this.setupInput(); }
  }

  private async abandon() {
    audio.playClick(); this.teardownInput(); this.clearRespawnTimers();
    try { await fetch(API + '/api/match/abandon', { method: 'POST', headers: { Authorization: `Bearer ${this.token}` } }); } catch { /* */ }
    this.client.disconnect(); await this.refreshProfile(); await this.fetchAux(); this.page = 'home'; this.setScreen('app');
  }

  private triggerAd(after: () => void) {
    this.setScreen('ad-reward'); this.adTimer = 5;
    if (this.adInterval) clearInterval(this.adInterval);
    this.adInterval = setInterval(() => { this.adTimer--; const el = document.getElementById('ad-count'); if (el) el.innerText = String(this.adTimer); if (this.adTimer <= 0) { clearInterval(this.adInterval); after(); } }, 1000);
  }

  private async claimMission(id: string) {
    audio.playClick();
    try {
      const res = await fetch(API + '/api/missions/claim', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.token}` }, body: JSON.stringify({ missionId: id }) });
      const data = await res.json();
      if (data.success) { audio.playFanfare(); this.missions = data.updatedMissions; if (data.profile) this.profile = data.profile; if (data.evoXp) this.showToast(`Claimed! +${data.stars}⭐ +${data.evoXp} Evo-XP`); this.render(); }
    } catch { /* */ }
  }

  // ------------------------------------------------------------- input
  private setupInput() {
    this.teardownInput();
    window.addEventListener('mousemove', this.onMouseMove); window.addEventListener('mousedown', this.onMouseDown); window.addEventListener('mouseup', this.onMouseUp);
    window.addEventListener('keydown', this.onKeyDown); window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('wheel', this.onWheel, { passive: false });
    // §4 fixed-joystick + §5 pinch — window-level so a drag that leaves the base still tracks
    window.addEventListener('touchstart', this.onTouchStart, { passive: false });
    window.addEventListener('touchmove', this.onTouchMove, { passive: false });
    window.addEventListener('touchend', this.onTouchEnd);
    window.addEventListener('touchcancel', this.onTouchEnd);
    if (!this.sendTimer) this.sendTimer = setInterval(() => this.pumpInput(), 33);
  }
  private teardownInput() {
    window.removeEventListener('mousemove', this.onMouseMove); window.removeEventListener('mousedown', this.onMouseDown); window.removeEventListener('mouseup', this.onMouseUp);
    window.removeEventListener('keydown', this.onKeyDown); window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('wheel', this.onWheel);
    window.removeEventListener('touchstart', this.onTouchStart);
    window.removeEventListener('touchmove', this.onTouchMove);
    window.removeEventListener('touchend', this.onTouchEnd);
    window.removeEventListener('touchcancel', this.onTouchEnd);
    this.joyId = null; this.joyActive = false; this.pinchDist = 0;
    if (this.sendTimer) { clearInterval(this.sendTimer); this.sendTimer = null; }
  }
  private onMouseMove = (e: MouseEvent) => { if (this.screen !== 'play' || this.joyActive || this.isWasd()) return; this.angle = Math.atan2(e.clientY - innerHeight / 2, e.clientX - innerWidth / 2); };
  private onMouseDown = (e: MouseEvent) => { if (this.screen === 'play' && !(e.target as HTMLElement)?.closest('.hud-panel,.touch-btn,.hud-pause')) this.boosting = true; };
  private onMouseUp = () => { this.boosting = false; };
  private onWheel = (e: WheelEvent) => { if (this.screen !== 'play') return; e.preventDefault(); this.renderer?.adjustZoom(e.deltaY < 0 ? 1.08 : 0.926); };
  private onKeyDown = (e: KeyboardEvent) => {
    if (this.screen !== 'play') return;
    const k = e.key.toLowerCase();
    if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) { this.keys[k] = true; e.preventDefault(); }
    if (k === 'shift') this.boosting = true;
    if (e.code === 'Space') { e.preventDefault(); this.client.activateAbility(); audio.playClick(); }
    if (k === '+' || k === '=') this.renderer?.adjustZoom(1.1);
    if (k === '-' || k === '_') this.renderer?.adjustZoom(0.9);
  };
  private onKeyUp = (e: KeyboardEvent) => { const k = e.key.toLowerCase(); if (this.keys[k] !== undefined) this.keys[k] = false; if (k === 'shift') this.boosting = false; };
  private isWasd() { return this.keys['w'] || this.keys['a'] || this.keys['s'] || this.keys['d'] || this.keys['arrowup'] || this.keys['arrowdown'] || this.keys['arrowleft'] || this.keys['arrowright']; }
  private pumpInput() {
    if (this.screen !== 'play') return;
    if (this.isWasd() && !this.joyActive) {
      let dx = 0, dy = 0;
      if (this.keys['w'] || this.keys['arrowup']) dy -= 1; if (this.keys['s'] || this.keys['arrowdown']) dy += 1;
      if (this.keys['a'] || this.keys['arrowleft']) dx -= 1; if (this.keys['d'] || this.keys['arrowright']) dx += 1;
      if (dx || dy) this.angle = Math.atan2(dy, dx);
    }
    this.client.sendInput(this.angle, this.boosting);
  }

  // ---- §4 Fixed joystick (movement) + §5 pinch-zoom -----------------------
  private touchIsOnControl(x: number, y: number): boolean {
    const el = document.elementFromPoint(x, y) as HTMLElement | null;
    return !!(el && el.closest('.touch-btn, .hud-panel, .hud-pause, .overlay, .ability-badge'));
  }
  private joystickHit(x: number, y: number): DOMRect | null {
    const el = document.getElementById('touch-joystick');
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const dx = x - cx, dy = y - cy;
    const reach = r.width * 0.95; // generous grab radius around the fixed base
    return dx * dx + dy * dy < reach * reach ? r : null;
  }
  private onTouchStart = (e: TouchEvent) => {
    if (this.screen !== 'play') return;
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      if (this.touchIsOnControl(t.clientX, t.clientY)) continue; // buttons handle themselves
      const rect = this.joyId === null ? this.joystickHit(t.clientX, t.clientY) : null;
      if (rect) {
        this.joyId = t.identifier;
        this.joyCenter = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
        this.joyActive = true;
        this.updateJoy(t.clientX, t.clientY);
        e.preventDefault();
      }
      // Touches outside the joystick do NOT steer the snake (§4 requirement).
    }
    if (e.touches.length === 2) this.pinchDist = this.touchSpread(e.touches);
  };
  private onTouchMove = (e: TouchEvent) => {
    if (this.screen !== 'play') return;
    if (e.touches.length >= 2) {
      const d = this.touchSpread(e.touches);
      if (this.pinchDist > 0 && d > 0) this.renderer?.adjustZoom(d / this.pinchDist);
      this.pinchDist = d;
    }
    if (this.joyId !== null) {
      for (let i = 0; i < e.touches.length; i++) {
        const t = e.touches[i];
        if (t.identifier === this.joyId) { this.updateJoy(t.clientX, t.clientY); e.preventDefault(); break; }
      }
    }
  };
  private onTouchEnd = (e: TouchEvent) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === this.joyId) { this.joyId = null; this.joyActive = false; this.resetKnob(); }
    }
    if (e.touches.length < 2) this.pinchDist = 0;
  };
  private touchSpread(t: TouchList): number { return Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY); }
  private updateJoy(x: number, y: number) {
    const dx = x - this.joyCenter.x, dy = y - this.joyCenter.y;
    const dist = Math.hypot(dx, dy);
    if (dist > 4) this.angle = Math.atan2(dy, dx);
    const clamped = Math.min(dist, this.joyRadius);
    const kx = Math.cos(this.angle) * clamped, ky = Math.sin(this.angle) * clamped;
    const knob = document.getElementById('touch-knob');
    if (knob) knob.style.transform = `translate(calc(-50% + ${kx}px), calc(-50% + ${ky}px))`;
    document.getElementById('touch-joystick')?.classList.add('active');
  }
  private resetKnob() {
    const knob = document.getElementById('touch-knob');
    if (knob) knob.style.transform = 'translate(-50%,-50%)';
    document.getElementById('touch-joystick')?.classList.remove('active');
  }

  // ---- On-screen action buttons (rebound on each HUD render) --------------
  private bindTouch() {
    // Window-level joystick/pinch handlers live in setupInput(); here we (re)bind the
    // on-screen action buttons, which are recreated every time the HUD is rendered.
    const boost = document.getElementById('touch-boost');
    if (boost) {
      const on = (e: Event) => { e.preventDefault(); e.stopPropagation(); this.boosting = true; };
      const off = (e: Event) => { e.stopPropagation(); this.boosting = false; };
      boost.addEventListener('touchstart', on, { passive: false });
      boost.addEventListener('touchend', off); boost.addEventListener('touchcancel', off);
      boost.addEventListener('mousedown', on); boost.addEventListener('mouseup', off);
    }
    const ability = document.getElementById('touch-ability');
    if (ability) ability.addEventListener('touchstart', (e) => { e.preventDefault(); e.stopPropagation(); this.client.activateAbility(); audio.playClick(); }, { passive: false });
    const zoom = document.getElementById('touch-zoom');
    if (zoom) {
      const cyc = (e: Event) => { e.preventDefault(); e.stopPropagation(); const label = this.renderer?.cycleZoom(); const l = document.getElementById('touch-zoom-label'); if (l && label) l.innerText = label; };
      zoom.addEventListener('touchstart', cyc, { passive: false });
      zoom.addEventListener('click', cyc);
    }
    const mini = document.getElementById('touch-mini');
    if (mini) mini.addEventListener('click', (e) => { e.stopPropagation(); document.querySelector('.hud')?.classList.toggle('mini-hidden'); });
  }

  // ------------------------------------------------------------- HUD
  private updateHUD(state: GameStateTick, me?: SnakeData) {
    if (!me) return;
    const setW = (id: string, p: number) => { const el = document.getElementById(id); if (el) el.style.width = `${Math.max(0, Math.min(100, p))}%`; };
    const setT = (id: string, v: string) => { const el = document.getElementById(id); if (el) el.innerText = v; };
    const hp = Math.round(me.hp ?? 100);
    setW('hs-health', hp); setT('hv-health', String(hp));
    const hpFill = document.getElementById('hs-health');
    if (hpFill) hpFill.style.background = hp < 30 ? '#ef5a45' : hp < 60 ? '#f5a623' : '#22c55e';
    setT('hv-score', String(Math.round(me.score)));
    setT('hud-stage', `${me.evolution || me.stage} · Lv ${me.level}`);
    const cd = me.abilityCooldown ?? 0;
    const badge = document.getElementById('ability-badge'); const cdEl = document.getElementById('ability-cd');
    if (badge && cdEl) { badge.classList.toggle('ready', cd <= 0); cdEl.innerText = cd <= 0 ? 'READY' : `${Math.ceil(cd)}s`; }
    document.getElementById('touch-ability')?.classList.toggle('cooling', cd > 0);
    const evt = document.getElementById('hud-event');
    if (evt) { if (state.currentEvent) { evt.style.display = 'block'; evt.innerText = `${state.currentEvent.icon} ${state.currentEvent.timerSeconds}s`; } else evt.style.display = 'none'; }
    const ts = document.getElementById('team-scores');
    if (ts) { if (state.teamScores) { ts.style.display = 'flex'; ts.innerHTML = `<div class="ts red">🔴 ${state.teamScores.red}</div><div class="ts blue">🔵 ${state.teamScores.blue}</div>`; } else ts.style.display = 'none'; }
    const lb = document.getElementById('hud-lb-rows');
    if (lb) lb.innerHTML = state.leaderboard.slice(0, 6).map((r, i) => `<div class="lb-row ${r.id === this.client.localUserId ? 'me' : ''}"><span>${i + 1}. ${r.name}</span><span>${r.score}</span></div>`).join('');
  }

  // ------------------------------------------------------------- render dispatch
  private render() {
    let body = '';
    if (this.screen === 'app') body = this.renderApp();
    else if (this.screen === 'matchmaking') body = this.renderMatchmaking();
    else if (this.screen === 'play') body = this.renderHUD();
    else if (this.screen === 'pause') body = this.renderHUD() + this.renderPause();
    else if (this.screen === 'respawn') body = this.renderHUD() + this.renderRespawn();
    else if (this.screen === 'gameover') body = this.renderGameover();
    else if (this.screen === 'ad-reward') body = this.renderAd();
    this.root.innerHTML = `<canvas id="game-canvas"></canvas>${body}`;
    this.bind();
    if (this.screen === 'play' || this.screen === 'pause' || this.screen === 'respawn') this.bindTouch();
  }

  // ------------------------------------------------------------- APP SHELL
  private renderApp() {
    const p = this.profile; const r = this.rank();
    const nav: Array<[Page, string, string]> = [
      ['home', '🏠', 'Home'], ['play', '🎮', 'Play'], ['missions', '🎯', 'Missions'], ['inventory', '🎒', 'Inventory'], ['profile', '👤', 'Profile'],
    ];
    return `
      <div class="app-shell">
        <div class="app-top">
          <div class="app-brand"><div class="logo">🐍</div><div class="logo-txt">Anaconda Park<small>GROW · EXPLORE · COMPETE</small></div></div>
          <div style="display:flex;gap:8px;align-items:center;">
            <div class="chip">⭐ <span class="val">${p?.stars ?? 500}</span></div>
            <div class="chip">🎟️ <span class="val">${p?.tickets ?? 5}</span></div>
            <button class="icon-btn ${this.settings.music ? '' : 'off'}" id="music-toggle" title="${this.settings.music ? 'Music on' : 'Music off'}">${this.settings.music ? '🎵' : '🔕'}</button>
            <button class="icon-btn" data-go="settings">⚙️</button>
          </div>
        </div>
        <div class="app-content">
          ${this.page === 'home' ? this.pageHome()
        : this.page === 'play' ? this.pagePlay()
          : this.page === 'missions' ? this.pageMissions()
            : this.page === 'inventory' ? this.pageInventory()
              : this.page === 'profile' ? this.pageProfile()
                : this.page === 'events' ? this.pageEvents()
                  : this.page === 'social' ? this.pageSocial()
                    : this.page === 'rewards' ? this.pageRewards()
                      : this.pageSettings()}
        </div>
        <div class="bottom-nav">
          ${nav.map(([id, ico, label]) => `<button class="nav-item ${this.page === id ? 'active' : ''}" data-go="${id}"><span class="ni-ico">${ico}</span>${label}</button>`).join('')}
        </div>
      </div>`;
  }

  private xpBar() {
    const p = this.profile; if (!p) return '';
    const toNext = p.xpToNext || 300; const pct = Math.min(100, (p.xp / toNext) * 100);
    return `<div class="xp-wrap"><div class="xp-bar"><div style="width:${pct}%"></div></div><div class="xp-label"><span>Level ${p.level}${p.prestige ? ` · ✨${p.prestige}` : ''}</span><span>${p.xp} / ${toNext} XP</span></div></div>`;
  }

  // ---------- HOME (focused: what do I do next?) ----------
  private pageHome() {
    const p = this.profile; const r = this.rank();
    const daily = this.missions.filter(m => m.category === 'daily').slice(0, 3);
    return `
      <div class="page">
        <div class="hero">
          <div class="welcome">Welcome back,</div>
          <div class="who">${p?.displayName || 'Explorer'}</div>
          <div class="rank-line">
            <span class="rank-badge" style="color:#fff">🏆 ${r.label}</span>
            <span class="rank-badge">⭐ ${p?.stars ?? 0}</span>
            <span class="rank-badge">🎟️ ${p?.tickets ?? 0}</span>
          </div>
          ${this.xpBar()}
        </div>

        <div class="play-now">
          <button class="btn btn-primary btn-lg btn-block" data-go="play">▶ PLAY NOW</button>
          <button class="btn btn-gold btn-lg" id="quick-match" title="Quick match">⚡</button>
        </div>

        <div class="card">
          <div class="section-title">🎯 Today's Missions <span class="see-all" data-go="missions">See all</span></div>
          <div class="list">
            ${daily.map(m => this.missionRow(m, true)).join('') || '<div class="muted">Loading…</div>'}
          </div>
        </div>

        <div class="card tint" data-go="rewards" style="cursor:pointer;display:flex;align-items:center;gap:12px;justify-content:space-between;">
          <div style="display:flex;align-items:center;gap:12px;">
            <div style="font-size:2rem;">🎁</div>
            <div><div style="font-family:var(--font-title);font-weight:800;">Rewards Marketplace</div><div class="muted" style="font-size:0.8rem;">Redeem ⭐ for gift cards, merch &amp; passes</div></div>
          </div>
          <span class="pill gold">Open</span>
        </div>

        <div class="two-col">
          <div class="card tint" data-go="events" style="cursor:pointer;">
            <div class="section-title">🎪 Latest Event</div>
            <div style="display:flex;align-items:center;gap:12px;">
              <div style="font-size:2.4rem;">🐍</div>
              <div><div style="font-family:var(--font-title);font-weight:800;">Jungle Festival</div><div class="muted" style="font-size:0.8rem;">2 days remaining · double stars</div></div>
            </div>
          </div>
          <div class="card" data-go="social" style="cursor:pointer;">
            <div class="section-title">👥 Friends Online</div>
            <div class="list">
              ${['Ashraf', 'Rahul', 'David'].map(n => `<div class="friend"><div class="avatar">${n[0]}</div><div style="font-weight:700;font-size:0.85rem;">${n}</div><div class="dot"></div></div>`).join('')}
            </div>
          </div>
        </div>
      </div>`;
  }

  private missionRow(m: any, compact = false) {
    const pct = Math.min(100, (m.currentCount / m.targetCount) * 100);
    const action = m.isClaimed ? `<span class="pill done">Claimed ✓</span>`
      : m.isCompleted ? `<button class="btn btn-gold claim-btn" data-id="${m.id}" style="padding:7px 12px;font-size:0.78rem;">Claim</button>`
        : `<span class="pill">${m.currentCount}/${m.targetCount}</span>`;
    return `<div class="row-card"><div class="r-ico">${m.icon}</div><div class="r-body">
      <div class="r-title">${m.title}</div>${compact ? '' : `<div class="r-desc">${m.description}</div>`}
      <div class="progress"><div style="width:${pct}%"></div></div>
      <div class="r-count">${m.currentCount} / ${m.targetCount} · ⭐${m.rewardStars} · ✨${m.rewardEvoXP} Evo</div>
      </div><div>${action}</div></div>`;
  }

  // ---------- PLAY (modes + matchmaking only) ----------
  private pagePlay() {
    return `
      <div class="page">
        <div class="card">
          <div class="section-title">🌐 Matchmaking</div>
          <div class="seg" style="margin-bottom:12px;">
            <button class="${this.matchType === 'global' ? 'active' : ''}" data-mt="global">🌎 Global Adventure</button>
            <button class="${this.matchType === 'local' ? 'active' : ''}" data-mt="local">📍 Local Explorer</button>
          </div>
          ${this.matchType === 'global'
        ? `<div class="region-grid">${REGIONS.map(rg => `<div class="region-btn ${this.selectedRegion === rg ? 'active' : ''}" data-region="${rg}">${rg}</div>`).join('')}</div>`
        : `<div class="muted" style="font-size:0.85rem;">You'll be matched into a game region near your approximate location (neighbourhood level only). Your exact GPS is never shared with other players.</div>`}
        </div>

        <div class="card">
          <div class="section-title">🎮 Choose a Mode</div>
          <div class="mode-grid">
            ${(Object.keys(MODE_META) as GameMode[]).map(m => `
              <div class="mode-card ${this.selectedMode === m ? 'selected' : ''}" data-mode="${m}">
                ${MODE_META[m].mood ? '<span class="mood">MOOD</span>' : ''}
                <div class="mode-icon">${MODE_META[m].icon}</div>
                <div class="mode-name">${MODE_META[m].name}</div>
                <div class="mode-tag">${MODE_META[m].tag}</div>
              </div>`).join('')}
          </div>
          <div class="muted" style="font-size:0.78rem;margin:10px 0;">Feeling casual? <b>Classic</b> is a relaxed free-for-all. Want stakes? Try Battle Royale or Team.</div>
          <button class="btn btn-primary btn-lg btn-block" id="enter-btn">🚀 Enter ${MODE_META[this.selectedMode].name}</button>
        </div>
      </div>`;
  }

  // ---------- MISSIONS ----------
  private pageMissions() {
    const cats: Array<[typeof this.missionCat, string]> = [['daily', 'Daily'], ['weekly', 'Weekly'], ['event', 'Event'], ['achievements', 'Achievements']];
    return `
      <div class="page">
        <div class="section-title">🎯 Missions & Awards</div>
        <div class="tabs">${cats.map(([id, l]) => `<button class="tab ${this.missionCat === id ? 'active' : ''}" data-mcat="${id}">${l}</button>`).join('')}</div>
        <div class="list">
          ${this.missionCat === 'achievements'
        ? this.achievements.map(a => this.achRow(a)).join('')
        : (this.missions.filter(m => m.category === this.missionCat).map(m => this.missionRow(m)).join('') || '<div class="muted" style="padding:16px;text-align:center;">Nothing here yet.</div>')}
        </div>
      </div>`;
  }
  private achRow(a: any) {
    const pct = Math.min(100, (a.progress / a.target) * 100);
    return `<div class="row-card ach ${a.isUnlocked ? 'unlocked' : ''}"><div class="r-ico">${a.icon}</div><div class="r-body">
      <div class="r-title">${a.title} <span class="tier ${a.tier}">${a.tier}</span></div><div class="r-desc">${a.description}</div>
      <div class="progress"><div style="width:${pct}%"></div></div><div class="r-count">${a.progress} / ${a.target} · ⭐${a.rewardStars}</div>
      </div>${a.isUnlocked ? '<span class="pill gold">✓</span>' : ''}</div>`;
  }

  // ---------- INVENTORY ----------
  private pageInventory() {
    const tabs: Array<[typeof this.invTab, string]> = [
      ['skins', '🐍 Skins'], ['accessories', '👑 Accessories'], ['powerups', '⚡ Power-Ups'], ['coupons', '🎟️ Coupons'],
    ];
    let content = '';
    if (this.invTab === 'skins') {
      // Grouped by family
      content = SKIN_FAMILIES.map(fam => `
        <div class="skin-family">
          <div class="skin-family-title">${fam.icon} ${fam.family}</div>
          <div class="skin-family-row">${fam.skins.map(s => `
            <div class="skin-card ${this.selectedSkin === s.id ? 'equipped' : ''}" data-skin="${s.id}">
              <div class="skin-swatch" style="background:${s.grad}"></div>
              <div class="skin-name">${s.name}</div>
              <div class="skin-tag">${s.premium ? '✨ Premium' : this.selectedSkin === s.id ? 'Equipped ✓' : 'Tap to equip'}</div>
            </div>`).join('')}
          </div>
        </div>`).join('');
    } else if (this.invTab === 'accessories') {
      const rarityColors: Record<string, string> = { common: '#6b7280', rare: '#3b82f6', epic: '#a855f7', legendary: '#f59e0b' };
      content = `<div class="accessories-intro muted" style="font-size:0.8rem;margin-bottom:10px;">🎮 Cosmetic-only — never affects gameplay. Earn via missions, events, and the star shop.</div>
        <div class="accessories-grid">${ACCESSORIES.map(a => {
          const eq = this.equippedAccessory === a.id;
          return `<div class="acc-card ${eq ? 'equipped' : ''}" data-acc="${a.id}">
            <div class="acc-icon">${a.icon}</div>
            <div class="acc-name">${a.name}</div>
            <div class="acc-slot" style="color:${rarityColors[a.rarity] ?? '#6b7280'}">${a.rarity}${a.seasonal ? ' · Seasonal' : ''}</div>
            <div class="acc-equip">${eq ? '✓ Equipped' : 'Tap to equip'}</div>
          </div>`;
        }).join('')}</div>`;
    } else if (this.invTab === 'powerups') {
      content = `<div class="list">${POWERUPS.map(p => `<div class="item-card"><div class="i-ico">${p.icon}</div><div><div class="i-name">${p.name}</div><div class="i-sub">${p.sub}</div></div><div class="i-val">${p.val}</div></div>`).join('')}
        <div class="muted" style="font-size:0.78rem;padding:6px 2px;">Boosts, Eggs, Chests & Trails collected in-match will appear here — full inventory storage is coming in a later update.</div></div>`;
    } else {
      const coupons = this.profile?.coupons || [];
      content = `<div class="list">${coupons.length ? coupons.map((c: any) => `<div class="row-card"><div class="r-ico">${c.icon || '🎟️'}</div><div class="r-body"><div class="r-title">${c.storeName}</div><div class="r-desc">${c.discountText} · <b>${c.promoCode}</b></div></div><button class="btn btn-ghost copy-btn" data-code="${c.promoCode}" style="padding:7px 10px;font-size:0.76rem;">Copy</button></div>`).join('') : '<div class="muted" style="text-align:center;padding:16px;">No coupons yet — grab a 🎁 box near a store in-match.</div>'}</div>`;
    }
    return `<div class="page"><div class="section-title">🎒 Inventory</div><div class="tabs">${tabs.map(([id, l]) => `<button class="tab ${this.invTab === id ? 'active' : ''}" data-inv="${id}">${l}</button>`).join('')}</div><div class="card">${content}</div></div>`;
  }

  // ---------- PROFILE (progression) ----------
  private pageProfile() {
    const p = this.profile; if (!p) return '<div class="page"><div class="card muted">Loading…</div></div>';
    const r = this.rank();
    const unlocked: string[] = p.unlockedEvolutions || ['Baby'];
    const kd = p.stats.matchesPlayed ? (p.stats.totalKills / Math.max(1, p.stats.matchesPlayed)).toFixed(1) : '0.0';
    const winRate = p.stats.matchesPlayed ? Math.round((p.stats.matchesWon / p.stats.matchesPlayed) * 100) : 0;
    return `
      <div class="page">
        <div class="card tint">
          <div style="display:flex;align-items:center;gap:14px;">
            <div class="friend"><div class="avatar" style="width:56px;height:56px;font-size:1.5rem;">${(p.displayName || 'E')[0]}</div></div>
            <div style="flex:1;">
              <div style="font-family:var(--font-title);font-weight:900;font-size:1.2rem;">${p.displayName}</div>
              <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:4px;">
                <span class="rank-badge" style="background:${r.color}22;border-color:${r.color}55;color:${r.color}">🏆 ${r.label}</span>
                <span class="rank-badge" style="background:#eef6f0;color:var(--ink)">Lvl ${p.level}${p.prestige ? ` ✨${p.prestige}` : ''}</span>
              </div>
            </div>
          </div>
          <div style="margin-top:12px;"><div class="progress" style="height:10px;"><div style="width:${Math.min(100, (p.xp / (p.xpToNext || 300)) * 100)}%"></div></div>
          <div class="xp-label muted" style="color:var(--muted)"><span>${p.xp} / ${p.xpToNext || 300} XP to Lv ${p.level + 1}</span><span>✨ ${p.evolutionXp} Evo-XP</span></div></div>
          ${p.level >= 1000 ? `<button class="btn btn-gold btn-block" id="prestige-btn" style="margin-top:10px;">👑 PRESTIGE (Reset level, keep everything)</button>` : ''}
        </div>

        <div class="card">
          <div class="section-title">🧬 Snake Evolution</div>
          <div class="evo-track-v2">
            ${EVO_LADDER.map((e, idx) => {
              const isUnlocked = unlocked.includes(e.name);
              const isEq = p.equippedEvolution === e.name;
              const evoXpPct = e.evoXpReq > 0 ? Math.min(100, Math.round((p.evolutionXp / e.evoXpReq) * 100)) : 100;
              return `<div class="evo-node-v2 ${isEq ? 'equipped' : ''} ${isUnlocked ? 'unlocked' : 'locked'}" ${isUnlocked ? `data-evo="${e.name}"` : ''}>
                <div class="evo-badge ${isEq ? 'active' : ''}">${isUnlocked ? (isEq ? '✓' : String(idx + 1)) : '🔒'}</div>
                <div class="evo-info">
                  <div class="evo-name">${e.name}</div>
                  <div class="evo-desc">${e.desc}</div>
                  <div class="evo-reqs">
                    <span class="evo-req-pill">🎯 ${e.scoreReq > 0 ? `${e.scoreReq} score` : 'Start'}</span>
                    <span class="evo-req-pill">✨ ${e.evoXpReq > 0 ? `${e.evoXpReq} Evo-XP` : 'None'}</span>
                  </div>
                  ${!isUnlocked && e.evoXpReq > 0 ? `<div class="progress" style="height:4px;margin-top:4px;"><div style="width:${evoXpPct}%"></div></div>` : ''}
                </div>
              </div>`;
            }).join('<div class="evo-connector"></div>')}
          </div>
          <div class="muted" style="font-size:0.76rem;margin-top:8px;">Score milestones unlock stages in-match · Evo-XP (from missions) unlocks permanent evolution forms · Tap an unlocked form to equip it.</div>
        </div>

        <div class="card">
          <div class="section-title">📊 Statistics</div>
          <div class="stat-grid">
            <div class="stat-cell"><div class="sv">${p.stats.matchesPlayed}</div><div class="sl">Matches</div></div>
            <div class="stat-cell"><div class="sv">${p.stats.matchesWon}</div><div class="sl">Wins</div></div>
            <div class="stat-cell"><div class="sv">${winRate}%</div><div class="sl">Win Rate</div></div>
            <div class="stat-cell"><div class="sv">${p.stats.totalKills}</div><div class="sl">Kills</div></div>
            <div class="stat-cell"><div class="sv">${kd}</div><div class="sl">K / Match</div></div>
            <div class="stat-cell"><div class="sv">${p.stats.highestScore}</div><div class="sl">Best Score</div></div>
            <div class="stat-cell"><div class="sv">${p.stats.cherriesCollected || 0}</div><div class="sl">Cherries</div></div>
            <div class="stat-cell"><div class="sv">${Math.round(p.stats.survivalTimeSeconds / 60)}m</div><div class="sl">Survived</div></div>
          </div>
        </div>
      </div>`;
  }

  // ---------- EVENTS ----------
  private pageEvents() {
    const events = [
      { icon: '🐍', name: 'Jungle Festival', desc: 'Double stars all weekend', time: '2 days left', on: true },
      { icon: '🌧️', name: 'Monsoon Rush', desc: 'Frog & star spawns tripled', time: 'Live now', on: true },
      { icon: '🎃', name: 'Halloween Hunt', desc: 'Pumpkin skins & spooky map', time: 'In 3 weeks', on: false },
      { icon: '🎄', name: 'Winter Wonderland', desc: 'Snow map + gift chests', time: 'Seasonal', on: false },
    ];
    return `<div class="page"><div class="section-title">🎪 Events</div>
      <div class="list">${events.map(e => `<div class="row-card"><div class="r-ico">${e.icon}</div><div class="r-body"><div class="r-title">${e.name}</div><div class="r-desc">${e.desc}</div></div><span class="pill ${e.on ? 'gold' : 'done'}">${e.time}</span></div>`).join('')}</div>
      <div class="muted" style="font-size:0.78rem;">Seasonal maps and live world events rotate automatically. More on the roadmap.</div></div>`;
  }

  // ---------- SOCIAL ----------
  private pageSocial() {
    const friends = [{ n: 'Ashraf', on: true }, { n: 'Rahul', on: true }, { n: 'David', on: true }, { n: 'Meera', on: false }, { n: 'Chen', on: false }];
    return `<div class="page"><div class="section-title">👥 Friends</div>
      <div class="card"><div class="list">${friends.map(f => `<div class="friend"><div class="avatar">${f.n[0]}</div><div style="flex:1;"><div style="font-weight:700;font-size:0.9rem;">${f.n}</div><div class="muted" style="font-size:0.72rem;">${f.on ? 'Online' : 'Offline'}</div></div><div class="dot ${f.on ? '' : 'off'}"></div></div>`).join('')}</div></div>
      <button class="btn btn-primary btn-block">➕ Invite to Team</button>
      <div class="muted" style="font-size:0.78rem;">Parties, team invites and in-match chat are on the roadmap (this is a preview).</div></div>`;
  }

  // ---------- REWARDS MARKETPLACE (§15) ----------
  private async loadRewards() {
    try {
      const res = await fetch(`${API}/api/rewards/catalog?region=${encodeURIComponent(this.rewardRegion)}`);
      const data = await res.json();
      this.rewards = data.items || [];
    } catch { this.rewards = []; }
    if (this.page === 'rewards') this.render();
  }

  private async redeemReward(itemId: string) {
    audio.playClick();
    try {
      const res = await fetch(`${API}/api/rewards/redeem`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.token}` },
        body: JSON.stringify({ itemId, region: this.rewardRegion }),
      });
      const data = await res.json();
      if (data.success) {
        if (data.profile) { this.profile = data.profile; this.persistSession(); }
        audio.playFanfare();
        this.showToast(`🎁 ${data.message}`);
        await this.loadRewards();
      } else {
        this.showToast(`❌ ${data.message || 'Redeem failed'}`);
      }
    } catch { this.showToast('❌ Redeem failed'); }
    this.render();
  }

  private pageRewards() {
    const regions = ['Global', 'USA', 'Europe', 'India', 'Brazil'];
    const vouchers = (this.profile?.coupons || []).filter((c: any) => String(c.id).startsWith('rdm_'));
    return `
      <div class="page">
        <div class="section-title">🎁 Rewards Marketplace</div>
        <div class="card">
          <div class="muted" style="font-size:0.8rem;margin-bottom:8px;">Redeem ⭐ Stars for digital rewards. Availability, price &amp; stock vary by region. Gift cards &amp; branded rewards are fulfilled only through approved providers.</div>
          <div class="seg" style="flex-wrap:wrap;gap:6px;">
            ${regions.map(r => `<button class="${this.rewardRegion === r ? 'active' : ''}" data-rwregion="${r}">${r}</button>`).join('')}
          </div>
        </div>
        <div class="list">
          ${this.rewards.length ? this.rewards.map((it: any) => this.rewardRow(it)).join('') : '<div class="muted" style="text-align:center;padding:16px;">Loading rewards…</div>'}
        </div>
        ${vouchers.length ? `<div class="section-title" style="margin-top:8px;">🎟️ My Vouchers</div><div class="list">${vouchers.map((c: any) => `<div class="row-card"><div class="r-ico">${c.icon || '🎟️'}</div><div class="r-body"><div class="r-title">${c.storeName}</div><div class="r-desc">${c.discountText} · <b>${c.promoCode}</b></div></div><button class="btn btn-ghost copy-btn" data-code="${c.promoCode}" style="padding:7px 10px;font-size:0.76rem;">Copy</button></div>`).join('')}</div>` : ''}
      </div>`;
  }

  private rewardRow(it: any) {
    const stars = this.profile?.stars ?? 0;
    const canAfford = stars >= it.starCost;
    const disabled = !it.available || it.soldOut || !canAfford;
    const tag = it.soldOut ? 'Sold out' : !it.available ? 'Region locked' : it.stock < 0 ? 'In stock' : `${it.stock} left`;
    return `<div class="row-card"><div class="r-ico">${it.icon}</div><div class="r-body">
      <div class="r-title">${it.title} <span class="pill ${it.soldOut || !it.available ? 'done' : 'gold'}">${tag}</span></div>
      <div class="r-desc">${it.description} · <i>${it.provider}</i></div>
      <div class="r-count">⭐ ${it.starCost}${it.minLevel > 1 ? ` · Lvl ${it.minLevel}+` : ''}${!canAfford && it.available && !it.soldOut ? ' · not enough ⭐' : ''}</div>
      </div><button class="btn ${disabled ? 'btn-ghost' : 'btn-gold'} redeem-btn" data-reward="${it.id}" ${disabled ? 'disabled' : ''} style="padding:8px 12px;font-size:0.78rem;">${it.soldOut ? '—' : 'Redeem'}</button></div>`;
  }

  // ---------- SETTINGS ----------
  private pageSettings() {
    const sw = (on: boolean, key: string) => `<button class="switch ${on ? 'on' : ''}" data-set="${key}"></button>`;
    return `<div class="page"><div class="section-title">⚙️ Settings</div>
      <div class="card"><div class="section-title" style="font-size:0.9rem;">🔊 Audio</div>
        <div class="toggle"><span class="t-label">Sound Effects</span>${sw(this.settings.sfx, 'sfx')}</div>
        <div class="toggle"><span class="t-label">Music</span>${sw(this.settings.music, 'music')}</div>
      </div>
      <div class="card"><div class="section-title" style="font-size:0.9rem;">🎮 Controls</div>
        <div class="toggle"><span class="t-label">Control Side (touch)</span><button class="btn btn-ghost" id="side-btn" style="padding:6px 14px;font-size:0.8rem;">${this.settings.controlSide === 'right' ? 'Right-handed' : 'Left-handed'}</button></div>
        <div class="muted" style="font-size:0.76rem;padding-top:8px;">PC: Mouse or WASD to steer · Shift to boost · Space for ability.</div>
      </div>
      <div class="card"><div class="section-title" style="font-size:0.9rem;">♿ Accessibility</div>
        <div class="toggle"><span class="t-label">Large Text</span>${sw(this.settings.largeText, 'largeText')}</div>
        <div class="toggle"><span class="t-label">High Contrast</span>${sw(this.settings.highContrast, 'highContrast')}</div>
        <div class="toggle"><span class="t-label">Reduce Motion</span>${sw(this.settings.reduceMotion, 'reduceMotion')}</div>
      </div>
      <button class="btn btn-ghost btn-block" data-go="home">← Back to Home</button></div>`;
  }

  // ---------- GAME OVERLAYS ----------
  private renderMatchmaking() {
    const mm = MODE_META[this.selectedMode];
    const where = this.matchType === 'local' ? '📍 Local region' : this.selectedRegion;
    return `<div class="overlay"><div class="modal" style="text-align:center;"><div class="section-title" style="justify-content:center;">${mm.icon} ${mm.name}</div>
      <div class="countdown-num" id="mm-count">3</div><div class="muted">${where} · connecting to the 30 Hz world…</div>
      <div class="chip" style="margin-top:14px;">💡 Eat 🍒 to heal · grab 🛡️ & ⚡ power-ups</div></div></div>`;
  }

  private renderHUD() {
    const lh = this.settings.controlSide === 'left' ? ' left-handed' : '';
    return `<div class="hud${lh}">
      <div class="hud-tl hud-panel">
        <button id="nav-pause" class="hud-pause">⏸</button>
        <div class="hud-tl-main">
          <div class="hud-scoreline"><span class="hud-score" id="hv-score">0</span><span class="hud-stage" id="hud-stage">Baby · Lv 1</span></div>
          <div class="hud-hp"><span class="hud-hp-fill" id="hs-health" style="width:100%"></span><span class="hud-hp-txt" id="hv-health">100</span></div>
        </div>
      </div>
      <div class="hud-event hud-panel" id="hud-event" style="display:none;"></div>
      <div class="team-scores" id="team-scores" style="display:none;"></div>
      <div class="hud-leaderboard hud-panel"><h4>🏆 Top 5</h4><div id="hud-lb-rows"></div></div>
      <div class="ability-badge hud-panel ready" id="ability-badge">🌀 <span class="cd" id="ability-cd">READY</span></div>
      <div class="touch-joystick" id="touch-joystick"><div class="touch-knob" id="touch-knob"></div></div>
      <div class="touch-actions">
        <div class="touch-row">
          <div class="touch-btn mini" id="touch-mini" title="Toggle HUD / minimap">🗺️</div>
          <div class="touch-btn zoom" id="touch-zoom" title="Zoom">🔍<span class="tz-label" id="touch-zoom-label">Normal</span></div>
        </div>
        <div class="touch-row">
          <div class="touch-btn ability" id="touch-ability" title="Ability / Shield">🌀</div>
          <div class="touch-btn boost" id="touch-boost" title="Boost">⚡</div>
        </div>
      </div>
    </div>`;
  }

  private renderPause() {
    return `<div class="overlay"><div class="modal" style="text-align:center;max-width:380px;"><div class="section-title" style="justify-content:center;">⏸️ Paused</div>
      <div style="display:flex;flex-direction:column;gap:10px;"><button id="btn-resume" class="btn btn-primary btn-block">▶️ Resume</button>
      <button id="btn-leave" class="btn btn-danger btn-block">🚪 Leave Match</button></div></div></div>`;
  }

  private renderRespawn() {
    const stars = this.profile?.stars ?? 0; const tickets = this.profile?.tickets ?? 0;
    return `<div class="overlay"><div class="modal"><div class="section-title" style="justify-content:center;color:var(--danger);">💀 You Were Defeated!</div>
      <div class="respawn-grid">
        <button class="respawn-opt green" id="rs-stars" ${stars < 20 ? 'disabled' : ''}><span class="ro-ico">🌱</span><span><span class="ro-main">Respawn (20 ⭐)</span><br><span class="ro-sub">Use Stars${stars < 20 ? ' — not enough' : ''}</span></span></button>
        <button class="respawn-opt gold" id="rs-ad"><span class="ro-ico">📺</span><span><span class="ro-main">Respawn (Watch Ad)</span><br><span class="ro-sub">Free Respawn</span></span></button>
        <button class="respawn-opt blue" id="respawn-wait-btn" disabled><span class="ro-ico">⏳</span><span><span class="ro-main">Wait to Respawn</span><br><span class="ro-sub" id="respawn-wait">${this.respawnWait}s</span></span></button>
        <button class="respawn-opt gray" id="rs-ticket" ${tickets < 1 ? 'disabled' : ''}><span class="ro-ico">🎟️</span><span><span class="ro-main">Use Ticket (${tickets})</span><br><span class="ro-sub">Instant Respawn</span></span></button>
      </div>
      <button id="rs-end" class="btn btn-ghost btn-block" style="margin-top:12px;">🏁 End Match & See Results</button></div></div>`;
  }

  private renderGameover() {
    const s = this.summary || { score: 0, kills: 0, placement: 5, survival: 0, earnedStars: 0, earnedXP: 0, earnedEvoXP: 0 };
    const mins = Math.floor(s.survival / 60), secs = s.survival % 60;
    return `<div class="overlay"><div class="modal" style="text-align:center;max-width:500px;">
      <h1 style="color:var(--danger);">GAME OVER</h1><div class="muted">${MODE_META[this.selectedMode].name}</div>
      <div class="summary-grid">
        <div class="summary-cell"><div class="sc-label">Placement</div><div class="sc-val" style="color:var(--green-deep);">#${s.placement}</div></div>
        <div class="summary-cell"><div class="sc-label">Score</div><div class="sc-val" style="color:var(--gold-deep);">${s.score}</div></div>
        <div class="summary-cell"><div class="sc-label">Kills</div><div class="sc-val">⚔️ ${s.kills}</div></div>
        <div class="summary-cell"><div class="sc-label">Survived</div><div class="sc-val">${mins}:${String(secs).padStart(2, '0')}</div></div>
      </div>
      <div class="chip" style="margin-bottom:14px;">⭐ ${s.earnedStars} · ✨ ${s.earnedXP} XP · 🧬 ${s.earnedEvoXP} Evo${s.levelsGained ? ` · 🎉 +${s.levelsGained} Level` : ''}</div>
      <div style="display:flex;flex-direction:column;gap:10px;">
        <button id="go-ad" class="btn btn-gold btn-block">📺 Watch Ad · 2× Rewards</button>
        <div style="display:flex;gap:10px;"><button id="go-again" class="btn btn-primary" style="flex:1;">🔄 Play Again</button><button id="go-home" class="btn btn-ghost" style="flex:1;">🏠 Home</button></div>
      </div></div></div>`;
  }

  private renderAd() {
    return `<div class="overlay"><div class="modal" style="text-align:center;max-width:460px;"><div class="chip" style="margin-bottom:10px;">SPONSORED</div>
      <div class="section-title" style="justify-content:center;">🌟 Anaconda Park VIP</div>
      <div style="background:var(--card-2);border:1px solid var(--line);border-radius:16px;height:170px;display:grid;place-items:center;margin:12px 0;">
        <div><div style="font-size:3rem;">🐍🔥</div><div style="color:var(--gold-deep);font-weight:800;">Legend Skins & 3× Boosters!</div>
        <div class="muted" style="margin-top:6px;">Ad ends in <b id="ad-count">${this.adTimer}</b>s</div></div></div>
      <div class="muted" style="font-size:0.8rem;">Reward applies automatically…</div></div></div>`;
  }

  // ------------------------------------------------------------- bind
  private bind() {
    const on = (id: string, fn: () => void) => document.getElementById(id)?.addEventListener('click', fn);
    document.querySelectorAll('[data-go]').forEach(b => b.addEventListener('click', () => this.go((b as HTMLElement).dataset.go as Page)));
    document.querySelectorAll('[data-mcat]').forEach(b => b.addEventListener('click', () => { this.missionCat = (b as HTMLElement).dataset.mcat as any; audio.playClick(); this.render(); }));
    document.querySelectorAll('[data-inv]').forEach(b => b.addEventListener('click', () => { this.invTab = (b as HTMLElement).dataset.inv as any; audio.playClick(); this.render(); }));
    document.querySelectorAll('[data-mode]').forEach(b => b.addEventListener('click', () => { audio.playClick(); this.selectedMode = (b as HTMLElement).dataset.mode as GameMode; this.render(); }));
    document.querySelectorAll('[data-mt]').forEach(b => b.addEventListener('click', () => { this.matchType = (b as HTMLElement).dataset.mt as any; audio.playClick(); this.render(); }));
    document.querySelectorAll('[data-region]').forEach(b => b.addEventListener('click', () => { this.selectedRegion = (b as HTMLElement).dataset.region!; audio.playClick(); this.render(); }));
    document.querySelectorAll('[data-skin]').forEach(b => b.addEventListener('click', () => this.equipSkin((b as HTMLElement).dataset.skin!)));
    document.querySelectorAll('[data-evo]').forEach(b => b.addEventListener('click', () => this.equipEvolution((b as HTMLElement).dataset.evo!)));
    document.querySelectorAll('[data-acc]').forEach(b => b.addEventListener('click', () => this.equipAccessory((b as HTMLElement).dataset.acc!)));
    document.querySelectorAll('.claim-btn').forEach(b => b.addEventListener('click', () => this.claimMission((b as HTMLElement).dataset.id!)));
    document.querySelectorAll('.copy-btn').forEach(b => b.addEventListener('click', (e) => { const c = (e.currentTarget as HTMLElement).dataset.code!; navigator.clipboard?.writeText(c); this.showToast(`📋 Copied ${c}`); }));
    document.querySelectorAll('[data-rwregion]').forEach(b => b.addEventListener('click', () => { this.rewardRegion = (b as HTMLElement).dataset.rwregion!; audio.playClick(); this.render(); this.loadRewards(); }));
    document.querySelectorAll('.redeem-btn').forEach(b => b.addEventListener('click', () => this.redeemReward((b as HTMLElement).dataset.reward!)));
    document.querySelectorAll('[data-set]').forEach(b => b.addEventListener('click', () => this.toggleSetting((b as HTMLElement).dataset.set as keyof Settings)));

    on('music-toggle', () => this.toggleMusic());
    on('quick-match', () => this.startMatchmaking());
    on('enter-btn', () => this.startMatchmaking());
    on('prestige-btn', () => this.doPrestige());
    on('side-btn', () => { this.settings.controlSide = this.settings.controlSide === 'right' ? 'left' : 'right'; this.saveSettings(); this.render(); });

    on('nav-pause', () => this.togglePause());
    on('btn-resume', () => this.togglePause());
    on('btn-leave', () => this.abandon());
    on('rs-stars', () => this.doRespawn('stars')); on('rs-ad', () => this.doRespawn('ad')); on('respawn-wait-btn', () => this.doRespawn('wait')); on('rs-ticket', () => this.doRespawn('ticket'));
    on('rs-end', () => this.endMatch());
    on('go-ad', () => this.triggerAd(async () => { try { const r = await fetch(API + '/api/ads/claim', { method: 'POST', headers: { Authorization: `Bearer ${this.token}` } }); const d = await r.json(); if (d.profile) this.profile = d.profile; this.showToast(`🎉 ${d.message}`); } catch { /* */ } this.setScreen('gameover'); }));
    on('go-again', () => this.startMatchmaking());
    on('go-home', () => { this.refreshProfile(); this.page = 'home'; this.setScreen('app'); });
  }

  private toggleSetting(key: keyof Settings) {
    audio.playClick();
    if (key === 'controlSide') return;
    (this.settings as any)[key] = !(this.settings as any)[key];
    this.saveSettings(); this.render();
  }

  private showToast(msg: string) {
    document.getElementById('toast')?.remove();
    const t = document.createElement('div'); t.id = 'toast'; t.className = 'toast'; t.innerText = msg;
    document.body.appendChild(t); setTimeout(() => t.remove(), 2200);
  }
  private showLevelUp(level: number) {
    const el = document.createElement('div'); el.className = 'levelup'; el.innerHTML = `🎉 LEVEL UP!<br><span style="font-size:1.6rem;">Level ${level}</span>`;
    document.body.appendChild(el); setTimeout(() => el.remove(), 2600);
  }
}

new AnacondaPark();
