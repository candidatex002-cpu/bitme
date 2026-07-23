export interface UserAccount {
  id: string;
  username: string;
  email: string;
  passwordHash?: string;
  isGuest: boolean;
  createdAt: string;
  mfaEnabled?: boolean;
}

export type Evolution = 'Baby' | 'Young' | 'Teen' | 'Adult' | 'Elite' | 'Titan' | 'Legend';

// Score thresholds that drive in-match visual stage (separate from permanent Evolution XP ladder)
export const SCORE_EVOLUTION_THRESHOLDS: Array<{ stage: Evolution; scoreMin: number }> = [
  { stage: 'Baby',   scoreMin: 0 },
  { stage: 'Young',  scoreMin: 500 },
  { stage: 'Teen',   scoreMin: 1000 },
  { stage: 'Adult',  scoreMin: 1500 },
  { stage: 'Elite',  scoreMin: 2000 },
  { stage: 'Titan',  scoreMin: 2500 },
];

export type AccessorySlot = 'hat' | 'neck' | 'back';

export interface Accessory {
  id: string;
  name: string;
  icon: string;
  slot: AccessorySlot;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  seasonal?: boolean;
}

export interface PlayerProfile {
  userId: string;
  displayName: string;
  avatarUrl: string;
  level: number;         // Account Level 1-1000 (permanent, cross-device)
  xp: number;            // XP toward the next account level
  evolutionXp: number;   // separate currency that gates snake evolutions
  prestige: number;      // prestige stars earned after hitting level 1000
  rating: number;        // Elo / MMR rating
  stars: number;         // Primary soft currency
  tickets: number;       // Premium battle pass tickets
  equippedSkin: string;
  equippedEvolution: Evolution;
  unlockedEvolutions: Evolution[];
  equippedTrail: string;
  equippedAccessory?: string;    // cosmetic accessory id
  unlockedAccessories: string[]; // list of owned accessory ids
  stats: PlayerStats;
  coupons?: CouponReward[];
}

export interface PlayerStats {
  matchesPlayed: number;
  matchesWon: number;
  totalKills: number;
  totalFoodEaten: number;
  highestScore: number;
  survivalTimeSeconds: number;
  cherriesCollected?: number;
  bossKills?: number;
}

export interface Vector2D {
  x: number;
  y: number;
}

export interface SnakeSegment {
  x: number;
  y: number;
}

export type GameMode = 'classic' | 'battle_royale' | 'team' | 'event';

export type GrowthStage = 'Baby' | 'Young' | 'Teen' | 'Adult' | 'Elite' | 'Titan';

export interface SnakeState {
  id: string;
  userId: string;
  displayName: string;
  skin: string;
  head: Vector2D;
  body: SnakeSegment[];
  angle: number;
  speed: number;
  speedPct: number;      // 0-100 display value for the SPEED stat
  boosting: boolean;
  score: number;
  level: number;
  length: number;
  radius: number;
  hp: number;
  maxHp: number;
  defense: number;       // DEFENSE stat: % incoming damage reduction
  stage: GrowthStage;    // in-match SIZE tier derived from score
  evolution: string;     // displayed account evolution form (players) / size tier (bots)
  region?: string;       // matchmaking region label (display only)
  isAlive: boolean;
  isAutoProtectAI: boolean;
  autoProtectTimer: number;
  kills: number;
  // Active buffs / abilities (server-authoritative timers, in seconds)
  shieldTimer: number;       // invulnerability remaining
  speedBoostTimer: number;   // temporary speed buff remaining
  abilityCooldown: number;   // time until ability can be used again
  abilityActiveTimer: number;// ability effect remaining
  activeBuff?: string;
  team?: 'red' | 'blue';
  distanceTravelled: number; // metres (world units / 100)
  isBot?: boolean;
  isBoss?: boolean;
}

export type CollectibleType =
  | 'cherry'
  | 'apple'
  | 'mushroom'
  | 'frog'
  | 'mouse'
  | 'lizard'
  | 'egg'
  | 'star'
  | 'shield'
  | 'speed'
  | 'crystal'
  | 'coupon_box'
  | 'super_star'
  | 'snake_remains'
  | 'boss_drop';

export interface FoodItem {
  id: string;
  x: number;
  y: number;
  value: number;
  type: CollectibleType;
  color: string;
  icon?: string;
  hpRestore?: number;
  buff?: 'shield' | 'speed';   // active power-up granted on pickup
  buffDuration?: number;       // seconds
  couponData?: CouponReward;
}

export interface SafeZone {
  centerX: number;
  centerY: number;
  radius: number;
  targetRadius: number;
  shrinkRate: number;
  damagePerSecond: number;
}

export interface WorldEvent {
  id: string;
  type: 'rain_storm' | 'volcano_eruption' | 'boss_anaconda_raid' | 'treasure_balloon';
  title: string;
  description: string;
  active: boolean;
  timerSeconds: number;
  icon: string;
}

export interface CouponReward {
  id: string;
  storeName: string;
  discountText: string;
  promoCode: string;
  expiryDate: string;
  icon: string;
}

export type ProgressMetric =
  | 'cherry' | 'apple' | 'frog' | 'star' | 'egg' | 'kill' | 'treasure'
  | 'heal' | 'shield' | 'boost' | 'win'
  | 'distance' | 'match' | 'survive' | 'score' | 'explore';

export interface Achievement {
  id: string;
  title: string;
  description: string;
  tier: 'bronze' | 'silver' | 'gold' | 'diamond' | 'legend';
  metric: ProgressMetric;
  target: number;
  progress: number;
  isUnlocked: boolean;
  rewardStars: number;
  icon: string;
}

export type MatchType = 'local' | 'global';

export interface RankInfo {
  tier: string;      // Bronze / Silver / Gold / Platinum / Diamond / Master / Legend
  division: string;  // III / II / I
  label: string;     // "Silver III"
  color: string;
}

export interface EvolutionRequirement {
  evolution: Evolution;
  level: number;
  evoXp: number;
}

export interface GameModeConfig {
  mode: GameMode;
  label: string;
  tagline: string;
  shrinkingZone: boolean;   // battle royale style storm
  teamsEnabled: boolean;    // 4v4 team mode
  worldEvents: boolean;     // dynamic world events
  botCount: number;
}

export interface GameWorldState {
  matchId: string;
  mode: GameMode;
  region: string;
  status: 'waiting' | 'in_progress' | 'ended';
  tick: number;
  worldSize: number;
  safeZone: SafeZone;
  snakes: Record<string, SnakeState>;
  food: Record<string, FoodItem>;
  leaderboard: Array<{ id: string; name: string; score: number; kills: number; team?: 'red' | 'blue' }>;
  teamScores?: { red: number; blue: number };
  currentEvent?: WorldEvent;
}

export interface ClientInputPacket {
  seq: number;
  angle: number;
  boosting: boolean;
  timestamp: number;
}

export interface AntiCheatViolation {
  userId: string;
  timestamp: string | number;
  type?: string;
  rule?: string;
  actionTaken?: string;
  severity: string;
  details: string;
}

export interface MissionObjective {
  id: string;
  title: string;
  description: string;
  category: 'daily' | 'weekly' | 'event';
  metric: ProgressMetric;
  icon: string;
  targetCount: number;
  currentCount: number;
  rewardStars: number;
  rewardXP: number;
  rewardEvoXP: number;
  isCompleted: boolean;
  isClaimed: boolean;
}

export interface AdminTelemetry {
  activeInstances: number;
  activeMatches?: number;
  activeSockets: number;
  connectedPlayers?: number;
  totalPlayersOnline: number;
  serverTickRateHz: number;
  serverTickMs?: number;
  memoryUsageMb: number;
  cpuUsagePct?: number;
  cpuUsagePercent?: number;
  antiCheatFlagsCount?: number;
  uptimeSeconds: number;
}

export interface GameEventNotification {
  id: string;
  type: 'kill' | 'boss_spawn' | 'event_start' | 'coupon_found';
  message: string;
  timestamp: number;
}
