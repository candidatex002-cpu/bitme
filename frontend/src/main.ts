import { GameClient, GameMode, GameStateTick, SnakeData, serverBase, hasConfiguredServer, applyPowerConfig, WORLD } from './game/GameClient.js';
import { Renderer } from './game/Renderer.js';
import { audio } from './game/AudioSystem.js';
import { ads } from './game/AdService.js';
import * as story from './game/story.js';
import { icons } from './game/ui/icons.js';

const API = serverBase();

type Screen = 'app' | 'matchmaking' | 'play' | 'pause' | 'respawn' | 'gameover' | 'ad-reward';
type Page = 'home' | 'play' | 'missions' | 'inventory' | 'profile' | 'events' | 'social' | 'settings' | 'rewards' | 'story' | 'leaderboard' | 'stats' | 'history' | 'admin';

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

// 8-stage evolution ladder — driven by score milestones + Evo XP (not physical length)
const EVO_LADDER: Array<{ name: string; scoreReq: number; evoXpReq: number; desc: string }> = [
  { name: 'Baby',   scoreReq: 0,    evoXpReq: 0,     desc: 'Hatchling' },
  { name: 'Young',  scoreReq: 500,  evoXpReq: 500,   desc: 'Growing fast' },
  { name: 'Teen',   scoreReq: 1000, evoXpReq: 1000,  desc: 'Finding strength' },
  { name: 'Adult',  scoreReq: 1500, evoXpReq: 2500,  desc: 'Formidable force' },
  { name: 'Elite',  scoreReq: 2000, evoXpReq: 8000,  desc: 'Apex predator' },
  { name: 'Titan',  scoreReq: 2500, evoXpReq: 20000, desc: 'Colossal serpent' },
  { name: 'Legend', scoreReq: 3000, evoXpReq: 40000, desc: '✨ Prestige I required' },
  { name: 'King',   scoreReq: 3500, evoXpReq: 80000, desc: '👑 Final stage — Prestige II' },
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

// §2 Six game modes, each with its own rules. `backend` maps to the authoritative GameMode.
type UIMode = 'free_roam' | 'explorer' | 'battle_royale' | 'team' | 'nokia' | 'event';
interface UIModeDef { icon: string; name: string; tag: string; rules: string; backend: GameMode; enabled: boolean; solo?: boolean; story?: boolean; timed?: boolean; }
const UI_MODES: Record<UIMode, UIModeDef> = {
  free_roam:     { icon: '🌿', name: 'Free Roam',     tag: 'Multiplayer · Infinite', rules: 'Explore an endless world, complete missions, collect stars and outgrow rivals. No timer.', backend: 'classic', enabled: true },
  explorer:      { icon: '📜', name: 'Explorer',      tag: 'Story Mode',             rules: 'The main story. Restore the Seven Kingdoms and chase quest goals as you play.', backend: 'classic', enabled: true, story: true },
  battle_royale: { icon: '⚔️', name: 'Battle Royale', tag: 'Last Snake Standing',    rules: 'A timed match with a shrinking safe zone. Survive the storm — last snake standing wins.', backend: 'battle_royale', enabled: true, timed: true },
  team:          { icon: '🛡️', name: 'Team Battle',   tag: 'Red vs Blue',            rules: 'Join a team and fight for the highest combined team score.', backend: 'team', enabled: true },
  nokia:         { icon: '🕹️', name: 'Classic Snake', tag: 'Nokia · Solo',           rules: 'The nostalgic grid snake — eat, grow, avoid the walls and yourself. Solo high score.', backend: 'classic', enabled: true, solo: true },
  event:         { icon: '🎪', name: 'Event Mode',    tag: 'Live Events Only',       rules: 'Special limited-time events, enabled by the server during live events.', backend: 'event', enabled: false },
};
const UI_MODE_ORDER: UIMode[] = ['free_roam', 'explorer', 'battle_royale', 'team', 'nokia', 'event'];

const REGIONS = ['🌍 Quick Match', '🇮🇳 India', '🇺🇸 USA', '🇯🇵 Japan', '🇧🇷 Brazil', '🇪🇺 Europe', '🇦🇺 Australia'];

// §5 interactive tutorial (how-to-play walkthrough)
const TUTORIAL_SLIDES = [
  { icon: '🕹️', title: 'Move', text: 'Drag the joystick (bottom-left) to steer. On desktop use the mouse or WASD.' },
  { icon: '⚡', title: 'Boost', text: 'Push the joystick to its edge — or hold Shift / the ⚡ button — to dash. Boosting spends a little score.' },
  { icon: '🍒', title: 'Eat & Grow', text: 'Collect cherries, apples and frogs to score and grow. Growth is gentle so the field stays readable.' },
  { icon: '⭐', title: 'Star Fragments', text: 'Chase the drifting stars — they flee, but you are faster. Spend stars on skins, respawns and rewards.' },
  { icon: '⚔️', title: 'Combat', text: 'Only HEAD-to-HEAD hits eliminate a snake — the higher score wins. Body contact is safe. 🛡️ Shield and 🍄 Super make you briefly invincible.' },
  { icon: '🗺️', title: 'The World', text: 'The map wraps around — leave one edge, appear on the other. The minimap shows the sanctuary and wormholes.' },
  { icon: '🌀', title: 'Wormholes & Sanctuary', text: 'Enter a wormhole to escape to a linked one. Rest in the green Safe Sanctuary — no PvP, and you heal.' },
  { icon: '🎁', title: 'Missions & Rewards', text: 'Finish story quests for XP and stars, then redeem stars in the Rewards marketplace. Now — go reclaim the crown!' },
];

// §7 Local Explorer — Country → State → City hierarchy for local matchmaking.
const LOCATIONS: Record<string, Record<string, string[]>> = {
  'India': { 'Tamil Nadu': ['Chennai', 'Coimbatore', 'Madurai'], 'Maharashtra': ['Mumbai', 'Pune'], 'Karnataka': ['Bengaluru', 'Mysuru'], 'Delhi': ['New Delhi'] },
  'United States': { 'California': ['Los Angeles', 'San Francisco'], 'New York': ['New York City', 'Buffalo'], 'Texas': ['Austin', 'Dallas'] },
  'United Kingdom': { 'England': ['London', 'Manchester'], 'Scotland': ['Edinburgh', 'Glasgow'] },
  'Brazil': { 'São Paulo': ['São Paulo', 'Campinas'], 'Rio de Janeiro': ['Rio de Janeiro'] },
  'Japan': { 'Tokyo': ['Tokyo'], 'Osaka': ['Osaka'] },
  'Germany': { 'Bavaria': ['Munich'], 'Berlin': ['Berlin'] },
  'Australia': { 'New South Wales': ['Sydney'], 'Victoria': ['Melbourne'] },
};

// §5 onboarding options
const ONB_COUNTRIES = ['India', 'United States', 'United Kingdom', 'Brazil', 'Japan', 'Germany', 'France', 'Australia', 'Canada', 'Nigeria', 'Indonesia', 'Other'];
const ONB_LANGUAGES = ['English', 'हिन्दी', 'Español', 'Português', '日本語', 'Deutsch', 'Français', 'Bahasa', 'العربية', '中文'];
const ONB_AVATARS = ['🐍', '🐲', '🦎', '🐢', '🦊', '🦉', '🐸', '🐝'];

const LANDMARKS = [
  { name: 'Starbucks', x: 665, y: 1445 }, { name: 'Pizza Hut', x: 2265, y: 1445 },
  { name: 'Park Cafe', x: 1465, y: 645 }, { name: 'Hospital', x: 565, y: 2345 },
  { name: 'College', x: 2365, y: 2245 }, { name: 'Bridge', x: 1565, y: 2445 },
];

const HAT_ICONS: Record<string, string> = {
  crown: '👑', pirate: '🏴‍☠️', viking: '🪓', cowboy: '🤠', santa: '🎅',
  graduation: '🎓', chef: '🧑‍🍳', samurai: '⚔️', wizard: '🧙', police: '👮',
};

interface Settings {
  sfx: boolean;
  music: boolean;
  largeText: boolean;
  reduceMotion: boolean;
  highContrast: boolean;
  controlSide?: 'right' | 'left';
  controlPos: 'left' | 'center' | 'right';
  joySize?: 'small' | 'medium' | 'large';
  joyOpacity?: number;
  joyDeadZone?: number;
  joySensitivity?: number;
  cameraPreset?: 'near' | 'medium' | 'far' | 'ultra_wide';
  missionTracker?: boolean;
  trackerPos?: 'left' | 'right';
}

class AnacondaPark {
  private root: HTMLElement;
  private client = new GameClient();
  private renderer: Renderer | null = null;

  private token = '';
  private profile: any = null;
  private missions: any[] = [];
  private achievements: any[] = [];
  private leaderboard: any[] = [];

  private showKillToast(msg: string) {
    const el = document.createElement('div');
    el.className = 'kill-toast-pop';
    el.innerText = msg;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 1200);
  }

  private screen: Screen = 'app';
  private page: Page = 'home';
  private missionCat: 'daily' | 'weekly' | 'event' | 'achievements' = 'daily';
  private invTab: 'skins' | 'accessories' | 'powerups' | 'coupons' = 'skins';

  private selectedUIMode: UIMode = 'free_roam';
  private get modeDef(): UIModeDef { return UI_MODES[this.selectedUIMode]; }
  private selectedSkin = 'Forest';
  private equippedAccessory = '';
  private matchType: 'global' | 'local' = 'global';
  private selectedRegion = '🌍 Quick Match';
  // §7 Local Explorer location
  private localCountry = ''; private localState = ''; private localCity = '';
  private globalPing = 0;
  private globalPingState: 'idle' | 'measuring' | 'ok' | 'offline' = 'idle';
  private globalServerLabel = 'Best available server';

  // §15 Rewards marketplace
  private rewards: any[] = [];
  private rewardRegion = 'Global';
  // §7 Server-driven coupons the player can claim into their inventory
  private availableCoupons: any[] = [];
  // §12 Server gameplay config (reward formula, XP curve, evolution ladder) — mirrors backend
  private serverConfig: any = null;

  // Story — "The Legend of the Lost Crown"
  private legendIdx = 0;

  // §5 Onboarding
  private onboardName = '';
  private onboardAvatar = '🐍';
  private usernameState: { status: 'idle' | 'checking' | 'ok' | 'bad'; reason?: string; suggestions?: string[] } = { status: 'idle' };
  private usernameTimer: any = null;
  // §8 Server-driven social graph (loaded from /api/social/overview)
  private social: { friends: any[]; incoming: any[]; outgoing: any[]; blocked: any[]; myFriendCode?: string } = { friends: [], incoming: [], outgoing: [], blocked: [] };
  private isEditingProfile = false;
  private editingAvatar = '🐍';

  private settings: Settings = { sfx: true, music: true, largeText: false, reduceMotion: false, highContrast: false, controlPos: 'right', missionTracker: true, trackerPos: 'left' };

  // input
  private angle = 0; private boosting = false; private keys: Record<string, boolean> = {};
  private keyBoost = false; private joyBoost = false; // boost sources (keyboard/mouse/button vs joystick edge)
  private sendTimer: any = null; private joyActive = false;
  // §4 fixed joystick + §5 pinch-zoom touch tracking
  private joyId: number | null = null;
  private joyCenter = { x: 0, y: 0 };
  private readonly joyRadius = 52;
  private pinchDist = 0;

  // match state
  private matchStart = 0; private lastAlive = true; private lastSnake: SnakeData | null = null;
  private lastState: GameStateTick | null = null; private visitedAreas = new Set<string>(); private summary: any = null;
  // §V7 per-match counters (drive the live mission tracker + the summary payload)
  private matchStats = { cherry: 0, apple: 0, frog: 0, star: 0, mushroom: 0, shield: 0, speed: 0, powerup: 0, kills: 0, deaths: 0 };
  private lastKills = 0;
  private liveMissionDone = new Set<string>(); // missions already celebrated this match
  private activeMapTheme = 'forest'; // §8 theme id applied to the current match
  private adTimer = 5; private adInterval: any = null; private respawnWait = 0; private respawnInterval: any = null;
  private lastHp = 100; private hpVisibleUntil = 0; // §3 health bar show-on-damage

  constructor() {
    this.root = document.getElementById('app')!;
    this.loadSettings();
    this.client.onPickupEvent = (e) => {
      if (e.updatedMissions) this.missions = e.updatedMissions;
      if (e.profile) this.profile = e.profile;
      this.updateMissionTracker();
    };
    this.render();
    // §5 First-time users go through onboarding (which creates their named account);
    // returning users (or anyone with an existing cached session) restore directly.
    if (!localStorage.getItem('ap_onboarded') && localStorage.getItem('ap_profile_cache')) localStorage.setItem('ap_onboarded', '1');
    if (localStorage.getItem('ap_onboarded')) this.initGuest();
    else this.showOnboarding();
    window.addEventListener('resize', () => this.renderer?.resize());
    // Also track the visual viewport (URL bar hide/show on mobile)
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', () => this.renderer?.resize());
    }
    window.addEventListener('keydown', (e) => { if (e.code === 'Escape' && (this.screen === 'play' || this.screen === 'pause')) this.togglePause(); });
    this.bindLifecycle();
    // Browsers block audio until the user interacts — kick off the Home music on the
    // very first tap/click/keypress (idempotent; no-ops if music is turned off).
    ['pointerdown', 'keydown', 'touchstart'].forEach(ev => window.addEventListener(ev, () => audio.ensureMusic(), { passive: true }));
    // §14 To enable real ads: install @capacitor-community/admob, then at startup:
    //   import { AdMob } from '@capacitor-community/admob';
    //   ads.attachPlugin(AdMob);
    //   ads.configure({ enabled: true, testMode: false, appId: 'ca-app-pub-XXXX~YYYY',
    //     units: { rewarded: '…', interstitial: '…', banner: '…', appOpen: '…' } });
    // Until then every ad call is a no-op / the built-in simulated reward modal.
    if (localStorage.getItem('ap_onboarded')) this.maybeShowLegend(); // onboarding chains its own legend
  }

  // ---------- §5 FIRST-TIME ONBOARDING ----------
  private showOnboarding() {
    document.getElementById('onb-overlay')?.remove();
    const el = document.createElement('div');
    el.id = 'onb-overlay';
    el.className = 'onb-overlay';
    el.innerHTML = `
      <div class="onb-card">
        <div class="onb-logo">🐍</div>
        <div class="onb-title">Welcome to Anaconda Park</div>
        <div class="onb-sub">Create your explorer to begin the legend of the Lost Crown.</div>

        <label class="onb-label">Player Name</label>
        <input id="onb-name" class="onb-input" maxlength="16" autocomplete="off" placeholder="Choose a unique name" />
        <div id="onb-uname" class="onb-uname"></div>
        <div id="onb-suggest" class="onb-suggest"></div>

        <label class="onb-label">Choose an Avatar</label>
        <div class="onb-avatars">${ONB_AVATARS.map(a => `<button class="onb-av ${this.onboardAvatar === a ? 'sel' : ''}" data-onbav="${a}">${a}</button>`).join('')}</div>

        <div class="onb-row">
          <div><label class="onb-label">Country</label><select id="onb-country" class="onb-input">${ONB_COUNTRIES.map(c => `<option>${c}</option>`).join('')}</select></div>
          <div><label class="onb-label">Language</label><select id="onb-lang" class="onb-input">${ONB_LANGUAGES.map(l => `<option>${l}</option>`).join('')}</select></div>
        </div>

        <button class="btn btn-primary btn-block onb-submit" id="onb-submit" disabled>🥚 Begin your journey</button>
        <div class="onb-legal muted">Optional details help us match you locally. Your name is your unique identifier; a display name can be changed later.</div>
      </div>`;
    document.body.appendChild(el);
    audio.ensureMusic();

    const nameInput = document.getElementById('onb-name') as HTMLInputElement;
    nameInput?.addEventListener('input', () => { this.onboardName = nameInput.value.trim(); this.checkUsernameDebounced(); });
    document.querySelectorAll('[data-onbav]').forEach(b => b.addEventListener('click', () => {
      this.onboardAvatar = (b as HTMLElement).dataset.onbav!;
      document.querySelectorAll('.onb-av').forEach(a => a.classList.toggle('sel', a === b));
    }));
    document.getElementById('onb-submit')?.addEventListener('click', () => this.submitOnboarding());
    setTimeout(() => nameInput?.focus(), 100);
  }

  private checkUsernameDebounced() {
    if (this.usernameTimer) clearTimeout(this.usernameTimer);
    const name = this.onboardName;
    const unameEl = document.getElementById('onb-uname');
    const submit = document.getElementById('onb-submit') as HTMLButtonElement | null;
    if (submit) submit.disabled = true;
    if (name.length < 3) { this.usernameState = { status: 'idle' }; if (unameEl) unameEl.className = 'onb-uname'; if (unameEl) unameEl.innerText = ''; this.renderSuggestions([]); return; }
    this.usernameState = { status: 'checking' };
    if (unameEl) { unameEl.className = 'onb-uname checking'; unameEl.innerText = 'Checking availability…'; }
    this.usernameTimer = setTimeout(async () => {
      try {
        const res = await this.api(`/api/auth/username-check?name=${encodeURIComponent(name)}`);
        const d = await res.json();
        if (name !== this.onboardName) return; // stale
        if (d.available) {
          this.usernameState = { status: 'ok' };
          if (unameEl) { unameEl.className = 'onb-uname ok'; unameEl.innerText = '✓ Available'; }
          this.renderSuggestions([]);
          if (submit) submit.disabled = false;
        } else {
          this.usernameState = { status: 'bad', reason: d.reason, suggestions: d.suggestions };
          if (unameEl) { unameEl.className = 'onb-uname bad'; unameEl.innerText = `✕ ${d.reason || 'Unavailable'}`; }
          this.renderSuggestions(d.suggestions || []);
        }
      } catch {
        // Offline / no server — allow the name locally (deployed build has no auth server).
        if (name !== this.onboardName) return;
        this.usernameState = { status: 'ok' };
        if (unameEl) { unameEl.className = 'onb-uname ok'; unameEl.innerText = '✓ Available'; }
        this.renderSuggestions([]);
        if (submit) submit.disabled = false;
      }
    }, 400);
  }

  private renderSuggestions(suggestions: string[]) {
    const el = document.getElementById('onb-suggest');
    if (!el) return;
    el.innerHTML = suggestions.length ? `Try: ${suggestions.map(s => `<button class="onb-sg" data-sg="${s}">${s}</button>`).join('')}` : '';
    el.querySelectorAll('[data-sg]').forEach(b => b.addEventListener('click', () => {
      const s = (b as HTMLElement).dataset.sg!;
      const input = document.getElementById('onb-name') as HTMLInputElement;
      if (input) { input.value = s; this.onboardName = s; this.checkUsernameDebounced(); input.focus(); }
    }));
  }

  private async submitOnboarding() {
    if (this.usernameState.status !== 'ok') return;
    audio.playClick();
    const country = (document.getElementById('onb-country') as HTMLSelectElement)?.value;
    const language = (document.getElementById('onb-lang') as HTMLSelectElement)?.value;
    const submit = document.getElementById('onb-submit') as HTMLButtonElement | null;
    if (submit) { submit.disabled = true; submit.innerText = 'Creating…'; }
    try {
      const res = await this.api(`/api/auth/onboard`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: this.onboardName, country, language }),
      });
      const d = await res.json();
      if (d.token) { this.token = d.token; this.profile = d.profile; }
      else throw new Error(d.error || 'onboard failed');
    } catch {
      // Deployed / offline: build a local named profile.
      this.token = 'guest_local_token';
      this.profile = { id: 'guest_1', displayName: this.onboardName, stars: 500, tickets: 5, level: 1, xp: 0, xpToNext: 300, evolutionXp: 0, equippedSkin: 'Forest', equippedEvolution: 'Baby', unlockedEvolutions: ['Baby'], stats: { matchesPlayed: 0, matchesWon: 0, totalKills: 0, totalFoodEaten: 0, highestScore: 0, survivalTimeSeconds: 0, cherriesCollected: 0 }, rank: { label: 'Bronze I', color: '#b45309', tier: 'Bronze' } };
    }
    try { localStorage.setItem('ap_avatar', this.onboardAvatar); } catch { /* */ }
    localStorage.setItem('ap_onboarded', '1');
    this.selectedSkin = this.profile?.equippedSkin || 'Forest';
    this.persistSession();
    await this.fetchAux();
    document.getElementById('onb-overlay')?.remove();
    this.render();
    // §5 step 4 → story intro, then step 5 → interactive tutorial, then Home.
    this.showLegend(() => this.showTutorial());
  }

  private avatarGlyph(): string {
    const a = localStorage.getItem('ap_avatar');
    const letter = a || (this.profile?.displayName || 'E')[0].toUpperCase();
    return `<div class="av-initial">${letter}</div>`;
  }

  // ---------- STORY: Legend intro overlay ----------
  private maybeShowLegend() {
    if (localStorage.getItem('ap_story_seen')) return;
    this.showLegend();
  }
  private legendThen?: () => void;
  private showLegend(then?: () => void) {
    this.legendThen = then;
    this.legendIdx = 0;
    document.getElementById('legend-overlay')?.remove();
    const el = document.createElement('div');
    el.id = 'legend-overlay';
    el.className = 'legend-overlay';
    document.body.appendChild(el);
    this.renderLegend();
  }
  private renderLegend() {
    const el = document.getElementById('legend-overlay'); if (!el) return;
    const slides = story.LEGEND_SLIDES;
    const s = slides[this.legendIdx];
    const last = this.legendIdx === slides.length - 1;
    el.innerHTML = `
      <div class="legend-card">
        <div class="legend-kicker">🐍 The Legend of the Lost Crown</div>
        <div class="legend-icon">${s.icon}</div>
        <div class="legend-slide-title">${s.title}</div>
        <div class="legend-text">${s.text}</div>
        <div class="legend-dots">${slides.map((_, i) => `<span class="${i === this.legendIdx ? 'on' : ''}"></span>`).join('')}</div>
        <div class="legend-actions">
          <button class="btn btn-ghost" id="legend-skip">Skip</button>
          <button class="btn btn-primary" id="legend-next">${last ? '🥚 Begin your journey' : 'Next →'}</button>
        </div>
      </div>`;
    const close = () => { localStorage.setItem('ap_story_seen', '1'); el.remove(); audio.ensureMusic(); const then = this.legendThen; this.legendThen = undefined; then?.(); };
    document.getElementById('legend-skip')?.addEventListener('click', () => { audio.playClick(); close(); });
    document.getElementById('legend-next')?.addEventListener('click', () => {
      audio.playClick();
      if (last) close(); else { this.legendIdx++; this.renderLegend(); }
    });
  }

  // ---------- §5 Interactive tutorial (how to play) ----------
  private tutorialIdx = 0;
  private showTutorial() {
    this.tutorialIdx = 0;
    document.getElementById('tutorial-overlay')?.remove();
    const el = document.createElement('div');
    el.id = 'tutorial-overlay';
    el.className = 'legend-overlay';
    document.body.appendChild(el);
    this.renderTutorial();
  }
  private renderTutorial() {
    const el = document.getElementById('tutorial-overlay'); if (!el) return;
    const s = TUTORIAL_SLIDES[this.tutorialIdx];
    const last = this.tutorialIdx === TUTORIAL_SLIDES.length - 1;
    el.innerHTML = `
      <div class="legend-card">
        <div class="legend-kicker">🎮 How to Play (${this.tutorialIdx + 1}/${TUTORIAL_SLIDES.length})</div>
        <div class="legend-icon">${s.icon}</div>
        <div class="legend-slide-title">${s.title}</div>
        <div class="legend-text">${s.text}</div>
        <div class="legend-dots">${TUTORIAL_SLIDES.map((_, i) => `<span class="${i === this.tutorialIdx ? 'on' : ''}"></span>`).join('')}</div>
        <div class="legend-actions">
          <button class="btn btn-ghost" id="tut-skip">Skip</button>
          <button class="btn btn-primary" id="tut-next">${last ? '✅ Got it — play!' : 'Next →'}</button>
        </div>
      </div>`;
    const close = () => { localStorage.setItem('ap_tutorial_seen', '1'); el.remove(); };
    document.getElementById('tut-skip')?.addEventListener('click', () => { audio.playClick(); close(); });
    document.getElementById('tut-next')?.addEventListener('click', () => { audio.playClick(); if (last) close(); else { this.tutorialIdx++; this.renderTutorial(); } });
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
    this.boosting = false; this.keyBoost = false; this.joyBoost = false;
    this.client.notifyPause(true);
    this.saveSession();
    this.setScreen('pause');
  }
  private saveSession() {
    if (this.screen !== 'play' && this.screen !== 'pause') return;
    try {
      localStorage.setItem('ap_session', JSON.stringify({
        at: Date.now(), mode: this.selectedUIMode, skin: this.selectedSkin,
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
  // Cheap client-side JWT expiry check (the server still verifies for real) — lets us skip a
  // doomed profile request for an already-expired token, avoiding a console 401 on startup.
  private tokenLooksValid(token: string): boolean {
    try {
      const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
      return typeof payload.exp === 'number' && payload.exp * 1000 > Date.now() + 5000;
    } catch { return false; }
  }

  private async initGuest() {
    // Restore any cached session first so the player sees their progress instantly, even offline.
    const cached = this.loadCachedSession();
    this.loadAuxCache(); // §13 missions/achievements survive an offline close
    if (cached) { this.token = cached.token; this.profile = cached.profile; this.selectedSkin = cached.profile?.equippedSkin || this.selectedSkin; this.render(); }
    try {
      // Validate the cached token; if the server rejects it (expired / backend restarted),
      // silently re-authenticate as a guest instead of spamming 401s with a dead token.
      let valid = false;
      if (this.token && this.token !== 'guest_local_token' && this.tokenLooksValid(this.token)) {
        const res = await this.api('/api/player/profile', { headers: { Authorization: `Bearer ${this.token}` } });
        if (res.ok) {
          const d = await res.json();
          if (d?.profile) {
            this.profile = { ...d.profile, isAdmin: d.user?.isAdmin ?? d.profile?.isAdmin };
            valid = true;
          }
        }
      }
      if (!valid) {
        const res = await this.api('/api/auth/guest', { method: 'POST' });
        const data = await res.json();
        if (data?.token) { this.token = data.token; this.profile = data.profile; }
      }
      this.selectedSkin = this.profile?.equippedSkin || 'Forest';
      await this.fetchAux();
      this.persistSession();
      this.startPresenceHeartbeat(); // §8 keep online status live across the app
      if (this.profile?.isAdmin) this.loadAdminCoupons(); // §7 only check admin coupons for verified admin profiles
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
      const [m, a, lb, cfg, shop] = await Promise.all([
        this.api('/api/missions', { headers: h }), this.api('/api/achievements', { headers: h }),
        this.api('/api/leaderboard', { headers: h }), // §sec now authenticated
        this.api('/api/config'), // §12 public gameplay config (no auth)
        this.api('/api/shop/catalog', { headers: h }), // §shop ownership + pricing
      ]);
      this.missions = (await m.json()).missions || [];
      this.achievements = (await a.json()).achievements || [];
      this.leaderboard = (await lb.json()).leaderboard || [];
      this.serverConfig = await cfg.json().catch(() => null);
      applyPowerConfig(this.serverConfig?.powers); // §power keep the offline engine on the server's curve
      this.shopSkins = (await shop.json().catch(() => ({}))).skins || [];
      // §13 Hand over anything collected while offline. Its response carries the reconciled
      // missions/achievements/profile, so it lands after (and overrides) the reads above.
      await this.flushPendingProgress();
      this.persistAuxCache();
    } catch { /* */ }
  }

  private async refreshProfile() {
    // Only overwrite the cached profile when the server actually returns one (§10 — a 401
    // or an offline fetch must not wipe locally-persisted progress).
    try {
      const res = await this.api('/api/player/profile', { headers: { Authorization: `Bearer ${this.token}` } });
      const data = await res.json();
      if (data?.profile) { this.profile = data.profile; this.persistSession(); }
    } catch { /* keep cached profile */ }
  }

  // Single gate for every backend call.
  //
  // The game server is a long-lived Socket.IO process and cannot be hosted on a static/
  // serverless deploy, so a build with no configured backend has no API to talk to. Firing
  // requests at it anyway produced a doomed 404/500 on every screen. We fail fast instead —
  // every caller already has an offline fallback — and flip to local play.
  private online = hasConfiguredServer();
  private async api(path: string, init?: RequestInit): Promise<Response> {
    if (!this.online) throw new Error('offline: no backend configured');
    return fetch(API + path, init);
  }

  private rank() { return this.profile?.rank || { label: 'Bronze III', color: '#b45309', tier: 'Bronze' }; }

  private setScreen(s: Screen) {
    this.screen = s;
    this.render();
    if (s === 'play' || s === 'pause' || s === 'respawn') {
      this.startRenderLoop();
    }
  }
  private go(p: Page) { this.page = p; this.screen = 'app'; audio.playClick(); this.render(); if (p === 'rewards') this.loadRewards(); if (p === 'inventory') { this.loadAvailableCoupons(); this.loadShopCatalog(); } if (p === 'events') this.loadEvents(); if (p === 'social') { this.loadSocial(); this.loadInvites(); } if (p === 'story') this.loadMilestones(this.journeyMode); if (p === 'history') this.loadMatchHistory(); if (p === 'leaderboard') this.loadLeaderboardCategory(); if (p === 'admin') this.loadAdminCoupons(); if (p === 'play' && this.matchType === 'global') this.measureGlobalPing(); ads.showBanner(); /* §14 lobby-only banner */ }

  // §shop Server-driven skin catalog (prices, ownership, level gates). Loaded with the
  // Inventory page; the client never decides what the player owns.
  private shopSkins: any[] = [];
  private async loadShopCatalog() {
    try {
      const res = await this.api('/api/shop/catalog', { headers: { Authorization: `Bearer ${this.token}` } });
      const d = await res.json();
      this.shopSkins = d.skins || [];
      if (this.page === 'inventory') this.render();
    } catch { /* offline — fall back to the locally-known skin list */ }
  }
  private skinMeta(id: string) { return this.shopSkins.find(s => s.id === id); }
  private ownsSkin(id: string): boolean {
    // Offline (no catalog) the client can only trust its cached profile.
    const owned: string[] = this.profile?.unlockedSkins || [];
    if (this.shopSkins.length) return !!this.skinMeta(id)?.owned;
    return owned.length ? owned.includes(id) : id === 'Forest' || id === 'Jungle';
  }

  private async equipSkin(id: string) {
    audio.playClick();
    if (!this.ownsSkin(id)) { this.promptBuySkin(id); return; }
    const prev = this.selectedSkin;
    this.selectedSkin = id; if (this.profile) this.profile.equippedSkin = id;
    this.render();
    try {
      const res = await this.api('/api/player/equip', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.token}` }, body: JSON.stringify({ skin: id }) });
      const d = await res.json();
      if (!res.ok || !d.success) {
        // Server rejected it (not owned) — roll the optimistic change back.
        this.selectedSkin = prev; if (this.profile) this.profile.equippedSkin = prev;
        this.showToast(`🔒 ${d.message || 'You do not own that skin'}`);
      } else if (d.profile) { this.profile = d.profile; this.persistSession(); }
    } catch { /* offline — keep the local choice */ }
    this.render();
  }

  // Confirm-then-buy. The price shown comes from the server catalog and the charge is applied
  // server-side; this dialog only collects intent.
  private promptBuySkin(id: string) {
    const meta = this.skinMeta(id);
    const visual = SKINS.find(s => s.id === id);
    if (!meta) { this.showToast('🔒 This skin is locked'); return; }
    document.getElementById('buy-overlay')?.remove();
    const el = document.createElement('div');
    el.id = 'buy-overlay';
    el.className = 'onb-overlay';
    const cost = `${meta.costStars} ⭐${meta.costTickets ? ` + ${meta.costTickets} 🎟️` : ''}`;
    const blocked = !meta.levelMet ? `Unlocks at level ${meta.minLevel}` : !meta.affordable ? 'Not enough stars' : '';
    el.innerHTML = `
      <div class="onb-card buy-card">
        <div class="buy-preview" style="background:${visual?.grad || '#2E7D32'}"></div>
        <div class="onb-title">${meta.name}</div>
        <div class="onb-sub"><span class="rarity-tag ${meta.rarity}">${meta.rarity}</span> · ${meta.family} family</div>
        <div class="buy-price">${cost}</div>
        ${blocked ? `<div class="buy-blocked">🔒 ${blocked}</div>` : ''}
        <button class="btn btn-primary btn-block" id="buy-confirm" ${blocked ? 'disabled' : ''}>Unlock &amp; Equip</button>
        <button class="btn btn-ghost btn-block" id="buy-cancel" style="margin-top:8px;">Cancel</button>
      </div>`;
    document.body.appendChild(el);
    document.getElementById('buy-cancel')?.addEventListener('click', () => { audio.playClick(); el.remove(); });
    document.getElementById('buy-confirm')?.addEventListener('click', () => { el.remove(); this.buySkin(id); });
  }

  private async buySkin(id: string) {
    audio.playClick();
    try {
      const res = await this.api('/api/shop/purchase', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.token}` },
        body: JSON.stringify({ skinId: id }),
      });
      const d = await res.json();
      if (res.ok && d.success) {
        if (d.profile) { this.profile = d.profile; this.persistSession(); }
        audio.playFanfare();
        this.showToast(`✨ ${d.message}`);
        await this.loadShopCatalog();
        await this.equipSkin(id); // owned now — equips for real
        return;
      }
      this.showToast(`❌ ${d.message || d.error || 'Purchase failed'}`);
    } catch { this.showToast('❌ Purchase failed — you appear to be offline'); }
    this.render();
  }

  private async equipEvolution(evo: string) {
    audio.playClick();
    try {
      const res = await this.api('/api/player/evolution', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.token}` }, body: JSON.stringify({ evolution: evo }) });
      const data = await res.json();
      if (data.success) { this.profile = data.profile; this.showToast(`🐍 ${data.message}`); audio.playChime(); } else this.showToast(`🔒 ${data.message}`);
    } catch { /* */ }
    this.render();
  }

  private async doPrestige() {
    audio.playClick();
    try {
      const res = await this.api('/api/player/prestige', { method: 'POST', headers: { Authorization: `Bearer ${this.token}` } });
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
      await this.api('/api/player/equip-accessory', {
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
    if (!this.modeDef.enabled) { this.showToast('🔒 Event Mode is only enabled during live events'); return; }
    audio.playClick();
    // Solo Classic Snake skips matchmaking — jump straight in.
    if (this.modeDef.solo) { this.startMatch(); return; }
    this.setScreen('matchmaking');
    let n = 3;
    const t = setInterval(() => { n--; const el = document.getElementById('mm-count'); if (el) el.innerText = String(n); if (n <= 0) { clearInterval(t); this.startMatch(); } }, 750);
  }

  private showMatchObjectiveBanner() {
    const banners: Record<string, string> = {
      team: '🛡️ Work with your team to defeat the enemy team!',
      battle_royale: '⚔️ Survive until you are the last snake standing!',
      nokia: '🕹️ Eat, grow, and survive!',
      explorer: '📜 Reclaim the Seven Kingdoms!',
      free_roam: '🌿 Eat 🍒, outgrow rivals, complete daily missions!',
    };
    const text = banners[this.selectedUIMode] || '⚔️ Defeat rivals and survive!';

    let el = document.getElementById('match-obj-toast');
    if (el) el.remove();

    el = document.createElement('div');
    el.id = 'match-obj-toast';
    el.className = 'match-obj-toast';
    el.innerHTML = `<span>${text}</span>`;
    document.body.appendChild(el);

    setTimeout(() => {
      if (el && el.parentNode) el.remove();
    }, 5200);
  }

  private startMatch() {
    this.matchStart = Date.now(); this.lastAlive = true; this.visitedAreas.clear(); this.summary = null;
    // §V7 reset per-match tracking
    this.matchStats = { cherry: 0, apple: 0, frog: 0, star: 0, mushroom: 0, shield: 0, speed: 0, powerup: 0, kills: 0, deaths: 0 };
    this.lastKills = 0; this.liveMissionDone.clear();
    // §milestone Load this mode's checkpoints so the run can bank them as they're reached.
    this.checkpointing.clear();
    if (this.milestoneMode !== this.selectedUIMode) this.loadMilestones(this.selectedUIMode);
    this.setScreen('play'); // render() creates/attaches the renderer to the live canvas
    this.showMatchObjectiveBanner();
    ads.hideBanner(); // §14 never show ads during active gameplay
    audio.startMusic();
    this.client.onStateUpdate = (s) => this.onTick(s);
    this.client.onRespawnResult = (r) => this.onRespawn(r);
    this.client.onMatchInvite = (r) => this.onInvitePush(r.invites || []); // §social
    this.client.onCollect = (type) => this.onCollect(type); // §V7 real-time mission tracking
    const region = this.matchType === 'local' ? (this.localCity || 'Local') : 'Global'; // §7
    // §2 Each mode carries its own rules/flags into the engine (solo, story, timed).
    this.client.setModeFlags({ ui: this.selectedUIMode, solo: !!this.modeDef.solo, story: !!this.modeDef.story });
    this.client.connect(this.token, this.selectedSkin, this.modeDef.backend, region, this.matchType);
    this.setupInput();
    this.startRenderLoop();
  }

  private startRenderLoop() {
    if (this.animFrameId) cancelAnimationFrame(this.animFrameId);
    const loop = () => {
      if (this.screen === 'play' || this.screen === 'pause' || this.screen === 'respawn') {
        if (this.renderer && this.lastState) {
          this.renderer.render(this.lastState, this.client.localUserId);
          // §net Keep the server's interest radius in step with the live camera (zoom,
          // rotation, resize). setViewRadius() throttles this to meaningful changes only.
          this.client.setViewRadius(this.renderer.getViewRadius());
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
    // §2 Battle Royale ended (timer up / last standing) — go straight to results.
    if ((state as any).matchOver && (this.screen === 'play' || this.screen === 'respawn')) { this.endMatch(); return; }
    if (me && !me.isAlive && this.lastAlive && this.screen === 'play') { this.lastAlive = false; audio.playDeath(); this.openRespawn(); return; }
    if (me && me.isAlive) this.lastAlive = true;
    // §V7 real-time kill tracking (works in both server + local engine via snake.kills).
    // This is the single owner of `lastKills` — updateHUD only reads it, so the kill toast
    // still sees the delta (it used to compare against an already-advanced counter and
    // therefore never fired).
    if (me) {
      const k = me.kills || 0;
      if (k > this.lastKills) {
        const gained = k - this.lastKills;
        this.matchStats.kills += gained;
        this.lastKills = k;
        this.showKillToast(`⚔️ +${gained} Kill${gained > 1 ? 's' : ''}!`);
        this.recordProgress('kill', gained); // §13 counts toward missions/achievements live
        this.updateMissionTracker();
      }
    }
    if (this.screen === 'play') { this.updateHUD(state, me); this.checkMilestones(me); }
  }

  // ---------- §milestone Story checkpoints ----------
  // Reaching a beat banks its reward IMMEDIATELY rather than at the match summary, so a
  // crash, a lost connection or simply closing the app can't erase what the run achieved.
  private milestones: any[] = [];
  private milestoneMode = '';
  private checkpointing = new Set<string>(); // in-flight, so a 30 Hz tick can't double-claim

  private async loadMilestones(mode = this.selectedUIMode) {
    if (!this.online) { this.loadMilestonesOffline(mode); return; }
    if (!this.token) return;
    try {
      const res = await this.api(`/api/milestones?mode=${encodeURIComponent(mode)}`);
      if (!res.ok) return;
      const d = await res.json();
      this.milestones = d.milestones || [];
      this.milestoneMode = mode;
      if (this.page === 'story') this.render();
    } catch {
      this.loadMilestonesOffline(mode);
    }
  }

  // No backend reachable: grade the journey against locally-recorded progress so the timeline
  // still tells the story and beats still celebrate. The server reconciles on next connection.
  private loadMilestonesOffline(mode: string) {
    const defs = (this.serverConfig?.milestones?.length ? this.serverConfig.milestones : story.MILESTONES)
      .filter((m: any) => m.modes?.includes(mode));
    const reached: string[] = this.profile?.milestones || [];
    this.milestones = defs.map((m: any) => {
      const progress = Math.min(this.milestoneValue(m.metric, this.lastSnake), m.target);
      return {
        ...m,
        reached: reached.includes(m.id),
        progress,
        pct: m.target > 0 ? Math.min(100, Math.round((progress / m.target) * 100)) : 100,
      };
    });
    this.milestoneMode = mode;
    if (this.page === 'story') this.render();
  }

  // The live value for a milestone metric, from this match plus what the profile records.
  private milestoneValue(metric: string, me?: SnakeData | null): number {
    const s = this.profile?.stats || {};
    const survival = Math.max(0, Math.floor((Date.now() - this.matchStart) / 1000));
    switch (metric) {
      case 'score':    return Math.max(Math.round(me?.score || 0), s.highestScore || 0);
      case 'kills':    return Math.max(this.matchStats.kills || 0, s.mostKillsInMatch || 0);
      case 'stars':    return (s.totalStars || 0) + (this.matchStats.star || 0) * 50;
      case 'survival': return Math.max(survival, s.longestSurvivalSeconds || 0);
      case 'areas':    return Math.max(this.visitedAreas.size, s.areasExplored || 0);
      case 'level':    return this.profile?.level || 1;
      default:         return 0;
    }
  }

  // Called every tick while playing. Cheap: a few numeric comparisons over <=13 milestones.
  private checkMilestones(me?: SnakeData | null) {
    if (!this.milestones.length) return;
    for (const m of this.milestones) {
      if (m.reached || this.checkpointing.has(m.id)) continue;
      if (this.milestoneValue(m.metric, me) < m.target) continue;
      this.checkpointing.add(m.id);
      this.bankCheckpoint(m);
    }
  }

  private async bankCheckpoint(m: any) {
    // Mark it locally straight away so the celebration fires once even if the network is slow
    // or absent — offline runs still get the story beat, and the server reconciles later.
    m.reached = true;
    this.celebrateMilestone(m);
    try {
      const res = await this.api('/api/match/checkpoint', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.token}` },
        body: JSON.stringify({ milestoneId: m.id }),
      });
      const d = await res.json();
      if (d.profile) { this.profile = d.profile; this.persistSession(); }
      else if (d.success === false && !d.alreadyClaimed) m.reached = false; // server says not yet — let it retry
    } catch {
      // Offline: remember it locally so the timeline stays honest; the end-of-match
      // checkpoint-all sweep banks it for real once a server is reachable again.
      const owned: string[] = this.profile?.milestones || [];
      if (this.profile && !owned.includes(m.id)) { this.profile.milestones = [...owned, m.id]; this.persistSession(); }
    } finally {
      this.checkpointing.delete(m.id);
    }
  }

  // §12 Compact, non-blocking gameplay notification.
  //
  // Anything worth telling the player mid-match goes through here: it never pauses the game,
  // never covers the play area, and never needs dismissing. Notices queue so a burst (a
  // checkpoint that also levels you up) plays in sequence instead of stomping on itself.
  private noticeQueue: Array<{ icon: string; kicker: string; title: string; sub?: string; tone?: string }> = [];
  private noticeShowing = false;

  public notify(n: { icon: string; kicker: string; title: string; sub?: string; tone?: string }) {
    this.noticeQueue.push(n);
    if (!this.noticeShowing) this.drainNotices();
  }

  private drainNotices() {
    const n = this.noticeQueue.shift();
    if (!n) { this.noticeShowing = false; return; }
    this.noticeShowing = true;

    let host = document.getElementById('notice-host');
    if (!host) {
      host = document.createElement('div');
      host.id = 'notice-host';
      host.className = 'notice-host';
      document.body.appendChild(host);
    }
    const el = document.createElement('div');
    el.className = `game-notice ${n.tone || ''}`;
    el.innerHTML = `
      <span class="gn-spark"></span>
      <span class="gn-icon">${n.icon}</span>
      <span class="gn-text">
        <span class="gn-kicker">${n.kicker}</span>
        <span class="gn-title">${n.title}</span>
        ${n.sub ? `<span class="gn-sub">${n.sub}</span>` : ''}
      </span>`;
    host.appendChild(el);
    requestAnimationFrame(() => el.classList.add('show'));

    // Auto-dismiss; the next notice starts as this one leaves so a burst reads as a sequence.
    setTimeout(() => {
      el.classList.remove('show');
      el.classList.add('out');
      setTimeout(() => el.remove(), 320);
      this.drainNotices();
    }, 2600);
  }

  // A story beat — now a compact banner rather than a full-screen card that stopped play.
  private celebrateMilestone(m: any) {
    audio.playChime?.();
    this.notify({
      icon: m.icon,
      kicker: `Chapter ${m.chapter} · Checkpoint`,
      title: m.title,
      sub: `⭐ +${m.rewardStars} · XP +${m.rewardXp} · ✓ Saved`,
      tone: 'gold',
    });
  }

  // §V7 A collectible was picked up (local engine) — update counters + live mission tracker.
  //
  // Offline this is the ONLY place progress is recorded, so it must do real work: previously
  // it only bumped `matchStats`, which resets every match, so mission progress evaporated the
  // moment a run ended. Now it advances the actual mission/achievement counters, persists
  // them, and queues the increment for the server.
  private onCollect(type: string) {
    if (type in this.matchStats) (this.matchStats as any)[type]++;
    if (type === 'shield' || type === 'speed' || type === 'mushroom') this.matchStats.powerup++;
    this.recordProgress(this.collectibleMetric(type), 1);
    this.updateMissionTracker();
  }

  // Collectible id → the progress metric the server tracks it under.
  private collectibleMetric(type: string): string {
    return ({ mushroom: 'powerup', shield: 'shield', speed: 'powerup', egg: 'egg',
              coupon_box: 'treasure', gift: 'treasure' } as Record<string, string>)[type] || type;
  }

  // ---------- §13 Progress ledger (live update + durable offline sync) ----------
  //
  // One entry point for every gameplay event that should count toward something. It:
  //   1. advances the local mission/achievement state so the UI is correct immediately,
  //   2. persists that state so closing the app cannot lose it,
  //   3. queues the increment so the server can be told once it is reachable.
  // Online the server is still the source of truth — its pickup_event overwrites our optimistic
  // copy — so this never double-counts, it just stops offline play from being a black hole.
  private pendingProgress: Record<string, number> = this.loadPendingProgress();

  private loadPendingProgress(): Record<string, number> {
    try { return JSON.parse(localStorage.getItem('ap_pending_progress') || '{}'); } catch { return {}; }
  }
  private savePendingProgress() {
    try { localStorage.setItem('ap_pending_progress', JSON.stringify(this.pendingProgress)); } catch { /* */ }
  }

  public recordProgress(metric: string, amount = 1) {
    if (!metric || amount <= 0) return;
    let changed = false;

    // Missions
    for (const m of this.missions || []) {
      if (m.metric !== metric || m.isCompleted) continue;
      m.currentCount = Math.min(m.targetCount, (m.currentCount || 0) + amount);
      if (m.currentCount >= m.targetCount) {
        m.isCompleted = true;
        this.notify({ icon: m.icon || '🎯', kicker: 'Mission complete', title: m.title?.replace(/^[^ ]+ /, '') || 'Objective', tone: 'green' });
      }
      changed = true;
    }
    // Achievements
    for (const a of this.achievements || []) {
      if (a.metric !== metric || a.isUnlocked) continue;
      a.progress = Math.min(a.target, (a.progress || 0) + amount);
      if (a.progress >= a.target) {
        a.isUnlocked = true;
        this.notify({ icon: a.icon || '🏆', kicker: 'Achievement earned', title: a.title, tone: 'gold' });
      }
      changed = true;
    }

    this.pendingProgress[metric] = (this.pendingProgress[metric] || 0) + amount;
    this.savePendingProgress();
    if (changed) this.persistAuxCache();
  }

  // Missions/achievements are server-owned but must survive an offline close.
  private persistAuxCache() {
    try {
      localStorage.setItem('ap_aux_cache', JSON.stringify({ missions: this.missions, achievements: this.achievements }));
    } catch { /* */ }
  }
  private loadAuxCache() {
    try {
      const d = JSON.parse(localStorage.getItem('ap_aux_cache') || 'null');
      if (d?.missions?.length) this.missions = d.missions;
      if (d?.achievements?.length) this.achievements = d.achievements;
    } catch { /* */ }
  }

  // Hand the queued increments to the server once it is reachable. The server clamps and
  // applies them; we only clear the queue on a confirmed 200, so a failed flush is retried
  // rather than silently dropped.
  private flushingProgress = false;
  private async flushPendingProgress() {
    if (this.flushingProgress || !this.online || !this.token) return;
    const entries = Object.entries(this.pendingProgress).filter(([, n]) => n > 0);
    if (!entries.length) return;
    this.flushingProgress = true;
    const batch = Object.fromEntries(entries);
    try {
      const res = await this.api('/api/progress/sync', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.token}` },
        body: JSON.stringify({ progress: batch }),
      });
      if (res.ok) {
        const d = await res.json();
        // Subtract exactly what we sent — anything collected during the round-trip survives.
        for (const [k, n] of entries) {
          this.pendingProgress[k] = Math.max(0, (this.pendingProgress[k] || 0) - n);
          if (!this.pendingProgress[k]) delete this.pendingProgress[k];
        }
        this.savePendingProgress();
        if (d.missions) this.missions = d.missions;
        if (d.achievements) this.achievements = d.achievements;
        if (d.profile) { this.profile = d.profile; this.persistSession(); }
        this.persistAuxCache();
      }
    } catch { /* stays queued for the next attempt */ } finally { this.flushingProgress = false; }
  }

  // §V7 Missions whose progress can be tracked live during a match (collectible metrics).
  private static TRACKABLE_METRICS = new Set(['cherry', 'apple', 'frog', 'star', 'kill']);
  private liveMissionCount(m: any): number {
    const metricToStat: Record<string, keyof typeof this.matchStats> = { cherry: 'cherry', apple: 'apple', frog: 'frog', star: 'star', kill: 'kills' };
    const add = this.matchStats[metricToStat[m.metric]] || 0;
    return Math.min(m.targetCount, (m.currentCount || 0) + add);
  }
  // The compact daily missions shown in the in-game tracker.
  private trackerMissions(): any[] {
    return (this.missions || []).filter(m => m.category === 'daily' && AnacondaPark.TRACKABLE_METRICS.has(m.metric)).slice(0, 4);
  }
  // Re-render the in-game tracker rows + fire the completion celebration once per mission.
  private updateMissionTracker() {
    const box = document.getElementById('mission-tracker-rows');
    const list = this.trackerMissions();
    if (box) {
      box.innerHTML = list.map(m => {
        const cur = this.liveMissionCount(m);
        const done = cur >= m.targetCount;
        return `<div class="mt-row ${done ? 'done' : ''}"><span class="mt-check">${done ? '☑' : '☐'}</span> <span class="mt-ico">${m.icon}</span> <span class="mt-count">${cur}/${m.targetCount}</span></div>`;
      }).join('');
    }
    // Completion detection — celebrate each mission once, then check the daily-complete flow.
    for (const m of list) {
      if (this.liveMissionCount(m) >= m.targetCount && !this.liveMissionDone.has(m.id)) {
        this.liveMissionDone.add(m.id);
        this.celebrateMission(m);
      }
    }
  }

  // §V7 §8 Mission completion celebration — popup + confetti + sound + reward summary.
  private celebrateMission(m: any) {
    audio.playFanfare?.();
    const el = document.createElement('div');
    el.className = 'mission-pop';
    el.innerHTML = `
      <div class="mp-card">
        <div class="mp-confetti">${Array.from({ length: 14 }, (_, i) => `<i style="--i:${i}"></i>`).join('')}</div>
        <div class="mp-title">🎉 Daily Mission Complete!</div>
        <div class="mp-name">${m.icon} ${m.title.replace(/^[^ ]+ /, '')}</div>
        <div class="mp-rewards">
          <span>⭐ +${m.rewardStars}</span><span>XP +${m.rewardXP}</span><span>Evo +${m.rewardEvoXP}</span>
        </div>
      </div>`;
    document.body.appendChild(el);
    setTimeout(() => el.classList.add('show'), 20);
    setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 350); }, 2600);
    // If that was the last trackable daily mission, show the bigger daily-complete screen.
    const all = this.trackerMissions();
    if (all.length && all.every(x => this.liveMissionDone.has(x.id))) setTimeout(() => this.celebrateDailyComplete(), 900);
  }

  // §V7 §9 All daily missions done — larger completion screen + real server-granted bonus.
  private async celebrateDailyComplete() {
    if (document.getElementById('daily-complete')) return;
    // Claim the server-authoritative daily bonus (granted at most once per day).
    let rewardsHtml = '<div>⭐ Bonus Stars</div><div>🥚 Rare Egg</div><div>XP Boost</div>';
    let headline = 'You completed today\'s Daily Missions.';
    try {
      const res = await this.api('/api/missions/daily-bonus', { method: 'POST', headers: { Authorization: `Bearer ${this.token}` } });
      const d = await res.json();
      if (d.success && d.rewards) {
        if (d.profile) { this.profile = d.profile; this.persistSession(); }
        rewardsHtml = `<div>⭐ +${d.rewards.stars}</div><div>${d.rewards.itemIcon || '🥚'} ${d.rewards.item}</div><div>XP +${d.rewards.xp}</div><div>Evo +${d.rewards.evoXp}</div>`;
      } else if (d.alreadyClaimed) {
        headline = 'Daily bonus already claimed today — see you tomorrow!';
        rewardsHtml = '<div>✓ Claimed today</div>';
      } else if (d.allDone === false) {
        // Not every daily mission is done yet (e.g. non-trackable ones) — skip the big screen;
        // the per-mission celebrations already played.
        return;
      }
    } catch { /* offline — show the generic celebration */ }
    audio.playFanfare?.();
    const el = document.createElement('div');
    el.id = 'daily-complete';
    el.className = 'daily-complete-overlay';
    el.innerHTML = `
      <div class="dc-card">
        <div class="dc-trophy">🏆</div>
        <div class="dc-title">Congratulations!</div>
        <div class="dc-sub">${headline}</div>
        ${rewardsHtml ? `<div class="dc-rewards">${rewardsHtml}</div>` : ''}
        <div class="dc-next">Next Daily Missions in <b id="dc-countdown">--:--:--</b></div>
        <button class="btn btn-primary" id="dc-close">Awesome!</button>
      </div>`;
    document.body.appendChild(el);
    requestAnimationFrame(() => el.classList.add('show'));
    const tick = () => { const c = document.getElementById('dc-countdown'); if (c) c.textContent = this.timeToMidnight(); };
    tick(); const iv = setInterval(tick, 1000);
    document.getElementById('dc-close')?.addEventListener('click', () => { clearInterval(iv); el.classList.remove('show'); setTimeout(() => el.remove(), 300); });
  }

  // Countdown to local midnight (daily reset) as HH:MM:SS.
  private timeToMidnight(): string {
    const now = new Date();
    const midnight = new Date(now); midnight.setHours(24, 0, 0, 0);
    let s = Math.max(0, Math.floor((midnight.getTime() - now.getTime()) / 1000));
    const h = Math.floor(s / 3600); s -= h * 3600; const m = Math.floor(s / 60); s -= m * 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
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

  // Final placement for the match summary. The server (and the offline reward formula) treat
  // placement === 1 as the win, which gates the win bonus, the `matchesWon` stat and the
  // "Claim a Royal Victory" missions — so a survivor who topped the board has to be able to
  // reach #1. Survivors rank by score among the living; a player who died ranks behind
  // everyone still alive.
  private computePlacement(state: GameStateTick | null, me: SnakeData | null): number {
    if (!state || !me) return 1;
    const alive = state.snakes.filter(s => s.isAlive);
    if (me.isAlive) return alive.filter(s => s.id !== me.id && s.score > me.score).length + 1;
    return alive.length + 1;
  }

  // Guards against submitting the same match more than once. endMatch() awaits two network
  // round-trips before it switches screens, and onTick() fires 30×/second — without this the
  // `matchOver` branch re-entered it on every tick in that window and POSTed a pile of
  // duplicate summaries.
  private endingMatch = false;

  private async endMatch() {
    if (this.endingMatch) return;
    this.endingMatch = true;
    try { await this.runEndMatch(); } finally { this.endingMatch = false; }
  }

  private async runEndMatch() {
    audio.playClick(); this.clearRespawnTimers(); this.teardownInput();
    const snake = this.lastSnake; const state = this.lastState;
    const survival = Math.max(5, Math.floor((Date.now() - this.matchStart) / 1000));
    const placement = this.computePlacement(state, snake);
    const distanceKm = snake ? +((snake as any).distanceTravelled?.toFixed?.(2) || 0) : 0;
    const score = snake?.score || 0; const kills = snake?.kills || 0;
    const ms = this.matchStats;
    const starsCollected = ms.star * 50; // ⭐ stars are worth 50 each
    try {
      const res = await this.api('/api/match/summary', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.token}` }, body: JSON.stringify({
        score, kills, placement, survivalSeconds: survival, distanceKm, areasVisited: this.visitedAreas.size,
        // §V7 richer, mode-tagged payload so per-mode stats + missions populate correctly
        mode: this.selectedUIMode, map: this.activeMapTheme, deaths: 1, killStreak: kills,
        cherriesEaten: ms.cherry, applesEaten: ms.apple, frogsEaten: ms.frog, powerupsEaten: ms.powerup, starsCollected,
      }) });
      const data = await res.json();
      if (data && data.profile) {
        this.summary = { score: Math.round(score), kills, placement, survival, earnedStars: data.earnedStars || 0, earnedXP: data.earnedXP || 0, earnedEvoXP: data.earnedEvoXP || 0, levelsGained: data.levelsGained || 0 };
        this.profile = data.profile;
        if (data.levelsGained > 0) this.showLevelUp(data.profile.level);
        // §V7 §8 auto-claim any missions this match completed (server-authoritative payout)
        try {
          const cr = await this.api('/api/missions/claim-all', { method: 'POST', headers: { Authorization: `Bearer ${this.token}` } });
          const cd = await cr.json();
          if (cd?.claimed?.length) { if (cd.profile) this.profile = cd.profile; this.summary.missionBonus = { stars: cd.stars, xp: cd.xp, evoXp: cd.evoXp, count: cd.claimed.length }; }
        } catch { /* */ }
        // §milestone Safety net — bank any beat reached in the final seconds, or while the
        // connection was briefly down, that the live checkpoint missed.
        try {
          const mr = await this.api('/api/match/checkpoint-all', {
            method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.token}` },
            body: JSON.stringify({ mode: this.selectedUIMode }),
          });
          const md = await mr.json();
          if (md?.claimed?.length) { if (md.profile) this.profile = md.profile; this.summary.milestones = md.claimed; }
        } catch { /* */ }
      } else {
        // No authoritative server (deployed local-engine build) — apply + persist locally.
        this.summary = this.applyLocalMatchRewards(score, kills, placement, survival);
      }
    } catch {
      this.summary = this.applyLocalMatchRewards(score, kills, placement, survival);
    }
    this.recordHistory({ mode: this.modeDef.name, score: Math.round(score), kills, placement, survival, at: Date.now() }); // §6
    this.persistSession(); // §10 keep earned stars/XP/level across restarts
    await this.fetchAux(); this.client.disconnect(); this.setScreen('gameover');
  }

  // §6 Match history (client-side, last 15) — survives restarts via localStorage.
  private recordHistory(entry: any) {
    try {
      const h = this.loadHistory();
      h.unshift(entry);
      localStorage.setItem('ap_history', JSON.stringify(h.slice(0, 15)));
    } catch { /* */ }
  }
  private loadHistory(): any[] {
    try { return JSON.parse(localStorage.getItem('ap_history') || '[]'); } catch { return []; }
  }

  // §10 Client-side reward application for the deployed build (no persistent server).
  // Mirrors the server's /api/match/summary formula so progression works + persists offline.
  private applyLocalMatchRewards(score: number, kills: number, placement: number, survival: number) {
    const won = placement === 1;
    // §12 Use the server's config-driven reward formula when available; fall back to defaults offline.
    const m = this.serverConfig?.economy?.match ?? {
      starsPerScore: 10, starsPerKill: 50, starsWinBonus: 500,
      xpPerScore: 5, xpPerKill: 100, xpWinBonus: 300,
      evoXpPerScore: 50, evoXpPerKill: 10, evoXpWinBonus: 50,
    };
    const earnedStars = Math.floor(score / m.starsPerScore) + kills * m.starsPerKill + (won ? m.starsWinBonus : 0);
    const earnedXP = Math.floor(score / m.xpPerScore) + kills * m.xpPerKill + (won ? m.xpWinBonus : 0);
    const earnedEvoXP = Math.floor(score / m.evoXpPerScore) + kills * m.evoXpPerKill + (won ? m.evoXpWinBonus : 0);
    const p = this.profile = this.profile || {};
    p.stars = (p.stars || 0) + earnedStars;
    p.evolutionXp = (p.evolutionXp || 0) + earnedEvoXP;
    // Roll account level-ups with a simple rising curve.
    let level = p.level || 1;
    let xp = (p.xp || 0) + earnedXP;
    let toNext = p.xpToNext || (300 + level * 40);
    let levelsGained = 0;
    while (xp >= toNext) { xp -= toNext; level++; levelsGained++; toNext = 300 + level * 40; }
    p.level = level; p.xp = xp; p.xpToNext = toNext;
    // Persistent stats.
    p.stats = p.stats || { matchesPlayed: 0, matchesWon: 0, totalKills: 0, totalFoodEaten: 0, highestScore: 0, survivalTimeSeconds: 0, cherriesCollected: 0 };
    p.stats.matchesPlayed += 1;
    p.stats.matchesWon += won ? 1 : 0;
    p.stats.totalKills += kills;
    p.stats.highestScore = Math.max(p.stats.highestScore || 0, Math.round(score));
    p.stats.survivalTimeSeconds += survival;
    if (levelsGained > 0) this.showLevelUp(level);
    return { score: Math.round(score), kills, placement, survival, earnedStars, earnedXP, earnedEvoXP, levelsGained };
  }

  private togglePause() {
    audio.playClick();
    if (this.screen === 'play') { this.client.notifyPause(true); this.saveSession(); this.setScreen('pause'); }
    else if (this.screen === 'pause') { this.client.notifyPause(false); this.setScreen('play'); this.setupInput(); }
  }

  private async abandon() {
    audio.playClick(); this.teardownInput(); this.clearRespawnTimers();
    try { await this.api('/api/match/abandon', { method: 'POST', headers: { Authorization: `Bearer ${this.token}` } }); } catch { /* */ }
    this.client.disconnect(); await this.refreshProfile(); await this.fetchAux(); this.page = 'home'; this.setScreen('app');
  }

  // §14 Rewarded ad — routes through AdService. Real AdMob (when configured) replaces the
  // built-in 5s reward modal; otherwise the simulated flow below runs.
  private triggerAd(after: () => void) {
    ads.showRewarded((done) => {
      this.setScreen('ad-reward'); this.adTimer = 5;
      if (this.adInterval) clearInterval(this.adInterval);
      this.adInterval = setInterval(() => { this.adTimer--; const el = document.getElementById('ad-count'); if (el) el.innerText = String(this.adTimer); if (this.adTimer <= 0) { clearInterval(this.adInterval); done(); } }, 1000);
    }).then((rewarded) => { if (rewarded) after(); });
  }

  private async claimMission(id: string) {
    audio.playClick();
    try {
      const res = await this.api('/api/missions/claim', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.token}` }, body: JSON.stringify({ missionId: id }) });
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
  private onMouseDown = (e: MouseEvent) => { if (this.screen === 'play' && !(e.target as HTMLElement)?.closest('.hud-panel,.touch-btn,.hud-pause')) this.keyBoost = true; };
  private onMouseUp = () => { this.keyBoost = false; document.getElementById('touch-boost')?.classList.remove('active'); };
  private onWheel = (e: WheelEvent) => { if (this.screen !== 'play') return; e.preventDefault(); this.renderer?.adjustZoom(e.deltaY < 0 ? 1.08 : 0.926); };
  private onKeyDown = (e: KeyboardEvent) => {
    if (this.screen !== 'play') return;
    const k = e.key.toLowerCase();
    if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) { this.keys[k] = true; e.preventDefault(); }
    if (k === 'shift') this.keyBoost = true;
    if (e.code === 'Space') { e.preventDefault(); this.client.activateAbility(); audio.playClick(); }
    if (k === '+' || k === '=') this.renderer?.adjustZoom(1.1);
    if (k === '-' || k === '_') this.renderer?.adjustZoom(0.9);
  };
  private onKeyUp = (e: KeyboardEvent) => { const k = e.key.toLowerCase(); if (this.keys[k] !== undefined) this.keys[k] = false; if (k === 'shift') this.keyBoost = false; };
  private isWasd() { return this.keys['w'] || this.keys['a'] || this.keys['s'] || this.keys['d'] || this.keys['arrowup'] || this.keys['arrowdown'] || this.keys['arrowleft'] || this.keys['arrowright']; }
  private pumpInput() {
    if (this.screen !== 'play') return;
    if (this.isWasd() && !this.joyActive) {
      let dx = 0, dy = 0;
      if (this.keys['w'] || this.keys['arrowup']) dy -= 1; if (this.keys['s'] || this.keys['arrowdown']) dy += 1;
      if (this.keys['a'] || this.keys['arrowleft']) dx -= 1; if (this.keys['d'] || this.keys['arrowright']) dx += 1;
      if (dx || dy) this.angle = Math.atan2(dy, dx);
    }
    this.boosting = this.keyBoost || this.joyBoost; // combine all boost sources
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
    // Push the joystick to its outer edge to BOOST (mobile drag-to-go-fast).
    this.joyBoost = clamped >= this.joyRadius * 0.9;
    const joy = document.getElementById('touch-joystick');
    joy?.classList.add('active');
    joy?.classList.toggle('boosting', this.joyBoost);
  }
  private resetKnob() {
    const knob = document.getElementById('touch-knob');
    if (knob) knob.style.transform = 'translate(-50%,-50%)';
    this.joyBoost = false;
    document.getElementById('touch-joystick')?.classList.remove('active', 'boosting');
  }

  // ---- On-screen action buttons (rebound on each HUD render) --------------
  private bindTouch() {
    // Window-level joystick/pinch handlers live in setupInput(); here we (re)bind the
    // on-screen action buttons, which are recreated every time the HUD is rendered.
    const boost = document.getElementById('touch-boost');
    if (boost) {
      const on = (e: Event) => { e.preventDefault(); e.stopPropagation(); this.keyBoost = true; boost.classList.add('active'); };
      const off = (e: Event) => { e.stopPropagation(); this.keyBoost = false; boost.classList.remove('active'); };
      boost.addEventListener('touchstart', on, { passive: false });
      boost.addEventListener('touchend', off); boost.addEventListener('touchcancel', off);
      boost.addEventListener('mousedown', on); boost.addEventListener('mouseup', off);
      // A pointer released outside the button is caught by the window-level onMouseUp from
      // setupInput() — binding another window listener here would leak one per HUD render.
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
    if (mini) mini.addEventListener('click', (e) => { e.stopPropagation(); this.showTacticalMap(); });
  }

  private showTacticalMap() {
    const existing = document.getElementById('tactical-overlay');
    if (existing) { existing.remove(); return; }
    // Neither GameClient nor Renderer exposes a `state` field — the live world snapshot is
    // the one onTick() stores. Reading anything else drew an empty grid every time.
    const state = this.lastState;
    const me = state?.snakes?.find((s) => s.id === this.client.localUserId) || null;

    const overlay = document.createElement('div');
    overlay.id = 'tactical-overlay';
    overlay.className = 'tactical-map-overlay';
    overlay.innerHTML = `
      <div class="tactical-map-card">
        <div class="tactical-map-header">
          <div class="tactical-map-title">🗺️ Fullscreen Tactical Map</div>
          <button class="tactical-map-close" id="tactical-close">✖</button>
        </div>
        <canvas class="tactical-map-canvas" id="tactical-canvas"></canvas>
        <div class="tactical-map-controls">
          <button class="tactical-map-btn" id="tactical-zoom-in">🔍 +</button>
          <button class="tactical-map-btn" id="tactical-zoom-out">🔍 -</button>
          <button class="tactical-map-btn" id="tactical-center">📍 Center Me</button>
        </div>
      </div>`;

    document.body.appendChild(overlay);

    const canvas = document.getElementById('tactical-canvas') as HTMLCanvasElement;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width || 600;
    canvas.height = rect.height || 600;

    let mapZoom = 1.0;
    let panX = me ? me.head.x : WORLD / 2;
    let panY = me ? me.head.y : WORLD / 2;

    const drawMap = () => {
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const W = WORLD; // §8 world is 6000 — a hardcoded 3000 drew only a quarter of the map
      const scale = (canvas.width / W) * mapZoom;
      const cx = canvas.width / 2;
      const cy = canvas.height / 2;

      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(scale, scale);
      ctx.translate(-panX, -panY);

      // World Boundary Grid
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 6;
      ctx.strokeRect(0, 0, W, W);

      // Grid Lines
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 1;
      for (let x = 0; x <= W; x += 300) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, W); ctx.stroke();
      }
      for (let y = 0; y <= W; y += 300) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
      }

      // Safe Zone Storm Circle (only in Battle Royale / Team Battle)
      const isComp = this.selectedUIMode === 'battle_royale' || this.selectedUIMode === 'team';
      if (isComp && state?.safeZone) {
        ctx.beginPath();
        ctx.arc(state.safeZone.centerX, state.safeZone.centerY, state.safeZone.radius, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(239, 68, 68, 0.85)';
        ctx.lineWidth = 4;
        ctx.stroke();
        ctx.fillStyle = 'rgba(239, 68, 68, 0.12)';
        ctx.fill();
      }

      // Safe Sanctuary Zone
      if (state?.sanctuaryZone) {
        ctx.beginPath();
        ctx.arc(state.sanctuaryZone.centerX, state.sanctuaryZone.centerY, state.sanctuaryZone.radius, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(16, 185, 129, 0.22)';
        ctx.fill();
        ctx.strokeStyle = '#10b981';
        ctx.lineWidth = 4;
        ctx.stroke();
      }

      // Wormholes
      if (state?.portals) {
        for (const p of state.portals) {
          ctx.beginPath();
          ctx.arc(p.x, p.y, 44, 0, Math.PI * 2); // wormhole entry radius used by the sim
          ctx.fillStyle = 'rgba(139, 92, 246, 0.45)';
          ctx.fill();
          ctx.font = '28px sans-serif';
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText('🌀', p.x, p.y);
        }
      }

      // Snakes / Players
      if (state?.snakes) {
        for (const s of state.snakes) {
          if (!s.isAlive) continue;
          const isMe = s.id === this.client.localUserId;
          ctx.beginPath();
          ctx.arc(s.head.x, s.head.y, isMe ? 24 : 14, 0, Math.PI * 2);
          ctx.fillStyle = isMe ? '#22c55e' : '#ef4444';
          ctx.fill();
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 2.5;
          ctx.stroke();

          // Player Name & Crown Tag
          ctx.font = `bold ${isMe ? 18 : 12}px Outfit, sans-serif`;
          ctx.fillStyle = isMe ? '#4ade80' : '#f87171';
          ctx.textAlign = 'center';
          ctx.fillText(isMe ? `👑 ${s.displayName}` : s.displayName, s.head.x, s.head.y - 26);
        }
      }

      ctx.restore();
    };

    drawMap();

    document.getElementById('tactical-close')?.addEventListener('click', () => overlay.remove());
    document.getElementById('tactical-zoom-in')?.addEventListener('click', () => { mapZoom = Math.min(3.5, mapZoom * 1.3); drawMap(); });
    document.getElementById('tactical-zoom-out')?.addEventListener('click', () => { mapZoom = Math.max(0.5, mapZoom * 0.75); drawMap(); });
    document.getElementById('tactical-center')?.addEventListener('click', () => { if (me) { panX = me.head.x; panY = me.head.y; } mapZoom = 1.0; drawMap(); });
  }

  private triggerDamageFeedback(dmg: number, headX: number, headY: number) {
    audio.playHit?.();
    this.renderer?.triggerCameraShake(Math.min(10, Math.max(4, dmg * 0.3)), 0.25);
    this.renderer?.spawnDamageText(headX, headY, dmg, dmg >= 20);

    let flash = document.getElementById('damage-flash');
    if (!flash) {
      flash = document.createElement('div');
      flash.id = 'damage-flash';
      flash.className = 'damage-flash';
      document.body.appendChild(flash);
    }
    flash.classList.remove('active');
    void flash.offsetWidth; // force reflow
    flash.classList.add('active');
    setTimeout(() => flash?.classList.remove('active'), 350);
  }

  private renderHeartsHTML(hp: number, maxHp: number = 100, lastHp?: number): string {
    const totalHearts = 5;
    const hpPerHeart = maxHp / totalHearts; // 20 HP per heart container (100 HP max)
    let html = '';
    const isDamage = lastHp !== undefined && hp < lastHp;
    const isHeal = lastHp !== undefined && hp > lastHp;
    for (let i = 0; i < totalHearts; i++) {
      const fillPct = Math.max(0, Math.min(100, ((hp - i * hpPerHeart) / hpPerHeart) * 100));
      const heartMin = i * hpPerHeart;
      const heartMax = (i + 1) * hpPerHeart;
      let anim = '';
      if (isDamage && lastHp >= heartMin && hp < heartMax) anim = 'damaged';
      else if (isHeal && hp >= heartMin && (lastHp ?? 0) < heartMax) anim = 'healed';

      html += `
        <div class="heart-unit ${anim}">
          <svg class="heart-bg" viewBox="0 0 24 24">
            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" fill="#E2E8F0" stroke="#94A3B8" stroke-width="1.5"/>
          </svg>
          <div class="heart-fill-clip" style="height:${fillPct}%;">
            <svg class="heart-fill-svg" viewBox="0 0 24 24">
              <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" fill="#EF4444"/>
            </svg>
          </div>
          ${anim === 'damaged' ? `
          <svg class="heart-crack-svg" viewBox="0 0 24 24">
            <path d="M12 4l-2 5l4 3l-3 4l2 5" stroke="#7F1D1D" stroke-width="1.8" fill="none" stroke-linecap="round"/>
          </svg>` : ''}
        </div>`;
    }
    return html;
  }

  // ------------------------------------------------------------- HUD
  private updateHUD(state: GameStateTick, me?: SnakeData) {
    if (!me) return;
    const setW = (id: string, p: number) => { const el = document.getElementById(id); if (el) el.style.width = `${Math.max(0, Math.min(100, p))}%`; };
    const setT = (id: string, v: string) => { const el = document.getElementById(id); if (el) el.innerText = v; };
    const hp = Math.max(0, Math.round(me.hp ?? 100));
    const maxHp = Math.max(1, Math.round(me.maxHp ?? 100));
    setW('hs-health', (hp / maxHp) * 100);
    const hpFill = document.getElementById('hs-health');
    if (hpFill) {
      hpFill.style.background = hp < maxHp * 0.3
        ? 'linear-gradient(90deg, #ef4444, #f87171)'
        : hp < maxHp * 0.6
          ? 'linear-gradient(90deg, #f59e0b, #fbbf24)'
          : 'linear-gradient(90deg, #10b981, #34d399)';
    }

    if (this.lastHp !== hp) {
      if (this.lastHp !== undefined && hp < this.lastHp) {
        const dmg = Math.round(this.lastHp - hp);
        if (dmg > 0) this.triggerDamageFeedback(dmg, me.head.x, me.head.y);
      }
      const heartsRow = document.getElementById('hud-hearts-row');
      if (heartsRow) heartsRow.innerHTML = this.renderHeartsHTML(hp, maxHp, this.lastHp);
      this.lastHp = hp;
    }

    const kills = me.kills ?? 0; // toast is fired by onTick(), which owns `lastKills`

    this.setT('hv-score', String(Math.round(me.score)));
    this.setT('hud-stage', `${me.evolution || me.stage} · Lv ${me.level}`);
    // Ability (Coil Guard) readiness — the label lives inside the on-screen 🌀 button.
    const cd = me.abilityCooldown ?? 0;
    const abilityBtn = document.getElementById('touch-ability');
    const cdEl = document.getElementById('ability-cd');
    const cdText = cd <= 0 ? 'READY' : `${Math.ceil(cd)}s`;
    if (abilityBtn) abilityBtn.classList.toggle('ready', cd <= 0);
    if (cdEl && cdEl.innerText !== cdText) cdEl.innerText = cdText;

    // Active power status (🍄 super / 🛡️ shield / ⚡ speed / ✨ ability)
    const powers: string[] = [];
    const superT = Math.max(0, (me as any).superTimer ?? 0);
    const shieldT = Math.max(0, me.shieldTimer ?? 0);
    const speedT = Math.max(0, me.speedBoostTimer ?? 0);
    const abilityT = Math.max(0, me.abilityActiveTimer ?? 0);

    if (superT > 0) powers.push(`<div class="pwr super"><span class="pwr-ico">🍄</span><span class="pwr-lbl">Super</span><b class="pwr-val">${Math.ceil(superT)}s</b></div>`);
    if (shieldT > 0) powers.push(`<div class="pwr shield"><span class="pwr-ico">🛡️</span><span class="pwr-lbl">Shield</span><b class="pwr-val">${Math.ceil(shieldT)}s</b></div>`);
    if (speedT > 0) powers.push(`<div class="pwr speed"><span class="pwr-ico">⚡</span><span class="pwr-lbl">Speed</span><b class="pwr-val">${Math.ceil(speedT)}s</b></div>`);
    if (abilityT > 0) powers.push(`<div class="pwr ability"><span class="pwr-ico">✨</span><span class="pwr-lbl">Boost</span><b class="pwr-val">${Math.ceil(abilityT)}s</b></div>`);

    const newHtml = powers.join('');
    const ps = document.getElementById('power-status');
    if (ps) {
      if (powers.length) {
        if (ps.style.display !== 'flex') ps.style.display = 'flex';
        if (ps.innerHTML !== newHtml) ps.innerHTML = newHtml;
      } else {
        if (ps.style.display !== 'none') ps.style.display = 'none';
        if (ps.innerHTML !== '') ps.innerHTML = '';
      }
    }
    document.getElementById('touch-ability')?.classList.toggle('cooling', cd > 0);

    // Event Header (only for temporary map events e.g. Cherry Rain)
    const evt = document.getElementById('hud-event');
    if (evt) {
      if (state.currentEvent) {
        if (evt.style.display !== 'block') evt.style.display = 'block';
        const txt = `${state.currentEvent.icon} ${state.currentEvent.timerSeconds}s`;
        if (evt.innerText !== txt) evt.innerText = txt;
      } else {
        if (evt.style.display !== 'none') evt.style.display = 'none';
      }
    }

    // Dedicated Mode Updates
    if (this.selectedUIMode === 'team') {
      this.updateTeamBattleHUD(me, state, kills);
    } else if (this.selectedUIMode === 'battle_royale') {
      this.updateBattleRoyaleHUD(me, state, kills);
    } else {
      this.updateFreeRoamHUD(me, state, kills);
    }

    // Top 10 Leaderboard
    const lb = document.getElementById('hud-lb-rows');
    if (lb) {
      const newLbHtml = state.leaderboard.slice(0, 10).map((r, i) => {
        const crown = i === 0 ? '👑 ' : i === 1 ? '🥈 ' : i === 2 ? '🥉 ' : `<span class="lb-num">${i + 1}.</span> `;
        const hatIco = (r as any).hat ? `${HAT_ICONS[(r as any).hat] || ''} ` : '';
        return `<div class="lb-row ${r.id === this.client.localUserId ? 'me' : ''}">
          <span>${crown}${hatIco}${r.name}</span>
          <span>${r.score}</span>
        </div>`;
      }).join('');
      if (lb.innerHTML !== newLbHtml) lb.innerHTML = newLbHtml;
    }
  }

  private setT(id: string, v: string) {
    const el = document.getElementById(id);
    if (el && el.innerText !== v) el.innerText = v;
  }

  private updateFreeRoamHUD(me: any, _state: any, _kills: number) {
    // The template ships a placeholder name; fill it in from the live snake / profile.
    this.setT('hv-name', me.displayName || this.profile?.displayName || 'Explorer');
    this.setT('hv-score', String(Math.round(me.score)));
    this.setT('hud-stage', `${me.evolution || me.stage} · Lv ${me.level}`);
  }

  private updateBattleRoyaleHUD(me: any, state: any, kills: number) {
    this.setT('hv-score', String(Math.round(me.score)));
    this.setT('hud-stage', `${me.evolution || me.stage} · Lv ${me.level}`);
    const matchTimer = (state as any).matchTimer as number | undefined;
    const aliveCount = state.snakes.filter((s: any) => s.isAlive).length;
    const mm = Math.floor((matchTimer || 0) / 60), ss = Math.floor((matchTimer || 0) % 60);
    const timerStr = `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
    this.setT('br-timer', timerStr);
    this.setT('br-alive', `${aliveCount} Alive`);
    this.setT('br-kills', `${kills} Kills`);
  }

  private updateTeamBattleHUD(me: any, state: any, kills: number) {
    const matchTimer = (state as any).matchTimer as number | undefined;
    const myTeam = (me as any).team as 'red' | 'blue' | undefined;
    const redAlive = state.snakes.filter((s: any) => s.team === 'red' && s.isAlive).length;
    const blueAlive = state.snakes.filter((s: any) => s.team === 'blue' && s.isAlive).length;
    const rs = state.teamScores?.red ?? 0;
    const bs = state.teamScores?.blue ?? 0;
    const mm = Math.floor((matchTimer || 0) / 60), ss = Math.floor((matchTimer || 0) % 60);
    const timerStr = `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
    const assists = (me as any).assists ?? Math.floor(kills * 0.5);

    this.setT('tb-player-name', me.displayName || 'Explorer');
    this.setT('tb-player-score', String(Math.round(me.score)));
    this.setT('tb-player-stage', `${me.evolution || me.stage} · Lv.${me.level}`);
    this.setT('tb-player-kills', String(kills));
    this.setT('tb-player-assists', String(assists));
    this.setT('tb-blue-score', String(bs));
    this.setT('tb-red-score', String(rs));
    this.setT('tb-match-timer', timerStr);
    this.setT('tb-alive-counts', `${blueAlive} vs ${redAlive} Alive`);

    const myScore = myTeam === 'blue' ? bs : rs;
    const otherScore = myTeam === 'blue' ? rs : bs;
    const isLeading = myScore >= otherScore;
    this.setT('tb-team-rank', isLeading ? '🏆 #1 Leading' : '⚔️ #2 Chasing');

    const blueSide = document.getElementById('tb-blue-side');
    const redSide = document.getElementById('tb-red-side');
    if (blueSide) blueSide.classList.toggle('leading', bs >= rs);
    if (redSide) redSide.classList.toggle('leading', rs > bs);

    const playerCard = document.querySelector('.tb-player-card');
    if (playerCard && myTeam) {
      playerCard.classList.toggle('team-blue', myTeam === 'blue');
      playerCard.classList.toggle('team-red', myTeam === 'red');
    }
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
    if (this.screen === 'play' || this.screen === 'pause' || this.screen === 'respawn') {
      // innerHTML above replaced the <canvas> — re-point the renderer at the live element
      // (or create it) so we never draw to a detached canvas (blank-screen fix).
      const canvas = document.getElementById('game-canvas') as HTMLCanvasElement | null;
      if (canvas) { if (this.renderer) this.renderer.attach(canvas); else this.renderer = new Renderer(canvas); }
      this.applyMapTheme(); // §8 data-driven map theme + seasonal tint
      this.updateMissionTracker(); // §V7 populate the in-game mission tracker
      this.bindTouch();
    }
  }

  // ------------------------------------------------------------- APP SHELL
  private renderApp() {
    const p = this.profile;
    const nav: Array<[Page, string, string]> = [
      ['home', icons.home(22), 'Home'],
      ['play', icons.play(22), 'Play'],
      ['missions', icons.missions(22), 'Missions'],
      ['inventory', icons.inventory(22), 'Inventory'],
      ['social', icons.social(22), 'Social'],
      ['profile', icons.profile(22), 'Profile'],
    ];
    return `
      <div class="app-shell">
        <div class="app-top">
          <div class="app-top-inner">
            <div class="app-brand">
              ${icons.logo(38)}
              <div class="logo-txt">Snake Clash<small>SLITHER ARENA</small></div>
            </div>
            <div class="app-top-actions">
              <button class="icon-btn ${this.settings.music ? '' : 'off'}" id="music-toggle" title="${this.settings.music ? 'Music on' : 'Music off'}">
                ${this.settings.music ? icons.music(20) : icons.musicMuted(20)}
              </button>
              <button class="icon-btn notif-wrap" id="notif-btn" title="Notifications">
                ${icons.bell(20)}
                <span class="notif-badge" id="notif-badge" style="display:${this.invites.length ? 'grid' : 'none'};">${this.invites.length > 9 ? '9+' : this.invites.length}</span>
              </button>
              <button class="icon-btn" data-go="settings" title="Settings">
                ${icons.settings(20)}
              </button>
              <button class="icon-btn avatar-btn" data-go="profile" title="Profile">
                ${this.avatarGlyph()}
              </button>
            </div>
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
                      : this.page === 'story' ? this.pageStory()
                        : this.page === 'leaderboard' ? this.pageLeaderboard()
                          : this.page === 'stats' ? this.pageStats()
                            : this.page === 'history' ? this.pageHistory()
                              : this.page === 'admin' ? this.pageAdmin()
                                : this.pageSettings()}
        </div>
        <div class="bottom-nav">
          <div class="bottom-nav-inner">
            ${nav.map(([id, ico, label]) => `<button class="nav-item ${this.page === id ? 'active' : ''}" data-go="${id}"><span class="ni-ico">${ico}</span><span class="ni-lbl">${label}</span></button>`).join('')}
          </div>
        </div>
      </div>`;
  }

  private xpBar() {
    const p = this.profile; if (!p) return '';
    const toNext = p.xpToNext || 300; const pct = Math.min(100, (p.xp / toNext) * 100);
    return `<div class="xp-wrap"><div class="xp-bar"><div style="width:${pct}%"></div></div><div class="xp-label"><span>Level ${p.level}${p.prestige ? ` · ✨${p.prestige}` : ''}</span><span>${p.xp} / ${toNext} XP</span></div></div>`;
  }

  // ---------- HOME (clean welcome + 6 grid actions) ----------
  private pageHome() {
    const p = this.profile; const r = this.rank();
    const prince = story.princeRank(p?.level || 1);
    const toNext = p?.xpToNext || 300; const xpPct = Math.min(100, ((p?.xp || 0) / toNext) * 100);
    return `
      <div class="page">
        <div class="home-grid-layout">
          <div class="home-left-col">
            <div class="home-welcome card tint">
              <div class="hw-top">
                <div class="hw-avatar" data-go="profile">${this.avatarGlyph()}</div>
                <div class="hw-info">
                  <div class="hw-hi">Welcome back,</div>
                  <div class="hw-name">${p?.displayName || 'Explorer'}</div>
                  <div class="hw-rank">${prince.icon} ${prince.title} · <span class="rank-tag" style="color:${r.color}">🏆 ${r.label}</span></div>
                </div>
                <div class="hw-stars">${icons.star(18)} <span class="val">${p?.stars ?? 0}</span></div>
              </div>
              <div class="hw-xp">
                <div class="xp-bar"><div style="width:${xpPct}%"></div></div>
                <div class="xp-label"><span>Level ${p?.level ?? 1}${p?.prestige ? ` · ✨${p.prestige}` : ''}</span><span>${p?.xp ?? 0} / ${toNext} XP</span></div>
              </div>
            </div>

            <button class="btn btn-primary btn-lg btn-block home-play" id="home-play" style="margin-top:14px;">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg> PLAY NOW
            </button>
          </div>

          <div class="home-right-col">
            <div class="home-actions">
              <button class="home-action story" id="home-explorer"><span class="ha-ico">${icons.explorer(36)}</span><span class="ha-label">Explorer</span></button>
              <button class="home-action" data-go="missions"><span class="ha-ico">${icons.missions(36)}</span><span class="ha-label">Missions</span></button>
              <button class="home-action" data-go="inventory"><span class="ha-ico">${icons.inventory(36)}</span><span class="ha-label">Inventory</span></button>
              <button class="home-action" data-go="social"><span class="ha-ico">${icons.social(36)}</span><span class="ha-label">Friends</span></button>
              <button class="home-action" data-go="rewards"><span class="ha-ico">${icons.shop(36)}</span><span class="ha-label">Shop</span></button>
              <button class="home-action" data-go="leaderboard"><span class="ha-ico">${icons.leaderboard(36)}</span><span class="ha-label">Leaderboard</span></button>
              <button class="home-action" data-go="events"><span class="ha-ico">🎪</span><span class="ha-label">Events</span></button>
              <button class="home-action" data-go="story"><span class="ha-ico">📜</span><span class="ha-label">Story</span></button>
            </div>
          </div>
        </div>
      </div>`;
  }

  // ---------- LEADERBOARD ----------
  // §V7 leaderboard categories + scope (global / friends / local)
  private lbCategory = 'score';
  private lbScope: 'global' | 'friends' | 'local' = 'global';
  private lbEntries: any[] = [];
  private static LB_CATS: Array<[string, string]> = [
    ['level', '🎚️ Level'], ['score', '🏆 Score'], ['kills', '⚔️ Kills'], ['wins', '👑 Wins'],
    ['survival', '⏱️ Survival'], ['stars', '⭐ Stars'], ['explorer', '🗺️ Explorer'],
  ];
  private async loadLeaderboardCategory() {
    try {
      const params = new URLSearchParams({ category: this.lbCategory, scope: this.lbScope });
      if (this.lbScope === 'local') params.set('region', this.localCountry || this.profile?.country || 'Global');
      // Every scope needs auth now — the board no longer serves anonymous callers.
      const headers: any = this.token ? { Authorization: `Bearer ${this.token}` } : {};
      const res = await this.api(`/api/leaderboard?${params.toString()}`, { headers });
      const d = await res.json();
      this.lbEntries = d.entries || [];
      if (this.page === 'leaderboard') this.render();
    } catch { this.lbEntries = []; }
  }
  private pageLeaderboard() {
    const rows = this.lbEntries;
    const unit = { survival: 's', stars: '', kills: '', wins: '', score: '', level: '', explorer: '' }[this.lbCategory] || '';
    return `<div class="page"><div class="section-title">${icons.leaderboard(22)} Leaderboards</div>
      <div class="seg" style="margin-bottom:10px;">
        <button class="${this.lbScope === 'global' ? 'active' : ''}" data-lbscope="global">🌍 Global</button>
        <button class="${this.lbScope === 'friends' ? 'active' : ''}" data-lbscope="friends">👥 Friends</button>
        <button class="${this.lbScope === 'local' ? 'active' : ''}" data-lbscope="local">📍 Local</button>
      </div>
      <div class="lb-cats">${AnacondaPark.LB_CATS.map(([id, l]) => `<button class="lb-cat ${this.lbCategory === id ? 'active' : ''}" data-lbcat="${id}">${l}</button>`).join('')}</div>
      <div class="card"><div class="lb-page">
        ${rows.length ? rows.map((e: any, i: number) => `<div class="lb-page-row ${e.isYou ? 'me' : ''}">
          <span class="lbp-rank ${i < 3 ? 'top' : ''}">${['🥇', '🥈', '🥉'][i] || (i + 1)}</span>
          <span class="lbp-name">${e.avatar || ''} ${e.displayName} <span class="muted" style="font-weight:600;font-size:0.7rem;">Lv${e.level}</span></span>
          <span class="lbp-score">${e.value}${unit}</span>
        </div>`).join('') : '<div class="muted" style="text-align:center;padding:16px;">No entries yet for this board.</div>'}
      </div></div></div>`;
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
  // §7 Global Adventure — no country picking; auto-selects the lowest-latency reachable server.
  private serverCandidates(): string[] {
    // Optional multi-region list via <meta name="anaconda-servers" content="url1,url2">; else the app origin.
    const meta = document.querySelector('meta[name="anaconda-servers"]')?.getAttribute('content');
    if (meta) return meta.split(',').map(s => s.trim()).filter(Boolean);
    return [API].filter(Boolean) as string[];
  }
  private async pingServer(url: string): Promise<number> {
    const samples: number[] = [];
    for (let i = 0; i < 3; i++) {
      const t0 = performance.now();
      try {
        // /api/health, not /health — a reverse proxy that only forwards /api/* would never
        // route the latter, which is exactly how this probe used to 404 in production.
        const res = await fetch(`${url.replace(/\/$/, '')}/api/health`, { cache: 'no-store' });
        if (!res.ok) return Infinity;
        samples.push(performance.now() - t0);
      } catch { return Infinity; }
    }
    return samples.reduce((a, b) => a + b, 0) / samples.length;
  }
  // Measure real round-trip to each candidate and keep the fastest reachable one.
  private async measureGlobalPing() {
    if (this.globalPingState === 'measuring') return;
    // No backend configured for this build — don't probe an origin that has no API.
    if (!this.online) {
      this.globalPingState = 'offline';
      this.globalServerLabel = 'Offline — local play';
      if (this.page === 'play') this.render();
      return;
    }
    const candidates = this.serverCandidates();
    if (!candidates.length) { this.globalPingState = 'offline'; if (this.page === 'play') this.render(); return; }
    this.globalPingState = 'measuring';
    if (this.page === 'play') this.render();
    let best = { url: candidates[0], ping: Infinity };
    for (const url of candidates) {
      const ping = await this.pingServer(url);
      if (ping < best.ping) best = { url, ping };
    }
    if (best.ping === Infinity) {
      this.globalPingState = 'offline';
      this.globalServerLabel = 'Offline — local play';
    } else {
      this.globalPing = Math.round(best.ping);
      this.globalPingState = 'ok';
      this.client.preferredServer = best.url === API ? '' : best.url;
      this.globalServerLabel = candidates.length > 1 ? `Best of ${candidates.length} servers` : 'Best available server';
    }
    if (this.page === 'play') this.render();
  }
  private renderGlobalMatch() {
    const pingHtml = this.globalPingState === 'measuring' ? '<span class="mm-ping measuring">…</span>'
      : this.globalPingState === 'offline' ? '<span class="mm-ping offline">local</span>'
      : this.globalPingState === 'ok' ? `<span class="mm-ping">${this.globalPing}ms</span>`
      : '<span class="mm-ping">—</span>';
    return `<div class="mm-global">
      <div class="mm-server">
        <span class="mm-dot ${this.globalPingState === 'offline' ? 'off' : ''}"></span>
        <div style="flex:1;"><div style="font-weight:800;">${this.globalServerLabel}</div><div class="muted" style="font-size:0.76rem;">Auto-selected by measured latency &amp; availability</div></div>
        ${pingHtml}
      </div>
      <div class="muted" style="font-size:0.8rem;margin-top:8px;">Global Adventure connects you to the strongest worldwide server automatically — nothing to pick.</div>
    </div>`;
  }

  // §7 Local Explorer — Country → State → City; auto-joins your local region, browsable.
  private ensureLocalLocation() {
    if (this.localCountry && LOCATIONS[this.localCountry]) return;
    const pc = this.profile?.country;
    this.localCountry = (pc && LOCATIONS[pc]) ? pc : 'India';
    this.localState = Object.keys(LOCATIONS[this.localCountry])[0];
    this.localCity = LOCATIONS[this.localCountry][this.localState][0];
  }
  private renderLocalMatch() {
    this.ensureLocalLocation();
    const states = Object.keys(LOCATIONS[this.localCountry] || {});
    const cities = LOCATIONS[this.localCountry]?.[this.localState] || [];
    return `<div class="mm-local">
      <div class="muted" style="font-size:0.8rem;margin-bottom:8px;">Auto-joining players near you — browse to explore another location. Your exact GPS is never shared.</div>
      <div class="mm-loc-grid">
        <label class="mm-loc"><span>Country</span><select id="loc-country">${Object.keys(LOCATIONS).map(c => `<option ${c === this.localCountry ? 'selected' : ''}>${c}</option>`).join('')}</select></label>
        <label class="mm-loc"><span>State</span><select id="loc-state">${states.map(s => `<option ${s === this.localState ? 'selected' : ''}>${s}</option>`).join('')}</select></label>
        <label class="mm-loc"><span>City</span><select id="loc-city">${cities.map(ci => `<option ${ci === this.localCity ? 'selected' : ''}>${ci}</option>`).join('')}</select></label>
      </div>
      <div class="mm-here">📍 Joining <b>${this.localCity}, ${this.localState}, ${this.localCountry}</b></div>
    </div>`;
  }

  private pagePlay() {
    return `
      <div class="page page-play">
        <div class="card card-mm">
          <div class="section-title">${icons.globe(20)} Matchmaking</div>
          <div class="seg mm-seg">
            <button class="${this.matchType === 'global' ? 'active' : ''}" data-mt="global">${icons.globe(16)} Global Adventure</button>
            <button class="${this.matchType === 'local' ? 'active' : ''}" data-mt="local">${icons.pin(16)} Local Explorer</button>
          </div>
          ${this.matchType === 'global' ? this.renderGlobalMatch() : this.renderLocalMatch()}
        </div>

        <div class="card card-mode-select">
          <div class="section-title">${icons.play(20)} Choose a Mode</div>
          <div class="mode-grid">
            ${UI_MODE_ORDER.map(m => {
              const def = UI_MODES[m];
              const sel = this.selectedUIMode === m;
              let modeIco = icons.modeFreeRoam(36);
              if (m === 'explorer') modeIco = icons.modeStory(36);
              else if (m === 'battle_royale') modeIco = icons.modeBattleRoyale(36);
              else if (m === 'team') modeIco = icons.modeTeamBattle(36);
              else if (m === 'nokia') modeIco = icons.modeClassic(36);
              else if (m === 'event') modeIco = icons.modeEvent(36);
              return `
              <div class="mode-card ${sel ? 'selected' : ''} ${def.enabled ? '' : 'disabled'}" data-mode="${m}">
                ${def.enabled ? '' : '<span class="mood" style="background:#94a3b8">SOON</span>'}
                <div class="mode-icon">${modeIco}</div>
                <div class="mode-name">${def.name}</div>
                <div class="mode-tag">${def.tag}</div>
              </div>`;
            }).join('')}
          </div>
          <div class="mode-rules muted"><b>${this.modeDef.name}</b> — ${this.modeDef.rules}</div>
          <button class="btn btn-primary btn-lg btn-block" id="enter-btn" ${this.modeDef.enabled ? '' : 'disabled'}>${this.modeDef.enabled ? `🚀 Enter ${this.modeDef.name}` : '🔒 Enabled during live events'}</button>
        </div>
      </div>`;
  }

  // ---------- MISSIONS ----------
  private pageMissions() {
    const cats: Array<[typeof this.missionCat, string]> = [['daily', 'Daily'], ['weekly', 'Weekly'], ['event', 'Event'], ['achievements', 'Achievements']];
    return `
      <div class="page">
        <div class="section-title">${icons.missions(22)} Missions & Awards</div>
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
      // Grouped by family with glossy 2D snake preview cards. Ownership, price and level gates
      // all come from the server catalog — the card just renders whichever state applies.
      const ownedCount = SKINS.filter(s => this.ownsSkin(s.id)).length;
      content = `<div class="skins-summary muted">🐍 ${ownedCount} of ${SKINS.length} skins unlocked · ⭐ ${this.profile?.stars ?? 0} available</div>`
        + SKIN_FAMILIES.map(fam => `
        <div class="skin-family">
          <div class="skin-family-title">${fam.icon} ${fam.family} FAMILY</div>
          <div class="skin-family-row">${fam.skins.map(s => {
            const isEq = this.selectedSkin === s.id;
            const meta = this.skinMeta(s.id);
            const owned = this.ownsSkin(s.id);
            const locked = !owned;
            const tag = isEq ? '✓ Equipped'
              : owned ? 'Tap to Equip'
              : meta && !meta.levelMet ? `🔒 Lv ${meta.minLevel}`
              : meta ? `${meta.costStars} ⭐` : '🔒 Locked';
            const tagClass = isEq ? 'equipped' : owned ? '' : meta?.affordable && meta?.levelMet ? 'buyable' : 'locked';
            return `
            <div class="skin-card ${isEq ? 'equipped' : ''} ${locked ? 'locked' : ''}" data-skin="${s.id}">
              <div class="skin-swatch-wrap">
                <div class="skin-swatch" style="background:${s.grad}">
                  <div class="skin-pattern"></div>
                  <div class="skin-eye eye-left"></div>
                  <div class="skin-eye eye-right"></div>
                </div>
                ${locked ? '<div class="skin-lock">🔒</div>' : ''}
              </div>
              <div class="skin-name">${s.name}</div>
              <div class="skin-tag ${tagClass}">${tag}</div>
            </div>`;
          }).join('')}
          </div>
        </div>`).join('');
    } else if (this.invTab === 'accessories') {
      const rarityColors: Record<string, string> = { common: '#6b7280', rare: '#3b82f6', epic: '#a855f7', legendary: '#f59e0b' };
      content = `<div class="accessories-intro muted" style="font-size:0.82rem;margin-bottom:12px;">🎮 Cosmetic Accessories — Custom crowns, hats & trail visual effects. Collect via missions, events & shop.</div>
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
      // §V7 Owned items (eggs / event items) earned via missions & the daily bonus — real, from the profile.
      const inv: Record<string, number> = this.profile?.inventory || {};
      const ITEM_META: Record<string, { icon: string; name: string }> = {
        rare_egg: { icon: '🥚', name: 'Rare Egg' }, golden_chest: { icon: '🎁', name: 'Golden Chest' }, mystery_egg: { icon: '🥚', name: 'Mystery Egg' },
      };
      const owned = Object.entries(inv).filter(([, n]) => n > 0);
      const ownedHtml = owned.length ? `
        <div class="section-subtitle" style="font-weight:800;font-size:0.85rem;margin:2px 0 10px;">🎒 Your Items</div>
        <div class="powerups-grid" style="margin-bottom:16px;">${owned.map(([id, n]) => {
          const meta = ITEM_META[id] || { icon: '📦', name: id.replace(/_/g, ' ') };
          return `<div class="item-card"><div class="i-ico">${meta.icon}</div><div style="flex:1;"><div class="i-name">${meta.name}</div><div class="i-sub">Collected reward</div></div><div class="i-val-badge">×${n}</div></div>`;
        }).join('')}</div>` : '';
      content = ownedHtml + `<div class="section-subtitle" style="font-weight:800;font-size:0.85rem;margin:2px 0 10px;">⚡ Power-Ups</div><div class="powerups-grid">${POWERUPS.map(p => `
        <div class="item-card">
          <div class="i-ico">${p.icon}</div>
          <div style="flex:1;">
            <div class="i-name">${p.name}</div>
            <div class="i-sub">${p.sub}</div>
          </div>
          <div class="i-val-badge">${p.val}</div>
        </div>
      `).join('')}</div>
      <div class="muted" style="font-size:0.8rem;padding:12px 4px;text-align:center;">Boosters, Mystery Eggs, Golden Chests & Speed Trails collected during gameplay are stored here.</div>`;
    } else {
      const coupons = this.profile?.coupons || [];
      const claimable = this.availableCoupons.filter(c => c.eligible);
      const claimSection = claimable.length ? `
        <div class="section-subtitle" style="font-weight:800;font-size:0.85rem;margin:2px 0 10px;">🎟️ Available to Claim</div>
        <div class="coupons-grid" style="margin-bottom:18px;">${claimable.map((c: any) => `
          <div class="coupon-card">
            <div class="coupon-left">
              <div class="r-ico">${c.icon || '🎟️'}</div>
              <div>
                <div class="coupon-title">${c.title}</div>
                <div class="coupon-desc">${c.discountText} · ${c.storeName}</div>
                <div class="coupon-code">${c.costStars > 0 ? `Cost: <b>${c.costStars} ⭐</b>` : '<b>Free reward</b>'}</div>
              </div>
            </div>
            <button class="btn btn-primary coupon-claim-btn" data-coupon="${c.id}" style="padding:8px 14px;font-size:0.8rem;">Claim</button>
          </div>
        `).join('')}</div>` : '';
      const ownedSection = `<div class="section-subtitle" style="font-weight:800;font-size:0.85rem;margin:2px 0 10px;">🎫 My Coupons</div>
        <div class="coupons-grid">${coupons.length ? coupons.map((c: any) => `
        <div class="coupon-card">
          <div class="coupon-left">
            <div class="r-ico">${icons.ticket(28)}</div>
            <div>
              <div class="coupon-title">${c.storeName}</div>
              <div class="coupon-desc">${c.discountText}</div>
              <div class="coupon-code">CODE: <b>${c.promoCode}</b></div>
            </div>
          </div>
          <button class="btn btn-ghost copy-btn" data-code="${c.promoCode}" style="padding:8px 14px;font-size:0.8rem;display:inline-flex;align-items:center;gap:6px;">${icons.copy(16)} Copy</button>
        </div>
      `).join('') : '<div class="muted" style="text-align:center;padding:24px;">No coupons collected yet — claim one above or grab gift boxes near partner stores during matches!</div>'}</div>`;
      content = claimSection + ownedSection;
    }
    return `<div class="page"><div class="section-title">${icons.inventory(22)} Inventory</div><div class="tabs">${tabs.map(([id, l]) => `<button class="tab ${this.invTab === id ? 'active' : ''}" data-inv="${id}">${l}</button>`).join('')}</div><div class="card">${content}</div></div>`;
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
            <div class="hw-avatar" style="width:56px;height:56px;font-size:1.6rem;">${this.avatarGlyph()}</div>
            <div style="flex:1;min-width:0;">
              <div style="font-family:var(--font-title);font-weight:900;font-size:1.2rem;">${p.displayName}${p.title ? ` <span class="pill gold" style="font-size:0.66rem;">${p.title}</span>` : ''}</div>
              <div style="font-size:0.82rem;color:var(--green-deep);font-weight:700;margin-top:2px;">${story.princeRank(p.level).icon} ${story.princeRank(p.level).title}</div>
              <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:4px;">
                <span class="rank-badge" style="background:${r.color}22;border-color:${r.color}55;color:${r.color}">🏆 ${r.label}</span>
                <span class="rank-badge" style="background:#eef6f0;color:var(--ink)">Lvl ${p.level}${p.prestige ? ` ✨${p.prestige}` : ''}</span>
                ${p.country ? `<span class="rank-badge" style="background:#eef6f0;color:var(--ink)">📍 ${p.country}</span>` : ''}
              </div>
              ${p.friendCode ? `<div class="fc-inline">🆔 <code class="fc-code sm">${p.friendCode}</code><button class="btn btn-ghost copy-btn" data-code="${p.friendCode}" style="padding:3px 8px;font-size:0.68rem;">Copy</button></div>` : ''}
            </div>
            <button class="btn btn-ghost" id="edit-profile-btn" style="padding:7px 12px;font-size:0.78rem;">✏️ Edit</button>
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
          <button class="btn btn-ghost btn-block" data-go="stats" style="margin-top:10px;">📊 View Full Statistics →</button>
        </div>

        <div class="card">
          <div class="section-title">🐍 Favourite Snake</div>
          <div style="display:flex;align-items:center;gap:12px;">
            <div class="skin-swatch" style="width:44px;height:44px;border-radius:12px;background:${(SKINS.find(s => s.id === p.equippedSkin) || SKINS[0]).grad}"></div>
            <div><div style="font-weight:800;">${p.equippedSkin || 'Forest'}</div><div class="muted" style="font-size:0.78rem;">Change it in Inventory → Skins</div></div>
          </div>
        </div>

        <div class="card">
          <div class="section-title">📜 Recent Matches</div>
          <div class="list">
            ${(() => { const h = this.loadHistory(); return h.length ? h.slice(0, 5).map((m: any) => `<div class="hist-row"><span class="hist-mode">${m.mode}</span><span class="hist-detail">#${m.placement} · ${m.score} pts · ⚔️${m.kills}</span><span class="hist-time">${this.timeAgo(m.at)}</span></div>`).join('') : '<div class="muted" style="text-align:center;padding:12px;">No matches yet — play to build your history.</div>'; })()}
          </div>
          <button class="btn btn-ghost btn-block" data-go="history" style="margin-top:10px;">📜 Full Match History →</button>
        </div>
      </div>`;
  }

  // ---------- §V7 Full Statistics page ----------
  private pageStats() {
    const p = this.profile; if (!p) return '<div class="page"><div class="card muted">Loading…</div></div>';
    const s = p.stats || {};
    const d = p.derivedStats || { winRate: 0, kd: 0 };
    const modeStats = p.modeStats || {};
    const favMode = (() => {
      let best = ''; let n = -1;
      for (const [k, v] of Object.entries<any>(modeStats)) if ((v?.matchesPlayed || 0) > n) { n = v.matchesPlayed; best = k; }
      return best ? this.statModeLabel(best) : '—';
    })();
    const hrs = (s.survivalTimeSeconds / 3600).toFixed(1);
    const cell = (v: any, l: string) => `<div class="stat-cell"><div class="sv">${v}</div><div class="sl">${l}</div></div>`;
    const modeCard = (key: string, m: any) => {
      if (!m) return '';
      const rows: Array<[string, any]> = [['Played', m.matchesPlayed], ['Wins', m.wins], ['Best Score', m.highestScore], ['Kills', m.kills], ['Deaths', m.deaths], ['Best Survival', `${Math.round((m.longestSurvivalSeconds || 0) / 60)}m`], ['Stars', m.stars]];
      if (key === 'battle_royale') { rows.push(['Top 3', m.top3 || 0]); rows.push(['Best Rank', m.highestRank ? `#${m.highestRank}` : '—']); }
      if (key === 'team') { rows.push(['Assists', m.assists || 0]); rows.push(['MVP', m.mvp || 0]); }
      if (key === 'explorer') { rows.push(['Chapters', m.chaptersCompleted || 0]); rows.push(['Bosses', m.bossesDefeated || 0]); }
      if (key === 'classic') { rows.push(['Longest Snake', m.longestSnake || 0]); rows.push(['Best Time', `${Math.round((m.bestTimeSeconds || 0))}s`]); }
      return `<div class="card"><div class="section-title">${this.statModeLabel(key)}</div><div class="stat-grid">${rows.map(([l, v]) => cell(v, l)).join('')}</div></div>`;
    };
    return `<div class="page">
      <div class="section-title" style="display:flex;align-items:center;gap:8px;"><button class="btn btn-ghost" data-go="profile" style="padding:4px 10px;">←</button> 📊 Player Statistics</div>
      <div class="card"><div class="section-title">General</div><div class="stat-grid">
        ${cell(p.level, 'Level')}${cell(p.equippedEvolution, 'Evolution')}${cell(s.matchesPlayed, 'Matches')}${cell(s.matchesWon, 'Wins')}
        ${cell(s.matchesLost, 'Losses')}${cell(d.winRate + '%', 'Win Rate')}${cell(hrs + 'h', 'Hours')}${cell(favMode, 'Favourite')}
        ${cell(s.highestScore, 'Best Score')}${cell(Math.round(s.totalDistanceKm || 0) + 'km', 'Distance')}${cell(s.totalStars, 'Stars')}${cell(s.couponsEarned, 'Coupons')}
      </div></div>
      <div class="card"><div class="section-title">⚔️ Combat</div><div class="stat-grid">
        ${cell(s.totalKills, 'Total Kills')}${cell(s.totalDeaths, 'Deaths')}${cell(d.kd, 'K/D')}${cell(s.longestKillStreak, 'Best Streak')}
        ${cell(s.mostKillsInMatch, 'Most / Match')}${cell(Math.round((s.longestSurvivalSeconds || 0) / 60) + 'm', 'Longest Life')}${cell(s.mostDamageDealt, 'Max Dmg')}${cell(s.mostDamageReceived, 'Max Taken')}
      </div></div>
      <div class="card"><div class="section-title">🍒 Collectibles</div><div class="stat-grid">
        ${cell(s.cherriesCollected, 'Cherries')}${cell(s.applesCollected, 'Apples')}${cell(s.frogsCollected, 'Frogs')}${cell(s.powerupsCollected, 'Power-ups')}
      </div></div>
      ${['free_roam', 'explorer', 'battle_royale', 'team', 'classic'].map(k => modeCard(k, (modeStats as any)[k])).join('')}
    </div>`;
  }

  private statModeLabel(k: string): string {
    return { free_roam: '🌿 Free Roam', explorer: '🗺️ Explorer', battle_royale: '🔥 Battle Royale', team: '⚔️ Team Battle', classic: '🐍 Classic Snake' }[k] || k;
  }

  // ---------- §V7 Match History page ----------
  private matchHistory: any[] = [];
  private async loadMatchHistory() {
    if (!this.token) return;
    try {
      const res = await this.api('/api/player/history?limit=25', { headers: { Authorization: `Bearer ${this.token}` } });
      if (res.ok) { const d = await res.json(); this.matchHistory = d.history || []; if (this.page === 'history') this.render(); }
    } catch { /* keep local fallback */ }
  }
  private pageHistory() {
    const server = this.matchHistory;
    const rows = server.length ? server : this.loadHistory().map((m: any) => ({ at: new Date(m.at).toISOString(), mode: m.mode, score: m.score, kills: m.kills, deaths: 1, stars: 0, rewards: '', result: m.placement === 1 ? 'win' : 'loss', durationSeconds: m.survival, rank: m.placement }));
    return `<div class="page">
      <div class="section-title" style="display:flex;align-items:center;gap:8px;"><button class="btn btn-ghost" data-go="profile" style="padding:4px 10px;">←</button> 📜 Match History</div>
      ${rows.length ? `<div class="list">${rows.map((m: any) => `
        <div class="match-row ${m.result}">
          <div class="mr-top"><span class="mr-mode">${this.statModeLabel(m.mode) || m.mode}</span><span class="mr-result ${m.result}">${m.result === 'win' ? '🏆 Win' : 'Loss'}</span></div>
          <div class="mr-stats"><span>⭐ ${m.score}</span><span>⚔️ ${m.kills}</span><span>💀 ${m.deaths}</span><span>⏱️ ${Math.round((m.durationSeconds || 0))}s</span>${m.rank ? `<span>#${m.rank}</span>` : ''}</div>
          <div class="mr-foot"><span class="muted">${m.map || ''} ${m.rewards || ''}</span><span class="muted">${this.timeAgo(new Date(m.at).getTime())}</span></div>
        </div>`).join('')}</div>` : '<div class="card muted" style="text-align:center;padding:24px;">No matches recorded yet. Play a match to start your history!</div>'}
    </div>`;
  }

  private timeAgo(t: number): string {
    const s = Math.floor((Date.now() - t) / 1000);
    if (s < 60) return 'just now';
    if (s < 3600) return `${Math.floor(s / 60)}m ago`;
    if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
    return `${Math.floor(s / 86400)}d ago`;
  }

  // ---------- §6 Edit Profile overlay ----------
  private showEditProfile() {
    const p = this.profile || {};
    document.getElementById('edit-overlay')?.remove();
    const el = document.createElement('div');
    el.id = 'edit-overlay';
    el.className = 'onb-overlay';
    const titles = ['', ...story.PRINCE_RANKS.filter(rk => (p.level || 1) >= rk.min).map(rk => rk.title)];
    el.innerHTML = `
      <div class="onb-card">
        <div class="onb-title">✏️ Edit Profile</div>
        <div class="onb-sub">Your username is permanent; the display name can change (7-day cooldown).</div>
        <label class="onb-label">Display Name</label>
        <input id="ep-name" class="onb-input" maxlength="16" value="${(p.displayName || '').replace(/"/g, '&quot;')}" />
        <label class="onb-label">Avatar</label>
        <div class="onb-avatars">${ONB_AVATARS.map(a => `<button class="onb-av ${(localStorage.getItem('ap_avatar') || '🐍') === a ? 'sel' : ''}" data-epav="${a}">${a}</button>`).join('')}</div>
        <label class="onb-label">Title</label>
        <select id="ep-title" class="onb-input">${titles.map(t => `<option ${p.title === t ? 'selected' : ''}>${t || 'None'}</option>`).join('')}</select>
        <div class="onb-row">
          <div><label class="onb-label">Country</label><select id="ep-country" class="onb-input">${ONB_COUNTRIES.map(c => `<option ${p.country === c ? 'selected' : ''}>${c}</option>`).join('')}</select></div>
          <div><label class="onb-label">Preferred Region</label><select id="ep-region" class="onb-input">${REGIONS.map(rg => `<option ${p.preferredRegion === rg ? 'selected' : ''}>${rg}</option>`).join('')}</select></div>
        </div>
        <button class="btn btn-primary btn-block onb-submit" id="ep-save">💾 Save</button>
        <button class="btn btn-ghost btn-block" id="ep-cancel" style="margin-top:8px;">Cancel</button>
        <div id="ep-msg" class="onb-uname"></div>
      </div>`;
    document.body.appendChild(el);
    let avatar = localStorage.getItem('ap_avatar') || '🐍';
    el.querySelectorAll('[data-epav]').forEach(b => b.addEventListener('click', () => { avatar = (b as HTMLElement).dataset.epav!; el.querySelectorAll('.onb-av').forEach(a => a.classList.toggle('sel', a === b)); }));
    document.getElementById('ep-cancel')?.addEventListener('click', () => { audio.playClick(); el.remove(); });
    document.getElementById('ep-save')?.addEventListener('click', () => this.saveEditProfile(avatar));
  }

  private async saveEditProfile(avatar: string) {
    audio.playClick();
    const name = (document.getElementById('ep-name') as HTMLInputElement)?.value.trim();
    const title = (document.getElementById('ep-title') as HTMLSelectElement)?.value;
    const country = (document.getElementById('ep-country') as HTMLSelectElement)?.value;
    const region = (document.getElementById('ep-region') as HTMLSelectElement)?.value;
    const msg = document.getElementById('ep-msg');
    try {
      const res = await this.api(`/api/player/edit-profile`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.token}` },
        body: JSON.stringify({ displayName: name, title: title === 'None' ? '' : title, country, region }),
      });
      const d = await res.json();
      if (d.success && d.profile) { this.profile = d.profile; }
      else { if (msg) { msg.className = 'onb-uname bad'; msg.innerText = `✕ ${d.error || 'Could not save'}`; } return; }
    } catch {
      // Offline / deployed — apply locally.
      this.profile = { ...this.profile, displayName: name || this.profile.displayName, title: title === 'None' ? '' : title, country, preferredRegion: region };
    }
    try { localStorage.setItem('ap_avatar', avatar); } catch { /* */ }
    this.persistSession();
    document.getElementById('edit-overlay')?.remove();
    this.render();
    this.showToast('✅ Profile updated');
  }

  // ---------- EVENTS (server-driven) ----------
  // `live` = world events actually running inside a simulation right now; `scheduled` = the
  // live-ops calendar from the server config. Both are content, so ops can add an event
  // without a client release.
  private events: { live: any[]; scheduled: any[]; season?: string } = { live: [], scheduled: [] };
  private async loadEvents() {
    try {
      const res = await this.api('/api/events');
      if (!res.ok) return;
      const d = await res.json();
      this.events = { live: d.live || [], scheduled: d.scheduled || [], season: d.season };
      if (this.page === 'events') this.render();
    } catch { /* offline — keep whatever we last saw */ }
  }

  private static MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  // "Live now", or when the event next comes round.
  private eventWhen(e: any): string {
    if (e.live) return 'Live now';
    if (e.endsAt) return `Ends ${new Date(e.endsAt).toLocaleDateString()}`;
    if (e.startsAt) return `Starts ${new Date(e.startsAt).toLocaleDateString()}`;
    if (!e.months?.length) return 'Announced soon';
    const now = new Date().getMonth() + 1;
    const next = e.months.find((m: number) => m >= now) ?? e.months[0];
    return `In ${AnacondaPark.MONTH_NAMES[next - 1]}`;
  }

  private pageEvents() {
    const { live, scheduled } = this.events;
    const row = (icon: string, name: string, desc: string, tag: string, on: boolean, extra = '') => `
      <div class="row-card ${on ? 'event-live' : ''}"><div class="r-ico">${icon}</div>
        <div class="r-body"><div class="r-title">${name}${on ? ' <span class="live-dot"></span>' : ''}</div>
          <div class="r-desc">${desc}</div>${extra}</div>
        <span class="pill ${on ? 'gold' : 'done'}">${tag}</span></div>`;

    const liveHtml = live.length ? `
      <div class="section-subtitle" style="font-weight:800;font-size:0.85rem;margin:2px 0 10px;">🔴 Happening in-game now</div>
      <div class="list">${live.map(e => row(e.icon, e.name, e.description,
        e.timerSeconds ? `${Math.max(0, Math.round(e.timerSeconds))}s` : 'Live', true,
        `<div class="r-count">${this.statModeLabel(e.mode) || e.mode}</div>`)).join('')}</div>` : '';

    const scheduledHtml = scheduled.length ? `
      <div class="section-subtitle" style="font-weight:800;font-size:0.85rem;margin:14px 0 10px;">📅 Event calendar</div>
      <div class="list">${scheduled.map(e => row(e.icon, e.name, e.description, this.eventWhen(e), !!e.live,
        e.rewardHint ? `<div class="r-count">🎁 ${e.rewardHint}</div>` : '')).join('')}</div>` : '';

    const empty = !live.length && !scheduled.length
      ? '<div class="card muted" style="text-align:center;padding:24px;">No events available right now — check back soon!</div>' : '';

    return `<div class="page">
      <div class="section-title">🎪 Events${this.events.season ? ` <span class="pill">${this.events.season}</span>` : ''}</div>
      ${empty}${liveHtml}${scheduledHtml}
      <div class="muted" style="font-size:0.78rem;margin-top:10px;">World events rotate inside matches automatically; calendar events unlock seasonal maps, skins and bonus rewards.</div>
    </div>`;
  }

  private pageSocial() {
    const s = this.social;
    const req = s.incoming;
    const pending = s.outgoing;
    const blocked = s.blocked;
    const myCode = s.myFriendCode || this.profile?.friendCode || '';
    return `<div class="page">
      ${this.renderInvitesSection()}
      <!-- Add Friend & Pending Requests -->
      <div class="card">
        <div class="section-title">${icons.addFriend(20)} Add Friends</div>
        ${myCode ? `
        <div class="friend-code-card">
          <div class="fc-label">Your Friend Code — share this to get invited</div>
          <div class="fc-row">
            <code class="fc-code" id="my-friend-code">${myCode}</code>
            <button class="btn btn-ghost copy-btn" data-code="${myCode}" style="padding:7px 12px;font-size:0.76rem;">${icons.copy(16)} Copy</button>
          </div>
        </div>` : ''}
        <div class="friend-search-wrap">
          <input type="text" id="friend-search-input" placeholder="Username or friend code (AP-XXXX-XXXX)" class="friend-search-input" />
          <button class="btn btn-primary" id="friend-send-btn" style="padding:9px 14px;font-size:0.82rem;">Send Request</button>
        </div>
        ${req.length ? `
          <div style="margin-top:12px;">
            <div style="font-size:0.75rem;font-weight:800;color:var(--muted);margin-bottom:6px;letter-spacing:0.5px;">FRIEND REQUESTS (${req.length})</div>
            ${req.map(r => `
              <div class="row-card" style="padding:8px 12px;margin-bottom:6px;">
                <div class="friend-avatar" style="width:34px;height:34px;font-size:1rem;">${r.avatar || '👤'}</div>
                <div class="r-body">
                  <div class="r-title" style="font-size:0.88rem;">${r.name}</div>
                  <div class="r-desc" style="font-size:0.72rem;">Lv ${r.level} · wants to be friends</div>
                </div>
                <div style="display:flex;gap:6px;">
                  <button class="btn btn-primary freq-accept" data-id="${r.id}" style="padding:5px 10px;font-size:0.72rem;">Accept</button>
                  <button class="btn btn-ghost freq-decline" data-id="${r.id}" style="padding:5px 10px;font-size:0.72rem;">Decline</button>
                </div>
              </div>
            `).join('')}
          </div>
        ` : ''}
        ${pending.length ? `<div style="margin-top:10px;font-size:0.72rem;color:var(--muted);">Sent (awaiting): ${pending.map(p => p.name).join(', ')}</div>` : ''}
      </div>

      <!-- Friends List Card -->
      <div class="card">
        <div class="section-title">${icons.social(20)} Friends (${s.friends.length})</div>
        <div class="list">
          ${s.friends.length ? s.friends.map(f => {
            const statusHtml = f.online ? `<span style="color:#059669;font-weight:700;">🟢 Online</span>` : `<span class="muted">Offline</span>`;
            return `
              <div class="friend-card">
                <div class="friend-avatar">${f.avatar || (f.name || 'F')[0].toUpperCase()}</div>
                <div class="friend-info">
                  <div style="display:flex;align-items:center;justify-content:space-between;">
                    <div class="friend-name">${f.name} <span class="muted" style="font-weight:600;font-size:0.72rem;">Lv ${f.level}</span></div>
                    <div class="dot ${f.online ? '' : 'off'}" title="${f.online ? 'Online' : 'Offline'}"></div>
                  </div>
                  <div class="friend-status">${statusHtml}</div>
                  <div class="friend-actions-row">
                    <button class="btn btn-ghost friend-invite-match" data-id="${f.id}" ${f.online ? '' : 'disabled'} style="padding:5px 9px;font-size:0.72rem;">🎮 Invite</button>
                    <button class="btn btn-ghost friend-unfriend" data-id="${f.id}" style="padding:5px 9px;font-size:0.72rem;">Remove</button>
                    <button class="btn btn-ghost friend-block" data-id="${f.id}" style="padding:5px 9px;font-size:0.72rem;color:#b91c1c;">Block</button>
                  </div>
                </div>
              </div>`;
          }).join('') : '<div class="muted" style="text-align:center;padding:16px;">No friends yet. Add someone by their exact username above!</div>'}
        </div>
      </div>

      ${blocked.length ? `<div class="card">
        <div class="section-title">🚫 Blocked (${blocked.length})</div>
        <div class="list">${blocked.map(b => `
          <div class="friend-card"><div class="friend-avatar">${b.avatar || '👤'}</div>
            <div class="friend-info"><div class="friend-name">${b.name}</div>
              <div class="friend-actions-row"><button class="btn btn-ghost friend-unblock" data-id="${b.id}" style="padding:5px 9px;font-size:0.72rem;">Unblock</button></div>
            </div></div>`).join('')}</div>
      </div>` : ''}
    </div>`;
  }

  // ---------- REWARDS MARKETPLACE (§15) ----------
  private async loadRewards() {
    try {
      const res = await this.api(`/api/rewards/catalog?region=${encodeURIComponent(this.rewardRegion)}`);
      const data = await res.json();
      this.rewards = data.items || [];
    } catch { this.rewards = []; }
    if (this.page === 'rewards') this.render();
  }

  private async redeemReward(itemId: string) {
    audio.playClick();
    try {
      const res = await this.api(`/api/rewards/redeem`, {
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

  // §8 Data-driven map theme — Explorer advances biomes with story progress; a seasonal
  // tint auto-applies by month. Themes/seasons come from the server maps config (addable
  // via game-config.json with no code change). No-ops offline (renderer keeps its default).
  private applyMapTheme() {
    if (!this.renderer) return;
    const maps = this.serverConfig?.maps;
    const themes = maps?.themes || [];
    if (!themes.length) return;
    let themeId = 'forest';
    if (this.selectedUIMode === 'explorer') {
      const chapterIdx = Math.max(0, Math.floor(((this.profile?.level || 1) - 1) / 20));
      themeId = themes[chapterIdx % themes.length].id;
    } else if (this.selectedUIMode === 'nokia') {
      themeId = 'forest'; // classic stays clean
    }
    const theme = themes.find((t: any) => t.id === themeId) || themes[0];
    this.activeMapTheme = theme.id;
    const season = (maps.seasons || []).find((s: any) => s.id === maps.activeSeason);
    this.renderer.applyTheme({ sky: theme.sky, grid: theme.grid, accent: theme.accent, tint: season?.tint || '' });
  }

  // §8 Presence heartbeat — ping every 45s (and immediately) so friends see us online
  // even while browsing menus, not only during a match.
  private presenceTimer: any = null;
  private startPresenceHeartbeat() {
    if (this.presenceTimer || !this.token || this.token === 'guest_local_token') return;
    // The socket only exists during a match, so the lobby learns about new invites on the
    // same beat that keeps us visible to friends — one timer, not two.
    const ping = () => {
      this.api('/api/presence/ping', { method: 'POST', headers: { Authorization: `Bearer ${this.token}` } }).catch(() => {});
      this.loadInvites();
    };
    ping();
    this.presenceTimer = setInterval(ping, 45000);
  }

  // §8 Load the server-driven social graph (friends / requests / blocked + online status).
  private async loadSocial() {
    if (!this.token) return;
    try {
      const res = await this.api(`/api/social/overview`, { headers: { Authorization: `Bearer ${this.token}` } });
      if (!res.ok) return;
      const d = await res.json();
      this.social = { friends: d.friends || [], incoming: d.incoming || [], outgoing: d.outgoing || [], blocked: d.blocked || [], myFriendCode: d.myFriendCode };
      if (this.page === 'social') this.render();
    } catch { /* offline — keep last known */ }
  }

  // Any social mutation returns the fresh overview, which we apply and re-render.
  private async socialAction(path: string, body: any) {
    audio.playClick();
    try {
      const res = await this.api(`${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.token}` }, body: JSON.stringify(body) });
      const d = await res.json();
      if (d.friends !== undefined) this.social = { friends: d.friends, incoming: d.incoming, outgoing: d.outgoing, blocked: d.blocked, myFriendCode: d.myFriendCode ?? this.social.myFriendCode };
      this.showToast(`${d.success ? '✅' : '⚠️'} ${d.message || (d.success ? 'Done' : 'Action failed')}`);
      this.render();
    } catch { this.showToast('⚠️ Network error'); }
  }

  private async inviteFriend(userId: string) {
    audio.playClick();
    try {
      // Carry the mode we're set to play, so the invite says what it's inviting them TO.
      const res = await this.api(`/api/social/invite`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.token}` },
        body: JSON.stringify({ userId, mode: this.selectedUIMode }),
      });
      const d = await res.json();
      this.showToast(`${d.success ? (d.online ? '🎮' : '📬') : '⚠️'} ${d.message}`);
    } catch { this.showToast('⚠️ Could not send invite'); }
  }

  // ---------- §social Incoming match invites ----------
  // Persisted server-side, so one sent while you were away is waiting when you return.
  private invites: any[] = [];
  private async loadInvites() {
    if (!this.token) return;
    try {
      const res = await this.api('/api/social/invites', { headers: { Authorization: `Bearer ${this.token}` } });
      if (!res.ok) return;
      const d = await res.json();
      const had = this.invites.length;
      this.invites = d.invites || [];
      // Refresh the bell badge wherever we are; re-render if the list is on screen.
      this.updateInviteBadge();
      if (this.page === 'social' && this.invites.length !== had) this.render();
    } catch { /* offline — keep what we have */ }
  }

  private updateInviteBadge() {
    const badge = document.getElementById('notif-badge');
    if (!badge) return;
    const n = this.invites.length;
    badge.textContent = n > 9 ? '9+' : String(n);
    badge.style.display = n ? 'grid' : 'none';
  }

  // Live push from the server (on arrival, and on connect for anything sent while away).
  private onInvitePush(invites: any[]) {
    const known = new Set(this.invites.map(i => i.id));
    const fresh = invites.filter(i => !known.has(i.id));
    this.invites = invites;
    this.updateInviteBadge();
    for (const inv of fresh) {
      audio.playChime();
      this.showToast(`🎮 ${inv.fromName} invited you to ${UI_MODES[inv.mode as UIMode]?.name || inv.mode}`);
    }
    if (this.page === 'social') this.render();
  }

  private async respondInvite(inviteId: string, action: 'accept' | 'decline') {
    audio.playClick();
    try {
      const res = await this.api('/api/social/invites/respond', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.token}` },
        body: JSON.stringify({ inviteId, action }),
      });
      const d = await res.json();
      this.invites = d.invites || [];
      this.updateInviteBadge();
      if (d.success && action === 'accept' && d.mode) {
        // Drop straight into the mode they invited us to.
        if (UI_MODES[d.mode as UIMode]) this.selectedUIMode = d.mode as UIMode;
        this.showToast(`🎮 ${d.message}`);
        this.startMatchmaking();
        return;
      }
      this.showToast(d.success ? `✅ ${d.message}` : `⚠️ ${d.message}`);
      this.render();
    } catch { this.showToast('⚠️ Could not respond to that invite'); }
  }

  // Relative "how long ago" for an invite that may have been sitting for hours.
  private inviteAge(t: number): string {
    const m = Math.floor((Date.now() - t) / 60000);
    if (m < 1) return 'just now';
    if (m < 60) return `${m}m ago`;
    return `${Math.floor(m / 60)}h ago`;
  }

  private renderInvitesSection(): string {
    if (!this.invites.length) return '';
    return `
      <div class="card">
        <div class="section-title">🎮 Match Invites (${this.invites.length})</div>
        <div class="list">
          ${this.invites.map(i => {
            const modeDef = UI_MODES[i.mode as UIMode];
            return `
            <div class="row-card invite-row">
              <div class="r-ico">${i.fromAvatar || '🎮'}</div>
              <div class="r-body">
                <div class="r-title">${i.fromName} <span class="pill ${i.fromOnline ? 'gold' : 'done'}">${i.fromOnline ? '🟢 Online' : 'Offline'}</span></div>
                <div class="r-desc">Invited you to ${modeDef?.icon || ''} <b>${modeDef?.name || i.mode}</b></div>
                <div class="r-count">${this.inviteAge(i.createdAt)}</div>
              </div>
              <div style="display:flex;gap:6px;">
                <button class="btn btn-primary inv-accept" data-inv="${i.id}" style="padding:6px 11px;font-size:0.74rem;">Play</button>
                <button class="btn btn-ghost inv-decline" data-inv="${i.id}" style="padding:6px 11px;font-size:0.74rem;">Dismiss</button>
              </div>
            </div>`;
          }).join('')}
        </div>
      </div>`;
  }

  // §7 Coupon Admin — only visible to admin users (detected by a 200 from the admin endpoint).
  private isAdmin = false;
  private adminCoupons: any[] = [];
  private async loadAdminCoupons() {
    if (!this.token || (!this.profile?.isAdmin && this.page !== 'admin')) return;
    try {
      const res = await this.api('/api/admin/coupons', { headers: { Authorization: `Bearer ${this.token}` } });
      if (res.status === 200) { this.isAdmin = true; this.adminCoupons = (await res.json()).coupons || []; if (this.page === 'admin' || this.page === 'settings') this.render(); }
      else this.isAdmin = false;
    } catch { /* */ }
  }
  private async adminCouponAction(path: string, method: string, body?: any) {
    try {
      const res = await this.api(path, { method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.token}` }, body: body ? JSON.stringify(body) : undefined });
      const d = await res.json();
      this.showToast(res.ok ? '✅ Saved' : `⚠️ ${d.error || 'Failed'}`);
      await this.loadAdminCoupons();
      this.render();
    } catch { this.showToast('⚠️ Network error'); }
  }
  private pageAdmin() {
    if (!this.isAdmin) return '<div class="page"><div class="card muted" style="text-align:center;padding:24px;">🔒 Admin access required.</div></div>';
    const c = this.adminCoupons;
    return `<div class="page">
      <div class="section-title" style="display:flex;align-items:center;gap:8px;"><button class="btn btn-ghost" data-go="settings" style="padding:4px 10px;">←</button> 🛡️ Coupon Admin</div>
      <div class="card">
        <div class="section-title">➕ Create Coupon</div>
        <div class="admin-form">
          <input id="ac-title" placeholder="Title (e.g. 10% off Cafe)" class="friend-search-input" />
          <input id="ac-store" placeholder="Provider / store label" class="friend-search-input" />
          <input id="ac-desc" placeholder="Reward text" class="friend-search-input" />
          <div style="display:flex;gap:8px;">
            <input id="ac-cost" type="number" placeholder="Cost ⭐" class="friend-search-input" style="flex:1;" />
            <input id="ac-level" type="number" placeholder="Min level" class="friend-search-input" style="flex:1;" />
            <input id="ac-limit" type="number" placeholder="Total limit (-1=∞)" class="friend-search-input" style="flex:1;" />
          </div>
          <label style="display:flex;align-items:center;gap:8px;font-size:0.82rem;"><input type="checkbox" id="ac-auto" /> Auto-grant when eligible</label>
          <button class="btn btn-primary" id="ac-create">Create Coupon</button>
        </div>
      </div>
      <div class="card">
        <div class="section-title">🎟️ Coupons (${c.length})</div>
        <div class="list">${c.length ? c.map(x => `
          <div class="admin-coupon ${x.enabled ? '' : 'disabled'}">
            <div class="ac-main"><span class="ac-ico">${x.icon}</span>
              <div><div class="ac-name">${x.title} ${x.autoGrant ? '<span class="pill gold" style="font-size:0.6rem;">AUTO</span>' : ''}</div>
                <div class="muted" style="font-size:0.72rem;">${x.storeName} · ⭐${x.costStars} · L${x.minLevel} · used ${x.redemptionCount}${x.redemptionLimit >= 0 ? '/' + x.redemptionLimit : ''}</div></div>
            </div>
            <div class="ac-actions">
              <button class="btn btn-ghost ac-toggle" data-id="${x.id}" data-on="${x.enabled}" style="padding:4px 9px;font-size:0.72rem;">${x.enabled ? 'Disable' : 'Enable'}</button>
              <button class="btn btn-ghost ac-del" data-id="${x.id}" style="padding:4px 9px;font-size:0.72rem;color:#b91c1c;">Delete</button>
            </div>
          </div>`).join('') : '<div class="muted" style="text-align:center;padding:16px;">No coupons yet — create one above.</div>'}</div>
      </div>
    </div>`;
  }

  // §7 Load coupons the player is eligible to claim (server-driven).
  private async loadAvailableCoupons() {
    if (!this.token) return;
    try {
      const res = await this.api(`/api/coupons/available?region=${encodeURIComponent(this.rewardRegion)}`, { headers: { Authorization: `Bearer ${this.token}` } });
      const data = await res.json();
      this.availableCoupons = data.coupons || [];
    } catch { this.availableCoupons = []; }
    if (this.page === 'inventory' && this.invTab === 'coupons') this.render();
  }

  private async claimCoupon(couponId: string) {
    audio.playClick();
    try {
      const res = await this.api(`/api/coupons/claim`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.token}` },
        body: JSON.stringify({ couponId, region: this.rewardRegion }),
      });
      const data = await res.json();
      if (data.success) {
        if (data.profile) { this.profile = data.profile; this.persistSession(); }
        audio.playFanfare();
        this.showToast(`🎟️ ${data.message} — added to your coupons`);
        await this.loadAvailableCoupons();
      } else {
        this.showToast(`❌ ${data.message || 'Claim failed'}`);
      }
    } catch { this.showToast('❌ Claim failed'); }
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

  // ---------- STORY / CHAPTERS ----------
  private pageStory() {
    const p = this.profile; const lvl = p?.level || 1;
    const rank = story.princeRank(lvl);
    const chapter = story.currentChapter(lvl);
    const castlePct = story.castleProgress(lvl);
    const season = story.SEASONS[story.CURRENT_SEASON - 1];
    return `
      <div class="page">
        <div class="story-hero">
          <div class="story-crown">👑</div>
          <div class="story-kicker">Season ${season.n} · ${season.title}</div>
          <div class="story-rank">${rank.icon} ${rank.title}</div>
          <div class="story-motto">“${rank.motto}”</div>
          <button class="btn btn-ghost" id="replay-legend" style="margin-top:12px;">📜 Read the Legend</button>
        </div>

        <div class="card">
          <div class="section-title">🏰 Restore the Royal Castle</div>
          <div class="muted" style="font-size:0.8rem;margin-bottom:10px;">Every level rebuilds the fallen castle. By Level 1000 the throne is yours again.</div>
          <div class="progress" style="height:12px;"><div style="width:${castlePct}%"></div></div>
          <div class="castle-parts">
            ${story.CASTLE_PARTS.map(part => { const done = lvl >= part.level; return `<div class="castle-part ${done ? 'done' : ''}"><span class="cp-ico">${part.icon}</span><span class="cp-name">${part.name}</span><span class="cp-tag">${done ? '✓ Restored' : `Lv ${part.level}`}</span></div>`; }).join('')}
          </div>
        </div>

        ${this.renderJourneyTimeline()}

        <div class="card">
          <div class="section-title">📖 Story Chapters</div>
          <div class="list">
            ${story.CHAPTERS.map(ch => { const unlocked = lvl >= ch.unlockLevel; const cur = ch.n === chapter; return `<div class="row-card ${cur ? 'story-current' : ''}"><div class="r-ico">${unlocked ? ch.icon : '🔒'}</div><div class="r-body"><div class="r-title">Chapter ${ch.n}: ${ch.title}${cur ? ' <span class="pill gold">Current</span>' : ''}</div><div class="r-desc">${unlocked ? ch.desc : `Unlocks at Level ${ch.unlockLevel}`}</div></div></div>`; }).join('')}
          </div>
        </div>

        <div class="card">
          <div class="section-title">🗺️ The Seven Kingdoms</div>
          <div class="kingdom-grid">${story.KINGDOMS.map(k => `<div class="kingdom-cell"><div class="kd-ico">${k.icon}</div><div class="kd-name">${k.name}</div></div>`).join('')}</div>
        </div>

        <div class="card">
          <div class="section-title">🐢 Characters You'll Meet</div>
          <div class="list">${story.NPCS.map(n => `<div class="row-card"><div class="r-ico">${n.icon}</div><div class="r-body"><div class="r-title">${n.name}</div><div class="r-desc">${n.role}</div></div></div>`).join('')}</div>
          <div class="muted" style="font-size:0.76rem;margin-top:6px;">Guides appear across the kingdoms as the story unfolds.</div>
        </div>

        <div class="card">
          <div class="section-title">🐉 Kingdom Guardians</div>
          <div class="boss-grid">${story.BOSSES.map(b => `<div class="boss-cell"><div class="bs-ico">${b.icon}</div><div class="bs-name">${b.name}</div></div>`).join('')}</div>
          <div class="muted" style="font-size:0.76rem;margin-top:6px;">Each kingdom's guardian is a major milestone on the road to the throne.</div>
        </div>
      </div>`;
  }

  // §milestone The journey, drawn as a route rather than a list. Reached beats are lit and
  // show their narration; the next one shows a progress bar so the goal is always legible;
  // everything beyond stays sealed so the story is not spoiled.
  private journeyMode: UIMode = 'explorer';
  private renderJourneyTimeline(): string {
    const list = this.milestones;
    if (!list.length) {
      return `<div class="card"><div class="section-title">🗺️ Journey Timeline</div>
        <div class="muted" style="text-align:center;padding:18px;">Loading your journey…</div></div>`;
    }
    const reached = list.filter(m => m.reached).length;
    const pct = Math.round((reached / list.length) * 100);
    // The first unreached beat is the "current" one — the only locked node we reveal.
    const nextIdx = list.findIndex(m => !m.reached);

    const nodes = list.map((m, i) => {
      const isNext = i === nextIdx;
      const state = m.reached ? 'done' : isNext ? 'current' : 'locked';
      const body = m.reached
        ? `<div class="jn-story">${m.story}</div>
           <div class="jn-reward">⭐ ${m.rewardStars} · XP ${m.rewardXp} · 🧬 ${m.rewardEvoXp}</div>`
        : isNext
          ? `<div class="jn-story next">${m.story}</div>
             <div class="progress" style="height:6px;margin-top:6px;"><div style="width:${m.pct || 0}%"></div></div>
             <div class="jn-reward">${m.progress || 0} / ${m.target} ${this.metricLabel(m.metric)}</div>`
          : `<div class="jn-story locked">Sealed until you reach ${m.title.replace(/^The /, '')}.</div>`;
      return `
        <div class="journey-node ${state}">
          <div class="jn-rail"><span class="jn-dot">${m.reached ? m.icon : isNext ? m.icon : '🔒'}</span></div>
          <div class="jn-body">
            <div class="jn-head">
              <span class="jn-ch">Chapter ${m.chapter}</span>
              <span class="jn-title">${m.reached || isNext ? m.title : '???'}</span>
              ${m.reached ? '<span class="pill gold jn-tag">✓ Reached</span>' : isNext ? '<span class="pill jn-tag">In progress</span>' : ''}
            </div>
            ${body}
          </div>
        </div>`;
    }).join('');

    const modeTabs: Array<[UIMode, string]> = [['explorer', '📜 Explorer'], ['free_roam', '🌿 Free Roam']];
    return `
      <div class="card">
        <div class="section-title">🗺️ Journey Timeline</div>
        <div class="seg" style="margin-bottom:10px;">
          ${modeTabs.map(([id, l]) => `<button class="${this.journeyMode === id ? 'active' : ''}" data-journey="${id}">${l}</button>`).join('')}
        </div>
        <div class="journey-summary">
          <div class="progress" style="height:10px;"><div style="width:${pct}%"></div></div>
          <div class="xp-label"><span>${reached} of ${list.length} checkpoints reached</span><span>${pct}%</span></div>
          <div class="muted" style="font-size:0.74rem;margin-top:4px;">Checkpoints save the moment you reach them — you never lose a beat by leaving a match.</div>
        </div>
        <div class="journey-track">${nodes}</div>
      </div>`;
  }

  private metricLabel(metric: string): string {
    return { score: 'score', kills: 'eliminations', stars: '⭐ collected', survival: 'seconds survived', areas: 'landmarks found', level: 'level' }[metric] || metric;
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
        <div class="toggle" style="flex-direction:column;align-items:flex-start;gap:6px;">
          <span class="t-label">🕹️ Controller Position</span>
          <div class="seg" style="width:100%;">
            <button class="${(this.settings.controlPos || 'right') === 'left' ? 'active' : ''}" data-cpos="left">Left</button>
            <button class="${(this.settings.controlPos || 'right') === 'center' ? 'active' : ''}" data-cpos="center">Center</button>
            <button class="${(this.settings.controlPos || 'right') === 'right' ? 'active' : ''}" data-cpos="right">Right</button>
          </div>
        </div>
        <div class="toggle"><span class="t-label">📋 In-game Mission Tracker</span>${sw(this.settings.missionTracker !== false, 'missionTracker')}</div>
        ${this.settings.missionTracker === false ? '' : `<div class="toggle" style="flex-direction:column;align-items:flex-start;gap:6px;">
          <span class="t-label">📋 Tracker Position</span>
          <div class="seg" style="width:100%;">
            <button class="${(this.settings.trackerPos || 'left') === 'left' ? 'active' : ''}" data-tpos="left">Top-Left</button>
            <button class="${(this.settings.trackerPos || 'left') === 'right' ? 'active' : ''}" data-tpos="right">Top-Right</button>
          </div>
        </div>`}
        <div class="muted" style="font-size:0.76rem;padding-top:8px;">PC: Mouse or WASD to steer · Shift / Joystick push to boost.</div>
      </div>
      ${this.isAdmin ? `<div class="card"><div class="section-title" style="font-size:0.9rem;">🛡️ Admin</div>
        <button class="btn btn-ghost btn-block" data-go="admin">🎟️ Coupon Management →</button>
      </div>` : ''}
      <div class="card"><div class="section-title" style="font-size:0.9rem;">♿ Accessibility</div>
        <div class="toggle"><span class="t-label">Large Text</span>${sw(this.settings.largeText, 'largeText')}</div>
        <div class="toggle"><span class="t-label">High Contrast</span>${sw(this.settings.highContrast, 'highContrast')}</div>
        <div class="toggle"><span class="t-label">Reduce Motion</span>${sw(this.settings.reduceMotion, 'reduceMotion')}</div>
      </div>
      <div class="card"><div class="section-title" style="font-size:0.9rem;">❓ Help</div>
        <div style="display:flex;gap:10px;flex-wrap:wrap;">
          <button class="btn btn-ghost" id="replay-tutorial" style="flex:1;">🎮 Replay Tutorial</button>
          <button class="btn btn-ghost" id="replay-story" style="flex:1;">📜 Replay Story</button>
        </div>
      </div>
      <button class="btn btn-ghost btn-block" data-go="home">← Back to Home</button></div>`;
  }

  // ---------- GAME OVERLAYS ----------
  private renderMatchmaking() {
    const mm = this.modeDef;
    return `<div class="overlay"><div class="modal mm-modal">
      <div class="mm-header">
        <span class="mm-icon">${mm.icon}</span>
        <div class="mm-title">${mm.name}</div>
      </div>
      <div class="mm-countdown-wrap">
        <div class="mm-pulse-ring"></div>
        <div class="countdown-num" id="mm-count">3</div>
      </div>
      <div class="chip mm-tip">💡 Eat 🍒 to heal & grow · Outgrow rivals</div>
    </div></div>`;
  }

  private renderBattleRoyaleHUD() {
    const cpos = this.settings.controlPos || 'center';
    return `
      <div class="hud ctrl-${cpos} mode-battle-royale">
        <div class="tb-top-bar mode-br-grid">
          <!-- Left Panel: Pause Button -->
          <button id="nav-pause" class="hud-pause tb-a-pause">⏸</button>

          <!-- Center Panel: Hearts (Top) -> Match Status Pill -> Active Powers -->
          <div class="hud-center-stack">
            <div class="tb-a-hearts">
              <div class="hearts-row" id="hud-hearts-row">
                ${this.renderHeartsHTML(100, 100)}
              </div>
            </div>

            <div class="tb-status-pill hud-panel tb-a-status" id="br-status-pill">
              <span>⏱️ <b id="br-timer">00:00</b></span>
              <span class="tb-dot-sep">·</span>
              <span>👥 <b id="br-alive">0 Alive</b></span>
              <span class="tb-dot-sep">·</span>
              <span>⚔️ <b id="br-kills">0 Kills</b></span>
            </div>

            <div class="power-status" id="power-status" style="display:none;"></div>
          </div>

          <!-- Right Panel: Leaderboard -->
          <div class="tb-a-lb">
            <div class="hud-leaderboard hud-panel">
              <div class="lb-title">🏆 Top 10</div>
              <div id="hud-lb-rows"></div>
            </div>
          </div>
        </div>

        <div class="hud-event hud-panel" id="hud-event" style="display:none;"></div>
${this.renderBottomControls()}
      </div>`;
  }

  private renderTeamBattleHUD() {
    const cpos = this.settings.controlPos || 'center';
    return `
      <div class="hud ctrl-${cpos} mode-team-battle">
        <div class="tb-top-bar mode-tb-grid">
          <!-- Left Panel: Pause Button -->
          <button id="nav-pause" class="hud-pause tb-a-pause">⏸</button>

          <!-- Center Panel: Hearts (Top) -> Team Score Banner -> Match Status Pill -> Active Powers -->
          <div class="hud-center-stack">
            <div class="tb-a-hearts">
              <div class="hearts-row" id="hud-hearts-row">
                ${this.renderHeartsHTML(100, 100)}
              </div>
            </div>

            <div class="tb-score-banner hud-panel tb-a-score" id="tb-score-banner">
              <div class="tb-team-side blue" id="tb-blue-side">
                <span class="tb-team-ico">🔵</span>
                <span class="tb-team-title">BLUE</span>
                <b class="tb-team-score" id="tb-blue-score">0</b>
              </div>
              <div class="tb-vs-divider">VS</div>
              <div class="tb-team-side red" id="tb-red-side">
                <b class="tb-team-score" id="tb-red-score">0</b>
                <span class="tb-team-title">RED</span>
                <span class="tb-team-ico">🔴</span>
              </div>
            </div>

            <div class="tb-status-pill hud-panel tb-a-status" id="tb-status-pill">
              <span>⏱️ <b id="tb-match-timer">00:00</b></span>
              <span class="tb-dot-sep">·</span>
              <span>👥 <b id="tb-alive-counts">10 vs 10 Alive</b></span>
              <span class="tb-dot-sep">·</span>
              <span class="tb-rank-tag" id="tb-team-rank">🏆 #1</span>
            </div>

            <div class="power-status" id="power-status" style="display:none;"></div>
          </div>

          <!-- Right Panel: Leaderboard -->
          <div class="tb-a-lb">
            <div class="hud-leaderboard hud-panel">
              <div class="lb-title">🏆 Top 10</div>
              <div id="hud-lb-rows"></div>
            </div>
          </div>
        </div>

        <div class="hud-event hud-panel" id="hud-event" style="display:none;"></div>
        <div class="team-scores" id="team-scores" style="display:none;"></div>
${this.renderBottomControls()}
      </div>`;
  }

  private renderFreeRoamHUD() {
    const cpos = this.settings.controlPos || 'center';
    const isClassic = (this.selectedUIMode as string) === 'nokia';
    const showMissions = !isClassic && this.settings.missionTracker !== false;
    const showLeaderboard = !isClassic;

    return `
      <div class="hud ctrl-${cpos} ${isClassic ? 'mode-classic' : 'mode-free-roam'}">
        <div class="tb-top-bar mode-fr-grid">
          <!-- Left Panel: Pause Top, Daily Missions Below -->
          <div class="hud-left-panel">
            <button id="nav-pause" class="hud-pause tb-a-pause">⏸</button>
            ${showMissions ? `
            <!-- No hud-panel class: the daily tracker is deliberately chrome-free, so it
                 must not pick up the shared panel's white plate and blur. -->
            <div class="mission-tracker-card tb-a-mission" id="mission-tracker">
              <div id="mission-tracker-rows"></div>
            </div>` : ''}
          </div>

          <!-- Center Panel: 5 Hearts Top, Player Card Below, Active Power Status -->
          <div class="hud-center-panel">
            <div class="tb-a-hearts">
              <div class="hearts-row" id="hud-hearts-row">
                ${this.renderHeartsHTML(100, 100)}
              </div>
            </div>

            <div class="fr-player-card hud-panel tb-a-player">
              <div class="fr-pc-name" id="hv-name">${this.profile?.displayName || 'Explorer'}</div>
              <div class="fr-pc-scoreline">
                <span class="fr-pc-lbl">Score:</span>
                <b class="fr-pc-score-val" id="hv-score">0</b>
                <span class="tb-dot-sep">•</span>
                <span class="fr-pc-stage" id="hud-stage">Baby • Lv 1</span>
              </div>
            </div>
            <div class="power-status" id="power-status" style="display:none;"></div>
          </div>

          <!-- Right Panel: Leaderboard -->
          ${showLeaderboard ? `
          <div class="hud-right-panel tb-a-lb">
            <div class="hud-leaderboard hud-panel">
              <div class="lb-title">🏆 Top 10</div>
              <div id="hud-lb-rows"></div>
            </div>
          </div>` : '<div class="hud-right-panel"></div>'}
        </div>

        <div class="hud-event hud-panel" id="hud-event" style="display:none;"></div>
${this.renderBottomControls()}
      </div>`;
  }

  // Shared on-screen controls for every mode's HUD. Boost (⚡) and Ability (🌀) are the only
  // way to dash / cast Coil Guard on touch devices — desktop has Shift and Space — so they
  // must exist in every HUD variant. bindTouch() wires them after each render.
  private renderBottomControls(): string {
    const jsize = this.settings.joySize || 'medium';
    const jop = this.settings.joyOpacity || 70;
    return `
        <div class="hud-bottom-controls">
          <div class="touch-joystick joy-${jsize} joy-op-${jop}" id="touch-joystick">
            <div class="touch-knob" id="touch-knob"></div>
          </div>
          <div class="touch-actions">
            <div class="touch-row">
              <div class="touch-btn mini" id="touch-mini" title="Fullscreen Tactical Map">🗺️</div>
              <div class="touch-btn zoom" id="touch-zoom" title="Camera Zoom Preset">🔍<span class="tz-label" id="touch-zoom-label">Far</span></div>
            </div>
            <div class="touch-row">
              <div class="touch-btn ability" id="touch-ability" title="Coil Guard (Space)">🌀<span class="tz-label" id="ability-cd">READY</span></div>
              <div class="touch-btn boost" id="touch-boost" title="Boost (Shift)">⚡</div>
            </div>
          </div>
        </div>`;
  }

  private renderHUD() {
    if (this.selectedUIMode === 'team') {
      return this.renderTeamBattleHUD();
    }
    if (this.selectedUIMode === 'battle_royale') {
      return this.renderBattleRoyaleHUD();
    }
    return this.renderFreeRoamHUD();
  }

  private renderPause() {
    const sw = (on: boolean, key: string) => `<button class="switch ${on ? 'on' : ''}" data-pset="${key}"></button>`;
    const cpos = this.settings.controlPos || 'center';
    const jsize = this.settings.joySize || 'medium';
    const camPreset = this.settings.cameraPreset || 'far';
    const hp = Math.max(0, Math.round(this.lastHp || 100));
    const me = this.lastSnake;
    const powers: string[] = [];
    if (me) {
      const superT = Math.max(0, (me as any).superTimer ?? 0);
      const shieldT = Math.max(0, me.shieldTimer ?? 0);
      const speedT = Math.max(0, me.speedBoostTimer ?? 0);
      const abilityT = Math.max(0, me.abilityActiveTimer ?? 0);
      if (superT > 0) powers.push(`<div class="pwr super"><span class="pwr-ico">🍄</span><span class="pwr-lbl">Super</span><b class="pwr-val">${Math.ceil(superT)}s</b></div>`);
      if (shieldT > 0) powers.push(`<div class="pwr shield"><span class="pwr-ico">🛡️</span><span class="pwr-lbl">Shield</span><b class="pwr-val">${Math.ceil(shieldT)}s</b></div>`);
      if (speedT > 0) powers.push(`<div class="pwr speed"><span class="pwr-ico">⚡</span><span class="pwr-lbl">Speed</span><b class="pwr-val">${Math.ceil(speedT)}s</b></div>`);
      if (abilityT > 0) powers.push(`<div class="pwr ability"><span class="pwr-ico">✨</span><span class="pwr-lbl">Boost</span><b class="pwr-val">${Math.ceil(abilityT)}s</b></div>`);
    }

    const dailyMissions = (this.missions || []).filter(m => m.category === 'daily');
    const dailyList = dailyMissions.length ? dailyMissions : [
      { id: 'dm_1', icon: '🍒', targetCount: 30, currentCount: 18, isCompleted: false },
      { id: 'dm_2', icon: '🍎', targetCount: 10, currentCount: 10, isCompleted: true },
      { id: 'dm_3', icon: '⭐', targetCount: 100, currentCount: 40, isCompleted: false },
      { id: 'dm_4', icon: '🛡️', targetCount: 5, currentCount: 2, isCompleted: false },
    ];

    const showMissions = this.selectedUIMode === 'free_roam' || this.selectedUIMode === 'explorer';

    return `<div class="overlay">
      <div class="modal pause-modal">
        <div class="section-title pause-title">⏸️ Paused</div>

        <!-- Snake Health Card (5 Hearts) -->
        <div class="pause-hearts-card">
          <div class="hearts-title">❤️ Health</div>
          <div class="hearts-row">${this.renderHeartsHTML(hp, 100)}</div>
        </div>

        ${powers.length ? `
        <div class="pause-powers-card">
          <div class="pm-title">⚡ Active Powers</div>
          <div class="power-status-inline">${powers.join('')}</div>
        </div>` : ''}

        <!-- Compact Daily Tasks Section (Free Roam / Explorer) -->
        ${showMissions ? `
        <div class="pause-missions-card">
          <div class="pm-header">
            <span class="pm-title">🎯 Daily Missions</span>
            <span class="pm-sub-tag">In-Match</span>
          </div>
          <div class="pm-grid">
            ${dailyList.slice(0, 4).map(m => {
              const isDone = m.isCompleted || (m.currentCount >= m.targetCount);
              return `
                <div class="hud-mission-row ${isDone ? 'done' : ''}">
                  <span class="hud-mission-chk ${isDone ? 'checked' : ''}">${isDone ? '☑' : '☐'}</span>
                  <span class="hud-mission-ico">${m.icon || '🍒'}</span>
                  <span class="hud-mission-prog">${m.currentCount || 0}/${m.targetCount || 10}</span>
                </div>`;
            }).join('')}
          </div>
        </div>` : ''}

        <!-- Single Horizontal Row Settings Card -->
        <div class="pause-settings-card">
          <!-- Position Single Row -->
          <div class="pause-setting-row">
            <span class="p-setting-label">🕹️ Position</span>
            <div class="seg seg-sm">
              <button class="${cpos === 'left' ? 'active' : ''}" data-cpos="left">Left</button>
              <button class="${cpos === 'center' ? 'active' : ''}" data-cpos="center">Center</button>
              <button class="${cpos === 'right' ? 'active' : ''}" data-cpos="right">Right</button>
            </div>
          </div>

          <!-- Joystick Single Row -->
          <div class="pause-setting-row">
            <span class="p-setting-label">📐 Joystick</span>
            <div class="seg seg-sm">
              <button class="${jsize === 'small' ? 'active' : ''}" data-jsize="small">Small</button>
              <button class="${jsize === 'medium' ? 'active' : ''}" data-jsize="medium">Medium</button>
              <button class="${jsize === 'large' ? 'active' : ''}" data-jsize="large">Large</button>
            </div>
          </div>

          <!-- Camera Single Row -->
          <div class="pause-setting-row">
            <span class="p-setting-label">🎥 Camera</span>
            <div class="seg seg-sm">
              <button class="${camPreset === 'near' ? 'active' : ''}" data-campres="near">Near</button>
              <button class="${camPreset === 'medium' ? 'active' : ''}" data-campres="medium">Medium</button>
              <button class="${camPreset === 'far' ? 'active' : ''}" data-campres="far">Far</button>
              <button class="${camPreset === 'ultra_wide' ? 'active' : ''}" data-campres="ultra_wide">Ultra</button>
            </div>
          </div>

          <!-- Audio Single Row -->
          <div class="pause-setting-row pause-audio-row">
            <div class="toggle-audio"><span class="p-setting-label">🔊 SFX</span>${sw(this.settings.sfx, 'sfx')}</div>
            <div class="toggle-audio"><span class="p-setting-label">🎵 Music</span>${sw(this.settings.music, 'music')}</div>
          </div>
        </div>

        <!-- Actions (Side-by-Side Buttons) -->
        <div class="pause-actions-row">
          <button id="btn-resume" class="btn btn-primary btn-block">▶️ Resume</button>
          <button id="btn-leave" class="btn btn-danger btn-block">🚪 Leave</button>
        </div>
      </div>
    </div>`;
  }

  private renderRespawn() {
    const stars = this.profile?.stars ?? 0;
    const tickets = this.profile?.tickets ?? 0;
    // Price the Stars option from the server config so the panel can never advertise a cost
    // the server does not actually charge (respawn pricing is JSON-overridable).
    const starCost = this.serverConfig?.economy?.respawn?.stars?.stars ?? 20;
    return `<div class="overlay">
      <div class="modal respawn-modal">
        <div class="respawn-header">
          <div class="respawn-title">💀 You Were Defeated!</div>
          <div class="respawn-sub">Choose how you want to rejoin the match</div>
        </div>

        <div class="respawn-grid">
          <button class="respawn-opt green" id="rs-stars" ${stars < starCost ? 'disabled' : ''}>
            <div class="ro-ico-wrap"><span class="ro-ico">🌱</span></div>
            <div class="ro-info">
              <span class="ro-main">Respawn (${starCost} ⭐)</span>
              <span class="ro-sub">Use Stars${stars < starCost ? ' — not enough ⭐' : ''}</span>
            </div>
          </button>

          <button class="respawn-opt gold" id="rs-ad">
            <div class="ro-ico-wrap"><span class="ro-ico">📺</span></div>
            <div class="ro-info">
              <span class="ro-main">Respawn (Watch Ad)</span>
              <span class="ro-sub">Free Respawn</span>
            </div>
          </button>

          <button class="respawn-opt blue" id="respawn-wait-btn" disabled>
            <div class="ro-ico-wrap"><span class="ro-ico">⏳</span></div>
            <div class="ro-info">
              <span class="ro-main">Wait to Respawn</span>
              <span class="ro-sub" id="respawn-wait">${this.respawnWait}s</span>
            </div>
          </button>

          <button class="respawn-opt purple" id="rs-ticket" ${tickets < 1 ? 'disabled' : ''}>
            <div class="ro-ico-wrap"><span class="ro-ico">🎟️</span></div>
            <div class="ro-info">
              <span class="ro-main">Use Ticket (${tickets})</span>
              <span class="ro-sub">Instant Free Respawn</span>
            </div>
          </button>
        </div>

        <button id="rs-end" class="btn btn-ghost btn-block">🏁 End Match & See Results</button>
      </div>
    </div>`;
  }

  private renderGameover() {
    const s = this.summary || { score: 0, kills: 0, placement: 5, survival: 0, earnedStars: 0, earnedXP: 0, earnedEvoXP: 0 };
    const mins = Math.floor(s.survival / 60), secs = s.survival % 60;
    const isWinner = s.placement === 1;
    const headerTitle = isWinner ? '🏆 VICTORY!' : '💀 DEFEATED!';
    const headerColor = isWinner ? 'var(--gold-deep)' : 'var(--danger)';

    return `<div class="overlay">
      <div class="modal gameover-modal" style="text-align:center;max-width:480px;padding:24px;">
        <h1 style="color:${headerColor};font-family:var(--font-title);font-weight:900;font-size:1.8rem;margin-bottom:2px;">${headerTitle}</h1>
        <div class="muted" style="font-weight:700;font-size:0.88rem;margin-bottom:16px;">${this.modeDef.name}</div>

        <div class="summary-grid" style="margin-bottom:16px;">
          <div class="summary-cell"><div class="sc-label">Placement</div><div class="sc-val" style="color:var(--green-deep);">#${s.placement}</div></div>
          <div class="summary-cell"><div class="sc-label">Score</div><div class="sc-val" style="color:var(--gold-deep);">${s.score}</div></div>
          <div class="summary-cell"><div class="sc-label">Kills</div><div class="sc-val">⚔️ ${s.kills}</div></div>
          <div class="summary-cell"><div class="sc-label">Survived</div><div class="sc-val">${mins}:${String(secs).padStart(2, '0')}</div></div>
        </div>

        <div class="chip" style="margin-bottom:18px;padding:8px 14px;font-size:0.85rem;">⭐ +${s.earnedStars} Stars · ✨ +${s.earnedXP} XP · 🧬 +${s.earnedEvoXP} Evo${s.levelsGained ? ` · 🎉 +${s.levelsGained} Level!` : ''}</div>

        <div style="display:flex;flex-direction:column;gap:10px;">
          <button id="go-ad" class="btn btn-gold btn-block">📺 Watch Ad · 2× Rewards</button>
          <div style="display:flex;gap:10px;">
            <button id="go-again" class="btn btn-primary" style="flex:1;">🔄 Play Again</button>
            <button id="go-home" class="btn btn-ghost" style="flex:1;">🏠 Home</button>
          </div>
        </div>
      </div>
    </div>`;
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
    document.querySelectorAll('[data-inv]').forEach(b => b.addEventListener('click', () => { this.invTab = (b as HTMLElement).dataset.inv as any; audio.playClick(); this.render(); if (this.invTab === 'coupons') this.loadAvailableCoupons(); }));
    document.querySelectorAll('.coupon-claim-btn').forEach(b => b.addEventListener('click', () => this.claimCoupon((b as HTMLElement).dataset.coupon!)));
    document.querySelectorAll('[data-mode]').forEach(b => b.addEventListener('click', () => { audio.playClick(); const m = (b as HTMLElement).dataset.mode as UIMode; if (UI_MODES[m]) { this.selectedUIMode = m; this.render(); } }));
    document.querySelectorAll('[data-mt]').forEach(b => b.addEventListener('click', () => { this.matchType = (b as HTMLElement).dataset.mt as any; audio.playClick(); this.render(); if (this.matchType === 'global') this.measureGlobalPing(); }));
    document.querySelectorAll('[data-lbcat]').forEach(b => b.addEventListener('click', () => { this.lbCategory = (b as HTMLElement).dataset.lbcat!; audio.playClick(); this.render(); this.loadLeaderboardCategory(); }));
    document.querySelectorAll('[data-lbscope]').forEach(b => b.addEventListener('click', () => { this.lbScope = (b as HTMLElement).dataset.lbscope as any; audio.playClick(); this.render(); this.loadLeaderboardCategory(); }));
    // §7 Coupon admin handlers
    on('ac-create', () => {
      const v = (id: string) => (document.getElementById(id) as HTMLInputElement)?.value;
      const title = v('ac-title'), storeName = v('ac-store');
      if (!title || !storeName) { this.showToast('⚠️ Title + provider required'); return; }
      this.adminCouponAction('/api/admin/coupons', 'POST', {
        title, storeName, discountText: v('ac-desc') || '',
        costStars: Number(v('ac-cost')) || 0, minLevel: Number(v('ac-level')) || 1,
        redemptionLimit: v('ac-limit') === '' ? -1 : Number(v('ac-limit')),
        autoGrant: (document.getElementById('ac-auto') as HTMLInputElement)?.checked || false,
      });
    });
    document.querySelectorAll('.ac-toggle').forEach(b => b.addEventListener('click', (e) => { const el = e.currentTarget as HTMLElement; const on = el.dataset.on === 'true'; this.adminCouponAction(`/api/admin/coupons/${el.dataset.id}/${on ? 'disable' : 'enable'}`, 'POST'); }));
    document.querySelectorAll('.ac-del').forEach(b => b.addEventListener('click', (e) => this.adminCouponAction(`/api/admin/coupons/${(e.currentTarget as HTMLElement).dataset.id}`, 'DELETE')));
    document.querySelectorAll('[data-region]').forEach(b => b.addEventListener('click', () => { this.selectedRegion = (b as HTMLElement).dataset.region!; audio.playClick(); this.render(); }));
    // §7 Local Explorer cascading location selectors
    document.getElementById('loc-country')?.addEventListener('change', (e) => { this.localCountry = (e.target as HTMLSelectElement).value; this.localState = Object.keys(LOCATIONS[this.localCountry])[0]; this.localCity = LOCATIONS[this.localCountry][this.localState][0]; audio.playClick(); this.render(); });
    document.getElementById('loc-state')?.addEventListener('change', (e) => { this.localState = (e.target as HTMLSelectElement).value; this.localCity = LOCATIONS[this.localCountry][this.localState][0]; this.render(); });
    document.getElementById('loc-city')?.addEventListener('change', (e) => { this.localCity = (e.target as HTMLSelectElement).value; this.render(); });
    document.querySelectorAll('[data-skin]').forEach(b => b.addEventListener('click', () => this.equipSkin((b as HTMLElement).dataset.skin!)));
    document.querySelectorAll('[data-evo]').forEach(b => b.addEventListener('click', () => this.equipEvolution((b as HTMLElement).dataset.evo!)));
    document.querySelectorAll('[data-acc]').forEach(b => b.addEventListener('click', () => this.equipAccessory((b as HTMLElement).dataset.acc!)));
    document.querySelectorAll('.claim-btn').forEach(b => b.addEventListener('click', () => this.claimMission((b as HTMLElement).dataset.id!)));
    document.querySelectorAll('.copy-btn').forEach(b => b.addEventListener('click', (e) => { const c = (e.currentTarget as HTMLElement).dataset.code!; navigator.clipboard?.writeText(c); this.showToast(`📋 Copied ${c}`); }));
    document.querySelectorAll('[data-rwregion]').forEach(b => b.addEventListener('click', () => { this.rewardRegion = (b as HTMLElement).dataset.rwregion!; audio.playClick(); this.render(); this.loadRewards(); }));
    document.querySelectorAll('.redeem-btn').forEach(b => b.addEventListener('click', () => this.redeemReward((b as HTMLElement).dataset.reward!)));
    document.querySelectorAll('[data-journey]').forEach(b => b.addEventListener('click', () => {
      audio.playClick();
      this.journeyMode = (b as HTMLElement).dataset.journey as UIMode;
      this.milestones = []; // show the loading state rather than the other mode's beats
      this.render();
      this.loadMilestones(this.journeyMode);
    }));
    document.getElementById('replay-legend')?.addEventListener('click', () => { audio.playClick(); this.showLegend(); });
    document.getElementById('replay-story')?.addEventListener('click', () => { audio.playClick(); this.showLegend(); });
    document.getElementById('replay-tutorial')?.addEventListener('click', () => { audio.playClick(); this.showTutorial(); });
    document.querySelectorAll('[data-set]').forEach(b => b.addEventListener('click', () => this.toggleSetting((b as HTMLElement).dataset.set as keyof Settings)));
    document.querySelectorAll('[data-cpos]').forEach(b => b.addEventListener('click', () => { audio.playClick(); this.settings.controlPos = (b as HTMLElement).dataset.cpos as any; this.saveSettings(); this.render(); }));
    document.querySelectorAll('[data-jsize]').forEach(b => b.addEventListener('click', () => { audio.playClick(); this.settings.joySize = (b as HTMLElement).dataset.jsize as any; this.saveSettings(); this.render(); }));
    document.querySelectorAll('[data-campres]').forEach(b => b.addEventListener('click', () => { audio.playClick(); this.settings.cameraPreset = (b as HTMLElement).dataset.campres as any; this.saveSettings(); if (this.renderer && this.settings.cameraPreset) this.renderer.setCameraPreset(this.settings.cameraPreset); this.render(); }));
    document.querySelectorAll('[data-tpos]').forEach(b => b.addEventListener('click', () => { audio.playClick(); this.settings.trackerPos = (b as HTMLElement).dataset.tpos as any; this.saveSettings(); this.render(); }));

    on('music-toggle', () => this.toggleMusic());
    // The bell is the invite inbox — jump to Social where they can be actioned.
    on('notif-btn', () => {
      if (this.invites.length) { this.go('social'); return; }
      this.loadInvites();
      this.showToast('🔔 No new notifications');
    });
    document.querySelectorAll('.inv-accept').forEach(b => b.addEventListener('click', (e) => this.respondInvite((e.currentTarget as HTMLElement).dataset.inv!, 'accept')));
    document.querySelectorAll('.inv-decline').forEach(b => b.addEventListener('click', (e) => this.respondInvite((e.currentTarget as HTMLElement).dataset.inv!, 'decline')));
    on('home-play', () => this.go('play'));
    on('home-explorer', () => { this.selectedUIMode = 'explorer'; this.startMatchmaking(); });
    on('quick-match', () => this.startMatchmaking());
    on('enter-btn', () => this.startMatchmaking());
    on('prestige-btn', () => this.doPrestige());
    on('edit-profile-btn', () => this.showEditProfile());
    on('side-btn', () => { this.settings.controlSide = this.settings.controlSide === 'right' ? 'left' : 'right'; this.saveSettings(); this.render(); });

    // §8 Friends list & social handlers — all server-driven.
    on('friend-send-btn', () => {
      const input = (document.getElementById('friend-search-input') as HTMLInputElement)?.value?.trim();
      if (!input) { this.showToast('⚠️ Enter a username or friend code'); return; }
      audio.playClick();
      (document.getElementById('friend-search-input') as HTMLInputElement).value = '';
      // One field, either form — the server resolves a friend code or an exact username.
      this.socialAction('/api/social/request', { query: input });
    });
    document.querySelectorAll('.freq-accept').forEach(b => b.addEventListener('click', (e) => this.socialAction('/api/social/respond', { userId: (e.currentTarget as HTMLElement).dataset.id!, action: 'accept' })));
    document.querySelectorAll('.freq-decline').forEach(b => b.addEventListener('click', (e) => this.socialAction('/api/social/respond', { userId: (e.currentTarget as HTMLElement).dataset.id!, action: 'reject' })));
    document.querySelectorAll('.friend-unfriend').forEach(b => b.addEventListener('click', (e) => this.socialAction('/api/social/unfriend', { userId: (e.currentTarget as HTMLElement).dataset.id! })));
    document.querySelectorAll('.friend-block').forEach(b => b.addEventListener('click', (e) => this.socialAction('/api/social/block', { userId: (e.currentTarget as HTMLElement).dataset.id! })));
    document.querySelectorAll('.friend-unblock').forEach(b => b.addEventListener('click', (e) => this.socialAction('/api/social/unblock', { userId: (e.currentTarget as HTMLElement).dataset.id! })));
    document.querySelectorAll('.friend-invite-match').forEach(b => b.addEventListener('click', (e) => this.inviteFriend((e.currentTarget as HTMLElement).dataset.id!)));

    on('nav-pause', () => this.togglePause());
    on('btn-resume', () => this.togglePause());
    on('btn-leave', () => this.abandon());
    // §1.1 In-game settings — apply live (render keeps the game running; resume re-binds input)
    on('pause-hand', () => { audio.playClick(); this.settings.controlSide = this.settings.controlSide === 'right' ? 'left' : 'right'; this.saveSettings(); this.render(); });
    document.querySelectorAll('[data-pset]').forEach(b => b.addEventListener('click', () => { const k = (b as HTMLElement).dataset.pset as keyof Settings; (this.settings as any)[k] = !(this.settings as any)[k]; this.saveSettings(); this.render(); }));
    on('rs-stars', () => this.doRespawn('stars')); on('rs-ad', () => this.doRespawn('ad')); on('respawn-wait-btn', () => this.doRespawn('wait')); on('rs-ticket', () => this.doRespawn('ticket'));
    on('rs-end', () => this.endMatch());
    on('go-ad', () => this.triggerAd(async () => { try { const r = await this.api('/api/ads/claim', { method: 'POST', headers: { Authorization: `Bearer ${this.token}` } }); const d = await r.json(); if (d.profile) this.profile = d.profile; this.showToast(`🎉 ${d.message}`); } catch { /* */ } this.setScreen('gameover'); }));
    on('go-again', () => this.startMatchmaking());
    on('go-home', () => { ads.showInterstitial(); /* §14 between-match interstitial */ this.refreshProfile(); this.page = 'home'; this.setScreen('app'); });
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
  // §12 In a match this must not block play, so it uses the compact notice; on menu screens
  // the fuller banner is fine because nothing is happening behind it.
  private showLevelUp(level: number) {
    if (this.screen === 'play' || this.screen === 'respawn') {
      this.notify({ icon: '🎉', kicker: 'Level up', title: `Level ${level}`, tone: 'gold' });
      return;
    }
    const el = document.createElement('div'); el.className = 'levelup'; el.innerHTML = `🎉 LEVEL UP!<br><span style="font-size:1.6rem;">Level ${level}</span>`;
    document.body.appendChild(el); setTimeout(() => el.remove(), 2600);
  }
}

new AnacondaPark();
