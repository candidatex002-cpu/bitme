// §8 Online presence — a live set of userIds with at least one connected socket.
// server.ts adds on authenticate and removes on the last socket's disconnect. SocialService
// reads it to report friends' online/offline status.

const HEARTBEAT_TTL_MS = 75 * 1000; // a lobby heartbeat keeps you "online" for 75s

class PresenceTracker {
  private counts: Map<string, number> = new Map();     // active gameplay sockets
  private lastSeen: Map<string, number> = new Map();   // §8 lobby HTTP heartbeats

  add(userId: string) {
    this.counts.set(userId, (this.counts.get(userId) || 0) + 1);
  }

  remove(userId: string) {
    const n = (this.counts.get(userId) || 0) - 1;
    if (n <= 0) this.counts.delete(userId);
    else this.counts.set(userId, n);
  }

  // Called from the lobby (any screen) so friends see you online outside of a match too.
  heartbeat(userId: string) {
    this.lastSeen.set(userId, Date.now());
  }

  // Online if a game socket is connected OR a recent lobby heartbeat exists.
  isOnline(userId: string): boolean {
    if (this.counts.has(userId)) return true;
    const t = this.lastSeen.get(userId);
    return !!t && Date.now() - t < HEARTBEAT_TTL_MS;
  }

  onlineCount(): number {
    const ids = new Set(this.counts.keys());
    const now = Date.now();
    for (const [id, t] of this.lastSeen) if (now - t < HEARTBEAT_TTL_MS) ids.add(id);
    return ids.size;
  }
}

export const presence = new PresenceTracker();
