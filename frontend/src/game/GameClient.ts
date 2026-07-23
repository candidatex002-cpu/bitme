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
  abilityCooldown: number;
  abilityActiveTimer: number;
  team?: 'red' | 'blue';
  isBoss?: boolean;
  equippedAccessory?: string;
}

export interface FoodData {
  id: string; x: number; y: number; value: number; type: string; color: string; icon?: string;
}

export interface SafeZoneData {
  centerX: number; centerY: number; radius: number; targetRadius: number; damagePerSecond: number;
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
  leaderboard: Array<{ id: string; name: string; score: number; kills: number; team?: 'red' | 'blue' }>;
  teamScores?: { red: number; blue: number };
  currentEvent?: WorldEventData;
}

export interface ModeConfig {
  mode: GameMode; label: string; tagline: string;
  shrinkingZone: boolean; teamsEnabled: boolean; worldEvents: boolean; botCount: number;
}

export function serverBase(): string {
  const override = new URLSearchParams(location.search).get('server');
  if (override) return override;
  if (location.port === '3000' || location.port === '5173') return `${location.protocol}//${location.hostname}:4000`;
  return location.origin;
}

const FOOD_TYPES = [
  { type: 'cherry', val: 10, icon: '🍒', color: '#ff4d4d' },
  { type: 'apple', val: 15, icon: '🍎', color: '#ff3333' },
  { type: 'mushroom', val: 20, icon: '🍄', color: '#ff9933' },
  { type: 'frog', val: 25, icon: '🐸', color: '#33cc33' },
  { type: 'star', val: 50, icon: '⭐', color: '#ffcc00' },
  { type: 'shield', val: 30, icon: '🛡️', color: '#3399ff' },
  { type: 'speed', val: 30, icon: '⚡', color: '#ff66cc' },
];

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

  // Local Authoritative Simulation Engine (for serverless environments like Vercel Cloud)
  private isLocalEngineRunning = false;
  private localEngineTimer: any = null;
  private lastServerTickTime = 0;
  private fallbackTimer: any = null;
  private localState: GameStateTick | null = null;
  private localInput = { angle: 0, boosting: false };

  constructor() {
    this.localUserId = 'usr_' + Math.random().toString(36).substring(2, 9);
  }

  public connect(token: string, skinName: string = 'Forest', mode: GameMode = 'classic', region = 'Global', matchType: 'local' | 'global' = 'global') {
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
      this.socket = io(serverBase(), {
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
        this.onStateUpdate?.(tick);
      });

      this.socket.on('respawn_result', (r: any) => this.onRespawnResult?.(r));
      this.socket.on('ability_result', (r: { used: boolean }) => this.onAbilityResult?.(r.used));
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

  public disconnect() {
    if (this.socket) { this.socket.disconnect(); this.socket = null; }
    this.isConnected = false;
    this.stopLocalEngine();
    if (this.fallbackTimer) clearTimeout(this.fallbackTimer);
  }

  public sendInput(angle: number, boosting: boolean) {
    this.localInput = { angle, boosting };
    if (this.socket && this.isConnected) {
      this.inputSeq++;
      this.socket.emit('client_input', { seq: this.inputSeq, angle, boosting });
    }
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
        me.head = { x: 1600 + (Math.random() - 0.5) * 400, y: 1600 + (Math.random() - 0.5) * 400 };
        me.body = Array.from({ length: 12 }, (_, i) => ({ x: me.head.x - i * 10, y: me.head.y }));
        this.onRespawnResult?.({ success: true, method });
      }
      return;
    }
    if (this.socket && this.isConnected) this.socket.emit('respawn', { method });
  }

  // ---------------------------------------------------------------- Local Simulation Engine
  private startLocalEngine(skinName: string, mode: GameMode, region: string) {
    this.isLocalEngineRunning = true;

    const me: SnakeData = {
      id: this.localUserId,
      userId: this.localUserId,
      displayName: 'You (Explorer)',
      skin: skinName,
      head: { x: 1600, y: 1600 },
      body: Array.from({ length: 14 }, (_, i) => ({ x: 1600 - i * 12, y: 1600 })),
      angle: 0,
      speed: 4,
      speedPct: 1,
      boosting: false,
      score: 150,
      level: 1,
      length: 14,
      radius: 18,
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
    };

    const bots: SnakeData[] = BOT_NAMES.map((name, idx) => {
      const bx = 400 + Math.random() * 2400;
      const by = 400 + Math.random() * 2400;
      return {
        id: `bot_${idx}`,
        userId: `bot_${idx}`,
        displayName: name,
        skin: BOT_SKINS[idx % BOT_SKINS.length],
        head: { x: bx, y: by },
        body: Array.from({ length: 12 }, (_, i) => ({ x: bx - i * 10, y: by })),
        angle: Math.random() * Math.PI * 2,
        speed: 3.5,
        speedPct: 1,
        boosting: false,
        score: Math.floor(100 + Math.random() * 400),
        level: 1,
        length: 12,
        radius: 18,
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
      };
    });

    const foodItems: FoodData[] = Array.from({ length: 140 }, (_, i) => this.genFood(`f_${i}`));

    this.localState = {
      tick: 1,
      timestamp: Date.now(),
      mode,
      snakes: [me, ...bots],
      food: foodItems,
      safeZone: { centerX: 1600, centerY: 1600, radius: 1500, targetRadius: 1500, damagePerSecond: 2 },
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
      x: 100 + Math.random() * 3000,
      y: 100 + Math.random() * 3000,
      value: fType.val,
      type: fType.type,
      color: fType.color,
      icon: fType.icon,
    };
  }

  private updateLocalEngine() {
    if (!this.localState) return;
    const state = this.localState;
    state.tick++;
    state.timestamp = Date.now();

    // 1. Update Player Snake Movement
    const me = state.snakes.find(s => s.id === this.localUserId);
    if (me && me.isAlive) {
      me.angle = this.localInput.angle;
      me.boosting = this.localInput.boosting && me.score > 20;
      const speed = me.boosting ? 7.5 : 4.0;
      if (me.boosting) me.score = Math.max(10, me.score - 0.2);

      me.head.x += Math.cos(me.angle) * speed;
      me.head.y += Math.sin(me.angle) * speed;
      me.head.x = Math.max(50, Math.min(3150, me.head.x));
      me.head.y = Math.max(50, Math.min(3150, me.head.y));

      // Update Body segments LERP
      let prev = { ...me.head };
      for (let i = 0; i < me.body.length; i++) {
        const seg = me.body[i];
        const dx = prev.x - seg.x;
        const dy = prev.y - seg.y;
        const dist = Math.hypot(dx, dy);
        if (dist > 10) {
          seg.x += (dx / dist) * (dist - 10);
          seg.y += (dy / dist) * (dist - 10);
        }
        prev = { ...seg };
      }
      if (me.abilityCooldown > 0) me.abilityCooldown = Math.max(0, me.abilityCooldown - 0.033);
    }

    // 2. Update Bot AI Movement
    for (const b of state.snakes) {
      if (b.id === this.localUserId || !b.isAlive) continue;
      // Random direction change occasionally or steer towards food
      if (Math.random() < 0.04) {
        b.angle += (Math.random() - 0.5) * 1.2;
      }
      b.head.x += Math.cos(b.angle) * 3.5;
      b.head.y += Math.sin(b.angle) * 3.5;
      b.head.x = Math.max(80, Math.min(3120, b.head.x));
      b.head.y = Math.max(80, Math.min(3120, b.head.y));

      let prev = { ...b.head };
      for (let i = 0; i < b.body.length; i++) {
        const seg = b.body[i];
        const dx = prev.x - seg.x;
        const dy = prev.y - seg.y;
        const dist = Math.hypot(dx, dy);
        if (dist > 10) {
          seg.x += (dx / dist) * (dist - 10);
          seg.y += (dy / dist) * (dist - 10);
        }
        prev = { ...seg };
      }
    }

    // 3. Check Food Collisions & Spawning
    for (const s of state.snakes) {
      if (!s.isAlive) continue;
      for (let i = state.food.length - 1; i >= 0; i--) {
        const f = state.food[i];
        const dx = s.head.x - f.x;
        const dy = s.head.y - f.y;
        if (dx * dx + dy * dy < (s.radius + 14) * (s.radius + 14)) {
          s.score += f.value;
          s.length = Math.min(60, 14 + Math.floor(s.score / 20));
          while (s.body.length < s.length) {
            const last = s.body[s.body.length - 1] || s.head;
            s.body.push({ x: last.x, y: last.y });
          }
          state.food.splice(i, 1);
          state.food.push(this.genFood(`f_${Date.now()}_${i}`));
        }
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
}
