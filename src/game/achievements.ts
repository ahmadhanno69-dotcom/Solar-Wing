import type {
  AchievementDef,
  AchievementId,
  CareerStats,
  Difficulty,
  LevelId,
  MatchWinnerEntry,
  PlayerProgress,
} from './types';

export const MAX_MATCH_HISTORY = 3;

export const ACHIEVEMENT_CATALOG: AchievementDef[] = [
  {
    id: 'first_blood',
    title: 'First Contact',
    description: 'Defeat 10 hostiles across all flights.',
    metricLabel: 'Enemies Defeated',
    target: 10,
    accent: '#f59e0b',
    getValue: (s) => s.totalEnemiesDefeated,
  },
  {
    id: 'century_ace',
    title: 'Wing Commander',
    description: 'Defeat 100 hostiles across all flights.',
    metricLabel: 'Enemies Defeated',
    target: 100,
    accent: '#fbbf24',
    getValue: (s) => s.totalEnemiesDefeated,
  },
  {
    id: 'sky_legend',
    title: 'Sky Legend',
    description: 'Defeat 350 hostiles across all flights.',
    metricLabel: 'Enemies Defeated',
    target: 350,
    accent: '#f97316',
    getValue: (s) => s.totalEnemiesDefeated,
  },
  {
    id: 'perfect_wave_1',
    title: 'Untouchable',
    description: 'Complete a wave without taking hull damage.',
    metricLabel: 'Perfect Wave Clears',
    target: 1,
    accent: '#38bdf8',
    getValue: (s) => s.perfectWaveClears,
  },
  {
    id: 'perfect_wave_5',
    title: 'Iron Discipline',
    description: 'Complete 5 Perfect Wave Clears.',
    metricLabel: 'Perfect Wave Clears',
    target: 5,
    accent: '#34d399',
    getValue: (s) => s.perfectWaveClears,
  },
  {
    id: 'reflect_25',
    title: 'Mirror Blade',
    description: 'Deflect 25 enemy projectiles with Solar Dash.',
    metricLabel: 'Shots Reflected',
    target: 25,
    accent: '#fb7185',
    getValue: (s) => s.totalShotsReflected,
  },
  {
    id: 'combo_8',
    title: 'Solar Overdrive',
    description: 'Reach the maximum x8 kill combo.',
    metricLabel: 'Peak Combo',
    target: 8,
    accent: '#f59e0b',
    getValue: (s) => s.highestCombo,
  },
  {
    id: 'titan_slayer',
    title: 'Titan Slayer',
    description: 'Destroy a Sector Dreadnought Boss.',
    metricLabel: 'Bosses Defeated',
    target: 1,
    accent: '#f43f5e',
    getValue: (s) => s.titansDefeated,
  },
  {
    id: 'campaign_clear',
    title: 'Bastion Victor',
    description: 'Clear any sector on any difficulty.',
    metricLabel: 'Sector Victories',
    target: 1,
    accent: '#fbbf24',
    getValue: (s) => s.victories,
  },
  {
    id: 'sector_triumph',
    title: 'Grand Conqueror',
    description: 'Clear all 3 sectors: Sky Bastion, Ember Foundry, and Void Citadel.',
    metricLabel: 'Sectors Cleared',
    target: 3,
    accent: '#38bdf8',
    getValue: (s) => s.clearedLevels.length,
  },
  {
    id: 'ace_clear',
    title: 'Ace of the Sun',
    description: 'Clear a sector on Ace Pilot or Nightmare difficulty.',
    metricLabel: 'Ace+ Clears',
    target: 1,
    accent: '#e2e8f0',
    getValue: (s) => s.aceVictories + s.overdriveVictories,
  },
  {
    id: 'nightmare_ace',
    title: 'Solar Nightmare',
    description: 'Clear a sector on Nightmare difficulty.',
    metricLabel: 'Nightmare Clears',
    target: 1,
    accent: '#c084fc',
    getValue: (s) => s.overdriveVictories,
  },
];

export function createInitialCareerStats(): CareerStats {
  return {
    totalEnemiesDefeated: 0,
    perfectWaveClears: 0,
    totalShotsReflected: 0,
    titansDefeated: 0,
    highestCombo: 1,
    highestWave: 1,
    bestScore: 0,
    victories: 0,
    aceVictories: 0,
    overdriveVictories: 0,
    clearedLevels: [],
    runsPlayed: 0,
  };
}

export function createEmptyProgress(): PlayerProgress {
  return {
    stats: createInitialCareerStats(),
    unlocked: {},
    matchHistory: [],
    updatedAt: new Date(0).toISOString(),
  };
}

const VALID_DIFFICULTIES = new Set<Difficulty>(['cadet', 'standard', 'ace', 'overdrive']);
const VALID_LEVELS = new Set<LevelId>([1, 2, 3]);

function sanitizeText(raw: unknown, maxLen: number, fallback: string): string {
  if (typeof raw !== 'string') return fallback;
  const cleaned = raw.replace(/[\u0000-\u001F\u007F]/g, '').trim().slice(0, maxLen);
  return cleaned.length > 0 ? cleaned : fallback;
}

export function sanitizeClearedLevels(raw: unknown): LevelId[] {
  if (!Array.isArray(raw)) return [];
  const set = new Set<LevelId>();
  for (const item of raw) {
    if (item === 1 || item === 2 || item === 3) {
      set.add(item);
    }
  }
  return Array.from(set).sort((a, b) => a - b);
}

export function sanitizeMatchHistory(raw: unknown): MatchWinnerEntry[] {
  if (!Array.isArray(raw)) return [];
  const list: MatchWinnerEntry[] = [];
  const seen = new Set<string>();

  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const r = item as Record<string, unknown>;
    const id = sanitizeText(r.id, 48, '');
    if (!id || seen.has(id)) continue;
    seen.add(id);

    const winner = sanitizeText(r.winner, 28, 'Solar Pilot');
    const winnerType = r.winnerType === 'bot' ? 'bot' : 'pilot';
    const score =
      typeof r.score === 'number' && Number.isFinite(r.score)
        ? Math.max(0, Math.min(100_000_000, Math.floor(r.score)))
        : 0;
    const difficulty: Difficulty =
      typeof r.difficulty === 'string' && VALID_DIFFICULTIES.has(r.difficulty as Difficulty)
        ? (r.difficulty as Difficulty)
        : 'standard';
    const levelId: LevelId = VALID_LEVELS.has(r.levelId as LevelId) ? (r.levelId as LevelId) : 1;
    const levelName = sanitizeText(r.levelName, 28, 'Sky Bastion');
    const wave =
      typeof r.wave === 'number' && Number.isFinite(r.wave)
        ? Math.max(1, Math.min(9999, Math.floor(r.wave)))
        : 1;
    const outcome = r.outcome === 'defeat' ? 'defeat' : 'victory';
    const recordedAt = sanitizeText(r.recordedAt, 40, new Date(0).toISOString());

    list.push({
      id,
      winner,
      winnerType,
      score,
      difficulty,
      levelId,
      levelName,
      wave,
      outcome,
      recordedAt,
    });
  }

  list.sort((a, b) => (a.recordedAt < b.recordedAt ? 1 : a.recordedAt > b.recordedAt ? -1 : 0));
  return list.slice(0, MAX_MATCH_HISTORY);
}

export function mergeMatchHistory(
  a: MatchWinnerEntry[],
  b: MatchWinnerEntry[]
): MatchWinnerEntry[] {
  const byId = new Map<string, MatchWinnerEntry>();
  for (const entry of [...a, ...b]) {
    if (!byId.has(entry.id)) {
      byId.set(entry.id, entry);
    }
  }
  return Array.from(byId.values())
    .sort((x, y) => (x.recordedAt < y.recordedAt ? 1 : x.recordedAt > y.recordedAt ? -1 : 0))
    .slice(0, MAX_MATCH_HISTORY);
}

export function sanitizeCareerStats(raw: unknown): CareerStats {
  const base = createInitialCareerStats();
  if (!raw || typeof raw !== 'object') return base;
  const r = raw as Record<string, unknown>;
  const clampInt = (val: unknown, min = 0, max = 100_000_000) => {
    const n = typeof val === 'number' && Number.isFinite(val) ? Math.floor(val) : min;
    return Math.max(min, Math.min(max, n));
  };

  return {
    totalEnemiesDefeated: clampInt(r.totalEnemiesDefeated),
    perfectWaveClears: clampInt(r.perfectWaveClears),
    totalShotsReflected: clampInt(r.totalShotsReflected),
    titansDefeated: clampInt(r.titansDefeated),
    highestCombo: clampInt(r.highestCombo, 1, 8),
    highestWave: clampInt(r.highestWave, 1, 9999),
    bestScore: clampInt(r.bestScore),
    victories: clampInt(r.victories),
    aceVictories: clampInt(r.aceVictories),
    overdriveVictories: clampInt(r.overdriveVictories),
    clearedLevels: sanitizeClearedLevels(r.clearedLevels),
    runsPlayed: clampInt(r.runsPlayed),
  };
}

export function sanitizeProgress(raw: unknown): PlayerProgress {
  const empty = createEmptyProgress();
  if (!raw || typeof raw !== 'object') return empty;
  const r = raw as Record<string, unknown>;
  const stats = sanitizeCareerStats(r.stats);
  const unlocked: Partial<Record<AchievementId, string>> = {};
  if (r.unlocked && typeof r.unlocked === 'object') {
    const u = r.unlocked as Record<string, unknown>;
    for (const def of ACHIEVEMENT_CATALOG) {
      const val = u[def.id];
      if (typeof val === 'string' && val.length > 0 && val.length <= 40) {
        unlocked[def.id] = val;
      }
    }
  }
  const matchHistory = sanitizeMatchHistory(r.matchHistory);
  const updatedAt =
    typeof r.updatedAt === 'string' && r.updatedAt.length > 0 && r.updatedAt.length <= 40
      ? r.updatedAt
      : new Date().toISOString();

  return evaluateAchievements({ stats, unlocked, matchHistory, updatedAt }).progress;
}

export function evaluateAchievements(
  progress: PlayerProgress,
  nowIso: string = new Date().toISOString()
): { progress: PlayerProgress; newlyUnlocked: AchievementDef[] } {
  const nextUnlocked: Partial<Record<AchievementId, string>> = { ...progress.unlocked };
  const newlyUnlocked: AchievementDef[] = [];

  for (const def of ACHIEVEMENT_CATALOG) {
    if (!nextUnlocked[def.id] && def.getValue(progress.stats) >= def.target) {
      nextUnlocked[def.id] = nowIso;
      newlyUnlocked.push(def);
    }
  }

  return {
    progress: {
      stats: {
        ...progress.stats,
        clearedLevels: [...progress.stats.clearedLevels],
      },
      unlocked: nextUnlocked,
      matchHistory: [...(progress.matchHistory || [])].slice(0, MAX_MATCH_HISTORY),
      updatedAt: newlyUnlocked.length > 0 ? nowIso : progress.updatedAt,
    },
    newlyUnlocked,
  };
}

export function mergePlayerProgress(a: PlayerProgress, b: PlayerProgress): PlayerProgress {
  const clearedSet = new Set<LevelId>([
    ...(a.stats.clearedLevels || []),
    ...(b.stats.clearedLevels || []),
  ]);

  const stats: CareerStats = {
    totalEnemiesDefeated: Math.max(a.stats.totalEnemiesDefeated, b.stats.totalEnemiesDefeated),
    perfectWaveClears: Math.max(a.stats.perfectWaveClears, b.stats.perfectWaveClears),
    totalShotsReflected: Math.max(a.stats.totalShotsReflected, b.stats.totalShotsReflected),
    titansDefeated: Math.max(a.stats.titansDefeated, b.stats.titansDefeated),
    highestCombo: Math.max(a.stats.highestCombo, b.stats.highestCombo),
    highestWave: Math.max(a.stats.highestWave, b.stats.highestWave),
    bestScore: Math.max(a.stats.bestScore, b.stats.bestScore),
    victories: Math.max(a.stats.victories, b.stats.victories),
    aceVictories: Math.max(a.stats.aceVictories, b.stats.aceVictories),
    overdriveVictories: Math.max(a.stats.overdriveVictories || 0, b.stats.overdriveVictories || 0),
    clearedLevels: Array.from(clearedSet).sort((x, y) => x - y),
    runsPlayed: Math.max(a.stats.runsPlayed, b.stats.runsPlayed),
  };

  const unlocked: Partial<Record<AchievementId, string>> = {};
  for (const def of ACHIEVEMENT_CATALOG) {
    const tA = a.unlocked[def.id];
    const tB = b.unlocked[def.id];
    if (tA && tB) {
      unlocked[def.id] = tA < tB ? tA : tB;
    } else if (tA || tB) {
      unlocked[def.id] = tA || tB;
    }
  }

  const matchHistory = mergeMatchHistory(a.matchHistory || [], b.matchHistory || []);
  const updatedAt = a.updatedAt > b.updatedAt ? a.updatedAt : b.updatedAt;
  return evaluateAchievements({ stats, unlocked, matchHistory, updatedAt }).progress;
}
