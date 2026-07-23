import { GameStateTick, SnakeData, FoodData } from './GameClient.js';

interface SkinPalette { primary: string; secondary: string; scale: string; glow: string; }

const SKINS: Record<string, SkinPalette> = {
  Forest: { primary: '#43A047', secondary: '#1B5E20', scale: '#8BC34A', glow: '#7CFF6B' },
  Ocean: { primary: '#2196F3', secondary: '#0D47A1', scale: '#64B5F6', glow: '#4FC3F7' },
  Fire: { primary: '#FB8C00', secondary: '#C62828', scale: '#FFB74D', glow: '#FF7043' },
  Shadow: { primary: '#5E35B1', secondary: '#1A1035', scale: '#9575CD', glow: '#B388FF' },
  Golden: { primary: '#FFC107', secondary: '#FF8F00', scale: '#FFE082', glow: '#FFD54F' },
};

// Legacy skin-name fallbacks so older saves still render.
const SKIN_ALIASES: Record<string, string> = {
  'Emerald Anaconda': 'Forest', 'Standard Forest Snake': 'Forest', 'Golden Serpent': 'Golden',
  'Crimson Viper': 'Fire', 'Shadow Cobra': 'Shadow', 'Ice': 'Ocean', 'Galaxy': 'Shadow',
};

export class Renderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private cameraPos = { x: 1600, y: 1600 };
  private zoom = 1.0;
  private animFrame = 0;

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
      const targetZoom = Math.max(0.55, Math.min(1.15, 1.15 - (target.radius - 12) * 0.016));
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
    // Bright daytime park grass
    ctx.fillStyle = '#bfe6b3';
    ctx.fillRect(0, 0, world, world);

    // Soft park patches (lighter green)
    ctx.fillStyle = '#cdeec0';
    for (const [px, py, pr] of [[350, 500, 260], [2500, 700, 300], [700, 2400, 320], [2400, 2300, 280], [1900, 1900, 240]] as number[][]) {
      ctx.beginPath(); ctx.arc(px, py, pr, 0, Math.PI * 2); ctx.fill();
    }

    // Grid texture (subtle)
    ctx.strokeStyle = 'rgba(120, 170, 120, 0.18)'; ctx.lineWidth = 1;
    for (let x = 0; x <= world; x += 160) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, world); ctx.stroke(); }
    for (let y = 0; y <= world; y += 160) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(world, y); ctx.stroke(); }

    // River (light blue water)
    const wave = Math.sin(this.animFrame * 0.04) * 8;
    ctx.fillStyle = '#8fd3f4';
    ctx.beginPath();
    ctx.moveTo(820 + wave, 0); ctx.lineTo(980 + wave, 0);
    ctx.lineTo(1220 + wave, world); ctx.lineTo(1060 + wave, world);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 3;
    for (let y = 120; y < world; y += 280) { const rx = 940 + ((y / world) * 260) + wave; ctx.beginPath(); ctx.arc(rx, y, 34, 0.1, Math.PI - 0.1); ctx.stroke(); }

    // Roads — white with soft edges + dashed centre line
    ctx.fillStyle = '#f4f7f5';
    ctx.fillRect(0, 1500, world, 140);
    ctx.fillRect(1500, 0, 140, world);
    ctx.strokeStyle = '#e2e8e4'; ctx.lineWidth = 3;
    ctx.strokeRect(0, 1500, world, 140); ctx.strokeRect(1500, 0, 140, world);
    ctx.strokeStyle = '#f5b301'; ctx.lineWidth = 4; ctx.setLineDash([22, 22]);
    ctx.beginPath(); ctx.moveTo(0, 1570); ctx.lineTo(world, 1570); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(1570, 0); ctx.lineTo(1570, world); ctx.stroke();
    ctx.setLineDash([]);

    // Landmark buildings — light, rounded, purposeful
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

    // Trees (bright)
    const trees = [[300, 400], [520, 860], [1820, 420], [2420, 820], [420, 2180], [2520, 2420], [900, 300], [2000, 1900]];
    for (const [tx, ty] of trees) {
      const sway = Math.sin(this.animFrame * 0.03 + tx) * 3;
      ctx.fillStyle = '#8a5a2b'; ctx.fillRect(tx - 5, ty, 10, 18);
      ctx.fillStyle = '#4caf50'; ctx.beginPath(); ctx.arc(tx + sway, ty - 14, 28, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#66bb6a'; ctx.beginPath(); ctx.arc(tx + sway - 9, ty - 6, 18, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#81c784'; ctx.beginPath(); ctx.arc(tx + sway + 8, ty - 20, 15, 0, Math.PI * 2); ctx.fill();
    }

    // Boundary
    ctx.strokeStyle = '#4caf50'; ctx.lineWidth = 8; ctx.strokeRect(0, 0, world, world);
  }

  private renderSafeZone(zone: { centerX: number; centerY: number; radius: number }) {
    const ctx = this.ctx;
    ctx.save();
    // Darken outside the ring
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

    // glow disc
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

    // Speed motion trail
    if (speeding) {
      for (let i = snake.body.length - 1; i >= 0; i -= 3) {
        const seg = snake.body[i];
        ctx.beginPath();
        ctx.arc(seg.x, seg.y, snake.radius * 0.7, 0, Math.PI * 2);
        ctx.fillStyle = pal.glow + '22'; ctx.fill();
      }
    }

    // Body
    for (let i = snake.body.length - 1; i >= 0; i--) {
      const seg = snake.body[i];
      const ratio = i / Math.max(1, snake.body.length);
      const radius = Math.max(6, snake.radius * (1 - ratio * 0.32));
      ctx.beginPath();
      ctx.arc(seg.x, seg.y, radius, 0, Math.PI * 2);
      const g = ctx.createRadialGradient(seg.x - 3, seg.y - 3, 2, seg.x, seg.y, radius);
      g.addColorStop(0, pal.scale);
      g.addColorStop(0.6, i % 2 === 0 ? pal.primary : pal.secondary);
      g.addColorStop(1, '#08130b');
      ctx.fillStyle = g;
      ctx.fill();
      ctx.strokeStyle = pal.secondary; ctx.lineWidth = 1.4; ctx.stroke();
    }

    // Head
    ctx.save();
    ctx.translate(snake.head.x, snake.head.y);
    ctx.rotate(snake.angle);
    ctx.beginPath();
    ctx.ellipse(0, 0, snake.radius * 1.3, snake.radius * 0.98, 0, 0, Math.PI * 2);
    const hg = ctx.createRadialGradient(-3, -3, 2, 0, 0, snake.radius * 1.3);
    hg.addColorStop(0, pal.scale); hg.addColorStop(0.8, pal.primary); hg.addColorStop(1, '#08130b');
    ctx.fillStyle = hg; ctx.fill();
    const outline = isTarget ? '#ffe066' : snake.team === 'red' ? '#ef4444' : snake.team === 'blue' ? '#3b82f6' : pal.secondary;
    ctx.lineWidth = 2.6; ctx.strokeStyle = outline; ctx.stroke();
    ctx.restore();

    // Shield bubble
    if (shielded) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(snake.head.x, snake.head.y, snake.radius * 1.9, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(96, 165, 250, 0.9)'; ctx.lineWidth = 3;
      ctx.shadowColor = '#60a5fa'; ctx.shadowBlur = 14; ctx.stroke();
      ctx.fillStyle = 'rgba(96,165,250,0.10)'; ctx.fill();
      ctx.restore();
    }

    this.renderNameHp(snake, isTarget);
  }

  private renderNameHp(snake: SnakeData, isTarget: boolean) {
    const ctx = this.ctx;
    const hp = snake.hp ?? 100, maxHp = snake.maxHp ?? 100;
    const ratio = Math.max(0, Math.min(1, hp / maxHp));
    const w = Math.max(46, snake.radius * 3), h = 6;
    const x = snake.head.x - w / 2, y = snake.head.y - snake.radius - 20;

    ctx.save();
    ctx.font = 'bold 12px Outfit, sans-serif'; ctx.textAlign = 'center';
    ctx.fillStyle = isTarget ? '#b45309' : '#153524';
    ctx.shadowColor = 'rgba(255,255,255,0.9)'; ctx.shadowBlur = 5;
    ctx.fillText(`${snake.displayName} · ${(snake as any).evolution || snake.stage}`, snake.head.x, y - 6);
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
    let c = '#22c55e'; if (ratio < 0.3) c = '#ef4444'; else if (ratio < 0.6) c = '#facc15';
    ctx.fillStyle = c; ctx.fillRect(x, y, w * ratio, h);
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

  // Draw a rounded rect in *screen* space (ignores world transform via reset).
  private roundRectAbs(x: number, y: number, w: number, h: number, r: number) {
    this.roundRect(x, y, w, h, r);
  }
}
