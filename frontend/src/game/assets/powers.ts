/**
 * Power & Portal Asset Registry
 */

export function renderWormholeAsset(
  ctx: CanvasRenderingContext2D,
  px: number,
  py: number,
  animFrame: number,
  label: string
) {
  const pulse = Math.sin(animFrame * 0.12) * 5;
  const spin = animFrame * 0.05;

  ctx.save();
  ctx.translate(px, py);
  ctx.scale(0.65, 0.65);

  // 1. Orbiting Floating Dark Magenta Crystal Shards
  ctx.fillStyle = '#6B21A8';
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI / 4) + spin * 0.7;
    const dist = 52 + Math.sin(spin * 2 + i) * 4;
    const sx = Math.cos(a) * dist;
    const sy = Math.sin(a) * dist;
    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(a + Math.PI / 2);
    ctx.beginPath();
    ctx.moveTo(0, -6); ctx.lineTo(4, 4); ctx.lineTo(-4, 4);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  // 2. Outer Organic Wavy Magenta/Purple Vortex Shell
  ctx.rotate(spin);
  ctx.fillStyle = '#C026D3';
  ctx.beginPath();
  const rBase = 42 + pulse;
  for (let a = 0; a <= Math.PI * 2; a += 0.2) {
    const rWavy = rBase + Math.sin(a * 5 + spin * 3) * 6;
    const vx = Math.cos(a) * rWavy;
    const vy = Math.sin(a) * rWavy;
    if (a === 0) ctx.moveTo(vx, vy); else ctx.lineTo(vx, vy);
  }
  ctx.closePath();
  ctx.fill();

  // 3. Middle Swirling Deep Purple Contour Ring
  ctx.fillStyle = '#7E22CE';
  ctx.beginPath();
  const rMid = 34 + pulse * 0.6;
  for (let a = 0; a <= Math.PI * 2; a += 0.2) {
    const rWavy = rMid + Math.sin(-a * 4 + spin * 4) * 4;
    const vx = Math.cos(a) * rWavy;
    const vy = Math.sin(a) * rWavy;
    if (a === 0) ctx.moveTo(vx, vy); else ctx.lineTo(vx, vy);
  }
  ctx.closePath();
  ctx.fill();

  // 4. Glowing Magenta / Pink Energy Ring Highlight
  ctx.rotate(-spin * 2);
  ctx.beginPath();
  ctx.arc(0, 0, 26, 0, Math.PI * 2);
  ctx.strokeStyle = '#F43F5E';
  ctx.lineWidth = 4;
  ctx.stroke();

  // 5. Swirling Cyan / Aqua Event Horizon Core
  ctx.beginPath();
  ctx.arc(0, 0, 20, 0, Math.PI * 2);
  const grad = ctx.createRadialGradient(0, 0, 2, 0, 0, 20);
  grad.addColorStop(0, '#67E8F9');
  grad.addColorStop(0.6, '#06B6D4');
  grad.addColorStop(1, '#0284C7');
  ctx.fillStyle = grad;
  ctx.fill();

  // Core Spiral Vortex
  ctx.beginPath();
  ctx.arc(0, 0, 12, spin, spin + Math.PI * 1.5);
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = 2.5;
  ctx.stroke();

  ctx.restore();
}
