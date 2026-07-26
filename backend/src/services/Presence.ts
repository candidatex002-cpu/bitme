// §8 Online presence — a live set of userIds with at least one connected socket.
// server.ts adds on authenticate and removes on the last socket's disconnect. SocialService
// reads it to report friends' online/offline status.

class PresenceTracker {
  private counts: Map<string, number> = new Map();

  add(userId: string) {
    this.counts.set(userId, (this.counts.get(userId) || 0) + 1);
  }

  remove(userId: string) {
    const n = (this.counts.get(userId) || 0) - 1;
    if (n <= 0) this.counts.delete(userId);
    else this.counts.set(userId, n);
  }

  isOnline(userId: string): boolean {
    return this.counts.has(userId);
  }

  onlineCount(): number {
    return this.counts.size;
  }
}

export const presence = new PresenceTracker();
