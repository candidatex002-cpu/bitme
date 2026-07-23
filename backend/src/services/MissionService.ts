import { db } from '../db/Database';

export class MissionService {
  public static getUserMissions(userId: string) {
    return db.getMissions(userId);
  }

  public static claimReward(userId: string, missionId: string) {
    return db.claimMissionReward(userId, missionId);
  }
}
