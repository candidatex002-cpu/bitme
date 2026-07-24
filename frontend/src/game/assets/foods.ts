/**
 * Food & Collectible Asset Registry
 */

export function renderFrogAsset(ctx: CanvasRenderingContext2D, fx: number, fy0: number, animFrame: number) {
  const size = 18;
  const time = (animFrame * 0.045 + (fx * 0.13)) % 2.6;
  let jumpY = 0;
  let leapPhase = 0;

  if (time > 1.3 && time < 2.0) {
    const leapProgress = (time - 1.3) / 0.7;
    jumpY = Math.sin(leapProgress * Math.PI) * 40;
    leapPhase = Math.sin(leapProgress * Math.PI);
  } else if (time >= 2.0 && time < 2.2) {
    leapPhase = -0.15;
  }

  const py = fy0 - jumpY;

  ctx.save();
  ctx.translate(fx, py);

  ctx.fillStyle = '#689F38';
  ctx.beginPath();
  ctx.ellipse(-size * 0.85, size * (0.28 + leapPhase * 0.2), size * 0.52, size * (0.3 + leapPhase * 0.15), -0.3 - leapPhase * 0.4, 0, Math.PI * 2);
  ctx.ellipse(size * 0.85, size * (0.28 + leapPhase * 0.2), size * 0.52, size * (0.3 + leapPhase * 0.15), 0.3 + leapPhase * 0.4, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#7CB342';
  ctx.beginPath();
  ctx.ellipse(0, size * 0.08, size * 0.82, size * (0.7 + leapPhase * 0.15), 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#DCEDC8';
  ctx.beginPath();
  ctx.ellipse(0, size * 0.26, size * 0.56, size * 0.4, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#7CB342';
  ctx.beginPath();
  ctx.arc(-size * 0.46, -size * (0.42 + leapPhase * 0.1), size * 0.4, 0, Math.PI * 2);
  ctx.arc(size * 0.46, -size * (0.42 + leapPhase * 0.1), size * 0.4, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#212121';
  ctx.beginPath();
  ctx.arc(-size * 0.46, -size * (0.42 + leapPhase * 0.1), size * 0.3, 0, Math.PI * 2);
  ctx.arc(size * 0.46, -size * (0.42 + leapPhase * 0.1), size * 0.3, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.arc(-size * 0.54, -size * (0.5 + leapPhase * 0.1), size * 0.11, 0, Math.PI * 2);
  ctx.arc(size * 0.38, -size * (0.5 + leapPhase * 0.1), size * 0.11, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = '#33691E';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.arc(0, -size * 0.04, size * 0.42, 0.2, Math.PI - 0.2);
  ctx.stroke();

  ctx.restore();
}
