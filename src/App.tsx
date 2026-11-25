import { useCallback, useEffect, useRef, useState } from 'react';
import { AccountModal } from './components/AccountModal';
import { AchievementToastBanner, AchievementsOverlay } from './components/AchievementsOverlay';
import { GameModals } from './components/GameModals';
import { HudOverlay } from './components/HudOverlay';
import { OfflineIndicator } from './components/PWAControls';
import { TitleOverlay } from './components/TitleOverlay';
import { ACHIEVEMENT_CATALOG } from './game/achievements';
import { SolarWingEngine } from './game/engine';
import { TARGET_VICTORY_WAVE, createInitialUpgrades } from './game/rules';
import type {
  AchievementDef,
  Difficulty,
  HudSnapshot,
  LevelId,
  RunSummary,
  UpgradeId,
} from './game/types';
import { progressService } from './services/progressService';

const INITIAL_HUD: HudSnapshot = {
  phase: 'title',
  outcome: null,
  hp: 5,
  maxHp: 5,
  ghostHp: 5,
  score: 0,
  bestScore: 0,
  combo: 1,
  comboTimerRatio: 0,
  wave: 1,
  levelId: 1,
  levelName: 'Sky Bastion',
  targetVictoryWave: TARGET_VICTORY_WAVE,
  enemiesRemaining: 0,
  dashReadyRatio: 1,
  novaCharge: 40,
  bossName: null,
  bossHpRatio: 0,
  bossHpText: null,
  upgradeChoices: [],
  activeUpgrades: createInitialUpgrades(),
  isMuted: false,
  autoFire: false,
  wingmanCount: 0,
  difficulty: 'standard',
};

export default function App() {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<SolarWingEngine | null>(null);
  const dashBarRef = useRef<HTMLDivElement | null>(null);
  const novaBarRef = useRef<HTMLDivElement | null>(null);

  const initialPrefs = progressService.getPrefs();
  const [hud, setHud] = useState<HudSnapshot>(INITIAL_HUD);
  const [difficulty, setDifficulty] = useState<Difficulty>(initialPrefs.difficulty);
  const [levelId, setLevelId] = useState<LevelId>(initialPrefs.levelId);
  const [runSummary, setRunSummary] = useState<RunSummary | null>(null);

  const [progress, setProgress] = useState(() => progressService.getProgress());
  const [currentUser, setCurrentUser] = useState(() => progressService.getUser());
  const [promptDismissed, setPromptDismissed] = useState(() => progressService.isPromptDismissed());
  const [showAchievements, setShowAchievements] = useState(false);
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [recentToast, setRecentToast] = useState<AchievementDef | null>(null);
  const pausedByAchievementsRef = useRef(false);
  const toastTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const unsubProgress = progressService.subscribe(() => {
      const next = progressService.getProgress();
      setProgress(next);
      setCurrentUser(progressService.getUser());
      setPromptDismissed(progressService.isPromptDismissed());
      engineRef.current?.setBestScore(next.stats.bestScore);
    });

    const unsubUnlock = progressService.onUnlock((def) => {
      setRecentToast(def);
      if (toastTimerRef.current) {
        window.clearTimeout(toastTimerRef.current);
      }
      toastTimerRef.current = window.setTimeout(() => {
        setRecentToast(null);
      }, 3200);
    });

    return () => {
      unsubProgress();
      unsubUnlock();
      if (toastTimerRef.current) {
        window.clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  const handleToggleAchievements = useCallback(() => {
    setShowAchievements((prev) => {
      const next = !prev;
      const eng = engineRef.current;
      if (next && eng) {
        if (document.body.dataset.state === 'playing' && !document.body.dataset.substate) {
          pausedByAchievementsRef.current = true;
          eng.pauseGame();
        }
      } else if (!next && eng && pausedByAchievementsRef.current) {
        pausedByAchievementsRef.current = false;
        eng.resumeGame();
      }
      return next;
    });
  }, []);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const engine = new SolarWingEngine(container, {
      onHudChange: (snapshot) => {
        setHud(snapshot);
      },
      onRunEnd: (summary) => {
        setRunSummary(summary);
        progressService.recordRunEnd(summary);
      },
      onEnemyDefeated: (isBoss, combo, score) => {
        progressService.recordEnemyKill(isBoss, combo, score);
      },
      onShotReflected: (score) => {
        progressService.recordShotReflected(score);
      },
      onWaveCleared: (wave, perfect, score) => {
        progressService.recordWaveCleared(wave, perfect, score);
      },
      onToggleAchievements: handleToggleAchievements,
    });

    const savedPrefs = progressService.getPrefs();
    engine.setDifficulty(savedPrefs.difficulty);
    engine.setLevel(savedPrefs.levelId);
    engine.setBestScore(progressService.getProgress().stats.bestScore);
    engineRef.current = engine;
    engine.attachBarRefs(dashBarRef.current, novaBarRef.current);

    const params = new URLSearchParams(window.location.search);
    if (params.get('autostart') === '1') {
      engine.startNewRun(savedPrefs.difficulty, savedPrefs.levelId);
    }

    return () => {
      engine.destroy();
      engineRef.current = null;
    };
  }, [handleToggleAchievements]);

  useEffect(() => {
    engineRef.current?.attachBarRefs(dashBarRef.current, novaBarRef.current);
  }, [hud.phase]);

  useEffect(() => {
    const anyModal = showAchievements || showAccountModal;
    engineRef.current?.setModalOpen(anyModal);
  }, [showAchievements, showAccountModal]);

  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => {
      if (e.code === 'Escape') {
        if (showAchievements) {
          handleToggleAchievements();
        } else if (showAccountModal) {
          setShowAccountModal(false);
        }
      }
    };
    window.addEventListener('keydown', onEsc);
    return () => window.removeEventListener('keydown', onEsc);
  }, [showAchievements, showAccountModal, handleToggleAchievements]);

  const handleSelectDifficulty = useCallback((diff: Difficulty) => {
    setDifficulty(diff);
    progressService.setDifficultyPref(diff);
    engineRef.current?.setDifficulty(diff);
  }, []);

  const handleSelectLevel = useCallback((lvl: LevelId) => {
    setLevelId(lvl);
    progressService.setLevelPref(lvl);
    engineRef.current?.setLevel(lvl);
  }, []);

  const handleStart = useCallback(() => {
    setRunSummary(null);
    engineRef.current?.startNewRun(difficulty, levelId);
  }, [difficulty, levelId]);

  const handleToggleAutoFire = useCallback(() => {
    engineRef.current?.toggleAutoFire();
  }, []);

  const handleToggleMute = useCallback(() => {
    engineRef.current?.toggleMute();
  }, []);

  const handlePause = useCallback(() => {
    engineRef.current?.pauseGame();
  }, []);

  const handleResume = useCallback(() => {
    engineRef.current?.resumeGame();
  }, []);

  const handleRestart = useCallback(() => {
    setRunSummary(null);
    engineRef.current?.startNewRun(difficulty, levelId);
  }, [difficulty, levelId]);

  const handleAdvanceLevel = useCallback(() => {
    setRunSummary(null);
    const nextLvl = Math.min(3, levelId + 1) as LevelId;
    setLevelId(nextLvl);
    progressService.setLevelPref(nextLvl);
    engineRef.current?.advanceToNextLevel();
  }, [levelId]);

  const handleTitle = useCallback(() => {
    setRunSummary(null);
    engineRef.current?.returnToTitle();
  }, []);

  const handleSelectUpgrade = useCallback((id: UpgradeId) => {
    engineRef.current?.selectUpgrade(id);
  }, []);

  const handleContinueEndless = useCallback(() => {
    setRunSummary(null);
    engineRef.current?.continueEndless();
  }, []);

  const unlockedCount = ACHIEVEMENT_CATALOG.filter((a) => Boolean(progress.unlocked[a.id])).length;
  const effectiveBestScore = Math.max(hud.bestScore, progress.stats.bestScore);

  return (
    <main className="relative w-full h-full overflow-hidden bg-[#0b111e]">
      {/* Isolated 60-120fps Canvas Container */}
      <div
        ref={mountRef}
        className={`w-full h-full ${hud.phase === 'playing' ? 'cursor-crosshair' : 'cursor-default'}`}
      />

      {hud.phase === 'title' && (
        <TitleOverlay
          difficulty={difficulty}
          levelId={levelId}
          clearedLevels={progress.stats.clearedLevels}
          bestScore={effectiveBestScore}
          unlockedCount={unlockedCount}
          matchHistory={progress.matchHistory}
          currentUser={currentUser}
          promptDismissed={promptDismissed}
          onSelectDifficulty={handleSelectDifficulty}
          onSelectLevel={handleSelectLevel}
          onStart={handleStart}
          onOpenAchievements={() => setShowAchievements(true)}
          onOpenAccount={() => setShowAccountModal(true)}
          onDismissPrompt={() => progressService.dismissPrompt()}
        />
      )}

      {hud.phase !== 'title' && (
        <HudOverlay
          hud={hud}
          unlockedCount={unlockedCount}
          dashBarRef={dashBarRef}
          novaBarRef={novaBarRef}
          onOpenAchievements={handleToggleAchievements}
          onToggleAutoFire={handleToggleAutoFire}
          onToggleMute={handleToggleMute}
          onPause={handlePause}
          onRestart={handleRestart}
        />
      )}

      <GameModals
        phase={hud.phase}
        score={hud.score}
        wave={hud.wave}
        upgradeChoices={hud.upgradeChoices}
        activeUpgrades={hud.activeUpgrades}
        summary={
          runSummary
            ? { ...runSummary, bestScore: Math.max(runSummary.bestScore, progress.stats.bestScore) }
            : null
        }
        showSyncPrompt={!currentUser && !promptDismissed}
        onResume={handleResume}
        onRestart={handleRestart}
        onAdvanceLevel={handleAdvanceLevel}
        onTitle={handleTitle}
        onSelectUpgrade={handleSelectUpgrade}
        onContinueEndless={handleContinueEndless}
        onOpenAchievements={handleToggleAchievements}
        onOpenAccount={() => setShowAccountModal(true)}
      />

      {showAchievements && (
        <AchievementsOverlay
          progress={progress}
          pilotUsername={currentUser?.username || null}
          onClose={handleToggleAchievements}
        />
      )}

      {showAccountModal && (
        <AccountModal
          currentUser={currentUser}
          lastUsername={progressService.getLastUsername()}
          onLogin={(u, p) => progressService.loginPilot(u, p)}
          onRegister={(u, p) => progressService.registerPilot(u, p)}
          onLogout={() => progressService.logoutPilot()}
          onSkipLocal={() => progressService.dismissPrompt()}
          onClose={() => setShowAccountModal(false)}
        />
      )}

      <AchievementToastBanner toast={recentToast} />
      <OfflineIndicator />
    </main>
  );
}
