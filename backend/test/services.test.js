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
const { CouponService } = require(dist('services/CouponService.js'));
const { SocialService } = require(dist('services/SocialService.js'));
const { AuthService } = require(dist('services/AuthService.js'));
const { SupabaseSync } = require(dist('db/SupabaseSync.js'));

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

test('Database: cloud-save round-trip persists coupons + social (§11 no data loss)', () => {
  const { user: ux } = db.createUser('PersistX', 'px@x.io', 'hash', false);
  const { user: uy } = db.createUser('PersistY', 'py@x.io', 'hash', false);
  // Coupon definition + redemption + a friendship
  db.upsertCouponDef({ id: 'cpn_persist', title: 'Persist Coupon', storeName: 'P', discountText: 'x', icon: '🎟️', enabled: true, expiryDate: '2026-12-31', regions: 'all', minLevel: 1, minPrestige: 0, costStars: 0, redemptionLimit: -1, perUserLimit: 1, redemptionCount: 3, autoGrant: false, createdAt: 'now', updatedAt: 'now' });
  db.recordCouponRedemption({ definitionId: 'cpn_persist', userId: ux.id, voucherId: 'v1', promoCode: 'AP-AAAA-BBBB', redeemedAt: 'now' });
  const g = db.getSocial(ux.id); g.friends.push(uy.id); db.saveSocial();
  db.flush();

  delete require.cache[require.resolve(dist('db/Database.js'))];
  const { db: db3 } = require(dist('db/Database.js'));
  assert.equal(db3.getCouponDef('cpn_persist').redemptionCount, 3, 'coupon def survived');
  assert.equal(db3.getCouponRedemptions('cpn_persist').length, 1, 'redemption ledger survived');
  assert.deepEqual(db3.getSocial(ux.id).friends, [uy.id], 'friend graph survived');
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
  // Legend needs prestige >= 1; King (final stage) needs prestige >= 2 + 80k evo XP.
  assert.ok(!ProgressionService.unlockedEvolutions(1000, 80000, 1).includes('King'), 'King locked at prestige 1');
  assert.ok(ProgressionService.unlockedEvolutions(1000, 80000, 2).includes('King'), 'King unlocks at prestige 2');
  assert.ok(ProgressionService.unlockedEvolutions(1000, 80000, 2).includes('Legend'), 'Legend also unlocked at prestige 2');
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

// ---------------------------------------------------------------- GameConfig (§12)
test('Config: central config drives progression + client subset', () => {
  const { gameConfig, clientConfig } = require(dist('config/GameConfig.js'));
  assert.equal(gameConfig.progression.maxLevel, 1000);
  const king = gameConfig.progression.evolutionLadder.find(e => e.evolution === 'King');
  assert.ok(king && king.minPrestige === 2, 'King is the prestige-2 final stage');
  assert.ok(gameConfig.economy.match.starsPerKill > 0);
  const cc = clientConfig();
  assert.ok(cc.progression.evolutionLadder.length === 8, '8-stage ladder exposed to client');
  assert.ok(cc.economy.match && cc.world.size === 6000);
  assert.equal(cc.economy.ad, undefined, 'server-only economy fields not leaked to client');
  // §8 map themes + seasons are data-driven and exposed to the client
  assert.ok(cc.maps.themes.length >= 10, 'all biome themes exposed');
  assert.ok(cc.maps.themes.find(t => t.id === 'royal_castle'), 'named theme present');
  assert.ok(cc.maps.seasons.find(s => s.id === 'diwali'), 'festival season present');
  assert.ok(typeof cc.maps.activeSeason === 'string', 'active season resolved by month');
});

// ---------------------------------------------------------------- CouponService (§7)
test('Coupons: admin CRUD + enable/disable', () => {
  const created = CouponService.create({ title: 'Test Coupon', storeName: 'Test Partner', discountText: '5% off', costStars: 100, minLevel: 5, perUserLimit: 1 });
  assert.ok(created.id.startsWith('cpn_'));
  assert.equal(created.enabled, true);
  const updated = CouponService.update(created.id, { discountText: '15% off' });
  assert.equal(updated.discountText, '15% off');
  assert.equal(CouponService.setEnabled(created.id, false).enabled, false);
  assert.ok(CouponService.remove(created.id));
  assert.equal(CouponService.list().find(c => c.id === created.id), undefined);
});

test('Coupons: eligibility guards (level, region, enabled, per-user limit)', () => {
  const { user } = db.createUser('CpnUser1', 'c1@x.io', 'hash', false);
  db.updateProfile(user.id, { level: 2, stars: 5000 });
  const def = CouponService.create({ title: 'Lvl8 Coupon', storeName: 'P', discountText: 'x', costStars: 500, minLevel: 8, regions: ['India'], perUserLimit: 1 });
  // Too low level
  assert.equal(CouponService.claim(user.id, def.id, 'India').success, false);
  db.updateProfile(user.id, { level: 10 });
  // Wrong region
  assert.equal(CouponService.claim(user.id, def.id, 'USA').success, false);
  // Eligible now
  const ok = CouponService.claim(user.id, def.id, 'India');
  assert.equal(ok.success, true);
  assert.ok(ok.voucher.promoCode.startsWith('AP-'));
  assert.equal(ok.voucher.definitionId, def.id);
  assert.equal(db.getProfile(user.id).stars, 4500); // 5000 - 500 cost
  // Per-user limit hit
  assert.equal(CouponService.claim(user.id, def.id, 'India').success, false);
  // Tracking recorded
  assert.equal(db.countUserCouponRedemptions(def.id, user.id), 1);
});

test('Coupons: global redemption limit + auto-grant', () => {
  const { user } = db.createUser('CpnUser2', 'c2@x.io', 'hash', false);
  db.updateProfile(user.id, { level: 5, stars: 9999 });
  const def = CouponService.create({ title: 'Scarce', storeName: 'P', discountText: 'x', costStars: 0, redemptionLimit: 1, perUserLimit: 5 });
  assert.equal(CouponService.claim(user.id, def.id, 'Global').success, true);
  // Global limit reached (count=1, limit=1) even though per-user allows more
  assert.equal(CouponService.claim(user.id, def.id, 'Global').success, false);

  // Auto-grant: an autoGrant coupon lands in inventory without an explicit claim
  const auto = CouponService.create({ title: 'Auto Gift', storeName: 'P', discountText: 'free', costStars: 0, autoGrant: true, minLevel: 1, perUserLimit: 1 });
  const before = (db.getProfile(user.id).coupons || []).length;
  const issued = CouponService.autoGrantEligible(user.id, 'Global');
  assert.ok(issued.length >= 1);
  assert.equal((db.getProfile(user.id).coupons || []).length, before + issued.length);
  // Idempotent — already granted, no duplicate
  assert.equal(CouponService.autoGrantEligible(user.id, 'Global').find(v => v.definitionId === auto.id), undefined);
});

// ---------------------------------------------------------------- SocialService (§8)
test('Social: request → accept → friends; unfriend; block severs', () => {
  const { user: ua } = db.createUser('SocialA', 'sa@x.io', 'hash', false);
  const { user: ub } = db.createUser('SocialB', 'sb@x.io', 'hash', false);

  // A sends to B, appears in both queues
  assert.equal(SocialService.sendRequest(ua.id, 'SocialB').success, true);
  assert.equal(SocialService.overview(ua.id).outgoing.length, 1);
  assert.equal(SocialService.overview(ub.id).incoming.length, 1);
  // Duplicate send blocked
  assert.equal(SocialService.sendRequest(ua.id, 'SocialB').success, false);

  // B accepts → both are friends, queues cleared
  assert.equal(SocialService.respond(ub.id, ua.id, 'accept').success, true);
  assert.equal(SocialService.overview(ua.id).friends.length, 1);
  assert.equal(SocialService.overview(ub.id).friends.length, 1);
  assert.equal(SocialService.overview(ua.id).outgoing.length, 0);

  // Unfriend removes from both
  SocialService.unfriend(ua.id, ub.id);
  assert.equal(SocialService.overview(ua.id).friends.length, 0);
  assert.equal(SocialService.overview(ub.id).friends.length, 0);

  // Block prevents future requests
  assert.equal(SocialService.block(ua.id, ub.id).success, true);
  assert.equal(SocialService.overview(ua.id).blocked.length, 1);
  assert.equal(SocialService.sendRequest(ua.id, 'SocialB').success, false); // blocked-by-me guard
  // Unblock restores ability to request
  SocialService.unblock(ua.id, ub.id);
  assert.equal(SocialService.sendRequest(ua.id, 'SocialB').success, true);
});

test('Social: mutual request auto-accepts; cannot self-add', () => {
  const { user: uc } = db.createUser('SocialC', 'sc@x.io', 'hash', false);
  const { user: ud } = db.createUser('SocialD', 'sd@x.io', 'hash', false);
  assert.equal(SocialService.sendRequest(uc.id, 'SocialC').success, false); // self
  SocialService.sendRequest(uc.id, 'SocialD');
  // D sending back to C auto-accepts (they already have C's incoming)
  const r = SocialService.sendRequest(ud.id, 'SocialC');
  assert.equal(r.success, true);
  assert.equal(SocialService.overview(uc.id).friends.length, 1);
  assert.equal(SocialService.overview(ud.id).friends.length, 1);
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

// §5 username system
test('Auth: username validation, availability, suggestions, onboarding', () => {
  assert.equal(AuthService.validateUsername('ab').ok, false);        // too short
  assert.equal(AuthService.validateUsername('admin').ok, false);      // reserved
  assert.equal(AuthService.validateUsername('bad name').ok, false);   // spaces
  assert.equal(AuthService.validateUsername('Good_Name9').ok, true);
  assert.equal(AuthService.checkUsername('FreshUniqueName').available, true);

  AuthService.onboardGuest('TakenHandle', 'India', 'English');
  const taken = AuthService.checkUsername('TakenHandle');
  assert.equal(taken.available, false);
  assert.ok(Array.isArray(taken.suggestions) && taken.suggestions.length >= 1);

  const onb = AuthService.onboardGuest('BrandNewGuest', 'USA', 'English');
  assert.ok('token' in onb && onb.profile.displayName === 'BrandNewGuest');
  // Duplicate onboarding is rejected
  assert.ok('error' in AuthService.onboardGuest('BrandNewGuest'));
});

// §11 Supabase cloud sync is disabled without keys and degrades gracefully
test('Supabase: disabled without env keys, no-ops safely', async () => {
  assert.equal(SupabaseSync.configured(), false);
  assert.equal(await SupabaseSync.loadSnapshot(), null);
  await SupabaseSync.saveSnapshot({ v: 1 }); // must not throw
});
