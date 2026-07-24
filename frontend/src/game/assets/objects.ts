/**
 * Game Obstacle & Map Objects Asset Registry
 * Place custom design SVG/Canvas assets here.
 */

export function renderTreeAsset(ctx: CanvasRenderingContext2D, ox: number, oy: number, radius: number) {
  const r = radius || 44;
  ctx.save();
  ctx.translate(ox, oy);

  // 1. Central Wooden Trunk & Branch Limbs
  ctx.strokeStyle = '#3E2723';
  ctx.lineWidth = Math.max(3.5, r * 0.16);
  ctx.lineCap = 'round';
  ctx.beginPath(); ctx.arc(0, 0, r * 0.16, 0, Math.PI * 2); ctx.fillStyle = '#3E2723'; ctx.fill();

  const branches: Array<[number, number, number, number]> = [
    [0, 0, -r * 0.55, -r * 0.35],
    [0, 0, r * 0.5, -r * 0.4],
    [0, 0, -r * 0.6, r * 0.3],
    [0, 0, r * 0.55, r * 0.45],
    [0, 0, 0, -r * 0.65],
  ];
  for (const [x1, y1, x2, y2] of branches) {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.quadraticCurveTo(x1 + (x2 - x1) * 0.5, y1 + (y2 - y1) * 0.5 + 4, x2, y2);
    ctx.stroke();
  }

  // 2. Layered Leaf Canopy Clusters
  const clusters = [
    { x: -r * 0.4, y: -r * 0.3, size: r * 0.55 },
    { x: r * 0.45, y: -r * 0.35, size: r * 0.5 },
    { x: -r * 0.45, y: r * 0.35, size: r * 0.52 },
    { x: r * 0.4, y: r * 0.4, size: r * 0.48 },
    { x: 0, y: -r * 0.5, size: r * 0.52 },
    { x: 0, y: r * 0.45, size: r * 0.48 },
    { x: 0, y: 0, size: r * 0.6 },
  ];

  ctx.fillStyle = '#1B5E20';
  for (const c of clusters) { ctx.beginPath(); ctx.arc(c.x, c.y, c.size, 0, Math.PI * 2); ctx.fill(); }
  ctx.fillStyle = '#4CAF50';
  for (const c of clusters) { ctx.beginPath(); ctx.arc(c.x - c.size * 0.12, c.y - c.size * 0.12, c.size * 0.85, 0, Math.PI * 2); ctx.fill(); }
  ctx.fillStyle = '#8BC34A';
  for (const c of clusters) { ctx.beginPath(); ctx.arc(c.x - c.size * 0.22, c.y - c.size * 0.22, c.size * 0.65, 0, Math.PI * 2); ctx.fill(); }

  ctx.restore();
}

export function renderPondAsset(ctx: CanvasRenderingContext2D, ox: number, oy: number, radius: number, animFrame: number) {
  const r = radius || 52;
  const time = animFrame * 0.04;
  ctx.save();
  ctx.translate(ox, oy);

  // 1. Earthy Stone Rim Base
  ctx.beginPath(); ctx.ellipse(0, 0, r * 1.28, r * 0.96, 0.08, 0, Math.PI * 2);
  ctx.fillStyle = '#785438'; ctx.fill();

  // 2. Cobblestones
  ctx.fillStyle = '#5A3E27';
  for (let a = 0; a < Math.PI * 2; a += Math.PI / 6) {
    ctx.beginPath(); ctx.arc(Math.cos(a) * r * 1.18, Math.sin(a) * r * 0.88, r * 0.18, 0, Math.PI * 2); ctx.fill();
  }

  // 3. Sandy Edge & Turquoise Water
  ctx.beginPath(); ctx.ellipse(0, 0, r * 1.08, r * 0.82, 0.08, 0, Math.PI * 2); ctx.fillStyle = '#FACC15'; ctx.fill();
  ctx.beginPath(); ctx.ellipse(0, 0, r * 0.98, r * 0.74, 0.08, 0, Math.PI * 2);
  const grad = ctx.createRadialGradient(0, 0, r * 0.2, 0, 0, r);
  grad.addColorStop(0, '#38BDF8'); grad.addColorStop(1, '#0284C7');
  ctx.fillStyle = grad; ctx.fill();

  // 4. Water Ripples & Swimming Koi
  ctx.beginPath(); ctx.ellipse(-r * 0.15, -r * 0.12, r * 0.58, r * 0.38, 0.08 + Math.sin(time) * 0.05, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)'; ctx.lineWidth = 2.2; ctx.stroke();

  ctx.font = `${r * 0.42}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('🪷', -r * 0.35, -r * 0.18); ctx.fillText('🌸', r * 0.32, r * 0.22);

  const fishAngle = time * 0.8;
  ctx.save();
  ctx.translate(Math.cos(fishAngle) * r * 0.44, Math.sin(fishAngle) * r * 0.30);
  ctx.rotate(fishAngle + Math.PI / 2);
  ctx.font = `${r * 0.36}px sans-serif`; ctx.fillText('🐟', 0, 0);
  ctx.restore();

  ctx.font = `${r * 0.38}px sans-serif`;
  ctx.fillText('🌿', -r * 0.92, -r * 0.48); ctx.fillText('🌾', r * 0.88, -r * 0.42);

  ctx.restore();
}

export function renderCaveAsset(ctx: CanvasRenderingContext2D, ox: number, oy: number, radius: number) {
  const r = radius || 58;
  ctx.save();
  ctx.translate(ox, oy);

  ctx.beginPath(); ctx.ellipse(0, 0, r * 1.3, r * 0.95, 0, 0, Math.PI * 2); ctx.fillStyle = '#616161'; ctx.fill();
  ctx.beginPath(); ctx.ellipse(0, -r * 0.35, r * 1.15, r * 0.5, 0, 0, Math.PI * 2); ctx.fillStyle = '#9E9E9E'; ctx.fill();
  ctx.beginPath(); ctx.ellipse(0, r * 0.1, r * 0.78, r * 0.62, 0, 0, Math.PI * 2); ctx.fillStyle = '#0F172A'; ctx.fill();
  ctx.beginPath(); ctx.ellipse(0, r * 0.22, r * 0.42, r * 0.32, 0, 0, Math.PI * 2); ctx.fillStyle = 'rgba(34, 211, 238, 0.55)'; ctx.fill();

  ctx.fillStyle = '#BDBDBD';
  const stalactites = [-r * 0.45, -r * 0.2, 0, r * 0.25, r * 0.5];
  for (let i = 0; i < stalactites.length; i++) {
    const sx = stalactites[i];
    const h = (i % 2 === 0 ? 0.35 : 0.48) * r;
    ctx.beginPath(); ctx.moveTo(sx - 5, -r * 0.2); ctx.lineTo(sx + 5, -r * 0.2); ctx.lineTo(sx, -r * 0.2 + h); ctx.closePath(); ctx.fill();
  }

  ctx.font = `${r * 0.35}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('🌿', -r * 0.5, -r * 0.7); ctx.fillText('🌾', 0, -r * 0.82); ctx.fillText('🌿', r * 0.55, -r * 0.65);

  ctx.restore();
}

export function renderRockAsset(ctx: CanvasRenderingContext2D, ox: number, oy: number, radius: number) {
  const r = radius || 34;
  ctx.save();
  ctx.translate(ox, oy);

  ctx.beginPath();
  ctx.moveTo(-r, 0); ctx.lineTo(-r * 0.6, -r * 0.8); ctx.lineTo(r * 0.4, -r * 0.95);
  ctx.lineTo(r, -r * 0.3); ctx.lineTo(r * 0.8, r * 0.7); ctx.lineTo(-r * 0.4, r * 0.9);
  ctx.closePath(); ctx.fillStyle = '#757575'; ctx.fill(); ctx.strokeStyle = '#374151'; ctx.lineWidth = 2; ctx.stroke();

  ctx.beginPath(); ctx.moveTo(-r * 0.6, -r * 0.8); ctx.lineTo(r * 0.4, -r * 0.95); ctx.lineTo(0, -r * 0.2);
  ctx.closePath(); ctx.fillStyle = '#9E9E9E'; ctx.fill();

  ctx.beginPath(); ctx.moveTo(0, -r * 0.2); ctx.lineTo(r, -r * 0.3); ctx.lineTo(r * 0.8, r * 0.7);
  ctx.closePath(); ctx.fillStyle = '#424242'; ctx.fill();

  ctx.restore();
}
