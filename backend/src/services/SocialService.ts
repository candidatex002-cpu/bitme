import { db } from '../db/Database';
import { presence } from './Presence';

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
      friends: g.friends.map(id => this.profileCard(id)).sort((a, b) => Number(b.online) - Number(a.online)),
      incoming: g.incoming.map(id => this.profileCard(id)),
      outgoing: g.outgoing.map(id => this.profileCard(id)),
      blocked: g.blocked.map(id => this.profileCard(id)),
    };
  }

  static sendRequest(userId: string, targetUsername: string): Result {
    const target = db.getUserByUsername(String(targetUsername || '').trim());
    if (!target) return { success: false, message: 'No player found with that name' };
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
    const me = db.getSocial(userId);
    const them = db.getSocial(otherId);
    me.friends = me.friends.filter(id => id !== otherId);
    them.friends = them.friends.filter(id => id !== userId);
    db.saveSocial();
    return { success: true, message: 'Removed friend' };
  }

  // Block also severs any friendship/pending request in both directions.
  static block(userId: string, otherId: string): Result {
    if (userId === otherId) return { success: false, message: "You can't block yourself" };
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
    const me = db.getSocial(userId);
    me.blocked = me.blocked.filter(id => id !== otherId);
    db.saveSocial();
    return { success: true, message: 'Player unblocked' };
  }

  // Match invites are only valid between friends (validated here; delivery is via socket).
  static canInvite(userId: string, otherId: string): boolean {
    return db.getSocial(userId).friends.includes(otherId) && presence.isOnline(otherId);
  }
}
