import { GameStateTick, SnakeData, FoodData } from './GameClient.js';

interface SkinPalette {
  primary: string;
  secondary: string;
  belly: string;
  glow: string;
  eye: string;
  blush: string;
  outline: string;
  flower?: string;
}

// 15 Cutie Bubble Pastel Skin Palettes
const SKINS: Record<string, SkinPalette> = {
  Forest:   { primary: '#A8E6CF', secondary: '#70C1B3', belly: '#DCEDC8', glow: '#C7F9CC', eye: '#1E293B', blush: '#FFB7B2', outline: '#2D5045', flower: '🌸' },
  Ocean:    { primary: '#BEE3F8', secondary: '#90CDF4', belly: '#EBF8FF', glow: '#E0F2FE', eye: '#1A202C', blush: '#FBB6CE', outline: '#2B6CB0', flower: '🌼' },
  Fire:     { primary: '#FFDAC1', secondary: '#FFB7B2', belly: '#FFF5EB', glow: '#FFE5D9', eye: '#2D3748', blush: '#FF9AA2', outline: '#9B2C2C', flower: '🌺' },
  Ice:      { primary: '#E2F1FF', secondary: '#BEE3F8', belly: '#F7FAFC', glow: '#EDF2F7', eye: '#1A202C', blush: '#FEB2B2', outline: '#3182CE', flower: '❄️' },
  Sakura:   { primary: '#FFC6FF', secondary: '#FFADAD', belly: '#FFF0F5', glow: '#FFE5EC', eye: '#2D3748', blush: '#FF70A6', outline: '#9B486F', flower: '🌸' },
  Shadow:   { primary: '#D8B4FE', secondary: '#C084FC', belly: '#F3E8FF', glow: '#F5D0FE', eye: '#1E1B4B', blush: '#F472B6', outline: '#581C87', flower: '✨' },
  Galaxy:   { primary: '#C7CEEA', secondary: '#B5EAD7', belly: '#F0E6FF', glow: '#E8DFF5', eye: '#191970', blush: '#FFC6FF', outline: '#4A4E69', flower: '⭐' },
  Golden:   { primary: '#FFFFD1', secondary: '#FFE599', belly: '#FFFDF0', glow: '#FFF9C4', eye: '#3D2C00', blush: '#FFB7B2', outline: '#7A5C00', flower: '✨' },
  Royal:    { primary: '#DDD6FE', secondary: '#A78BFA', belly: '#F5F3FF', glow: '#EDE9FE', eye: '#2E1065', blush: '#F472B6', outline: '#4C1D95', flower: '👑' },
  Desert:   { primary: '#FDE68A', secondary: '#FCD34D', belly: '#FEF3C7', glow: '#FEF08A', eye: '#451A03', blush: '#FCA5A5', outline: '#78350F', flower: '🌻' },
  Jungle:   { primary: '#A7F3D0', secondary: '#6EE7B7', belly: '#ECFDF5', glow: '#D1FAE5', eye: '#064E3B', blush: '#FCA5A5', outline: '#047857', flower: '🌿' },
  Electric: { primary: '#FEF08A', secondary: '#FDE047', belly: '#FEF9C3', glow: '#FEF08A', eye: '#422006', blush: '#FCA5A5', outline: '#854D0E', flower: '⚡' },
  Christmas:{ primary: '#FCA5A5', secondary: '#6EE7B7', belly: '#FEF2F2', glow: '#FEE2E2', eye: '#1F2937', blush: '#EF4444', outline: '#991B1B', flower: '🎄' },
  Halloween:{ primary: '#FDBA74', secondary: '#FB923C', belly: '#FFEDD5', glow: '#FED7AA', eye: '#18181B', blush: '#F43F5E', outline: '#9A3412', flower: '🎃' },
  Mythical: { primary: '#F472B6', secondary: '#E879F9', belly: '#FDF2F8', glow: '#FCE7F3', eye: '#4C0519', blush: '#FB7185', outline: '#831843', flower: '💖' },
};

const SKIN_ALIASES: Record<string, string> = {
  'Emerald Anaconda': 'Forest', 'Standard Forest Snake': 'Forest', 'Golden Serpent': 'Golden',
  'Crimson Viper': 'Fire', 'Shadow Cobra': 'Shadow', 'Ice': 'Ice', 'Galaxy': 'Galaxy',
};

const ACCESSORY_ICONS: Record<string, string> = {
  flower_crown: '🌸', pirate_hat: '🏴‍☠️', wizard_hat: '🎩', headphones: '🎧',
  scarf: '🧣', backpack: '🎒', explorer_hat: '🤠', christmas_hat: '🎅',
  ramadan_lantern: '🏮', diwali_crown: '👑', golden_wings: '✨',
};

interface InterpolatedSnake {
  x: number;
  y: number;
  angle: number;
  body: Array<{ x: number; y: number }>;
}

export class Renderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private cameraPos = { x: 1600, y: 1600 };
  private zoom = 1.0;
  private animFrame = 0;

  // LERP Position Cache for Smooth Motion
  private lerpSnakes: Map<string, InterpolatedSnake> = new Map();

  // Animation State
  private snakeAnimState: Map<string, {
    blinkTimer: number;
    isBlinking: boolean;
    happyTimer: number;
    tongueOut: boolean;
    tongueTimer: number;
  }> = new Map();

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false })!;
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
        blinkTimer: Math.random() * 3,
        isBlinking: false,
        happyTimer: 0,
        tongueOut: false,
        tongueTimer: 0,
      });
    }
    return this.snakeAnimState.get(id)!;
  }

  public render(state: GameStateTick, targetUserId: string) {
    this.animFrame++;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    // Soft pastel grass background
    this.ctx.fillStyle = '#E8F5E9';
    this.ctx.fillRect(0, 0, vw, vh);

    let target = state.snakes.find(s => s.id === targetUserId);
    if (!target || !target.isAlive) target = state.snakes.find(s => s.isAlive);

    // LERP Smooth Camera
    if (target) {
      const targetLerp = this.lerpSnakes.get(target.id);
      const camX = targetLerp ? targetLerp.x : target.head.x;
      const camY = targetLerp ? targetLerp.y : target.head.y;
      this.cameraPos.x += (camX - this.cameraPos.x) * 0.15;
      this.cameraPos.y += (camY - this.cameraPos.y) * 0.15;

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

    // Render Food
    for (let i = 0; i < state.food.length; i++) {
      this.renderCollectible(state.food[i]);
    }

    // Update position LERPs & Render Snakes
    for (let i = 0; i < state.snakes.length; i++) {
      const snake = state.snakes[i];
      if (snake.isAlive) {
        this.updateSnakeLerp(snake);
        this.renderCuteSnake(snake, snake.id === targetUserId);
      }
    }

    if (state.currentEvent?.type === 'rain_storm') this.renderRain(3200);

    this.ctx.restore();

    this.renderMinimap(state, targetUserId);
  }

  private updateSnakeLerp(snake: SnakeData) {
    let lerp = this.lerpSnakes.get(snake.id);
    if (!lerp) {
      lerp = {
        x: snake.head.x,
        y: snake.head.y,
        angle: snake.angle,
        body: snake.body.map(b => ({ x: b.x, y: b.y })),
      };
      this.lerpSnakes.set(snake.id, lerp);
      return;
    }

    const factor = 0.35;
    lerp.x += (snake.head.x - lerp.x) * factor;
    lerp.y += (snake.head.y - lerp.y) * factor;

    let da = (snake.angle - lerp.angle) % (Math.PI * 2);
    if (da < -Math.PI) da += Math.PI * 2;
    if (da > Math.PI) da -= Math.PI * 2;
    lerp.angle += da * factor;

    for (let i = 0; i < snake.body.length; i++) {
      const targetSeg = snake.body[i];
      if (!lerp.body[i]) {
        lerp.body[i] = { x: targetSeg.x, y: targetSeg.y };
      } else {
        lerp.body[i].x += (targetSeg.x - lerp.body[i].x) * factor;
        lerp.body[i].y += (targetSeg.y - lerp.body[i].y) * factor;
      }
    }
    if (lerp.body.length > snake.body.length) {
      lerp.body.length = snake.body.length;
    }
  }

  private renderTerrain(world: number) {
    const ctx = this.ctx;
    ctx.fillStyle = '#E2F0CB';
    ctx.fillRect(0, 0, world, world);

    ctx.fillStyle = '#D6EADF';
    for (const [px, py, pr] of [[350, 500, 280], [2500, 700, 320], [700, 2400, 340], [2400, 2300, 300]]) {
      ctx.beginPath(); ctx.arc(px, py, pr, 0, Math.PI * 2); ctx.fill();
    }

    ctx.strokeStyle = 'rgba(180, 215, 190, 0.4)'; ctx.lineWidth = 1.5;
    for (let x = 0; x <= world; x += 180) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, world); ctx.stroke(); }
    for (let y = 0; y <= world; y += 180) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(world, y); ctx.stroke(); }

    const wave = Math.sin(this.animFrame * 0.03) * 6;
    ctx.fillStyle = '#BEE3F8';
    ctx.beginPath();
    ctx.moveTo(820 + wave, 0); ctx.lineTo(980 + wave, 0);
    ctx.lineTo(1220 + wave, world); ctx.lineTo(1060 + wave, world);
    ctx.closePath(); ctx.fill();

    ctx.strokeStyle = '#B5EAD7'; ctx.lineWidth = 10; ctx.strokeRect(0, 0, world, world);
  }

  private renderSafeZone(zone: { centerX: number; centerY: number; radius: number }) {
    const ctx = this.ctx;
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, 3200, 3200);
    ctx.arc(zone.centerX, zone.centerY, zone.radius, 0, Math.PI * 2, true);
    ctx.fillStyle = 'rgba(255, 183, 178, 0.15)';
    ctx.fill('evenodd');

    ctx.beginPath();
    ctx.arc(zone.centerX, zone.centerY, zone.radius, 0, Math.PI * 2);
    ctx.strokeStyle = '#FFB7B2'; ctx.lineWidth = 5;
    ctx.stroke();
    ctx.restore();
  }

  private renderCollectible(food: FoodData) {
    const ctx = this.ctx;
    const bounce = Math.sin(this.animFrame * 0.08 + food.x) * 3;
    const py = food.y + bounce;

    ctx.save();
    ctx.beginPath();
    ctx.ellipse(food.x, food.y + 10, 8, 4, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.08)';
    ctx.fill();

    if (food.icon) {
      ctx.font = '22px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(food.icon, food.x, py);
    } else {
      ctx.beginPath();
      ctx.arc(food.x, py, 8, 0, Math.PI * 2);
      ctx.fillStyle = food.color || '#FFDAC1';
      ctx.fill();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    ctx.restore();
  }

  /**
   * Overlapping Shiny Bubble Circle Segments (Matching the user's preferred design)!
   */
  private renderCuteSnake(snake: SnakeData, isTarget: boolean) {
    const ctx = this.ctx;
    const pal = this.palette(snake.skin);
    const lerp = this.lerpSnakes.get(snake.id);
    const headX = lerp ? lerp.x : snake.head.x;
    const headY = lerp ? lerp.y : snake.head.y;
    const angle = lerp ? lerp.angle : snake.angle;
    const body = lerp ? lerp.body : snake.body;
    const anim = this.getAnimState(snake.id);

    // Timers
    anim.blinkTimer += 0.02;
    if (anim.blinkTimer > 3.5) anim.blinkTimer = 0;
    anim.isBlinking = anim.blinkTimer < 0.15;

    anim.tongueTimer += 0.02;
    if (anim.tongueTimer > 2.5) anim.tongueTimer = 0;
    anim.tongueOut = anim.tongueTimer < 0.4;

    const baseRadius = Math.max(15, snake.radius);

    // --- 1. OVERLAPPING SHINY BUBBLE CIRCLE SEGMENTS (Tail to Neck) ---
    ctx.save();
    const totalSegs = body.length;

    for (let i = totalSegs - 1; i >= 0; i--) {
      const seg = body[i];
      // Taper radius smoothly from head down to tail tip
      const taperRatio = i / Math.max(1, totalSegs);
      const r = Math.max(6, baseRadius * (1.0 - taperRatio * 0.52));

      // A. Dark Outer Border Circle
      ctx.beginPath();
      ctx.arc(seg.x, seg.y, r + 2.5, 0, Math.PI * 2);
      ctx.fillStyle = pal.outline;
      ctx.fill();

      // B. Soft Pastel Primary Body Fill
      ctx.beginPath();
      ctx.arc(seg.x, seg.y, r, 0, Math.PI * 2);
      ctx.fillStyle = pal.primary;
      ctx.fill();

      // C. Soft Glossy Oval Highlight on Top Right of Bubble
      ctx.beginPath();
      ctx.ellipse(seg.x - r * 0.22, seg.y - r * 0.25, r * 0.38, r * 0.25, -0.3, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
      ctx.fill();

      // D. Occasional Cherry Blossom Flower Icon inside bubble
      if (i > 1 && i < totalSegs - 1 && i % 5 === 0) {
        const flowerIcon = pal.flower || '🌸';
        ctx.font = `${r * 0.95}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(flowerIcon, seg.x, seg.y);
      }
    }

    // Trailing sparkles when boosting
    if (snake.boosting) {
      const tailSeg = body[body.length - 1] || { x: headX, y: headY };
      const sparkX = tailSeg.x + (Math.random() - 0.5) * 16;
      const sparkY = tailSeg.y + (Math.random() - 0.5) * 16;
      ctx.font = `${baseRadius * 0.8}px sans-serif`;
      ctx.fillText('✨', sparkX, sparkY);
    }
    ctx.restore();

    // --- 2. CUTE BUBBLE HEAD & FACE ---
    ctx.save();
    ctx.translate(headX, headY);
    ctx.rotate(angle);

    const headR = baseRadius * 1.32;

    // Head Outer Border Circle
    ctx.beginPath();
    ctx.arc(0, 0, headR + 2.8, 0, Math.PI * 2);
    ctx.fillStyle = pal.outline;
    ctx.fill();

    // Head Primary Soft Fill
    ctx.beginPath();
    ctx.arc(0, 0, headR, 0, Math.PI * 2);
    ctx.fillStyle = pal.primary;
    ctx.fill();

    // Head Glossy Top-Right Highlight
    ctx.beginPath();
    ctx.ellipse(-headR * 0.2, -headR * 0.25, headR * 0.42, headR * 0.28, -0.3, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.72)';
    ctx.fill();

    // Soft Pink Blush Cheeks
    ctx.beginPath();
    ctx.ellipse(headR * 0.25, -headR * 0.38, headR * 0.32, headR * 0.22, 0, 0, Math.PI * 2);
    ctx.ellipse(headR * 0.25, headR * 0.38, headR * 0.32, headR * 0.22, 0, 0, Math.PI * 2);
    ctx.fillStyle = pal.blush || '#FFB7B2';
    ctx.globalAlpha = 0.75;
    ctx.fill();
    ctx.globalAlpha = 1.0;

    // Shiny Anime Button Eyes
    const eyeX = headR * 0.35;
    const eyeY = headR * 0.28;
    const eyeR = Math.max(4.0, headR * 0.26);

    for (const side of [-1, 1]) {
      const ey = side * eyeY;

      if (anim.isBlinking) {
        // Cute closed blink curve (◡)
        ctx.beginPath();
        ctx.arc(eyeX, ey, eyeR, 0.15 * Math.PI, 0.85 * Math.PI, false);
        ctx.strokeStyle = pal.outline;
        ctx.lineWidth = 2.4;
        ctx.stroke();
      } else {
        // Dark Pupil
        ctx.beginPath();
        ctx.arc(eyeX, ey, eyeR, 0, Math.PI * 2);
        ctx.fillStyle = pal.eye || '#1E293B';
        ctx.fill();

        // Big Top Gloss Sparkle
        ctx.beginPath();
        ctx.arc(eyeX + eyeR * 0.26, ey - eyeR * 0.26, eyeR * 0.44, 0, Math.PI * 2);
        ctx.fillStyle = '#FFFFFF';
        ctx.fill();

        // Small Bottom Gloss Sparkle
        ctx.beginPath();
        ctx.arc(eyeX - eyeR * 0.28, ey + eyeR * 0.3, eyeR * 0.22, 0, Math.PI * 2);
        ctx.fillStyle = '#FFFFFF';
        ctx.fill();
      }
    }

    // Sweet Curved Smile Mouth
    ctx.beginPath();
    ctx.arc(headR * 0.58, 0, headR * 0.18, -0.2 * Math.PI, 0.7 * Math.PI, false);
    ctx.strokeStyle = pal.outline;
    ctx.lineWidth = 2.2;
    ctx.lineCap = 'round';
    ctx.stroke();

    // Cute Tongue
    if (anim.tongueOut) {
      ctx.beginPath();
      ctx.ellipse(headR * 0.78, 0, headR * 0.22, headR * 0.1, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#FF70A6';
      ctx.fill();
    }

    // Equipped Accessory (Hats / Crowns)
    const equippedAcc = (snake as any).equippedAccessory;
    if (equippedAcc && ACCESSORY_ICONS[equippedAcc]) {
      ctx.font = `${headR * 1.2}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(ACCESSORY_ICONS[equippedAcc], 0, -headR * 0.75);
    }

    ctx.restore();

    // Name Tag & HP Bar positioned neatly ABOVE head
    this.renderNameHp(snake, isTarget, anim, headX, headY, headR);
  }

  private renderNameHp(
    snake: SnakeData,
    isTarget: boolean,
    _anim: any,
    headX: number,
    headY: number,
    r: number
  ) {
    const ctx = this.ctx;
    const hp = snake.hp ?? 100;
    const maxHp = snake.maxHp ?? 100;
    const ratio = Math.max(0, Math.min(1, hp / maxHp));

    // Clean name tag positioned nicely above head
    const y = headY - r - 22;
    ctx.save();
    ctx.font = 'bold 12px Outfit, sans-serif';
    ctx.textAlign = 'center';

    const label = isTarget ? `👑 ${snake.displayName}` : `${snake.displayName}`;
    ctx.fillStyle = isTarget ? '#2B6CB0' : '#4A5568';
    ctx.shadowColor = 'rgba(255,255,255,0.9)';
    ctx.shadowBlur = 4;
    ctx.fillText(label, headX, y - 4);

    // Only render HP bar when taking damage or in combat
    if (ratio < 0.99) {
      const w = Math.max(40, r * 2.5);
      const h = 5;
      const x = headX - w / 2;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
      ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
      ctx.fillStyle = ratio < 0.3 ? '#FC8181' : '#F6AD55';
      ctx.fillRect(x, y, w * ratio, h);
    }
    ctx.restore();
  }

  private renderRain(world: number) {
    const ctx = this.ctx;
    ctx.save();
    ctx.strokeStyle = 'rgba(190, 227, 248, 0.4)';
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 50; i++) {
      const rx = (i * 65 + this.animFrame * 10) % world;
      const ry = (i * 55 + this.animFrame * 18) % world;
      ctx.beginPath(); ctx.moveTo(rx, ry); ctx.lineTo(rx - 4, ry + 12); ctx.stroke();
    }
    ctx.restore();
  }

  private renderMinimap(state: GameStateTick, targetUserId: string) {
    const ctx = this.ctx;
    const vw = window.innerWidth, vh = window.innerHeight;
    const mobile = vw <= 640;
    const size = mobile ? 80 : 110;
    const margin = mobile ? 10 : 16;
    const x = vw - size - margin;
    const y = vh - size - (mobile ? 90 : 55);

    ctx.save();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.strokeStyle = '#B5EAD7'; ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(x, y, size, size, 12);
    ctx.fill(); ctx.stroke();

    const scale = size / 3200;
    for (let i = 0; i < state.snakes.length; i++) {
      const s = state.snakes[i];
      if (!s.isAlive) continue;
      const isT = s.id === targetUserId;
      ctx.beginPath();
      ctx.arc(x + s.head.x * scale, y + s.head.y * scale, isT ? 3.5 : 2, 0, Math.PI * 2);
      ctx.fillStyle = isT ? '#FFB7B2' : '#70C1B3'; ctx.fill();
    }
    ctx.restore();
  }

  public triggerHappyAnim(snakeId: string) {
    const anim = this.getAnimState(snakeId);
    anim.happyTimer = 1.0;
  }
}
