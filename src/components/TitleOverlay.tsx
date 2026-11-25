import React from 'react';
import { ACHIEVEMENT_CATALOG } from '../game/achievements';
import { DIFFICULTY_CATALOG, LEVEL_CATALOG, getDifficultyDef } from '../game/rules';
import type { Difficulty, LevelId, MatchWinnerEntry } from '../game/types';
import type { AuthUser } from '../services/progressService';
import { PilotIcon, SolarWingEmblem, TrophyIcon } from './GameIcons';
import { PWAInstallButton } from './PWAControls';

interface TitleOverlayProps {
  difficulty: Difficulty;
  levelId: LevelId;
  clearedLevels: LevelId[];
  bestScore: number;
  unlockedCount: number;
  matchHistory: MatchWinnerEntry[];
  currentUser: AuthUser | null;
  promptDismissed: boolean;
  onSelectDifficulty: (diff: Difficulty) => void;
  onSelectLevel: (levelId: LevelId) => void;
  onStart: () => void;
  onOpenAchievements: () => void;
  onOpenAccount: () => void;
  onDismissPrompt: () => void;
}

export const TitleOverlay: React.FC<TitleOverlayProps> = ({
  difficulty,
  levelId,
  clearedLevels,
  bestScore,
  unlockedCount,
  matchHistory,
  currentUser,
  promptDismissed,
  onSelectDifficulty,
  onSelectLevel,
  onStart,
  onOpenAchievements,
  onOpenAccount,
  onDismissPrompt,
}) => {
  const activeDiff = getDifficultyDef(difficulty);

  return (
    <div className="fixed inset-0 z-10 flex flex-col justify-between px-5 py-6 sm:px-12 sm:py-10 overflow-y-auto pointer-events-none">
      {/* Top Bar: Best Score + Achievements / Pilot Account / Install */}
      <div className="flex flex-wrap items-center justify-between gap-4 shrink-0">
        <div>
          {bestScore > 0 && (
            <div className="text-xs font-medium tracking-wider uppercase text-slate-400 hud-stroke">
              Best Score{' '}
              <span className="ml-2 font-mono-tabular text-sm font-bold text-amber-400">
                {bestScore.toLocaleString()}
              </span>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 pointer-events-auto">
          <button
            type="button"
            onClick={onOpenAchievements}
            className="flex items-center gap-2 px-3.5 py-2 rounded-md bg-slate-900/90 hover:bg-slate-800 border border-slate-700/80 text-xs font-semibold text-slate-200 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <TrophyIcon className="w-3.5 h-3.5 text-amber-400" />
            <span>Achievements</span>
            <span className="font-mono-tabular text-amber-400">
              {unlockedCount}/{ACHIEVEMENT_CATALOG.length}
            </span>
          </button>

          <button
            type="button"
            onClick={onOpenAccount}
            className="flex items-center gap-2 px-3.5 py-2 rounded-md bg-slate-900/90 hover:bg-slate-800 border border-slate-700/80 text-xs font-semibold text-slate-200 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <PilotIcon className="w-3.5 h-3.5 text-sky-400" />
            <span>{currentUser ? currentUser.username : 'Pilot Sign In'}</span>
          </button>

          <PWAInstallButton />
        </div>
      </div>

      {/* Main Content Split: Left Setup Lockup + Right Match History */}
      <div className="my-auto py-4 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-8">
        {/* Left/Center Setup & Start Lockup */}
        <div className="max-w-lg pointer-events-auto">
          <SolarWingEmblem />

          <div className="mt-6 flex flex-col gap-4 items-start">
            {/* Level / Sector Selector */}
            <div className="w-full">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5 hud-stroke">
                Sector Level
              </div>
              <div className="flex flex-wrap items-center gap-1.5 p-1 rounded-md bg-slate-900/90 border border-slate-700/70">
                {LEVEL_CATALOG.map((lvl) => {
                  const active = levelId === lvl.id;
                  const cleared = clearedLevels.includes(lvl.id);
                  return (
                    <button
                      key={lvl.id}
                      type="button"
                      onClick={() => onSelectLevel(lvl.id)}
                      className={`px-3 py-1.5 text-xs font-semibold tracking-wide rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer flex items-center gap-1.5 ${
                        active
                          ? 'bg-slate-100 text-slate-950'
                          : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                      }`}
                    >
                      <span className="font-mono-tabular opacity-75">0{lvl.id}</span>
                      <span>{lvl.name}</span>
                      {cleared && (
                        <span
                          aria-label="Cleared"
                          className={active ? 'text-emerald-700 font-bold' : 'text-emerald-400 font-bold'}
                        >
                          ✓
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Difficulty Selector (4 Tiers) */}
            <div className="w-full">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5 hud-stroke">
                Difficulty
              </div>
              <div className="inline-flex flex-wrap items-center gap-1 p-1 rounded-md bg-slate-900/90 border border-slate-700/70">
                {DIFFICULTY_CATALOG.map((diff) => {
                  const active = difficulty === diff.id;
                  const activeStyle =
                    diff.id === 'cadet'
                      ? 'bg-sky-500 text-slate-950'
                      : diff.id === 'standard'
                        ? 'bg-amber-500 text-slate-950'
                        : diff.id === 'ace'
                          ? 'bg-rose-500 text-white'
                          : 'bg-purple-500 text-white';
                  return (
                    <button
                      key={diff.id}
                      type="button"
                      onClick={() => onSelectDifficulty(diff.id)}
                      className={`px-3.5 py-1.5 text-xs font-semibold tracking-wide rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                        active ? activeStyle : 'text-slate-300 hover:text-white'
                      }`}
                    >
                      {diff.label}
                    </button>
                  );
                })}
              </div>
              <div className="mt-1.5 text-xs text-slate-300 hud-stroke">{activeDiff.summary}</div>
            </div>

            <button
              type="button"
              data-start="true"
              onClick={onStart}
              className="mt-1 px-8 py-3.5 rounded-md bg-amber-500 hover:bg-amber-400 active:scale-[0.98] text-slate-950 font-display text-2xl font-extrabold tracking-wider uppercase transition-transform cursor-pointer shadow-lg shadow-amber-950/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300 whitespace-nowrap shrink-0"
            >
              Start Flight
            </button>
          </div>
        </div>

        {/* Right Column: Match History (Last 3 Winners) + Cross-Browser Prompt */}
        <div className="w-full lg:w-88 flex flex-col gap-3 pointer-events-auto shrink-0">
          <section
            aria-label="Match History"
            data-testid="match-history"
            className="rounded-md bg-[#111a2c]/95 border border-slate-700/80 p-4 shadow-xl"
          >
            <div className="flex items-baseline justify-between gap-2 pb-2.5 border-b border-slate-800">
              <h2 className="font-display text-xl font-extrabold tracking-wide uppercase text-white">
                Match History
              </h2>
              <span className="text-[11px] font-medium text-slate-400">Last 3 Winners</span>
            </div>

            {matchHistory.length === 0 ? (
              <p className="mt-3 text-xs leading-relaxed text-slate-400">
                No completed matches yet. Finish a sector flight to record the winner and final score locally.
              </p>
            ) : (
              <ol className="mt-2.5 divide-y divide-slate-800/80">
                {matchHistory.slice(0, 3).map((entry, idx) => {
                  const diffLabel = getDifficultyDef(entry.difficulty).label;
                  const isPilot = entry.winnerType === 'pilot';
                  return (
                    <li key={entry.id} className="py-2.5 first:pt-1 last:pb-0.5 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-baseline gap-2">
                          <span className="font-mono-tabular text-[11px] font-bold text-slate-500">
                            0{idx + 1}.
                          </span>
                          <span
                            className={`text-sm font-bold truncate ${
                              isPilot ? 'text-white' : 'text-rose-300'
                            }`}
                          >
                            {entry.winner}
                          </span>
                        </div>
                        <div className="mt-0.5 text-[11px] text-slate-400 truncate">
                          {isPilot ? 'Pilot Victory' : 'Hostile Victory'} · {diffLabel} · {entry.levelName}
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <div
                          className={`font-mono-tabular text-sm font-bold ${
                            isPilot ? 'text-amber-400' : 'text-slate-200'
                          }`}
                        >
                          {entry.score.toLocaleString()}
                        </div>
                        <div className="text-[10px] text-slate-500 font-mono-tabular">
                          Wave {entry.wave}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </section>

          {!currentUser && !promptDismissed && (
            <div className="rounded-md bg-[#111a2c]/95 border border-slate-700/80 p-3.5 shadow-xl">
              <div className="text-xs font-bold text-white">Save Across Browsers</div>
              <p className="mt-1 text-[11px] leading-relaxed text-slate-300">
                Create a callsign &amp; passcode so your achievements and match history carry over anywhere, or keep saving locally.
              </p>
              <div className="mt-2.5 flex items-center gap-2">
                <button
                  type="button"
                  onClick={onOpenAccount}
                  className="px-3 py-1.5 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 text-[11px] font-semibold cursor-pointer whitespace-nowrap"
                >
                  Sign In
                </button>
                <button
                  type="button"
                  onClick={onDismissPrompt}
                  className="px-2.5 py-1.5 rounded text-slate-400 hover:text-white text-[11px] font-medium cursor-pointer whitespace-nowrap"
                >
                  No thanks
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Row: Flat Control Hint */}
      <div className="flex flex-wrap items-end justify-between gap-4 shrink-0">
        <div className="text-xs sm:text-sm text-slate-400 tracking-wide hud-stroke">
          WASD Move · Mouse Aim &amp; Fire · F Auto-Fire · Space Dash · Q Nova · T Achievements · Esc Pause
        </div>
      </div>
    </div>
  );
};
