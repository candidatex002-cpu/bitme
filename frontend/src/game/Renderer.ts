import { GameStateTick, SnakeData, FoodData } from './GameClient.js';

interface SkinPalette {
  primary: string;
  secondary: string;
  belly: string;
  glow: string;
  eye: string;
  blush: string;
  outline: string;
  scaleColor: string;
  flower: string;
}

// 15 Cutie 2D Kawaii Illustration Palettes (Inspired directly by the reference artwork)
const SKINS: Record<string, SkinPalette> = {
  Forest:   { primary: '#F2F9F6', secondary: '#B5EAD7', belly: '#C7E9DE', glow: '#D8F3DC', eye: '#1B243B', blush: '#FFB7B2', outline: '#233240', scaleColor: 'rgba(112, 193, 179, 0.4)', flower: '🌸' },
  Ocean:    { primary: '#F0F8FF', secondary: '#BEE3F8', belly: '#D0E4F2', glow: '#E0F2FE', eye: '#1B243B', blush: '#FFB7CE', outline: '#1F2D42', scaleColor: 'rgba(144, 205, 244, 0.45)', flower: '🌼' },
  Fire:     { primary: '#FFF8F5', secondary: '#FFDAC1', belly: '#FCE1D4', glow: '#FFE5D9', eye: '#2D1B24', blush: '#FF9AA2', outline: '#3D1E28', scaleColor: 'rgba(255, 183, 178, 0.45)', flower: '🌺' },
  Ice:      { primary: '#F5FCFF', secondary: '#E2F1FF', belly: '#D4EBFC', glow: '#EDF2F7', eye: '#162235', blush: '#FEB2B2', outline: '#1C2C42', scaleColor: 'rgba(190, 227, 248, 0.45)', flower: '❄️' },
  Sakura:   { primary: '#FFF5F8', secondary: '#FFC6FF', belly: '#FCDDEC', glow: '#FFE5EC', eye: '#331B28', blush: '#FF70A6', outline: '#421E32', scaleColor: 'rgba(255, 173, 173, 0.45)', flower: '🌸' },
  Shadow:   { primary: '#F9F5FF', secondary: '#D8B4FE', belly: '#E9D5FF', glow: '#F5D0FE', eye: '#1E1035', blush: '#F472B6', outline: '#2D184C', scaleColor: 'rgba(192, 132, 252, 0.4)', flower: '✨' },
  Galaxy:   { primary: '#F4F5FB', secondary: '#C7CEEA', belly: '#D8DCF2', glow: '#E8DFF5', eye: '#161936', blush: '#FFC6FF', outline: '#22274C', scaleColor: 'rgba(181, 234, 215, 0.4)', flower: '⭐' },
  Golden:   { primary: '#FFFFF5', secondary: '#FFFFD1', belly: '#FAF3C0', glow: '#FFF9C4', eye: '#35280F', blush: '#FFB7B2', outline: '#4A3918', scaleColor: 'rgba(255, 229, 153, 0.45)', flower: '✨' },
  Royal:    { primary: '#F8F6FF', secondary: '#DDD6FE', belly: '#E5DEF9', glow: '#EDE9FE', eye: '#201642', blush: '#F472B6', outline: '#312361', scaleColor: 'rgba(167, 139, 250, 0.4)', flower: '👑' },
  Desert:   { primary: '#FFFDF5', secondary: '#FDE68A', belly: '#F7E7A9', glow: '#FEF08A', eye: '#38230B', blush: '#FCA5A5', outline: '#4A3113', scaleColor: 'rgba(252, 211, 77, 0.45)', flower: '🌻' },
  Jungle:   { primary: '#F3FBF7', secondary: '#A7F3D0', belly: '#C6F6D5', glow: '#D1FAE5', eye: '#103022', blush: '#FCA5A5', outline: '#194532', scaleColor: 'rgba(110, 231, 183, 0.45)', flower: '🌿' },
  Electric: { primary: '#FFFFF2', secondary: '#FEF08A', belly: '#FAF0A3', glow: '#FEF08A', eye: '#382B08', blush: '#FCA5A5', outline: '#4D3B0E', scaleColor: 'rgba(253, 224, 71, 0.45)', flower: '⚡' },
  Christmas:{ primary: '#FFF5F5', secondary: '#FCA5A5', belly: '#FAD1D1', glow: '#FEE2E2', eye: '#281717', blush: '#EF4444', outline: '#421E1E', scaleColor: 'rgba(110, 231, 183, 0.45)', flower: '🎄' },
  Halloween:{ primary: '#FFF8F2', secondary: '#FDBA74', belly: '#FCD7B0', glow: '#FED7AA', eye: '#261810', blush: '#F43F5E', outline: '#40261A', scaleColor: 'rgba(251, 146, 60, 0.45)', flower: '🎃' },
  Mythical: { primary: '#FFF2FA', secondary: '#F472B6', belly: '#F9CEE7', glow: '#FCE7F3', eye: '#380E24', blush: '#FB7185', outline: '#4F1836', scaleColor: 'rgba(232, 121, 249, 0.45)', flower: '💖' },
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

  // LERP Position Cache for Butter-Smooth Movement
  private lerpSnakes: Map<string, InterpolatedSnake> = new Map();

  // Animation State per snake
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

    // Soft Pastel Blue Sky Canvas (Matching the reference photo backdrop)
    this.ctx.fillStyle = '#D4EEF9';
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

    // Render Snakes
    for (let i = 0; i < state.snakes.length; i++) {
      const snake = state.snakes[i];
      if (snake.isAlive) {
        this.updateSnakeLerp(snake);
        this.renderKawaiiVectorSnake(snake, snake.id === targetUserId);
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
    // Dreamy Kawaii Park Base
    ctx.fillStyle = '#E3F2FD';
    ctx.fillRect(0, 0, world, world);

    // Soft park patches
    ctx.fillStyle = '#E8F5E9';
    for (const [px, py, pr] of [[350, 500, 280], [2500, 700, 320], [700, 2400, 340], [2400, 2300, 300]]) {
      ctx.beginPath(); ctx.arc(px, py, pr, 0, Math.PI * 2); ctx.fill();
    }

    // Subtle Grid
    ctx.strokeStyle = 'rgba(187, 222, 251, 0.5)'; ctx.lineWidth = 1.5;
    for (let x = 0; x <= world; x += 180) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, world); ctx.stroke(); }
    for (let y = 0; y <= world; y += 180) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(world, y); ctx.stroke(); }

    // Boundary
    ctx.strokeStyle = '#B39DDB'; ctx.lineWidth = 8; ctx.strokeRect(0, 0, world, world);
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
    ctx.fillStyle = 'rgba(0, 0, 0, 0.06)';
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
   * EXACT 2D Kawaii Vector Snake Illustration Renderer (Matching the user's reference photo)!
   * Smooth continuous body tube with dark indigo outline, soft powder blue belly, delicate scale arcs,
   * chubby bean head, simple dark button eyes, blush lines, and sprouting cherry blossom flowers.
   */
  private renderKawaiiVectorSnake(snake: SnakeData, isTarget: boolean) {
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
    if (anim.blinkTimer > 3.8) anim.blinkTimer = 0;
    anim.isBlinking = anim.blinkTimer < 0.14;

    anim.tongueTimer += 0.02;
    if (anim.tongueTimer > 2.8) anim.tongueTimer = 0;
    anim.tongueOut = anim.tongueTimer < 0.42;

    const baseRadius = Math.max(16, snake.radius);

    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // --- 1. CONTINUOUS SMOOTH KAWAII BODY TUBE ---

    // Pass A: Dark Indigo Outer Line (Contour)
    ctx.beginPath();
    ctx.moveTo(headX, headY);
    for (let i = 0; i < body.length; i++) {
      ctx.lineTo(body[i].x, body[i].y);
    }
    ctx.strokeStyle = pal.outline;
    ctx.lineWidth = baseRadius * 2.15;
    ctx.stroke();

    // Pass B: Main Soft Pastel Cream Body Fill
    ctx.beginPath();
    ctx.moveTo(headX, headY);
    for (let i = 0; i < body.length; i++) {
      ctx.lineTo(body[i].x, body[i].y);
    }
    ctx.strokeStyle = pal.primary;
    ctx.lineWidth = baseRadius * 1.82;
    ctx.stroke();

    // Pass C: Soft Powder Blue Underbelly Shade (offset slightly along inner curve)
    ctx.beginPath();
    ctx.moveTo(headX, headY);
    for (let i = 0; i < body.length; i++) {
      ctx.lineTo(body[i].x, body[i].y);
    }
    ctx.strokeStyle = pal.belly;
    ctx.lineWidth = baseRadius * 0.72;
    ctx.stroke();

    // Pass D: Delicate Scalloped Scale Lines (◠ ◠ ◠) along top body curve
    ctx.strokeStyle = pal.scaleColor;
    ctx.lineWidth = 1.6;
    for (let i = 2; i < body.length - 1; i += 3) {
      const seg = body[i];
      ctx.beginPath();
      ctx.arc(seg.x, seg.y - baseRadius * 0.2, baseRadius * 0.35, 0.2 * Math.PI, 0.8 * Math.PI, false);
      ctx.stroke();
    }

    // Pass E: Sprouting Flowers & Leaf Buds Along Body Curve (Matching illustration!)
    for (let i = 3; i < body.length - 1; i += 5) {
      const seg = body[i];
      const floatY = Math.sin(this.animFrame * 0.08 + i) * 2;
      const flowerIcon = pal.flower || '🌸';
      ctx.font = `${baseRadius * 1.1}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(flowerIcon, seg.x, seg.y - baseRadius * 0.4 + floatY);
    }

    // Trailing sparkles when boosting
    if (snake.boosting) {
      const tailSeg = body[body.length - 1] || { x: headX, y: headY };
      const sparkX = tailSeg.x + (Math.random() - 0.5) * 18;
      const sparkY = tailSeg.y + (Math.random() - 0.5) * 18;
      ctx.font = `${baseRadius * 0.85}px sans-serif`;
      ctx.fillText('✨', sparkX, sparkY);
    }

    ctx.restore();

    // --- 2. CHUBBY KAWAII HEAD & FACE ---
    ctx.save();
    ctx.translate(headX, headY);
    ctx.rotate(angle);

    const headW = baseRadius * 1.48;
    const headH = baseRadius * 1.22;

    // Head Dark Contour Outline
    ctx.beginPath();
    ctx.ellipse(0, 0, headW + 2.4, headH + 2.4, 0, 0, Math.PI * 2);
    ctx.fillStyle = pal.outline;
    ctx.fill();

    // Head Primary Soft Pastel Fill
    ctx.beginPath();
    ctx.ellipse(0, 0, headW, headH, 0, 0, Math.PI * 2);
    ctx.fillStyle = pal.primary;
    ctx.fill();

    // Head Top Soft Scales / Texture
    ctx.strokeStyle = pal.scaleColor;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(-headW * 0.15, -headH * 0.3, baseRadius * 0.35, 0.2 * Math.PI, 0.8 * Math.PI, false);
    ctx.stroke();

    // Soft Pink Blush Cheeks (Translucent cute rosy cheeks next to eyes)
    ctx.beginPath();
    ctx.ellipse(headW * 0.28, -headH * 0.46, baseRadius * 0.35, baseRadius * 0.2, 0, 0, Math.PI * 2);
    ctx.ellipse(headW * 0.28, headH * 0.46, baseRadius * 0.35, baseRadius * 0.2, 0, 0, Math.PI * 2);
    ctx.fillStyle = pal.blush;
    ctx.globalAlpha = 0.75;
    ctx.fill();
    ctx.globalAlpha = 1.0;

    // --- 3. KAWAII BUTTON EYES (Solid Dark Oval Button Eyes Tilted Inward, Matching Illustration!) ---
    const eyeOffsetX = headW * 0.36;
    const eyeOffsetY = headH * 0.32;
    const eyeRadiusX = Math.max(4.0, baseRadius * 0.28);
    const eyeRadiusY = Math.max(3.2, baseRadius * 0.22);

    for (const side of [-1, 1]) {
      const ey = side * eyeOffsetY;

      if (anim.isBlinking) {
        // Cute closed curved blink line (◡)
        ctx.beginPath();
        ctx.arc(eyeOffsetX, ey, eyeRadiusX, 0.15 * Math.PI, 0.85 * Math.PI, false);
        ctx.strokeStyle = pal.outline;
        ctx.lineWidth = 2.4;
        ctx.stroke();
      } else {
        // Solid Dark Navy Oval Pupil (Exactly like reference art)
        ctx.beginPath();
        ctx.ellipse(eyeOffsetX, ey, eyeRadiusX, eyeRadiusY, side * 0.15, 0, Math.PI * 2);
        ctx.fillStyle = pal.eye;
        ctx.fill();
      }
    }

    // --- 4. TINY CUTE 'v' MOUTH ---
    ctx.beginPath();
    ctx.moveTo(headW * 0.58, -baseRadius * 0.12);
    ctx.lineTo(headW * 0.65, 0);
    ctx.lineTo(headW * 0.58, baseRadius * 0.12);
    ctx.strokeStyle = pal.outline;
    ctx.lineWidth = 2.0;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();

    // Cute Tongue
    if (anim.tongueOut) {
      ctx.beginPath();
      ctx.ellipse(headW * 0.82, 0, baseRadius * 0.2, baseRadius * 0.09, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#FF70A6';
      ctx.fill();
    }

    // Equipped Accessory (Hats / Crowns)
    const equippedAcc = (snake as any).equippedAccessory;
    if (equippedAcc && ACCESSORY_ICONS[equippedAcc]) {
      ctx.font = `${baseRadius * 1.3}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(ACCESSORY_ICONS[equippedAcc], 0, -headH * 0.75);
    }

    ctx.restore();

    // --- 5. CLEAN NAME TAG & HP BAR ---
    this.renderNameHp(snake, isTarget, anim, headX, headY, baseRadius);
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

    // Clean name tag positioned above head
    const y = headY - r - 22;
    ctx.save();
    ctx.font = 'bold 12px Outfit, sans-serif';
    ctx.textAlign = 'center';

    const label = isTarget ? `👑 ${snake.displayName}` : `${snake.displayName}`;
    ctx.fillStyle = isTarget ? '#1E3A8A' : '#475569';
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
