import { GameStateTick, SnakeData, FoodData, ObstacleData } from './GameClient.js';

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

// Guaranteed vibrant icons for all collectible food items
const FOOD_ICONS: Record<string, string> = {
  cherry: '🍒', apple: '🍎', mushroom: '🍄', frog: '🐸', mouse: '🐭',
  lizard: '🦎', egg: '🥚', star: '⭐', shield: '🛡️', speed: '⚡',
  crystal: '💎', coupon_box: '🎁', super_star: '🌟', snake_remains: '✨', boss_drop: '🏆',
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
  private userZoom = 1.0;            // §5 player-controlled zoom (wheel / pinch / button)
  private readonly ZOOM_MIN = 0.6;   // most zoomed OUT — reveals nearby enemies
  private readonly ZOOM_MAX = 1.6;   // most zoomed IN — focuses on the snake
  private animFrame = 0;

  // §6 Toroidal wrap helpers — draw entities at the copy nearest the camera.
  private readonly WORLD = 3200;
  private wrapRaw(v: number): number { const w = this.WORLD; return ((v % w) + w) % w; }
  private wrapDeltaRaw(d: number): number { const w = this.WORLD; let r = ((d % w) + w) % w; if (r > w / 2) r -= w; return r; }
  private wrapNear(coord: number, ref: number): number { return ref + this.wrapDeltaRaw(coord - ref); }

  // LERP Position Cache
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

    // Soft Pastel Blue Canvas
    this.ctx.fillStyle = '#D4EEF9';
    this.ctx.fillRect(0, 0, vw, vh);

    let target = state.snakes.find(s => s.id === targetUserId);
    if (!target || !target.isAlive) target = state.snakes.find(s => s.isAlive);

    // LERP Smooth Camera
    if (target) {
      const targetLerp = this.lerpSnakes.get(target.id);
      const camX = targetLerp ? targetLerp.x : target.head.x;
      const camY = targetLerp ? targetLerp.y : target.head.y;
      // §6 Ease toroidally so crossing the seam never slides the camera across the map.
      this.cameraPos.x = this.wrapRaw(this.cameraPos.x + this.wrapDeltaRaw(camX - this.cameraPos.x) * 0.15);
      this.cameraPos.y = this.wrapRaw(this.cameraPos.y + this.wrapDeltaRaw(camY - this.cameraPos.y) * 0.15);

      const stageZoom: Record<string, number> = {
        Baby: 1.15, Young: 1.1, Teen: 1.05, Adult: 1.0, Elite: 0.95, Titan: 0.9,
      };
      // Stage auto-zoom, then fold in the player's manual zoom, then ease smoothly.
      const targetZoom = (stageZoom[(target as any).stage] ?? 1.0) * this.userZoom;
      this.zoom += (targetZoom - this.zoom) * 0.08; // smooth interpolation, no shake
    }

    this.ctx.save();
    this.ctx.translate(vw / 2, vh / 2);
    this.ctx.scale(this.zoom, this.zoom);
    this.ctx.translate(-this.cameraPos.x, -this.cameraPos.y);

    this.renderTerrain(3200);
    this.renderSafeZone(state.safeZone);
    if (state.sanctuaryZone) this.renderSanctuaryZone(state.sanctuaryZone);
    if (state.obstacles) this.renderObstacles(state.obstacles);
    if (state.portals) this.renderPortals(state.portals);

    // Render Food (Crystal Clear Discs)
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
    // §6 Interpolate toroidally and keep cached coords wrapped — no cross-map slides.
    lerp.x = this.wrapRaw(lerp.x + this.wrapDeltaRaw(snake.head.x - lerp.x) * factor);
    lerp.y = this.wrapRaw(lerp.y + this.wrapDeltaRaw(snake.head.y - lerp.y) * factor);

    let da = (snake.angle - lerp.angle) % (Math.PI * 2);
    if (da < -Math.PI) da += Math.PI * 2;
    if (da > Math.PI) da -= Math.PI * 2;
    lerp.angle += da * factor;

    for (let i = 0; i < snake.body.length; i++) {
      const targetSeg = snake.body[i];
      if (!lerp.body[i]) {
        lerp.body[i] = { x: targetSeg.x, y: targetSeg.y };
      } else {
        lerp.body[i].x = this.wrapRaw(lerp.body[i].x + this.wrapDeltaRaw(targetSeg.x - lerp.body[i].x) * factor);
        lerp.body[i].y = this.wrapRaw(lerp.body[i].y + this.wrapDeltaRaw(targetSeg.y - lerp.body[i].y) * factor);
      }
    }
    if (lerp.body.length > snake.body.length) {
      lerp.body.length = snake.body.length;
    }
  }

  private renderTerrain(_world: number) {
    const ctx = this.ctx;
    const cam = this.cameraPos;
    const R = 5000; // covers the viewport at any zoom — §6 seamless, borderless ground
    // Clean Dreamy Base without grid lines or map edges
    ctx.fillStyle = '#E3F2FD';
    ctx.fillRect(cam.x - R, cam.y - R, R * 2, R * 2);

    // Soft park patches, each drawn at its nearest wrapped copy
    ctx.fillStyle = '#E8F5E9';
    for (const [px, py, pr] of [[350, 500, 280], [2500, 700, 320], [700, 2400, 340], [2400, 2300, 300]]) {
      ctx.beginPath(); ctx.arc(this.wrapNear(px, cam.x), this.wrapNear(py, cam.y), pr, 0, Math.PI * 2); ctx.fill();
    }
  }

  private renderSafeZone(zone: { centerX: number; centerY: number; radius: number }) {
    const ctx = this.ctx;
    const cx = this.wrapNear(zone.centerX, this.cameraPos.x); // §6
    const cy = this.wrapNear(zone.centerY, this.cameraPos.y);
    const R = 5000;
    ctx.save();
    ctx.beginPath();
    ctx.rect(this.cameraPos.x - R, this.cameraPos.y - R, R * 2, R * 2);
    ctx.arc(cx, cy, zone.radius, 0, Math.PI * 2, true);
    ctx.fillStyle = 'rgba(255, 183, 178, 0.15)';
    ctx.fill('evenodd');

    ctx.beginPath();
    ctx.arc(cx, cy, zone.radius, 0, Math.PI * 2);
    ctx.strokeStyle = '#FFB7B2'; ctx.lineWidth = 5;
    ctx.stroke();
    ctx.restore();
  }

  /** Render Peaceful Safe Sanctuary Zone (No PvP / Hide Safely Inside) */
  private renderSanctuaryZone(s: { centerX: number; centerY: number; radius: number; label: string; icon: string }) {
    const ctx = this.ctx;
    const cx = this.wrapNear(s.centerX, this.cameraPos.x); // §6 nearest wrapped copy
    const cy = this.wrapNear(s.centerY, this.cameraPos.y);
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, s.radius, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(167, 243, 208, 0.32)';
    ctx.fill();
    ctx.strokeStyle = '#10B981';
    ctx.lineWidth = 5;
    ctx.setLineDash([14, 8]);
    ctx.stroke();
    ctx.setLineDash([]);

    // Sanctuary Label
    ctx.font = 'bold 18px Outfit, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#064E3B';
    ctx.shadowColor = 'rgba(255, 255, 255, 0.9)';
    ctx.shadowBlur = 6;
    ctx.fillText(`${s.icon} ${s.label} (NO PVP / SAFE HIDE)`, cx, cy - s.radius + 32);
    ctx.restore();
  }

  /** Render Wormhole Pothole Shortcut Portals */
  private renderPortals(portals: Array<{ id: string; targetId: string; x: number; y: number; label: string; color: string }>) {
    const ctx = this.ctx;
    const pulse = Math.sin(this.animFrame * 0.1) * 4;
    const spin = this.animFrame * 0.05;

    for (const p of portals) {
      ctx.save();
      ctx.translate(this.wrapNear(p.x, this.cameraPos.x), this.wrapNear(p.y, this.cameraPos.y)); // §6

      // Swirling Portal Ring
      ctx.rotate(spin);
      ctx.beginPath();
      ctx.arc(0, 0, 30 + pulse, 0, Math.PI * 2);
      ctx.fillStyle = p.color + '44';
      ctx.fill();

      ctx.strokeStyle = p.color;
      ctx.lineWidth = 4;
      ctx.setLineDash([10, 6]);
      ctx.stroke();

      ctx.rotate(-spin);
      ctx.font = '28px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('🌀', 0, 0);

      ctx.font = 'bold 12px Outfit, sans-serif';
      ctx.fillStyle = p.color;
      ctx.shadowColor = 'rgba(255,255,255,0.9)';
      ctx.shadowBlur = 4;
      ctx.fillText(p.label, 0, 42);

      ctx.restore();
    }
  }

  /** §2 Dynamic obstacles — ponds get a water disc, everything else a shadowed emoji prop. */
  private renderObstacles(obstacles: ObstacleData[]) {
    const ctx = this.ctx;
    for (const ob of obstacles) {
      const ox = this.wrapNear(ob.x, this.cameraPos.x); // §6 nearest wrapped copy
      const oy = this.wrapNear(ob.y, this.cameraPos.y);
      ctx.save();
      if (ob.type === 'pond') {
        ctx.beginPath(); ctx.arc(ox, oy, ob.radius, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(96,165,250,0.32)'; ctx.fill();
        ctx.strokeStyle = 'rgba(59,130,246,0.5)'; ctx.lineWidth = 3; ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.ellipse(ox, oy + ob.radius * 0.55, ob.radius * 0.72, ob.radius * 0.3, 0, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0,0,0,0.10)'; ctx.fill();
      }
      ctx.font = `${ob.radius * 1.85}px sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(ob.icon, ox, oy);
      ctx.restore();
    }
  }

  /**
   * Crystal Clear High-Contrast Collectibles (Cherries 🍒, Apples 🍎, Frogs 🐸, Stars ⭐)
   * Rendered on a bright white circle disc badge so they 100% pop out crisp and clear on any terrain!
   */
  private renderCollectible(food: FoodData) {
    const ctx = this.ctx;
    const fx = this.wrapNear(food.x, this.cameraPos.x); // §6 draw the nearest wrapped copy
    const fy0 = this.wrapNear(food.y, this.cameraPos.y);
    const bounce = Math.sin(this.animFrame * 0.08 + food.x) * 3;
    const py = fy0 + bounce;
    const icon = food.icon || FOOD_ICONS[food.type] || '🍒';

    ctx.save();

    // 1. Soft Shadow
    ctx.beginPath();
    ctx.ellipse(fx, fy0 + 12, 11, 5, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.12)';
    ctx.fill();

    // 2. Bright White Circle Disc Badge behind food so it POPS out 100% clear!
    ctx.beginPath();
    ctx.arc(fx, py, 15, 0, Math.PI * 2);
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();
    ctx.strokeStyle = '#90CDF4';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // 3. Crisp Emoji / Icon inside disc
    ctx.font = '20px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(icon, fx, py + 1);

    ctx.restore();
  }

  /**
   * High-Performance 60+ FPS Kawaii Vector Snake Illustration Renderer
   */
  private renderKawaiiVectorSnake(snake: SnakeData, isTarget: boolean) {
    const ctx = this.ctx;
    const pal = this.palette(snake.skin);
    const lerp = this.lerpSnakes.get(snake.id);
    const rawHeadX = lerp ? lerp.x : snake.head.x;
    const rawHeadY = lerp ? lerp.y : snake.head.y;
    const angle = lerp ? lerp.angle : snake.angle;
    const rawBody = lerp ? lerp.body : snake.body;

    // §6 Reconstruct a camera-continuous chain: head at the copy nearest the camera, then
    // each segment placed by the short toroidal delta from the previous one (wraps seamlessly).
    const headX = this.wrapNear(rawHeadX, this.cameraPos.x);
    const headY = this.wrapNear(rawHeadY, this.cameraPos.y);
    const body: Array<{ x: number; y: number }> = [];
    let prevAbs = { x: rawHeadX, y: rawHeadY };
    let prevDrawn = { x: headX, y: headY };
    for (let i = 0; i < rawBody.length; i++) {
      const seg = rawBody[i];
      const d = { x: prevDrawn.x + this.wrapDeltaRaw(seg.x - prevAbs.x), y: prevDrawn.y + this.wrapDeltaRaw(seg.y - prevAbs.y) };
      body.push(d);
      prevAbs = seg; prevDrawn = d;
    }
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

    // --- 1. CONTINUOUS SMOOTH KAWAII BODY TUBE (Batch-rendered for 60+ FPS lock) ---

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

    // Pass C: Soft Powder Blue Underbelly Shade
    ctx.beginPath();
    ctx.moveTo(headX, headY);
    for (let i = 0; i < body.length; i++) {
      ctx.lineTo(body[i].x, body[i].y);
    }
    ctx.strokeStyle = pal.belly;
    ctx.lineWidth = baseRadius * 0.72;
    ctx.stroke();

    // Pass D: Flowers (Max 2 flowers on spine for high performance)
    if (body.length > 5) {
      const flowerIcon = pal.flower || '🌸';
      ctx.font = `${baseRadius * 1.1}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      const seg1 = body[Math.floor(body.length * 0.3)];
      if (seg1) ctx.fillText(flowerIcon, seg1.x, seg1.y - baseRadius * 0.4);

      if (body.length > 12) {
        const seg2 = body[Math.floor(body.length * 0.7)];
        if (seg2) ctx.fillText(flowerIcon, seg2.x, seg2.y - baseRadius * 0.4);
      }
    }

    // Trailing sparkles when boosting
    if (snake.boosting) {
      const tailSeg = body[body.length - 1] || { x: headX, y: headY };
      ctx.font = `${baseRadius * 0.85}px sans-serif`;
      ctx.fillText('✨', tailSeg.x, tailSeg.y);
    }

    ctx.restore();

    // --- 2. CHUBBY KAWAII HEAD & FACE ---
    ctx.save();
    ctx.translate(headX, headY);
    ctx.rotate(angle);

    const headW = baseRadius * 1.15;
    const headH = baseRadius * 1.05;

    // Head Dark Contour Outline
    ctx.beginPath();
    ctx.ellipse(0, 0, headW + 2.2, headH + 2.2, 0, 0, Math.PI * 2);
    ctx.fillStyle = pal.outline;
    ctx.fill();

    // Head Primary Soft Pastel Fill
    ctx.beginPath();
    ctx.ellipse(0, 0, headW, headH, 0, 0, Math.PI * 2);
    ctx.fillStyle = pal.primary;
    ctx.fill();

    // Soft Pink Blush Cheeks
    ctx.beginPath();
    ctx.ellipse(headW * 0.28, -headH * 0.46, baseRadius * 0.32, baseRadius * 0.18, 0, 0, Math.PI * 2);
    ctx.ellipse(headW * 0.28, headH * 0.46, baseRadius * 0.32, baseRadius * 0.18, 0, 0, Math.PI * 2);
    ctx.fillStyle = pal.blush;
    ctx.globalAlpha = 0.75;
    ctx.fill();
    ctx.globalAlpha = 1.0;

    // --- 3. KAWAII BUTTON EYES ---
    const eyeOffsetX = headW * 0.36;
    const eyeOffsetY = headH * 0.32;
    const eyeRadiusX = Math.max(3.5, baseRadius * 0.24);
    const eyeRadiusY = Math.max(2.8, baseRadius * 0.18);

    for (const side of [-1, 1]) {
      const ey = side * eyeOffsetY;

      if (anim.isBlinking) {
        ctx.beginPath();
        ctx.arc(eyeOffsetX, ey, eyeRadiusX, 0.15 * Math.PI, 0.85 * Math.PI, false);
        ctx.strokeStyle = pal.outline;
        ctx.lineWidth = 2.2;
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.ellipse(eyeOffsetX, ey, eyeRadiusX, eyeRadiusY, side * 0.15, 0, Math.PI * 2);
        ctx.fillStyle = pal.eye;
        ctx.fill();
      }
    }

    // Equipped Accessory
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

    const y = headY - r - 22;
    ctx.save();
    ctx.font = 'bold 12px Outfit, sans-serif';
    ctx.textAlign = 'center';

    const label = isTarget ? `👑 ${snake.displayName}` : `${snake.displayName}`;
    ctx.fillStyle = isTarget ? '#1E3A8A' : '#475569';
    ctx.shadowColor = 'rgba(255,255,255,0.9)';
    ctx.shadowBlur = 4;
    ctx.fillText(label, headX, y - 4);

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

    // §8 Sanctuary (always visible) — green ring on the minimap
    if (state.sanctuaryZone) {
      ctx.beginPath();
      ctx.arc(x + state.sanctuaryZone.centerX * scale, y + state.sanctuaryZone.centerY * scale, Math.max(4, state.sanctuaryZone.radius * scale), 0, Math.PI * 2);
      ctx.strokeStyle = '#10B981'; ctx.lineWidth = 1.5; ctx.stroke();
    }
    // §7 Active wormhole — pulsing purple marker
    if (state.portals) {
      for (const p of state.portals) {
        ctx.beginPath();
        ctx.arc(x + p.x * scale, y + p.y * scale, 3 + Math.sin(this.animFrame * 0.15) * 1.2, 0, Math.PI * 2);
        ctx.fillStyle = p.color || '#8B5CF6'; ctx.fill();
      }
    }

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

  // §5 Camera zoom controls -------------------------------------------------
  /** Multiply zoom by a factor (mouse wheel / pinch). Clamped to focus↔reveal range. */
  public adjustZoom(factor: number) {
    this.userZoom = Math.max(this.ZOOM_MIN / 1.15, Math.min(this.ZOOM_MAX / 0.9, this.userZoom * factor));
  }

  /** Mobile zoom button — cycles far → normal → close. Returns a short label. */
  public cycleZoom(): string {
    const steps: Array<[number, string]> = [[0.7, 'Far'], [1.0, 'Normal'], [1.35, 'Close']];
    let idx = 0;
    let best = Infinity;
    for (let i = 0; i < steps.length; i++) {
      const d = Math.abs(steps[i][0] - this.userZoom);
      if (d < best) { best = d; idx = i; }
    }
    const next = steps[(idx + 1) % steps.length];
    this.userZoom = next[0];
    return next[1];
  }
}
