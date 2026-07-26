import { GameStateTick, SnakeData, FoodData, ObstacleData, WORLD } from './GameClient.js';
import {
  renderTreeAsset,
  renderPondAsset,
  renderCaveAsset,
  renderRockAsset,
  renderFrogAsset,
  renderWormholeAsset,
} from './assets/index.js';

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
  private cameraPos = { x: WORLD / 2, y: WORLD / 2 };
  private zoom = 0.45;
  private userZoom = 0.45;            // §5 player-controlled zoom (default: Far view 0.45 = 2.2x wider map FOV)
  private readonly ZOOM_MIN = 0.30;  // most zoomed OUT (Ultra Wide)
  private readonly ZOOM_MAX = 1.0;   // most zoomed IN (Near)
  private animFrame = 0;

  // §6 Toroidal wrap helpers — draw entities at the copy nearest the camera (§8 world = WORLD).
  private wrapRaw(v: number): number { const w = WORLD; return ((v % w) + w) % w; }
  private wrapDeltaRaw(d: number): number { const w = WORLD; let r = ((d % w) + w) % w; if (r > w / 2) r -= w; return r; }
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

  private shakeTimer = 0;
  private shakeIntensity = 0;
  private damageTexts: Array<{ x: number; y: number; text: string; color: string; life: number; maxLife: number }> = [];

  public triggerCameraShake(intensity = 6, duration = 0.25) {
    this.shakeIntensity = intensity;
    this.shakeTimer = duration;
  }

  public spawnDamageText(x: number, y: number, text: string | number, isCritical = false) {
    const txt = typeof text === 'number' ? `-${text}` : text;
    this.damageTexts.push({
      x: x + (Math.random() - 0.5) * 20,
      y: y - 20,
      text: String(txt),
      color: isCritical ? '#EF4444' : '#F59E0B',
      life: 0.8,
      maxLife: 0.8,
    });
  }

  public setCameraPreset(preset: 'near' | 'medium' | 'far' | 'ultra_wide') {
    const scale = preset === 'near' ? 0.85 : preset === 'medium' ? 0.65 : preset === 'ultra_wide' ? 0.32 : 0.45;
    this.userZoom = scale;
  }

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false })!;
    this.resize();
    window.addEventListener('resize', () => this.resize());
    window.addEventListener('orientationchange', () => setTimeout(() => this.resize(), 150));
    // visualViewport fires when the on-screen keyboard or URL bar resizes the visible area
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', () => this.resize());
    }
    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(() => this.resize());
      ro.observe(document.documentElement);
    }
  }

  // Re-bind to the current canvas element. The app rebuilds root.innerHTML on every
  // render(), which replaces the <canvas>, so we must re-point at the live element or
  // we'd keep drawing to a detached one (→ blank screen after pause/resume).
  public attach(canvas: HTMLCanvasElement) {
    if (this.canvas === canvas) return;
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false })!;
    this.resize();
  }

  public resize() {
    const dpr = Math.min(2.5, window.devicePixelRatio || 1);
    // Use visualViewport when available — on mobile this reflects the actual visible
    // area after the URL bar / virtual keyboard shrinks it. innerWidth/innerHeight
    // can return the full layout viewport (larger than what's actually visible).
    const vp = window.visualViewport;
    const w = vp ? Math.round(vp.width) : window.innerWidth;
    const h = vp ? Math.round(vp.height) : window.innerHeight;
    this.canvas.width = Math.floor(w * dpr);
    this.canvas.height = Math.floor(h * dpr);
    this.canvas.style.width = w + 'px';
    this.canvas.style.height = h + 'px';
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

  // §Team the local player's team this frame (undefined outside Team Battle)
  private selfTeam?: 'red' | 'blue';

  // §8 Data-driven map theme + seasonal tint (applied from the server maps config).
  private theme = { sky: '#D4EEF9', ground: '#EBF5FB', grid: 'rgba(120,180,150,0.18)', accent: '#2E7D32', tint: '' };
  public applyTheme(t: { sky?: string; ground?: string; grid?: string; accent?: string; tint?: string }) {
    this.theme = { ...this.theme, ...t, ground: t.ground || t.sky || this.theme.ground };
  }
  private teamColor(team?: 'red' | 'blue'): string {
    return team === 'red' ? '#EF4444' : team === 'blue' ? '#3B82F6' : '#70C1B3';
  }

  public render(state: GameStateTick, targetUserId: string) {
    this.animFrame++;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    // Team Battle: remember our team so allies/enemies can be color-coded consistently.
    this.selfTeam = state.snakes.find(s => s.id === targetUserId)?.team;

    // §8 Theme-driven sky/background (data-driven per map theme).
    this.ctx.fillStyle = this.theme.sky;
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

      // Responsive camera zoom — continuous scaling curve for all device sizes.
      const size = ((target as any).radius ?? 16) + ((target as any).length ?? 12) * 0.12;
      const minDim = Math.min(vw, vh);
      const maxDim = Math.max(vw, vh);
      let baseZoom = 18 / Math.max(12, size);

      // Screen-adaptive scale: ref 360px → 1.0 (so mobile phones are baseline, clear and prominent)
      const screenScale = Math.max(0.85, Math.min(1.4, minDim / 360));

      // Landscape compensation — wider aspect ratios zoom out slightly
      const aspectRatio = maxDim / minDim;
      const landscapeBoost = aspectRatio > 1.6 ? 0.92 : 1.0;

      let targetZoom = Math.max(0.55, Math.min(1.7,
        baseZoom * screenScale * landscapeBoost * this.userZoom
      ));
      this.zoom += (targetZoom - this.zoom) * 0.08;
    }

    let shakeX = 0, shakeY = 0;
    if (this.shakeTimer > 0) {
      this.shakeTimer -= 0.016;
      shakeX = (Math.random() - 0.5) * this.shakeIntensity;
      shakeY = (Math.random() - 0.5) * this.shakeIntensity;
    }

    this.ctx.save();
    this.ctx.translate(vw / 2 + shakeX, vh / 2 + shakeY);
    this.ctx.scale(this.zoom, this.zoom);
    this.ctx.translate(-this.cameraPos.x, -this.cameraPos.y);

    this.renderTerrain(WORLD);
    const isCompetitive = state.mode === 'battle_royale' || state.mode === 'team';
    if (isCompetitive && state.safeZone) this.renderSafeZone(state.safeZone);
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

    // Floating combat / damage text
    for (let i = this.damageTexts.length - 1; i >= 0; i--) {
      const d = this.damageTexts[i];
      d.life -= 0.016;
      d.y -= 1.2;
      if (d.life <= 0) {
        this.damageTexts.splice(i, 1);
        continue;
      }
      const alpha = Math.max(0, d.life / d.maxLife);
      const fx = this.wrapNear(d.x, this.cameraPos.x);
      const fy = this.wrapNear(d.y, this.cameraPos.y);
      this.ctx.save();
      this.ctx.globalAlpha = alpha;
      this.ctx.font = '900 22px Outfit, sans-serif';
      this.ctx.fillStyle = d.color;
      this.ctx.strokeStyle = '#000000';
      this.ctx.lineWidth = 3;
      this.ctx.textAlign = 'center';
      this.ctx.strokeText(d.text, fx, fy);
      this.ctx.fillText(d.text, fx, fy);
      this.ctx.restore();
    }

    if (state.currentEvent?.type === 'rain_storm') this.renderRain(WORLD);

    this.ctx.restore();

    // §8 Seasonal tint overlay (thin, non-intrusive) — auto-selected by month or festival.
    if (this.theme.tint) {
      this.ctx.fillStyle = this.theme.tint;
      this.ctx.fillRect(0, 0, vw, vh);
    }

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

    // 1. Theme ground base (§8) — uniform, borderless.
    ctx.fillStyle = this.theme.ground;
    ctx.fillRect(cam.x - R, cam.y - R, R * 2, R * 2);

    // 2. Soft Park Meadow Patches (Organic subtle filled patches without border lines)
    ctx.fillStyle = 'rgba(220, 252, 231, 0.42)';
    for (const [px, py, pr] of [[350, 500, 340], [2500, 700, 380], [700, 2400, 400], [2400, 2300, 360]]) {
      ctx.beginPath(); ctx.arc(this.wrapNear(px, cam.x), this.wrapNear(py, cam.y), pr, 0, Math.PI * 2); ctx.fill();
    }
  }

  private renderSafeZone(zone: { centerX: number; centerY: number; radius: number }) {
    const ctx = this.ctx;
    const cx = this.wrapNear(zone.centerX, this.cameraPos.x); // §6
    const cy = this.wrapNear(zone.centerY, this.cameraPos.y);
    const R = 6000;
    ctx.save();
    ctx.beginPath();
    ctx.rect(this.cameraPos.x - R, this.cameraPos.y - R, R * 2, R * 2);
    ctx.arc(cx, cy, zone.radius, 0, Math.PI * 2, true);
    ctx.fillStyle = 'rgba(239, 68, 68, 0.16)';
    ctx.fill('evenodd');

    ctx.beginPath();
    ctx.arc(cx, cy, zone.radius, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(239, 68, 68, 0.75)';
    ctx.lineWidth = 3.5;
    ctx.stroke();
    ctx.restore();
  }

  /** Render Peaceful Safe Sanctuary Zone (No PvP / Hide Safely Inside) — Clean & Unobstructed */
  private renderSanctuaryZone(s: { centerX: number; centerY: number; radius: number; label: string; icon: string }) {
    const ctx = this.ctx;
    const cx = this.wrapNear(s.centerX, this.cameraPos.x); // §6 nearest wrapped copy
    const cy = this.wrapNear(s.centerY, this.cameraPos.y);
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, s.radius, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(167, 243, 208, 0.25)';
    ctx.fill();
    ctx.restore();
  }

  /** Render Wormhole Portals — Delegated to ./assets/powers.ts asset registry */
  private renderPortals(portals: Array<{ id: string; targetId: string; x: number; y: number; label: string; color: string }>) {
    for (const p of portals) {
      const px = this.wrapNear(p.x, this.cameraPos.x);
      const py = this.wrapNear(p.y, this.cameraPos.y);
      renderWormholeAsset(this.ctx, px, py, this.animFrame, p.label);
    }
  }

  /** Dynamic obstacles — Delegated to ./assets/objects.ts asset registry */
  private renderObstacles(obstacles: ObstacleData[]) {
    const ctx = this.ctx;
    for (const ob of obstacles) {
      const ox = this.wrapNear(ob.x, this.cameraPos.x);
      const oy = this.wrapNear(ob.y, this.cameraPos.y);
      ctx.save();
      if (ob.type === 'pond') {
        renderPondAsset(ctx, ox, oy, ob.radius || 52, this.animFrame);
      } else if (ob.type === 'tree' || ob.type === 'bush') {
        renderTreeAsset(ctx, ox, oy, ob.radius || 44);
      } else if (ob.type === 'cave') {
        renderCaveAsset(ctx, ox, oy, ob.radius || 58);
      } else if (ob.type === 'rock' || ob.type === 'hill') {
        renderRockAsset(ctx, ox, oy, ob.radius || 34);
      } else if (ob.type === 'lava' || ob.type === 'poison') {
        // §3 hazard pool — pulsing warning glow behind the icon
        const c1 = ob.type === 'lava' ? 'rgba(255,90,30,0.5)' : 'rgba(150,70,210,0.45)';
        const c2 = ob.type === 'lava' ? 'rgba(200,40,10,0.85)' : 'rgba(96,32,150,0.8)';
        const pulse = 1 + Math.sin(this.animFrame * 0.12 + ob.x) * 0.06;
        ctx.beginPath(); ctx.arc(ox, oy, ob.radius * pulse, 0, Math.PI * 2);
        ctx.fillStyle = c1; ctx.fill();
        ctx.strokeStyle = c2; ctx.lineWidth = 3; ctx.stroke();
        ctx.font = `${ob.radius * 1.3}px sans-serif`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(ob.icon, ox, oy);
      } else {
        ctx.globalAlpha = 1.0;
        ctx.font = `${ob.radius * 2.1}px sans-serif`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(ob.icon, ox, oy + ob.radius * 0.06);
      }
      ctx.restore();
    }
  }

  /**
   * High-Contrast Collectibles (Cherries 🍒, Apples 🍎, Frogs 🐸, Stars ⭐, Powers 🛡️/⚡)
   * Rendered 100% crisp and fully visible directly on terrain WITHOUT ground shadows!
   */
  private renderCollectible(food: FoodData) {
    const ctx = this.ctx;
    const fx = this.wrapNear(food.x, this.cameraPos.x);
    const fy0 = this.wrapNear(food.y, this.cameraPos.y);

    if (food.type === 'frog') {
      renderFrogAsset(ctx, fx, fy0, this.animFrame);
      return;
    }
    const bounce = food.type === 'star' ? 0 : Math.sin(this.animFrame * 0.08 + food.x) * 3;
    const py = fy0 - bounce;
    const icon = food.icon || FOOD_ICONS[food.type] || '🍒';

    ctx.save();

    // Viewport-scaled collectible icon — proportional to screen size, minimum 24px
    const minDim = Math.min(window.innerWidth, window.innerHeight);
    const iconSize = Math.max(24, Math.min(36, Math.floor(minDim * 0.065)));
    ctx.globalAlpha = 1.0;
    ctx.font = `${iconSize}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(icon, fx, py);

    ctx.restore();
  }

  /** Custom Kawaii Vector Tree Frog Renderer with Realistic Parabolic Leap Physics */
  private renderKawaiiFrog(fx: number, fy0: number) {
    const ctx = this.ctx;
    const size = 18;

    // Real Frog Parabolic Leap Cycle (Sit -> Explosive Leap Arc -> Retract & Land)
    const time = (this.animFrame * 0.045 + (fx * 0.13)) % 2.6;
    let jumpY = 0;
    let leapPhase = 0; // 0 = sit crouched, 1 = max mid-air leap extension

    if (time > 1.3 && time < 2.0) {
      const leapProgress = (time - 1.3) / 0.7; // 0 to 1
      jumpY = Math.sin(leapProgress * Math.PI) * 40; // High explosive parabolic arc!
      leapPhase = Math.sin(leapProgress * Math.PI);
    } else if (time >= 2.0 && time < 2.2) {
      // Squish impact landing
      leapPhase = -0.15;
    }

    const py = fy0 - jumpY;

    ctx.save();
    ctx.translate(fx, py);

    // 1. Bent Hind Legs & Webbed Feet (Stretch backward during leap, retract when sitting)
    ctx.fillStyle = '#689F38'; // Darker lime green for legs
    ctx.beginPath();
    ctx.ellipse(-size * 0.85, size * (0.28 + leapPhase * 0.2), size * 0.52, size * (0.3 + leapPhase * 0.15), -0.3 - leapPhase * 0.4, 0, Math.PI * 2);
    ctx.ellipse(size * 0.85, size * (0.28 + leapPhase * 0.2), size * 0.52, size * (0.3 + leapPhase * 0.15), 0.3 + leapPhase * 0.4, 0, Math.PI * 2);
    ctx.fill();

    // 2. Main Lime Green Body & Head (Lengthens slightly mid-air)
    ctx.fillStyle = '#7CB342';
    ctx.beginPath();
    ctx.ellipse(0, size * 0.08, size * 0.82, size * (0.7 + leapPhase * 0.15), 0, 0, Math.PI * 2);
    ctx.fill();

    // 3. Light Cream/Lime Belly Patch
    ctx.fillStyle = '#DCEDC8';
    ctx.beginPath();
    ctx.ellipse(0, size * 0.26, size * 0.56, size * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();

    // 4. Prominent Bulging Eye Sockets
    ctx.fillStyle = '#7CB342';
    ctx.beginPath();
    ctx.arc(-size * 0.46, -size * (0.42 + leapPhase * 0.1), size * 0.4, 0, Math.PI * 2);
    ctx.arc(size * 0.46, -size * (0.42 + leapPhase * 0.1), size * 0.4, 0, Math.PI * 2);
    ctx.fill();

    // 5. Large Glossy Black Pupils & White Light Reflection Highlights
    ctx.fillStyle = '#212121'; // Black Pupil
    ctx.beginPath();
    ctx.arc(-size * 0.46, -size * (0.42 + leapPhase * 0.1), size * 0.3, 0, Math.PI * 2);
    ctx.arc(size * 0.46, -size * (0.42 + leapPhase * 0.1), size * 0.3, 0, Math.PI * 2);
    ctx.fill();

    // White Glossy Glint
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(-size * 0.54, -size * (0.5 + leapPhase * 0.1), size * 0.11, 0, Math.PI * 2);
    ctx.arc(size * 0.38, -size * (0.5 + leapPhase * 0.1), size * 0.11, 0, Math.PI * 2);
    ctx.fill();

    // 6. Cute Smiling Mouth
    ctx.strokeStyle = '#33691E';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(0, -size * 0.04, size * 0.42, 0.2, Math.PI - 0.2);
    ctx.stroke();

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

    // §Team Battle — a team-colored ground ring makes allies/enemies instantly readable.
    if (snake.team) {
      const ally = snake.team === this.selfTeam;
      ctx.save();
      ctx.beginPath();
      ctx.arc(headX, headY, baseRadius * 1.9, 0, Math.PI * 2);
      ctx.strokeStyle = this.teamColor(snake.team);
      ctx.globalAlpha = ally ? 0.9 : 0.7;
      ctx.setLineDash(ally ? [] : [6, 5]); // solid ring = ally, dashed = enemy
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }

    // Power aura around the head — 🍄 super (pink) / 🛡️ shield (blue)
    const superOn = ((snake as any).superTimer ?? 0) > 0;
    const shieldOn = snake.shieldTimer > 0;
    if (superOn || shieldOn) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(headX, headY, baseRadius * 1.7 + Math.sin(this.animFrame * 0.2) * 2, 0, Math.PI * 2);
      ctx.strokeStyle = superOn ? 'rgba(232,93,117,0.85)' : 'rgba(62,146,204,0.85)';
      ctx.lineWidth = 3.5;
      ctx.shadowColor = ctx.strokeStyle;
      ctx.shadowBlur = 12;
      ctx.stroke();
      ctx.restore();
    }

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

    // Scale name font with screen size: 9px on tiny phones → 20px on desktop
    const minDim = Math.min(window.innerWidth, window.innerHeight);
    const nameFontSize = Math.max(9, Math.min(20, 12 * (minDim / 400)));
    const y = headY - r - (nameFontSize + 10);
    ctx.save();
    ctx.font = `bold ${nameFontSize}px Outfit, sans-serif`;
    ctx.textAlign = 'center';

    // Team Battle: tag allies/enemies with a colored square + team-colored name.
    const teamMark = snake.team ? (snake.team === this.selfTeam ? '🟩 ' : '🟥 ') : '';
    const label = isTarget ? `👑 ${snake.displayName}` : `${teamMark}${snake.displayName}`;
    ctx.fillStyle = snake.team ? this.teamColor(snake.team) : (isTarget ? '#1E3A8A' : '#475569');
    ctx.shadowColor = 'rgba(255,255,255,0.9)';
    ctx.shadowBlur = 4;
    ctx.fillText(label, headX, y - 4);

    if (ratio < 0.99) {
      const w = Math.max(30, r * 2.5);
      const hpH = Math.max(3, Math.min(6, nameFontSize * 0.4));
      const x = headX - w / 2;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
      ctx.fillRect(x - 1, y - 1, w + 2, hpH + 2);
      ctx.fillStyle = ratio < 0.3 ? '#FC8181' : '#F6AD55';
      ctx.fillRect(x, y, w * ratio, hpH);
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
    const minDim = Math.min(vw, vh);
    const isMobile = minDim <= 640 || ('ontouchstart' in window);

    // Proportional minimap: 16% of shortest viewport dimension, clamped to [70, 130]px
    const size = Math.max(70, Math.min(130, Math.floor(minDim * (isMobile ? 0.18 : 0.13))));
    const margin = Math.max(10, Math.floor(minDim * 0.025));

    const x = vw - size - margin;
    // Mobile/touch: stacked neatly above touch buttons in bottom-right (y = vh - size - 148). Desktop: bottom-right margin.
    const y = isMobile
      ? vh - size - Math.max(140, Math.floor(vh * 0.18))
      : vh - size - margin;

    ctx.save();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.strokeStyle = '#B5EAD7'; ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(x, y, size, size, Math.max(6, size * 0.1));
    ctx.fill(); ctx.stroke();

    const scale = size / WORLD;

    // Sanctuary (always visible) — green ring on the minimap
    if (state.sanctuaryZone) {
      ctx.beginPath();
      ctx.arc(x + state.sanctuaryZone.centerX * scale, y + state.sanctuaryZone.centerY * scale, Math.max(4, state.sanctuaryZone.radius * scale), 0, Math.PI * 2);
      ctx.strokeStyle = '#10B981'; ctx.lineWidth = 1.5; ctx.stroke();
    }
    // Active wormhole — pulsing purple marker
    if (state.portals) {
      for (const p of state.portals) {
        ctx.beginPath();
        ctx.arc(x + p.x * scale, y + p.y * scale, 3 + Math.sin(this.animFrame * 0.15) * 1.2, 0, Math.PI * 2);
        ctx.fillStyle = p.color || '#8B5CF6'; ctx.fill();
      }
    }

    // Snake dots — proportional to minimap size
    const dotR = Math.max(1.5, size * 0.025);
    const myDotR = Math.max(2.5, size * 0.035);
    for (let i = 0; i < state.snakes.length; i++) {
      const s = state.snakes[i];
      if (!s.isAlive) continue;
      const isT = s.id === targetUserId;
      ctx.beginPath();
      ctx.arc(x + s.head.x * scale, y + s.head.y * scale, isT ? myDotR : dotR, 0, Math.PI * 2);
      // Team Battle: dots colored by team so you can read the battlefield at a glance.
      ctx.fillStyle = isT ? '#111827' : (s.team ? this.teamColor(s.team) : '#70C1B3'); ctx.fill();
      if (isT) { ctx.lineWidth = 1.5; ctx.strokeStyle = '#fff'; ctx.stroke(); }
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

  /** Mobile zoom button — cycles Far → Medium → Near → Ultra. Returns a short label. */
  public cycleZoom(): string {
    const steps: Array<[number, string]> = [[0.45, 'Far'], [0.65, 'Medium'], [0.85, 'Near'], [0.32, 'Ultra']];
    let idx = 0;
    let best = Infinity;
    for (let i = 0; i < steps.length; i++) {
      const d = Math.abs(this.userZoom - steps[i][0]);
      if (d < best) { best = d; idx = i; }
    }
    const next = (idx + 1) % steps.length;
    this.userZoom = steps[next][0];
    return steps[next][1];
  }
}
