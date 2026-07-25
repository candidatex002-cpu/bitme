/**
 * 🪨 CAVE — Alternative Design Variants
 *
 * Current live design: renderCaveAsset  (in ../../objects.ts)
 *
 * HOW TO SWAP:
 *   In ../../objects.ts change:
 *     export { renderCaveSpooky as renderCaveAsset } from './designs/objects/cave.js';
 */

// ─────────────────────────────────────────────────────────────────────────────
// VARIANT A — Spooky Halloween Cave  (orange glow, bats, cobwebs)
// ─────────────────────────────────────────────────────────────────────────────
export function renderCaveSpooky(
  ctx: CanvasRenderingContext2D,
  ox: number,
  oy: number,
  radius: number,
  animFrame: number
) {
  const r = radius || 58;
  const t = animFrame * 0.05;
  ctx.save();
  ctx.translate(ox, oy);

  // Jagged rocky mound
  ctx.beginPath();
  ctx.moveTo(-r * 1.3, r * 0.5);
  ctx.bezierCurveTo(-r * 1.3, -r * 0.3, -r * 0.8, -r * 1.1, 0, -r * 1.05);
  ctx.bezierCurveTo(r * 0.8, -r * 1.1, r * 1.3, -r * 0.3, r * 1.3, r * 0.5);
  ctx.closePath();
  ctx.fillStyle = '#4A4A4A';
  ctx.fill();

  // Rocky highlight facets
  ctx.fillStyle = '#686868';
  ctx.beginPath();
  ctx.moveTo(-r * 0.6, -r * 0.8);
  ctx.lineTo(r * 0.2, -r * 1.0);
  ctx.lineTo(0, -r * 0.4);
  ctx.closePath();
  ctx.fill();

  // Cave mouth
  ctx.beginPath();
  ctx.ellipse(0, r * 0.1, r * 0.72, r * 0.58, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#0A0A0F';
  ctx.fill();

  // Orange glow from inside
  const glow = ctx.createRadialGradient(0, r * 0.3, r * 0.05, 0, r * 0.1, r * 0.6);
  glow.addColorStop(0, 'rgba(255,120,0,0.65)');
  glow.addColorStop(0.5, 'rgba(200,60,0,0.25)');
  glow.addColorStop(1, 'rgba(100,0,0,0)');
  ctx.beginPath();
  ctx.ellipse(0, r * 0.1, r * 0.68, r * 0.54, 0, 0, Math.PI * 2);
  ctx.fillStyle = glow;
  ctx.fill();

  // Stalactites
  ctx.fillStyle = '#333';
  const stals = [-r * 0.42, -r * 0.18, 0, r * 0.22, r * 0.46];
  stals.forEach((sx, i) => {
    const h = (i % 2 === 0 ? 0.38 : 0.52) * r;
    ctx.beginPath();
    ctx.moveTo(sx - 5, -r * 0.18);
    ctx.lineTo(sx + 5, -r * 0.18);
    ctx.lineTo(sx, -r * 0.18 + h);
    ctx.closePath();
    ctx.fill();
  });

  // Bats (simple V shapes)
  ctx.strokeStyle = '#1A1A2E';
  ctx.lineWidth = 2;
  const batPos = [[-r * 0.55, -r * 0.6], [r * 0.5, -r * 0.75], [0, -r * 0.52]];
  for (const [bx, by] of batPos) {
    const wing = Math.sin(t + bx) * 4;
    ctx.beginPath();
    ctx.moveTo(bx - 10, by + wing);
    ctx.lineTo(bx, by - 4);
    ctx.lineTo(bx + 10, by + wing);
    ctx.stroke();
    ctx.fillStyle = '#1A1A2E';
    ctx.beginPath();
    ctx.arc(bx, by - 4, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  // Cobweb corner
  ctx.strokeStyle = 'rgba(200,200,200,0.45)';
  ctx.lineWidth = 0.8;
  for (let i = 0; i < 5; i++) {
    ctx.beginPath();
    ctx.moveTo(-r * 1.1, -r * 0.85);
    ctx.lineTo(-r * 1.1 + i * 12, -r * 0.85 + i * 10);
    ctx.stroke();
  }

  ctx.restore();
}

// ─────────────────────────────────────────────────────────────────────────────
// VARIANT B — Crystal Cave  (glowing gemstones, purple-blue tones)
// ─────────────────────────────────────────────────────────────────────────────
export function renderCaveCrystal(
  ctx: CanvasRenderingContext2D,
  ox: number,
  oy: number,
  radius: number,
  animFrame: number
) {
  const r = radius || 58;
  const t = animFrame * 0.04;
  ctx.save();
  ctx.translate(ox, oy);

  // Rock base
  ctx.beginPath();
  ctx.ellipse(0, 0, r * 1.3, r * 0.95, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#37474F';
  ctx.fill();

  ctx.beginPath();
  ctx.ellipse(0, -r * 0.32, r * 1.15, r * 0.5, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#546E7A';
  ctx.fill();

  // Cave mouth
  ctx.beginPath();
  ctx.ellipse(0, r * 0.1, r * 0.75, r * 0.6, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#0D0020';
  ctx.fill();

  // Crystal glow
  const cg = ctx.createRadialGradient(0, r * 0.15, r * 0.05, 0, r * 0.1, r * 0.55);
  cg.addColorStop(0, 'rgba(149,0,255,0.7)');
  cg.addColorStop(0.5, 'rgba(76,0,200,0.3)');
  cg.addColorStop(1, 'rgba(0,0,100,0)');
  ctx.fillStyle = cg;
  ctx.beginPath();
  ctx.ellipse(0, r * 0.1, r * 0.72, r * 0.57, 0, 0, Math.PI * 2);
  ctx.fill();

  // Crystals — diamond shapes
  const crystalData = [
    { x: -r * 0.35, y: -r * 0.05, h: r * 0.42, color: '#CE93D8' },
    { x: r * 0.3, y: -r * 0.1, h: r * 0.36, color: '#80DEEA' },
    { x: 0, y: r * 0.08, h: r * 0.32, color: '#B39DDB' },
    { x: -r * 0.58, y: r * 0.18, h: r * 0.28, color: '#F48FB1' },
    { x: r * 0.52, y: r * 0.22, h: r * 0.3, color: '#80CBC4' },
  ];
  for (const cd of crystalData) {
    const pulse = Math.sin(t * 1.5 + cd.x) * 0.15 + 0.85;
    ctx.globalAlpha = pulse;
    ctx.fillStyle = cd.color;
    ctx.beginPath();
    ctx.moveTo(cd.x, cd.y - cd.h);
    ctx.lineTo(cd.x + 7, cd.y);
    ctx.lineTo(cd.x, cd.y + cd.h * 0.5);
    ctx.lineTo(cd.x - 7, cd.y);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.beginPath();
    ctx.moveTo(cd.x - 2, cd.y - cd.h);
    ctx.lineTo(cd.x, cd.y);
    ctx.lineTo(cd.x - 5, cd.y - cd.h * 0.4);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  ctx.restore();
}

// ─────────────────────────────────────────────────────────────────────────────
// VARIANT C — Ancient Ruins Cave  (stone bricks, vines, warm torch glow)
// ─────────────────────────────────────────────────────────────────────────────
export function renderCaveRuins(
  ctx: CanvasRenderingContext2D,
  ox: number,
  oy: number,
  radius: number,
  animFrame: number
) {
  const r = radius || 58;
  const flicker = Math.sin(animFrame * 0.18) * 0.08 + 0.92;
  ctx.save();
  ctx.translate(ox, oy);

  // Stone mound
  ctx.beginPath();
  ctx.ellipse(0, 0, r * 1.3, r * 0.95, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#8D6E63';
  ctx.fill();

  // Stone brick texture (grid lines)
  ctx.strokeStyle = 'rgba(60,40,30,0.35)';
  ctx.lineWidth = 1.2;
  for (let row = -3; row <= 3; row++) {
    const y = row * r * 0.28;
    ctx.beginPath();
    ctx.moveTo(-r * 1.25, y);
    ctx.lineTo(r * 1.25, y);
    ctx.stroke();
  }
  for (let col = -4; col <= 4; col++) {
    ctx.beginPath();
    ctx.moveTo(col * r * 0.32, -r * 0.95);
    ctx.lineTo(col * r * 0.32, r * 0.95);
    ctx.stroke();
  }

  // Arch / cave entrance
  ctx.beginPath();
  ctx.moveTo(-r * 0.65, r * 0.5);
  ctx.lineTo(-r * 0.65, r * 0.05);
  ctx.arc(0, r * 0.05, r * 0.65, Math.PI, 0);
  ctx.lineTo(r * 0.65, r * 0.5);
  ctx.closePath();
  ctx.fillStyle = '#1A0A00';
  ctx.fill();

  // Torch glow
  ctx.globalAlpha = flicker;
  const tg = ctx.createRadialGradient(0, r * 0.25, r * 0.02, 0, r * 0.1, r * 0.5);
  tg.addColorStop(0, 'rgba(255,160,0,0.7)');
  tg.addColorStop(0.6, 'rgba(200,80,0,0.2)');
  tg.addColorStop(1, 'rgba(100,0,0,0)');
  ctx.fillStyle = tg;
  ctx.beginPath();
  ctx.arc(0, r * 0.1, r * 0.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  // Hanging vines
  ctx.strokeStyle = '#2E7D32';
  ctx.lineWidth = 2;
  const vineX = [-r * 0.5, -r * 0.15, r * 0.2, r * 0.52];
  for (const vx of vineX) {
    const len = r * 0.28 + Math.abs(vx) * 0.1;
    ctx.beginPath();
    ctx.moveTo(vx, -r * 0.82);
    ctx.quadraticCurveTo(vx + 6, -r * 0.82 + len * 0.5, vx - 4, -r * 0.82 + len);
    ctx.stroke();
    ctx.fillStyle = '#388E3C';
    ctx.beginPath();
    ctx.ellipse(vx - 4, -r * 0.82 + len, 5, 4, 0.3, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

// ─────────────────────────────────────────────────────────────────────────────
// VARIANT D — Minimal Cave  (clean flat rock, simple arch)
// ─────────────────────────────────────────────────────────────────────────────
export function renderCaveMinimal(
  ctx: CanvasRenderingContext2D,
  ox: number,
  oy: number,
  radius: number,
  _animFrame: number
) {
  const r = radius || 58;
  ctx.save();
  ctx.translate(ox, oy);

  // Rock mound
  ctx.beginPath();
  ctx.ellipse(0, 0, r * 1.28, r * 0.94, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#78909C';
  ctx.fill();

  // Light face highlight
  ctx.beginPath();
  ctx.ellipse(-r * 0.15, -r * 0.28, r * 0.8, r * 0.38, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#90A4AE';
  ctx.fill();

  // Cave entrance
  ctx.beginPath();
  ctx.moveTo(-r * 0.6, r * 0.5);
  ctx.lineTo(-r * 0.6, 0);
  ctx.arc(0, 0, r * 0.6, Math.PI, 0);
  ctx.lineTo(r * 0.6, r * 0.5);
  ctx.closePath();
  ctx.fillStyle = '#1C1C2E';
  ctx.fill();

  // Soft ambient light
  const ag = ctx.createRadialGradient(0, r * 0.2, r * 0.05, 0, 0, r * 0.55);
  ag.addColorStop(0, 'rgba(100,180,255,0.28)');
  ag.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = ag;
  ctx.beginPath();
  ctx.arc(0, r * 0.1, r * 0.55, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}
