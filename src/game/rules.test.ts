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
  pickEnemyArchetype,
  pickUpgradeChoices,
  segmentCircleIntersect,
} from './rules';
import { ParticlePool, ProjectilePool, SpatialGrid } from './pools';

test('calculateKillScore multiplies base points by clamped combo', () => {
  assert.equal(calculateKillScore(100, 1), 100);
  assert.equal(calculateKillScore(100, 4), 400);
  assert.equal(calculateKillScore(100, 15), 800); // clamped to MAX_COMBO=8
  assert.equal(calculateKillScore(50, 0), 50); // minimum combo 1
});

test('computePlayerStats scales upgrades cleanly without negative cooldowns', () => {
  const upgrades = createInitialUpgrades();
  const base = computePlayerStats(upgrades, 'standard');
  assert.equal(base.maxHp, 5);
  assert.equal(base.projectileCount, 1);

  upgrades.twin_cannon = 2;
  upgrades.chain_dash = 3;
  upgrades.hull_plating = 2;
  const upgraded = computePlayerStats(upgrades, 'ace');
  assert.equal(upgraded.maxHp, 4 + 2);
  assert.equal(upgraded.projectileCount, 3);
  assert.ok(upgraded.dashCooldown >= 0.42);
  assert.ok(upgraded.dashDamage > base.dashDamage);
});

test('pickUpgradeChoices returns up to 3 unique un-maxed upgrades', () => {
  const upgrades = createInitialUpgrades();
  const choices = pickUpgradeChoices(upgrades, () => 0.25);
  assert.equal(choices.length, 3);
  const ids = new Set(choices.map((c) => c.id));
  assert.equal(ids.size, 3);
});

test('buildWavePlan ramps spawn budget, speed, and triggers boss every 3rd wave', () => {
  const w1 = buildWavePlan(1, 'standard');
  const w3 = buildWavePlan(3, 'standard');
  const w3Ace = buildWavePlan(3, 'ace');

  assert.equal(w1.hasBoss, false);
  assert.equal(w3.hasBoss, true);
  assert.ok(w3.spawnBudget > w1.spawnBudget);
  assert.ok(w3.speedMultiplier > w1.speedMultiplier);
  assert.ok(w3Ace.spawnBudget > w3.spawnBudget);

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
