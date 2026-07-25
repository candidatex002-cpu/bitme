/**
 * 🍒🍎🍄 FOOD COLLECTIBLES — Alternative Design Variants
 *
 * Current live designs are emoji-based (rendered via fillText in Renderer.ts).
 * These variants replace them with hand-drawn canvas art for a more polished look.
 *
 * HOW TO USE:
 *   Call these instead of ctx.fillText('🍒', x, y) in Renderer.ts.
 *   Each function draws centered at (cx, cy) with optional `size` param.
 */

// ─────────────────────────────────────────────────────────────────────────────
// VARIANT A — Hand-Drawn Cherry  (glossy, 3D shaded)
// ─────────────────────────────────────────────────────────────────────────────
export function renderCherryHandDrawn(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size = 14
) {
  ctx.save();
  ctx.translate(cx, cy);

  // Left cherry
  const lg = ctx.createRadialGradient(-size * 0.5, -size * 0.6, size * 0.05, -size * 0.5, -size * 0.3, size * 0.85);
  lg.addColorStop(0, '#FF8A80');
  lg.addColorStop(0.45, '#E53935');
  lg.addColorStop(1, '#7F0000');
  ctx.beginPath();
  ctx.arc(-size * 0.5, -size * 0.2, size * 0.72, 0, Math.PI * 2);
  ctx.fillStyle = lg;
  ctx.fill();

  // Right cherry
  const rg = ctx.createRadialGradient(size * 0.5, -size * 0.6, size * 0.05, size * 0.5, -size * 0.3, size * 0.85);
  rg.addColorStop(0, '#FF8A80');
  rg.addColorStop(0.45, '#E53935');
  rg.addColorStop(1, '#7F0000');
  ctx.beginPath();
  ctx.arc(size * 0.5, -size * 0.2, size * 0.72, 0, Math.PI * 2);
  ctx.fillStyle = rg;
  ctx.fill();

  // Stems
  ctx.strokeStyle = '#2E7D32';
  ctx.lineWidth = size * 0.13;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-size * 0.5, -size * 0.9);
  ctx.quadraticCurveTo(0, -size * 1.8, size * 0.5, -size * 0.9);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-size * 0.5, -size * 0.9);
  ctx.lineTo(-size * 0.5, -size * 0.92);
  ctx.moveTo(size * 0.5, -size * 0.9);
  ctx.lineTo(size * 0.5, -size * 0.92);
  ctx.stroke();

  // Highlights
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.beginPath();
  ctx.ellipse(-size * 0.65, -size * 0.55, size * 0.22, size * 0.14, -0.5, 0, Math.PI * 2);
  ctx.ellipse(size * 0.35, -size * 0.55, size * 0.22, size * 0.14, -0.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

// ─────────────────────────────────────────────────────────────────────────────
// VARIANT B — Hand-Drawn Apple  (shiny with leaf)
// ─────────────────────────────────────────────────────────────────────────────
export function renderAppleHandDrawn(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size = 15
) {
  ctx.save();
  ctx.translate(cx, cy);

  // Apple body
  const ag = ctx.createRadialGradient(-size * 0.2, -size * 0.3, size * 0.05, 0, 0, size);
  ag.addColorStop(0, '#FF8A65');
  ag.addColorStop(0.5, '#E53935');
  ag.addColorStop(1, '#8B0000');
  ctx.beginPath();
  ctx.moveTo(0, -size * 0.75);
  ctx.bezierCurveTo(-size * 0.6, -size * 1.1, -size * 1.1, -size * 0.4, -size * 1.0, size * 0.2);
  ctx.bezierCurveTo(-size * 0.9, size * 0.9, -size * 0.3, size * 1.1, 0, size * 1.05);
  ctx.bezierCurveTo(size * 0.3, size * 1.1, size * 0.9, size * 0.9, size * 1.0, size * 0.2);
  ctx.bezierCurveTo(size * 1.1, -size * 0.4, size * 0.6, -size * 1.1, 0, -size * 0.75);
  ctx.closePath();
  ctx.fillStyle = ag;
  ctx.fill();

  // Stem
  ctx.strokeStyle = '#5D4037';
  ctx.lineWidth = size * 0.12;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(0, -size * 0.75);
  ctx.quadraticCurveTo(size * 0.2, -size * 1.3, size * 0.1, -size * 1.5);
  ctx.stroke();

  // Leaf
  ctx.fillStyle = '#4CAF50';
  ctx.beginPath();
  ctx.moveTo(size * 0.1, -size * 1.2);
  ctx.quadraticCurveTo(size * 0.65, -size * 1.55, size * 0.6, -size * 0.95);
  ctx.quadraticCurveTo(size * 0.3, -size * 1.0, size * 0.1, -size * 1.2);
  ctx.fill();

  // Highlight
  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  ctx.beginPath();
  ctx.ellipse(-size * 0.32, -size * 0.42, size * 0.28, size * 0.18, -0.7, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

// ─────────────────────────────────────────────────────────────────────────────
// VARIANT C — Hand-Drawn Mushroom  (classic red & white spots)
// ─────────────────────────────────────────────────────────────────────────────
export function renderMushroomHandDrawn(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size = 14
) {
  ctx.save();
  ctx.translate(cx, cy);

  // Stem
  const stemG = ctx.createLinearGradient(-size * 0.42, 0, size * 0.42, 0);
  stemG.addColorStop(0, '#E0E0E0');
  stemG.addColorStop(0.5, '#FAFAFA');
  stemG.addColorStop(1, '#BDBDBD');
  ctx.beginPath();
  ctx.moveTo(-size * 0.42, size);
  ctx.lineTo(-size * 0.38, 0);
  ctx.lineTo(size * 0.38, 0);
  ctx.lineTo(size * 0.42, size);
  ctx.closePath();
  ctx.fillStyle = stemG;
  ctx.fill();

  // Cap
  const capG = ctx.createRadialGradient(-size * 0.15, -size * 0.5, size * 0.05, 0, 0, size * 1.1);
  capG.addColorStop(0, '#FF5722');
  capG.addColorStop(0.6, '#D32F2F');
  capG.addColorStop(1, '#8B0000');
  ctx.beginPath();
  ctx.arc(0, 0, size, Math.PI, 0);
  ctx.bezierCurveTo(size * 1.2, size * 0.3, -size * 1.2, size * 0.3, -size, 0);
  ctx.closePath();
  ctx.fillStyle = capG;
  ctx.fill();

  // White spots
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  const spots = [
    { x: 0, y: -size * 0.5, r: size * 0.2 },
    { x: -size * 0.5, y: -size * 0.2, r: size * 0.14 },
    { x: size * 0.52, y: -size * 0.18, r: size * 0.14 },
    { x: -size * 0.22, y: -size * 0.75, r: size * 0.1 },
    { x: size * 0.28, y: -size * 0.72, r: size * 0.1 },
  ];
  for (const sp of spots) {
    ctx.beginPath();
    ctx.arc(sp.x, sp.y, sp.r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Stem gills
  ctx.strokeStyle = 'rgba(180,180,180,0.6)';
  ctx.lineWidth = 0.8;
  for (let i = -2; i <= 2; i++) {
    ctx.beginPath();
    ctx.moveTo(i * size * 0.16, 0);
    ctx.lineTo(i * size * 0.19, size * 0.88);
    ctx.stroke();
  }

  ctx.restore();
}

// ─────────────────────────────────────────────────────────────────────────────
// VARIANT D — Hand-Drawn Star  (5-point glowing gold)
// ─────────────────────────────────────────────────────────────────────────────
export function renderStarHandDrawn(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size = 14,
  animFrame = 0
) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(animFrame * 0.03);

  // Glow
  const glow = ctx.createRadialGradient(0, 0, size * 0.3, 0, 0, size * 1.6);
  glow.addColorStop(0, 'rgba(255,220,0,0.45)');
  glow.addColorStop(1, 'rgba(255,180,0,0)');
  ctx.beginPath();
  ctx.arc(0, 0, size * 1.6, 0, Math.PI * 2);
  ctx.fillStyle = glow;
  ctx.fill();

  // Star body
  ctx.beginPath();
  for (let i = 0; i < 5; i++) {
    const outerA = (i * Math.PI * 2) / 5 - Math.PI / 2;
    const innerA = outerA + Math.PI / 5;
    const ox = Math.cos(outerA) * size;
    const oy = Math.sin(outerA) * size;
    const ix = Math.cos(innerA) * size * 0.42;
    const iy = Math.sin(innerA) * size * 0.42;
    if (i === 0) ctx.moveTo(ox, oy); else ctx.lineTo(ox, oy);
    ctx.lineTo(ix, iy);
  }
  ctx.closePath();
  const sg = ctx.createLinearGradient(0, -size, 0, size);
  sg.addColorStop(0, '#FFF176');
  sg.addColorStop(0.5, '#FFD600');
  sg.addColorStop(1, '#F57F17');
  ctx.fillStyle = sg;
  ctx.fill();
  ctx.strokeStyle = '#FF8F00';
  ctx.lineWidth = 1.2;
  ctx.stroke();

  // Centre shine
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.beginPath();
  ctx.ellipse(-size * 0.18, -size * 0.22, size * 0.2, size * 0.12, -0.6, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

// ─────────────────────────────────────────────────────────────────────────────
// VARIANT E — Hand-Drawn Egg  (speckled, Easter-style)
// ─────────────────────────────────────────────────────────────────────────────
export function renderEggHandDrawn(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size = 13
) {
  ctx.save();
  ctx.translate(cx, cy);

  // Egg body
  const eg = ctx.createLinearGradient(-size * 0.7, -size, size * 0.5, size);
  eg.addColorStop(0, '#FFF9C4');
  eg.addColorStop(0.5, '#FFFDE7');
  eg.addColorStop(1, '#F9A825');
  ctx.beginPath();
  ctx.bezierCurveTo(-size * 0.72, -size * 1.1, size * 0.72, -size * 1.1, size * 0.72, -size * 0.1);
  ctx.bezierCurveTo(size * 0.72, size * 0.8, -size * 0.72, size * 0.8, -size * 0.72, -size * 0.1);
  ctx.closePath();
  ctx.fillStyle = eg;
  ctx.fill();

  // Decorative stripe
  ctx.strokeStyle = 'rgba(255,152,0,0.5)';
  ctx.lineWidth = size * 0.18;
  ctx.beginPath();
  ctx.bezierCurveTo(-size * 0.72, -size * 0.3, size * 0.72, -size * 0.3, size * 0.72, -size * 0.1);
  ctx.stroke();

  // Speckles
  ctx.fillStyle = 'rgba(245,127,23,0.55)';
  const speckles = [[-0.2, -0.6], [0.25, -0.4], [-0.35, -0.05], [0.1, 0.2], [-0.05, -0.88], [0.35, -0.78]];
  for (const [sx, sy] of speckles) {
    ctx.beginPath();
    ctx.arc(sx * size, sy * size, size * 0.08, 0, Math.PI * 2);
    ctx.fill();
  }

  // Highlight
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.beginPath();
  ctx.ellipse(-size * 0.2, -size * 0.65, size * 0.2, size * 0.12, -0.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}
