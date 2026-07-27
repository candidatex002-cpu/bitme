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
const { StatsService } = require(dist('services/StatsService.js'));
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

// ---------------------------------------------------------------- EconomyService (skin ownership)
test('Economy: new accounts own only the starter skins', () => {
  const { user, profile } = db.createUser('Starter', 'starter@x.io', 'hash', false);
  assert.deepEqual(profile.unlockedSkins, ['Forest', 'Jungle']);
  assert.equal(EconomyService.ownsSkin(user.id, 'Forest'), true);
  assert.equal(EconomyService.ownsSkin(user.id, 'Golden'), false, 'legendary skin is not free');
});

test('Economy: purchase debits the config price and grants ownership', () => {
  const { user } = db.createUser('Shopper', 'sh@x.io', 'hash', false);
  db.updateProfile(user.id, { stars: 2000, tickets: 20, level: 10 });
  const ok = EconomyService.purchaseSkin(user.id, 'Ocean'); // 400 stars, level 1
  assert.equal(ok.success, true);
  const p = db.getProfile(user.id);
  assert.equal(p.stars, 1600, 'exactly the catalog price was charged');
  assert.ok(p.unlockedSkins.includes('Ocean'));
  // Buying the same skin twice must not charge again.
  const dupe = EconomyService.purchaseSkin(user.id, 'Ocean');
  assert.equal(dupe.success, false);
  assert.equal(db.getProfile(user.id).stars, 1600, 'no double charge');
});

test('Economy: purchase blocked on funds, level and unknown ids', () => {
  const { user } = db.createUser('Broke', 'broke@x.io', 'hash', false);
  db.updateProfile(user.id, { stars: 10, tickets: 0, level: 1 });
  assert.equal(EconomyService.purchaseSkin(user.id, 'Ice').success, false, 'not enough stars');
  db.updateProfile(user.id, { stars: 99999, tickets: 99, level: 1 });
  assert.equal(EconomyService.purchaseSkin(user.id, 'Golden').success, false, 'level 20 gate holds even when rich');
  assert.equal(EconomyService.purchaseSkin(user.id, 'NotARealSkin').success, false, 'unknown skin rejected');
  assert.equal(db.getProfile(user.id).stars, 99999, 'nothing was charged for a blocked purchase');
});

test('Economy: equipping an unowned skin is refused (§sec)', () => {
  const { user } = db.createUser('Equipper', 'eq@x.io', 'hash', false);
  db.updateProfile(user.id, { stars: 99999, tickets: 99, level: 99 });
  const denied = EconomyService.equipSkin(user.id, 'Mythical');
  assert.equal(denied.success, false, 'cannot equip a skin that was never bought');
  assert.equal(db.getProfile(user.id).equippedSkin, 'Forest', 'equipped skin unchanged');
  // Buy it, then the same call succeeds.
  assert.equal(EconomyService.purchaseSkin(user.id, 'Mythical').success, true);
  assert.equal(EconomyService.equipSkin(user.id, 'Mythical').success, true);
  assert.equal(db.getProfile(user.id).equippedSkin, 'Mythical');
});

test('Economy: catalog reports per-player ownership without leaking other accounts', () => {
  const { user } = db.createUser('Browser', 'br@x.io', 'hash', false);
  db.updateProfile(user.id, { stars: 500, tickets: 0, level: 1 });
  const { skins } = EconomyService.getCatalog(user.id);
  const forest = skins.find(s => s.id === 'Forest');
  const ocean = skins.find(s => s.id === 'Ocean');
  const golden = skins.find(s => s.id === 'Golden');
  assert.equal(forest.owned, true);
  assert.equal(ocean.owned, false);
  assert.equal(ocean.purchasable, true, '400 stars affordable with 500');
  assert.equal(golden.levelMet, false, 'level gate reported to the UI');
  assert.equal(golden.purchasable, false);
  // The anonymous view carries prices but no ownership from anyone else's account.
  const anon = EconomyService.getCatalog();
  assert.equal(anon.skins.find(s => s.id === 'Ocean').owned, false);
});

// ---------------------------------------------------------------- AntiCheat (§sec)
test('AntiCheat: match results cannot be replayed to farm rewards', () => {
  const { AntiCheatService } = require(dist('services/AntiCheatService.js'));
  const ac = new AntiCheatService();
  const uid = 'usr_farmer';
  // First submission of a 180s match is always accepted.
  assert.equal(ac.validateMatchSubmission(uid, 180).ok, true);
  // Immediately replaying it is rejected — no real match could have elapsed.
  const replay = ac.validateMatchSubmission(uid, 180);
  assert.equal(replay.ok, false, 'burst replay rejected');
  assert.ok(replay.retryAfterMs > 0, 'client is told when it may retry');
});

test('AntiCheat: an honest short match right after a long one is accepted', () => {
  const { AntiCheatService } = require(dist('services/AntiCheatService.js'));
  const ac = new AntiCheatService();
  const uid = 'usr_honest';
  assert.equal(ac.validateMatchSubmission(uid, 600).ok, true, 'a long match submits fine');
  // Pretend the burst window has passed, then submit a genuinely quick death. The rule must
  // grade THIS match's duration against the gap, not the previous (long) match's.
  ac.lastMatchSubmit.set(uid, { at: Date.now() - 4000, claimedSeconds: 600 });
  assert.equal(ac.validateMatchSubmission(uid, 8).ok, true, 'short honest match must not be flagged');
  // …but claiming a 10-minute match in that same window is still impossible.
  ac.lastMatchSubmit.set(uid, { at: Date.now() - 4000, claimedSeconds: 8 });
  assert.equal(ac.validateMatchSubmission(uid, 600).ok, false, 'impossible playtime still rejected');
});

test('AntiCheat: input flooding is rejected past the per-second cap', () => {
  const { AntiCheatService } = require(dist('services/AntiCheatService.js'));
  const ac = new AntiCheatService();
  let accepted = 0;
  for (let i = 0; i < 200; i++) if (ac.validatePacketFrequency('usr_flood')) accepted++;
  assert.ok(accepted <= 60, `only the first 60 frames/sec are accepted, got ${accepted}`);
});

// ---------------------------------------------------------------- Friend codes (§social)
test('Social: every profile gets a unique, shareable friend code', () => {
  const a = db.createUser('CodeA', 'ca@x.io', 'hash', false);
  const b = db.createUser('CodeB', 'cb@x.io', 'hash', false);
  assert.match(a.profile.friendCode, /^AP-[A-Z0-9]{4}-[A-Z0-9]{4}$/, 'readable AP-XXXX-XXXX shape');
  assert.notEqual(a.profile.friendCode, b.profile.friendCode, 'codes are unique');
  // Ambiguous glyphs are excluded so a code read off a screen can't be mistyped.
  assert.ok(!/[OI]/.test(a.profile.friendCode.replace('AP-', '')), 'no O/I in the code body');
  assert.equal(db.getProfileByFriendCode(a.profile.friendCode).userId, a.user.id);
});

test('Social: friend codes are case/format insensitive and never expose userId', () => {
  const { user, profile } = db.createUser('CodeC', 'cc@x.io', 'hash', false);
  const messy = profile.friendCode.toLowerCase().replace(/-/g, ' ');
  assert.equal(db.getProfileByFriendCode(messy).userId, user.id, 'lenient lookup');
  assert.equal(db.getProfileByFriendCode('AP-ZZZZ-ZZZZ'), undefined, 'unknown code returns nothing');
  // The code is derived independently of the account id — it leaks nothing about it.
  assert.ok(!profile.friendCode.includes(user.id));
});

test('Social: a friend request can be addressed by friend code OR username', () => {
  const me = db.createUser('Requester', 'rq@x.io', 'hash', false);
  const them = db.createUser('Target', 'tg@x.io', 'hash', false);

  const byCode = SocialService.sendRequest(me.user.id, them.profile.friendCode);
  assert.equal(byCode.success, true, 'friend code resolves');
  assert.ok(db.getSocial(them.user.id).incoming.includes(me.user.id));

  // Same by username, from a third account.
  const other = db.createUser('Requester2', 'rq2@x.io', 'hash', false);
  assert.equal(SocialService.sendRequest(other.user.id, 'Target').success, true, 'username resolves');

  // Guard rails still hold.
  assert.equal(SocialService.sendRequest(me.user.id, them.profile.friendCode).success, false, 'no duplicate request');
  assert.equal(SocialService.sendRequest(me.user.id, me.profile.friendCode).success, false, 'cannot add yourself');
  assert.equal(SocialService.sendRequest(me.user.id, 'AP-ZZZZ-ZZZZ').success, false, 'unknown code rejected');
  assert.equal(SocialService.sendRequest(me.user.id, '').success, false, 'empty query rejected');
});

test('Social: overview returns only YOUR friend code', () => {
  const me = db.createUser('OverviewMe', 'om@x.io', 'hash', false);
  const other = db.createUser('OverviewOther', 'oo@x.io', 'hash', false);
  SocialService.sendRequest(other.user.id, me.profile.friendCode);
  SocialService.respond(me.user.id, other.user.id, 'accept');
  const ov = SocialService.overview(me.user.id);
  assert.equal(ov.myFriendCode, me.profile.friendCode);
  assert.equal(ov.friends.length, 1);
  // A friend card exposes name/avatar/level/online — never their code or any private field.
  assert.deepEqual(Object.keys(ov.friends[0]).sort(), ['avatar', 'id', 'level', 'name', 'online']);
  assert.ok(!JSON.stringify(ov.friends).includes(other.profile.friendCode));
});

// ---------------------------------------------------------------- Match invites (§social)
const befriend = (a, b) => {
  SocialService.sendRequest(a.user.id, b.profile.friendCode);
  SocialService.respond(b.user.id, a.user.id, 'accept');
};

test('Invites: sending to an OFFLINE friend stores it instead of failing', () => {
  const a = db.createUser('InvA', 'ia@x.io', 'hash', false);
  const b = db.createUser('InvB', 'ib@x.io', 'hash', false);
  befriend(a, b);

  // Neither is connected — this used to be rejected outright.
  const r = SocialService.invite(a.user.id, b.user.id, 'battle_royale');
  assert.equal(r.success, true, 'offline invite is accepted');
  assert.equal(r.online, false);
  assert.match(r.message, /offline/i, 'the sender is told they will see it later');

  // It is waiting for the recipient — and carries the mode.
  const pending = SocialService.pendingInvites(b.user.id);
  assert.equal(pending.length, 1);
  assert.equal(pending[0].mode, 'battle_royale');
  assert.equal(pending[0].fromName, a.profile.displayName);
  // …and only for the recipient. The sender's own inbox is untouched.
  assert.equal(SocialService.pendingInvites(a.user.id).length, 0);
});

test('Invites: only friends can invite, and never yourself', () => {
  const a = db.createUser('InvC', 'ic@x.io', 'hash', false);
  const stranger = db.createUser('InvD', 'id@x.io', 'hash', false);
  assert.equal(SocialService.invite(a.user.id, stranger.user.id, 'free_roam').success, false, 'strangers cannot be invited');
  assert.equal(SocialService.invite(a.user.id, a.user.id, 'free_roam').success, false, 'cannot invite yourself');
  assert.equal(SocialService.invite(a.user.id, 'usr_nope', 'free_roam').success, false, 'unknown target rejected');
  assert.equal(SocialService.pendingInvites(stranger.user.id).length, 0, 'nothing was stored');
});

test('Invites: a blocked sender cannot reach you, without revealing the block', () => {
  const a = db.createUser('InvE', 'ie@x.io', 'hash', false);
  const b = db.createUser('InvF', 'if@x.io', 'hash', false);
  befriend(a, b);
  SocialService.block(b.user.id, a.user.id); // b blocks a (this also unfriends)
  const r = SocialService.invite(a.user.id, b.user.id, 'free_roam');
  assert.equal(r.success, false);
  assert.ok(!/block/i.test(r.message), 'the message must not confirm a block exists');
  assert.equal(SocialService.pendingInvites(b.user.id).length, 0);
});

test('Invites: re-inviting refreshes rather than stacking duplicates', () => {
  const a = db.createUser('InvG', 'ig@x.io', 'hash', false);
  const b = db.createUser('InvH', 'ih@x.io', 'hash', false);
  befriend(a, b);
  SocialService.invite(a.user.id, b.user.id, 'free_roam');
  SocialService.invite(a.user.id, b.user.id, 'team');
  const pending = SocialService.pendingInvites(b.user.id);
  assert.equal(pending.length, 1, 'one invite per sender');
  assert.equal(pending[0].mode, 'team', 'the newest mode wins');
});

test('Invites: accepting returns the mode and consumes the invite', () => {
  const a = db.createUser('InvI', 'ii@x.io', 'hash', false);
  const b = db.createUser('InvJ', 'ij@x.io', 'hash', false);
  befriend(a, b);
  SocialService.invite(a.user.id, b.user.id, 'battle_royale');
  const id = SocialService.pendingInvites(b.user.id)[0].id;

  const accepted = SocialService.respondToInvite(b.user.id, id, 'accept');
  assert.equal(accepted.success, true);
  assert.equal(accepted.mode, 'battle_royale', 'client is told which mode to launch');
  assert.equal(SocialService.pendingInvites(b.user.id).length, 0, 'invite consumed');
  // It cannot be actioned twice.
  assert.equal(SocialService.respondToInvite(b.user.id, id, 'accept').success, false);
});

test('Invites: declining consumes it without launching anything', () => {
  const a = db.createUser('InvK', 'ik@x.io', 'hash', false);
  const b = db.createUser('InvL', 'il@x.io', 'hash', false);
  befriend(a, b);
  SocialService.invite(a.user.id, b.user.id, 'free_roam');
  const id = SocialService.pendingInvites(b.user.id)[0].id;
  const declined = SocialService.respondToInvite(b.user.id, id, 'decline');
  assert.equal(declined.success, true);
  assert.equal(declined.mode, undefined, 'declining launches nothing');
  assert.equal(SocialService.pendingInvites(b.user.id).length, 0);
});

test("Invites: you cannot action someone else's invite", () => {
  const a = db.createUser('InvM', 'im@x.io', 'hash', false);
  const b = db.createUser('InvN', 'in@x.io', 'hash', false);
  const c = db.createUser('InvO', 'io@x.io', 'hash', false);
  befriend(a, b);
  SocialService.invite(a.user.id, b.user.id, 'free_roam');
  const id = SocialService.pendingInvites(b.user.id)[0].id;
  // C guesses the id — invites are looked up within the caller's own inbox, so it misses.
  assert.equal(SocialService.respondToInvite(c.user.id, id, 'accept').success, false);
  assert.equal(SocialService.pendingInvites(b.user.id).length, 1, "the real recipient's invite is untouched");
});

test('Invites: expired invites are pruned and an unknown mode is normalised', () => {
  const a = db.createUser('InvP', 'ip@x.io', 'hash', false);
  const b = db.createUser('InvQ', 'iq@x.io', 'hash', false);
  befriend(a, b);
  // A client-supplied garbage mode must not end up stored.
  SocialService.invite(a.user.id, b.user.id, 'not_a_real_mode');
  assert.equal(SocialService.pendingInvites(b.user.id)[0].mode, 'free_roam');

  // Age it past its TTL — reads prune, so no sweeper is needed.
  const stored = db.getMatchInvites(b.user.id);
  stored[0].expiresAt = Date.now() - 1;
  assert.equal(SocialService.pendingInvites(b.user.id).length, 0, 'expired invite disappears');
});

test('Invites: an inbox cannot grow without bound', () => {
  const target = db.createUser('InvTarget', 'it@x.io', 'hash', false);
  for (let i = 0; i < 26; i++) {
    const sender = db.createUser(`InvSender${i}`, `is${i}@x.io`, 'hash', false);
    befriend(sender, target);
    SocialService.invite(sender.user.id, target.user.id, 'free_roam');
  }
  assert.ok(SocialService.pendingInvites(target.user.id).length <= 20, 'capped at 20 pending invites');
});

test('Invites: survive a restart (persisted with the snapshot)', () => {
  const a = db.createUser('InvPersistA', 'ipa@x.io', 'hash', false);
  const b = db.createUser('InvPersistB', 'ipb@x.io', 'hash', false);
  befriend(a, b);
  SocialService.invite(a.user.id, b.user.id, 'team');
  db.flush();

  delete require.cache[require.resolve(dist('db/Database.js'))];
  const { db: db2 } = require(dist('db/Database.js'));
  const reloaded = db2.getMatchInvites(b.user.id);
  assert.equal(reloaded.length, 1, 'invite survived the reload');
  assert.equal(reloaded[0].mode, 'team');
  assert.equal(reloaded[0].fromUserId, a.user.id);
});

// ---------------------------------------------------------------- SocialService (§sec)
test('Social: mutations reject unknown users and self-targeting', () => {
  const { user } = db.createUser('SocialSec', 'ss@x.io', 'hash', false);
  assert.equal(SocialService.block(user.id, 'usr_does_not_exist').success, false, 'unknown target rejected');
  assert.equal(SocialService.block(user.id, user.id).success, false, 'self-targeting rejected');
  assert.equal(SocialService.unfriend(user.id, 'usr_does_not_exist').success, false);
  assert.equal(SocialService.respond(user.id, 'usr_does_not_exist', 'accept').success, false);
  assert.equal(SocialService.unblock(user.id, '').success, false, 'empty id rejected');
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

// ---------------------------------------------------------------- Daily bonus + items (§V7 §9)
test('Items + daily bonus: grantItem accumulates; once-per-day gate', () => {
  const { user } = db.createUser('Daily', 'dl@x.io', 'hash', false);
  // grantItem is additive
  db.grantItem(user.id, 'rare_egg', 1);
  db.grantItem(user.id, 'rare_egg', 2);
  assert.equal(db.getProfile(user.id).inventory.rare_egg, 3);

  // Simulate the endpoint's core logic: complete all daily missions → grant once, block twice.
  const daily = db.getMissions(user.id).filter(m => m.category === 'daily');
  for (const m of daily) { m.currentCount = m.targetCount; m.isCompleted = true; }
  const allDone = daily.length > 0 && daily.every(m => m.isCompleted);
  assert.equal(allDone, true);
  const today = new Date().toISOString().slice(0, 10);
  // First claim
  assert.notEqual(db.getProfile(user.id).lastDailyBonus, today);
  db.grantItem(user.id, 'rare_egg', 1);
  db.updateProfile(user.id, { lastDailyBonus: today });
  assert.equal(db.getProfile(user.id).lastDailyBonus, today); // gate now set → second claim blocked
  assert.equal(db.getProfile(user.id).inventory.rare_egg, 4);
});

// ---------------------------------------------------------------- StatsService (§V7)
test('Stats: recordMatch updates general + mode stats + history + derived', () => {
  const { user } = db.createUser('StatPlayer', 'st@x.io', 'hash', false);
  const r = StatsService.recordMatch(user.id, {
    score: 1200, kills: 4, deaths: 1, placement: 1, survivalSeconds: 90,
    cherriesEaten: 20, frogsEaten: 3, starsCollected: 50, mode: 'battle_royale', map: 'volcano',
  }, null);
  assert.ok(r && r.profile);
  const st = db.getProfile(user.id).stats;
  assert.equal(st.matchesPlayed, 1);
  assert.equal(st.matchesWon, 1);      // placement 1 = win
  assert.equal(st.totalKills, 4);
  assert.equal(st.highestScore, 1200);
  assert.equal(st.cherriesCollected, 20);
  assert.equal(st.totalStars, 50);
  // Mode-specific stats recorded under battle_royale, incl. top-3 + best rank
  const ms = db.getProfile(user.id).modeStats.battle_royale;
  assert.equal(ms.matchesPlayed, 1);
  assert.equal(ms.wins, 1);
  assert.equal(ms.top3, 1);
  assert.equal(ms.highestRank, 1);
  // Derived win rate + K/D
  const d = StatsService.derive(db.getProfile(user.id).stats);
  assert.equal(d.winRate, 100);
  assert.equal(d.kd, 4);
  // Match history persisted
  const hist = db.getMatchHistory(user.id);
  assert.equal(hist.length, 1);
  assert.equal(hist[0].result, 'win');
  assert.equal(hist[0].mode, 'battle_royale');
});

test('Stats: server peak bounds a lying client (anti-cheat, §11)', () => {
  const { user } = db.createUser('Cheater', 'ch@x.io', 'hash', false);
  // Client claims 99999 score / 80 kills, but the server only observed 300 / 2.
  const r = StatsService.recordMatch(user.id, { score: 99999, kills: 80, placement: 5, survivalSeconds: 999 },
    { score: 300, kills: 2, killStreak: 2, survivalSeconds: 40 });
  assert.equal(r.authoritative.score, 300, 'score bounded to server-observed peak');
  assert.equal(r.authoritative.kills, 2, 'kills bounded to server-observed peak');
  assert.ok(r.authoritative.survivalSeconds <= 40);
});

test('Stats: category leaderboards rank by metric', () => {
  const { user: hi } = db.createUser('TopScorer', 'ts2@x.io', 'hash', false);
  StatsService.recordMatch(hi.id, { score: 9000, kills: 10, placement: 1, survivalSeconds: 200 }, null);
  const board = db.getCategoryLeaderboard('kills', 100);
  assert.ok(Array.isArray(board) && board.length >= 1);
  assert.equal(board[0].rank, 1);
  // Sorted descending by value
  for (let i = 1; i < board.length; i++) assert.ok(board[i - 1].value >= board[i].value);
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
