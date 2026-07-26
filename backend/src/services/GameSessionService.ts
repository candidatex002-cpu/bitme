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
import { gameConfig } from '../config/GameConfig';

interface CollectibleTemplate {
  type: CollectibleType;
  icon: string;
  value: number;
  color: string;
  weight: number;
  hpRestore?: number;
  buff?: 'shield' | 'speed' | 'super';
  buffDuration?: number;
}

// Power-up table — values mirror the game design board.
const COLLECTIBLE_TABLE: CollectibleTemplate[] = [
  { type: 'cherry', icon: '🍒', value: 10, color: '#E63950', weight: 30, hpRestore: 5 },
  // 🍄 Mushroom is the rare "super" power (Mario-style): invincible + faster for a while.
  { type: 'mushroom', icon: '🍄', value: 15, color: '#E85D75', weight: 7, hpRestore: 4, buff: 'super', buffDuration: 6 },
  { type: 'apple', icon: '🍎', value: 25, color: '#EF3E36', weight: 20, hpRestore: 8 },
  { type: 'frog', icon: '🐸', value: 30, color: '#5FB85A', weight: 16 },
  // ⭐ stars are NOT spawned here — they are a dedicated set of moving collectibles (§3)
  { type: 'shield', icon: '🛡️', value: 15, color: '#3E92CC', weight: 5, buff: 'shield', buffDuration: 8 },
  { type: 'speed', icon: '⚡', value: 15, color: '#FFD23F', weight: 5, buff: 'speed', buffDuration: 6 },
  { type: 'egg', icon: '🥚', value: 500, color: '#F4E9CD', weight: 2, hpRestore: 25 },
];

// Milestone-gated growth — the snake does NOT grow until 500, then grows in discrete steps
// at 500 / 1500 / 3000 / 5000 / 8000. Radius is capped small (23px) so a snake never fills
// the screen (especially on mobile); length grows slowly too. Score keeps rising past the cap.
const STAGE_THRESHOLDS: Array<{ stage: GrowthStage; min: number; radius: number; defense: number; growthFactor: number }> = [
  { stage: 'Baby',  min: 0,    radius: 13, defense: 0,  growthFactor: 0.0  }, // no growth before 500
  { stage: 'Young', min: 500,  radius: 15, defense: 8,  growthFactor: 0.28 },
  { stage: 'Teen',  min: 1500, radius: 17, defense: 14, growthFactor: 0.20 },
  { stage: 'Adult', min: 3000, radius: 19, defense: 22, growthFactor: 0.12 },
  { stage: 'Elite', min: 5000, radius: 21, defense: 32, growthFactor: 0.07 },
  { stage: 'Titan', min: 8000, radius: 23, defense: 40, growthFactor: 0.04 }, // hard size cap
];

// §2 Obstacle palette — blocking props soft-push snakes; cosmetic ones are decoration only.
const OBSTACLE_TEMPLATES: Array<{ type: ObstacleType; icon: string; radius: number; blocking: boolean; damage?: number }> = [
  { type: 'tree', icon: '🌳', radius: 44, blocking: true },
  { type: 'rock', icon: '🪨', radius: 34, blocking: true },
  { type: 'bush', icon: '🌲', radius: 32, blocking: true },
  { type: 'cactus', icon: '🌵', radius: 30, blocking: true, damage: 10 },  // thorns hurt on contact
  { type: 'flowerbed', icon: '🌼', radius: 28, blocking: false }, // decorative — passable
  { type: 'log', icon: '🪵', radius: 30, blocking: true },
  { type: 'pond', icon: '🪷', radius: 50, blocking: false },      // water — passable
  { type: 'hill', icon: '⛰️', radius: 46, blocking: true },
  { type: 'lava', icon: '🔥', radius: 42, blocking: false, damage: 26 },   // §3 heavy burn, passable
  { type: 'poison', icon: '☠️', radius: 36, blocking: false, damage: 14 }, // §3 toxic pool, passable
];

// §8/V6 Bot policy — Free Roam & Event fill empty space with bots (real players replace them
// as they join). Battle Royale & Team Battle are strictly real-player experiences (no bots).
const MODE_CONFIGS: Record<GameMode, GameModeConfig> = {
  classic: { mode: 'classic', label: 'Free Roam', tagline: 'Free For All', shrinkingZone: false, teamsEnabled: false, worldEvents: false, botCount: 20 },
  battle_royale: { mode: 'battle_royale', label: 'Battle Royale', tagline: 'Last Snake Standing', shrinkingZone: true, teamsEnabled: false, worldEvents: true, botCount: 0 },
  team: { mode: 'team', label: 'Team Mode', tagline: 'Team Battle', shrinkingZone: false, teamsEnabled: true, worldEvents: false, botCount: 0 },
  event: { mode: 'event', label: 'Event Mode', tagline: 'Special Events', shrinkingZone: true, teamsEnabled: false, worldEvents: true, botCount: 20 },
};

export function getModeConfig(mode: GameMode): GameModeConfig {
  return MODE_CONFIGS[mode] || MODE_CONFIGS.classic;
}

export class GameSessionService {
  private state: GameWorldState;
  private config: GameModeConfig;
  private simulationInterval: NodeJS.Timeout | null = null;
  private readonly TICK_RATE = 30;
  // §12 World/spawn/timer tunables sourced from the central config (JSON-overridable).
  private readonly WORLD_SIZE = gameConfig.world.size; // §8 large map — room for ~25 players
  private readonly BASE_SPEED = 240; // Faster, smooth, responsive movement
  private readonly BOOST_MULT = 1.7;
  private readonly MAX_LENGTH = 90; // shorter snakes → easier to see everyone (esp. on mobile)

  // §3 moving stars
  private readonly STAR_MAX = gameConfig.world.starMax;
  private readonly STAR_TARGET = gameConfig.world.starTarget;
  private starCooldown = 0;
  // §7 Four linked wormholes — always present; entering one exits from another (escape route).
  // They relocate together periodically to stay dynamic.
  private wormholeRelocate = gameConfig.world.wormholeRelocateSeconds;
  // §8 dynamic safe/sanctuary zone relocation
  private sanctuaryTimer = gameConfig.world.sanctuaryRelocateSeconds;

  private eventTimer = gameConfig.world.eventDurationSeconds;
  // §V7/P1 Server-authoritative per-life peak stats (source of truth for match summaries).
  // Reset when a player (re)registers; updated every tick; read at match completion so the
  // client can never report a score/kill count the server didn't actually observe.
  private peakStats: Map<string, { score: number; kills: number; killStreak: number; joinedAt: number }> = new Map();
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
        radius: this.config.shrinkingZone ? this.WORLD_SIZE * 0.47 : this.WORLD_SIZE * 0.5,
        targetRadius: this.config.shrinkingZone ? this.WORLD_SIZE * 0.09 : this.WORLD_SIZE * 0.5,
        shrinkRate: this.config.shrinkingZone ? 11 : 0,
        damagePerSecond: 15,
      },
      // Peaceful Sanctuary Zone — No PvP / No Damage / Hide Safely Inside!
      sanctuaryZone: {
        centerX: this.WORLD_SIZE / 2,
        centerY: this.WORLD_SIZE / 2,
        radius: 360,
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

    this.spawnInitialCollectibles(gameConfig.world.foodCount); // §12 config-driven
    this.spawnMovingStars(this.STAR_TARGET); // §3
    this.spawnObstacles(); // §2
    this.spawnWormholes(); // §7 four linked wormholes
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

  // Stop the simulation loop (used on teardown / tests).
  public stop() {
    if (this.simulationInterval) { clearInterval(this.simulationInterval); this.simulationInterval = null; }
    this.state.status = 'ended';
  }

  // Test helper: advance the simulation deterministically by one tick.
  public stepForTest(dt: number = 1 / this.TICK_RATE) { this.updateTick(dt); }

  // §6 Toroidal (wrap-around) world helpers — no borders; exit one edge, appear on the other.
  private wrap(v: number): number { const w = this.WORLD_SIZE; return ((v % w) + w) % w; }
  private wrapDelta(d: number): number { const w = this.WORLD_SIZE; let r = ((d % w) + w) % w; if (r > w / 2) r -= w; return r; }

  // ---------------------------------------------------------------- stage math
  private computeStage(score: number): { stage: GrowthStage; radius: number; defense: number; growthFactor: number } {
    // Discrete, milestone-based growth — radius jumps at each threshold (no smooth creep),
    // so the snake stays a predictable, visible size and only grows at 500/1500/3000/5000/8000.
    let match = STAGE_THRESHOLDS[0];
    for (const t of STAGE_THRESHOLDS) {
      if (score >= t.min) match = t;
    }
    return { stage: match.stage, radius: match.radius, defense: match.defense, growthFactor: match.growthFactor };
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

  // Human snakes are born inside the 🛡️ Safe Sanctuary (the safe zone) — never into danger —
  // and respawns land here too. Bots still scatter across the map to keep the world lively.
  private safeSpawnPosition(): Vector2D {
    const zone = this.state.sanctuaryZone ?? {
      centerX: this.state.safeZone.centerX,
      centerY: this.state.safeZone.centerY,
      radius: 340,
    };
    const angle = Math.random() * Math.PI * 2;
    // Stay well inside the zone (≤60% of the radius) so the whole body spawns protected.
    const dist = Math.random() * zone.radius * 0.6;
    return {
      x: this.wrap(zone.centerX + Math.cos(angle) * dist),
      y: this.wrap(zone.centerY + Math.sin(angle) * dist),
    };
  }

  // ---------------------------------------------------------------- players
  public registerPlayer(userId: string, displayName: string, skin: string = 'Forest', isBot = false, evolution: string = 'Baby', region?: string): SnakeState {
    const spawnPos: Vector2D = isBot
      ? { x: 400 + Math.random() * (this.WORLD_SIZE - 800), y: 400 + Math.random() * (this.WORLD_SIZE - 800) }
      : this.safeSpawnPosition();
    const initialBody = Array.from({ length: 9 }, (_, i) => ({ x: spawnPos.x - i * 14, y: spawnPos.y }));
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
    if (!isBot) this.peakStats.set(userId, { score: 0, kills: 0, killStreak: 0, joinedAt: Date.now() }); // §V7/P1 fresh life
    return snake;
  }

  public respawnPlayer(userId: string, displayName: string, skin: string, evolution: string = 'Baby', region?: string): SnakeState {
    return this.registerPlayer(userId, displayName, skin, false, evolution, region);
  }

  // §V7/P1 Server-observed peak stats for this player's current life (source of truth).
  public getPeakStats(userId: string): { score: number; kills: number; killStreak: number; survivalSeconds: number } | null {
    const p = this.peakStats.get(userId);
    if (!p) return null;
    return { score: p.score, kills: p.kills, killStreak: p.killStreak, survivalSeconds: Math.round((Date.now() - p.joinedAt) / 1000) };
  }
  // Read + clear (called once when a match summary is finalized, so memory stays bounded).
  public consumePeakStats(userId: string) {
    const v = this.getPeakStats(userId);
    this.peakStats.delete(userId);
    return v;
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
    this.trackPeakStats(); // §V7/P1 record server-observed peaks
  }

  // §V7/P1 Keep each tracked player's peak score/kills up to date from the authoritative snake.
  private trackPeakStats() {
    for (const [userId, peak] of this.peakStats) {
      const s = this.state.snakes[userId];
      if (!s) continue;
      if (s.score > peak.score) peak.score = s.score;
      if (s.kills > peak.kills) { peak.killStreak = Math.max(peak.killStreak, s.kills); peak.kills = s.kills; }
    }
  }

  private updateSnake(snake: SnakeState, dt: number) {
    // Tick down timers
    if (snake.shieldTimer > 0) snake.shieldTimer = Math.max(0, snake.shieldTimer - dt);
    if (snake.speedBoostTimer > 0) snake.speedBoostTimer = Math.max(0, snake.speedBoostTimer - dt);
    if (snake.superTimer && snake.superTimer > 0) snake.superTimer = Math.max(0, snake.superTimer - dt);
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
    if ((snake.superTimer ?? 0) > 0) speed *= 1.5; // 🍄 super power
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

    // §7 Wormhole teleport — entering wh_i exits from its LINKED wormhole (never a random
    // spot), a controlled escape route from a bigger snake.
    if (this.state.portals && this.state.portals.length) {
      if ((snake as any).teleportCooldown > 0) {
        (snake as any).teleportCooldown -= dt;
      } else {
        for (const wh of this.state.portals) {
          const dx = this.wrapDelta(snake.head.x - wh.x);
          const dy = this.wrapDelta(snake.head.y - wh.y);
          if (dx * dx + dy * dy < 44 * 44) {
            const target = this.state.portals.find(p => p.id === wh.targetId) || this.state.portals.find(p => p.id !== wh.id);
            if (!target) break;
            const ang = Math.random() * Math.PI * 2;
            const destX = this.wrap(target.x + Math.cos(ang) * 80); // exit just beyond the linked hole
            const destY = this.wrap(target.y + Math.sin(ang) * 80);
            const offsetX = destX - snake.head.x;
            const offsetY = destY - snake.head.y;
            snake.head.x = destX;
            snake.head.y = destY;
            snake.body.forEach(seg => { seg.x = this.wrap(seg.x + offsetX); seg.y = this.wrap(seg.y + offsetY); });
            (snake as any).teleportCooldown = 3.0; // brief cooldown so you don't re-enter instantly
            break;
          }
        }
      }
    }

    // §2/§3 Obstacle collision — blocking props push head out cleanly; explicit hazards deal configurable damage.
    const HAZARD_DAMAGE_MAP: Record<string, number> = {
      small_cactus: 10, cactus: 10, large_cactus: 20,
      poison_plant: 15, poison: 15, stone_trap: 15,
      spike_trap: 25, spikes: 25, lava: 50,
    };

    if (this.state.obstacles) {
      for (const ob of this.state.obstacles) {
        const dx = snake.head.x - ob.x;
        const dy = snake.head.y - ob.y;
        const minDist = ob.radius + snake.radius;
        const distSq = dx * dx + dy * dy;
        if (distSq >= minDist * minDist) continue;

        // Physical blocking props (trees, ponds, rocks, hills, caves) push the snake out smoothly WITHOUT dealing damage
        if (ob.blocking && distSq > 0.01) {
          const dist = Math.sqrt(distSq);
          const push = (minDist - dist);
          snake.head.x += (dx / dist) * push;
          snake.head.y += (dy / dist) * push;
        }

        // Only explicit hazards (cacti, poison, traps, lava) deal damage, guarded by an i-frame hit cooldown (18 ticks = ~600ms)
        const hazardDamage = HAZARD_DAMAGE_MAP[ob.type] || ob.damage;
        if (hazardDamage) {
          const now = this.state.tick;
          if (!snake.lastHitTick || now - snake.lastHitTick > 18) {
            snake.lastHitTick = now;
            this.damageSnake(snake, hazardDamage, `Hurt by ${ob.type}`);
          }
          if (!snake.isAlive) return;
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
    if (snake.shieldTimer > 0 || (snake.superTimer ?? 0) > 0 || this.isInsideSanctuary(snake)) return;
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

  // §power Level-scaled power duration — 5s at low level, +1s every 8 levels, up to 10s
  // (mirrors Subway-Surfers-style upgrades where power boosts last longer as you progress).
  private powerDuration(snake: SnakeState): number {
    let level = snake.level;
    if (!snake.isBot) { const p = db.getProfile(snake.userId); if (p) level = p.level; }
    return Math.min(10, 5 + Math.floor(Math.max(0, level) / 8));
  }

  private onPickupCallback?: (userId: string, foodId: string, foodType: string, updatedMissions: any[]) => void;

  public setOnPickupCallback(cb: (userId: string, foodId: string, foodType: string, updatedMissions: any[]) => void) {
    this.onPickupCallback = cb;
  }

  private applyFood(snake: SnakeState, food: FoodItem) {
    const wasHurt = snake.hp < snake.maxHp;
    if (food.hpRestore) snake.hp = Math.min(snake.maxHp, snake.hp + food.hpRestore);
    const dur = this.powerDuration(snake); // duration scales with the player's level
    if (food.buff === 'shield') snake.shieldTimer = Math.max(snake.shieldTimer, dur);
    if (food.buff === 'speed') snake.speedBoostTimer = Math.max(snake.speedBoostTimer, dur);
    if (food.buff === 'super') snake.superTimer = Math.max(snake.superTimer ?? 0, dur);

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

      const updatedMissions = db.getMissions(u);
      if (this.onPickupCallback) {
        this.onPickupCallback(u, food.id, food.type, updatedMissions);
      }
    }
  }

  private applyGrowth(snake: SnakeState, value: number) {
    snake.score += value;
    snake.level = Math.floor(snake.score / 250) + 1;

    // Use the per-stage growth factor from the threshold table — growth slows dramatically
    // as the snake progresses. After Titan (2500+) body length barely grows at all.
    const { stage, radius, defense, growthFactor } = this.computeStage(snake.score);

    // Length only grows once past the first milestone (500) — before that the snake stays tiny.
    if (value > 0 && snake.score >= 500 && snake.body.length < this.MAX_LENGTH) {
      const segments = Math.max(0, Math.round((value / 25) * growthFactor));
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

        const aSafe = a.shieldTimer > 0 || (a.superTimer ?? 0) > 0 || this.isInsideSanctuary(a);
        const bSafe = b.shieldTimer > 0 || (b.superTimer ?? 0) > 0 || this.isInsideSanctuary(b);

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
    const cx = this.WORLD_SIZE / 2;
    const body = Array.from({ length: 44 }, (_, i) => ({ x: cx - i * 20, y: cx }));
    this.state.snakes[bossId] = {
      id: bossId, userId: bossId, displayName: '🐉 TITAN BOSS', skin: 'Shadow',
      head: { x: cx, y: cx }, body, angle: 0, speed: 140, speedPct: 60, boosting: false,
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
    if (Object.keys(this.state.food).length < 150) this.spawnInitialCollectibles(12);
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
    // Evasive stars: dart away from the nearest snake head (toroidal). Flee speed is below
    // a snake's, so they are hard to catch but always catchable. Otherwise, drift smoothly.
    let fleeX = 0, fleeY = 0, nearestSq = Infinity;
    for (const id in this.state.snakes) {
      const s = this.state.snakes[id];
      if (!s.isAlive) continue;
      const dx = this.wrapDelta(star.x - s.head.x);
      const dy = this.wrapDelta(star.y - s.head.y);
      const d = dx * dx + dy * dy;
      if (d < nearestSq) { nearestSq = d; fleeX = dx; fleeY = dy; }
    }
    const FLEE_RADIUS = 240;
    if (nearestSq < FLEE_RADIUS * FLEE_RADIUS && nearestSq > 1) {
      const dist = Math.sqrt(nearestSq);
      const flee = 175; // < BASE_SPEED (240) → catchable
      star.vx = (fleeX / dist) * flee;
      star.vy = (fleeY / dist) * flee;
      star.wanderTimer = 0.25;
    } else {
      star.wanderTimer = (star.wanderTimer ?? 0) - dt;
      if (star.wanderTimer <= 0) {
        const a = Math.random() * Math.PI * 2;
        const spd = 40 + Math.random() * 40; // smooth continuous drift (no stopping)
        star.vx = Math.cos(a) * spd;
        star.vy = Math.sin(a) * spd;
        star.wanderTimer = 1.2 + Math.random() * 2;
      }
    }
    star.x = this.wrap(star.x + (star.vx ?? 0) * dt); // §6 stars wrap too
    star.y = this.wrap(star.y + (star.vy ?? 0) * dt);
  }

  // ---------------------------------------------------------------- §7 linked wormholes
  private updateWormhole(dt: number) {
    const relocate = gameConfig.world.wormholeRelocateSeconds;
    if (!this.state.portals || this.state.portals.length < 4) { this.spawnWormholes(); this.wormholeRelocate = relocate; return; }
    this.wormholeRelocate -= dt;
    if (this.wormholeRelocate <= 0) { this.spawnWormholes(); this.wormholeRelocate = relocate; }
  }

  // Four wormholes linked in a ring — entering wh_i exits at wh_(i+1). Spread across the map.
  private spawnWormholes() {
    const W = this.WORLD_SIZE;
    const colors = ['#8B5CF6', '#EC4899', '#3B82F6', '#F59E0B'];
    const pts: Vector2D[] = [];
    for (let i = 0; i < 4; i++) {
      let p: Vector2D | null = null;
      for (let tries = 0; tries < 20; tries++) {
        const cand = { x: 320 + Math.random() * (W - 640), y: 320 + Math.random() * (W - 640) };
        if (pts.every(q => (q.x - cand.x) ** 2 + (q.y - cand.y) ** 2 > 700 * 700)) { p = cand; break; }
      }
      pts.push(p || { x: 320 + Math.random() * (W - 640), y: 320 + Math.random() * (W - 640) });
    }
    this.state.portals = pts.map((p, i) => ({
      id: `wh_${i}`, targetId: `wh_${(i + 1) % 4}`, x: p.x, y: p.y,
      label: '🌀 Wormhole', color: colors[i], wormhole: true,
    }));
  }

  // ---------------------------------------------------------------- §8 dynamic sanctuary
  private updateSanctuary(dt: number) {
    if (!this.state.sanctuaryZone) return;
    this.sanctuaryTimer -= dt;
    if (this.sanctuaryTimer <= 0) {
      this.sanctuaryTimer = gameConfig.world.sanctuaryRelocateSeconds; // §12 config-driven
      const r = this.state.sanctuaryZone.radius;
      this.state.sanctuaryZone.centerX = r + Math.random() * (this.WORLD_SIZE - 2 * r);
      this.state.sanctuaryZone.centerY = r + Math.random() * (this.WORLD_SIZE - 2 * r);
    }
  }

  // ---------------------------------------------------------------- §2 dynamic obstacles
  private desiredObstacleCount(): number {
    const avg = this.averageScore();
    const tier = avg >= 1000 ? 2 : avg >= 200 ? 1 : 0; // scales with avg lobby progression
    return [22, 34, 46][tier]; // §8 more obstacles across the larger map
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
      obstacles.push({ id: `ob_${obstacles.length}_${Math.random().toString(36).slice(2, 6)}`, type: t.type, icon: t.icon, x: pos.x, y: pos.y, radius: t.radius, blocking: t.blocking, damage: t.damage });
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
