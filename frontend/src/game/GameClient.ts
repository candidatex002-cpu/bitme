import { io, Socket } from 'socket.io-client';

export type GameMode = 'classic' | 'battle_royale' | 'team' | 'event';
export type GrowthStage = 'Baby' | 'Young' | 'Adult' | 'Elite' | 'Titan';

export interface SnakeSegment { x: number; y: number; }

export interface SnakeData {
  id: string;
  userId: string;
  displayName: string;
  skin: string;
  head: { x: number; y: number };
  body: SnakeSegment[];
  angle: number;
  speed: number;
  speedPct: number;
  boosting: boolean;
  score: number;
  level: number;
  length: number;
  radius: number;
  hp?: number;
  maxHp?: number;
  defense: number;
  stage: GrowthStage;
  evolution?: string;
  region?: string;
  distanceTravelled?: number;
  isAlive: boolean;
  kills: number;
  shieldTimer: number;
  speedBoostTimer: number;
  superTimer?: number; // 🍄 super power (invincible + faster)
  abilityCooldown: number;
  abilityActiveTimer: number;
  team?: 'red' | 'blue';
  isBoss?: boolean;
  equippedAccessory?: string;
  respawnAt?: number; // local-engine only: timestamp (ms) at which a dead bot respawns
}

export interface FoodData {
  id: string; x: number; y: number; value: number; type: string; color: string; icon?: string;
  vx?: number; vy?: number; wanderTimer?: number; // §3 moving stars
}

export interface SafeZoneData {
  centerX: number; centerY: number; radius: number; targetRadius: number; damagePerSecond: number;
}

export interface SanctuaryZoneData { centerX: number; centerY: number; radius: number; label: string; icon: string; }
export interface PortalData { id: string; targetId: string; x: number; y: number; label: string; color: string; timerSeconds?: number; wormhole?: boolean; }
export interface ObstacleData { id: string; type: string; x: number; y: number; radius: number; icon: string; blocking: boolean; damage?: number; }

// §explorer A villager standing in the world. Static, so it arrives with the cached world
// layout rather than every tick — only what they SAY changes, and that comes from the API.
export interface NpcData {
  id: string; name: string; role: string; icon: string; accessory?: string;
  kingdom: number; x: number; y: number; radius: number;
}

export interface WorldEventData {
  id: string; type: string; title: string; description: string; active: boolean; timerSeconds: number; icon: string;
}

export interface GameStateTick {
  tick: number;
  timestamp: number;
  mode: GameMode;
  snakes: SnakeData[];
  food: FoodData[];
  safeZone: SafeZoneData;
  sanctuaryZone?: SanctuaryZoneData;
  portals?: PortalData[];
  obstacles?: ObstacleData[];
  npcs?: NpcData[];
  leaderboard: Array<{ id: string; name: string; score: number; kills: number; team?: 'red' | 'blue' }>;
  teamScores?: { red: number; blue: number };
  currentEvent?: WorldEventData;
  matchTimer?: number;  // §2 Battle Royale — seconds remaining
  matchOver?: boolean;  // §2 match ended (timer/last-standing)
}

// §social A stored friend invite waiting for this player.
export interface MatchInviteData {
  id: string;
  fromName: string;
  fromAvatar: string;
  mode: string;
  createdAt: number;
  expiresAt: number;
  fromOnline: boolean;
}

export interface ModeConfig {
  mode: GameMode; label: string; tagline: string;
  shrinkingZone: boolean; teamsEnabled: boolean; worldEvents: boolean; botCount: number;
}

// Where the authoritative backend lives, in priority order.
//
// The game server is a long-lived 30 Hz Socket.IO process, so it CANNOT run on a serverless
// static host (Vercel/Netlify/Pages) — it has to be deployed somewhere that keeps a process
// alive, and the client is pointed at it. See DEPLOY.md.
export function serverBase(): string {
  // 1. ?server=… — ad-hoc override for testing against any backend.
  const override = new URLSearchParams(location.search).get('server');
  if (override) return override;

  // 2. Build-time env (VITE_SERVER_URL) — how a Vercel/Netlify build targets its backend
  //    without editing HTML. Set it in the host's environment variables.
  const envUrl = (import.meta as any).env?.VITE_SERVER_URL as string | undefined;
  if (envUrl) return envUrl.replace(/\/$/, '');

  // 3. Packaged (Capacitor/Play Store) build: a meta tag baked into index.html.
  const meta = document.querySelector('meta[name="anaconda-server"]')?.getAttribute('content');
  if (meta && !meta.includes('your-backend.example.com')) return meta.replace(/\/$/, '');

  // 4. Local dev — Vite on :3000/:5173 proxies to the backend on :4000.
  if (location.port === '3000' || location.port === '5173') return `${location.protocol}//${location.hostname}:4000`;

  // 5. capacitor:// or file:// origins can't reach a server → the offline local engine takes over.
  if (location.protocol === 'capacitor:' || location.protocol === 'file:') return '';

  // 6. Same-origin: only correct when a real backend is served from this origin. A static-only
  //    deploy has none, so every /api call would 404/500 — detect that and go offline instead.
  return location.origin;
}

// True when we have no reason to believe a backend exists at serverBase(). A static-only
// host (the default Vercel deploy) serves the SPA but no API, so the app should go straight
// to offline/local play rather than firing doomed requests on every screen.
export function hasConfiguredServer(): boolean {
  if (new URLSearchParams(location.search).get('server')) return true;
  if ((import.meta as any).env?.VITE_SERVER_URL) return true;
  const meta = document.querySelector('meta[name="anaconda-server"]')?.getAttribute('content');
  if (meta && !meta.includes('your-backend.example.com')) return true;
  return location.port === '3000' || location.port === '5173';
}

// §8 World size — single source of truth shared with the Renderer. Larger map = wide
// exploration that never feels crowded, room for ~25 players.
export const WORLD = 6000;
const HALF = WORLD / 2;

// §2 Competitive round pacing — mirrors the server's world config (GameConfig.world) so the
// offline engine shrinks the storm on exactly the same curve the authoritative server uses.
const MATCH_SECONDS = 180;      // Battle Royale AND Team Battle both run a 3-minute round
const ZONE_GRACE = 15;          // zone holds full size while players spawn in
const ZONE_CLOSE_AT_PCT = 0.9;  // fully closed at 90% of the round → final showdown
const ZONE_START_R = WORLD * 0.47;
const ZONE_FINAL_R = WORLD * 0.09;

const FOOD_TYPES = [
  { type: 'cherry', val: 10, icon: '🍒', color: '#ff4d4d' },
  { type: 'apple', val: 15, icon: '🍎', color: '#ff3333' },
  { type: 'mushroom', val: 20, icon: '🍄', color: '#ff9933' },
  { type: 'frog', val: 25, icon: '🐸', color: '#33cc33' },
  // ⭐ stars are a dedicated moving set (§3), not part of the random food roll
  { type: 'shield', val: 30, icon: '🛡️', color: '#3399ff' },
  { type: 'speed', val: 30, icon: '⚡', color: '#ff66cc' },
];

// §2/§3 obstacle palette for the local engine (mirrors the server table)
const OBSTACLE_TYPES: Array<{ type: string; icon: string; radius: number; blocking: boolean; damage?: number; isPoison?: boolean }> = [
  { type: 'tree', icon: '🌳', radius: 44, blocking: true, damage: 0 },
  { type: 'rock', icon: '🪨', radius: 34, blocking: true, damage: 0 },
  { type: 'bush', icon: '🌲', radius: 32, blocking: true, damage: 0 },
  { type: 'cactus', icon: '🌵', radius: 30, blocking: true, damage: 15 }, // 15% HP damage on contact
  { type: 'flowerbed', icon: '🌼', radius: 28, blocking: false, damage: 0 },
  { type: 'log', icon: '🪵', radius: 30, blocking: true, damage: 0 },
  { type: 'pond', icon: '🪷', radius: 50, blocking: false, damage: 0 },
  { type: 'hill', icon: '⛰️', radius: 46, blocking: true, damage: 0 },
  { type: 'cave', icon: '🕳️', radius: 58, blocking: true, damage: 0 },
  { type: 'lava', icon: '🔥', radius: 42, blocking: false, damage: 40 },  // 40% HP damage on contact
  { type: 'poison', icon: '☠️', radius: 36, blocking: false, damage: 5, isPoison: true }, // 5% HP per sec DoT
  { type: 'explosion', icon: '💥', radius: 40, blocking: false, damage: 50 }, // 50% HP damage on hit
];

// §3 hp restored per food type (local engine health loop)
const LOCAL_HEAL: Record<string, number> = { cherry: 5, apple: 8, mushroom: 4, frog: 3, egg: 25 };

// §power Buff duration + stacking rules. Defaults mirror GameConfig.powers; when a server is
// reachable, /api/config overwrites these so offline and online play stay on one curve.
const POWERS = { baseSeconds: 5, bonusPerLevels: 8, maxSeconds: 10, maxStackedSeconds: 30 };
export function applyPowerConfig(p?: Partial<typeof POWERS>) {
  if (!p) return;
  for (const k of Object.keys(POWERS) as Array<keyof typeof POWERS>) {
    if (typeof p[k] === 'number' && p[k]! > 0) POWERS[k] = p[k]!;
  }
}

// Ceiling on the local world's collectibles. Eaten food is replaced 1-for-1, but corpse drops
// are pure additions — with bots dying and respawning every few seconds the array would grow
// without bound, and food collision is O(snakes × food) every tick.
const MAX_LOCAL_FOOD = 420;

const BOT_NAMES = ['AlphaViper', 'KobraX', 'Slinky', 'GigaPython', 'NeonSnake', 'ShadowSerpent', 'TitanApex'];
const BOT_SKINS = ['Jungle', 'Ocean', 'Fire', 'Ice', 'Galaxy', 'Golden', 'Shadow'];

export class GameClient {
  private socket: Socket | null = null;
  private inputSeq = 0;

  public localUserId: string = '';
  public isConnected: boolean = false;
  public modeConfig: ModeConfig | null = null;

  public onStateUpdate?: (state: GameStateTick) => void;
  public onAuthSuccess?: (userId: string, snake: SnakeData, config: ModeConfig) => void;
  public onRespawnResult?: (result: { success: boolean; message?: string; profile?: any; method?: string }) => void;
  public onAbilityResult?: (used: boolean) => void;
  // §social Pending "come play" invites pushed by the server — on arrival, and again the
  // moment we authenticate (which is how invites sent while we were offline reach us).
  public onMatchInvite?: (r: { invites: MatchInviteData[] }) => void;
  public onCollect?: (type: string, value: number) => void; // §V7 local-engine food/star pickup by the player
  public onPickupEvent?: (r: { foodId: string; foodType: string; updatedMissions: any[]; profile: any }) => void; // §P1 server-authoritative pickup event
  // §7 Matchmaking-chosen server URL for Global Adventure ('' = default origin from serverBase()).
  public preferredServer = '';

  // Local Authoritative Simulation Engine (for serverless environments like Vercel Cloud)
  private isLocalEngineRunning = false;
  private localEngineTimer: any = null;
  private lastServerTickTime = 0;
  private fallbackTimer: any = null;
  private localState: GameStateTick | null = null;
  private localInput = { angle: 0, boosting: false };
  private localPaused = false; // §12 freeze the local player while backgrounded
  // §3/§7/§8 local-engine timers (seconds)
  private starCooldown = 0;
  private wormholeRelocate = 120; // §7 four linked wormholes relocate periodically
  private sanctuaryTimer = 90;    // relocate sanctuary periodically in the local sim
  // §2 per-mode flags + state
  private modeUI = 'free_roam';
  private modeSolo = false;
  private modeStory = false;
  private localNokia = false;      // solo classic snake — walls + self kill, no wrap
  private localBR = false;         // battle royale — timer + shrinking storm + last standing
  private localTeam = false;       // team battle — team scoring
  private localMatchTimer = 0;     // seconds remaining (BR / Team); 0 = untimed
  private localMatchOver = false;
  private localMatchLastTs = 0;    // wall clock of the last match tick → real dt, no drift

  constructor() {
    this.localUserId = 'usr_' + Math.random().toString(36).substring(2, 9);
  }

  public connect(token: string, skinName: string = 'Forest', mode: GameMode = 'classic', region = 'Global', matchType: 'local' | 'global' = 'global') {
    // §2 Solo modes (Classic Snake / Nokia) never touch the multiplayer server.
    if (this.modeSolo) { this.startLocalEngine(skinName, mode, region); return; }
    // No backend configured for this build (static-only deploy): go straight to the offline
    // engine. Opening a socket at an origin with no game server just produced a reconnect
    // storm of failed polling requests before the fallback fired anyway.
    if (!this.preferredServer && !hasConfiguredServer()) { this.startLocalEngine(skinName, mode, region); return; }
    const authPayload = { token, skin: skinName, mode, region, matchType };
    this.lastServerTickTime = 0;

    if (this.socket && this.socket.connected) {
      this.socket.emit('authenticate', authPayload);
      return;
    }
    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
    }

    try {
      // §7 Global Adventure may pick a lower-latency regional server; '' = default origin.
      this.socket = io(this.preferredServer || serverBase(), {
        transports: ['polling', 'websocket'],
        reconnection: true,
        reconnectionAttempts: 3,
        reconnectionDelay: 1000,
        timeout: 2000,
        closeOnBeforeunload: true,
      });

      this.socket.on('connect', () => {
        this.isConnected = true;
        this.socket?.emit('authenticate', authPayload);
      });

      this.socket.on('authenticated', (data: { userId: string; snake: SnakeData; config: ModeConfig }) => {
        this.localUserId = data.userId || this.localUserId;
        this.modeConfig = data.config;
        this.onAuthSuccess?.(this.localUserId, data.snake, data.config);
      });

      this.socket.on('game_state_tick', (tick: GameStateTick) => {
        this.lastServerTickTime = Date.now();
        if (this.isLocalEngineRunning) this.stopLocalEngine();
        this.onStateUpdate?.(this.decodeTick(tick));
      });

      this.socket.on('respawn_result', (r: any) => this.onRespawnResult?.(r));
      this.socket.on('ability_result', (r: { used: boolean }) => this.onAbilityResult?.(r.used));
      this.socket.on('match_invite', (r: { invites: MatchInviteData[] }) => this.onMatchInvite?.(r)); // §social
      this.socket.on('pickup_event', (r: any) => this.onPickupEvent?.(r));
      this.socket.on('disconnect', () => { this.isConnected = false; });
    } catch { /* ignored */ }

    // Set fallback to start local simulation engine if server ticks fail to arrive within 600ms
    if (this.fallbackTimer) clearTimeout(this.fallbackTimer);
    this.fallbackTimer = setTimeout(() => {
      if (this.lastServerTickTime === 0 && !this.isLocalEngineRunning) {
        this.startLocalEngine(skinName, mode, region);
      }
    }, 600);
  }

  // §net The server sends the near-static world layout (obstacles + wormholes) only when its
  // `worldVersion` changes, instead of re-transmitting it 30×/second. Ticks that omit it carry
  // the last known layout forward so the Renderer always receives a complete world.
  private cachedObstacles: ObstacleData[] = [];
  private cachedPortals: PortalData[] = [];
  private cachedNpcs: NpcData[] = [];
  private decodeTick(tick: GameStateTick): GameStateTick {
    if (tick.obstacles) this.cachedObstacles = tick.obstacles;
    else tick.obstacles = this.cachedObstacles;
    if (tick.portals) this.cachedPortals = tick.portals;
    else tick.portals = this.cachedPortals;
    if (tick.npcs) this.cachedNpcs = tick.npcs;
    else tick.npcs = this.cachedNpcs;
    // Rehydrate the flat body encoding ([x0,y0,x1,y1,…] → [{x,y},…]) so the Renderer keeps
    // working with plain segment objects and knows nothing about the wire format.
    for (const s of tick.snakes) {
      const flat = (s as any).b as number[] | undefined;
      if (!flat) { if (!s.body) s.body = []; continue; } // never hand the Renderer an undefined body
      const body: SnakeSegment[] = new Array(flat.length >> 1);
      for (let i = 0, k = 0; i < flat.length; i += 2, k++) body[k] = { x: flat[i], y: flat[i + 1] };
      s.body = body;
      delete (s as any).b;
    }
    return tick;
  }

  public disconnect() {
    if (this.socket) { this.socket.disconnect(); this.socket = null; }
    this.isConnected = false;
    this.cachedObstacles = [];
    this.cachedPortals = [];
    this.stopLocalEngine();
    if (this.fallbackTimer) clearTimeout(this.fallbackTimer);
  }

  // §net Tell the server how much world we can see, so it culls the tick to match. Only
  // resent when it moves meaningfully (zoom step / rotation / resize) — not every frame.
  private sentViewRadius = 0;
  public setViewRadius(radius: number) {
    if (!this.socket || !this.isConnected) return;
    if (!Number.isFinite(radius) || radius <= 0) return;
    if (Math.abs(radius - this.sentViewRadius) < this.sentViewRadius * 0.12) return;
    this.sentViewRadius = radius;
    this.socket.emit('view_radius', { radius: Math.round(radius) });
  }

  public sendInput(angle: number, boosting: boolean) {
    this.localInput = { angle, boosting };
    if (this.socket && this.isConnected) {
      this.inputSeq++;
      this.socket.emit('client_input', { seq: this.inputSeq, angle, boosting });
    }
  }

  // §12 Tell the server we've backgrounded/foregrounded so it can mark us inactive
  // (invisible, no damage) and resume us cleanly. No-op under the local engine.
  // §2 Carry the selected mode's rules into the engine before connecting.
  public setModeFlags(flags: { ui: string; solo: boolean; story: boolean }) {
    this.modeUI = flags.ui; this.modeSolo = flags.solo; this.modeStory = flags.story;
  }

  public notifyPause(paused: boolean) {
    this.localPaused = paused;
    if (this.socket && this.isConnected) this.socket.emit(paused ? 'player_pause' : 'player_resume');
  }

  public activateAbility() {
    if (this.isLocalEngineRunning && this.localState) {
      const me = this.localState.snakes.find(s => s.id === this.localUserId);
      if (me && me.abilityCooldown <= 0) {
        me.abilityCooldown = 8;
        me.speedBoostTimer = 3;
        this.onAbilityResult?.(true);
      }
      return;
    }
    if (this.socket && this.isConnected) this.socket.emit('activate_ability');
  }

  public requestRespawn(method: 'stars' | 'ticket' | 'ad' | 'wait') {
    if (this.isLocalEngineRunning && this.localState) {
      const me = this.localState.snakes.find(s => s.id === this.localUserId);
      if (me) {
        me.isAlive = true;
        me.hp = 100;
        me.score = 150; me.level = 1; me.radius = 13; me.length = 9; // reset to a small snake
        // §2 Respawn inside the CURRENT safe zone — by late game it is far smaller than the
        // map centre spread, so a fixed ±200 box could drop the player straight into the storm.
        const sz = this.localState.safeZone;
        const spawnR = Math.min(200, Math.max(0, sz.radius * 0.5));
        const ang = Math.random() * Math.PI * 2, d = Math.random() * spawnR;
        me.head = { x: this.wrapLocal(sz.centerX + Math.cos(ang) * d), y: this.wrapLocal(sz.centerY + Math.sin(ang) * d) };
        me.body = Array.from({ length: 9 }, (_, i) => ({ x: me.head.x - i * 10, y: me.head.y }));
        (me as any).stormT = 0; // fresh storm grace after respawning
        this.onRespawnResult?.({ success: true, method });
      }
      return;
    }
    if (this.socket && this.isConnected) this.socket.emit('respawn', { method });
  }

  // ---------------------------------------------------------------- Local Simulation Engine
  private startLocalEngine(skinName: string, mode: GameMode, region: string) {
    this.isLocalEngineRunning = true;

    // §2 Resolve this match's rules from the selected mode.
    this.localNokia = this.modeSolo || this.modeUI === 'nokia';
    this.localBR = mode === 'battle_royale';
    this.localTeam = mode === 'team';
    // §2 BOTH timed modes get the round clock. Team Battle used to start at 0, which made
    // elapsed == the full match on tick 1 — the zone snapped straight to its final radius and
    // the match ended instantly.
    this.localMatchTimer = (this.localBR || this.localTeam) ? MATCH_SECONDS : 0;
    this.localMatchOver = false;
    this.localMatchLastTs = 0;

    const me: SnakeData = {
      id: this.localUserId,
      userId: this.localUserId,
      displayName: 'You (Explorer)',
      skin: skinName,
      head: { x: HALF, y: HALF },
      body: Array.from({ length: 9 }, (_, i) => ({ x: HALF - i * 12, y: HALF })),
      angle: 0,
      speed: 4,
      speedPct: 1,
      boosting: false,
      score: 150,
      level: 1,
      length: 9,
      radius: 13,
      hp: 100,
      maxHp: 100,
      defense: 0,
      stage: 'Baby',
      region,
      isAlive: true,
      kills: 0,
      shieldTimer: 0,
      speedBoostTimer: 0,
      abilityCooldown: 0,
      abilityActiveTimer: 0,
      team: this.localTeam ? 'blue' : undefined,
    };

    // Nokia is solo (no bots); the bigger map (§8) is populated with up to ~24 rivals.
    const botCount = this.localNokia ? 0 : (this.localBR ? 24 : 18);
    const bots: SnakeData[] = Array.from({ length: botCount }, (_, idx) => {
      const name = BOT_NAMES[idx % BOT_NAMES.length] + (idx >= BOT_NAMES.length ? ` ${Math.floor(idx / BOT_NAMES.length) + 1}` : '');
      const bx = 400 + Math.random() * (WORLD - 800);
      const by = 400 + Math.random() * (WORLD - 800);
      return {
        id: `bot_${idx}`,
        userId: `bot_${idx}`,
        displayName: name,
        skin: BOT_SKINS[idx % BOT_SKINS.length],
        head: { x: bx, y: by },
        body: Array.from({ length: 9 }, (_, i) => ({ x: bx - i * 10, y: by })),
        angle: Math.random() * Math.PI * 2,
        speed: 3.5,
        speedPct: 1,
        boosting: false,
        score: Math.floor(100 + Math.random() * 400),
        level: 1,
        length: 9,
        radius: 13,
        hp: 100,
        maxHp: 100,
        defense: 0,
        stage: 'Baby',
        isAlive: true,
        kills: Math.floor(Math.random() * 3),
        shieldTimer: 0,
        speedBoostTimer: 0,
        abilityCooldown: 0,
        abilityActiveTimer: 0,
        team: this.localTeam ? (idx % 2 === 0 ? 'red' : 'blue') : undefined,
      };
    });

    // §8 More food/stars/obstacles to fill the bigger map without feeling crowded.
    const foodItems: FoodData[] = Array.from({ length: this.localNokia ? 70 : 260 }, (_, i) => this.genFood(`f_${i}`));
    if (!this.localNokia) for (let i = 0; i < 24; i++) foodItems.push(this.genStar(`star_${i}`)); // §3 moving stars

    this.localState = {
      tick: 1,
      timestamp: Date.now(),
      mode,
      snakes: [me, ...bots],
      food: foodItems,
      // Battle Royale AND Team Battle shrink toward the same small radius; other modes stay open.
      safeZone: {
        centerX: HALF,
        centerY: HALF,
        radius: this.localBR || this.localTeam ? ZONE_START_R : HALF * 0.94,
        targetRadius: this.localBR || this.localTeam ? ZONE_FINAL_R : HALF * 0.94,
        damagePerSecond: 15,
      },
      sanctuaryZone: this.localNokia ? undefined : { centerX: HALF, centerY: HALF, radius: 360, label: '🛡️ Safe Sanctuary', icon: '🛡️' }, // §8
      portals: this.localNokia ? [] : this.genWormholes(), // §7 four linked wormholes
      obstacles: this.localNokia ? [] : this.genObstacles(30), // §2 (scaled to the bigger map)
      teamScores: this.localTeam ? { red: 0, blue: 0 } : undefined,
      matchTimer: (this.localBR || this.localTeam) ? this.localMatchTimer : undefined,
      leaderboard: [],
    };

    this.modeConfig = {
      mode,
      label: mode.toUpperCase(),
      tagline: 'Local 30Hz Simulation Engine',
      shrinkingZone: mode === 'battle_royale',
      teamsEnabled: mode === 'team',
      worldEvents: true,
      botCount: bots.length,
    };
    this.onAuthSuccess?.(this.localUserId, me, this.modeConfig);

    if (this.localEngineTimer) clearInterval(this.localEngineTimer);
    this.localEngineTimer = setInterval(() => this.updateLocalEngine(), 33);
  }

  private stopLocalEngine() {
    this.isLocalEngineRunning = false;
    if (this.localEngineTimer) {
      clearInterval(this.localEngineTimer);
      this.localEngineTimer = null;
    }
  }

  private genFood(id: string): FoodData {
    const fType = FOOD_TYPES[Math.floor(Math.random() * FOOD_TYPES.length)];
    return {
      id,
      x: 100 + Math.random() * (WORLD - 200),
      y: 100 + Math.random() * (WORLD - 200),
      value: fType.val,
      type: fType.type,
      color: fType.color,
      icon: fType.icon,
    };
  }

  // §6 Toroidal wrap helpers for the local engine (world = WORLD).
  private wrapLocal(v: number): number { return ((v % WORLD) + WORLD) % WORLD; }
  private wrapDeltaLocal(d: number): number { let r = ((d % WORLD) + WORLD) % WORLD; if (r > HALF) r -= WORLD; return r; }
  private followBodyLocal(s: SnakeData) {
    let prev = { x: s.head.x, y: s.head.y };
    for (let i = 0; i < s.body.length; i++) {
      const seg = s.body[i];
      const dx = this.wrapDeltaLocal(prev.x - seg.x);
      const dy = this.wrapDeltaLocal(prev.y - seg.y);
      const dist = Math.hypot(dx, dy);
      if (dist > 10) {
        seg.x = this.wrapLocal(seg.x + (dx / dist) * (dist - 10));
        seg.y = this.wrapLocal(seg.y + (dy / dist) * (dist - 10));
      }
      prev = { x: seg.x, y: seg.y };
    }
  }

  // §3 A slow-drifting star collectible.
  private genStar(id: string): FoodData {
    return { id, x: 200 + Math.random() * (WORLD - 400), y: 200 + Math.random() * (WORLD - 400), value: 50, type: 'star', icon: '⭐', color: '#ffcc00', vx: 0, vy: 0, wanderTimer: Math.random() * 2 };
  }

  // §2 Scatter obstacles with wide lanes and a clear centre spawn.
  private genObstacles(count: number): ObstacleData[] {
    const list: ObstacleData[] = [];
    let guard = 0;
    while (list.length < count && guard++ < 140) {
      const t = OBSTACLE_TYPES[Math.floor(Math.random() * OBSTACLE_TYPES.length)];
      const x = 240 + Math.random() * (WORLD - 480);
      const y = 240 + Math.random() * (WORLD - 480);
      const dcx = x - HALF, dcy = y - HALF;
      if (dcx * dcx + dcy * dcy < 460 * 460) continue; // keep the centre spawn clear
      let ok = true;
      for (const o of list) { const dx = x - o.x, dy = y - o.y, gap = t.radius + o.radius + 140; if (dx * dx + dy * dy < gap * gap) { ok = false; break; } }
      if (ok) list.push({ id: `ob_${list.length}`, type: t.type, icon: t.icon, x, y, radius: t.radius, blocking: t.blocking, damage: t.damage });
    }
    return list;
  }

  private updateLocalEngine() {
    if (!this.localState) return;
    const state = this.localState;
    state.tick++;
    state.timestamp = Date.now();

    // Tick down power timers for every snake (§power)
    for (const s of state.snakes) {
      if (s.shieldTimer > 0) s.shieldTimer = Math.max(0, s.shieldTimer - 0.033);
      if (s.speedBoostTimer > 0) s.speedBoostTimer = Math.max(0, s.speedBoostTimer - 0.033);
      if ((s.superTimer ?? 0) > 0) s.superTimer = Math.max(0, (s.superTimer ?? 0) - 0.033);
    }

    // 1. Update Player Snake Movement (frozen while the app is backgrounded — §12)
    const me = state.snakes.find(s => s.id === this.localUserId);
    if (me && me.isAlive && !this.localPaused) {
      me.angle = this.localInput.angle;
      me.boosting = this.localInput.boosting && me.score > 20;
      // Match the authoritative server feel (~240 u/s base, 1.7x boost) at 30 fps.
      let speed = me.boosting ? 13.6 : 8;
      if ((me.speedBoostTimer ?? 0) > 0) speed *= 1.4; // ⚡ speed power
      if ((me.superTimer ?? 0) > 0) speed *= 1.5;       // 🍄 super power
      if (me.boosting) me.score = Math.max(10, me.score - 0.2);

      const nx = me.head.x + Math.cos(me.angle) * speed;
      const ny = me.head.y + Math.sin(me.angle) * speed;
      if (this.localNokia) {
        // §2 Classic Snake — walls kill, no wrap; hitting your own body is Game Over.
        if (nx < me.radius || nx > WORLD - me.radius || ny < me.radius || ny > WORLD - me.radius) {
          this.eliminateLocal(me, null);
        } else {
          me.head.x = nx; me.head.y = ny; this.followBodyLocal(me);
          if (this.selfCollide(me)) this.eliminateLocal(me, null);
        }
      } else {
        // §6 wrap-around movement — no borders
        me.head.x = this.wrapLocal(nx);
        me.head.y = this.wrapLocal(ny);
        this.followBodyLocal(me);
      }
      if (me.abilityCooldown > 0) me.abilityCooldown = Math.max(0, me.abilityCooldown - 0.033);
    }

    // 2. Update Bot AI Movement — seek nearest food (toroidal), else wander
    for (const b of state.snakes) {
      if (b.id === this.localUserId || !b.isAlive) continue;
      let tx = 0, ty = 0, best = 700 * 700, found = false;
      for (const f of state.food) {
        const dx = this.wrapDeltaLocal(f.x - b.head.x);
        const dy = this.wrapDeltaLocal(f.y - b.head.y);
        const d = dx * dx + dy * dy;
        if (d < best) { best = d; tx = dx; ty = dy; found = true; }
      }
      if (found) {
        const target = Math.atan2(ty, tx);
        let diff = target - b.angle;
        while (diff < -Math.PI) diff += Math.PI * 2;
        while (diff > Math.PI) diff -= Math.PI * 2;
        b.angle += diff * 0.08;
      } else if (Math.random() < 0.04) {
        b.angle += (Math.random() - 0.5) * 1.2;
      }
      const bSpeed = (b.speedBoostTimer ?? 0) > 0 ? 9 : 6.5; // a touch slower than the player
      b.head.x = this.wrapLocal(b.head.x + Math.cos(b.angle) * bSpeed);
      b.head.y = this.wrapLocal(b.head.y + Math.sin(b.angle) * bSpeed);
      this.followBodyLocal(b);
    }

    // 2.5 Round clock first (it sets this frame's zone radius), then the world systems that
    // read it — same ordering as the server tick.
    this.updateLocalMatch(0.033); // §2 Battle Royale / Team Battle timer + shrinking storm
    if (!this.localNokia) {
      this.updateLocalStars(0.033);
      this.updateLocalWormhole(0.033);
      this.updateLocalSanctuary(0.033);
      this.resolveLocalObstacles();
      this.resolveLocalWormholeTeleport();
    }

    // 3. Check Food Collisions & Spawning
    for (const s of state.snakes) {
      if (!s.isAlive) continue;
      for (let i = state.food.length - 1; i >= 0; i--) {
        const f = state.food[i];
        const dx = this.wrapDeltaLocal(s.head.x - f.x);
        const dy = this.wrapDeltaLocal(s.head.y - f.y);
        if (dx * dx + dy * dy < (s.radius + 14) * (s.radius + 14)) {
          s.score += f.value;
          if (LOCAL_HEAL[f.type]) s.hp = Math.min(s.maxHp ?? 100, (s.hp ?? 100) + LOCAL_HEAL[f.type]); // §3 heal
          s.level = Math.floor(s.score / 250) + 1; // drives level-scaled power durations
          // Milestone-gated growth (matches the server): grow only past 500, small caps so
          // the snake never fills the screen. Radius jumps at 500/1500/3000/5000/8000.
          s.radius = s.score >= 8000 ? 23 : s.score >= 5000 ? 21 : s.score >= 3000 ? 19 : s.score >= 1500 ? 17 : s.score >= 500 ? 15 : 13;
          s.stage = s.score >= 5000 ? 'Titan' : s.score >= 3000 ? 'Elite' : s.score >= 1500 ? 'Adult' : s.score >= 500 ? 'Young' : 'Baby';
          s.length = s.score < 500 ? 9 : Math.min(40, 9 + Math.floor((s.score - 500) / 220));
          while (s.body.length < s.length) {
            const last = s.body[s.body.length - 1] || s.head;
            s.body.push({ x: last.x, y: last.y });
          }
          // §power Level-scaled buffs (⚡ speed, 🛡️ shield, 🍄 super), stacked exactly the way
          // the authoritative server does: a re-pickup EXTENDS the time left rather than
          // replacing it (2s left + a 5s power = 7s), capped so it can't become permanent.
          const dur = Math.min(POWERS.maxSeconds, POWERS.baseSeconds + Math.floor(s.level / POWERS.bonusPerLevels));
          const stack = (remaining: number) => Math.min(POWERS.maxStackedSeconds, Math.max(0, remaining) + dur);
          if (f.type === 'shield') s.shieldTimer = stack(s.shieldTimer);
          else if (f.type === 'speed') s.speedBoostTimer = stack(s.speedBoostTimer);
          else if (f.type === 'mushroom') s.superTimer = stack(s.superTimer ?? 0);
          if (s.id === this.localUserId) this.onCollect?.(f.type, f.value); // §V7 real-time mission/stat tracking
          state.food.splice(i, 1);
          state.food.push(this.genFood(`f_${Date.now()}_${i}`));
        }
      }
    }

    // 3b. Head-to-Head Snake Combat (Sprint V4 Section 1) — only heads colliding eliminate a
    // snake; the higher score survives, an exact tie destroys both. Body contact never kills.
    for (let i = 0; i < state.snakes.length; i++) {
      const a = state.snakes[i];
      if (!a.isAlive) continue;
      for (let j = i + 1; j < state.snakes.length; j++) {
        const b = state.snakes[j];
        if (!b.isAlive) continue;
        if (this.localPaused && (a.id === this.localUserId || b.id === this.localUserId)) continue; // §12
        const dx = this.wrapDeltaLocal(a.head.x - b.head.x);
        const dy = this.wrapDeltaLocal(a.head.y - b.head.y);
        const clashDist = a.radius + b.radius;
        if (dx * dx + dy * dy >= clashDist * clashDist) continue; // heads not touching

        const aSafe = a.shieldTimer > 0 || (a.superTimer ?? 0) > 0;
        const bSafe = b.shieldTimer > 0 || (b.superTimer ?? 0) > 0;
        if (a.score > b.score) {
          if (!bSafe) this.eliminateLocal(b, a);
        } else if (b.score > a.score) {
          if (!aSafe) this.eliminateLocal(a, b);
        } else {
          if (!aSafe) this.eliminateLocal(a, null);
          if (!bSafe) this.eliminateLocal(b, null);
        }
        if (!a.isAlive) break; // a eliminated — stop scanning its opponents
      }
    }

    // 3c. Respawn eliminated bots after a short delay so the world stays lively.
    for (const s of state.snakes) {
      if (s.isAlive || s.id === this.localUserId) continue;
      s.respawnAt = s.respawnAt ?? state.timestamp + 4000;
      if (state.timestamp >= s.respawnAt) {
        const bx = 300 + Math.random() * (WORLD - 600);
        const by = 300 + Math.random() * (WORLD - 600);
        s.isAlive = true;
        s.head = { x: bx, y: by };
        s.body = Array.from({ length: 9 }, (_, i) => ({ x: bx - i * 10, y: by }));
        s.score = Math.floor(100 + Math.random() * 400);
        s.length = 9;
        s.radius = 13;
        s.shieldTimer = 1.5; // brief spawn protection
        s.respawnAt = undefined;
      }
    }

    // 4. Update Leaderboard
    state.leaderboard = state.snakes
      .filter(s => s.isAlive)
      .sort((a, b) => b.score - a.score)
      .map(s => ({ id: s.id, name: s.displayName, score: Math.round(s.score), kills: s.kills }));

    // 5. Emit State Update Tick
    this.onStateUpdate?.(state);
  }

  // §3 Move + maintain the dedicated set of drifting stars.
  private updateLocalStars(dt: number) {
    if (!this.localState) return;
    const food = this.localState.food;
    const snakes = this.localState.snakes;
    let count = 0;
    for (const f of food) {
      if (f.type !== 'star') continue;
      count++;
      // Evasive: dart away from the nearest snake head; otherwise drift smoothly.
      let fleeX = 0, fleeY = 0, nearestSq = Infinity;
      for (const s of snakes) {
        if (!s.isAlive) continue;
        const dx = this.wrapDeltaLocal(f.x - s.head.x);
        const dy = this.wrapDeltaLocal(f.y - s.head.y);
        const d = dx * dx + dy * dy;
        if (d < nearestSq) { nearestSq = d; fleeX = dx; fleeY = dy; }
      }
      if (nearestSq < 240 * 240 && nearestSq > 1) {
        const dist = Math.sqrt(nearestSq);
        f.vx = (fleeX / dist) * 5.8;  // per-tick, < player 8 → catchable
        f.vy = (fleeY / dist) * 5.8;
        f.wanderTimer = 0.25;
      } else {
        f.wanderTimer = (f.wanderTimer ?? 0) - dt;
        if (f.wanderTimer <= 0) { const a = Math.random() * Math.PI * 2; const spd = 1.3 + Math.random() * 1.4; f.vx = Math.cos(a) * spd; f.vy = Math.sin(a) * spd; f.wanderTimer = 1.2 + Math.random() * 2; }
      }
      f.x = this.wrapLocal(f.x + (f.vx ?? 0));
      f.y = this.wrapLocal(f.y + (f.vy ?? 0));
    }
    this.starCooldown -= dt;
    if (count < 16 && this.starCooldown <= 0 && count < 20) { food.push(this.genStar(`star_${Date.now()}`)); this.starCooldown = 1.5; }
  }

  // §7 Four linked wormholes — always present, relocate periodically to stay dynamic.
  private genWormholes(): PortalData[] {
    const colors = ['#8B5CF6', '#EC4899', '#3B82F6', '#F59E0B'];
    const pts: Array<{ x: number; y: number }> = [];
    for (let i = 0; i < 4; i++) {
      let p: { x: number; y: number } | null = null;
      for (let t = 0; t < 20; t++) {
        const c = { x: 320 + Math.random() * (WORLD - 640), y: 320 + Math.random() * (WORLD - 640) };
        if (pts.every(q => (q.x - c.x) ** 2 + (q.y - c.y) ** 2 > 700 * 700)) { p = c; break; }
      }
      pts.push(p || { x: 320 + Math.random() * (WORLD - 640), y: 320 + Math.random() * (WORLD - 640) });
    }
    return pts.map((p, i) => ({ id: `wh_${i}`, targetId: `wh_${(i + 1) % 4}`, x: p.x, y: p.y, label: '🌀 Wormhole', color: colors[i], wormhole: true }));
  }

  private updateLocalWormhole(dt: number) {
    if (!this.localState) return;
    if (!this.localState.portals || this.localState.portals.length < 4) { this.localState.portals = this.genWormholes(); this.wormholeRelocate = 120; return; }
    this.wormholeRelocate -= dt;
    if (this.wormholeRelocate <= 0) { this.localState.portals = this.genWormholes(); this.wormholeRelocate = 120; }
  }

  // §8 Relocate the sanctuary periodically.
  private updateLocalSanctuary(dt: number) {
    if (!this.localState?.sanctuaryZone) return;
    this.sanctuaryTimer -= dt;
    if (this.sanctuaryTimer <= 0) {
      this.sanctuaryTimer = 300;
      const s = this.localState.sanctuaryZone;
      if (this.localBR || this.localTeam) {
        // §2 Players spawn in the sanctuary, so in storm modes it has to stay inside the zone.
        const sz = this.localState.safeZone;
        const angle = Math.random() * Math.PI * 2;
        const dist = Math.random() * Math.max(0, sz.radius - s.radius - 60);
        s.centerX = this.wrapLocal(sz.centerX + Math.cos(angle) * dist);
        s.centerY = this.wrapLocal(sz.centerY + Math.sin(angle) * dist);
      } else {
        s.centerX = s.radius + Math.random() * (WORLD - 2 * s.radius);
        s.centerY = s.radius + Math.random() * (WORLD - 2 * s.radius);
      }
    }

    // §2 The storm closes continuously, so the shelter scales down with it and gets pulled
    // back inside whenever the ring passes over it (mirrors the server).
    if (this.localBR || this.localTeam) {
      const sz = this.localState.safeZone;
      const s = this.localState.sanctuaryZone;
      s.radius = Math.min(360, Math.max(120, sz.radius * 0.33));
      const dx = this.wrapDeltaLocal(s.centerX - sz.centerX);
      const dy = this.wrapDeltaLocal(s.centerY - sz.centerY);
      const d = Math.hypot(dx, dy);
      const maxD = Math.max(0, sz.radius - s.radius - 60);
      if (d > maxD) {
        const k = d > 0 ? maxD / d : 0;
        s.centerX = this.wrapLocal(sz.centerX + dx * k);
        s.centerY = this.wrapLocal(sz.centerY + dy * k);
      }
    }
  }

  // §2 Blocking obstacles soft-push snake heads out; hazards deal event-driven damage.
  private resolveLocalObstacles() {
    const obs = this.localState?.obstacles;
    if (!obs?.length) return;
    for (const s of this.localState!.snakes) {
      if (!s.isAlive) continue;
      if (((s as any).hazardCd ?? 0) > 0) (s as any).hazardCd -= 0.033;
      if ((s.superTimer ?? 0) > 0 || s.shieldTimer > 0) continue; // §3 invincible power ignores hazards
      for (const ob of obs) {
        const dx = s.head.x - ob.x, dy = s.head.y - ob.y;
        const minDist = ob.radius + s.radius, distSq = dx * dx + dy * dy;
        if (distSq >= minDist * minDist) continue;
        if (ob.blocking && distSq > 0.01) {
          const dist = Math.sqrt(distSq), push = minDist - dist;
          s.head.x += (dx / dist) * push; s.head.y += (dy / dist) * push;
        }
        if (ob.damage) {
          if ((ob as any).isPoison) {
            // Poison: Damage over time (5% HP per second)
            s.hp = Math.max(0, (s.hp ?? 100) - ob.damage * 0.033);
          } else if (((s as any).hazardCd ?? 0) <= 0) {
            // Event-driven instant damage (Cactus 15%, Fire 40%, Explosion 50%) with 0.8s hit cooldown
            s.hp = Math.max(0, (s.hp ?? 100) - ob.damage);
            (s as any).hazardCd = 0.8;
          }
          if ((s.hp ?? 100) <= 0) { this.eliminateLocal(s, null); break; }
        }
      }
    }
  }

  // §7 Entering wh_i exits from its LINKED wormhole (escape route) + short cooldown.
  private resolveLocalWormholeTeleport() {
    const holes = this.localState?.portals;
    if (!holes || holes.length < 2) return;
    for (const s of this.localState!.snakes) {
      if (!s.isAlive) continue;
      if ((s as any).teleportCd > 0) { (s as any).teleportCd -= 0.033; continue; }
      for (const wh of holes) {
        const dx = this.wrapDeltaLocal(s.head.x - wh.x);
        const dy = this.wrapDeltaLocal(s.head.y - wh.y);
        if (dx * dx + dy * dy < 44 * 44) {
          const target = holes.find(p => p.id === wh.targetId) || holes.find(p => p.id !== wh.id);
          if (!target) break;
          const ang = Math.random() * Math.PI * 2;
          const nx = this.wrapLocal(target.x + Math.cos(ang) * 80);
          const ny = this.wrapLocal(target.y + Math.sin(ang) * 80);
          const offX = nx - s.head.x, offY = ny - s.head.y;
          s.head.x = nx; s.head.y = ny;
          s.body.forEach(seg => { seg.x = this.wrapLocal(seg.x + offX); seg.y = this.wrapLocal(seg.y + offY); });
          (s as any).teleportCd = 3.0;
          break;
        }
      }
    }
  }

  // Local-engine elimination: mark the loser dead, reward the winner, scatter a little food.
  // §2 Classic Snake self-collision — head touching its own body (past a small gap) = death.
  private selfCollide(s: SnakeData): boolean {
    for (let i = 6; i < s.body.length; i++) {
      const dx = s.head.x - s.body[i].x, dy = s.head.y - s.body[i].y;
      if (dx * dx + dy * dy < (s.radius * 0.8) * (s.radius * 0.8)) return true;
    }
    return false;
  }

  // §2 Battle Royale & Team Battle — timer, shrinking storm that eliminates snakes left outside, victory on timer / last standing / team wipe.
  private updateLocalMatch(_dt: number) {
    const state = this.localState;
    const isCompetitive = this.localBR || this.localTeam;
    if (!state || !isCompetitive || this.localMatchOver) return;

    // Real elapsed time, not the nominal 33 ms: a throttled/backgrounded tab would otherwise
    // let the HUD countdown drift away from the storm the player is actually standing in.
    const now = Date.now();
    const dt = this.localMatchLastTs ? Math.min(0.5, (now - this.localMatchLastTs) / 1000) : 0;
    this.localMatchLastTs = now;

    // §12 The round is frozen while the app is backgrounded — the player can't steer, so the
    // clock must not run and the storm must not close in or bite.
    if (this.localPaused) return;

    this.localMatchTimer = Math.max(0, this.localMatchTimer - dt);
    state.matchTimer = Math.ceil(this.localMatchTimer);

    // Same curve as the server: hold full size through the grace period, then close smoothly
    // and reach the final radius at ZONE_CLOSE_AT_PCT of the round.
    const sz = state.safeZone;
    const elapsed = Math.max(0, MATCH_SECONDS - this.localMatchTimer);
    const shrinkWindow = Math.max(1, MATCH_SECONDS * ZONE_CLOSE_AT_PCT - ZONE_GRACE);
    const progress = Math.min(1, Math.max(0, (elapsed - ZONE_GRACE) / shrinkWindow));
    sz.radius = ZONE_FINAL_R + (ZONE_START_R - ZONE_FINAL_R) * (1 - progress);
    sz.targetRadius = ZONE_FINAL_R;

    const sanctuary = state.sanctuaryZone;
    for (const s of state.snakes) {
      if (!s.isAlive || (s.shieldTimer ?? 0) > 0) continue;
      // Inside the 🛡️ Safe Sanctuary the storm can't reach you (matches the server).
      if (sanctuary) {
        const sdx = this.wrapDeltaLocal(s.head.x - sanctuary.centerX);
        const sdy = this.wrapDeltaLocal(s.head.y - sanctuary.centerY);
        if (sdx * sdx + sdy * sdy < sanctuary.radius * sanctuary.radius) { (s as any).stormT = 0; continue; }
      }
      const dx = this.wrapDeltaLocal(s.head.x - sz.centerX), dy = this.wrapDeltaLocal(s.head.y - sz.centerY);
      if (dx * dx + dy * dy > sz.radius * sz.radius) {
        (s as any).stormT = ((s as any).stormT ?? 0) + dt;
        if ((s as any).stormT > 2) {
          s.hp = Math.max(0, (s.hp ?? 100) - sz.damagePerSecond * dt);
          if (s.hp <= 0) this.eliminateLocal(s, null);
        }
      } else {
        (s as any).stormT = 0;
      }
    }

    if (this.localBR) {
      const alive = state.snakes.filter(s => s.isAlive);
      if (this.localMatchTimer <= 0 || alive.length <= 1) {
        this.localMatchOver = true;
        state.matchOver = true;
      }
    } else if (this.localTeam) {
      const blueAlive = state.snakes.filter(s => s.isAlive && s.team === 'blue').length;
      const redAlive = state.snakes.filter(s => s.isAlive && s.team === 'red').length;
      if (this.localMatchTimer <= 0 || blueAlive === 0 || redAlive === 0) {
        this.localMatchOver = true;
        state.matchOver = true;
      }
    }
  }

  private eliminateLocal(loser: SnakeData, winner: SnakeData | null) {
    if (!loser.isAlive) return;
    loser.isAlive = false;
    if (winner) {
      winner.kills++;
      winner.score += 200 + Math.floor(loser.score * 0.25);
      // §2 Team Battle scoring
      if (this.localTeam && winner.team && this.localState?.teamScores) this.localState.teamScores[winner.team]++;
    }
    if (!this.localState) return;
    const food = this.localState.food;
    for (let k = 0; k < loser.body.length; k += 4) {
      const seg = loser.body[k];
      food.push({
        id: `drop_${Date.now()}_${k}_${Math.random().toString(36).slice(2, 5)}`,
        x: seg.x + (Math.random() - 0.5) * 20,
        y: seg.y + (Math.random() - 0.5) * 20,
        value: 15, type: 'apple', color: '#ff3333', icon: '🍎',
      });
    }
    this.trimLocalFood();
  }

  // Keep the collectible count bounded by retiring the oldest corpse drops first, so the base
  // food/star population (and anything a player is chasing) is never the thing that vanishes.
  private trimLocalFood() {
    const food = this.localState?.food;
    if (!food || food.length <= MAX_LOCAL_FOOD) return;
    let excess = food.length - MAX_LOCAL_FOOD;
    for (let i = 0; i < food.length && excess > 0; ) {
      if (food[i].id.startsWith('drop_')) { food.splice(i, 1); excess--; } else i++;
    }
  }
}
