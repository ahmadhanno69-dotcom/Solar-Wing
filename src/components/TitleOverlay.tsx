import React from 'react';
import type { Difficulty } from '../game/types';
import { SolarWingEmblem } from './GameIcons';

interface TitleOverlayProps {
  difficulty: Difficulty;
  bestScore: number;
  onSelectDifficulty: (diff: Difficulty) => void;
  onStart: () => void;
}

export const TitleOverlay: React.FC<TitleOverlayProps> = ({
  difficulty,
  bestScore,
  onSelectDifficulty,
  onStart,
}) => {
  return (
    <div className="fixed inset-0 z-10 flex flex-col justify-between px-8 py-10 sm:px-14 sm:py-12 pointer-events-none">
      {/* Top Safe Space / Best Score Readout (unboxed, zero pills) */}
      <div className="flex items-center justify-between">
        {bestScore > 0 ? (
          <div className="text-xs font-medium tracking-wider uppercase text-slate-400 hud-stroke">
            Best Score <span className="ml-2 font-mono-tabular text-sm font-bold text-amber-400">{bestScore.toLocaleString()}</span>
          </div>
        ) : (
          <div />
        )}
      </div>

      {/* Left/Center Negative-Space Lockup */}
      <div className="my-auto max-w-md pointer-events-auto">
        <SolarWingEmblem />

        <div className="mt-7 flex flex-col gap-5 items-start">
          {/* Difficulty Segmented Selector (functional toggle, <= 3 menu actions total) */}
          <div className="inline-flex items-center p-1 rounded-md bg-slate-900/90 border border-slate-700/70">
            <button
              type="button"
              onClick={() => onSelectDifficulty('standard')}
              className={`px-4 py-2 text-xs font-semibold tracking-wide rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                difficulty === 'standard'
                  ? 'bg-amber-500 text-slate-950'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              Standard
            </button>
            <button
              type="button"
              onClick={() => onSelectDifficulty('ace')}
              className={`px-4 py-2 text-xs font-semibold tracking-wide rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                difficulty === 'ace'
                  ? 'bg-rose-500 text-white'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              Ace Pilot
            </button>
          </div>

          {/* Primary Start CTA */}
          <button
            type="button"
            data-start="true"
            onClick={onStart}
            className="px-8 py-3.5 rounded-md bg-amber-500 hover:bg-amber-400 active:scale-[0.98] text-slate-950 font-display text-2xl font-extrabold tracking-wider uppercase transition-transform cursor-pointer shadow-lg shadow-amber-950/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300 whitespace-nowrap shrink-0"
          >
            Start Flight
          </button>
        </div>
      </div>

      {/* Flat Borderless Single-Line Control Hint */}
      <div className="text-xs sm:text-sm text-slate-400 tracking-wide hud-stroke">
        WASD Move · Mouse Aim &amp; Fire · Space Dash · Q Nova · Esc Pause
      </div>
    </div>
  );
};
