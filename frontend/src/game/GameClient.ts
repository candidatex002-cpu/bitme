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

// Where the authoritative backend lives. In dev the Vite client runs on :3000/:5173
// and must talk to the backend on :4000 directly (the ws proxy is unreliable);
// in production the same origin serves both. Override with ?server=<url>.
export function serverBase(): string {
  const override = new URLSearchParams(location.search).get('server');
  if (override) return override;
  if (location.port === '3000' || location.port === '5173') return `${location.protocol}//${location.hostname}:4000`;
  return location.origin;
}

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

  public connect(token: string, skinName: string = 'Forest', mode: GameMode = 'classic', region = 'Global', matchType: 'local' | 'global' = 'global') {
    const authPayload = { token, skin: skinName, mode, region, matchType };
    if (this.socket && this.socket.connected) {
      this.socket.emit('authenticate', authPayload);
      return;
    }
    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
    }

    // Connect to backend with polling fallback first for stable connection setup
    this.socket = io(serverBase(), {
      transports: ['polling', 'websocket'],
      reconnection: true,
      reconnectionAttempts: 15,
      reconnectionDelay: 1000,
      closeOnBeforeunload: true,
    });

    this.socket.on('connect', () => {
      this.isConnected = true;
      this.socket?.emit('authenticate', authPayload);
    });

    this.socket.on('authenticated', (data: { userId: string; snake: SnakeData; config: ModeConfig }) => {
      this.localUserId = data.userId;
      this.modeConfig = data.config;
      this.onAuthSuccess?.(data.userId, data.snake, data.config);
    });

    this.socket.on('game_state_tick', (tick: GameStateTick) => this.onStateUpdate?.(tick));
    this.socket.on('respawn_result', (r: any) => this.onRespawnResult?.(r));
    this.socket.on('ability_result', (r: { used: boolean }) => this.onAbilityResult?.(r.used));

    this.socket.on('disconnect', () => { this.isConnected = false; });
  }

  public disconnect() {
    if (this.socket) { this.socket.disconnect(); this.socket = null; }
    this.isConnected = false;
  }

  public sendInput(angle: number, boosting: boolean) {
    if (!this.socket || !this.isConnected) return;
    this.inputSeq++;
    this.socket.emit('client_input', { seq: this.inputSeq, angle, boosting });
  }

  public activateAbility() {
    if (!this.socket || !this.isConnected) return;
    this.socket.emit('activate_ability');
  }

  public requestRespawn(method: 'stars' | 'ticket' | 'ad' | 'wait') {
    if (!this.socket || !this.isConnected) return;
    this.socket.emit('respawn', { method });
  }
}
