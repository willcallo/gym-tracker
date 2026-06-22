'use client';

import type { StrengthTier } from '@/lib/strengthStandards';

export const TIER_COLORS: Record<StrengthTier, string> = {
  Beginner: '#374151',
  Novice: '#1e40af',
  Intermediate: '#166534',
  Advanced: '#92400e',
  Elite: '#6d28d9',
  Master: '#991b1b',
};

export const TIER_TEXT: Record<StrengthTier, string> = {
  Beginner: '#9ca3af',
  Novice: '#93c5fd',
  Intermediate: '#86efac',
  Advanced: '#fcd34d',
  Elite: '#c4b5fd',
  Master: '#fca5a5',
};

const SILHOUETTE = '#111827';
const UNRANKED = '#1f2937';

function Silhouette() {
  return (
    <>
      <ellipse cx="75" cy="30" rx="22" ry="25" fill={SILHOUETTE} />
      <rect x="67" y="52" width="16" height="14" fill={SILHOUETTE} />
      <rect x="47" y="60" width="56" height="128" rx="8" fill={SILHOUETTE} />
      <rect x="16" y="62" width="28" height="83" rx="10" fill={SILHOUETTE} />
      <rect x="106" y="62" width="28" height="83" rx="10" fill={SILHOUETTE} />
      <rect x="18" y="145" width="24" height="58" rx="8" fill={SILHOUETTE} />
      <rect x="108" y="145" width="24" height="58" rx="8" fill={SILHOUETTE} />
      <rect x="47" y="188" width="26" height="108" rx="9" fill={SILHOUETTE} />
      <rect x="77" y="188" width="26" height="108" rx="9" fill={SILHOUETTE} />
      <rect x="48" y="296" width="23" height="92" rx="8" fill={SILHOUETTE} />
      <rect x="79" y="296" width="23" height="92" rx="8" fill={SILHOUETTE} />
    </>
  );
}

interface Props {
  muscleTiers: Partial<Record<string, StrengthTier>>;
}

export default function BodyMap({ muscleTiers }: Props) {
  const fill = (muscle: string) => {
    const tier = muscleTiers[muscle];
    return tier ? TIER_COLORS[tier] : UNRANKED;
  };

  return (
    <svg
      viewBox="0 0 310 405"
      xmlns="http://www.w3.org/2000/svg"
      className="w-full max-w-xs mx-auto"
      aria-label="Body map showing muscle strength tiers"
    >
      <text x="75" y="400" fill="#6b7280" fontSize="9" textAnchor="middle" fontFamily="system-ui, sans-serif">
        FRONT
      </text>
      <text x="235" y="400" fill="#6b7280" fontSize="9" textAnchor="middle" fontFamily="system-ui, sans-serif">
        BACK
      </text>
      <line x1="155" y1="5" x2="155" y2="393" stroke="#374151" strokeWidth="1" strokeDasharray="4,4" />

      {/* FRONT VIEW */}
      <g>
        <Silhouette />
        {/* Chest */}
        <ellipse cx="63" cy="88" rx="12" ry="16" fill={fill('chest')} opacity="0.9" />
        <ellipse cx="87" cy="88" rx="12" ry="16" fill={fill('chest')} opacity="0.9" />
        {/* Shoulders (anterior deltoid) */}
        <ellipse cx="24" cy="70" rx="13" ry="11" fill={fill('shoulders')} opacity="0.9" />
        <ellipse cx="126" cy="70" rx="13" ry="11" fill={fill('shoulders')} opacity="0.9" />
        {/* Biceps */}
        <rect x="19" y="70" width="20" height="58" rx="7" fill={fill('biceps')} opacity="0.85" />
        <rect x="111" y="70" width="20" height="58" rx="7" fill={fill('biceps')} opacity="0.85" />
        {/* Core / Abs */}
        <rect x="52" y="118" width="46" height="68" rx="6" fill={fill('core')} opacity="0.85" />
        {/* Quads */}
        <rect x="49" y="192" width="22" height="98" rx="7" fill={fill('quads')} opacity="0.85" />
        <rect x="79" y="192" width="22" height="98" rx="7" fill={fill('quads')} opacity="0.85" />
        {/* Calves */}
        <rect x="50" y="298" width="19" height="75" rx="7" fill={fill('calves')} opacity="0.85" />
        <rect x="82" y="298" width="19" height="75" rx="7" fill={fill('calves')} opacity="0.85" />
      </g>

      {/* BACK VIEW */}
      <g transform="translate(160, 0)">
        <Silhouette />
        {/* Upper back (traps / rhomboids) */}
        <rect x="50" y="64" width="50" height="58" rx="6" fill={fill('upper back')} opacity="0.9" />
        {/* Shoulders (rear deltoid) */}
        <ellipse cx="24" cy="70" rx="13" ry="11" fill={fill('shoulders')} opacity="0.9" />
        <ellipse cx="126" cy="70" rx="13" ry="11" fill={fill('shoulders')} opacity="0.9" />
        {/* Lats */}
        <polygon points="47,66 22,106 22,148 47,146" fill={fill('lats')} opacity="0.85" />
        <polygon points="103,66 128,106 128,148 103,146" fill={fill('lats')} opacity="0.85" />
        {/* Triceps */}
        <rect x="19" y="70" width="20" height="58" rx="7" fill={fill('triceps')} opacity="0.85" />
        <rect x="111" y="70" width="20" height="58" rx="7" fill={fill('triceps')} opacity="0.85" />
        {/* Lower back */}
        <rect x="52" y="128" width="46" height="58" rx="6" fill={fill('lower back')} opacity="0.85" />
        {/* Glutes */}
        <ellipse cx="61" cy="207" rx="19" ry="22" fill={fill('glutes')} opacity="0.9" />
        <ellipse cx="89" cy="207" rx="19" ry="22" fill={fill('glutes')} opacity="0.9" />
        {/* Hamstrings */}
        <rect x="49" y="225" width="22" height="70" rx="7" fill={fill('hamstrings')} opacity="0.85" />
        <rect x="79" y="225" width="22" height="70" rx="7" fill={fill('hamstrings')} opacity="0.85" />
        {/* Calves */}
        <rect x="50" y="298" width="19" height="75" rx="7" fill={fill('calves')} opacity="0.85" />
        <rect x="82" y="298" width="19" height="75" rx="7" fill={fill('calves')} opacity="0.85" />
      </g>
    </svg>
  );
}
