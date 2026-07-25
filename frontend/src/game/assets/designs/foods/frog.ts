/**
 * 🐸 FROG — Alternative Design Variants
 *
 * Current live design: renderFrogAsset  (in ../foods.ts)
 *
 * HOW TO SWAP:
 *   In ../foods.ts change the export line to:
 *     export { renderFrogCartoon as renderFrogAsset } from './designs/foods/frog.js';
 */

// ─────────────────────────────────────────────────────────────────────────────
// VARIANT A — Cartoon Chibi Frog  (rounder, more expressive)
// ─────────────────────────────────────────────────────────────────────────────
export function renderFrogCartoon(
  ctx: CanvasRenderingContext2D,
  fx: number,
  fy0: number,
  animFrame: number
) {
  const s = 20;
  const bob = Math.sin(animFrame * 0.07) * 3;
  const py = fy0 + bob;

  ctx.save();
  ctx.translate(fx, py);

  // Shadow
  ctx.beginPath();
  ctx.ellipse(0, s * 0.9, s * 0.7, s * 0.18, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.fill();

  // Hind legs
  ctx.fillStyle = '#4CAF50';
  ctx.beginPath();
  ctx.ellipse(-s * 0.9, s * 0.55, s * 0.55, s * 0.28, -0.5, 0, Math.PI * 2);
  ctx.ellipse(s * 0.9, s * 0.55, s * 0.55, s * 0.28, 0.5, 0, Math.PI * 2);
  ctx.fill();

  // Body
  ctx.beginPath();
  ctx.ellipse(0, s * 0.12, s * 0.82, s * 0.72, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#66BB6A';
  ctx.fill();

  // Belly
  ctx.beginPath();
  ctx.ellipse(0, s * 0.3, s * 0.52, s * 0.44, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#E8F5E9';
  ctx.fill();

  // Eye bumps
  ctx.fillStyle = '#4CAF50';
  ctx.beginPath();
  ctx.arc(-s * 0.38, -s * 0.55, s * 0.38, 0, Math.PI * 2);
  ctx.arc(s * 0.38, -s * 0.55, s * 0.38, 0, Math.PI * 2);
  ctx.fill();

  // Eyes white
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(-s * 0.38, -s * 0.6, s * 0.28, 0, Math.PI * 2);
  ctx.arc(s * 0.38, -s * 0.6, s * 0.28, 0, Math.PI * 2);
  ctx.fill();

  // Pupils
  ctx.fillStyle = '#1B2B1B';
  ctx.beginPath();
  ctx.arc(-s * 0.34, -s * 0.6, s * 0.16, 0, Math.PI * 2);
  ctx.arc(s * 0.42, -s * 0.6, s * 0.16, 0, Math.PI * 2);
  ctx.fill();

  // Shine dots
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(-s * 0.28, -s * 0.67, s * 0.07, 0, Math.PI * 2);
  ctx.arc(s * 0.48, -s * 0.67, s * 0.07, 0, Math.PI * 2);
  ctx.fill();

  // Smile
  ctx.strokeStyle = '#2E7D32';
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.arc(0, s * 0.05, s * 0.35, 0.3, Math.PI - 0.3);
  ctx.stroke();

  ctx.restore();
}

// ─────────────────────────────────────────────────────────────────────────────
// VARIANT B — Pixel / Retro Frog  (blocky 8-bit style)
// ─────────────────────────────────────────────────────────────────────────────
export function renderFrogPixel(
  ctx: CanvasRenderingContext2D,
  fx: number,
  fy0: number,
  animFrame: number
) {
  const px = (n: number) => Math.round(n);
  const sq = (x: number, y: number, w: number, h: number, color: string) => {
    ctx.fillStyle = color;
    ctx.fillRect(px(fx + x), px(fy0 + y), w, h);
  };

  // body
  sq(-10, -8, 20, 16, '#4CAF50');
  // head bumps
  sq(-10, -14, 8, 8, '#4CAF50');
  sq(2, -14, 8, 8, '#4CAF50');
  // belly
  sq(-7, -2, 14, 10, '#C8E6C9');
  // eyes
  sq(-9, -13, 6, 6, '#fff');
  sq(3, -13, 6, 6, '#fff');
  sq(-8, -12, 4, 4, '#212121');
  sq(4, -12, 4, 4, '#212121');
  // legs
  sq(-16, 4, 8, 4, '#4CAF50');
  sq(8, 4, 8, 4, '#4CAF50');
}

// ─────────────────────────────────────────────────────────────────────────────
// VARIANT C — Golden Tree Frog  (yellow with blue accents, tropical)
// ─────────────────────────────────────────────────────────────────────────────
export function renderFrogGolden(
  ctx: CanvasRenderingContext2D,
  fx: number,
  fy0: number,
  animFrame: number
) {
  const s = 18;
  const bob = Math.sin(animFrame * 0.08) * 2.5;
  const py = fy0 + bob;

  ctx.save();
  ctx.translate(fx, py);

  // Hind legs
  ctx.fillStyle = '#F59E0B';
  ctx.beginPath();
  ctx.ellipse(-s * 0.88, s * 0.5, s * 0.52, s * 0.26, -0.45, 0, Math.PI * 2);
  ctx.ellipse(s * 0.88, s * 0.5, s * 0.52, s * 0.26, 0.45, 0, Math.PI * 2);
  ctx.fill();

  // Body
  ctx.beginPath();
  ctx.ellipse(0, s * 0.1, s * 0.8, s * 0.68, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#FBBF24';
  ctx.fill();

  // Blue stripe
  ctx.beginPath();
  ctx.ellipse(0, s * 0.08, s * 0.82, s * 0.2, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#3B82F6';
  ctx.fill();

  // Belly
  ctx.beginPath();
  ctx.ellipse(0, s * 0.28, s * 0.5, s * 0.42, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#FEF3C7';
  ctx.fill();

  // Eye bumps
  ctx.fillStyle = '#F59E0B';
  ctx.beginPath();
  ctx.arc(-s * 0.36, -s * 0.52, s * 0.36, 0, Math.PI * 2);
  ctx.arc(s * 0.36, -s * 0.52, s * 0.36, 0, Math.PI * 2);
  ctx.fill();

  // Eyes white
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(-s * 0.36, -s * 0.56, s * 0.27, 0, Math.PI * 2);
  ctx.arc(s * 0.36, -s * 0.56, s * 0.27, 0, Math.PI * 2);
  ctx.fill();

  // Pupils (red — tree frog trait)
  ctx.fillStyle = '#EF4444';
  ctx.beginPath();
  ctx.arc(-s * 0.32, -s * 0.56, s * 0.16, 0, Math.PI * 2);
  ctx.arc(s * 0.4, -s * 0.56, s * 0.16, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}
