// §11 QA — authoritative game-session tests (collision, growth, wormholes, pause).
const os = require('os');
const path = require('path');
const fs = require('fs');
const test = require('node:test');
const assert = require('node:assert');

process.env.DATA_FILE = path.join(os.tmpdir(), `anaconda_sess_${process.pid}.json`);
try { fs.rmSync(process.env.DATA_FILE, { force: true }); } catch { /* */ }
test.after(() => { try { fs.rmSync(process.env.DATA_FILE, { force: true }); } catch { /* */ } });

const dist = (p) => path.resolve(__dirname, '..', 'dist', p);
const { GameSessionService, getModeConfig } = require(dist('services/GameSessionService.js'));

const food = (id, x, y, value) => ({ id, x, y, value, type: 'apple', icon: '🍎', color: '#f00', hpRestore: 0 });

test('world setup: 4 linked wormholes, obstacles, stars, bots', () => {
  const s = new GameSessionService('w1', 'classic');
  s.stop();
  const st = s.getState();
  assert.equal(st.portals.length, 4, 'four wormholes');
  for (let i = 0; i < 4; i++) assert.equal(st.portals[i].targetId, `wh_${(i + 1) % 4}`, 'ring link');
  assert.ok(st.obstacles.length > 0, 'obstacles present');
  const stars = Object.values(st.food).filter(f => f.type === 'star').length;
  assert.equal(stars, 24, 'star target (§8 scaled)');
  const bots = Object.values(st.snakes).filter(x => x.isBot).length;
  assert.equal(bots, 20, 'bot count (§8 populated map)');
});

test('registerPlayer starts small (radius 13, 9 segments)', () => {
  const s = new GameSessionService('w2', 'classic');
  s.stop();
  const p = s.registerPlayer('p1', 'P');
  assert.equal(p.radius, 13);
  assert.equal(p.body.length, 9);
  assert.equal(p.score, 0);
});

test('combat: ONLY head-to-head eliminates; higher score survives', () => {
  const s = new GameSessionService('w3', 'classic');
  s.stop();
  const st = s.getState();
  Object.keys(st.snakes).forEach(id => delete st.snakes[id]); // clear bots for determinism

  const a = s.registerPlayer('pA', 'A'); a.score = 1000; a.angle = 0;
  const b = s.registerPlayer('pB', 'B'); b.score = 500; b.angle = 0;
  for (const sn of [a, b]) { sn.head.x = 1000; sn.head.y = 1000; sn.body = Array.from({ length: 9 }, (_, i) => ({ x: 1000 - i * 14, y: 1000 })); }

  s.stepForTest();
  assert.equal(a.isAlive, true, 'higher score survives');
  assert.equal(b.isAlive, false, 'lower score dies');
  assert.equal(a.kills, 1, 'winner credited a kill');
});

test('combat: head-to-BODY never kills (only heads matter)', () => {
  const s = new GameSessionService('w4', 'classic');
  s.stop();
  const st = s.getState();
  Object.keys(st.snakes).forEach(id => delete st.snakes[id]);

  const a = s.registerPlayer('pA', 'A'); a.score = 100; a.angle = 0;
  const b = s.registerPlayer('pB', 'B'); b.score = 5000; b.angle = 0;
  // a's head sits on b's MID-BODY, but their heads are far apart
  b.head.x = 2000; b.head.y = 2000; b.body = Array.from({ length: 9 }, (_, i) => ({ x: 2000 - i * 14, y: 2000 }));
  a.head.x = b.body[4].x; a.head.y = b.body[4].y; a.body = Array.from({ length: 9 }, (_, i) => ({ x: a.head.x - i * 14, y: a.head.y }));

  s.stepForTest();
  assert.equal(a.isAlive, true, 'head-into-body does not kill');
  assert.equal(b.isAlive, true);
});

test('growth is milestone-gated: no length growth before 500', () => {
  const s = new GameSessionService('w5', 'classic');
  s.stop();
  const st = s.getState();
  Object.keys(st.snakes).forEach(id => delete st.snakes[id]);

  const p = s.registerPlayer('p1', 'P'); p.angle = 0;
  p.head.x = 1000; p.head.y = 1000; p.body = Array.from({ length: 9 }, (_, i) => ({ x: 1000 - i * 14, y: 1000 }));
  const startLen = p.body.length;

  st.food = {}; st.food['f1'] = food('f1', p.head.x, p.head.y, 400);
  s.stepForTest();
  assert.equal(p.score, 400);
  assert.equal(p.body.length, startLen, 'no growth below 500');

  st.food['f2'] = food('f2', p.head.x, p.head.y, 400);
  s.stepForTest();
  assert.ok(p.score >= 500);
  assert.ok(p.body.length > startLen, 'grows once past 500');
});

test('pause: setPlayerInactive freezes + protects the player', () => {
  const s = new GameSessionService('w6', 'classic');
  s.stop();
  const st = s.getState();
  Object.keys(st.snakes).forEach(id => delete st.snakes[id]);

  const p = s.registerPlayer('p1', 'P'); p.angle = 0;
  p.head.x = 1000; p.head.y = 1000;
  s.setPlayerInactive('p1', true);
  assert.equal(p.isPaused, true);
  const x0 = p.head.x;
  s.stepForTest();
  assert.equal(p.head.x, x0, 'paused player does not move');
  s.setPlayerInactive('p1', false);
  assert.equal(p.isPaused, false);
});

// §2 each mode loads a distinct config
test('modes load distinct rules', () => {
  const fr = getModeConfig('classic'), br = getModeConfig('battle_royale'), tm = getModeConfig('team');
  assert.equal(br.shrinkingZone, true);
  assert.equal(fr.shrinkingZone, false);
  assert.equal(tm.teamsEnabled, true);
  assert.equal(fr.teamsEnabled, false);
  // V6 bot policy: Free Roam is bot-populated; Battle Royale & Team Battle are real-players only.
  assert.ok(fr.botCount >= 20, 'Free Roam is bot-populated (§8)');
  assert.equal(br.botCount, 0, 'Battle Royale has no bots');
  assert.equal(tm.botCount, 0, 'Team Battle has no bots');
});

// §8 larger world
test('world size is the large §8 map (6000)', () => {
  const s = new GameSessionService('w8', 'classic');
  s.stop();
  assert.equal(s.getState().worldSize, 6000);
});

// §3 environmental hazard burns hp and eliminates
test('environmental hazard (lava) burns hp then eliminates', () => {
  const s = new GameSessionService('hz', 'classic');
  s.stop();
  const st = s.getState();
  Object.keys(st.snakes).forEach(id => delete st.snakes[id]);
  const p = s.registerPlayer('p1', 'P'); p.angle = 0;
  p.head.x = 1000; p.head.y = 1000; p.body = Array.from({ length: 9 }, (_, i) => ({ x: 1000 - i * 14, y: 1000 }));
  st.obstacles = [{ id: 'lava1', type: 'lava', x: 1000, y: 1000, radius: 42, icon: '🔥', blocking: false, damage: 26 }];
  const hp0 = p.hp;
  s.stepForTest();
  assert.ok(p.hp < hp0, 'lava reduces hp');
  for (let i = 0; i < 500 && p.isAlive; i++) { p.head.x = 1000; p.head.y = 1000; s.stepForTest(); }
  assert.equal(p.isAlive, false, 'sustained lava contact eliminates');
});

// §2 Shrinking zone — Battle Royale & Team Battle both close on the ROUND clock.
for (const mode of ['battle_royale', 'team']) {
  test(`${mode}: zone shrinks on the round clock and the HUD timer matches`, () => {
    const s = new GameSessionService(`z_${mode}`, mode);
    s.stop();
    const st = s.getState();
    const duration = getModeConfig(mode).matchDurationSeconds;
    assert.ok(duration > 0, 'timed mode declares a duration');

    const startR = st.safeZone.radius;
    assert.equal(st.matchTimer, duration, 'timer starts at the full round length');

    // Grace period — the zone must NOT have moved yet.
    s.advanceRoundClockForTest(10);
    s.stepForTest();
    assert.equal(st.safeZone.radius, startR, 'zone holds full size during the grace period');
    assert.equal(st.matchTimer, duration - 10, 'timer counts down during the grace period');

    // Mid-round — partially closed, strictly between start and target.
    s.advanceRoundClockForTest(duration / 2);
    s.stepForTest();
    assert.ok(st.safeZone.radius < startR, 'zone has started closing');
    assert.ok(st.safeZone.radius > st.safeZone.targetRadius, 'zone is not fully closed at mid-round');

    // End of round — fully closed, timer at zero, round flagged over.
    s.advanceRoundClockForTest(duration);
    s.stepForTest();
    assert.ok(Math.abs(st.safeZone.radius - st.safeZone.targetRadius) < 0.001, 'zone reaches its target radius');
    assert.equal(st.matchTimer, 0, 'timer hits zero');
    assert.equal(st.matchOver, true, 'round ends when the timer expires');
  });
}

test('battle_royale: a new round reopens the zone (session outlives one match)', () => {
  const s = new GameSessionService('z_reset', 'battle_royale');
  s.stop();
  const st = s.getState();
  const startR = st.safeZone.radius;
  const duration = getModeConfig('battle_royale').matchDurationSeconds;

  s.advanceRoundClockForTest(duration + 1);
  s.stepForTest();
  assert.equal(st.matchOver, true, 'round over');

  // Intermission elapses → the next round starts with a full-size zone and a fresh clock.
  s.advanceRoundClockForTest(60);
  s.stepForTest();
  assert.equal(st.matchOver, false, 'a new round has started');
  assert.equal(st.round, 2, 'round counter advanced');
  assert.equal(st.safeZone.radius, startR, 'zone reopened to full size');
  assert.equal(st.matchTimer, duration, 'clock restarted');
});

test('battle_royale: joining during the intermission starts a fresh round', () => {
  const s = new GameSessionService('z_join', 'battle_royale');
  s.stop();
  const st = s.getState();
  const duration = getModeConfig('battle_royale').matchDurationSeconds;
  s.advanceRoundClockForTest(duration + 1);
  s.stepForTest();
  assert.equal(st.matchOver, true);

  s.registerPlayer('late', 'Late');
  assert.equal(st.matchOver, false, 'late joiner is not dropped into a finished match');
  assert.equal(st.matchTimer, duration, 'late joiner gets a full round');
});

test('battle_royale: players always spawn inside the closed zone', () => {
  const s = new GameSessionService('z_spawn', 'battle_royale');
  s.stop();
  const st = s.getState();
  const duration = getModeConfig('battle_royale').matchDurationSeconds;
  s.advanceRoundClockForTest(duration * 0.9); // zone fully closed
  s.stepForTest();

  // Force the sanctuary far away — a spawn must still land inside the storm-free circle.
  st.sanctuaryZone.centerX = 200;
  st.sanctuaryZone.centerY = 200;
  for (let i = 0; i < 40; i++) {
    const p = s.registerPlayer(`sp_${i}`, 'S');
    const dx = p.head.x - st.safeZone.centerX, dy = p.head.y - st.safeZone.centerY;
    assert.ok(Math.hypot(dx, dy) <= st.safeZone.radius, 'spawn is inside the safe zone');
  }
});

test('classic (no storm): zone never shrinks and no round clock is published', () => {
  const s = new GameSessionService('z_classic', 'classic');
  s.stop();
  const st = s.getState();
  const r0 = st.safeZone.radius;
  s.advanceRoundClockForTest(600);
  for (let i = 0; i < 5; i++) s.stepForTest();
  assert.equal(st.safeZone.radius, r0, 'Free Roam stays wide open');
  assert.equal(st.matchTimer, undefined, 'untimed mode publishes no countdown');
});

// §power Buff stacking — a re-pickup EXTENDS the remaining time instead of replacing it.
const buffFood = (id, x, y, buff, type) => ({ id, x, y, value: 15, type, icon: '⚡', color: '#fff', buff });

test('power stacking: picking up mid-buff ADDS to the time left (2s left + 5s = 7s)', () => {
  const s = new GameSessionService('pw1', 'classic');
  s.stop();
  const st = s.getState();
  Object.keys(st.snakes).forEach(id => delete st.snakes[id]);
  const p = s.registerPlayer('p1', 'P'); p.angle = 0;
  p.head.x = 1000; p.head.y = 1000; p.body = Array.from({ length: 9 }, (_, i) => ({ x: 1000 - i * 14, y: 1000 }));

  // First pickup on a level-1 player grants the 5s base duration.
  st.food = {}; st.food['s1'] = buffFood('s1', p.head.x, p.head.y, 'shield', 'shield');
  s.stepForTest(0);
  assert.equal(Math.round(p.shieldTimer), 5, 'first pickup grants the full 5s');

  // Burn 3 seconds → 2s remaining.
  s.stepForTest(3);
  assert.ok(Math.abs(p.shieldTimer - 2) < 0.001, `expected 2s left, got ${p.shieldTimer}`);

  // Second pickup while 2s remain must total 7s — the old Math.max() reset it to 5s.
  st.food['s2'] = buffFood('s2', p.head.x, p.head.y, 'shield', 'shield');
  s.stepForTest(0);
  assert.ok(Math.abs(p.shieldTimer - 7) < 0.001, `expected 7s after stacking, got ${p.shieldTimer}`);
});

test('power stacking: a pickup after the buff EXPIRED grants exactly one duration', () => {
  const s = new GameSessionService('pw2', 'classic');
  s.stop();
  const st = s.getState();
  Object.keys(st.snakes).forEach(id => delete st.snakes[id]);
  const p = s.registerPlayer('p1', 'P'); p.angle = 0;
  p.head.x = 1000; p.head.y = 1000; p.body = Array.from({ length: 9 }, (_, i) => ({ x: 1000 - i * 14, y: 1000 }));

  st.food = {}; st.food['s1'] = buffFood('s1', p.head.x, p.head.y, 'shield', 'shield');
  s.stepForTest(0);
  s.stepForTest(6); // run past the full 5s
  assert.equal(p.shieldTimer, 0, 'buff fully expired');

  st.food['s2'] = buffFood('s2', p.head.x, p.head.y, 'shield', 'shield');
  s.stepForTest(0);
  assert.equal(Math.round(p.shieldTimer), 5, 'a fresh pickup is 5s, never more');
});

test('power stacking: each buff type stacks independently', () => {
  const s = new GameSessionService('pw3', 'classic');
  s.stop();
  const st = s.getState();
  Object.keys(st.snakes).forEach(id => delete st.snakes[id]);
  const p = s.registerPlayer('p1', 'P'); p.angle = 0;
  p.head.x = 1000; p.head.y = 1000; p.body = Array.from({ length: 9 }, (_, i) => ({ x: 1000 - i * 14, y: 1000 }));

  st.food = {};
  st.food['a'] = buffFood('a', p.head.x, p.head.y, 'shield', 'shield');
  st.food['b'] = buffFood('b', p.head.x, p.head.y, 'speed', 'speed');
  st.food['c'] = buffFood('c', p.head.x, p.head.y, 'super', 'mushroom');
  s.stepForTest(0);
  assert.equal(Math.round(p.shieldTimer), 5);
  assert.equal(Math.round(p.speedBoostTimer), 5);
  assert.equal(Math.round(p.superTimer), 5);

  // Stacking speed must not touch shield or super.
  st.food['b2'] = buffFood('b2', p.head.x, p.head.y, 'speed', 'speed');
  s.stepForTest(0);
  assert.equal(Math.round(p.speedBoostTimer), 10, 'speed stacked');
  assert.equal(Math.round(p.shieldTimer), 5, 'shield untouched');
  assert.equal(Math.round(p.superTimer), 5, 'super untouched');
});

test('power stacking: accumulation is capped so a shield can never be permanent', () => {
  const s = new GameSessionService('pw4', 'classic');
  s.stop();
  const st = s.getState();
  Object.keys(st.snakes).forEach(id => delete st.snakes[id]);
  const p = s.registerPlayer('p1', 'P'); p.angle = 0;
  p.head.x = 1000; p.head.y = 1000; p.body = Array.from({ length: 9 }, (_, i) => ({ x: 1000 - i * 14, y: 1000 }));

  st.food = {};
  // Chain 20 shields with no time passing — without a cap this would be 100s and climbing.
  for (let i = 0; i < 20; i++) {
    st.food[`s${i}`] = buffFood(`s${i}`, p.head.x, p.head.y, 'shield', 'shield');
    s.stepForTest(0);
  }
  assert.ok(p.shieldTimer <= 30, `capped at 30s, got ${p.shieldTimer}`);
  assert.ok(p.shieldTimer > 5, 'but stacking did accumulate well past a single pickup');
});

// §3 shield/sanctuary protects from hazards
test('shield protects from hazard damage', () => {
  const s = new GameSessionService('hz2', 'classic');
  s.stop();
  const st = s.getState();
  Object.keys(st.snakes).forEach(id => delete st.snakes[id]);
  const p = s.registerPlayer('p1', 'P'); p.angle = 0; p.shieldTimer = 5;
  p.head.x = 1000; p.head.y = 1000;
  st.obstacles = [{ id: 'lava1', type: 'lava', x: 1000, y: 1000, radius: 42, icon: '🔥', blocking: false, damage: 26 }];
  const hp0 = p.hp;
  s.stepForTest();
  assert.equal(p.hp, hp0, 'shielded snake takes no hazard damage');
});
