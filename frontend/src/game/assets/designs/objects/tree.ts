/**
 * 🌲 TREE — Alternative Design Variants
 *
 * Current live design: renderTreeAsset  (in ../../objects.ts)
 *
 * HOW TO SWAP:
 *   In ../../objects.ts change the export line to e.g.:
 *     export { renderTreeAutumn as renderTreeAsset } from './designs/objects/tree.js';
 */

// ─────────────────────────────────────────────────────────────────────────────
// VARIANT A — Autumn Tree  (orange/red leaves, bare look)
// ─────────────────────────────────────────────────────────────────────────────
export function renderTreeAutumn(
  ctx: CanvasRenderingContext2D,
  ox: number,
  oy: number,
  radius: number
) {
  const r = radius || 44;
  ctx.save();
  ctx.translate(ox, oy);

  // Trunk
  const tg = ctx.createLinearGradient(-r * 0.12, 0, r * 0.12, 0);
  tg.addColorStop(0, '#5D4037');
  tg.addColorStop(0.5, '#795548');
  tg.addColorStop(1, '#4E342E');
  ctx.beginPath();
  ctx.roundRect(-r * 0.1, r * 0.2, r * 0.2, r * 0.5, 4);
  ctx.fillStyle = tg;
  ctx.fill();

  // Root flare
  ctx.beginPath();
  ctx.ellipse(0, r * 0.7, r * 0.3, r * 0.08, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#4E342E';
  ctx.fill();

  // Branches
  ctx.strokeStyle = '#5D4037';
  ctx.lineWidth = r * 0.08;
  ctx.lineCap = 'round';
  const branches = [
    [0, r * 0.15, -r * 0.55, -r * 0.22],
    [0, r * 0.15, r * 0.5, -r * 0.28],
    [0, 0, 0, -r * 0.6],
    [-r * 0.55, -r * 0.22, -r * 0.72, -r * 0.55],
    [r * 0.5, -r * 0.28, r * 0.68, -r * 0.55],
  ];
  for (const [x1, y1, x2, y2] of branches) {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.quadraticCurveTo((x1 + x2) / 2, (y1 + y2) / 2 - 5, x2, y2);
    ctx.stroke();
  }

  // Leaf clusters — autumn palette
  const clusters = [
    { x: -r * 0.5, y: -r * 0.35, size: r * 0.48, dark: '#C62828', mid: '#E53935', light: '#FF8A65' },
    { x: r * 0.42, y: -r * 0.38, size: r * 0.44, dark: '#E65100', mid: '#FF6D00', light: '#FFB74D' },
    { x: 0, y: -r * 0.6, size: r * 0.5, dark: '#BF360C', mid: '#FF5722', light: '#FFAB40' },
    { x: -r * 0.62, y: -r * 0.55, size: r * 0.36, dark: '#880E4F', mid: '#AD1457', light: '#F48FB1' },
    { x: r * 0.6, y: -r * 0.5, size: r * 0.38, dark: '#827717', mid: '#F9A825', light: '#FFE082' },
  ];
  for (const c of clusters) {
    ctx.beginPath(); ctx.arc(c.x, c.y, c.size, 0, Math.PI * 2); ctx.fillStyle = c.dark; ctx.fill();
    ctx.beginPath(); ctx.arc(c.x - c.size * 0.1, c.y - c.size * 0.1, c.size * 0.82, 0, Math.PI * 2); ctx.fillStyle = c.mid; ctx.fill();
    ctx.beginPath(); ctx.arc(c.x - c.size * 0.2, c.y - c.size * 0.22, c.size * 0.58, 0, Math.PI * 2); ctx.fillStyle = c.light; ctx.fill();
  }

  ctx.restore();
}

// ─────────────────────────────────────────────────────────────────────────────
// VARIANT B — Sakura Cherry Blossom Tree  (pink flowers, bare branches)
// ─────────────────────────────────────────────────────────────────────────────
export function renderTreeSakura(
  ctx: CanvasRenderingContext2D,
  ox: number,
  oy: number,
  radius: number
) {
  const r = radius || 44;
  ctx.save();
  ctx.translate(ox, oy);

  // Trunk
  ctx.beginPath();
  ctx.roundRect(-r * 0.09, r * 0.18, r * 0.18, r * 0.52, 4);
  ctx.fillStyle = '#795548';
  ctx.fill();

  // Thin gnarled branches
  ctx.strokeStyle = '#8D6E63';
  ctx.lineWidth = r * 0.055;
  ctx.lineCap = 'round';
  const branches = [
    [0, r * 0.12, -r * 0.62, -r * 0.38],
    [0, r * 0.12, r * 0.58, -r * 0.42],
    [0, -r * 0.05, 0, -r * 0.72],
    [-r * 0.62, -r * 0.38, -r * 0.82, -r * 0.68],
    [r * 0.58, -r * 0.42, r * 0.78, -r * 0.65],
    [0, -r * 0.72, -r * 0.28, -r * 1.0],
    [0, -r * 0.72, r * 0.32, -r * 1.02],
  ];
  for (const [x1, y1, x2, y2] of branches) {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.quadraticCurveTo((x1 + x2) / 2 + 5, (y1 + y2) / 2, x2, y2);
    ctx.stroke();
  }

  // Blossom clusters (light pink petals)
  const blossoms = [
    { x: -r * 0.62, y: -r * 0.45, r: r * 0.42 },
    { x: r * 0.58, y: -r * 0.48, r: r * 0.4 },
    { x: 0, y: -r * 0.82, r: r * 0.44 },
    { x: -r * 0.28, y: -r * 1.05, r: r * 0.32 },
    { x: r * 0.32, y: -r * 1.05, r: r * 0.3 },
    { x: 0, y: -r * 0.45, r: r * 0.36 },
  ];
  for (const b of blossoms) {
    ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
    ctx.fillStyle = '#F8BBD9'; ctx.fill();
    ctx.beginPath(); ctx.arc(b.x - b.r * 0.1, b.y - b.r * 0.1, b.r * 0.75, 0, Math.PI * 2);
    ctx.fillStyle = '#F48FB1'; ctx.fill();
    ctx.beginPath(); ctx.arc(b.x - b.r * 0.18, b.y - b.r * 0.2, b.r * 0.5, 0, Math.PI * 2);
    ctx.fillStyle = '#F06292'; ctx.fill();
  }

  // Falling petals (static positions seeded by ox)
  ctx.fillStyle = 'rgba(240,130,180,0.65)';
  const seed = ox * 0.01;
  for (let i = 0; i < 5; i++) {
    const px = Math.sin(seed + i * 2.1) * r * 0.9;
    const py = (i - 2) * r * 0.28 - r * 0.3;
    ctx.beginPath();
    ctx.ellipse(px, py, 4, 3, i * 0.8, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

// ─────────────────────────────────────────────────────────────────────────────
// VARIANT C — Palm Tree  (tropical, coconuts, tall slender trunk)
// ─────────────────────────────────────────────────────────────────────────────
export function renderTreePalm(
  ctx: CanvasRenderingContext2D,
  ox: number,
  oy: number,
  radius: number
) {
  const r = radius || 44;
  ctx.save();
  ctx.translate(ox, oy);

  // Curved trunk
  ctx.strokeStyle = '#8D6E63';
  ctx.lineWidth = r * 0.18;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(0, r * 0.75);
  ctx.bezierCurveTo(r * 0.12, r * 0.4, -r * 0.1, -r * 0.2, r * 0.08, -r * 0.75);
  ctx.stroke();

  // Trunk texture rings
  ctx.strokeStyle = '#6D4C41';
  ctx.lineWidth = 1.2;
  for (let i = 0; i < 6; i++) {
    const ty = r * (0.6 - i * 0.22);
    ctx.beginPath();
    ctx.ellipse(i * 0.015 * r, ty, r * 0.09, r * 0.03, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Palm fronds (long curved leaves)
  const fronds = [0, Math.PI / 3, (2 * Math.PI) / 3, Math.PI, (4 * Math.PI) / 3, (5 * Math.PI) / 3];
  for (const fa of fronds) {
    const fx = Math.cos(fa) * r * 0.85;
    const fy = Math.sin(fa) * r * 0.55 - r * 0.75;
    ctx.strokeStyle = '#33691E';
    ctx.lineWidth = r * 0.07;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(r * 0.08, -r * 0.75);
    ctx.quadraticCurveTo(r * 0.08 + fx * 0.5, -r * 0.75 + fy * 0.5 - r * 0.2, r * 0.08 + fx, -r * 0.75 + fy);
    ctx.stroke();
    // Leaflets
    ctx.strokeStyle = '#558B2F';
    ctx.lineWidth = r * 0.03;
    for (let l = 0; l < 4; l++) {
      const t = (l + 1) / 5;
      const lx = r * 0.08 + fx * t;
      const ly = -r * 0.75 + fy * t - r * 0.2 * (1 - t);
      const perp = fa + Math.PI / 2;
      ctx.beginPath();
      ctx.moveTo(lx, ly);
      ctx.lineTo(lx + Math.cos(perp) * r * 0.25, ly + Math.sin(perp) * r * 0.18);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(lx, ly);
      ctx.lineTo(lx - Math.cos(perp) * r * 0.25, ly - Math.sin(perp) * r * 0.18);
      ctx.stroke();
    }
  }

  // Coconuts
  ctx.fillStyle = '#5D4037';
  for (let i = 0; i < 3; i++) {
    const ca = (i * Math.PI * 2) / 3 + 0.4;
    ctx.beginPath();
    ctx.arc(r * 0.08 + Math.cos(ca) * r * 0.16, -r * 0.75 + Math.sin(ca) * r * 0.1, r * 0.1, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

// ─────────────────────────────────────────────────────────────────────────────
// VARIANT D — Pine / Fir Tree  (triangular, classic Christmas tree shape)
// ─────────────────────────────────────────────────────────────────────────────
export function renderTreePine(
  ctx: CanvasRenderingContext2D,
  ox: number,
  oy: number,
  radius: number
) {
  const r = radius || 44;
  ctx.save();
  ctx.translate(ox, oy);

  // Trunk
  ctx.fillStyle = '#795548';
  ctx.fillRect(-r * 0.1, r * 0.3, r * 0.2, r * 0.45);

  // Pine layers (stacked triangles)
  const layers = [
    { y: r * 0.32, w: r * 1.1, h: r * 0.52, dark: '#1B5E20', mid: '#388E3C', light: '#66BB6A' },
    { y: r * 0.0, w: r * 0.88, h: r * 0.48, dark: '#1B5E20', mid: '#2E7D32', light: '#4CAF50' },
    { y: -r * 0.28, w: r * 0.68, h: r * 0.42, dark: '#1B5E20', mid: '#388E3C', light: '#81C784' },
    { y: -r * 0.55, w: r * 0.48, h: r * 0.38, dark: '#1B5E20', mid: '#2E7D32', light: '#A5D6A7' },
  ];

  for (const l of layers) {
    // Shadow layer
    ctx.beginPath();
    ctx.moveTo(0, l.y - l.h);
    ctx.lineTo(l.w / 2, l.y + l.h * 0.25);
    ctx.lineTo(-l.w / 2, l.y + l.h * 0.25);
    ctx.closePath();
    ctx.fillStyle = l.dark;
    ctx.fill();
    // Mid
    ctx.beginPath();
    ctx.moveTo(-l.w * 0.08, l.y - l.h);
    ctx.lineTo(l.w * 0.38, l.y + l.h * 0.25);
    ctx.lineTo(-l.w / 2, l.y + l.h * 0.25);
    ctx.closePath();
    ctx.fillStyle = l.mid;
    ctx.fill();
    // Highlight
    ctx.beginPath();
    ctx.moveTo(-l.w * 0.08, l.y - l.h);
    ctx.lineTo(-l.w * 0.45, l.y + l.h * 0.25);
    ctx.lineTo(-l.w * 0.1, l.y + l.h * 0.1);
    ctx.closePath();
    ctx.fillStyle = l.light;
    ctx.fill();
  }

  // Star on top
  ctx.fillStyle = '#FDD835';
  ctx.beginPath();
  const starY = -r * 0.9;
  for (let i = 0; i < 5; i++) {
    const a = (i * Math.PI * 2) / 5 - Math.PI / 2;
    const ia = a + Math.PI / 5;
    if (i === 0) ctx.moveTo(Math.cos(a) * r * 0.12, starY + Math.sin(a) * r * 0.12);
    else ctx.lineTo(Math.cos(a) * r * 0.12, starY + Math.sin(a) * r * 0.12);
    ctx.lineTo(Math.cos(ia) * r * 0.05, starY + Math.sin(ia) * r * 0.05);
  }
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}
