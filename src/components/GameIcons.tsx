import React from 'react';
import type { UpgradeId } from '../game/types';

export const SolarWingEmblem: React.FC = () => (
  <svg
    viewBox="0 0 420 120"
    className="w-[320px] sm:w-[400px] h-auto select-none"
    role="img"
    aria-label="Solar Wing"
  >
    {/* Winged Sun Crest */}
    <g transform="translate(54, 60)">
      <path
        d="M-44 -16 L-10 -8 L0 -32 L10 -8 L44 -16 L20 6 L34 22 L0 12 L-34 22 L-20 6 Z"
        fill="#f59e0b"
        stroke="#0b111e"
        strokeWidth="3.5"
        strokeLinejoin="round"
      />
      <polygon
        points="0,-19 8,-2 0,10 -8,-2"
        fill="#f8fafc"
        stroke="#0b111e"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
    </g>

    {/* Display Wordmark */}
    <text
      x="114"
      y="62"
      fill="#f8fafc"
      stroke="#0b111e"
      strokeWidth="5"
      paintOrder="stroke fill"
      fontFamily="'Barlow Condensed', sans-serif"
      fontWeight="800"
      fontSize="54"
      letterSpacing="2"
    >
      SOLAR WING
    </text>

    {/* Crisp Architectural Rule */}
    <line x1="116" y1="76" x2="398" y2="76" stroke="#f59e0b" strokeWidth="2.5" />
    <text
      x="116"
      y="96"
      fill="#94a3b8"
      fontFamily="'Plus Jakarta Sans', sans-serif"
      fontWeight="600"
      fontSize="13"
      letterSpacing="3.2"
    >
      AERIAL DASH ARENA
    </text>
  </svg>
);

export const VitalitySocketIcon: React.FC<{ state: 'full' | 'damaged' | 'empty' }> = ({ state }) => {
  const fill =
    state === 'full'
      ? '#f59e0b'
      : state === 'damaged'
        ? '#f43f5e'
        : 'rgba(15, 23, 42, 0.72)';
  const stroke = state === 'empty' ? 'rgba(148, 163, 184, 0.35)' : '#0b111e';

  return (
    <svg viewBox="0 0 24 24" className="w-6 h-6 shrink-0" aria-hidden="true">
      <path
        d="M12 2.5 L20.5 7 L18 16.5 L12 21.5 L6 16.5 L3.5 7 Z"
        fill={fill}
        stroke={stroke}
        strokeWidth="2"
        strokeLinejoin="round"
      />
      {state === 'full' && (
        <path d="M12 5.5 L16.5 8 L15 14 L12 16.8 L9 14 L7.5 8 Z" fill="#fef3c7" opacity="0.65" />
      )}
      {state === 'damaged' && (
        <path d="M11 6 L13.5 11 L10.5 14 L13 18" stroke="#0b111e" strokeWidth="1.8" fill="none" />
      )}
    </svg>
  );
};

export const DashIcon: React.FC = () => (
  <svg viewBox="0 0 24 24" className="w-4 h-4 shrink-0" aria-hidden="true">
    <path
      d="M4 12 L15 6 L13 11 L21 11 L11 18 L13 13 L4 13 Z"
      fill="#38bdf8"
      stroke="#0b111e"
      strokeWidth="1.6"
      strokeLinejoin="round"
    />
  </svg>
);

export const NovaIcon: React.FC<{ ready: boolean }> = ({ ready }) => (
  <svg viewBox="0 0 24 24" className="w-4 h-4 shrink-0" aria-hidden="true">
    <polygon
      points="12,2 14.8,9.2 22,12 14.8,14.8 12,22 9.2,14.8 2,12 9.2,9.2"
      fill={ready ? '#fbbf24' : '#64748b'}
      stroke="#0b111e"
      strokeWidth="1.6"
      strokeLinejoin="round"
    />
  </svg>
);

export const MuteIcon: React.FC<{ muted: boolean }> = ({ muted }) => (
  <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor" opacity="0.2" />
    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
    {muted ? (
      <>
        <line x1="22" y1="9" x2="16" y2="15" />
        <line x1="16" y1="9" x2="22" y2="15" />
      </>
    ) : (
      <>
        <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
        <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
      </>
    )}
  </svg>
);

export const PauseIcon: React.FC = () => (
  <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor" aria-hidden="true">
    <rect x="6" y="5" width="4" height="14" rx="1" />
    <rect x="14" y="5" width="4" height="14" rx="1" />
  </svg>
);

export const RestartIcon: React.FC = () => (
  <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
    <path d="M3 3v5h5" />
  </svg>
);

export const UpgradeIcon: React.FC<{ id: UpgradeId; color: string }> = ({ id, color }) => {
  return (
    <svg viewBox="0 0 24 24" className="w-6 h-6 shrink-0" aria-hidden="true">
      <rect x="2" y="2" width="20" height="20" rx="5" fill="#0b111e" stroke={color} strokeWidth="1.8" />
      {id === 'twin_cannon' && (
        <path d="M8 17 V7 M16 17 V7 M8 7 L10 5 M16 7 L14 5" stroke={color} strokeWidth="2.2" strokeLinecap="round" />
      )}
      {id === 'chain_dash' && (
        <path d="M5 13 L13 7 L11 11 L19 11 L11 17 L13 13 Z" fill={color} />
      )}
      {id === 'reflect_aegis' && (
        <path d="M6 7 L12 12 L18 7 M6 17 L18 17" stroke={color} strokeWidth="2.2" strokeLinecap="round" fill="none" />
      )}
      {id === 'overclock_wings' && (
        <path d="M4 15 L12 6 L20 15 L12 12 Z" fill={color} />
      )}
      {id === 'solar_magnet' && (
        <path d="M7 7 V13 A5 5 0 0 0 17 13 V7" stroke={color} strokeWidth="2.4" fill="none" strokeLinecap="round" />
      )}
      {id === 'nova_capacitor' && (
        <polygon points="12,5 14,10 19,12 14,14 12,19 10,14 5,12 10,10" fill={color} />
      )}
      {id === 'hull_plating' && (
        <path d="M12 5 L18 8 V13 C18 16.5 15 18.5 12 19.5 C9 18.5 6 16.5 6 13 V8 Z" fill={color} />
      )}
      {id === 'wingman_drone' && (
        <path d="M12 5 L18 16 L12 13 L6 16 Z" fill={color} />
      )}
    </svg>
  );
};

export const TrophyIcon: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
    <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
    <path d="M4 22h16" />
    <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
    <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
    <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
  </svg>
);

export const PilotIcon: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="8" r="4" />
    <path d="M5 20a7 7 0 0 1 14 0" />
  </svg>
);

export const AchievementBadgeIcon: React.FC<{ unlocked: boolean; accent: string }> = ({
  unlocked,
  accent,
}) => (
  <svg viewBox="0 0 24 24" className="w-7 h-7 shrink-0" aria-hidden="true">
    <polygon
      points="12,2 21,7 21,17 12,22 3,17 3,7"
      fill={unlocked ? accent : '#0f172a'}
      stroke={unlocked ? '#0b111e' : '#334155'}
      strokeWidth="2"
      strokeLinejoin="round"
    />
    {unlocked ? (
      <path d="M8.5 12.2 L11 14.8 L16 9.5" stroke="#0b111e" strokeWidth="2.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    ) : (
      <circle cx="12" cy="12" r="3" fill="none" stroke="#475569" strokeWidth="1.8" />
    )}
  </svg>
);

