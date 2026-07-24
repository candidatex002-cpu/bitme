import {
  GameWorldState,
  SnakeState,
  FoodItem,
  Vector2D,
  CollectibleType,
  WorldEvent,
  GameMode,
  GameModeConfig,
  GrowthStage,
  Obstacle,
  ObstacleType,
} from '../types';
import { db } from '../db/Database';
import { antiCheat } from './AntiCheatService';

interface CollectibleTemplate {
  type: CollectibleType;
  icon: string;
  value: number;
  color: string;
  weight: number;
  hpRestore?: number;
  buff?: 'shield' | 'speed';
  buffDuration?: number;
}

// Power-up table — values mirror the game design board.
const COLLECTIBLE_TABLE: CollectibleTemplate[] = [
  { type: 'cherry', icon: '🍒', value: 10, color: '#E63950', weight: 30, hpRestore: 5 },
  { type: 'mushroom', icon: '🍄', value: 15, color: '#E85D75', weight: 22, hpRestore: 4 },
  { type: 'apple', icon: '🍎', value: 25, color: '#EF3E36', weight: 20, hpRestore: 8 },
  { type: 'frog', icon: '🐸', value: 30, color: '#5FB85A', weight: 16 },
  // ⭐ stars are NOT spawned here — they are a dedicated set of moving collectibles (§3)
  { type: 'shield', icon: '🛡️', value: 15, color: '#3E92CC', weight: 5, buff: 'shield', buffDuration: 8 },
  { type: 'speed', icon: '⚡', value: 15, color: '#FFD23F', weight: 5, buff: 'speed', buffDuration: 6 },
  { type: 'egg', icon: '🥚', value: 500, color: '#F4E9CD', weight: 2, hpRestore: 25 },
];

// New 6-stage growth table — score-based thresholds matching SCORE_EVOLUTION_THRESHOLDS.
// Physical radius is CAPPED at Titan level (34px) — score keeps going, snake stops growing.
const STAGE_THRESHOLDS: Array<{ stage: GrowthStage; min: number; radius: number; defense: number; growthFactor: number }> = [
  { stage: 'Baby',  min: 0,    radius: 14, defense: 0,  growthFactor: 0.8  }, // fast early growth
  { stage: 'Young', min: 500,  radius: 18, defense: 8,  growthFactor: 0.6  }, // medium growth
  { stage: 'Teen',  min: 1000, radius: 22, defense: 14, growthFactor: 0.45 }, // slowing down
  { stage: 'Adult', min: 1500, radius: 26, defense: 22, growthFactor: 0.3  }, // slow
  { stage: 'Elite', min: 2000, radius: 30, defense: 32, growthFactor: 0.15 }, // very slow
  { stage: 'Titan', min: 2500, radius: 34, defense: 40, growthFactor: 0.05 }, // almost stops — Titan cap
];

// §2 Obstacle palette — blocking props soft-push snakes; cosmetic ones are decoration only.
const OBSTACLE_TEMPLATES: Array<{ type: ObstacleType; icon: string; radius: number; blocking: boolean }> = [
  { type: 'tree', icon: '🌳', radius: 34, blocking: true },
  { type: 'rock', icon: '🪨', radius: 30, blocking: true },
  { type: 'bush', icon: '🌲', radius: 28, blocking: false },
  { type: 'cactus', icon: '🌵', radius: 24, blocking: true },
  { type: 'flowerbed', icon: '🌼', radius: 26, blocking: false },
  { type: 'log', icon: '🪵', radius: 26, blocking: false },
  { type: 'pond', icon: '🪷', radius: 46, blocking: false },
  { type: 'hill', icon: '⛰️', radius: 40, blocking: true },
];

const MODE_CONFIGS: Record<GameMode, GameModeConfig> = {
  classic: { mode: 'classic', label: 'Classic', tagline: 'Free For All', shrinkingZone: false, teamsEnabled: false, worldEvents: false, botCount: 8 },
  battle_royale: { mode: 'battle_royale', label: 'Battle Royale', tagline: 'Last Snake Standing', shrinkingZone: true, teamsEnabled: false, worldEvents: true, botCount: 10 },
  team: { mode: 'team', label: 'Team Mode', tagline: '4v4 Team Battle', shrinkingZone: false, teamsEnabled: true, worldEvents: false, botCount: 8 },
  event: { mode: 'event', label: 'Event Mode', tagline: 'Special Events', shrinkingZone: true, teamsEnabled: false, worldEvents: true, botCount: 8 },
};

export function getModeConfig(mode: GameMode): GameModeConfig {
  return MODE_CONFIGS[mode] || MODE_CONFIGS.classic;
}

export class GameSessionService {
  private state: GameWorldState;
  private config: GameModeConfig;
  private simulationInterval: NodeJS.Timeout | null = null;
  private readonly TICK_RATE = 30;
  private readonly WORLD_SIZE = 3200;
  private readonly BASE_SPEED = 240; // Faster, smooth, responsive movement
  private readonly BOOST_MULT = 1.7;
  private readonly MAX_LENGTH = 220;

  // §3 moving stars
  private readonly STAR_MAX = 20;
  private readonly STAR_TARGET = 16;
  private starCooldown = 0;
  // §7 dynamic wormhole lifecycle (active 1 min, then a 4 min gap → 5 min cadence)
  private wormholeActive = false;
  private wormholeLife = 0;
  private wormholePhaseTimer = 60; // first wormhole appears ~1 min into the match
  // §8 dynamic safe/sanctuary zone relocation
  private sanctuaryTimer = 300;

  private eventTimer = 180;
  private currentEventIndex = 0;
  private availableEvents: WorldEvent[] = [
    { id: 'evt_rain', type: 'rain_storm', title: '🌧️ Monsoon Rain Storm', description: 'Vision restricted! Frog & Star spawns tripled!', active: true, timerSeconds: 180, icon: '🌧️' },
    { id: 'evt_boss', type: 'boss_anaconda_raid', title: '🐉 TITAN BOSS RAID', description: 'A Titan Anaconda stalks the park centre. Team up to bring it down!', active: false, timerSeconds: 180, icon: '🐉' },
    { id: 'evt_volcano', type: 'volcano_eruption', title: '🌋 Lava Eruption', description: 'Speed crystals erupting across the reserve!', active: false, timerSeconds: 180, icon: '🌋' },
    { id: 'evt_coupon', type: 'treasure_balloon', title: '🎁 Treasure Box Drop', description: 'Sponsored gift boxes dropped near the city stores!', active: false, timerSeconds: 180, icon: '🎁' },
  ];

  constructor(matchId: string, mode: GameMode = 'classic') {
    this.config = getModeConfig(mode);
    this.state = {
      matchId,
      mode,
      region: 'North America East',
      status: 'in_progress',
      tick: 0,
      worldSize: this.WORLD_SIZE,
      safeZone: {
        centerX: this.WORLD_SIZE / 2,
        centerY: this.WORLD_SIZE / 2,
        radius: this.config.shrinkingZone ? 1500 : 1600,
        targetRadius: this.config.shrinkingZone ? 500 : 1600,
        shrinkRate: this.config.shrinkingZone ? 6 : 0,
        damagePerSecond: 15,
      },
      // Peaceful Sanctuary Zone — No PvP / No Damage / Hide Safely Inside!
      sanctuaryZone: {
        centerX: 1600,
        centerY: 1600,
        radius: 340,
        label: '🛡️ Safe Sanctuary',
        icon: '🛡️',
      },
      // §7 Dynamic wormholes spawn into this array on a timed cycle (starts empty)
      portals: [],
      obstacles: [],
      snakes: {},
      food: {},
      leaderboard: [],
      teamScores: this.config.teamsEnabled ? { red: 0, blue: 0 } : undefined,
      currentEvent: this.config.worldEvents ? this.availableEvents[0] : undefined,
    };

    this.spawnInitialCollectibles(60); // Clean, lesser food count
    this.spawnMovingStars(this.STAR_TARGET); // §3
    this.spawnObstacles(); // §2
    this.spawnBotSnakes(this.config.botCount);
    this.startLoop();
  }

  private startLoop() {
    const tickIntervalMs = 1000 / this.TICK_RATE;
    this.simulationInterval = setInterval(() => this.updateTick(1 / this.TICK_RATE), tickIntervalMs);
  }

  public getState(): GameWorldState {
    return this.state;
  }

  public getConfig(): GameModeConfig {
    return this.config;
  }

  // §6 Toroidal (wrap-around) world helpers — no borders; exit one edge, appear on the other.
  private wrap(v: number): number { const w = this.WORLD_SIZE; return ((v % w) + w) % w; }
  private wrapDelta(d: number): number { const w = this.WORLD_SIZE; let r = ((d % w) + w) % w; if (r > w / 2) r -= w; return r; }

  // ---------------------------------------------------------------- stage math
  private computeStage(score: number): { stage: GrowthStage; radius: number; defense: number; growthFactor: number } {
    let match = STAGE_THRESHOLDS[0];
    for (const t of STAGE_THRESHOLDS) {
      if (score >= t.min) match = t;
    }
    // Smoothly interpolate radius between stages for a fluid feel — but never exceed the cap.
    const idx = STAGE_THRESHOLDS.indexOf(match);
    const next = STAGE_THRESHOLDS[idx + 1];
    let radius = match.radius;
    if (next) {
      const t = Math.min(1, (score - match.min) / (next.min - match.min));
      radius = match.radius + (next.radius - match.radius) * t * 0.8; // ease out
    }
    // Hard cap — never exceed Titan radius regardless of score
    const TITAN_RADIUS = 34;
    radius = Math.min(TITAN_RADIUS, radius);
    return { stage: match.stage, radius, defense: match.defense, growthFactor: match.growthFactor };
  }

  private assignTeam(): 'red' | 'blue' | undefined {
    if (!this.config.teamsEnabled) return undefined;
    let red = 0;
    let blue = 0;
    for (const id in this.state.snakes) {
      if (this.state.snakes[id].team === 'red') red++;
      else if (this.state.snakes[id].team === 'blue') blue++;
    }
    return red <= blue ? 'red' : 'blue';
  }

  // ---------------------------------------------------------------- players
  public registerPlayer(userId: string, displayName: string, skin: string = 'Forest', isBot = false, evolution: string = 'Baby', region?: string): SnakeState {
    const spawnPos: Vector2D = {
      x: 400 + Math.random() * (this.WORLD_SIZE - 800),
      y: 400 + Math.random() * (this.WORLD_SIZE - 800),
    };
    const initialBody = Array.from({ length: 12 }, (_, i) => ({ x: spawnPos.x - i * 14, y: spawnPos.y }));
    const { stage, radius, defense } = this.computeStage(0);

    const snake: SnakeState = {
      id: userId,
      userId,
      displayName,
      skin,
      head: spawnPos,
      body: initialBody,
      angle: Math.random() * Math.PI * 2,
      speed: this.BASE_SPEED,
      speedPct: 72,
      boosting: false,
      score: 0,
      level: 1,
      length: initialBody.length,
      radius,
      hp: 100,
      maxHp: 100,
      defense,
      stage,
      evolution: isBot ? stage : evolution,
      region,
      isAlive: true,
      isAutoProtectAI: false,
      autoProtectTimer: 0,
      kills: 0,
      shieldTimer: 0,
      speedBoostTimer: 0,
      abilityCooldown: 0,
      abilityActiveTimer: 0,
      distanceTravelled: 0,
      team: this.assignTeam(),
      isBot,
    };

    this.state.snakes[userId] = snake;
    return snake;
  }

  public respawnPlayer(userId: string, displayName: string, skin: string, evolution: string = 'Baby', region?: string): SnakeState {
    return this.registerPlayer(userId, displayName, skin, false, evolution, region);
  }

  public handlePlayerInput(userId: string, angle: number, boosting: boolean, _seq: number): void {
    const snake = this.state.snakes[userId];
    if (!snake || !snake.isAlive || snake.isPaused) return;
    // §17 Never trust client data — reject malformed input (NaN / Infinity angle injection).
    if (typeof angle !== 'number' || !Number.isFinite(angle)) return;
    if (!antiCheat.validatePacketFrequency(userId)) return;

    snake.angle = angle;
    // Boost only when the snake has enough body to burn.
    const nextBoost = boosting && snake.body.length > 8;
    if (nextBoost && !snake.boosting && !snake.isBot) db.incrementCollectible(userId, 'boost');
    snake.boosting = nextBoost;
    snake.isAutoProtectAI = false;
    snake.autoProtectTimer = 0;
  }

  // Special ability — "Coil Guard": short dash + protective shield, then cooldown.
  public activateAbility(userId: string): boolean {
    const snake = this.state.snakes[userId];
    if (!snake || !snake.isAlive || snake.abilityCooldown > 0) return false;
    snake.shieldTimer = Math.max(snake.shieldTimer, 3);
    snake.speedBoostTimer = Math.max(snake.speedBoostTimer, 2);
    snake.abilityActiveTimer = 3;
    snake.abilityCooldown = 12;
    return true;
  }

  public handlePlayerDisconnect(userId: string): void {
    const snake = this.state.snakes[userId];
    if (snake && snake.isAlive) {
      snake.isAutoProtectAI = true;
      snake.autoProtectTimer = 20;
    }
  }

  public removePlayer(userId: string): void {
    delete this.state.snakes[userId];
  }

  // ---------------------------------------------------------------- main loop
  private updateTick(dt: number) {
    this.state.tick++;

    if (this.config.worldEvents) this.updateWorldEvent(dt);

    if (this.config.shrinkingZone && this.state.safeZone.radius > this.state.safeZone.targetRadius) {
      this.state.safeZone.radius -= this.state.safeZone.shrinkRate * dt;
    }

    this.updateStars(dt);      // §3
    this.updateWormhole(dt);   // §7
    this.updateSanctuary(dt);  // §8

    // Movement + hazards
    for (const id in this.state.snakes) {
      const snake = this.state.snakes[id];
      if (!snake.isAlive || snake.isPaused) continue; // §12 paused players are frozen
      this.updateSnake(snake, dt);
    }

    this.resolveFoodPickups();
    this.resolveCombat();
    this.maintainCollectibles();
    if (this.state.tick % 900 === 0) this.maintainObstacles(); // §2 re-scale ~every 30s
    this.updateLeaderboard();
  }

  private updateSnake(snake: SnakeState, dt: number) {
    // Tick down timers
    if (snake.shieldTimer > 0) snake.shieldTimer = Math.max(0, snake.shieldTimer - dt);
    if (snake.speedBoostTimer > 0) snake.speedBoostTimer = Math.max(0, snake.speedBoostTimer - dt);
    if (snake.abilityCooldown > 0) snake.abilityCooldown = Math.max(0, snake.abilityCooldown - dt);
    if (snake.abilityActiveTimer > 0) snake.abilityActiveTimer = Math.max(0, snake.abilityActiveTimer - dt);

    if (snake.isAutoProtectAI) {
      snake.autoProtectTimer -= dt;
      snake.angle += (Math.random() - 0.5) * 0.1;
      if (snake.autoProtectTimer <= 0) {
        this.killSnake(snake, 'Left the reserve');
        return;
      }
    }

    if (snake.isBot) this.updateBotAI(snake, dt);

    // Speed model
    const base = snake.isBoss ? 150 : this.BASE_SPEED;
    let speed = base;
    if (snake.boosting) speed *= this.BOOST_MULT;
    if (snake.speedBoostTimer > 0) speed *= 1.4;
    snake.speed = speed;
    snake.speedPct = Math.round(Math.min(100, (speed / 250) * 90));

    // Boost burns length + score slowly
    if (snake.boosting && snake.body.length > 8 && this.state.tick % 6 === 0) {
      snake.body.pop();
      snake.score = Math.max(0, snake.score - 1);
    }

    const moveX = Math.cos(snake.angle) * speed * dt;
    const moveY = Math.sin(snake.angle) * speed * dt;
    snake.distanceTravelled += Math.sqrt(moveX * moveX + moveY * moveY) / 100;

    // §6 Infinite wrap-around world — no borders, no wall damage.
    snake.head.x = this.wrap(snake.head.x + moveX);
    snake.head.y = this.wrap(snake.head.y + moveY);

    // §7 Wormhole teleport — entering an active wormhole jumps to a random SAFE location.
    if (this.state.portals && this.state.portals.length) {
      if ((snake as any).teleportCooldown > 0) {
        (snake as any).teleportCooldown -= dt;
      } else {
        for (const wh of this.state.portals) {
          const dx = snake.head.x - wh.x;
          const dy = snake.head.y - wh.y;
          if (dx * dx + dy * dy < 42 * 42) {
            const dest = this.randomSafeLocation(snake);
            const offsetX = dest.x - snake.head.x;
            const offsetY = dest.y - snake.head.y;
            snake.head.x = dest.x;
            snake.head.y = dest.y;
            snake.body.forEach(seg => { seg.x += offsetX; seg.y += offsetY; });
            (snake as any).teleportCooldown = 3.0; // short cooldown after teleport
            break;
          }
        }
      }
    }

    // §2 Soft obstacle collision — blocking props gently push the head out (never kills).
    if (this.state.obstacles) {
      for (const ob of this.state.obstacles) {
        if (!ob.blocking) continue;
        const dx = snake.head.x - ob.x;
        const dy = snake.head.y - ob.y;
        const minDist = ob.radius + snake.radius;
        const distSq = dx * dx + dy * dy;
        if (distSq < minDist * minDist && distSq > 0.01) {
          const dist = Math.sqrt(distSq);
          const push = (minDist - dist);
          snake.head.x += (dx / dist) * push;
          snake.head.y += (dy / dist) * push;
        }
      }
    }
    // Body follows head — §6 uses the shortest toroidal delta so it wraps across the seam.
    let prev = { x: snake.head.x, y: snake.head.y };
    const spacing = 14;
    for (let i = 0; i < snake.body.length; i++) {
      const seg = snake.body[i];
      const dx = this.wrapDelta(prev.x - seg.x);
      const dy = this.wrapDelta(prev.y - seg.y);
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > spacing) {
        const ratio = (dist - spacing) / dist;
        seg.x = this.wrap(seg.x + dx * ratio);
        seg.y = this.wrap(seg.y + dy * ratio);
      }
      prev = { x: seg.x, y: seg.y };
    }

    // Storm damage outside the safe zone (toroidal distance)
    const dCx = this.wrapDelta(snake.head.x - this.state.safeZone.centerX);
    const dCy = this.wrapDelta(snake.head.y - this.state.safeZone.centerY);
    if (Math.sqrt(dCx * dCx + dCy * dCy) > this.state.safeZone.radius && snake.shieldTimer <= 0) {
      this.damageSnake(snake, this.state.safeZone.damagePerSecond * dt, 'Caught in the storm');
    }

    // §8 Healing inside the Safe Sanctuary (moving zone) — temporary protection + regen.
    if (this.isInsideSanctuary(snake) && snake.hp < snake.maxHp) {
      snake.hp = Math.min(snake.maxHp, snake.hp + 12 * dt);
    }
  }

  // Check if snake is inside Safe Sanctuary Zone
  private isInsideSanctuary(snake: SnakeState): boolean {
    if (!this.state.sanctuaryZone) return false;
    const s = this.state.sanctuaryZone;
    const dx = this.wrapDelta(snake.head.x - s.centerX);
    const dy = this.wrapDelta(snake.head.y - s.centerY);
    return (dx * dx + dy * dy) < (s.radius * s.radius);
  }

  // Defense-aware damage. Shield or Safe Sanctuary fully negates.
  private damageSnake(snake: SnakeState, amount: number, reason: string) {
    if (snake.shieldTimer > 0 || this.isInsideSanctuary(snake)) return;
    const reduced = amount * (1 - snake.defense / 100);
    snake.hp = Math.max(0, snake.hp - reduced);
    if (snake.hp <= 0) this.killSnake(snake, reason);
  }

  private resolveFoodPickups() {
    for (const snakeId in this.state.snakes) {
      const snake = this.state.snakes[snakeId];
      if (!snake.isAlive || snake.isPaused) continue;

      for (const foodId in this.state.food) {
        const food = this.state.food[foodId];
        const dx = this.wrapDelta(snake.head.x - food.x);
        const dy = this.wrapDelta(snake.head.y - food.y);
        const distSq = dx * dx + dy * dy;

        // Pickup collision check (radius + 20)
        const pickupRadius = snake.radius + 20;
        if (distSq < pickupRadius * pickupRadius) {
          delete this.state.food[foodId];
          this.applyFood(snake, food);
          continue;
        }

        // Magnet Catch Effect: nearby food is vacuumed toward the head (toroidal direction).
        const magnetRadius = snake.radius + 55;
        if (distSq < magnetRadius * magnetRadius) {
          food.x = this.wrap(food.x + dx * 0.22);
          food.y = this.wrap(food.y + dy * 0.22);
        }
      }
    }
  }

  private applyFood(snake: SnakeState, food: FoodItem) {
    const wasHurt = snake.hp < snake.maxHp;
    if (food.hpRestore) snake.hp = Math.min(snake.maxHp, snake.hp + food.hpRestore);
    if (food.buff === 'shield') snake.shieldTimer = Math.max(snake.shieldTimer, food.buffDuration || 8);
    if (food.buff === 'speed') snake.speedBoostTimer = Math.max(snake.speedBoostTimer, food.buffDuration || 6);

    if (food.couponData && !snake.isBot) {
      const profile = db.getProfile(snake.userId);
      if (profile) db.updateProfile(snake.userId, { coupons: [...(profile.coupons || []), food.couponData] });
    }

    this.applyGrowth(snake, food.value);

    if (!snake.isBot) {
      // Mission + achievement telemetry
      const u = snake.userId;
      if (food.type === 'cherry') db.incrementCollectible(u, 'cherry');
      else if (food.type === 'apple') db.incrementCollectible(u, 'apple');
      else if (food.type === 'frog') db.incrementCollectible(u, 'frog');
      else if (food.type === 'star') db.incrementCollectible(u, 'star');
      else if (food.type === 'egg') { db.incrementCollectible(u, 'egg'); db.incrementCollectible(u, 'treasure'); }
      else if (food.type === 'coupon_box') db.incrementCollectible(u, 'treasure');
      if (food.buff === 'shield') db.incrementCollectible(u, 'shield');
      if (food.hpRestore && wasHurt) db.incrementCollectible(u, 'heal');
    }
  }

  private applyGrowth(snake: SnakeState, value: number) {
    snake.score += value;
    snake.level = Math.floor(snake.score / 250) + 1;

    // Use the per-stage growth factor from the threshold table — growth slows dramatically
    // as the snake progresses. After Titan (2500+) body length barely grows at all.
    const { stage, radius, defense, growthFactor } = this.computeStage(snake.score);

    if (value > 0 && snake.body.length < this.MAX_LENGTH) {
      // Base segments per food scaled by stage factor — Titan factor is 0.05 (almost nothing)
      const segments = Math.max(0, Math.floor((value / 25) * growthFactor));
      const tail = snake.body[snake.body.length - 1] || snake.head;
      for (let i = 0; i < segments && snake.body.length < this.MAX_LENGTH; i++) {
        snake.body.push({ x: tail.x, y: tail.y });
      }
    }

    // Update size tier, radius (hard-capped at Titan), and defense from score.
    snake.stage = stage;
    snake.radius = radius;
    snake.defense = defense;
    if (snake.isBot) snake.evolution = stage;
    snake.length = snake.body.length;
  }

  // Sprint V4 collision rule (Section 1) — ONLY a head-to-head collision eliminates a
  // snake. The higher-score snake survives; the lower-score snake dies outright. An exact
  // score tie destroys both heads. Body contact of ANY kind (head→body, body→head,
  // body→body) never kills anyone. A Shield or the Safe Sanctuary makes a head immune.
  private resolveCombat() {
    const ids = Object.keys(this.state.snakes);
    for (let i = 0; i < ids.length; i++) {
      const a = this.state.snakes[ids[i]];
      if (!a || !a.isAlive || a.isPaused) continue;

      // Pair each snake with each other snake exactly once (j starts at i + 1).
      for (let j = i + 1; j < ids.length; j++) {
        const b = this.state.snakes[ids[j]];
        if (!b || !b.isAlive || b.isPaused) continue;
        if (this.config.teamsEnabled && a.team && a.team === b.team) continue; // no friendly fire

        // Heads must actually be touching — this is the ONLY collision that matters (toroidal).
        const dx = this.wrapDelta(a.head.x - b.head.x);
        const dy = this.wrapDelta(a.head.y - b.head.y);
        const clashDist = a.radius + b.radius;
        if (dx * dx + dy * dy >= clashDist * clashDist) continue;

        const aSafe = a.shieldTimer > 0 || this.isInsideSanctuary(a);
        const bSafe = b.shieldTimer > 0 || this.isInsideSanctuary(b);

        if (a.score > b.score) {
          if (!bSafe) this.eliminateInClash(b, a); // higher score (a) survives
        } else if (b.score > a.score) {
          if (!aSafe) this.eliminateInClash(a, b); // higher score (b) survives
        } else {
          // Exact score tie — both unprotected heads are destroyed, no kill credit.
          if (!aSafe) this.killSnake(a, `Head-on clash with ${b.displayName}`);
          if (!bSafe) this.killSnake(b, `Head-on clash with ${a.displayName}`);
        }

        if (!a.isAlive) break; // A was eliminated — stop scanning its remaining opponents.
      }
    }
  }

  // Eliminate the lower-score snake in a head-to-head clash and reward the winner.
  private eliminateInClash(loser: SnakeState, winner: SnakeState) {
    this.killSnake(loser, `Head-on clash with ${winner.displayName}`);
    if (loser.isAlive) return; // defensive: sanctuary/shield already filtered by the caller
    winner.kills++;
    winner.score += 200 + Math.floor(loser.score * 0.25);
    this.applyGrowth(winner, 0);
    if (this.config.teamsEnabled && winner.team && this.state.teamScores) {
      this.state.teamScores[winner.team] += 1;
    }
    if (!winner.isBot) db.incrementCollectible(winner.userId, 'kill');
  }

  private killSnake(snake: SnakeState, reason: string) {
    if (!snake.isAlive) return;
    snake.isAlive = false;
    snake.activeBuff = reason;

    // Scatter food from the corpse
    snake.body.forEach((seg, idx) => {
      if (idx % 3 === 0) {
        const foodId = `drop_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
        this.state.food[foodId] = {
          id: foodId,
          x: seg.x + (Math.random() - 0.5) * 20,
          y: seg.y + (Math.random() - 0.5) * 20,
          value: 25,
          type: 'apple',
          icon: '🍎',
          color: '#EF3E36',
          hpRestore: 8,
        };
      }
    });

    if (!snake.userId.startsWith('bot_') && !snake.isBoss) {
      db.updateLeaderboard(snake.userId, snake.displayName, Math.round(snake.score), false);
    } else if (!snake.isBoss) {
      // Respawn bots to keep the world alive
      setTimeout(() => {
        if (this.state.snakes[snake.id]) this.registerPlayer(snake.id, snake.displayName, snake.skin, true);
      }, 4000);
    }
  }

  // ---------------------------------------------------------------- world events
  private updateWorldEvent(dt: number) {
    this.eventTimer -= dt;
    if (this.eventTimer <= 0) {
      this.eventTimer = 180;
      this.currentEventIndex = (this.currentEventIndex + 1) % this.availableEvents.length;
      this.state.currentEvent = this.availableEvents[this.currentEventIndex];
      if (this.state.currentEvent.type === 'boss_anaconda_raid') this.spawnBossAnaconda();
    }
    if (this.state.currentEvent) this.state.currentEvent.timerSeconds = Math.ceil(this.eventTimer);
  }

  private spawnBossAnaconda() {
    const bossId = `boss_titan_${Date.now()}`;
    const body = Array.from({ length: 44 }, (_, i) => ({ x: 1600 - i * 20, y: 1600 }));
    this.state.snakes[bossId] = {
      id: bossId, userId: bossId, displayName: '🐉 TITAN BOSS', skin: 'Shadow',
      head: { x: 1600, y: 1600 }, body, angle: 0, speed: 140, speedPct: 60, boosting: false,
      score: 15000, level: 60, length: body.length, radius: 38, hp: 2500, maxHp: 2500,
      defense: 55, stage: 'Titan', evolution: 'Titan', isAlive: true, isAutoProtectAI: false, autoProtectTimer: 0,
      kills: 0, shieldTimer: 0, speedBoostTimer: 0, abilityCooldown: 0, abilityActiveTimer: 0,
      distanceTravelled: 0, isBot: true, isBoss: true,
    };
  }

  // ---------------------------------------------------------------- bots
  private updateBotAI(snake: SnakeState, _dt: number) {
    // Seek the nearest food; occasionally hunt a smaller rival; avoid the storm edge.
    let target: Vector2D | null = null;
    let minDist = 500 * 500;

    for (const fId in this.state.food) {
      const food = this.state.food[fId];
      const dx = this.wrapDelta(food.x - snake.head.x);
      const dy = this.wrapDelta(food.y - snake.head.y);
      const d = dx * dx + dy * dy;
      if (d < minDist) { minDist = d; target = { x: food.x, y: food.y }; }
    }

    // Hunt weaker snakes when they are close
    for (const id in this.state.snakes) {
      const other = this.state.snakes[id];
      if (id === snake.id || !other.isAlive) continue;
      if (other.score < snake.score * 0.7) {
        const dx = this.wrapDelta(other.head.x - snake.head.x);
        const dy = this.wrapDelta(other.head.y - snake.head.y);
        const d = dx * dx + dy * dy;
        if (d < 320 * 320 && d < minDist) { minDist = d; target = { x: other.head.x, y: other.head.y }; }
      }
    }

    if (target) {
      const targetAngle = Math.atan2(this.wrapDelta(target.y - snake.head.y), this.wrapDelta(target.x - snake.head.x));
      let diff = targetAngle - snake.angle;
      while (diff < -Math.PI) diff += Math.PI * 2;
      while (diff > Math.PI) diff -= Math.PI * 2;
      snake.angle += diff * 0.12;
    } else {
      snake.angle += (Math.random() - 0.5) * 0.2;
    }

    snake.boosting = Math.random() < 0.02 && snake.body.length > 14;
  }

  // ---------------------------------------------------------------- spawning
  private pickTemplate(): CollectibleTemplate {
    const total = COLLECTIBLE_TABLE.reduce((s, t) => s + t.weight, 0);
    let r = Math.random() * total;
    for (const t of COLLECTIBLE_TABLE) {
      r -= t.weight;
      if (r <= 0) return t;
    }
    return COLLECTIBLE_TABLE[0];
  }

  private maintainCollectibles() {
    if (Object.keys(this.state.food).length < 50) this.spawnInitialCollectibles(6);
  }

  private spawnInitialCollectibles(count: number) {
    for (let i = 0; i < count; i++) {
      const id = `food_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const t = this.pickTemplate();
      this.state.food[id] = {
        id,
        x: 100 + Math.random() * (this.WORLD_SIZE - 200),
        y: 100 + Math.random() * (this.WORLD_SIZE - 200),
        value: t.value,
        type: t.type,
        icon: t.icon,
        color: t.color,
        hpRestore: t.hpRestore,
        buff: t.buff,
        buffDuration: t.buffDuration,
      };
    }

    // Sponsored gift boxes near the city hubs (spawn once)
    if (!this.state.food['coupon_box_0']) {
      const coupons = [
        { store: 'Starbucks', text: '20% OFF Iced Latte', code: 'ANACONDA20', x: 640, y: 1440 },
        { store: 'Pizza Hut', text: 'Free Garlic Bread', code: 'PIZZAANACONDA', x: 2240, y: 1440 },
        { store: 'McDonalds', text: 'Buy 1 Get 1 Free', code: 'MCDANACONDA', x: 1440, y: 640 },
      ];
      coupons.forEach((c, idx) => {
        this.state.food[`coupon_box_${idx}`] = {
          id: `coupon_box_${idx}`, x: c.x, y: c.y, value: 200, type: 'coupon_box',
          icon: '🎁', color: '#FFD23F',
          couponData: { id: `cpn_${idx}`, storeName: c.store, discountText: c.text, promoCode: c.code, expiryDate: '2026-12-31', icon: '🎟️' },
        };
      });
    }
  }

  private spawnBotSnakes(count: number) {
    const names = ['JunglePython', 'ViperKing', 'CobraNova', 'MambaMint', 'ForestBoa', 'RiverRacer', 'NightScale', 'EmberFang', 'GlideStrike', 'DuskCoil'];
    const skins = ['Forest', 'Ocean', 'Fire', 'Shadow', 'Golden'];
    for (let i = 0; i < count; i++) {
      this.registerPlayer(`bot_${i + 1}`, names[i % names.length], skins[i % skins.length], true);
    }
  }

  // ---------------------------------------------------------------- §3 moving stars
  private spawnMovingStars(count: number) {
    for (let i = 0; i < count && this.starCount() < this.STAR_MAX; i++) this.spawnMovingStar();
  }

  private starCount(): number {
    let n = 0;
    for (const id in this.state.food) if (this.state.food[id].type === 'star') n++;
    return n;
  }

  private spawnMovingStar() {
    const id = `star_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    this.state.food[id] = {
      id,
      x: 200 + Math.random() * (this.WORLD_SIZE - 400),
      y: 200 + Math.random() * (this.WORLD_SIZE - 400),
      value: 50, type: 'star', icon: '⭐', color: '#FFC93C',
      vx: 0, vy: 0, wanderTimer: Math.random() * 2,
    };
  }

  private updateStars(dt: number) {
    let count = 0;
    for (const id in this.state.food) {
      const f = this.state.food[id];
      if (f.type !== 'star') continue;
      count++;
      this.moveStar(f, dt);
    }
    // Respawn toward the target with a short delay after a star is collected (§3).
    this.starCooldown -= dt;
    if (count < this.STAR_TARGET && this.starCooldown <= 0 && this.starCount() < this.STAR_MAX) {
      this.spawnMovingStar();
      this.starCooldown = 1.5;
    }
  }

  private moveStar(star: FoodItem, dt: number) {
    star.wanderTimer = (star.wanderTimer ?? 0) - dt;
    if (star.wanderTimer <= 0) {
      if (Math.random() < 0.3) {
        star.vx = 0; star.vy = 0;                 // occasionally stop
      } else {
        const a = Math.random() * Math.PI * 2;    // occasionally change direction
        const spd = 22 + Math.random() * 26;      // slow, natural drift
        star.vx = Math.cos(a) * spd;
        star.vy = Math.sin(a) * spd;
      }
      star.wanderTimer = 1.4 + Math.random() * 2.6;
    }
    star.x += (star.vx ?? 0) * dt;
    star.y += (star.vy ?? 0) * dt;
    const m = 80;
    if (star.x < m) { star.x = m; star.vx = Math.abs(star.vx ?? 0); }
    else if (star.x > this.WORLD_SIZE - m) { star.x = this.WORLD_SIZE - m; star.vx = -Math.abs(star.vx ?? 0); }
    if (star.y < m) { star.y = m; star.vy = Math.abs(star.vy ?? 0); }
    else if (star.y > this.WORLD_SIZE - m) { star.y = this.WORLD_SIZE - m; star.vy = -Math.abs(star.vy ?? 0); }
  }

  // ---------------------------------------------------------------- §7 dynamic wormholes
  private updateWormhole(dt: number) {
    if (this.wormholeActive) {
      this.wormholeLife -= dt;
      const wh = this.state.portals?.[0];
      if (wh) wh.timerSeconds = Math.max(0, Math.ceil(this.wormholeLife));
      if (this.wormholeLife <= 0) {
        this.state.portals = [];
        this.wormholeActive = false;
        this.wormholePhaseTimer = 240; // 4 min gap → 5 min spawn cadence
      }
    } else {
      this.wormholePhaseTimer -= dt;
      if (this.wormholePhaseTimer <= 0) {
        this.spawnWormhole();
        this.wormholeActive = true;
        this.wormholeLife = 60; // active for 1 minute
      }
    }
  }

  private spawnWormhole() {
    const x = 350 + Math.random() * (this.WORLD_SIZE - 700);
    const y = 350 + Math.random() * (this.WORLD_SIZE - 700);
    this.state.portals = [
      { id: 'wormhole_active', targetId: 'random_safe', x, y, label: '🌀 Wormhole', color: '#8B5CF6', wormhole: true, timerSeconds: 60 },
    ];
  }

  private randomSafeLocation(exclude: SnakeState): Vector2D {
    for (let tries = 0; tries < 24; tries++) {
      const x = 250 + Math.random() * (this.WORLD_SIZE - 500);
      const y = 250 + Math.random() * (this.WORLD_SIZE - 500);
      let ok = true;
      for (const id in this.state.snakes) {
        const o = this.state.snakes[id];
        if (o.id === exclude.id || !o.isAlive) continue;
        const dx = o.head.x - x, dy = o.head.y - y;
        if (dx * dx + dy * dy < 260 * 260) { ok = false; break; }
      }
      if (ok) return { x, y };
    }
    return { x: this.state.safeZone.centerX, y: this.state.safeZone.centerY };
  }

  // ---------------------------------------------------------------- §8 dynamic sanctuary
  private updateSanctuary(dt: number) {
    if (!this.state.sanctuaryZone) return;
    this.sanctuaryTimer -= dt;
    if (this.sanctuaryTimer <= 0) {
      this.sanctuaryTimer = 300; // relocate every 5 minutes
      const r = this.state.sanctuaryZone.radius;
      this.state.sanctuaryZone.centerX = r + Math.random() * (this.WORLD_SIZE - 2 * r);
      this.state.sanctuaryZone.centerY = r + Math.random() * (this.WORLD_SIZE - 2 * r);
    }
  }

  // ---------------------------------------------------------------- §2 dynamic obstacles
  private desiredObstacleCount(): number {
    const avg = this.averageScore();
    const tier = avg >= 1000 ? 2 : avg >= 200 ? 1 : 0; // scales with avg lobby progression
    return [10, 18, 26][tier];
  }

  private averageScore(): number {
    let sum = 0, n = 0;
    for (const id in this.state.snakes) { const s = this.state.snakes[id]; if (s.isAlive) { sum += s.score; n++; } }
    return n ? sum / n : 0;
  }

  private spawnObstacles() {
    this.state.obstacles = [];
    this.addObstaclesUpTo(this.desiredObstacleCount());
  }

  // Adds obstacles as the lobby levels up; never removes them (avoids props popping out).
  private maintainObstacles() {
    this.addObstaclesUpTo(this.desiredObstacleCount());
  }

  private addObstaclesUpTo(target: number) {
    const obstacles = this.state.obstacles ?? (this.state.obstacles = []);
    let guard = 0;
    while (obstacles.length < target && guard++ < 80) {
      const t = OBSTACLE_TEMPLATES[Math.floor(Math.random() * OBSTACLE_TEMPLATES.length)];
      const pos = this.openSpot(t.radius, obstacles);
      if (!pos) continue;
      obstacles.push({ id: `ob_${obstacles.length}_${Math.random().toString(36).slice(2, 6)}`, type: t.type, icon: t.icon, x: pos.x, y: pos.y, radius: t.radius, blocking: t.blocking });
    }
  }

  // Find an open spot that guarantees a navigable path — props keep wide lanes between them.
  private openSpot(radius: number, existing: Obstacle[]): Vector2D | null {
    for (let tries = 0; tries < 30; tries++) {
      const x = 220 + Math.random() * (this.WORLD_SIZE - 440);
      const y = 220 + Math.random() * (this.WORLD_SIZE - 440);
      const sc = this.state.sanctuaryZone;
      if (sc) { const dx = x - sc.centerX, dy = y - sc.centerY; if (dx * dx + dy * dy < (sc.radius + 120) * (sc.radius + 120)) continue; }
      let ok = true;
      for (const o of existing) {
        const dx = x - o.x, dy = y - o.y;
        const gap = radius + o.radius + 140; // wide spacing → always a lane between props
        if (dx * dx + dy * dy < gap * gap) { ok = false; break; }
      }
      if (ok) return { x, y };
    }
    return null;
  }

  // ---------------------------------------------------------------- §12 pause protection
  public setPlayerInactive(userId: string, inactive: boolean): void {
    const snake = this.state.snakes[userId];
    if (!snake) return;
    snake.isPaused = inactive;
    if (inactive) snake.boosting = false;
  }

  private updateLeaderboard() {
    this.state.leaderboard = Object.values(this.state.snakes)
      .filter(s => s.isAlive)
      .sort((a, b) => b.score - a.score)
      .slice(0, 12)
      .map(s => ({ id: s.id, name: s.displayName, score: Math.round(s.score), kills: s.kills, team: s.team }));
  }
}
