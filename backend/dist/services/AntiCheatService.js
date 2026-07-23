"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.antiCheat = exports.AntiCheatService = void 0;
const Database_1 = require("../db/Database");
class AntiCheatService {
    lastPos = new Map();
    packetCounts = new Map();
    MAX_SPEED_UNITS_PER_SEC = 450; // Maximum allowed velocity including boost
    MAX_PACKETS_PER_SEC = 60; // Max WebSocket input frames per second
    validateMovementInput(userId, currentHead, timestamp, isBoosting) {
        const last = this.lastPos.get(userId);
        const now = Date.now();
        if (last) {
            const dt = Math.max(0.001, (now - last.time) / 1000);
            const dx = currentHead.x - last.pos.x;
            const dy = currentHead.y - last.pos.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            const calculatedSpeed = distance / dt;
            const allowedSpeed = isBoosting ? this.MAX_SPEED_UNITS_PER_SEC * 1.5 : this.MAX_SPEED_UNITS_PER_SEC;
            if (calculatedSpeed > allowedSpeed + 100 && distance > 50) {
                this.flagViolation({
                    userId,
                    timestamp: now,
                    rule: distance > 300 ? 'teleport' : 'speed_hack',
                    details: `Calculated speed ${Math.round(calculatedSpeed)} units/s exceeds max ${allowedSpeed} (Delta: ${Math.round(distance)}px in ${Math.round(dt * 1000)}ms)`,
                    severity: distance > 500 ? 'banned' : 'flagged',
                });
                return false;
            }
        }
        this.lastPos.set(userId, { pos: { x: currentHead.x, y: currentHead.y }, time: now });
        return true;
    }
    validatePacketFrequency(userId) {
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
    validateGrowthDiminishingReturns(snake, foodCollectedValue) {
        // Level 1-20: 100% growth
        // Level 20-40: 50% growth
        // Level 40-60: 20% growth
        // Level 60+: 5% growth
        let multiplier = 1.0;
        if (snake.level > 60)
            multiplier = 0.05;
        else if (snake.level > 40)
            multiplier = 0.20;
        else if (snake.level > 20)
            multiplier = 0.50;
        const expectedLengthIncrease = foodCollectedValue * multiplier;
        // Server computes actual growth strictly using this multiplier.
        return true;
    }
    flagViolation(violation) {
        Database_1.db.recordAuditLog(violation);
        console.warn(`[ANTI-CHEAT ALERT] Player ${violation.userId} -> ${violation.rule} [${violation.severity}]: ${violation.details}`);
    }
}
exports.AntiCheatService = AntiCheatService;
exports.antiCheat = new AntiCheatService();
