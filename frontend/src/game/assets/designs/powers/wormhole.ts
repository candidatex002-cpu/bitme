/**
 * 🌀 WORMHOLE / PORTAL — Alternative Design Variants
 *
 * Current live design: renderWormholeAsset  (in ../../powers.ts)
 *
 * HOW TO SWAP:
 *   In ../../powers.ts change the export line to e.g.:
 *     export { renderWormholeGalaxy as renderWormholeAsset } from './designs/powers/wormhole.js';
 */

// ─────────────────────────────────────────────────────────────────────────────
// VARIANT A — Galaxy Spiral Portal  (milky way core, slow deep-space spin)
// ─────────────────────────────────────────────────────────────────────────────
export function renderWormholeGalaxy(
  ctx: CanvasRenderingContext2D,
  px: number,
  py: number,
  animFrame: number,
  _label: string
) {
  const spin = animFrame * 0.03;
  const pulse = Math.sin(animFrame * 0.1) * 4;
  ctx.save();
  ctx.translate(px, py);

  // Outer starfield haze
  const outerGlow = ctx.createRadialGradient(0, 0, 30, 0, 0, 65 + pulse);
  outerGlow.addColorStop(0, 'rgba(100,50,200,0)');
  outerGlow.addColorStop(0.6, 'rgba(60,20,140,0.35)');
  outerGlow.addColorStop(1, 'rgba(20,0,80,0.55)');
  ctx.beginPath();
  ctx.arc(0, 0, 65 + pulse, 0, Math.PI * 2);
  ctx.fillStyle = outerGlow;
  ctx.fill();

  // Spiral arms (two lobes)
  ctx.save();
  ctx.rotate(spin);
  for (let arm = 0; arm < 2; arm++) {
    ctx.save();
    ctx.rotate(arm * Math.PI);
    for (let i = 0; i < 40; i++) {
      const a = (i / 40) * Math.PI * 2.5;
      const rad = 6 + i * 1.35;
      const sx = Math.cos(a) * rad;
      const sy = Math.sin(a) * rad * 0.5;
      const alpha = (1 - i / 40) * 0.6;
      ctx.beginPath();
      ctx.arc(sx, sy, 3.5 - i * 0.06, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(180,120,255,${alpha})`;
      ctx.fill();
    }
    ctx.restore();
  }
  ctx.restore();

  // Dark matter core ring
  ctx.beginPath();
  ctx.arc(0, 0, 24 + pulse * 0.4, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(200,100,255,0.7)';
  ctx.lineWidth = 3;
  ctx.stroke();

  // Bright event horizon
  ctx.beginPath();
  ctx.arc(0, 0, 15, 0, Math.PI * 2);
  const eg = ctx.createRadialGradient(0, 0, 1, 0, 0, 15);
  eg.addColorStop(0, '#FFFFFF');
  eg.addColorStop(0.4, '#E0B0FF');
  eg.addColorStop(1, '#6A0DAD');
  ctx.fillStyle = eg;
  ctx.fill();

  // Orbiting star specks
  for (let i = 0; i < 12; i++) {
    const a = spin * 1.5 + (i * Math.PI * 2) / 12;
    const d = 38 + Math.sin(spin * 2 + i) * 5;
    ctx.beginPath();
    ctx.arc(Math.cos(a) * d, Math.sin(a) * d * 0.6, 1.5, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255,255,255,${0.4 + Math.sin(a) * 0.3})`;
    ctx.fill();
  }

  ctx.restore();
}

// ─────────────────────────────────────────────────────────────────────────────
// VARIANT B — Electric Blue Portal  (lightning arcs, digital-tech feel)
// ─────────────────────────────────────────────────────────────────────────────
export function renderWormholeElectric(
  ctx: CanvasRenderingContext2D,
  px: number,
  py: number,
  animFrame: number,
  _label: string
) {
  const spin = animFrame * 0.07;
  const pulse = Math.sin(animFrame * 0.15) * 5;
  ctx.save();
  ctx.translate(px, py);

  // Dark field
  ctx.beginPath();
  ctx.arc(0, 0, 52 + pulse, 0, Math.PI * 2);
  const df = ctx.createRadialGradient(0, 0, 10, 0, 0, 52 + pulse);
  df.addColorStop(0, '#001133');
  df.addColorStop(0.7, '#000820');
  df.addColorStop(1, 'rgba(0,8,32,0)');
  ctx.fillStyle = df;
  ctx.fill();

  // Outer ring
  ctx.beginPath();
  ctx.arc(0, 0, 44 + pulse * 0.5, 0, Math.PI * 2);
  ctx.strokeStyle = '#00BFFF';
  ctx.lineWidth = 2.5;
  ctx.shadowBlur = 14;
  ctx.shadowColor = '#00BFFF';
  ctx.stroke();
  ctx.shadowBlur = 0;

  // Lightning arc (jagged lines from edge to center)
  ctx.strokeStyle = '#7DF9FF';
  ctx.lineWidth = 1.5;
  ctx.shadowBlur = 8;
  ctx.shadowColor = '#00FFFF';
  for (let i = 0; i < 6; i++) {
    const a = spin * 2 + (i * Math.PI * 2) / 6;
    let lx = Math.cos(a) * 42;
    let ly = Math.sin(a) * 42;
    ctx.beginPath();
    ctx.moveTo(lx, ly);
    for (let j = 0; j < 5; j++) {
      lx *= 0.7 + Math.random() * 0.15;
      ly *= 0.7 + Math.random() * 0.15;
      lx += (Math.random() - 0.5) * 10;
      ly += (Math.random() - 0.5) * 10;
      ctx.lineTo(lx, ly);
    }
    ctx.lineTo(0, 0);
    ctx.stroke();
  }
  ctx.shadowBlur = 0;

  // Inner core
  ctx.beginPath();
  ctx.arc(0, 0, 18, 0, Math.PI * 2);
  const ig = ctx.createRadialGradient(0, 0, 0, 0, 0, 18);
  ig.addColorStop(0, '#FFFFFF');
  ig.addColorStop(0.3, '#00E5FF');
  ig.addColorStop(1, '#0044AA');
  ctx.fillStyle = ig;
  ctx.fill();

  // Rotating hex ring
  ctx.save();
  ctx.rotate(spin * 0.5);
  ctx.strokeStyle = 'rgba(0,229,255,0.5)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const ha = (i * Math.PI) / 3;
    const hx = Math.cos(ha) * 32;
    const hy = Math.sin(ha) * 32;
    if (i === 0) ctx.moveTo(hx, hy); else ctx.lineTo(hx, hy);
  }
  ctx.closePath();
  ctx.stroke();
  ctx.restore();

  ctx.restore();
}

// ─────────────────────────────────────────────────────────────────────────────
// VARIANT C — Green Nature Portal  (leafy, organic, earth-toned swirl)
// ─────────────────────────────────────────────────────────────────────────────
export function renderWormholeNature(
  ctx: CanvasRenderingContext2D,
  px: number,
  py: number,
  animFrame: number,
  _label: string
) {
  const spin = animFrame * 0.04;
  const pulse = Math.sin(animFrame * 0.1) * 4;
  ctx.save();
  ctx.translate(px, py);

  // Earthy outer glow
  const og = ctx.createRadialGradient(0, 0, 20, 0, 0, 58 + pulse);
  og.addColorStop(0, 'rgba(34,139,34,0)');
  og.addColorStop(0.6, 'rgba(34,100,34,0.3)');
  og.addColorStop(1, 'rgba(10,40,10,0.5)');
  ctx.beginPath();
  ctx.arc(0, 0, 58 + pulse, 0, Math.PI * 2);
  ctx.fillStyle = og;
  ctx.fill();

  // Outer leaf ring
  ctx.save();
  ctx.rotate(spin * 0.8);
  for (let i = 0; i < 10; i++) {
    const a = (i * Math.PI * 2) / 10;
    const lx = Math.cos(a) * (44 + pulse * 0.5);
    const ly = Math.sin(a) * (44 + pulse * 0.5);
    ctx.save();
    ctx.translate(lx, ly);
    ctx.rotate(a + Math.PI / 2);
    ctx.fillStyle = i % 2 === 0 ? '#22C55E' : '#16A34A';
    ctx.beginPath();
    ctx.moveTo(0, -8);
    ctx.bezierCurveTo(6, -4, 6, 4, 0, 8);
    ctx.bezierCurveTo(-6, 4, -6, -4, 0, -8);
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();

  // Middle vortex ring
  ctx.save();
  ctx.rotate(-spin * 1.5);
  ctx.beginPath();
  const rMid = 30 + pulse * 0.5;
  for (let a = 0; a <= Math.PI * 2; a += 0.18) {
    const rw = rMid + Math.sin(a * 4 + spin * 3) * 5;
    const vx = Math.cos(a) * rw;
    const vy = Math.sin(a) * rw;
    if (a === 0) ctx.moveTo(vx, vy); else ctx.lineTo(vx, vy);
  }
  ctx.closePath();
  ctx.fillStyle = '#15803D';
  ctx.fill();
  ctx.restore();

  // Golden core
  ctx.beginPath();
  ctx.arc(0, 0, 16, 0, Math.PI * 2);
  const gc = ctx.createRadialGradient(0, 0, 1, 0, 0, 16);
  gc.addColorStop(0, '#FEFCE8');
  gc.addColorStop(0.4, '#FCD34D');
  gc.addColorStop(1, '#92400E');
  ctx.fillStyle = gc;
  ctx.fill();

  // Spiral vine
  ctx.beginPath();
  for (let i = 0; i < 40; i++) {
    const a = (i / 40) * Math.PI * 4 + spin;
    const rad = 4 + i * 0.55;
    const vx = Math.cos(a) * rad;
    const vy = Math.sin(a) * rad;
    if (i === 0) ctx.moveTo(vx, vy); else ctx.lineTo(vx, vy);
  }
  ctx.strokeStyle = '#4ADE80';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.restore();
}

// ─────────────────────────────────────────────────────────────────────────────
// VARIANT D — Fire Portal  (lava, flames, molten glow)
// ─────────────────────────────────────────────────────────────────────────────
export function renderWormholeFire(
  ctx: CanvasRenderingContext2D,
  px: number,
  py: number,
  animFrame: number,
  _label: string
) {
  const spin = animFrame * 0.06;
  const pulse = Math.sin(animFrame * 0.13) * 5;
  const flicker = Math.sin(animFrame * 0.3) * 0.12 + 0.88;
  ctx.save();
  ctx.translate(px, py);

  // Heat haze glow
  const hg = ctx.createRadialGradient(0, 0, 20, 0, 0, 62 + pulse);
  hg.addColorStop(0, 'rgba(255,80,0,0)');
  hg.addColorStop(0.55, 'rgba(200,40,0,0.35)');
  hg.addColorStop(1, 'rgba(80,0,0,0.5)');
  ctx.beginPath();
  ctx.arc(0, 0, 62 + pulse, 0, Math.PI * 2);
  ctx.fillStyle = hg;
  ctx.fill();

  // Outer lava ring (wavy)
  ctx.save();
  ctx.rotate(spin);
  ctx.beginPath();
  const rOuter = 44 + pulse;
  for (let a = 0; a <= Math.PI * 2; a += 0.18) {
    const rw = rOuter + Math.sin(a * 6 + spin * 4) * 7;
    const vx = Math.cos(a) * rw;
    const vy = Math.sin(a) * rw;
    if (a === 0) ctx.moveTo(vx, vy); else ctx.lineTo(vx, vy);
  }
  ctx.closePath();
  ctx.fillStyle = '#EA580C';
  ctx.fill();
  ctx.restore();

  // Middle ring
  ctx.save();
  ctx.rotate(-spin * 1.5);
  ctx.beginPath();
  const rMid = 32 + pulse * 0.6;
  for (let a = 0; a <= Math.PI * 2; a += 0.18) {
    const rw = rMid + Math.sin(-a * 5 + spin * 5) * 5;
    const vx = Math.cos(a) * rw;
    const vy = Math.sin(a) * rw;
    if (a === 0) ctx.moveTo(vx, vy); else ctx.lineTo(vx, vy);
  }
  ctx.closePath();
  ctx.fillStyle = '#DC2626';
  ctx.fill();
  ctx.restore();

  // Molten core
  ctx.beginPath();
  ctx.arc(0, 0, 20, 0, Math.PI * 2);
  const mg = ctx.createRadialGradient(0, 0, 2, 0, 0, 20);
  mg.addColorStop(0, '#FEFCE8');
  mg.addColorStop(0.3, '#FDE68A');
  mg.addColorStop(0.7, '#F97316');
  mg.addColorStop(1, '#7C2D12');
  ctx.fillStyle = mg;
  ctx.globalAlpha = flicker;
  ctx.fill();
  ctx.globalAlpha = 1;

  // Flame particles
  for (let i = 0; i < 8; i++) {
    const a = spin * 2 + (i * Math.PI * 2) / 8;
    const d = 36 + Math.sin(spin * 3 + i) * 6;
    const fx = Math.cos(a) * d;
    const fy = Math.sin(a) * d;
    ctx.beginPath();
    ctx.moveTo(fx, fy);
    ctx.lineTo(fx + 3, fy - 7);
    ctx.lineTo(fx - 3, fy - 7);
    ctx.closePath();
    ctx.fillStyle = `rgba(255,${160 + i * 10},0,0.75)`;
    ctx.fill();
  }

  ctx.restore();
}
