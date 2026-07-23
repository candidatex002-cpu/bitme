"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sessionManager = exports.GameSessionManager = void 0;
const GameSessionService_1 = require("./GameSessionService");
// Keeps one authoritative simulation per game mode and spins them up on demand.
class GameSessionManager {
    sessions = new Map();
    getSession(mode) {
        let session = this.sessions.get(mode);
        if (!session) {
            session = new GameSessionService_1.GameSessionService(`match_${mode}_${Date.now()}`, mode);
            this.sessions.set(mode, session);
            console.log(`[SESSION] Spun up authoritative simulation for mode "${mode}".`);
        }
        return session;
    }
    findPlayerSession(userId) {
        for (const session of this.sessions.values()) {
            if (session.getState().snakes[userId])
                return session;
        }
        return undefined;
    }
    getActiveSessions() {
        return Array.from(this.sessions.values());
    }
    getActiveModeCount() {
        return this.sessions.size;
    }
}
exports.GameSessionManager = GameSessionManager;
exports.sessionManager = new GameSessionManager();
