import type { Difficulty, EnemyKind, PlayerStats, UpgradeDef, UpgradeId } from './types';

export const ARENA_WIDTH = 2200;
export const ARENA_HEIGHT = 1400;
export const TARGET_VICTORY_WAVE = 6;
export const COMBO_DECAY_SECONDS = 3.6;
export const MAX_COMBO = 8;

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
  };
}

export function computePlayerStats(
  upgrades: Record<UpgradeId, number>,
  difficulty: Difficulty
): PlayerStats {
  const baseHp = difficulty === 'ace' ? 4 : 5;
  return {
    maxHp: baseHp + upgrades.hull_plating,
    moveSpeed: 395 * Math.pow(1.14, upgrades.overclock_wings),
    fireRate: 7.5 * Math.pow(1.15, upgrades.twin_cannon),
    projectileCount: 1 + upgrades.twin_cannon,
    projectileDamage: Math.round(18 * Math.pow(1.25, upgrades.nova_capacitor)),
    dashCooldown: Math.max(0.42, 1.15 * Math.pow(0.78, upgrades.chain_dash)),
    dashDamage: 48 + upgrades.chain_dash * 18,
    reflectMultiplier: 2.0 + upgrades.reflect_aegis * 0.6,
    magnetRadius: 145 * Math.pow(1.75, upgrades.solar_magnet),
    novaChargeGain: 1.0 + upgrades.solar_magnet * 0.2 + upgrades.nova_capacitor * 0.15,
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

export interface WavePlan {
  wave: number;
  spawnBudget: number;
  spawnInterval: number;
  speedMultiplier: number;
  maxConcurrent: number;
  hasBoss: boolean;
  weights: Record<Exclude<EnemyKind, 'titan'>, number>;
}

export function buildWavePlan(wave: number, difficulty: Difficulty): WavePlan {
  const diffScale = difficulty === 'ace' ? 1.22 : 1.0;
  const hasBoss = wave > 0 && wave % 3 === 0;
  const spawnBudget = Math.round((8 + wave * 4.5) * diffScale);
  const spawnInterval = Math.max(0.32, 1.15 - wave * 0.085) / (difficulty === 'ace' ? 1.12 : 1.0);
  const speedMultiplier = (1 + (wave - 1) * 0.065) * (difficulty === 'ace' ? 1.1 : 1.0);
  const maxConcurrent = Math.min(24, Math.round((7 + wave * 2.2) * diffScale));

  const weights: Record<Exclude<EnemyKind, 'titan'>, number> = {
    skirmisher: Math.max(0.28, 0.78 - wave * 0.06),
    lancer: wave >= 2 ? Math.min(0.3, 0.16 + (wave - 1) * 0.035) : 0,
    bastion: wave >= 2 ? Math.min(0.24, 0.1 + (wave - 1) * 0.03) : 0,
    weaver: wave >= 3 ? Math.min(0.24, 0.1 + (wave - 2) * 0.035) : 0,
  };

  return {
    wave,
    spawnBudget,
    spawnInterval,
    speedMultiplier,
    maxConcurrent,
    hasBoss,
    weights,
  };
}

export function pickEnemyArchetype(
  plan: WavePlan,
  rng: () => number = Math.random
): Exclude<EnemyKind, 'titan'> {
  const entries = Object.entries(plan.weights) as [Exclude<EnemyKind, 'titan'>, number][];
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

export function calculateKillScore(basePoints: number, combo: number): number {
  const clampedCombo = Math.max(1, Math.min(MAX_COMBO, Math.floor(combo)));
  return Math.round(basePoints * clampedCombo);
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
