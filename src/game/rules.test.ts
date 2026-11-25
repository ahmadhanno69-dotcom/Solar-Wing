import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ARENA_HEIGHT,
  ARENA_WIDTH,
  buildWavePlan,
  calculateKillScore,
  clampToArena,
  computePlayerStats,
  createInitialUpgrades,
  getLevelForWave,
  pickEnemyArchetype,
  pickUpgradeChoices,
  segmentCircleIntersect,
} from './rules';
import { ParticlePool, ProjectilePool, SpatialGrid } from './pools';
import {
  createEmptyProgress,
  evaluateAchievements,
  mergePlayerProgress,
  sanitizeMatchHistory,
  sanitizeProgress,
} from './achievements';

test('evaluateAchievements unlocks milestones including sector and nightmare tiers', () => {
  const prog = createEmptyProgress();
  prog.stats.totalEnemiesDefeated = 10;
  prog.stats.perfectWaveClears = 1;
  prog.stats.clearedLevels = [1, 2, 3];
  prog.stats.overdriveVictories = 1;
  const res = evaluateAchievements(prog, '2026-11-25T10:00:00.000Z');
  assert.ok(res.progress.unlocked.first_blood);
  assert.ok(res.progress.unlocked.perfect_wave_1);
  assert.ok(res.progress.unlocked.sector_triumph);
  assert.ok(res.progress.unlocked.nightmare_ace);
  assert.equal(res.progress.unlocked.century_ace, undefined);
});

test('mergePlayerProgress monotonically preserves max stats, cleared levels, unlocks, and top 3 match winners', () => {
  const local = createEmptyProgress();
  local.stats.totalEnemiesDefeated = 18;
  local.stats.bestScore = 2400;
  local.stats.perfectWaveClears = 2;
  local.stats.clearedLevels = [1];
  local.matchHistory = [
    {
      id: 'm1',
      winner: 'PilotOne',
      winnerType: 'pilot',
      score: 2400,
      difficulty: 'standard',
      levelId: 1,
      levelName: 'Sky Bastion',
      wave: 3,
      outcome: 'victory',
      recordedAt: '2026-11-25T09:00:00.000Z',
    },
    {
      id: 'm2',
      winner: 'Solar Titan',
      winnerType: 'bot',
      score: 1200,
      difficulty: 'ace',
      levelId: 1,
      levelName: 'Sky Bastion',
      wave: 3,
      outcome: 'defeat',
      recordedAt: '2026-11-25T08:00:00.000Z',
    },
  ];

  const remote = createEmptyProgress();
  remote.stats.totalEnemiesDefeated = 12;
  remote.stats.bestScore = 4100;
  remote.stats.totalShotsReflected = 30;
  remote.stats.clearedLevels = [2];
  remote.matchHistory = [
    {
      id: 'm3',
      winner: 'PilotOne',
      winnerType: 'pilot',
      score: 4100,
      difficulty: 'ace',
      levelId: 2,
      levelName: 'Ember Foundry',
      wave: 6,
      outcome: 'victory',
      recordedAt: '2026-11-25T10:00:00.000Z',
    },
    {
      id: 'm4',
      winner: 'PilotOne',
      winnerType: 'pilot',
      score: 1900,
      difficulty: 'cadet',
      levelId: 1,
      levelName: 'Sky Bastion',
      wave: 3,
      outcome: 'victory',
      recordedAt: '2026-11-25T07:00:00.000Z',
    },
  ];

  const merged = mergePlayerProgress(
    evaluateAchievements(local, '2026-11-25T09:00:00.000Z').progress,
    evaluateAchievements(remote, '2026-11-25T10:00:00.000Z').progress
  );

  assert.equal(merged.stats.totalEnemiesDefeated, 18);
  assert.equal(merged.stats.bestScore, 4100);
  assert.equal(merged.stats.perfectWaveClears, 2);
  assert.equal(merged.stats.totalShotsReflected, 30);
  assert.deepEqual(merged.stats.clearedLevels, [1, 2]);
  assert.equal(merged.matchHistory.length, 3);
  assert.equal(merged.matchHistory[0].id, 'm3');
  assert.equal(merged.matchHistory[1].id, 'm1');
  assert.equal(merged.matchHistory[2].id, 'm2');
  assert.ok(merged.unlocked.first_blood);
  assert.ok(merged.unlocked.perfect_wave_1);
  assert.ok(merged.unlocked.reflect_25);
});

test('sanitizeProgress and sanitizeMatchHistory clamp malformed values and keep max 3 winners', () => {
  const clean = sanitizeProgress({
    stats: { totalEnemiesDefeated: -50, highestCombo: 99, bestScore: 'bad', clearedLevels: [1, 9, 3] },
    unlocked: { fake_id: 'nope', first_blood: '2026-11-25T10:00:00.000Z' },
    matchHistory: [
      { id: 'a', winner: 'Ace\u0007', score: 900, difficulty: 'overdrive', levelId: 3, recordedAt: '2026-11-25T01:00:00Z' },
      { id: 'b', winner: 'Bob', score: -20, difficulty: 'invalid', levelId: 99, recordedAt: '2026-11-25T02:00:00Z' },
      { id: 'c', winner: 'Cara', score: 1500, difficulty: 'cadet', levelId: 1, recordedAt: '2026-11-25T03:00:00Z' },
      { id: 'd', winner: 'Dan', score: 2500, difficulty: 'ace', levelId: 2, recordedAt: '2026-11-25T04:00:00Z' },
    ],
  });
  assert.equal(clean.stats.totalEnemiesDefeated, 0);
  assert.equal(clean.stats.highestCombo, 8);
  assert.equal(clean.stats.bestScore, 0);
  assert.deepEqual(clean.stats.clearedLevels, [1, 3]);
  assert.ok(clean.unlocked.first_blood);
  assert.equal((clean.unlocked as Record<string, unknown>).fake_id, undefined);
  assert.equal(clean.matchHistory.length, 3);
  assert.equal(clean.matchHistory[0].id, 'd');
  assert.equal(sanitizeMatchHistory('bad').length, 0);
});

test('calculateKillScore multiplies base points by clamped combo and difficulty multiplier', () => {
  assert.equal(calculateKillScore(100, 1, 'standard'), 100);
  assert.equal(calculateKillScore(100, 4, 'standard'), 400);
  assert.equal(calculateKillScore(100, 15, 'standard'), 800); // clamped to MAX_COMBO=8
  assert.equal(calculateKillScore(50, 0, 'standard'), 50); // minimum combo 1
  assert.ok(calculateKillScore(100, 2, 'overdrive') > calculateKillScore(100, 2, 'ace'));
});

test('computePlayerStats scales 4 difficulties and wingman_drone upgrade cleanly', () => {
  const upgrades = createInitialUpgrades();
  const cadet = computePlayerStats(upgrades, 'cadet');
  const standard = computePlayerStats(upgrades, 'standard');
  const overdrive = computePlayerStats(upgrades, 'overdrive');

  assert.equal(cadet.maxHp, 6);
  assert.equal(cadet.wingmanCount, 1);
  assert.equal(standard.maxHp, 5);
  assert.equal(standard.wingmanCount, 0);
  assert.equal(overdrive.maxHp, 3);

  upgrades.twin_cannon = 2;
  upgrades.chain_dash = 3;
  upgrades.hull_plating = 2;
  upgrades.wingman_drone = 2;
  const upgraded = computePlayerStats(upgrades, 'ace');
  assert.equal(upgraded.maxHp, 4 + 2);
  assert.equal(upgraded.projectileCount, 3);
  assert.equal(upgraded.wingmanCount, 2);
  assert.ok(upgraded.dashCooldown >= 0.42);
  assert.ok(upgraded.dashDamage > standard.dashDamage);
});

test('pickUpgradeChoices returns up to 3 unique un-maxed upgrades', () => {
  const upgrades = createInitialUpgrades();
  const choices = pickUpgradeChoices(upgrades, () => 0.25);
  assert.equal(choices.length, 3);
  const ids = new Set(choices.map((c) => c.id));
  assert.equal(ids.size, 3);
});

test('buildWavePlan maps 3 levels, distinct bosses, 4 difficulties, and new enemy bots', () => {
  const w1 = buildWavePlan(1, 'standard');
  const w3 = buildWavePlan(3, 'standard');
  const w6 = buildWavePlan(6, 'ace');
  const w9 = buildWavePlan(9, 'overdrive');

  assert.equal(w1.hasBoss, false);
  assert.equal(w3.hasBoss, true);
  assert.equal(w3.bossKind, 'titan');
  assert.equal(w6.bossKind, 'empress');
  assert.equal(w9.bossKind, 'dreadnought');
  assert.equal(getLevelForWave(1).id, 1);
  assert.equal(getLevelForWave(5).id, 2);
  assert.equal(getLevelForWave(8).id, 3);
  assert.ok(w9.weights.warden > 0);
  assert.ok(w6.weights.sniper > 0);
  assert.ok(w6.weights.bomber > 0);
  assert.ok(w9.spawnBudget > w6.spawnBudget);

  const kind = pickEnemyArchetype(w1, () => 0.1);
  assert.equal(kind, 'skirmisher');
});

test('segmentCircleIntersect detects dash blade hits accurately', () => {
  assert.equal(segmentCircleIntersect(0, 0, 100, 0, 50, 10, 15), true);
  assert.equal(segmentCircleIntersect(0, 0, 100, 0, 50, 40, 15), false);
  assert.equal(segmentCircleIntersect(10, 10, 10, 10, 12, 12, 5), true);
});

test('clampToArena keeps entities inside bounds and flags boundary hits', () => {
  const inside = clampToArena(0, 0, 20);
  assert.equal(inside.hitBoundary, false);
  assert.equal(inside.x, 0);

  const outside = clampToArena(ARENA_WIDTH, -ARENA_HEIGHT, 20);
  assert.equal(outside.hitBoundary, true);
  assert.equal(outside.x, ARENA_WIDTH * 0.5 - 20);
  assert.equal(outside.y, -(ARENA_HEIGHT * 0.5 - 20));
});

test('ParticlePool and ProjectilePool wrap cleanly at capacity without leaking', () => {
  const particles = new ParticlePool(4);
  for (let i = 0; i < 6; i++) {
    particles.spawn(i, i, 1, 1, 1, 2, 0, '#fff');
  }
  assert.equal(particles.items.filter((p) => p.active).length, 4);
  assert.equal(particles.items[0].x, 4);

  const projectiles = new ProjectilePool(3);
  projectiles.spawn(true, 1, 0, 0, 0, 5, 10, 1, '#fff');
  projectiles.spawn(true, 2, 0, 0, 0, 5, 10, 1, '#fff');
  projectiles.spawn(true, 3, 0, 0, 0, 5, 10, 1, '#fff');
  projectiles.items[1].active = false;
  projectiles.spawn(true, 99, 0, 0, 0, 5, 10, 1, '#fff');
  assert.equal(projectiles.items[1].x, 99);
});

test('SpatialGrid returns nearby entity indices accurately', () => {
  const grid = new SpatialGrid(1000, 1000, 100);
  grid.insert(0, -10, -10);
  grid.insert(1, 20, 20);
  grid.insert(2, 400, 400);

  const found: number[] = [];
  grid.queryRadius(0, 0, 60, found);
  assert.ok(found.includes(0));
  assert.ok(found.includes(1));
  assert.ok(!found.includes(2));
});
