import { GameStateTick, SnakeData, FoodData } from './GameClient.js';

interface SkinPalette {
  primary: string;
  secondary: string;
  scale: string;
  glow: string;
  eye: string;
  belly?: string;
}

// 15 skin families — each gets a distinct palette
const SKINS: Record<string, SkinPalette> = {
  Forest:   { primary: '#43A047', secondary: '#1B5E20', scale: '#8BC34A', glow: '#7CFF6B', eye: '#2E7D32',  belly: '#C8E6C9' },
  Ocean:    { primary: '#2196F3', secondary: '#0D47A1', scale: '#64B5F6', glow: '#4FC3F7', eye: '#0277BD',  belly: '#BBDEFB' },
  Fire:     { primary: '#FB8C00', secondary: '#C62828', scale: '#FFB74D', glow: '#FF7043', eye: '#BF360C',  belly: '#FFCCBC' },
  Ice:      { primary: '#80DEEA', secondary: '#0097A7', scale: '#E0F7FA', glow: '#B2EBF2', eye: '#006064',  belly: '#F0FDFF' },
  Sakura:   { primary: '#F48FB1', secondary: '#AD1457', scale: '#FCE4EC', glow: '#F8BBD9', eye: '#880E4F',  belly: '#FFF0F5' },
  Shadow:   { primary: '#5E35B1', secondary: '#1A1035', scale: '#9575CD', glow: '#B388FF', eye: '#311B92',  belly: '#EDE7F6' },
  Galaxy:   { primary: '#7B1FA2', secondary: '#0D0221', scale: '#CE93D8', glow: '#E040FB', eye: '#4A148C',  belly: '#F3E5F5' },
  Golden:   { primary: '#FFC107', secondary: '#FF8F00', scale: '#FFE082', glow: '#FFD54F', eye: '#E65100',  belly: '#FFF8E1' },
  Royal:    { primary: '#7E57C2', secondary: '#311B92', scale: '#D1C4E9', glow: '#9C27B0', eye: '#4527A0',  belly: '#EDE7F6' },
  Desert:   { primary: '#D4A017', secondary: '#8B5E0A', scale: '#F0D060', glow: '#FFE680', eye: '#5D3A00',  belly: '#FFF9E6' },
  Jungle:   { primary: '#2E7D32', secondary: '#1B3A1F', scale: '#81C784', glow: '#A5D6A7', eye: '#1B5E20',  belly: '#DCEDC8' },
  Electric: { primary: '#FFEE58', secondary: '#F57F17', scale: '#FFF9C4', glow: '#FFD600', eye: '#F57F17',  belly: '#FFFDE7' },
  Christmas:{ primary: '#C62828', secondary: '#1B5E20', scale: '#EF9A9A', glow: '#FF5252', eye: '#1B5E20',  belly: '#FFEBEE' },
  Halloween:{ primary: '#FF6D00', secondary: '#212121', scale: '#FFB74D', glow: '#FF9100', eye: '#212121',  belly: '#FFF3E0' },
  Mythical: { primary: '#E040FB', secondary: '#4A0072', scale: '#EA80FC', glow: '#FF80FF', eye: '#4A0072',  belly: '#F3E5F5' },
};

// Legacy skin-name fallbacks so older saves still render.
const SKIN_ALIASES: Record<string, string> = {
  'Emerald Anaconda': 'Forest', 'Standard Forest Snake': 'Forest', 'Golden Serpent': 'Golden',
  'Crimson Viper': 'Fire', 'Shadow Cobra': 'Shadow', 'Ice': 'Ice', 'Galaxy': 'Galaxy',
};

// Accessory icon definitions — cosmetic-only
const ACCESSORY_ICONS: Record<string, string> = {
  flower_crown: '🌸', pirate_hat: '🏴‍☠️', wizard_hat: '🎩', headphones: '🎧',
  scarf: '🧣', backpack: '🎒', explorer_hat: '🤠', christmas_hat: '🎅',
  ramadan_lantern: '🏮', diwali_crown: '👑', golden_wings: '✨',
};

export class Renderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private cameraPos = { x: 1600, y: 1600 };
  private zoom = 1.0;
  private animFrame = 0;

  // Per-snake animation state
  private snakeAnimState: Map<string, {
    lastDamageTime: number;
    tongueOut: boolean;
    tongueTimer: number;
    blinkTimer: number;
    isBlinking: boolean;
    happyTimer: number;   // green glow after eating
    idleTimer: number;
  }> = new Map();

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  public resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.canvas.width = window.innerWidth * dpr;
    this.canvas.height = window.innerHeight * dpr;
    this.canvas.style.width = window.innerWidth + 'px';
    this.canvas.style.height = window.innerHeight + 'px';
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  private palette(skin: string): SkinPalette {
    return SKINS[skin] || SKINS[SKIN_ALIASES[skin]] || SKINS.Forest;
  }

  private getAnimState(id: string) {
    if (!this.snakeAnimState.has(id)) {
      this.snakeAnimState.set(id, {
        lastDamageTime: -999,
        tongueOut: false,
        tongueTimer: 0,
        blinkTimer: 0,
        isBlinking: false,
        happyTimer: 0,
        idleTimer: 0,
      });
    }
    return this.snakeAnimState.get(id)!;
  }

  public render(state: GameStateTick, targetUserId: string) {
    this.animFrame++;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    this.ctx.clearRect(0, 0, vw, vh);

    let target = state.snakes.find(s => s.id === targetUserId);
    if (!target || !target.isAlive) target = state.snakes.find(s => s.isAlive);

    if (target) {
      this.cameraPos.x += (target.head.x - this.cameraPos.x) * 0.12;
      this.cameraPos.y += (target.head.y - this.cameraPos.y) * 0.12;
      // Zoom only based on visual stage, NOT physical length — prevents claustrophobia
      const stageZoom: Record<string, number> = {
        Baby: 1.15, Young: 1.1, Teen: 1.05, Adult: 1.0, Elite: 0.95, Titan: 0.9,
      };
      const targetZoom = stageZoom[(target as any).stage] ?? 1.0;
      this.zoom += (targetZoom - this.zoom) * 0.05;
    }

    this.ctx.save();
    this.ctx.translate(vw / 2, vh / 2);
    this.ctx.scale(this.zoom, this.zoom);
    this.ctx.translate(-this.cameraPos.x, -this.cameraPos.y);

    this.renderTerrain(3200);
    this.renderSafeZone(state.safeZone);
    for (const food of state.food) this.renderCollectible(food);
    for (const snake of state.snakes) if (snake.isAlive) this.renderAnaconda(snake, snake.id === targetUserId);
    if (state.currentEvent?.type === 'rain_storm') this.renderRain(3200);

    this.ctx.restore();

    this.renderMinimap(state, targetUserId);
  }

  private renderTerrain(world: number) {
    const ctx = this.ctx;
    ctx.fillStyle = '#bfe6b3';
    ctx.fillRect(0, 0, world, world);

    ctx.fillStyle = '#cdeec0';
    for (const [px, py, pr] of [[350, 500, 260], [2500, 700, 300], [700, 2400, 320], [2400, 2300, 280], [1900, 1900, 240]] as number[][]) {
      ctx.beginPath(); ctx.arc(px, py, pr, 0, Math.PI * 2); ctx.fill();
    }

    ctx.strokeStyle = 'rgba(120, 170, 120, 0.18)'; ctx.lineWidth = 1;
    for (let x = 0; x <= world; x += 160) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, world); ctx.stroke(); }
    for (let y = 0; y <= world; y += 160) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(world, y); ctx.stroke(); }

    const wave = Math.sin(this.animFrame * 0.04) * 8;
    ctx.fillStyle = '#8fd3f4';
    ctx.beginPath();
    ctx.moveTo(820 + wave, 0); ctx.lineTo(980 + wave, 0);
    ctx.lineTo(1220 + wave, world); ctx.lineTo(1060 + wave, world);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 3;
    for (let y = 120; y < world; y += 280) { const rx = 940 + ((y / world) * 260) + wave; ctx.beginPath(); ctx.arc(rx, y, 34, 0.1, Math.PI - 0.1); ctx.stroke(); }

    ctx.fillStyle = '#f4f7f5';
    ctx.fillRect(0, 1500, world, 140);
    ctx.fillRect(1500, 0, 140, world);
    ctx.strokeStyle = '#e2e8e4'; ctx.lineWidth = 3;
    ctx.strokeRect(0, 1500, world, 140); ctx.strokeRect(1500, 0, 140, world);
    ctx.strokeStyle = '#f5b301'; ctx.lineWidth = 4; ctx.setLineDash([22, 22]);
    ctx.beginPath(); ctx.moveTo(0, 1570); ctx.lineTo(world, 1570); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(1570, 0); ctx.lineTo(1570, world); ctx.stroke();
    ctx.setLineDash([]);

    const spots = [
      { name: '☕ Starbucks', x: 600, y: 1400, color: '#3ba776' },
      { name: '🍕 Pizza Hut', x: 2200, y: 1400, color: '#e8735e' },
      { name: '🍔 Park Cafe', x: 1400, y: 600, color: '#f0b45e' },
      { name: '🏥 Hospital', x: 500, y: 2300, color: '#6db3ee' },
      { name: '🎓 College', x: 2300, y: 2200, color: '#b39ae8' },
      { name: '🌉 Bridge', x: 1500, y: 2400, color: '#9fb0a6' },
    ];
    for (const s of spots) {
      ctx.save();
      ctx.shadowColor = 'rgba(30,60,40,0.18)'; ctx.shadowBlur = 8; ctx.shadowOffsetY = 4;
      ctx.fillStyle = s.color; this.roundRect(s.x, s.y, 130, 90, 12); ctx.fill();
      ctx.restore();
      ctx.fillStyle = 'rgba(255,255,255,0.55)'; this.roundRect(s.x + 10, s.y + 10, 110, 26, 6); ctx.fill();
      ctx.fillStyle = '#1e3a2b'; ctx.font = 'bold 13px Outfit, sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(s.name, s.x + 65, s.y - 8);
    }

    const trees = [[300, 400], [520, 860], [1820, 420], [2420, 820], [420, 2180], [2520, 2420], [900, 300], [2000, 1900]];
    for (const [tx, ty] of trees) {
      const sway = Math.sin(this.animFrame * 0.03 + tx) * 3;
      ctx.fillStyle = '#8a5a2b'; ctx.fillRect(tx - 5, ty, 10, 18);
      ctx.fillStyle = '#4caf50'; ctx.beginPath(); ctx.arc(tx + sway, ty - 14, 28, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#66bb6a'; ctx.beginPath(); ctx.arc(tx + sway - 9, ty - 6, 18, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#81c784'; ctx.beginPath(); ctx.arc(tx + sway + 8, ty - 20, 15, 0, Math.PI * 2); ctx.fill();
    }

    ctx.strokeStyle = '#4caf50'; ctx.lineWidth = 8; ctx.strokeRect(0, 0, world, world);
  }

  private renderSafeZone(zone: { centerX: number; centerY: number; radius: number }) {
    const ctx = this.ctx;
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, 3200, 3200);
    ctx.arc(zone.centerX, zone.centerY, zone.radius, 0, Math.PI * 2, true);
    ctx.fillStyle = 'rgba(120, 20, 40, 0.18)';
    ctx.fill('evenodd');
    ctx.beginPath();
    ctx.arc(zone.centerX, zone.centerY, zone.radius, 0, Math.PI * 2);
    ctx.strokeStyle = '#ef4444'; ctx.lineWidth = 6;
    ctx.shadowColor = '#ef4444'; ctx.shadowBlur = 18;
    ctx.stroke();
    ctx.restore();
  }

  private renderCollectible(food: FoodData) {
    const ctx = this.ctx;
    const big = food.type === 'coupon_box' || food.type === 'egg' || food.type === 'shield' || food.type === 'speed';
    const pulse = Math.sin(this.animFrame * 0.1 + food.x) * 2;
    ctx.save();
    ctx.beginPath();
    ctx.arc(food.x, food.y + pulse, big ? 15 : 10, 0, Math.PI * 2);
    ctx.fillStyle = food.color + '33';
    ctx.fill();
    if (food.icon) {
      ctx.font = `${big ? 26 : 18}px sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.shadowColor = food.color; ctx.shadowBlur = 10;
      ctx.fillText(food.icon, food.x, food.y + pulse);
    } else {
      ctx.beginPath(); ctx.arc(food.x, food.y + pulse, 7, 0, Math.PI * 2);
      ctx.fillStyle = food.color; ctx.shadowColor = food.color; ctx.shadowBlur = 8; ctx.fill();
    }
    ctx.restore();
  }

  private renderAnaconda(snake: SnakeData, isTarget: boolean) {
    const ctx = this.ctx;
    const pal = this.palette(snake.skin);
    const shielded = (snake.shieldTimer ?? 0) > 0;
    const speeding = (snake.speedBoostTimer ?? 0) > 0;
    const anim = this.getAnimState(snake.id);
    const hp = snake.hp ?? 100;
    const maxHp = snake.maxHp ?? 100;
    const isLowHp = hp / maxHp < 0.25;
    const isBoosting = snake.boosting;

    // ----- Tick animations -----
    anim.tongueTimer += 1 / 30;
    anim.blinkTimer += 1 / 30;
    anim.happyTimer = Math.max(0, anim.happyTimer - 1 / 30);

    // Tongue: out for 0.4s, off for 1.6s — cute flick
    if (anim.tongueTimer > 2.0) anim.tongueTimer = 0;
    anim.tongueOut = anim.tongueTimer < 0.4;

    // Blink: every ~4 seconds, shut for 0.12s
    if (anim.blinkTimer > 4.0) anim.blinkTimer = 0;
    anim.isBlinking = anim.blinkTimer < 0.12;

    // Speed motion trail
    if (speeding) {
      for (let i = snake.body.length - 1; i >= 0; i -= 3) {
        const seg = snake.body[i];
        ctx.beginPath();
        ctx.arc(seg.x, seg.y, snake.radius * 0.7, 0, Math.PI * 2);
        ctx.fillStyle = pal.glow + '22'; ctx.fill();
      }
    }

    // Happy glow pulse after eating
    if (anim.happyTimer > 0) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(snake.head.x, snake.head.y, snake.radius * 2.4, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(100, 255, 100, ${anim.happyTimer * 0.18})`;
      ctx.fill();
      ctx.restore();
    }

    // Low-HP red pulse on body
    if (isLowHp) {
      const pulse = 0.5 + 0.5 * Math.sin(this.animFrame * 0.18);
      ctx.save();
      ctx.beginPath();
      ctx.arc(snake.head.x, snake.head.y, snake.radius * 2, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(239, 68, 68, ${pulse * 0.12})`;
      ctx.fill();
      ctx.restore();
    }

    // ----- Body — smooth bezier-like rendering -----
    const segs = snake.body;
    const totalSegs = segs.length;

    for (let i = totalSegs - 1; i >= 0; i--) {
      const seg = segs[i];
      // Taper radius from full at head-end to ~20% at tail tip
      const ratio = i / Math.max(1, totalSegs - 1);
      const taperFactor = 1 - ratio * 0.78;
      const segRadius = Math.max(4, snake.radius * taperFactor);

      ctx.beginPath();
      ctx.arc(seg.x, seg.y, segRadius, 0, Math.PI * 2);

      // Alternating scale pattern — slight color variation between segments
      const even = i % 2 === 0;
      const g = ctx.createRadialGradient(seg.x - segRadius * 0.3, seg.y - segRadius * 0.3, 1, seg.x, seg.y, segRadius);
      g.addColorStop(0, even ? pal.scale : pal.belly ?? '#fff');
      g.addColorStop(0.55, even ? pal.primary : pal.secondary);
      g.addColorStop(1, '#08130b');
      ctx.fillStyle = g;
      ctx.fill();

      // Subtle outline to define scales
      ctx.strokeStyle = pal.secondary;
      ctx.lineWidth = Math.max(0.8, segRadius * 0.07);
      ctx.stroke();
    }

    // ----- Head -----
    ctx.save();
    const headX = snake.head.x;
    const headY = snake.head.y;
    ctx.translate(headX, headY);

    // Dizzy wobble when low HP
    let headAngle = snake.angle;
    if (isLowHp) {
      headAngle += Math.sin(this.animFrame * 0.5) * 0.15;
    }
    // Elongate head when boosting for aggression feel
    const headScaleX = isBoosting ? 1.5 : 1.3;
    const headScaleY = isBoosting ? 0.88 : 0.98;
    ctx.rotate(headAngle);

    ctx.beginPath();
    ctx.ellipse(0, 0, snake.radius * headScaleX, snake.radius * headScaleY, 0, 0, Math.PI * 2);
    const hg = ctx.createRadialGradient(-snake.radius * 0.2, -snake.radius * 0.2, 2, 0, 0, snake.radius * headScaleX);
    hg.addColorStop(0, pal.scale); hg.addColorStop(0.75, pal.primary); hg.addColorStop(1, '#08130b');
    ctx.fillStyle = hg; ctx.fill();

    const outline = isTarget ? '#ffe066' : snake.team === 'red' ? '#ef4444' : snake.team === 'blue' ? '#3b82f6' : pal.secondary;
    ctx.lineWidth = 2.6; ctx.strokeStyle = outline; ctx.stroke();

    // ----- Eyes -----
    const eyeOffX = snake.radius * 0.42;
    const eyeOffY = -snake.radius * 0.38;
    const eyeR = Math.max(2.5, snake.radius * 0.22);

    for (const side of [-1, 1]) {
      // Sclera (white)
      ctx.beginPath();
      ctx.arc(eyeOffX, side * eyeOffY, eyeR, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffffee';
      ctx.fill();
      ctx.strokeStyle = pal.secondary; ctx.lineWidth = 1;
      ctx.stroke();

      if (!anim.isBlinking) {
        // Pupil — cute round
        ctx.beginPath();
        ctx.arc(eyeOffX + eyeR * 0.2, side * eyeOffY, eyeR * 0.55, 0, Math.PI * 2);
        ctx.fillStyle = pal.eye;
        ctx.fill();
        // Shine dot
        ctx.beginPath();
        ctx.arc(eyeOffX + eyeR * 0.35, side * eyeOffY - eyeR * 0.3, eyeR * 0.2, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        ctx.fill();
      }
    }

    // ----- Tongue flick -----
    if (anim.tongueOut) {
      const tongueLen = snake.radius * 1.1;
      const forkLen = snake.radius * 0.5;
      const tongueSpread = 0.22;
      ctx.strokeStyle = '#e53935'; ctx.lineWidth = Math.max(1.2, snake.radius * 0.09); ctx.lineCap = 'round';
      // Main stem
      ctx.beginPath();
      ctx.moveTo(snake.radius * headScaleX - 2, 0);
      ctx.lineTo(snake.radius * headScaleX + tongueLen, 0);
      ctx.stroke();
      // Forks
      ctx.beginPath();
      ctx.moveTo(snake.radius * headScaleX + tongueLen, 0);
      ctx.lineTo(snake.radius * headScaleX + tongueLen + forkLen, -tongueSpread * forkLen * 2.5);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(snake.radius * headScaleX + tongueLen, 0);
      ctx.lineTo(snake.radius * headScaleX + tongueLen + forkLen, tongueSpread * forkLen * 2.5);
      ctx.stroke();
    }

    ctx.restore();

    // ----- Shield bubble -----
    if (shielded) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(headX, headY, snake.radius * 1.9, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(96, 165, 250, 0.9)'; ctx.lineWidth = 3;
      ctx.shadowColor = '#60a5fa'; ctx.shadowBlur = 14; ctx.stroke();
      ctx.fillStyle = 'rgba(96,165,250,0.10)'; ctx.fill();
      ctx.restore();
    }

    this.renderNameHp(snake, isTarget, anim);
  }

  private renderNameHp(
    snake: SnakeData,
    isTarget: boolean,
    anim: { lastDamageTime: number; happyTimer: number }
  ) {
    const ctx = this.ctx;
    const hp = snake.hp ?? 100, maxHp = snake.maxHp ?? 100;
    const ratio = Math.max(0, Math.min(1, hp / maxHp));
    const timeSinceDamage = (this.animFrame / 30) - anim.lastDamageTime;
    const recentlyDamaged = timeSinceDamage < 3.0;

    // Track damage event
    if (hp < maxHp && timeSinceDamage > 3.5) {
      anim.lastDamageTime = this.animFrame / 30;
    }

    const w = Math.max(46, snake.radius * 3), h = 6;
    const x = snake.head.x - w / 2, y = snake.head.y - snake.radius - 20;

    ctx.save();
    ctx.font = 'bold 12px Outfit, sans-serif'; ctx.textAlign = 'center';
    ctx.fillStyle = isTarget ? '#b45309' : '#153524';
    ctx.shadowColor = 'rgba(255,255,255,0.9)'; ctx.shadowBlur = 5;
    ctx.fillText(`${snake.displayName} · ${(snake as any).evolution || snake.stage}`, snake.head.x, y - 6);
    ctx.shadowBlur = 0;

    // Health bar: only show when not at full HP, recently damaged, or low HP
    const showHp = ratio < 0.999 || recentlyDamaged || ratio < 0.4;
    if (showHp) {
      ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
      let c = '#22c55e'; if (ratio < 0.3) c = '#ef4444'; else if (ratio < 0.6) c = '#facc15';
      ctx.fillStyle = c; ctx.fillRect(x, y, w * ratio, h);
    }
    ctx.restore();
  }

  private renderRain(world: number) {
    const ctx = this.ctx;
    ctx.save();
    ctx.strokeStyle = 'rgba(160, 224, 255, 0.35)'; ctx.lineWidth = 1.5;
    for (let i = 0; i < 90; i++) {
      const rx = (i * 45 + this.animFrame * 12) % world;
      const ry = (i * 35 + this.animFrame * 20) % world;
      ctx.beginPath(); ctx.moveTo(rx, ry); ctx.lineTo(rx - 6, ry + 16); ctx.stroke();
    }
    ctx.restore();
  }

  private renderMinimap(state: GameStateTick, targetUserId: string) {
    const ctx = this.ctx;
    const vw = window.innerWidth, vh = window.innerHeight;
    const mobile = vw <= 640;
    const size = mobile ? 84 : 118;
    const margin = mobile ? 10 : 18;
    const x = vw - size - margin;
    const y = vh - size - (mobile ? 96 : 60);

    ctx.save();
    ctx.fillStyle = 'rgba(10, 30, 20, 0.85)';
    ctx.strokeStyle = 'rgba(74, 222, 128, 0.6)'; ctx.lineWidth = 2;
    this.roundRectAbs(x, y, size, size, 10); ctx.fill(); ctx.stroke();

    const scale = size / 3200;
    if (state.safeZone) {
      ctx.beginPath();
      ctx.arc(x + state.safeZone.centerX * scale, y + state.safeZone.centerY * scale, state.safeZone.radius * scale, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(239, 68, 68, 0.8)'; ctx.lineWidth = 1.5; ctx.stroke();
    }
    for (const s of state.snakes) {
      if (!s.isAlive) continue;
      const isT = s.id === targetUserId;
      ctx.beginPath();
      ctx.arc(x + s.head.x * scale, y + s.head.y * scale, isT ? 3.5 : s.isBoss ? 3 : 1.8, 0, Math.PI * 2);
      ctx.fillStyle = isT ? '#ffe066' : s.isBoss ? '#ef4444' : '#4ade80'; ctx.fill();
    }
    ctx.restore();
  }

  /** Trigger happy animation from outside (called when food is eaten) */
  public triggerHappyAnim(snakeId: string) {
    const anim = this.getAnimState(snakeId);
    anim.happyTimer = 1.2;
  }

  private roundRect(x: number, y: number, w: number, h: number, r: number) {
    const ctx = this.ctx;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  private roundRectAbs(x: number, y: number, w: number, h: number, r: number) {
    this.roundRect(x, y, w, h, r);
  }
}
