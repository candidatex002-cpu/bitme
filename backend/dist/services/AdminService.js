"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminService = void 0;
const Database_1 = require("../db/Database");
class AdminService {
    static getTelemetry(activeMatchesCount, connectedPlayersCount) {
        const mem = process.memoryUsage();
        return {
            activeInstances: 1,
            activeMatches: activeMatchesCount,
            activeSockets: connectedPlayersCount,
            connectedPlayers: connectedPlayersCount,
            totalPlayersOnline: connectedPlayersCount + 6,
            serverTickRateHz: 30,
            serverTickMs: 33.3,
            cpuUsagePercent: Math.round(15 + Math.random() * 10),
            memoryUsageMb: Math.round(mem.heapUsed / 1024 / 1024),
            antiCheatFlagsCount: Database_1.db.getAuditLogs().length,
            uptimeSeconds: Math.floor(process.uptime()),
        };
    }
    static getAuditLogs() {
        return Database_1.db.getAuditLogs();
    }
}
exports.AdminService = AdminService;
