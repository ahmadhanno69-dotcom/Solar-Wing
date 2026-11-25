export type GamePhase = 'title' | 'playing' | 'paused' | 'upgrade' | 'gameover';

export type Difficulty = 'cadet' | 'standard' | 'ace' | 'overdrive';

export type LevelId = 1 | 2 | 3;

export type EnemyKind =
  | 'skirmisher'
  | 'lancer'
  | 'bastion'
  | 'weaver'
  | 'sniper'
  | 'bomber'
  | 'warden'
  | 'titan'
  | 'empress'
  | 'dreadnought';

export type BossKind = 'titan' | 'empress' | 'dreadnought';

export interface LevelDef {
  id: LevelId;
  name: string;
  subtitle: string;
  startWave: number;
  endWave: number;
  bossKind: BossKind;
  bossName: string;
  accent: string;
  bgColor: string;
  horizonColor: string;
  gridColor: string;
  mechanicLabel: string;
}

export interface DifficultyDef {
  id: Difficulty;
  label: string;
  summary: string;
  baseHp: number;
  spawnMultiplier: number;
  speedMultiplier: number;
  scoreMultiplier: number;
  fireRateBonus: number;
  accent: string;
}

export type UpgradeId =
  | 'twin_cannon'
  | 'chain_dash'
  | 'reflect_aegis'
  | 'overclock_wings'
  | 'solar_magnet'
  | 'nova_capacitor'
  | 'hull_plating'
  | 'wingman_drone';

export interface UpgradeDef {
  id: UpgradeId;
  name: string;
  role: string;
  effect: string;
  maxStacks: number;
  accent: string;
}

export interface PlayerStats {
  maxHp: number;
  moveSpeed: number;
  fireRate: number; // shots per second
  projectileCount: number;
  projectileDamage: number;
  dashCooldown: number;
  dashDamage: number;
  reflectMultiplier: number;
  magnetRadius: number;
  novaChargeGain: number;
  wingmanCount: number;
}

export type AchievementId =
  | 'first_blood'
  | 'century_ace'
  | 'sky_legend'
  | 'perfect_wave_1'
  | 'perfect_wave_5'
  | 'reflect_25'
  | 'combo_8'
  | 'titan_slayer'
  | 'campaign_clear'
  | 'ace_clear'
  | 'sector_triumph'
  | 'nightmare_ace';

export interface MatchWinnerEntry {
  id: string;
  winner: string;
  winnerType: 'pilot' | 'bot';
  score: number;
  difficulty: Difficulty;
  levelId: LevelId;
  levelName: string;
  wave: number;
  outcome: 'victory' | 'defeat';
  recordedAt: string;
}

export interface CareerStats {
  totalEnemiesDefeated: number;
  perfectWaveClears: number;
  totalShotsReflected: number;
  titansDefeated: number;
  highestCombo: number;
  highestWave: number;
  bestScore: number;
  victories: number;
  aceVictories: number;
  overdriveVictories: number;
  clearedLevels: LevelId[];
  runsPlayed: number;
}

export interface AchievementDef {
  id: AchievementId;
  title: string;
  description: string;
  metricLabel: string;
  target: number;
  accent: string;
  getValue: (stats: CareerStats) => number;
}

export interface PlayerProgress {
  stats: CareerStats;
  unlocked: Partial<Record<AchievementId, string>>;
  matchHistory: MatchWinnerEntry[];
  updatedAt: string;
}

export interface HudSnapshot {
  phase: GamePhase;
  outcome: 'victory' | 'defeat' | null;
  hp: number;
  maxHp: number;
  ghostHp: number;
  score: number;
  bestScore: number;
  combo: number;
  comboTimerRatio: number; // 0..1
  wave: number;
  levelId: LevelId;
  levelName: string;
  targetVictoryWave: number;
  enemiesRemaining: number;
  dashReadyRatio: number; // 0..1
  novaCharge: number; // 0..100
  bossName: string | null;
  bossHpRatio: number; // 0..1
  bossHpText: string | null;
  upgradeChoices: UpgradeDef[];
  activeUpgrades: Record<UpgradeId, number>;
  isMuted: boolean;
  autoFire: boolean;
  wingmanCount: number;
  difficulty: Difficulty;
}

export interface RunSummary {
  outcome: 'victory' | 'defeat';
  score: number;
  bestScore: number;
  waveReached: number;
  levelId: LevelId;
  levelName: string;
  enemiesDefeated: number;
  shotsReflected: number;
  clearTimeSeconds: number;
  damageTaken: number;
  bossHpRemainingPct: number;
  difficulty: Difficulty;
  eliminatedBy: string | null;
  botScore: number;
  hasNextLevel: boolean;
}
