export type GamePhase = 'title' | 'playing' | 'paused' | 'upgrade' | 'gameover';

export type Difficulty = 'standard' | 'ace';

export type EnemyKind = 'skirmisher' | 'lancer' | 'bastion' | 'weaver' | 'titan';

export type UpgradeId =
  | 'twin_cannon'
  | 'chain_dash'
  | 'reflect_aegis'
  | 'overclock_wings'
  | 'solar_magnet'
  | 'nova_capacitor'
  | 'hull_plating';

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
}

export interface RunSummary {
  outcome: 'victory' | 'defeat';
  score: number;
  bestScore: number;
  waveReached: number;
  enemiesDefeated: number;
  shotsReflected: number;
  clearTimeSeconds: number;
  damageTaken: number;
  bossHpRemainingPct: number;
  difficulty: Difficulty;
}
