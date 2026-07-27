import { GameMode } from '../types';
import { GameSessionService } from './GameSessionService';

// Keeps one authoritative simulation per game mode and spins them up on demand.
export class GameSessionManager {
  private sessions: Map<GameMode, GameSessionService> = new Map();

  public getSession(mode: GameMode): GameSessionService {
    let session = this.sessions.get(mode);
    if (!session) {
      session = new GameSessionService(`match_${mode}_${Date.now()}`, mode);
      this.sessions.set(mode, session);
      console.log(`[SESSION] Spun up authoritative simulation for mode "${mode}".`);
    }
    return session;
  }

  public findPlayerSession(userId: string): GameSessionService | undefined {
    for (const session of this.sessions.values()) {
      if (session.getState().snakes[userId]) return session;
    }
    return undefined;
  }

  public getActiveSessions(): GameSessionService[] {
    return Array.from(this.sessions.values());
  }

  public getActiveModeCount(): number {
    return this.sessions.size;
  }

  // Tear down every simulation this manager owns (shutdown / tests).
  public stopAll(): void {
    for (const session of this.sessions.values()) session.stop();
    this.sessions.clear();
  }

  // §V7/P1 Read + clear a player's server-observed peak stats from whichever session holds them.
  public consumePlayerPeak(userId: string): { score: number; kills: number; killStreak: number; survivalSeconds: number } | null {
    for (const session of this.sessions.values()) {
      const peak = session.consumePeakStats(userId);
      if (peak) return peak;
    }
    return null;
  }
}

export const sessionManager = new GameSessionManager();
