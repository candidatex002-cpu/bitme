import { db } from '../db/Database';
import { presence } from './Presence';
import { MatchInvite } from '../types';

// §8 Server-authoritative social graph: friend requests, accept/reject, unfriend, block,
// and live online/offline status. Everything is persisted (survives restart + cloud sync);
// the client holds no source-of-truth friend state.

export interface FriendView {
  id: string;
  name: string;
  avatar: string;
  level: number;
  online: boolean;
}

type Result = { success: boolean; message: string };

export class SocialService {
  // §sec Every mutation takes a user id straight off the request body. Without this the
  // endpoints would happily create and mutate social graphs for ids that were never real
  // accounts, and let a caller act on themselves to corrupt their own graph.
  private static validTarget(userId: string, otherId: string): Result | null {
    if (!otherId || typeof otherId !== 'string') return { success: false, message: 'A player is required' };
    if (otherId === userId) return { success: false, message: "You can't do that to yourself" };
    if (!db.getUserById(otherId)) return { success: false, message: 'No player found' };
    return null;
  }

  private static profileCard(userId: string): FriendView {
    const user = db.getUserById(userId);
    const profile = db.getProfile(userId);
    return {
      id: userId,
      name: profile?.displayName || user?.username || 'Explorer',
      avatar: (profile as any)?.avatar || '🐍',
      level: profile?.level || 1,
      online: presence.isOnline(userId),
    };
  }

  // Everything the Social screen needs in one call.
  static overview(userId: string) {
    const g = db.getSocial(userId);
    return {
      // Your own shareable code, so the Social screen can show "here's my ID" without a
      // second request. Only ever your own — never anyone else's.
      myFriendCode: db.getProfile(userId)?.friendCode || '',
      friends: g.friends.map(id => this.profileCard(id)).sort((a, b) => Number(b.online) - Number(a.online)),
      incoming: g.incoming.map(id => this.profileCard(id)),
      outgoing: g.outgoing.map(id => this.profileCard(id)),
      blocked: g.blocked.map(id => this.profileCard(id)),
    };
  }

  // Add someone by their exact username OR their shareable friend code ("AP-XXXX-XXXX").
  // The friend code is the id players can actually pass around: internal account ids are
  // never published, so a code is the only safe way to say "add me".
  static sendRequest(userId: string, query: string): Result {
    const raw = String(query || '').trim();
    if (!raw) return { success: false, message: 'Enter a username or friend code' };

    let targetId: string | undefined;
    // A friend code is unambiguous, so try it first — an 8-char code can't collide with the
    // username namespace in a way that matters, and it never leaks whether a username exists.
    const byCode = db.getProfileByFriendCode(raw);
    if (byCode) targetId = byCode.userId;
    else targetId = db.getUserByUsername(raw)?.id;

    if (!targetId) return { success: false, message: 'No player found with that name or friend code' };
    const target = db.getUserById(targetId)!;
    if (target.id === userId) return { success: false, message: "You can't add yourself" };

    const me = db.getSocial(userId);
    const them = db.getSocial(target.id);
    if (me.blocked.includes(target.id)) return { success: false, message: 'Unblock this player first' };
    if (them.blocked.includes(userId)) return { success: false, message: 'Unable to send request' };
    if (me.friends.includes(target.id)) return { success: false, message: 'Already friends' };
    if (me.outgoing.includes(target.id)) return { success: false, message: 'Request already sent' };

    // If they already invited us, sending back auto-accepts.
    if (me.incoming.includes(target.id)) {
      return this.respond(userId, target.id, 'accept');
    }
    me.outgoing.push(target.id);
    them.incoming.push(userId);
    db.saveSocial();
    return { success: true, message: `Friend request sent to ${target.username}` };
  }

  static respond(userId: string, otherId: string, action: 'accept' | 'reject'): Result {
    const invalid = this.validTarget(userId, otherId); if (invalid) return invalid;
    const me = db.getSocial(userId);
    const them = db.getSocial(otherId);
    if (!me.incoming.includes(otherId)) return { success: false, message: 'No pending request from this player' };
    me.incoming = me.incoming.filter(id => id !== otherId);
    them.outgoing = them.outgoing.filter(id => id !== userId);
    if (action === 'accept') {
      if (!me.friends.includes(otherId)) me.friends.push(otherId);
      if (!them.friends.includes(userId)) them.friends.push(userId);
      db.saveSocial();
      return { success: true, message: 'Friend added' };
    }
    db.saveSocial();
    return { success: true, message: 'Request declined' };
  }

  static unfriend(userId: string, otherId: string): Result {
    const invalid = this.validTarget(userId, otherId); if (invalid) return invalid;
    const me = db.getSocial(userId);
    const them = db.getSocial(otherId);
    me.friends = me.friends.filter(id => id !== otherId);
    them.friends = them.friends.filter(id => id !== userId);
    db.saveSocial();
    return { success: true, message: 'Removed friend' };
  }

  // Block also severs any friendship/pending request in both directions.
  static block(userId: string, otherId: string): Result {
    const invalid = this.validTarget(userId, otherId); if (invalid) return invalid;
    const me = db.getSocial(userId);
    const them = db.getSocial(otherId);
    me.friends = me.friends.filter(id => id !== otherId);
    them.friends = them.friends.filter(id => id !== userId);
    me.incoming = me.incoming.filter(id => id !== otherId);
    me.outgoing = me.outgoing.filter(id => id !== otherId);
    them.incoming = them.incoming.filter(id => id !== userId);
    them.outgoing = them.outgoing.filter(id => id !== userId);
    if (!me.blocked.includes(otherId)) me.blocked.push(otherId);
    db.saveSocial();
    return { success: true, message: 'Player blocked' };
  }

  static unblock(userId: string, otherId: string): Result {
    const invalid = this.validTarget(userId, otherId); if (invalid) return invalid;
    const me = db.getSocial(userId);
    me.blocked = me.blocked.filter(id => id !== otherId);
    db.saveSocial();
    return { success: true, message: 'Player unblocked' };
  }

  // Match invites are only valid between friends. Returns a distinct reason per failure —
  // "not your friend" and "no longer exists" need very different fixes from the player's side,
  // and one blended message made the feature look broken.
  //
  // Being offline is NOT a failure any more: the invite is stored and handed over the moment
  // they next connect (see `invite`).
  static canInvite(userId: string, otherId: string): { ok: boolean; message: string } {
    if (!otherId || !db.getUserById(otherId)) return { ok: false, message: 'That player no longer exists' };
    if (otherId === userId) return { ok: false, message: "You can't invite yourself" };
    if (!db.getSocial(userId).friends.includes(otherId)) {
      return { ok: false, message: 'You can only invite friends — add them first with their friend code' };
    }
    if (db.getSocial(otherId).blocked.includes(userId)) {
      // Don't confirm the block — that would leak the other player's moderation choice.
      return { ok: false, message: 'Unable to invite this player' };
    }
    return { ok: true, message: 'Invite sent' };
  }

  private static readonly VALID_MODES = ['free_roam', 'explorer', 'battle_royale', 'team', 'nokia', 'event'];

  // Send an invite. Always stored (so it survives the recipient being away); the caller
  // pushes it live as well when they happen to be connected.
  static invite(userId: string, otherId: string, mode: string): { success: boolean; message: string; invite?: MatchInvite; online: boolean } {
    const gate = this.canInvite(userId, otherId);
    if (!gate.ok) return { success: false, message: gate.message, online: false };

    const safeMode = this.VALID_MODES.includes(mode) ? mode : 'free_roam';
    const me = this.profileCard(userId);
    const invite = db.addMatchInvite({
      fromUserId: userId, fromName: me.name, fromAvatar: me.avatar,
      toUserId: otherId, mode: safeMode,
    });

    const online = presence.isOnline(otherId);
    const them = this.profileCard(otherId).name;
    return {
      success: true,
      message: online ? `Invite sent to ${them}` : `${them} is offline — they'll see your invite when they next play`,
      invite, online,
    };
  }

  // Everything the recipient needs to render their invite list.
  static pendingInvites(userId: string) {
    return db.getMatchInvites(userId).map(i => ({
      id: i.id,
      fromName: i.fromName,
      fromAvatar: i.fromAvatar,
      mode: i.mode,
      createdAt: i.createdAt,
      expiresAt: i.expiresAt,
      // The sender may have gone offline since — the UI uses this to decide whether
      // accepting is likely to actually put them in a match together.
      fromOnline: presence.isOnline(i.fromUserId),
    }));
  }

  // Accept or decline. Accepting returns the mode so the client can launch straight into it;
  // either way the invite is consumed so it can't be actioned twice.
  static respondToInvite(userId: string, inviteId: string, action: 'accept' | 'decline'): { success: boolean; message: string; mode?: string } {
    const invite = db.getMatchInvite(userId, inviteId);
    if (!invite) return { success: false, message: 'That invite has expired or was already handled' };
    db.removeMatchInvite(userId, inviteId);
    if (action === 'decline') return { success: true, message: 'Invite declined' };
    return { success: true, message: `Joining ${invite.fromName}`, mode: invite.mode };
  }
}
