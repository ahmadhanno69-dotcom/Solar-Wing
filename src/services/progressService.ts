import {
  MAX_MATCH_HISTORY,
  createEmptyProgress,
  evaluateAchievements,
  mergeMatchHistory,
  mergePlayerProgress,
  sanitizeMatchHistory,
  sanitizeProgress,
} from '../game/achievements';
import type {
  AchievementDef,
  CareerStats,
  Difficulty,
  LevelId,
  MatchWinnerEntry,
  PlayerProgress,
  RunSummary,
} from '../game/types';

const PROFILE_STORAGE_KEY = 'solar_wing_profile_v2';
const MATCH_HISTORY_STORAGE_KEY = 'solar_wing_match_history_v1';
const LEGACY_BEST_SCORE_KEY = 'solar_wing_best_score_v1';
const AUTH_DISMISSED_KEY = 'solar_wing_auth_dismissed_v1';
const LAST_USERNAME_KEY = 'solar_wing_last_user_v1';
const PREFS_STORAGE_KEY = 'solar_wing_prefs_v1';

export interface AuthUser {
  id: string;
  username: string;
}

export interface PlayerPrefs {
  difficulty: Difficulty;
  levelId: LevelId;
}

const VALID_DIFFICULTIES = new Set<Difficulty>(['cadet', 'standard', 'ace', 'overdrive']);

class ProgressService {
  private progress: PlayerProgress;
  private prefs: PlayerPrefs;
  private authToken: string | null = null; // Held strictly in memory
  private currentUser: AuthUser | null = null;
  private lastUsername: string | null = null;
  private promptDismissed = false;
  private pendingSync = false;
  private syncing = false;
  private listeners = new Set<() => void>();
  private unlockListeners = new Set<(def: AchievementDef) => void>();

  constructor() {
    this.progress = this.loadLocalProgress();
    this.prefs = this.loadPrefs();
    this.promptDismissed = this.loadBool(AUTH_DISMISSED_KEY);
    this.lastUsername = this.loadString(LAST_USERNAME_KEY);

    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        if (this.pendingSync && this.authToken) {
          void this.syncWithServer();
        }
      });
    }
  }

  private loadString(key: string): string | null {
    try {
      const val = localStorage.getItem(key);
      return val && val.trim().length > 0 ? val.trim() : null;
    } catch {
      return null;
    }
  }

  private loadBool(key: string): boolean {
    try {
      return localStorage.getItem(key) === '1';
    } catch {
      return false;
    }
  }

  private loadPrefs(): PlayerPrefs {
    try {
      const raw = localStorage.getItem(PREFS_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<PlayerPrefs>;
        const difficulty: Difficulty =
          parsed.difficulty && VALID_DIFFICULTIES.has(parsed.difficulty)
            ? parsed.difficulty
            : 'standard';
        const levelId: LevelId =
          parsed.levelId === 1 || parsed.levelId === 2 || parsed.levelId === 3
            ? parsed.levelId
            : 1;
        return { difficulty, levelId };
      }
    } catch {
      // ignore storage errors
    }
    return { difficulty: 'standard', levelId: 1 };
  }

  private savePrefs(): void {
    try {
      localStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify(this.prefs));
    } catch {
      // ignore
    }
  }

  private loadLocalProgress(): PlayerProgress {
    let base = createEmptyProgress();
    try {
      const raw = localStorage.getItem(PROFILE_STORAGE_KEY);
      if (raw) {
        base = sanitizeProgress(JSON.parse(raw));
      } else {
        const legacyBest = localStorage.getItem(LEGACY_BEST_SCORE_KEY);
        if (legacyBest) {
          base.stats.bestScore = Math.max(0, parseInt(legacyBest, 10) || 0);
          base = evaluateAchievements(base).progress;
        }
      }

      const rawHistory = localStorage.getItem(MATCH_HISTORY_STORAGE_KEY);
      if (rawHistory) {
        const parsedHistory = sanitizeMatchHistory(JSON.parse(rawHistory));
        base = {
          ...base,
          matchHistory: mergeMatchHistory(base.matchHistory, parsedHistory),
        };
      }
    } catch {
      // ignore storage failures
    }
    return base;
  }

  private saveLocalProgress(): void {
    try {
      localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(this.progress));
      localStorage.setItem(
        MATCH_HISTORY_STORAGE_KEY,
        JSON.stringify(this.progress.matchHistory.slice(0, MAX_MATCH_HISTORY))
      );
      localStorage.setItem(LEGACY_BEST_SCORE_KEY, String(this.progress.stats.bestScore));
    } catch {
      // ignore storage failures
    }
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  onUnlock(listener: (def: AchievementDef) => void): () => void {
    this.unlockListeners.add(listener);
    return () => this.unlockListeners.delete(listener);
  }

  private notify(): void {
    for (const l of this.listeners) l();
  }

  getProgress(): PlayerProgress {
    return this.progress;
  }

  getMatchHistory(): MatchWinnerEntry[] {
    return this.progress.matchHistory;
  }

  getPrefs(): PlayerPrefs {
    return this.prefs;
  }

  setDifficultyPref(difficulty: Difficulty): void {
    this.prefs = { ...this.prefs, difficulty };
    this.savePrefs();
    this.notify();
  }

  setLevelPref(levelId: LevelId): void {
    this.prefs = { ...this.prefs, levelId };
    this.savePrefs();
    this.notify();
  }

  getUser(): AuthUser | null {
    return this.currentUser;
  }

  getLastUsername(): string | null {
    return this.lastUsername;
  }

  isPromptDismissed(): boolean {
    return this.promptDismissed;
  }

  dismissPrompt(): void {
    this.promptDismissed = true;
    try {
      localStorage.setItem(AUTH_DISMISSED_KEY, '1');
    } catch {
      // ignore
    }
    this.notify();
  }

  private applyStatsUpdate(
    mutator: (stats: CareerStats, history: MatchWinnerEntry[]) => MatchWinnerEntry[] | void,
    syncNow = false
  ): void {
    const nextStats: CareerStats = {
      ...this.progress.stats,
      clearedLevels: [...this.progress.stats.clearedLevels],
    };
    const maybeHistory = mutator(nextStats, [...this.progress.matchHistory]);
    const nextHistory = Array.isArray(maybeHistory)
      ? maybeHistory.slice(0, MAX_MATCH_HISTORY)
      : this.progress.matchHistory;

    const { progress: evaluated, newlyUnlocked } = evaluateAchievements({
      ...this.progress,
      stats: nextStats,
      matchHistory: nextHistory,
      updatedAt: new Date().toISOString(),
    });
    this.progress = evaluated;
    this.pendingSync = true;
    this.saveLocalProgress();

    for (const def of newlyUnlocked) {
      for (const listener of this.unlockListeners) {
        listener(def);
      }
    }

    this.notify();

    if ((syncNow || newlyUnlocked.length > 0) && this.authToken && navigator.onLine) {
      void this.syncWithServer();
    }
  }

  recordEnemyKill(isBoss: boolean, combo: number, score: number): void {
    this.applyStatsUpdate((s) => {
      s.totalEnemiesDefeated += 1;
      if (isBoss) s.titansDefeated += 1;
      if (combo > s.highestCombo) s.highestCombo = Math.min(8, combo);
      if (score > s.bestScore) s.bestScore = score;
    });
  }

  recordShotReflected(score: number): void {
    this.applyStatsUpdate((s) => {
      s.totalShotsReflected += 1;
      if (score > s.bestScore) s.bestScore = score;
    });
  }

  recordWaveCleared(wave: number, perfect: boolean, score: number): void {
    this.applyStatsUpdate(
      (s) => {
        if (wave > s.highestWave) s.highestWave = wave;
        if (perfect) s.perfectWaveClears += 1;
        if (score > s.bestScore) s.bestScore = score;
      },
      true
    );
  }

  recordScore(score: number): void {
    if (score <= this.progress.stats.bestScore) return;
    this.applyStatsUpdate((s) => {
      if (score > s.bestScore) s.bestScore = score;
    });
  }

  recordRunEnd(summary: RunSummary): void {
    const nowIso = new Date().toISOString();
    const isPilotWin = summary.outcome === 'victory';
    const winnerName = isPilotWin
      ? this.currentUser?.username || 'Solar Pilot'
      : summary.eliminatedBy || 'Crimson Wing';
    const winnerScore = isPilotWin ? summary.score : summary.botScore;

    const entry: MatchWinnerEntry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      winner: winnerName,
      winnerType: isPilotWin ? 'pilot' : 'bot',
      score: Math.max(0, Math.round(winnerScore)),
      difficulty: summary.difficulty,
      levelId: summary.levelId,
      levelName: summary.levelName,
      wave: summary.waveReached,
      outcome: summary.outcome,
      recordedAt: nowIso,
    };

    this.applyStatsUpdate(
      (s, existingHistory) => {
        s.runsPlayed += 1;
        if (summary.score > s.bestScore) s.bestScore = summary.score;
        if (summary.waveReached > s.highestWave) s.highestWave = summary.waveReached;
        if (summary.outcome === 'victory') {
          s.victories += 1;
          if (summary.difficulty === 'ace') s.aceVictories += 1;
          if (summary.difficulty === 'overdrive') s.overdriveVictories += 1;
          if (!s.clearedLevels.includes(summary.levelId)) {
            s.clearedLevels = [...s.clearedLevels, summary.levelId].sort((a, b) => a - b);
          }
        }
        return [entry, ...existingHistory].slice(0, MAX_MATCH_HISTORY);
      },
      true
    );
  }

  async registerPilot(username: string, passcode: string): Promise<{ ok: true } | { ok: false; error: string }> {
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, passcode, progress: this.progress }),
      });
      const data = (await res.json()) as { token?: string; user?: AuthUser; progress?: unknown; error?: string };
      if (!res.ok || !data.token || !data.user) {
        return { ok: false, error: data.error || 'Could not create pilot account.' };
      }
      this.authToken = data.token;
      this.currentUser = data.user;
      this.lastUsername = data.user.username;
      this.promptDismissed = true;
      try {
        localStorage.setItem(LAST_USERNAME_KEY, data.user.username);
        localStorage.setItem(AUTH_DISMISSED_KEY, '1');
      } catch {
        // ignore
      }
      if (data.progress) {
        this.progress = mergePlayerProgress(this.progress, sanitizeProgress(data.progress));
        this.saveLocalProgress();
      }
      this.pendingSync = false;
      this.notify();
      return { ok: true };
    } catch {
      return { ok: false, error: 'Offline or server unreachable. Your progress remains saved locally.' };
    }
  }

  async loginPilot(username: string, passcode: string): Promise<{ ok: true } | { ok: false; error: string }> {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, passcode, progress: this.progress }),
      });
      const data = (await res.json()) as { token?: string; user?: AuthUser; progress?: unknown; error?: string };
      if (!res.ok || !data.token || !data.user) {
        return { ok: false, error: data.error || 'Invalid username or passcode.' };
      }
      this.authToken = data.token;
      this.currentUser = data.user;
      this.lastUsername = data.user.username;
      this.promptDismissed = true;
      try {
        localStorage.setItem(LAST_USERNAME_KEY, data.user.username);
        localStorage.setItem(AUTH_DISMISSED_KEY, '1');
      } catch {
        // ignore
      }
      if (data.progress) {
        this.progress = mergePlayerProgress(this.progress, sanitizeProgress(data.progress));
        this.saveLocalProgress();
      }
      this.pendingSync = false;
      this.notify();
      return { ok: true };
    } catch {
      return { ok: false, error: 'Offline or server unreachable. Local progress is safe.' };
    }
  }

  logoutPilot(): void {
    this.authToken = null;
    this.currentUser = null;
    this.notify();
  }

  async syncWithServer(): Promise<void> {
    if (!this.authToken || this.syncing || !navigator.onLine) return;
    this.syncing = true;
    try {
      const res = await fetch('/api/progress', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.authToken}`,
        },
        body: JSON.stringify({ progress: this.progress }),
      });
      if (res.ok) {
        const data = (await res.json()) as { progress?: unknown };
        if (data.progress) {
          this.progress = mergePlayerProgress(this.progress, sanitizeProgress(data.progress));
          this.saveLocalProgress();
        }
        this.pendingSync = false;
        this.notify();
      } else if (res.status === 401) {
        this.authToken = null;
        this.currentUser = null;
        this.notify();
      }
    } catch {
      // Stay offline-resilient; pendingSync remains true
    } finally {
      this.syncing = false;
    }
  }
}

export const progressService = new ProgressService();
