import { useCallback, useEffect, useRef, useState } from 'react';
import { GameModals } from './components/GameModals';
import { HudOverlay } from './components/HudOverlay';
import { TitleOverlay } from './components/TitleOverlay';
import { SolarWingEngine } from './game/engine';
import { TARGET_VICTORY_WAVE, createInitialUpgrades } from './game/rules';
import type { Difficulty, HudSnapshot, RunSummary, UpgradeId } from './game/types';

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
};

export default function App() {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<SolarWingEngine | null>(null);
  const dashBarRef = useRef<HTMLDivElement | null>(null);
  const novaBarRef = useRef<HTMLDivElement | null>(null);

  const [hud, setHud] = useState<HudSnapshot>(INITIAL_HUD);
  const [difficulty, setDifficulty] = useState<Difficulty>('standard');
  const [runSummary, setRunSummary] = useState<RunSummary | null>(null);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const engine = new SolarWingEngine(container, {
      onHudChange: (snapshot) => {
        setHud(snapshot);
      },
      onRunEnd: (summary) => {
        setRunSummary(summary);
      },
    });

    engineRef.current = engine;
    engine.attachBarRefs(dashBarRef.current, novaBarRef.current);

    const params = new URLSearchParams(window.location.search);
    if (params.get('autostart') === '1') {
      engine.startNewRun('standard');
    }

    return () => {
      engine.destroy();
      engineRef.current = null;
    };
  }, []);

  useEffect(() => {
    engineRef.current?.attachBarRefs(dashBarRef.current, novaBarRef.current);
  }, [hud.phase]);

  const handleSelectDifficulty = useCallback((diff: Difficulty) => {
    setDifficulty(diff);
    engineRef.current?.setDifficulty(diff);
  }, []);

  const handleStart = useCallback(() => {
    setRunSummary(null);
    engineRef.current?.startNewRun(difficulty);
  }, [difficulty]);

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
    engineRef.current?.startNewRun(difficulty);
  }, [difficulty]);

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

  return (
    <main className="relative w-full h-full overflow-hidden bg-[#0b111e]">
      {/* Isolated 60fps Canvas Container */}
      <div
        ref={mountRef}
        className={`w-full h-full ${hud.phase === 'playing' ? 'cursor-crosshair' : 'cursor-default'}`}
      />

      {hud.phase === 'title' && (
        <TitleOverlay
          difficulty={difficulty}
          bestScore={hud.bestScore}
          onSelectDifficulty={handleSelectDifficulty}
          onStart={handleStart}
        />
      )}

      {hud.phase !== 'title' && (
        <HudOverlay
          hud={hud}
          dashBarRef={dashBarRef}
          novaBarRef={novaBarRef}
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
        summary={runSummary}
        onResume={handleResume}
        onRestart={handleRestart}
        onTitle={handleTitle}
        onSelectUpgrade={handleSelectUpgrade}
        onContinueEndless={handleContinueEndless}
      />
    </main>
  );
}
