"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MissionService = void 0;
const Database_1 = require("../db/Database");
class MissionService {
    static getUserMissions(userId) {
        return Database_1.db.getMissions(userId);
    }
    static claimReward(userId, missionId) {
        return Database_1.db.claimMissionReward(userId, missionId);
    }
}
exports.MissionService = MissionService;
