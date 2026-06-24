'use client';

import type { StrengthTier } from '@/lib/strengthStandards';

// Bright enough to be clearly visible on the dark navy background
export const TIER_COLORS: Record<StrengthTier, string> = {
  Beginner:     '#6b7280',  // gray
  Novice:       '#3b82f6',  // blue
  Intermediate: '#22c55e',  // green
  Advanced:     '#f59e0b',  // amber
  Elite:        '#a855f7',  // purple
  Master:       '#ef4444',  // red
};

export const TIER_TEXT: Record<StrengthTier, string> = {
  Beginner:     '#d1d5db',  // gray-300
  Novice:       '#93c5fd',  // blue-300
  Intermediate: '#86efac',  // green-300
  Advanced:     '#fcd34d',  // yellow-300
  Elite:        '#d8b4fe',  // purple-300
  Master:       '#fca5a5',  // red-300
};

// Silhouette slightly lighter than page bg so the body shape reads clearly
const SILHOUETTE = '#0d0d7a';
// Unranked muscle regions — subtly distinct from silhouette
const UNRANKED = '#1c1c9a';

function Silhouette() {
  return (
    <>
      {/* Head */}
      <ellipse cx="75" cy="28" rx="22" ry="26" fill={SILHOUETTE} />

      {/* Neck */}
      <path d="M 68,51 Q 75,57 82,51 L 84,65 Q 75,68 66,65 Z" fill={SILHOUETTE} />

      {/* Torso — hourglass: wide at shoulders, narrows at waist, slight hip flare */}
      <path
        d="M 24,66 C 34,61 52,58 68,57 L 82,57 C 98,58 116,61 126,66
           C 130,70 132,80 130,94 C 128,108 122,122 118,136
           C 114,150 112,160 114,168 C 116,174 118,180 116,186
           L 34,186 C 32,180 34,174 36,168 C 38,160 36,150 32,136
           C 28,122 22,108 20,94 C 18,80 20,70 24,66 Z"
        fill={SILHOUETTE}
      />

      {/* Left upper arm — curved, connects flush to shoulder */}
      <path
        d="M 20,68 C 14,74 8,90 8,116 C 8,130 10,144 14,154
           C 16,160 20,164 24,162 C 28,160 30,155 30,150
           C 28,136 26,122 26,108 C 26,88 26,74 30,68 C 26,65 22,65 20,68 Z"
        fill={SILHOUETTE}
      />

      {/* Right upper arm */}
      <path
        d="M 130,68 C 136,74 142,90 142,116 C 142,130 140,144 136,154
           C 134,160 130,164 126,162 C 122,160 120,155 120,150
           C 122,136 124,122 124,108 C 124,88 124,74 120,68 C 124,65 128,65 130,68 Z"
        fill={SILHOUETTE}
      />

      {/* Left lower arm */}
      <path
        d="M 10,158 C 6,170 4,188 6,208 C 8,222 12,232 16,234
           C 20,236 24,233 26,222 C 28,212 28,196 26,182
           C 24,172 22,164 20,160 C 16,156 12,156 10,158 Z"
        fill={SILHOUETTE}
      />

      {/* Right lower arm */}
      <path
        d="M 140,158 C 144,170 146,188 144,208 C 142,222 138,232 134,234
           C 130,236 126,233 124,222 C 122,212 122,196 124,182
           C 126,172 128,164 130,160 C 134,156 138,156 140,158 Z"
        fill={SILHOUETTE}
      />

      {/* Left thigh — tapered, slight gap from right thigh */}
      <path
        d="M 34,188 C 30,196 28,214 28,234 C 28,254 30,270 34,282
           L 62,282 C 66,270 68,254 68,234 C 68,214 66,196 62,188 Z"
        fill={SILHOUETTE}
      />

      {/* Right thigh */}
      <path
        d="M 88,188 C 84,196 82,214 82,234 C 82,254 84,270 88,282
           L 116,282 C 120,270 122,254 122,234 C 122,214 120,196 116,188 Z"
        fill={SILHOUETTE}
      />

      {/* Left shin — tapers and rounds at ankle */}
      <path
        d="M 35,285 C 32,298 30,318 32,340 C 34,356 38,368 42,375
           C 46,380 52,382 57,382 C 62,382 66,379 68,373
           C 70,364 70,350 68,334 C 66,312 64,296 62,285 Z"
        fill={SILHOUETTE}
      />

      {/* Right shin */}
      <path
        d="M 88,285 C 85,298 83,318 85,340 C 87,356 91,368 95,375
           C 99,380 105,382 110,382 C 115,382 119,379 121,373
           C 123,364 123,350 121,334 C 119,312 117,296 115,285 Z"
        fill={SILHOUETTE}
      />
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
      <text x="75" y="400" fill="rgba(255,255,255,0.3)" fontSize="9" textAnchor="middle" fontFamily="system-ui, sans-serif">
        FRONT
      </text>
      <text x="235" y="400" fill="rgba(255,255,255,0.3)" fontSize="9" textAnchor="middle" fontFamily="system-ui, sans-serif">
        BACK
      </text>
      <line x1="155" y1="5" x2="155" y2="393" stroke="rgba(255,255,255,0.08)" strokeWidth="1" strokeDasharray="4,4" />

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
        <rect x="11" y="72" width="18" height="58" rx="7" fill={fill('biceps')} opacity="0.85" />
        <rect x="121" y="72" width="18" height="58" rx="7" fill={fill('biceps')} opacity="0.85" />
        {/* Core / Abs */}
        <rect x="52" y="118" width="46" height="60" rx="6" fill={fill('core')} opacity="0.85" />
        {/* Quads */}
        <rect x="31" y="194" width="26" height="80" rx="8" fill={fill('quads')} opacity="0.85" />
        <rect x="93" y="194" width="26" height="80" rx="8" fill={fill('quads')} opacity="0.85" />
        {/* Calves (front — smaller, on shin) */}
        <rect x="38" y="298" width="20" height="60" rx="7" fill={fill('calves')} opacity="0.75" />
        <rect x="92" y="298" width="20" height="60" rx="7" fill={fill('calves')} opacity="0.75" />
      </g>

      {/* BACK VIEW */}
      <g transform="translate(160, 0)">
        <Silhouette />
        {/* Upper back (traps / rhomboids) */}
        <rect x="48" y="64" width="54" height="56" rx="6" fill={fill('upper back')} opacity="0.9" />
        {/* Shoulders (rear deltoid) */}
        <ellipse cx="24" cy="70" rx="13" ry="11" fill={fill('shoulders')} opacity="0.9" />
        <ellipse cx="126" cy="70" rx="13" ry="11" fill={fill('shoulders')} opacity="0.9" />
        {/* Lats */}
        <polygon points="47,68 22,106 22,148 47,144" fill={fill('lats')} opacity="0.85" />
        <polygon points="103,68 128,106 128,148 103,144" fill={fill('lats')} opacity="0.85" />
        {/* Triceps */}
        <rect x="11" y="72" width="18" height="58" rx="7" fill={fill('triceps')} opacity="0.85" />
        <rect x="121" y="72" width="18" height="58" rx="7" fill={fill('triceps')} opacity="0.85" />
        {/* Lower back */}
        <rect x="48" y="126" width="54" height="52" rx="6" fill={fill('lower back')} opacity="0.85" />
        {/* Glutes */}
        <ellipse cx="59" cy="205" rx="21" ry="22" fill={fill('glutes')} opacity="0.9" />
        <ellipse cx="91" cy="205" rx="21" ry="22" fill={fill('glutes')} opacity="0.9" />
        {/* Hamstrings */}
        <rect x="31" y="226" width="26" height="48" rx="8" fill={fill('hamstrings')} opacity="0.85" />
        <rect x="93" y="226" width="26" height="48" rx="8" fill={fill('hamstrings')} opacity="0.85" />
        {/* Calves (back — fuller) */}
        <ellipse cx="47" cy="318" rx="13" ry="30" fill={fill('calves')} opacity="0.9" />
        <ellipse cx="103" cy="318" rx="13" ry="30" fill={fill('calves')} opacity="0.9" />
      </g>
    </svg>
  );
}
