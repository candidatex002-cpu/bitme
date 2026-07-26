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
