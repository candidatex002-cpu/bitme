import { AntiCheatViolation } from '../types';
import { db } from '../db/Database';

// Server-side abuse detection.
//
// This is an authoritative-server design: clients send an *angle and a boost flag*, nothing
// else. The server computes every position itself, so there is no such thing as a client
// "position" to validate — a speed/teleport check over server-owned coordinates would only
// ever flag the simulation's own wormhole teleports. What a client CAN forge is the shape of
// its input stream and the numbers it reports when a match ends, so those are what we police:
//
//   1. Input flooding      — more input frames per second than any real client produces.
//   2. Match-result pacing — claiming more match time than has actually elapsed in wall clock,
//                            which is how a scripted client would farm rewards by replaying
//                            /api/match/summary in a loop.
export class AntiCheatService {
  private packetCounts: Map<string, { count: number; windowStart: number }> = new Map();
  // Last accepted match submission per user: when it landed and how much play it claimed.
  private lastMatchSubmit: Map<string, { at: number; claimedSeconds: number }> = new Map();

  private readonly MAX_PACKETS_PER_SEC = 60; // Max WebSocket input frames per second
  // A submission must be separated from the previous one by at least this much real time,
  // regardless of what it claims — stops a tight replay loop. Kept well under the fastest
  // legitimate cycle (a match-again is gated by ~2.3s of matchmaking plus actual play), since
  // the claimed-vs-elapsed rule below is what does the real work.
  private readonly MIN_SUBMIT_GAP_MS = 2_000;
  // Tolerance on the claimed-vs-elapsed check: menus, the summary screen and clock skew all
  // mean real elapsed time is normally *longer* than claimed, never meaningfully shorter.
  private readonly SUBMIT_GRACE_MS = 30_000;

  public validatePacketFrequency(userId: string): boolean {
    const now = Date.now();
    const tracker = this.packetCounts.get(userId) || { count: 0, windowStart: now };

    if (now - tracker.windowStart > 1000) {
      this.packetCounts.set(userId, { count: 1, windowStart: now });
      return true;
    }

    tracker.count++;
    this.packetCounts.set(userId, tracker);

    if (tracker.count > this.MAX_PACKETS_PER_SEC) {
      this.flagViolation({
        userId,
        timestamp: now,
        rule: 'packet_flood',
        details: `Sent ${tracker.count} packets/sec, exceeding rate limit of ${this.MAX_PACKETS_PER_SEC}`,
        severity: 'warning',
      });
      return false;
    }

    return true;
  }

  // Gate on /api/match/summary. `consumePlayerPeak` clears a player's server-observed peak
  // after the first submission, so a second call for the same life would be graded purely on
  // client-reported numbers — a scripted client could otherwise replay the endpoint and mint
  // the maximum clamped reward on every call. Time is the thing it cannot fake: you cannot
  // finish two 3-minute matches inside ten seconds.
  public validateMatchSubmission(userId: string, claimedSurvivalSeconds: number): { ok: boolean; reason?: string; retryAfterMs?: number } {
    const now = Date.now();
    const prev = this.lastMatchSubmit.get(userId);

    if (prev) {
      const sinceMs = now - prev.at;
      if (sinceMs < this.MIN_SUBMIT_GAP_MS) {
        this.flagViolation({
          userId, timestamp: now, rule: 'match_spam',
          details: `Submitted two match results ${sinceMs}ms apart (minimum ${this.MIN_SUBMIT_GAP_MS}ms)`,
          severity: 'warning',
        });
        return { ok: false, reason: 'Match results submitted too quickly', retryAfterMs: this.MIN_SUBMIT_GAP_MS - sinceMs };
      }
      // THIS match was necessarily played after the previous one was submitted, so its claimed
      // duration has to fit inside the real gap between the two submissions. (Checking the
      // *previous* match's duration here would be wrong — that time elapsed before its own
      // submission, and doing so rejected an honest short match after a long one.)
      const requiredMs = claimedSurvivalSeconds * 1000;
      if (requiredMs > sinceMs + this.SUBMIT_GRACE_MS) {
        this.flagViolation({
          userId, timestamp: now, rule: 'impossible_playtime',
          details: `Claimed a ${claimedSurvivalSeconds}s match but only ${Math.round(sinceMs / 1000)}s elapsed since the previous result`,
          severity: 'flagged',
        });
        this.lastMatchSubmit.set(userId, { at: now, claimedSeconds: claimedSurvivalSeconds });
        return { ok: false, reason: 'Reported match duration exceeds elapsed time' };
      }
    }

    this.lastMatchSubmit.set(userId, { at: now, claimedSeconds: claimedSurvivalSeconds });
    return { ok: true };
  }

  // Drop tracking for a user (disconnect / test teardown) so the maps stay bounded.
  public forget(userId: string) {
    this.packetCounts.delete(userId);
    this.lastMatchSubmit.delete(userId);
  }

  private flagViolation(violation: AntiCheatViolation) {
    db.recordAuditLog(violation);
    console.warn(`[ANTI-CHEAT ALERT] Player ${violation.userId} -> ${violation.rule} [${violation.severity}]: ${violation.details}`);
  }
}

export const antiCheat = new AntiCheatService();
