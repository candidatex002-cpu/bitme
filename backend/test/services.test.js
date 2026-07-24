// §11 QA — service-level tests (run against the compiled dist).
// Uses Node's built-in test runner (no extra deps): `node --test`.
const os = require('os');
const path = require('path');
const fs = require('fs');
const test = require('node:test');
const assert = require('node:assert');

// Point the file-backed DB at a throwaway file BEFORE importing anything that loads it.
process.env.DATA_FILE = path.join(os.tmpdir(), `anaconda_test_${process.pid}.json`);
try { fs.rmSync(process.env.DATA_FILE, { force: true }); } catch { /* */ }

const dist = (p) => path.resolve(__dirname, '..', 'dist', p);
const { db } = require(dist('db/Database.js'));
const { ProgressionService } = require(dist('services/ProgressionService.js'));
const { EconomyService } = require(dist('services/EconomyService.js'));
const { RewardsService } = require(dist('services/RewardsService.js'));
const { AuthService } = require(dist('services/AuthService.js'));

test.after(() => { try { fs.rmSync(process.env.DATA_FILE, { force: true }); } catch { /* */ } });

// ---------------------------------------------------------------- Database + persistence
test('Database: create user + profile defaults', () => {
  const { user, profile } = db.createUser('Tester1', 't1@x.io', 'hash', false);
  assert.ok(user.id.startsWith('usr_'));
  assert.equal(profile.level, 1);
  assert.equal(profile.stars, 500);
  assert.equal(db.getUserByUsername('Tester1').id, user.id);
});

test('Database: updateProfile is immutable-merge and persists', () => {
  const { user } = db.createUser('Tester2', 't2@x.io', 'hash', false);
  const updated = db.updateProfile(user.id, { stars: 12345 });
  assert.equal(updated.stars, 12345);
  assert.equal(db.getProfile(user.id).stars, 12345);
});

test('Database: persistence round-trip survives a fresh instance', () => {
  const { user } = db.createUser('Persisted', 'p@x.io', 'hash', false);
  db.updateProfile(user.id, { stars: 9999, level: 7 });
  db.flush(); // force write
  delete require.cache[require.resolve(dist('db/Database.js'))];
  const { db: db2 } = require(dist('db/Database.js'));
  const reloaded = db2.getProfile(user.id);
  assert.equal(reloaded.stars, 9999);
  assert.equal(reloaded.level, 7);
});

test('Database: grantRewards rolls level-ups', () => {
  const { user } = db.createUser('Leveler', 'lv@x.io', 'hash', false);
  const { profile, levelsGained } = db.grantRewards(user.id, { xp: 100000, stars: 10, evoXp: 50 });
  assert.ok(levelsGained > 0);
  assert.ok(profile.level > 1);
  assert.equal(profile.stars, 510);
});

test('Database: mission progress + claim gate', () => {
  const { user } = db.createUser('Missioner', 'ms@x.io', 'hash', false);
  // A daily cherry mission with target 30
  db.incrementCollectible(user.id, 'cherry', 30);
  const missions = db.getMissions(user.id);
  const cherry = missions.find(m => m.metric === 'cherry' && m.category === 'daily');
  assert.equal(cherry.isCompleted, true);
  const claim = db.claimMissionReward(user.id, cherry.id);
  assert.equal(claim.success, true);
  // Second claim must fail
  assert.equal(db.claimMissionReward(user.id, cherry.id).success, false);
});

// ---------------------------------------------------------------- ProgressionService
test('Progression: xpToNext rises and caps at MAX_LEVEL', () => {
  assert.equal(ProgressionService.xpToNext(1), 300);
  assert.ok(ProgressionService.xpToNext(10) > ProgressionService.xpToNext(1));
  assert.equal(ProgressionService.xpToNext(1000), Infinity);
});

test('Progression: rank + evolution unlocks', () => {
  assert.equal(ProgressionService.getRank(1, 0).tier, 'Bronze');
  assert.equal(ProgressionService.getRank(900, 0).tier, 'Master');
  assert.equal(ProgressionService.getRank(1, 2).tier, 'Legend');
  const unlocked = ProgressionService.unlockedEvolutions(1, 0, 0);
  assert.deepEqual(unlocked, ['Baby']);
  assert.ok(ProgressionService.unlockedEvolutions(101, 1000, 0).includes('Teen'));
});

// ---------------------------------------------------------------- EconomyService
test('Economy: purchase succeeds / fails on funds', () => {
  const { user } = db.createUser('Shopper', 'sh@x.io', 'hash', false);
  db.updateProfile(user.id, { stars: 2000, tickets: 20 });
  const ok = EconomyService.purchaseItem(user.id, 'skin_golden'); // 1000 stars / 10 tickets
  assert.equal(ok.success, true);
  db.updateProfile(user.id, { stars: 0, tickets: 0 });
  const broke = EconomyService.purchaseItem(user.id, 'skin_shadow');
  assert.equal(broke.success, false);
});

// ---------------------------------------------------------------- RewardsService (§15)
test('Rewards: region filter + dynamic price + redeem + stock', () => {
  const catGlobal = RewardsService.getCatalog('Global');
  assert.equal(catGlobal.items.length, 6);
  const partnerGlobal = catGlobal.items.find(i => i.id === 'rw_partner_promo');
  assert.equal(partnerGlobal.available, false); // partner promo is India/Brazil only
  const partnerIndia = RewardsService.getCatalog('India').items.find(i => i.id === 'rw_partner_promo');
  assert.equal(partnerIndia.available, true);

  const { user } = db.createUser('Redeemer2', 'rd@x.io', 'hash', false);
  db.updateProfile(user.id, { level: 30, stars: 50000 });
  const before = RewardsService.getCatalog('Global').items.find(i => i.id === 'rw_giftcard_10').stock;
  const r = RewardsService.redeem(user.id, 'rw_giftcard_10', 'Global');
  assert.equal(r.success, true);
  assert.ok(r.voucher.promoCode.startsWith('AP-'));
  const after = RewardsService.getCatalog('Global').items.find(i => i.id === 'rw_giftcard_10').stock;
  assert.equal(after, before - 1); // stock decremented
  assert.equal(db.getProfile(user.id).coupons.length, 1); // voucher persisted
});

test('Rewards: region lock + level + funds guards', () => {
  const { user } = db.createUser('Redeemer3', 'r3@x.io', 'hash', false);
  db.updateProfile(user.id, { level: 1, stars: 100 });
  assert.equal(RewardsService.redeem(user.id, 'rw_partner_promo', 'USA').success, false); // region
  assert.equal(RewardsService.redeem(user.id, 'rw_giftcard_25', 'Global').success, false); // level+funds
});

// ---------------------------------------------------------------- AuthService
test('Auth: register + login + token verify; guest', async () => {
  const reg = await AuthService.register('AuthUser', 'au@x.io', 'Passw0rd!');
  assert.ok(reg.token);
  const login = await AuthService.login('AuthUser', 'Passw0rd!');
  assert.ok(login.token);
  assert.equal(AuthService.verifyToken(login.token).username, 'AuthUser');
  assert.equal(AuthService.verifyToken('garbage.token'), null);
  const guest = AuthService.createGuestAccount();
  assert.equal(AuthService.verifyToken(guest.token).isGuest, true);
});
