import React from 'react';
import type { HudSnapshot } from '../game/types';
import {
  DashIcon,
  MuteIcon,
  NovaIcon,
  PauseIcon,
  RestartIcon,
  VitalitySocketIcon,
} from './GameIcons';

interface HudOverlayProps {
  hud: HudSnapshot;
  dashBarRef: React.RefObject<HTMLDivElement | null>;
  novaBarRef: React.RefObject<HTMLDivElement | null>;
  onToggleMute: () => void;
  onPause: () => void;
  onRestart: () => void;
}

export const HudOverlay: React.FC<HudOverlayProps> = ({
  hud,
  dashBarRef,
  novaBarRef,
  onToggleMute,
  onPause,
  onRestart,
}) => {
  const novaReady = hud.novaCharge >= 100;

  return (
    <div className="fixed inset-0 z-10 pointer-events-none p-4 sm:p-6 flex flex-col justify-between">
      {/* Top Perimeter Row */}
      <div className="flex items-start justify-between gap-4">
        {/* Top-Left Cluster: Vitality Pips + Dash & Nova Meters */}
        <div className="flex flex-col gap-2.5 min-w-[200px]">
          <div className="flex items-center gap-2.5">
            <span className="text-[11px] font-bold uppercase tracking-widest text-slate-400 hud-stroke">
              Hull
            </span>
            <span className="font-mono-tabular text-sm font-bold text-slate-100 hud-stroke">
              {hud.hp}/{hud.maxHp}
            </span>
            <div className="flex items-center gap-1 ml-1">
              {Array.from({ length: hud.maxHp }).map((_, idx) => {
                let state: 'full' | 'damaged' | 'empty' = 'empty';
                if (idx < hud.hp) {
                  state = 'full';
                } else if (idx < Math.ceil(hud.ghostHp)) {
                  state = 'damaged';
                }
                return <VitalitySocketIcon key={idx} state={state} />;
              })}
            </div>
          </div>

          {/* Dash & Nova Charge Bars (mutated directly at 60fps via refs) */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <DashIcon />
              <div className="w-20 h-2 rounded-sm bg-slate-900/90 border border-slate-700/80 overflow-hidden">
                <div
                  ref={dashBarRef}
                  className="h-full w-full bg-sky-400 origin-left transition-none"
                  style={{ transform: `scaleX(${hud.dashReadyRatio})` }}
                />
              </div>
              <span className="text-[10px] font-mono-tabular text-slate-400 hud-stroke">SPC</span>
            </div>

            <div className="flex items-center gap-1.5">
              <NovaIcon ready={novaReady} />
              <div className="w-24 h-2 rounded-sm bg-slate-900/90 border border-slate-700/80 overflow-hidden">
                <div
                  ref={novaBarRef}
                  className={`h-full w-full origin-left transition-none ${
                    novaReady ? 'bg-amber-400' : 'bg-amber-500/80'
                  }`}
                  style={{ transform: `scaleX(${hud.novaCharge / 100})` }}
                />
              </div>
              <span
                className={`text-[10px] font-mono-tabular font-bold hud-stroke ${
                  novaReady ? 'text-amber-300' : 'text-slate-400'
                }`}
              >
                {novaReady ? 'Q READY' : `${hud.novaCharge}%`}
              </span>
            </div>
          </div>
        </div>

        {/* Top-Center Cluster: Boss HP (Active Only During Boss Waves) */}
        {hud.bossName && (
          <div className="hidden sm:flex flex-col items-center gap-1 w-72 pt-0.5">
            <div className="flex items-center justify-between w-full text-xs font-bold tracking-wider uppercase hud-stroke">
              <span className="text-rose-400">{hud.bossName}</span>
              <span className="font-mono-tabular text-slate-200">{hud.bossHpText}</span>
            </div>
            <div className="w-full h-2.5 rounded-sm bg-slate-900/95 border border-rose-500/50 overflow-hidden">
              <div
                className="h-full bg-rose-500 origin-left transition-transform duration-100"
                style={{ transform: `scaleX(${hud.bossHpRatio})` }}
              />
            </div>
          </div>
        )}

        {/* Top-Right Cluster: Wave, Score, Combo & Utility Controls */}
        <div className="flex items-start gap-5">
          <div className="flex items-baseline gap-5 text-right">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-widest text-slate-400 hud-stroke">
                Wave
              </div>
              <div className="font-display text-2xl font-extrabold leading-none text-slate-100 tabular-nums hud-stroke">
                {hud.wave}
                {hud.wave <= hud.targetVictoryWave && (
                  <span className="text-sm font-semibold text-slate-400">/{hud.targetVictoryWave}</span>
                )}
              </div>
            </div>

            <div>
              <div className="text-[11px] font-bold uppercase tracking-widest text-slate-400 hud-stroke">
                Score
              </div>
              <div
                data-testid="hud-score"
                className="font-display text-3xl font-extrabold leading-none text-amber-400 tabular-nums hud-stroke"
              >
                {hud.score.toLocaleString()}
              </div>
            </div>

            {hud.combo > 1 && (
              <div>
                <div className="text-[11px] font-bold uppercase tracking-widest text-amber-300 hud-stroke">
                  Combo
                </div>
                <div className="font-display text-2xl font-extrabold leading-none text-white tabular-nums hud-stroke">
                  x{hud.combo}
                </div>
              </div>
            )}
          </div>

          {/* Utility Buttons */}
          <div className="flex items-center gap-1.5 pointer-events-auto">
            <button
              type="button"
              tabIndex={-1}
              aria-label={hud.isMuted ? 'Unmute audio' : 'Mute audio'}
              title="Mute [M]"
              onClick={(e) => {
                e.currentTarget.blur();
                onToggleMute();
              }}
              className="w-9 h-9 rounded-md bg-slate-900/90 hover:bg-slate-800 border border-slate-700/80 text-slate-200 flex items-center justify-center cursor-pointer transition-colors"
            >
              <MuteIcon muted={hud.isMuted} />
            </button>
            <button
              type="button"
              tabIndex={-1}
              aria-label="Pause game"
              title="Pause [P]"
              onClick={(e) => {
                e.currentTarget.blur();
                onPause();
              }}
              className="w-9 h-9 rounded-md bg-slate-900/90 hover:bg-slate-800 border border-slate-700/80 text-slate-200 flex items-center justify-center cursor-pointer transition-colors"
            >
              <PauseIcon />
            </button>
            <button
              type="button"
              tabIndex={-1}
              aria-label="Restart flight"
              title="Restart [R]"
              onClick={(e) => {
                e.currentTarget.blur();
                onRestart();
              }}
              className="w-9 h-9 rounded-md bg-slate-900/90 hover:bg-slate-800 border border-slate-700/80 text-slate-200 flex items-center justify-center cursor-pointer transition-colors"
            >
              <RestartIcon />
            </button>
          </div>
        </div>
      </div>

      {/* Bottom Perimeter Left: Remaining Hostiles Integer Indicator */}
      <div className="flex items-end justify-between">
        <div className="text-xs font-medium text-slate-400 tabular-nums hud-stroke">
          Hostiles Remaining <span className="ml-1.5 font-mono-tabular font-bold text-slate-200">{hud.enemiesRemaining}</span>
        </div>
      </div>
    </div>
  );
};
