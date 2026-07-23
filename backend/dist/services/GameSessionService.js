"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GameSessionService = void 0;
exports.getModeConfig = getModeConfig;
const Database_1 = require("../db/Database");
const AntiCheatService_1 = require("./AntiCheatService");
// Power-up table — values mirror the game design board.
const COLLECTIBLE_TABLE = [
    { type: 'cherry', icon: '🍒', value: 10, color: '#E63950', weight: 30, hpRestore: 5 },
    { type: 'mushroom', icon: '🍄', value: 15, color: '#E85D75', weight: 22, hpRestore: 4 },
    { type: 'apple', icon: '🍎', value: 25, color: '#EF3E36', weight: 20, hpRestore: 8 },
    { type: 'frog', icon: '🐸', value: 30, color: '#5FB85A', weight: 16 },
    { type: 'star', icon: '⭐', value: 50, color: '#FFC93C', weight: 12 },
    { type: 'shield', icon: '🛡️', value: 15, color: '#3E92CC', weight: 5, buff: 'shield', buffDuration: 8 },
    { type: 'speed', icon: '⚡', value: 15, color: '#FFD23F', weight: 5, buff: 'speed', buffDuration: 6 },
    { type: 'egg', icon: '🥚', value: 500, color: '#F4E9CD', weight: 2, hpRestore: 25 },
];
// New 6-stage growth table — score-based thresholds matching SCORE_EVOLUTION_THRESHOLDS.
// Physical radius is CAPPED at Titan level (34px) — score keeps going, snake stops growing.
const STAGE_THRESHOLDS = [
    { stage: 'Baby', min: 0, radius: 14, defense: 0, growthFactor: 0.8 }, // fast early growth
    { stage: 'Young', min: 500, radius: 18, defense: 8, growthFactor: 0.6 }, // medium growth
    { stage: 'Teen', min: 1000, radius: 22, defense: 14, growthFactor: 0.45 }, // slowing down
    { stage: 'Adult', min: 1500, radius: 26, defense: 22, growthFactor: 0.3 }, // slow
    { stage: 'Elite', min: 2000, radius: 30, defense: 32, growthFactor: 0.15 }, // very slow
    { stage: 'Titan', min: 2500, radius: 34, defense: 40, growthFactor: 0.05 }, // almost stops — Titan cap
];
const MODE_CONFIGS = {
    classic: { mode: 'classic', label: 'Classic', tagline: 'Free For All', shrinkingZone: false, teamsEnabled: false, worldEvents: false, botCount: 8 },
    battle_royale: { mode: 'battle_royale', label: 'Battle Royale', tagline: 'Last Snake Standing', shrinkingZone: true, teamsEnabled: false, worldEvents: true, botCount: 10 },
    team: { mode: 'team', label: 'Team Mode', tagline: '4v4 Team Battle', shrinkingZone: false, teamsEnabled: true, worldEvents: false, botCount: 8 },
    event: { mode: 'event', label: 'Event Mode', tagline: 'Special Events', shrinkingZone: true, teamsEnabled: false, worldEvents: true, botCount: 8 },
};
function getModeConfig(mode) {
    return MODE_CONFIGS[mode] || MODE_CONFIGS.classic;
}
class GameSessionService {
    state;
    config;
    simulationInterval = null;
    TICK_RATE = 30;
    WORLD_SIZE = 3200;
    BASE_SPEED = 240; // Faster, smooth, responsive movement
    BOOST_MULT = 1.7;
    MAX_LENGTH = 220;
    eventTimer = 180;
    currentEventIndex = 0;
    availableEvents = [
        { id: 'evt_rain', type: 'rain_storm', title: '🌧️ Monsoon Rain Storm', description: 'Vision restricted! Frog & Star spawns tripled!', active: true, timerSeconds: 180, icon: '🌧️' },
        { id: 'evt_boss', type: 'boss_anaconda_raid', title: '🐉 TITAN BOSS RAID', description: 'A Titan Anaconda stalks the park centre. Team up to bring it down!', active: false, timerSeconds: 180, icon: '🐉' },
        { id: 'evt_volcano', type: 'volcano_eruption', title: '🌋 Lava Eruption', description: 'Speed crystals erupting across the reserve!', active: false, timerSeconds: 180, icon: '🌋' },
        { id: 'evt_coupon', type: 'treasure_balloon', title: '🎁 Treasure Box Drop', description: 'Sponsored gift boxes dropped near the city stores!', active: false, timerSeconds: 180, icon: '🎁' },
    ];
    constructor(matchId, mode = 'classic') {
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
            // Pothole Shortcut Tunnel Portals
            portals: [
                { id: 'portal_1_a', targetId: 'portal_1_b', x: 600, y: 600, label: 'Shortcut A', color: '#8B5CF6' },
                { id: 'portal_1_b', targetId: 'portal_1_a', x: 2600, y: 2600, label: 'Shortcut A Exit', color: '#8B5CF6' },
                { id: 'portal_2_a', targetId: 'portal_2_b', x: 600, y: 2600, label: 'Shortcut B', color: '#EC4899' },
                { id: 'portal_2_b', targetId: 'portal_2_a', x: 2600, y: 600, label: 'Shortcut B Exit', color: '#EC4899' },
            ],
            snakes: {},
            food: {},
            leaderboard: [],
            teamScores: this.config.teamsEnabled ? { red: 0, blue: 0 } : undefined,
            currentEvent: this.config.worldEvents ? this.availableEvents[0] : undefined,
        };
        this.spawnInitialCollectibles(60); // Clean, lesser food count
        this.spawnBotSnakes(this.config.botCount);
        this.startLoop();
    }
    startLoop() {
        const tickIntervalMs = 1000 / this.TICK_RATE;
        this.simulationInterval = setInterval(() => this.updateTick(1 / this.TICK_RATE), tickIntervalMs);
    }
    getState() {
        return this.state;
    }
    getConfig() {
        return this.config;
    }
    // ---------------------------------------------------------------- stage math
    computeStage(score) {
        let match = STAGE_THRESHOLDS[0];
        for (const t of STAGE_THRESHOLDS) {
            if (score >= t.min)
                match = t;
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
    assignTeam() {
        if (!this.config.teamsEnabled)
            return undefined;
        let red = 0;
        let blue = 0;
        for (const id in this.state.snakes) {
            if (this.state.snakes[id].team === 'red')
                red++;
            else if (this.state.snakes[id].team === 'blue')
                blue++;
        }
        return red <= blue ? 'red' : 'blue';
    }
    // ---------------------------------------------------------------- players
    registerPlayer(userId, displayName, skin = 'Forest', isBot = false, evolution = 'Baby', region) {
        const spawnPos = {
            x: 400 + Math.random() * (this.WORLD_SIZE - 800),
            y: 400 + Math.random() * (this.WORLD_SIZE - 800),
        };
        const initialBody = Array.from({ length: 12 }, (_, i) => ({ x: spawnPos.x - i * 14, y: spawnPos.y }));
        const { stage, radius, defense } = this.computeStage(0);
        const snake = {
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
    respawnPlayer(userId, displayName, skin, evolution = 'Baby', region) {
        return this.registerPlayer(userId, displayName, skin, false, evolution, region);
    }
    handlePlayerInput(userId, angle, boosting, _seq) {
        const snake = this.state.snakes[userId];
        if (!snake || !snake.isAlive)
            return;
        if (!AntiCheatService_1.antiCheat.validatePacketFrequency(userId))
            return;
        snake.angle = angle;
        // Boost only when the snake has enough body to burn.
        const nextBoost = boosting && snake.body.length > 8;
        if (nextBoost && !snake.boosting && !snake.isBot)
            Database_1.db.incrementCollectible(userId, 'boost');
        snake.boosting = nextBoost;
        snake.isAutoProtectAI = false;
        snake.autoProtectTimer = 0;
    }
    // Special ability — "Coil Guard": short dash + protective shield, then cooldown.
    activateAbility(userId) {
        const snake = this.state.snakes[userId];
        if (!snake || !snake.isAlive || snake.abilityCooldown > 0)
            return false;
        snake.shieldTimer = Math.max(snake.shieldTimer, 3);
        snake.speedBoostTimer = Math.max(snake.speedBoostTimer, 2);
        snake.abilityActiveTimer = 3;
        snake.abilityCooldown = 12;
        return true;
    }
    handlePlayerDisconnect(userId) {
        const snake = this.state.snakes[userId];
        if (snake && snake.isAlive) {
            snake.isAutoProtectAI = true;
            snake.autoProtectTimer = 20;
        }
    }
    removePlayer(userId) {
        delete this.state.snakes[userId];
    }
    // ---------------------------------------------------------------- main loop
    updateTick(dt) {
        this.state.tick++;
        if (this.config.worldEvents)
            this.updateWorldEvent(dt);
        if (this.config.shrinkingZone && this.state.safeZone.radius > this.state.safeZone.targetRadius) {
            this.state.safeZone.radius -= this.state.safeZone.shrinkRate * dt;
        }
        // Movement + hazards
        for (const id in this.state.snakes) {
            const snake = this.state.snakes[id];
            if (!snake.isAlive)
                continue;
            this.updateSnake(snake, dt);
        }
        this.resolveFoodPickups();
        this.resolveCombat();
        this.maintainCollectibles();
        this.updateLeaderboard();
    }
    updateSnake(snake, dt) {
        // Tick down timers
        if (snake.shieldTimer > 0)
            snake.shieldTimer = Math.max(0, snake.shieldTimer - dt);
        if (snake.speedBoostTimer > 0)
            snake.speedBoostTimer = Math.max(0, snake.speedBoostTimer - dt);
        if (snake.abilityCooldown > 0)
            snake.abilityCooldown = Math.max(0, snake.abilityCooldown - dt);
        if (snake.abilityActiveTimer > 0)
            snake.abilityActiveTimer = Math.max(0, snake.abilityActiveTimer - dt);
        if (snake.isAutoProtectAI) {
            snake.autoProtectTimer -= dt;
            snake.angle += (Math.random() - 0.5) * 0.1;
            if (snake.autoProtectTimer <= 0) {
                this.killSnake(snake, 'Left the reserve');
                return;
            }
        }
        if (snake.isBot)
            this.updateBotAI(snake, dt);
        // Speed model
        const base = snake.isBoss ? 150 : this.BASE_SPEED;
        let speed = base;
        if (snake.boosting)
            speed *= this.BOOST_MULT;
        if (snake.speedBoostTimer > 0)
            speed *= 1.4;
        snake.speed = speed;
        snake.speedPct = Math.round(Math.min(100, (speed / 250) * 90));
        // Boost burns length + score slowly
        if (snake.boosting && snake.body.length > 8 && this.state.tick % 6 === 0) {
            snake.body.pop();
            snake.score = Math.max(0, snake.score - 1);
        }
        const nextX = snake.head.x + Math.cos(snake.angle) * speed * dt;
        const nextY = snake.head.y + Math.sin(snake.angle) * speed * dt;
        const clampedX = Math.max(snake.radius, Math.min(this.WORLD_SIZE - snake.radius, nextX));
        const clampedY = Math.max(snake.radius, Math.min(this.WORLD_SIZE - snake.radius, nextY));
        if (clampedX !== nextX || clampedY !== nextY) {
            snake.angle += Math.PI * 0.5;
            if (snake.shieldTimer <= 0) {
                this.damageSnake(snake, 15 * dt * 5, 'Wall collision');
                if (!snake.isAlive)
                    return;
            }
        }
        const dxMove = clampedX - snake.head.x;
        const dyMove = clampedY - snake.head.y;
        snake.distanceTravelled += Math.sqrt(dxMove * dxMove + dyMove * dyMove) / 100;
        snake.head.x = clampedX;
        snake.head.y = clampedY;
        // Pothole Shortcut Teleport Check
        if (this.state.portals) {
            if (snake.teleportCooldown > 0) {
                snake.teleportCooldown -= dt;
            }
            else {
                for (const portal of this.state.portals) {
                    const dx = snake.head.x - portal.x;
                    const dy = snake.head.y - portal.y;
                    if (dx * dx + dy * dy < 38 * 38) {
                        const targetPortal = this.state.portals.find(p => p.id === portal.targetId);
                        if (targetPortal) {
                            // Instantly teleport head and body to shortcut exit!
                            const offsetX = targetPortal.x - snake.head.x;
                            const offsetY = targetPortal.y - snake.head.y;
                            snake.head.x = targetPortal.x;
                            snake.head.y = targetPortal.y;
                            snake.body.forEach(seg => {
                                seg.x += offsetX;
                                seg.y += offsetY;
                            });
                            snake.teleportCooldown = 3.0; // 3s cooldown
                            break;
                        }
                    }
                }
            }
        }
        // Body follows head
        let prev = { ...snake.head };
        const spacing = 14;
        for (let i = 0; i < snake.body.length; i++) {
            const seg = snake.body[i];
            const dx = prev.x - seg.x;
            const dy = prev.y - seg.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist > spacing) {
                const ratio = (dist - spacing) / dist;
                seg.x += dx * ratio;
                seg.y += dy * ratio;
            }
            prev = { ...seg };
        }
        // Storm damage outside the safe zone
        const dCx = snake.head.x - this.state.safeZone.centerX;
        const dCy = snake.head.y - this.state.safeZone.centerY;
        if (Math.sqrt(dCx * dCx + dCy * dCy) > this.state.safeZone.radius && snake.shieldTimer <= 0) {
            this.damageSnake(snake, this.state.safeZone.damagePerSecond * dt, 'Caught in the storm');
        }
    }
    // Check if snake is inside Safe Sanctuary Zone
    isInsideSanctuary(snake) {
        if (!this.state.sanctuaryZone)
            return false;
        const s = this.state.sanctuaryZone;
        const dx = snake.head.x - s.centerX;
        const dy = snake.head.y - s.centerY;
        return (dx * dx + dy * dy) < (s.radius * s.radius);
    }
    // Defense-aware damage. Shield or Safe Sanctuary fully negates.
    damageSnake(snake, amount, reason) {
        if (snake.shieldTimer > 0 || this.isInsideSanctuary(snake))
            return;
        const reduced = amount * (1 - snake.defense / 100);
        snake.hp = Math.max(0, snake.hp - reduced);
        if (snake.hp <= 0)
            this.killSnake(snake, reason);
    }
    resolveFoodPickups() {
        for (const snakeId in this.state.snakes) {
            const snake = this.state.snakes[snakeId];
            if (!snake.isAlive)
                continue;
            for (const foodId in this.state.food) {
                const food = this.state.food[foodId];
                const dx = snake.head.x - food.x;
                const dy = snake.head.y - food.y;
                const distSq = dx * dx + dy * dy;
                // Pickup collision check (radius + 20)
                const pickupRadius = snake.radius + 20;
                if (distSq < pickupRadius * pickupRadius) {
                    delete this.state.food[foodId];
                    this.applyFood(snake, food);
                    continue;
                }
                // Magnet Catch Effect: If food is nearby (within 55px), vacuum/pull food towards head!
                const magnetRadius = snake.radius + 55;
                if (distSq < magnetRadius * magnetRadius) {
                    food.x += (snake.head.x - food.x) * 0.22;
                    food.y += (snake.head.y - food.y) * 0.22;
                }
            }
        }
    }
    applyFood(snake, food) {
        const wasHurt = snake.hp < snake.maxHp;
        if (food.hpRestore)
            snake.hp = Math.min(snake.maxHp, snake.hp + food.hpRestore);
        if (food.buff === 'shield')
            snake.shieldTimer = Math.max(snake.shieldTimer, food.buffDuration || 8);
        if (food.buff === 'speed')
            snake.speedBoostTimer = Math.max(snake.speedBoostTimer, food.buffDuration || 6);
        if (food.couponData && !snake.isBot) {
            const profile = Database_1.db.getProfile(snake.userId);
            if (profile)
                Database_1.db.updateProfile(snake.userId, { coupons: [...(profile.coupons || []), food.couponData] });
        }
        this.applyGrowth(snake, food.value);
        if (!snake.isBot) {
            // Mission + achievement telemetry
            const u = snake.userId;
            if (food.type === 'cherry')
                Database_1.db.incrementCollectible(u, 'cherry');
            else if (food.type === 'apple')
                Database_1.db.incrementCollectible(u, 'apple');
            else if (food.type === 'frog')
                Database_1.db.incrementCollectible(u, 'frog');
            else if (food.type === 'star')
                Database_1.db.incrementCollectible(u, 'star');
            else if (food.type === 'egg') {
                Database_1.db.incrementCollectible(u, 'egg');
                Database_1.db.incrementCollectible(u, 'treasure');
            }
            else if (food.type === 'coupon_box')
                Database_1.db.incrementCollectible(u, 'treasure');
            if (food.buff === 'shield')
                Database_1.db.incrementCollectible(u, 'shield');
            if (food.hpRestore && wasHurt)
                Database_1.db.incrementCollectible(u, 'heal');
        }
    }
    applyGrowth(snake, value) {
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
        if (snake.isBot)
            snake.evolution = stage;
        snake.length = snake.body.length;
    }
    // Classic Head Collision Rules:
    // 1. Head-to-Body: If Snake A's HEAD hits Snake B's BODY, Snake A (the hitting head) dies/takes damage!
    // 2. Head-to-Head: If Snake A's HEAD hits Snake B's HEAD, the smaller snake dies!
    resolveCombat() {
        const ids = Object.keys(this.state.snakes);
        for (const idA of ids) {
            const a = this.state.snakes[idA];
            if (!a.isAlive || a.shieldTimer > 0 || this.isInsideSanctuary(a))
                continue;
            for (const idB of ids) {
                if (idA === idB)
                    continue;
                const b = this.state.snakes[idB];
                if (!b.isAlive)
                    continue;
                if (this.config.teamsEnabled && a.team && a.team === b.team)
                    continue; // no friendly fire
                // Check A: Head-to-Head Collision
                const headDx = a.head.x - b.head.x;
                const headDy = a.head.y - b.head.y;
                const headDistSq = headDx * headDx + headDy * headDy;
                const headCollisionDist = a.radius + b.radius;
                if (headDistSq < headCollisionDist * headCollisionDist) {
                    if (this.isInsideSanctuary(b) || b.shieldTimer > 0)
                        continue;
                    // Head-to-Head Clash: Lower score snake takes damage/dies
                    const loser = a.score >= b.score ? b : a;
                    const winner = loser === a ? b : a;
                    this.damageSnake(loser, 60, `Head-on clash with ${winner.displayName}`);
                    if (!loser.isAlive) {
                        winner.kills++;
                        winner.score += 200 + Math.floor(loser.score * 0.25);
                        this.applyGrowth(winner, 0);
                        if (this.config.teamsEnabled && winner.team && this.state.teamScores) {
                            this.state.teamScores[winner.team] += 1;
                        }
                        if (!winner.isBot)
                            Database_1.db.incrementCollectible(winner.userId, 'kill');
                    }
                    break;
                }
                // Check B: Head-to-Body Collision (Snake A's HEAD hits Snake B's BODY)
                let hitBody = false;
                for (let i = 2; i < b.body.length; i += 2) {
                    const seg = b.body[i];
                    const dx = a.head.x - seg.x;
                    const dy = a.head.y - seg.y;
                    const bodyCollisionDist = a.radius + 6;
                    if (dx * dx + dy * dy < bodyCollisionDist * bodyCollisionDist) {
                        hitBody = true;
                        break;
                    }
                }
                if (hitBody) {
                    // Snake A crashed its head into Snake B's body -> Snake A dies!
                    this.damageSnake(a, 100, `Crashed head into ${b.displayName}'s body`);
                    if (!a.isAlive) {
                        b.kills++;
                        b.score += 150 + Math.floor(a.score * 0.2);
                        this.applyGrowth(b, 0);
                        if (this.config.teamsEnabled && b.team && this.state.teamScores) {
                            this.state.teamScores[b.team] += 1;
                        }
                        if (!b.isBot)
                            Database_1.db.incrementCollectible(b.userId, 'kill');
                    }
                    break;
                }
            }
        }
    }
    killSnake(snake, reason) {
        if (!snake.isAlive)
            return;
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
            Database_1.db.updateLeaderboard(snake.userId, snake.displayName, Math.round(snake.score), false);
        }
        else if (!snake.isBoss) {
            // Respawn bots to keep the world alive
            setTimeout(() => {
                if (this.state.snakes[snake.id])
                    this.registerPlayer(snake.id, snake.displayName, snake.skin, true);
            }, 4000);
        }
    }
    // ---------------------------------------------------------------- world events
    updateWorldEvent(dt) {
        this.eventTimer -= dt;
        if (this.eventTimer <= 0) {
            this.eventTimer = 180;
            this.currentEventIndex = (this.currentEventIndex + 1) % this.availableEvents.length;
            this.state.currentEvent = this.availableEvents[this.currentEventIndex];
            if (this.state.currentEvent.type === 'boss_anaconda_raid')
                this.spawnBossAnaconda();
        }
        if (this.state.currentEvent)
            this.state.currentEvent.timerSeconds = Math.ceil(this.eventTimer);
    }
    spawnBossAnaconda() {
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
    updateBotAI(snake, _dt) {
        // Seek the nearest food; occasionally hunt a smaller rival; avoid the storm edge.
        let target = null;
        let minDist = 500 * 500;
        for (const fId in this.state.food) {
            const food = this.state.food[fId];
            const dx = food.x - snake.head.x;
            const dy = food.y - snake.head.y;
            const d = dx * dx + dy * dy;
            if (d < minDist) {
                minDist = d;
                target = { x: food.x, y: food.y };
            }
        }
        // Hunt weaker snakes when they are close
        for (const id in this.state.snakes) {
            const other = this.state.snakes[id];
            if (id === snake.id || !other.isAlive)
                continue;
            if (other.score < snake.score * 0.7) {
                const dx = other.head.x - snake.head.x;
                const dy = other.head.y - snake.head.y;
                const d = dx * dx + dy * dy;
                if (d < 320 * 320 && d < minDist) {
                    minDist = d;
                    target = { x: other.head.x, y: other.head.y };
                }
            }
        }
        if (target) {
            const targetAngle = Math.atan2(target.y - snake.head.y, target.x - snake.head.x);
            let diff = targetAngle - snake.angle;
            while (diff < -Math.PI)
                diff += Math.PI * 2;
            while (diff > Math.PI)
                diff -= Math.PI * 2;
            snake.angle += diff * 0.12;
        }
        else {
            snake.angle += (Math.random() - 0.5) * 0.2;
        }
        snake.boosting = Math.random() < 0.02 && snake.body.length > 14;
    }
    // ---------------------------------------------------------------- spawning
    pickTemplate() {
        const total = COLLECTIBLE_TABLE.reduce((s, t) => s + t.weight, 0);
        let r = Math.random() * total;
        for (const t of COLLECTIBLE_TABLE) {
            r -= t.weight;
            if (r <= 0)
                return t;
        }
        return COLLECTIBLE_TABLE[0];
    }
    maintainCollectibles() {
        if (Object.keys(this.state.food).length < 50)
            this.spawnInitialCollectibles(6);
    }
    spawnInitialCollectibles(count) {
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
    spawnBotSnakes(count) {
        const names = ['JunglePython', 'ViperKing', 'CobraNova', 'MambaMint', 'ForestBoa', 'RiverRacer', 'NightScale', 'EmberFang', 'GlideStrike', 'DuskCoil'];
        const skins = ['Forest', 'Ocean', 'Fire', 'Shadow', 'Golden'];
        for (let i = 0; i < count; i++) {
            this.registerPlayer(`bot_${i + 1}`, names[i % names.length], skins[i % skins.length], true);
        }
    }
    updateLeaderboard() {
        this.state.leaderboard = Object.values(this.state.snakes)
            .filter(s => s.isAlive)
            .sort((a, b) => b.score - a.score)
            .slice(0, 12)
            .map(s => ({ id: s.id, name: s.displayName, score: Math.round(s.score), kills: s.kills, team: s.team }));
    }
}
exports.GameSessionService = GameSessionService;
