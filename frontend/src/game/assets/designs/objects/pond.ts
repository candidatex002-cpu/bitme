/**
 * 🌊 POND — Alternative Design Variants
 *
 * Current live design: renderPondAsset  (in ../../objects.ts)
 *
 * HOW TO SWAP:
 *   In ../../objects.ts change export line to e.g.:
 *     export { renderPondNeon as renderPondAsset } from './designs/objects/pond.js';
 */

// ─────────────────────────────────────────────────────────────────────────────
// VARIANT A — Natural Forest Pond  (mossy stones, lily pads, soft water)
// ─────────────────────────────────────────────────────────────────────────────
export function renderPondNatural(
  ctx: CanvasRenderingContext2D,
  ox: number,
  oy: number,
  radius: number,
  animFrame: number
) {
  const r = radius || 52;
  const t = animFrame * 0.035;
  ctx.save();
  ctx.translate(ox, oy);

  // Mossy ground rim
  ctx.beginPath();
  ctx.ellipse(0, 0, r * 1.32, r * 1.0, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#33691E';
  ctx.fill();

  // Sandy / earthy bank
  ctx.beginPath();
  ctx.ellipse(0, 0, r * 1.15, r * 0.87, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#8D6E63';
  ctx.fill();

  // Water — deep blue-green
  ctx.beginPath();
  ctx.ellipse(0, 0, r * 0.98, r * 0.74, 0, 0, Math.PI * 2);
  const wg = ctx.createRadialGradient(0, -r * 0.2, r * 0.1, 0, 0, r);
  wg.addColorStop(0, '#4DD0E1');
  wg.addColorStop(0.55, '#00838F');
  wg.addColorStop(1, '#004D40');
  ctx.fillStyle = wg;
  ctx.fill();

  // Ripples
  for (let i = 0; i < 3; i++) {
    const rw = r * (0.28 + i * 0.18);
    ctx.beginPath();
    ctx.ellipse(Math.sin(t + i * 1.2) * r * 0.1, Math.cos(t * 0.8 + i) * r * 0.08, rw, rw * 0.55, t * 0.2, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(255,255,255,${0.22 - i * 0.06})`;
    ctx.lineWidth = 1.4;
    ctx.stroke();
  }

  // Lily pads
  const lilyPos = [[-r * 0.38, -r * 0.18], [r * 0.3, r * 0.28], [r * 0.08, -r * 0.42]];
  for (const [lx, ly] of lilyPos) {
    ctx.fillStyle = '#558B2F';
    ctx.beginPath();
    ctx.moveTo(lx, ly);
    ctx.arc(lx, ly, r * 0.16, 0.3, Math.PI * 2 - 0.3);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#FF80AB';
    ctx.beginPath();
    ctx.arc(lx, ly - r * 0.05, r * 0.06, 0, Math.PI * 2);
    ctx.fill();
  }

  // Reed tufts at edge
  ctx.fillStyle = '#4E342E';
  for (let a = 0; a < Math.PI * 2; a += Math.PI * 0.55) {
    const rx = Math.cos(a) * r * 1.0;
    const ry = Math.sin(a) * r * 0.76;
    ctx.fillRect(rx - 1.5, ry - r * 0.18, 3, r * 0.18);
    ctx.beginPath();
    ctx.ellipse(rx, ry - r * 0.18, 4, 9, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#6D4C41';
    ctx.fill();
    ctx.fillStyle = '#4E342E';
  }

  ctx.restore();
}

// ─────────────────────────────────────────────────────────────────────────────
// VARIANT B — Neon Cyberpunk Pond  (glowing neon rings, dark water)
// ─────────────────────────────────────────────────────────────────────────────
export function renderPondNeon(
  ctx: CanvasRenderingContext2D,
  ox: number,
  oy: number,
  radius: number,
  animFrame: number
) {
  const r = radius || 52;
  const t = animFrame * 0.06;
  ctx.save();
  ctx.translate(ox, oy);

  // Dark outer ring
  ctx.beginPath();
  ctx.ellipse(0, 0, r * 1.28, r * 0.96, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#0D0D1A';
  ctx.fill();

  // Dark water
  ctx.beginPath();
  ctx.ellipse(0, 0, r * 0.98, r * 0.74, 0, 0, Math.PI * 2);
  const dg = ctx.createRadialGradient(0, 0, r * 0.1, 0, 0, r);
  dg.addColorStop(0, '#1A0533');
  dg.addColorStop(0.7, '#0A001A');
  dg.addColorStop(1, '#000010');
  ctx.fillStyle = dg;
  ctx.fill();

  // Neon rings
  const neonColors = ['#00FFFF', '#FF00FF', '#00FF88'];
  for (let i = 0; i < 3; i++) {
    const rRing = r * (0.38 + i * 0.18) + Math.sin(t + i * 1.2) * 3;
    ctx.beginPath();
    ctx.ellipse(0, 0, rRing, rRing * 0.6, 0, 0, Math.PI * 2);
    ctx.strokeStyle = neonColors[i];
    ctx.lineWidth = 1.5;
    ctx.shadowBlur = 10;
    ctx.shadowColor = neonColors[i];
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  // Glowing core orb
  const cg = ctx.createRadialGradient(0, 0, 2, 0, 0, r * 0.3);
  cg.addColorStop(0, 'rgba(0,255,255,0.95)');
  cg.addColorStop(0.5, 'rgba(0,100,200,0.5)');
  cg.addColorStop(1, 'rgba(0,0,100,0)');
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.3, 0, Math.PI * 2);
  ctx.fillStyle = cg;
  ctx.fill();

  // Orbiting dots
  for (let i = 0; i < 6; i++) {
    const a = t * 1.2 + (i * Math.PI * 2) / 6;
    const dx = Math.cos(a) * r * 0.55;
    const dy = Math.sin(a) * r * 0.38;
    ctx.beginPath();
    ctx.arc(dx, dy, 3, 0, Math.PI * 2);
    ctx.fillStyle = '#00FFFF';
    ctx.shadowBlur = 8;
    ctx.shadowColor = '#00FFFF';
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  ctx.restore();
}

// ─────────────────────────────────────────────────────────────────────────────
// VARIANT C — Icy Frozen Pond  (cracked ice, snowflakes, cold colours)
// ─────────────────────────────────────────────────────────────────────────────
export function renderPondIcy(
  ctx: CanvasRenderingContext2D,
  ox: number,
  oy: number,
  radius: number,
  animFrame: number
) {
  const r = radius || 52;
  ctx.save();
  ctx.translate(ox, oy);

  // Snow bank
  ctx.beginPath();
  ctx.ellipse(0, 0, r * 1.3, r * 0.98, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#E3F2FD';
  ctx.fill();

  // Ice surface
  ctx.beginPath();
  ctx.ellipse(0, 0, r * 1.05, r * 0.78, 0, 0, Math.PI * 2);
  const ig = ctx.createRadialGradient(0, -r * 0.2, r * 0.05, 0, 0, r);
  ig.addColorStop(0, '#E1F5FE');
  ig.addColorStop(0.5, '#B3E5FC');
  ig.addColorStop(1, '#4FC3F7');
  ctx.fillStyle = ig;
  ctx.fill();

  // Ice crack lines
  ctx.strokeStyle = 'rgba(144,202,249,0.7)';
  ctx.lineWidth = 1.5;
  const cracks = [
    [0, 0, -r * 0.6, -r * 0.3],
    [0, 0, r * 0.5, -r * 0.45],
    [0, 0, r * 0.6, r * 0.35],
    [0, 0, -r * 0.4, r * 0.55],
    [-r * 0.6, -r * 0.3, -r * 0.8, r * 0.1],
  ];
  for (const [x1, y1, x2, y2] of cracks) {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }

  // Snow dusting on rim
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  for (let a = 0; a < Math.PI * 2; a += Math.PI / 8) {
    const sx = Math.cos(a) * r * 1.12;
    const sy = Math.sin(a) * r * 0.84;
    ctx.beginPath();
    ctx.arc(sx, sy, r * 0.09, 0, Math.PI * 2);
    ctx.fill();
  }

  // Snowflake emoji on surface
  ctx.font = `${r * 0.28}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('❄️', -r * 0.3, -r * 0.2);
  ctx.fillText('❄️', r * 0.32, r * 0.15);

  ctx.restore();
}

// ─────────────────────────────────────────────────────────────────────────────
// VARIANT D — Minimalist Pond  (flat design, clean shapes, pastel)
// ─────────────────────────────────────────────────────────────────────────────
export function renderPondMinimal(
  ctx: CanvasRenderingContext2D,
  ox: number,
  oy: number,
  radius: number,
  _animFrame: number
) {
  const r = radius || 52;
  ctx.save();
  ctx.translate(ox, oy);

  // Outer ring (flat colour)
  ctx.beginPath();
  ctx.ellipse(0, 0, r * 1.25, r * 0.94, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#A5D6A7';
  ctx.fill();

  // Water body (flat)
  ctx.beginPath();
  ctx.ellipse(0, 0, r * 0.95, r * 0.72, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#81D4FA';
  ctx.fill();

  // Simple wave stripes
  ctx.strokeStyle = 'rgba(255,255,255,0.55)';
  ctx.lineWidth = 2.5;
  ctx.lineCap = 'round';
  for (let i = -1; i <= 1; i++) {
    ctx.beginPath();
    ctx.moveTo(-r * 0.55, i * r * 0.22);
    ctx.quadraticCurveTo(0, i * r * 0.22 - r * 0.1, r * 0.55, i * r * 0.22);
    ctx.stroke();
  }

  // Lily pad (flat circle + slot)
  ctx.fillStyle = '#66BB6A';
  ctx.beginPath();
  ctx.moveTo(r * 0.22, r * 0.18);
  ctx.arc(r * 0.22, r * 0.18, r * 0.18, 0.4, Math.PI * 2 - 0.4);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}
