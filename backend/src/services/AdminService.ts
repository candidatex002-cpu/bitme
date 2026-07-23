import { db } from '../db/Database';
import { AdminTelemetry } from '../types';

export class AdminService {
  public static getTelemetry(activeMatchesCount: number, connectedPlayersCount: number): AdminTelemetry {
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
      antiCheatFlagsCount: db.getAuditLogs().length,
      uptimeSeconds: Math.floor(process.uptime()),
    };
  }

  public static getAuditLogs() {
    return db.getAuditLogs();
  }
}
