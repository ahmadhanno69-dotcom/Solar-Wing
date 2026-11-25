import type {
  Difficulty,
  DifficultyDef,
  EnemyKind,
  LevelDef,
  LevelId,
  PlayerStats,
  UpgradeDef,
  UpgradeId,
} from './types';

export const ARENA_WIDTH = 2200;
export const ARENA_HEIGHT = 1400;
export const TARGET_VICTORY_WAVE = 3; // Waves per level (Level 1: 1-3, Level 2: 4-6, Level 3: 7-9)
export const COMBO_DECAY_SECONDS = 3.6;
export const MAX_COMBO = 8;

export const DIFFICULTY_CATALOG: DifficultyDef[] = [
  {
    id: 'cadet',
    label: 'Cadet',
    summary: '6 Hull · Wingman Escort · Relaxed Pace',
    baseHp: 6,
    spawnMultiplier: 0.82,
    speedMultiplier: 0.88,
    scoreMultiplier: 0.85,
    fireRateBonus: 1.12,
    accent: '#38bdf8',
  },
  {
    id: 'standard',
    label: 'Standard',
    summary: '5 Hull · Balanced Arena Combat',
    baseHp: 5,
    spawnMultiplier: 1.0,
    speedMultiplier: 1.0,
    scoreMultiplier: 1.0,
    fireRateBonus: 1.0,
    accent: '#f59e0b',
  },
  {
    id: 'ace',
    label: 'Ace Pilot',
    summary: '4 Hull · Faster Bots · +35% Score',
    baseHp: 4,
    spawnMultiplier: 1.22,
    speedMultiplier: 1.12,
    scoreMultiplier: 1.35,
    fireRateBonus: 1.0,
    accent: '#fb7185',
  },
  {
    id: 'overdrive',
    label: 'Nightmare',
    summary: '3 Hull · Swarm Surge · +75% Score',
    baseHp: 3,
    spawnMultiplier: 1.42,
    speedMultiplier: 1.24,
    scoreMultiplier: 1.75,
    fireRateBonus: 1.04,
    accent: '#c084fc',
  },
];

export function getDifficultyDef(difficulty: Difficulty): DifficultyDef {
  return DIFFICULTY_CATALOG.find((d) => d.id === difficulty) || DIFFICULTY_CATALOG[1];
}

export const LEVEL_CATALOG: LevelDef[] = [
  {
    id: 1,
    name: 'Sky Bastion',
    subtitle: 'Waves 1–3 · Solar Titan',
    startWave: 1,
    endWave: 3,
    bossKind: 'titan',
    bossName: 'SOLAR TITAN',
    accent: '#f59e0b',
    bgColor: '#0b111e',
    horizonColor: 'rgba(30, 41, 68, 0.48)',
    gridColor: 'rgba(148, 163, 184, 0.065)',
    mechanicLabel: 'Open Sky Arena',
  },
  {
    id: 2,
    name: 'Ember Foundry',
    subtitle: 'Waves 4–6 · Prism Empress',
    startWave: 4,
    endWave: 6,
    bossKind: 'empress',
    bossName: 'PRISM EMPRESS',
    accent: '#f97316',
    bgColor: '#130c14',
    horizonColor: 'rgba(92, 34, 24, 0.42)',
    gridColor: 'rgba(251, 146, 60, 0.075)',
    mechanicLabel: 'Thermal Boost Rings',
  },
  {
    id: 3,
    name: 'Void Citadel',
    subtitle: 'Waves 7–9 · Void Dreadnought',
    startWave: 7,
    endWave: 9,
    bossKind: 'dreadnought',
    bossName: 'VOID DREADNOUGHT',
    accent: '#38bdf8',
    bgColor: '#070c1a',
    horizonColor: 'rgba(24, 58, 96, 0.46)',
    gridColor: 'rgba(56, 189, 248, 0.075)',
    mechanicLabel: 'Astral Relay Pylons',
  },
];

export function getLevelById(levelId: LevelId): LevelDef {
  return LEVEL_CATALOG.find((l) => l.id === levelId) || LEVEL_CATALOG[0];
}

export function getLevelForWave(wave: number): LevelDef {
  if (wave >= 7) return LEVEL_CATALOG[2];
  if (wave >= 4) return LEVEL_CATALOG[1];
  return LEVEL_CATALOG[0];
}

export const UPGRADE_CATALOG: UpgradeDef[] = [
  {
    id: 'twin_cannon',
    name: 'Split Barrels',
    role: 'Primary Fire',
    effect: '+1 forward pulse bolt and +15% fire cadence',
    maxStacks: 3,
    accent: '#f59e0b',
  },
  {
    id: 'chain_dash',
    name: 'Razor Thruster',
    role: 'Solar Dash',
    effect: '-22% dash cooldown and +18 blade strike damage',
    maxStacks: 3,
    accent: '#38bdf8',
  },
  {
    id: 'reflect_aegis',
    name: 'Prism Foil',
    role: 'Deflection',
    effect: 'Dash reflections gain +50% speed & bonus damage',
    maxStacks: 3,
    accent: '#fb7185',
  },
  {
    id: 'overclock_wings',
    name: 'Swept Airfoil',
    role: 'Mobility',
    effect: '+14% flight speed and tighter banking response',
    maxStacks: 3,
    accent: '#34d399',
  },
  {
    id: 'solar_magnet',
    name: 'Gravity Scoop',
    role: 'Harvest',
    effect: '+75% shard pull range and +20% Nova charge gain',
    maxStacks: 3,
    accent: '#fbbf24',
  },
  {
    id: 'nova_capacitor',
    name: 'Flux Capacitor',
    role: 'Nova Burst',
    effect: '+25% bolt power and faster Nova recharge',
    maxStacks: 3,
    accent: '#f97316',
  },
  {
    id: 'hull_plating',
    name: 'Gilded Armor',
    role: 'Vitality',
    effect: '+1 max hull socket and repairs 2 hull sockets',
    maxStacks: 3,
    accent: '#e2e8f0',
  },
  {
    id: 'wingman_drone',
    name: 'Solar Wingman',
    role: 'Escort Bot',
    effect: 'Deploys an autonomous wingman fighter that targets hostiles',
    maxStacks: 2,
    accent: '#38bdf8',
  },
];

export function createInitialUpgrades(): Record<UpgradeId, number> {
  return {
    twin_cannon: 0,
    chain_dash: 0,
    reflect_aegis: 0,
    overclock_wings: 0,
    solar_magnet: 0,
    nova_capacitor: 0,
    hull_plating: 0,
    wingman_drone: 0,
  };
}

export function computePlayerStats(
  upgrades: Record<UpgradeId, number>,
  difficulty: Difficulty
): PlayerStats {
  const diff = getDifficultyDef(difficulty);
  const cadetWingman = difficulty === 'cadet' ? 1 : 0;
  return {
    maxHp: diff.baseHp + upgrades.hull_plating,
    moveSpeed: 395 * Math.pow(1.14, upgrades.overclock_wings),
    fireRate: 7.5 * diff.fireRateBonus * Math.pow(1.15, upgrades.twin_cannon),
    projectileCount: 1 + upgrades.twin_cannon,
    projectileDamage: Math.round(18 * Math.pow(1.25, upgrades.nova_capacitor)),
    dashCooldown: Math.max(0.42, 1.15 * Math.pow(0.78, upgrades.chain_dash)),
    dashDamage: 48 + upgrades.chain_dash * 18,
    reflectMultiplier: 2.0 + upgrades.reflect_aegis * 0.6,
    magnetRadius: 145 * Math.pow(1.75, upgrades.solar_magnet),
    novaChargeGain: 1.0 + upgrades.solar_magnet * 0.2 + upgrades.nova_capacitor * 0.15,
    wingmanCount: Math.min(3, cadetWingman + upgrades.wingman_drone),
  };
}

export function pickUpgradeChoices(
  upgrades: Record<UpgradeId, number>,
  rng: () => number = Math.random
): UpgradeDef[] {
  const available = UPGRADE_CATALOG.filter((u) => upgrades[u.id] < u.maxStacks);
  const pool = [...available];
  const selected: UpgradeDef[] = [];
  while (selected.length < 3 && pool.length > 0) {
    const idx = Math.floor(rng() * pool.length);
    selected.push(pool.splice(idx, 1)[0]);
  }
  return selected;
}

export type StandardEnemyKind = Exclude<EnemyKind, 'titan' | 'empress' | 'dreadnought'>;

export interface WavePlan {
  wave: number;
  levelId: LevelId;
  spawnBudget: number;
  spawnInterval: number;
  speedMultiplier: number;
  maxConcurrent: number;
  hasBoss: boolean;
  bossKind: 'titan' | 'empress' | 'dreadnought';
  weights: Record<StandardEnemyKind, number>;
}

export function buildWavePlan(wave: number, difficulty: Difficulty): WavePlan {
  const diff = getDifficultyDef(difficulty);
  const level = getLevelForWave(wave);
  const hasBoss = wave > 0 && wave % 3 === 0;
  const spawnBudget = Math.round((8 + wave * 3.8) * diff.spawnMultiplier);
  const intervalScale = difficulty === 'overdrive' ? 1.2 : difficulty === 'ace' ? 1.12 : difficulty === 'cadet' ? 0.9 : 1.0;
  const spawnInterval = Math.max(0.28, 1.12 - wave * 0.07) / intervalScale;
  const speedMultiplier = (1 + (wave - 1) * 0.055) * diff.speedMultiplier;
  const maxConcurrent = Math.min(26, Math.round((7 + wave * 2.0) * diff.spawnMultiplier));

  const weights: Record<StandardEnemyKind, number> = {
    skirmisher: Math.max(0.2, 0.72 - wave * 0.055),
    lancer: wave >= 2 ? Math.min(0.24, 0.14 + (wave - 1) * 0.025) : 0,
    bastion: wave >= 2 ? Math.min(0.2, 0.1 + (wave - 1) * 0.022) : 0,
    bomber: wave >= 2 ? Math.min(0.18, 0.08 + (wave - 1) * 0.02) : 0,
    weaver: wave >= 3 ? Math.min(0.2, 0.09 + (wave - 2) * 0.022) : 0,
    sniper: wave >= 3 ? Math.min(0.18, 0.08 + (wave - 2) * 0.02) : 0,
    warden: wave >= 4 ? Math.min(0.14, 0.06 + (wave - 3) * 0.018) : 0,
  };

  return {
    wave,
    levelId: level.id,
    spawnBudget,
    spawnInterval,
    speedMultiplier,
    maxConcurrent,
    hasBoss,
    bossKind: level.bossKind,
    weights,
  };
}

export function pickEnemyArchetype(
  plan: WavePlan,
  rng: () => number = Math.random
): StandardEnemyKind {
  const entries = Object.entries(plan.weights) as [StandardEnemyKind, number][];
  let total = 0;
  for (let i = 0; i < entries.length; i++) {
    total += entries[i][1];
  }
  let roll = rng() * total;
  for (let i = 0; i < entries.length; i++) {
    roll -= entries[i][1];
    if (roll <= 0) {
      return entries[i][0];
    }
  }
  return 'skirmisher';
}

export function calculateKillScore(
  basePoints: number,
  combo: number,
  difficulty: Difficulty = 'standard'
): number {
  const clampedCombo = Math.max(1, Math.min(MAX_COMBO, Math.floor(combo)));
  const mult = getDifficultyDef(difficulty).scoreMultiplier;
  return Math.round(basePoints * clampedCombo * mult);
}

export function segmentCircleIntersect(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  cx: number,
  cy: number,
  r: number
): boolean {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq <= 0.0001) {
    const px = cx - x1;
    const py = cy - y1;
    return px * px + py * py <= r * r;
  }
  let t = ((cx - x1) * dx + (cy - y1) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const closestX = x1 + t * dx;
  const closestY = y1 + t * dy;
  const distX = cx - closestX;
  const distY = cy - closestY;
  return distX * distX + distY * distY <= r * r;
}

export function clampToArena(
  x: number,
  y: number,
  margin: number,
  arenaW = ARENA_WIDTH,
  arenaH = ARENA_HEIGHT
): { x: number; y: number; hitBoundary: boolean } {
  const halfW = arenaW * 0.5 - margin;
  const halfH = arenaH * 0.5 - margin;
  let nx = x;
  let ny = y;
  let hitBoundary = false;

  if (nx < -halfW) {
    nx = -halfW;
    hitBoundary = true;
  } else if (nx > halfW) {
    nx = halfW;
    hitBoundary = true;
  }

  if (ny < -halfH) {
    ny = -halfH;
    hitBoundary = true;
  } else if (ny > halfH) {
    ny = halfH;
    hitBoundary = true;
  }

  return { x: nx, y: ny, hitBoundary };
}
