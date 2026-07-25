/**
 * 🪨 ROCK — Alternative Design Variants
 *
 * Current live design: renderRockAsset  (in ../../objects.ts)
 *
 * HOW TO SWAP:
 *   In ../../objects.ts change the export line to e.g.:
 *     export { renderRockMossy as renderRockAsset } from './designs/objects/rock.js';
 */

// ─────────────────────────────────────────────────────────────────────────────
// VARIANT A — Mossy Rock  (green moss patches, earthy)
// ─────────────────────────────────────────────────────────────────────────────
export function renderRockMossy(
  ctx: CanvasRenderingContext2D,
  ox: number,
  oy: number,
  radius: number
) {
  const r = radius || 34;
  ctx.save();
  ctx.translate(ox, oy);

  // Base rock shape
  ctx.beginPath();
  ctx.moveTo(-r, 0);
  ctx.lineTo(-r * 0.55, -r * 0.78);
  ctx.lineTo(r * 0.42, -r * 0.92);
  ctx.lineTo(r, -r * 0.28);
  ctx.lineTo(r * 0.78, r * 0.68);
  ctx.lineTo(-r * 0.38, r * 0.88);
  ctx.closePath();
  ctx.fillStyle = '#6D6D6D';
  ctx.fill();
  ctx.strokeStyle = '#333';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Highlight facet
  ctx.beginPath();
  ctx.moveTo(-r * 0.55, -r * 0.78);
  ctx.lineTo(r * 0.42, -r * 0.92);
  ctx.lineTo(0, -r * 0.22);
  ctx.closePath();
  ctx.fillStyle = '#9E9E9E';
  ctx.fill();

  // Shadow facet
  ctx.beginPath();
  ctx.moveTo(0, -r * 0.22);
  ctx.lineTo(r, -r * 0.28);
  ctx.lineTo(r * 0.78, r * 0.68);
  ctx.closePath();
  ctx.fillStyle = '#424242';
  ctx.fill();

  // Moss patches
  ctx.fillStyle = '#558B2F';
  const mossPos = [
    { x: -r * 0.3, y: -r * 0.55, rx: r * 0.28, ry: r * 0.14 },
    { x: r * 0.15, y: -r * 0.72, rx: r * 0.22, ry: r * 0.1 },
    { x: -r * 0.55, y: -r * 0.18, rx: r * 0.2, ry: r * 0.1 },
  ];
  for (const m of mossPos) {
    ctx.beginPath();
    ctx.ellipse(m.x, m.y, m.rx, m.ry, 0.3, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

// ─────────────────────────────────────────────────────────────────────────────
// VARIANT B — Crystal Rock / Geode  (sparkly minerals inside)
// ─────────────────────────────────────────────────────────────────────────────
export function renderRockCrystal(
  ctx: CanvasRenderingContext2D,
  ox: number,
  oy: number,
  radius: number
) {
  const r = radius || 34;
  ctx.save();
  ctx.translate(ox, oy);

  // Outer rock shell
  ctx.beginPath();
  ctx.moveTo(-r, 0);
  ctx.lineTo(-r * 0.58, -r * 0.82);
  ctx.lineTo(r * 0.4, -r * 0.94);
  ctx.lineTo(r, -r * 0.3);
  ctx.lineTo(r * 0.8, r * 0.7);
  ctx.lineTo(-r * 0.42, r * 0.9);
  ctx.closePath();
  ctx.fillStyle = '#5C5C6A';
  ctx.fill();
  ctx.strokeStyle = '#2C2C3C';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Geode opening
  ctx.beginPath();
  ctx.ellipse(0, 0, r * 0.62, r * 0.52, 0.15, 0, Math.PI * 2);
  ctx.fillStyle = '#1A1A2E';
  ctx.fill();

  // Crystal shards inside
  const crystals = [
    { x: 0, y: -r * 0.25, h: r * 0.36, color: '#CE93D8' },
    { x: -r * 0.25, y: -r * 0.08, h: r * 0.28, color: '#80DEEA' },
    { x: r * 0.22, y: -r * 0.05, h: r * 0.3, color: '#B39DDB' },
    { x: -r * 0.1, y: r * 0.1, h: r * 0.22, color: '#F48FB1' },
    { x: r * 0.08, y: r * 0.08, h: r * 0.24, color: '#AED581' },
  ];
  for (const c of crystals) {
    ctx.fillStyle = c.color;
    ctx.beginPath();
    ctx.moveTo(c.x, c.y - c.h);
    ctx.lineTo(c.x + 5, c.y + 4);
    ctx.lineTo(c.x, c.y + c.h * 0.4);
    ctx.lineTo(c.x - 5, c.y + 4);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.beginPath();
    ctx.moveTo(c.x - 1, c.y - c.h);
    ctx.lineTo(c.x, c.y + 2);
    ctx.lineTo(c.x - 4, c.y - c.h * 0.38);
    ctx.closePath();
    ctx.fill();
  }

  ctx.restore();
}

// ─────────────────────────────────────────────────────────────────────────────
// VARIANT C — Volcanic / Lava Rock  (dark, cracked, orange glow in cracks)
// ─────────────────────────────────────────────────────────────────────────────
export function renderRockVolcanic(
  ctx: CanvasRenderingContext2D,
  ox: number,
  oy: number,
  radius: number,
  animFrame = 0
) {
  const r = radius || 34;
  const flicker = Math.sin(animFrame * 0.2) * 0.15 + 0.85;
  ctx.save();
  ctx.translate(ox, oy);

  // Dark base
  ctx.beginPath();
  ctx.moveTo(-r, 0);
  ctx.lineTo(-r * 0.58, -r * 0.82);
  ctx.lineTo(r * 0.4, -r * 0.94);
  ctx.lineTo(r, -r * 0.3);
  ctx.lineTo(r * 0.8, r * 0.7);
  ctx.lineTo(-r * 0.42, r * 0.9);
  ctx.closePath();
  ctx.fillStyle = '#1C1C1C';
  ctx.fill();

  // Glow from lava cracks
  ctx.globalAlpha = flicker;
  const lg = ctx.createRadialGradient(0, 0, r * 0.05, 0, 0, r * 0.8);
  lg.addColorStop(0, 'rgba(255,100,0,0.5)');
  lg.addColorStop(1, 'rgba(180,0,0,0)');
  ctx.fillStyle = lg;
  ctx.beginPath();
  ctx.moveTo(-r, 0);
  ctx.lineTo(-r * 0.58, -r * 0.82);
  ctx.lineTo(r * 0.4, -r * 0.94);
  ctx.lineTo(r, -r * 0.3);
  ctx.lineTo(r * 0.8, r * 0.7);
  ctx.lineTo(-r * 0.42, r * 0.9);
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 1;

  // Lava crack lines
  ctx.strokeStyle = `rgba(255,${80 + Math.round(flicker * 60)},0,0.85)`;
  ctx.lineWidth = 1.8;
  ctx.lineCap = 'round';
  const cracks = [
    [0, 0, -r * 0.55, -r * 0.42],
    [0, 0, r * 0.48, -r * 0.5],
    [0, 0, r * 0.52, r * 0.38],
    [0, 0, -r * 0.38, r * 0.5],
    [-r * 0.55, -r * 0.42, -r * 0.7, -r * 0.62],
  ];
  for (const [x1, y1, x2, y2] of cracks) {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }

  // Highlight
  ctx.beginPath();
  ctx.moveTo(-r * 0.58, -r * 0.82);
  ctx.lineTo(r * 0.4, -r * 0.94);
  ctx.lineTo(0, -r * 0.3);
  ctx.closePath();
  ctx.fillStyle = 'rgba(80,70,70,0.7)';
  ctx.fill();

  ctx.restore();
}

// ─────────────────────────────────────────────────────────────────────────────
// VARIANT D — Round Pebble Stack  (3 smooth rounded stones stacked)
// ─────────────────────────────────────────────────────────────────────────────
export function renderRockPebbles(
  ctx: CanvasRenderingContext2D,
  ox: number,
  oy: number,
  radius: number
) {
  const r = radius || 34;
  ctx.save();
  ctx.translate(ox, oy);

  // Bottom pebble (largest)
  const bg = ctx.createRadialGradient(-r * 0.2, -r * 0.2, r * 0.05, 0, r * 0.1, r);
  bg.addColorStop(0, '#9E9E9E');
  bg.addColorStop(0.6, '#757575');
  bg.addColorStop(1, '#424242');
  ctx.beginPath();
  ctx.ellipse(0, r * 0.42, r * 0.92, r * 0.52, 0, 0, Math.PI * 2);
  ctx.fillStyle = bg;
  ctx.fill();

  // Middle pebble
  const mg = ctx.createRadialGradient(-r * 0.15, -r * 0.15, r * 0.03, r * 0.1, r * 0.05, r * 0.62);
  mg.addColorStop(0, '#BDBDBD');
  mg.addColorStop(0.6, '#9E9E9E');
  mg.addColorStop(1, '#616161');
  ctx.beginPath();
  ctx.ellipse(-r * 0.12, r * 0.0, r * 0.64, r * 0.44, 0.15, 0, Math.PI * 2);
  ctx.fillStyle = mg;
  ctx.fill();

  // Top pebble (smallest)
  const tg = ctx.createRadialGradient(-r * 0.12, -r * 0.12, r * 0.02, r * 0.05, r * 0.02, r * 0.42);
  tg.addColorStop(0, '#E0E0E0');
  tg.addColorStop(0.5, '#BDBDBD');
  tg.addColorStop(1, '#757575');
  ctx.beginPath();
  ctx.ellipse(r * 0.08, -r * 0.42, r * 0.38, r * 0.34, -0.1, 0, Math.PI * 2);
  ctx.fillStyle = tg;
  ctx.fill();

  // Highlights on each
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.beginPath(); ctx.ellipse(-r * 0.28, r * 0.18, r * 0.25, r * 0.1, -0.5, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(-r * 0.22, -r * 0.18, r * 0.18, r * 0.08, -0.5, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(-r * 0.04, -r * 0.54, r * 0.12, r * 0.06, -0.5, 0, Math.PI * 2); ctx.fill();

  ctx.restore();
}
