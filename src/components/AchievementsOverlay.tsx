import React from 'react';
import { ACHIEVEMENT_CATALOG } from '../game/achievements';
import type { AchievementDef, PlayerProgress } from '../game/types';
import { AchievementBadgeIcon, TrophyIcon } from './GameIcons';

interface AchievementsOverlayProps {
  progress: PlayerProgress;
  pilotUsername: string | null;
  onClose: () => void;
}

export const AchievementsOverlay: React.FC<AchievementsOverlayProps> = ({
  progress,
  pilotUsername,
  onClose,
}) => {
  const unlockedCount = ACHIEVEMENT_CATALOG.filter((a) => Boolean(progress.unlocked[a.id])).length;

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-[#070b14]/82 p-4 sm:p-6">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Achievements and Career Milestones"
        className="w-full max-w-3xl max-h-[88vh] flex flex-col rounded-lg bg-[#111a2c] border border-slate-700/80 shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-4 px-6 py-5 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <TrophyIcon className="w-6 h-6 text-amber-400 shrink-0" />
            <div>
              <h2 className="font-display text-3xl font-extrabold tracking-wide uppercase text-white leading-none">
                Flight Milestones
              </h2>
              <div className="mt-1 text-xs text-slate-400">
                {pilotUsername ? `Pilot: ${pilotUsername}` : 'Local Browser Profile'} ·{' '}
                <span className="font-mono-tabular text-amber-400 font-semibold">
                  {unlockedCount} / {ACHIEVEMENT_CATALOG.length} Unlocked
                </span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-md bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-100 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Close [Esc]
          </button>
        </div>

        {/* Career Summary Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 px-6 py-4 bg-slate-950/50 border-b border-slate-800">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Total Enemies Defeated
            </div>
            <div className="font-mono-tabular text-xl font-bold text-white mt-0.5">
              {progress.stats.totalEnemiesDefeated.toLocaleString()}
            </div>
          </div>
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Perfect Wave Clears
            </div>
            <div className="font-mono-tabular text-xl font-bold text-sky-400 mt-0.5">
              {progress.stats.perfectWaveClears.toLocaleString()}
            </div>
          </div>
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Shots Reflected
            </div>
            <div className="font-mono-tabular text-xl font-bold text-rose-400 mt-0.5">
              {progress.stats.totalShotsReflected.toLocaleString()}
            </div>
          </div>
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Best Score
            </div>
            <div className="font-mono-tabular text-xl font-bold text-amber-400 mt-0.5">
              {progress.stats.bestScore.toLocaleString()}
            </div>
          </div>
        </div>

        {/* Achievements List */}
        <div className="p-6 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          {ACHIEVEMENT_CATALOG.map((ach) => {
            const unlockedAt = progress.unlocked[ach.id];
            const isUnlocked = Boolean(unlockedAt);
            const current = Math.min(ach.target, ach.getValue(progress.stats));
            const ratio = Math.min(1, current / ach.target);

            return (
              <div
                key={ach.id}
                className={`rounded-md p-4 border transition-colors ${
                  isUnlocked
                    ? 'bg-slate-900/95 border-amber-500/45'
                    : 'bg-slate-900/55 border-slate-800'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <AchievementBadgeIcon unlocked={isUnlocked} accent={ach.accent} />
                    <div>
                      <div className="text-sm font-bold text-white">{ach.title}</div>
                      <p className="text-xs text-slate-300 mt-0.5 leading-relaxed">
                        {ach.description}
                      </p>
                    </div>
                  </div>
                  <span
                    className={`text-[11px] font-semibold whitespace-nowrap shrink-0 ${
                      isUnlocked ? 'text-amber-400' : 'text-slate-500'
                    }`}
                  >
                    {isUnlocked ? 'Unlocked' : 'In Progress'}
                  </span>
                </div>

                <div className="mt-3">
                  <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
                    <span>{ach.metricLabel}</span>
                    <span className="font-mono-tabular font-semibold text-slate-200">
                      {current.toLocaleString()} / {ach.target.toLocaleString()}
                    </span>
                  </div>
                  <div className="w-full h-1.5 rounded-sm bg-slate-950 overflow-hidden">
                    <div
                      className="h-full origin-left transition-transform duration-150"
                      style={{
                        transform: `scaleX(${ratio})`,
                        backgroundColor: isUnlocked ? ach.accent : '#64748b',
                      }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export const AchievementToastBanner: React.FC<{
  toast: AchievementDef | null;
}> = ({ toast }) => {
  if (!toast) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-5 right-5 z-20 pointer-events-none flex items-center gap-3 rounded-md bg-[#111a2c] border border-amber-400/70 px-4 py-3 shadow-xl max-w-xs"
    >
      <AchievementBadgeIcon unlocked={true} accent={toast.accent} />
      <div>
        <div className="text-[11px] font-bold uppercase tracking-wider text-amber-400">
          Milestone Unlocked
        </div>
        <div className="text-sm font-bold text-white">{toast.title}</div>
      </div>
    </div>
  );
};
