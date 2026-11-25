import React from 'react';
import { getDifficultyDef, getLevelById } from '../game/rules';
import type { GamePhase, LevelId, RunSummary, UpgradeDef, UpgradeId } from '../game/types';
import { UpgradeIcon } from './GameIcons';

interface PauseModalProps {
  score: number;
  wave: number;
  onResume: () => void;
  onRestart: () => void;
  onOpenAchievements: () => void;
  onTitle: () => void;
}

export const PauseModal: React.FC<PauseModalProps> = ({
  score,
  wave,
  onResume,
  onRestart,
  onOpenAchievements,
  onTitle,
}) => (
  <div className="fixed inset-0 z-20 flex items-center justify-center bg-[#070b14]/75 p-4">
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Flight Paused"
      className="w-full max-w-sm rounded-lg bg-[#111a2c] border border-slate-700/80 p-7 shadow-2xl"
    >
      <h2 className="font-display text-3xl font-extrabold tracking-wide uppercase text-white">
        Flight Paused
      </h2>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="rounded bg-slate-900/90 border border-slate-800 px-3.5 py-2.5">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Wave</div>
          <div className="font-mono-tabular text-xl font-bold text-slate-100">{wave}</div>
        </div>
        <div className="rounded bg-slate-900/90 border border-slate-800 px-3.5 py-2.5">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Score</div>
          <div className="font-mono-tabular text-xl font-bold text-amber-400">{score.toLocaleString()}</div>
        </div>
      </div>

      <div className="mt-6 flex flex-col gap-2.5">
        <button
          type="button"
          onClick={onResume}
          className="w-full py-2.5 px-4 rounded-md bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-sm transition-colors cursor-pointer"
        >
          Resume Flight
        </button>
        <button
          type="button"
          onClick={onOpenAchievements}
          className="w-full py-2.5 px-4 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-100 font-medium text-sm transition-colors cursor-pointer"
        >
          Flight Milestones
        </button>
        <button
          type="button"
          onClick={onRestart}
          className="w-full py-2.5 px-4 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-100 font-medium text-sm transition-colors cursor-pointer"
        >
          Restart
        </button>
        <button
          type="button"
          onClick={onTitle}
          className="w-full py-2.5 px-4 rounded-md bg-transparent hover:bg-slate-800/70 text-slate-300 font-medium text-sm transition-colors cursor-pointer"
        >
          Return to Title
        </button>
      </div>
    </div>
  </div>
);

interface UpgradeModalProps {
  wave: number;
  choices: UpgradeDef[];
  activeUpgrades: Record<UpgradeId, number>;
  onSelect: (id: UpgradeId) => void;
}

export const UpgradeModal: React.FC<UpgradeModalProps> = ({
  wave,
  choices,
  activeUpgrades,
  onSelect,
}) => (
  <div className="fixed inset-0 z-20 flex items-center justify-center bg-[#070b14]/75 p-4">
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Wave Clear Flight Module Selection"
      className="w-full max-w-2xl rounded-lg bg-[#111a2c] border border-slate-700/80 p-7 shadow-2xl"
    >
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="font-display text-3xl font-extrabold tracking-wide uppercase text-amber-400">
          Wave {wave} Cleared
        </h2>
        <span className="text-xs font-medium text-slate-400">Select 1 Flight Module [1–3]</span>
      </div>

      <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        {choices.map((u, idx) => {
          const rank = activeUpgrades[u.id] || 0;
          return (
            <button
              key={u.id}
              type="button"
              onClick={() => onSelect(u.id)}
              className="text-left rounded-md bg-slate-900/95 hover:bg-slate-800 border border-slate-700/80 hover:border-amber-400/70 p-4 flex flex-col justify-between gap-3 transition-colors cursor-pointer group"
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <UpgradeIcon id={u.id} color={u.accent} />
                  <span className="font-mono-tabular text-xs font-bold text-slate-400 group-hover:text-amber-300">
                    [{idx + 1}] Lv {rank + 1}/{u.maxStacks}
                  </span>
                </div>
                <div className="mt-3 text-base font-bold text-white">{u.name}</div>
                <div className="text-xs font-medium text-slate-400 mt-0.5">{u.role}</div>
              </div>
              <p className="text-xs leading-relaxed text-slate-200">{u.effect}</p>
            </button>
          );
        })}
      </div>
    </div>
  </div>
);

interface GameOverModalProps {
  summary: RunSummary;
  showSyncPrompt: boolean;
  onRestart: () => void;
  onAdvanceLevel: () => void;
  onContinueEndless: () => void;
  onOpenAccount: () => void;
  onTitle: () => void;
}

export const GameOverModal: React.FC<GameOverModalProps> = ({
  summary,
  showSyncPrompt,
  onRestart,
  onAdvanceLevel,
  onContinueEndless,
  onOpenAccount,
  onTitle,
}) => {
  const isVictory = summary.outcome === 'victory';
  const diffLabel = getDifficultyDef(summary.difficulty).label;
  const nextLevel = summary.hasNextLevel ? getLevelById((summary.levelId + 1) as LevelId) : null;

  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-[#070b14]/78 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={isVictory ? 'Victory Summary' : 'Game Over Summary'}
        className="w-full max-w-md rounded-lg bg-[#111a2c] border border-slate-700/80 p-7 shadow-2xl"
      >
        <h2
          className={`font-display text-4xl font-extrabold tracking-wide uppercase ${
            isVictory ? 'text-amber-400' : 'text-rose-400'
          }`}
        >
          {isVictory ? `${summary.levelName} Cleared` : 'Aircraft Down'}
        </h2>
        <p className="mt-1 text-sm text-slate-300">
          {isVictory
            ? `Cleared on ${diffLabel} difficulty · Recorded in Match History.`
            : `Downed by ${summary.eliminatedBy || 'Hostile Wing'} at Wave ${summary.waveReached} (${summary.levelName} · ${diffLabel}).`}
        </p>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <div className="rounded bg-slate-900/90 border border-slate-800 px-3.5 py-2.5">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Final Score</div>
            <div className="font-mono-tabular text-2xl font-bold text-amber-400">
              {summary.score.toLocaleString()}
            </div>
          </div>
          <div className="rounded bg-slate-900/90 border border-slate-800 px-3.5 py-2.5">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Best Score</div>
            <div className="font-mono-tabular text-2xl font-bold text-slate-100">
              {summary.bestScore.toLocaleString()}
            </div>
          </div>
          <div className="rounded bg-slate-900/90 border border-slate-800 px-3.5 py-2.5">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              {isVictory ? 'Clear Time' : 'Hostiles Defeated'}
            </div>
            <div className="font-mono-tabular text-xl font-bold text-slate-100">
              {isVictory ? `${summary.clearTimeSeconds}s` : summary.enemiesDefeated}
            </div>
          </div>
          <div className="rounded bg-slate-900/90 border border-slate-800 px-3.5 py-2.5">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              {isVictory ? 'Damage Taken' : 'Shots Reflected'}
            </div>
            <div className="font-mono-tabular text-xl font-bold text-slate-100">
              {isVictory ? summary.damageTaken : summary.shotsReflected}
            </div>
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-2.5">
          {isVictory && nextLevel && (
            <button
              type="button"
              onClick={onAdvanceLevel}
              className="w-full py-2.5 px-4 rounded-md bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-sm transition-colors cursor-pointer"
            >
              Advance to {nextLevel.name}
            </button>
          )}
          {isVictory && (
            <button
              type="button"
              onClick={onContinueEndless}
              className={`w-full py-2.5 px-4 rounded-md font-semibold text-sm transition-colors cursor-pointer ${
                nextLevel
                  ? 'bg-slate-800 hover:bg-slate-700 text-slate-100'
                  : 'bg-amber-500 hover:bg-amber-400 text-slate-950'
              }`}
            >
              Continue Endless Waves
            </button>
          )}
          <button
            type="button"
            data-start="true"
            onClick={onRestart}
            className={`w-full py-2.5 px-4 rounded-md font-semibold text-sm transition-colors cursor-pointer ${
              isVictory
                ? 'bg-slate-800 hover:bg-slate-700 text-slate-100'
                : 'bg-amber-500 hover:bg-amber-400 text-slate-950'
            }`}
          >
            {isVictory ? 'Play Again' : 'Try Again'}
          </button>
          {showSyncPrompt && (
            <button
              type="button"
              onClick={onOpenAccount}
              className="w-full py-2 px-4 rounded-md bg-slate-800/80 hover:bg-slate-700 text-sky-300 font-medium text-xs transition-colors cursor-pointer"
            >
              Save Progress to a Pilot Callsign
            </button>
          )}
          <button
            type="button"
            onClick={onTitle}
            className="w-full py-2.5 px-4 rounded-md bg-transparent hover:bg-slate-800/70 text-slate-300 font-medium text-sm transition-colors cursor-pointer"
          >
            Return to Title
          </button>
        </div>
      </div>
    </div>
  );
};

export interface ModalRouterProps {
  phase: GamePhase;
  score: number;
  wave: number;
  upgradeChoices: UpgradeDef[];
  activeUpgrades: Record<UpgradeId, number>;
  summary: RunSummary | null;
  showSyncPrompt: boolean;
  onResume: () => void;
  onRestart: () => void;
  onAdvanceLevel: () => void;
  onTitle: () => void;
  onSelectUpgrade: (id: UpgradeId) => void;
  onContinueEndless: () => void;
  onOpenAchievements: () => void;
  onOpenAccount: () => void;
}

export const GameModals: React.FC<ModalRouterProps> = ({
  phase,
  score,
  wave,
  upgradeChoices,
  activeUpgrades,
  summary,
  showSyncPrompt,
  onResume,
  onRestart,
  onAdvanceLevel,
  onTitle,
  onSelectUpgrade,
  onContinueEndless,
  onOpenAchievements,
  onOpenAccount,
}) => {
  if (phase === 'paused') {
    return (
      <PauseModal
        score={score}
        wave={wave}
        onResume={onResume}
        onRestart={onRestart}
        onOpenAchievements={onOpenAchievements}
        onTitle={onTitle}
      />
    );
  }

  if (phase === 'upgrade' && upgradeChoices.length > 0) {
    return (
      <UpgradeModal
        wave={wave}
        choices={upgradeChoices}
        activeUpgrades={activeUpgrades}
        onSelect={onSelectUpgrade}
      />
    );
  }

  if (phase === 'gameover' && summary) {
    return (
      <GameOverModal
        summary={summary}
        showSyncPrompt={showSyncPrompt}
        onRestart={onRestart}
        onAdvanceLevel={onAdvanceLevel}
        onContinueEndless={onContinueEndless}
        onOpenAccount={onOpenAccount}
        onTitle={onTitle}
      />
    );
  }

  return null;
};
