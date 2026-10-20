'use client';

import { useState } from 'react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatShortDate, formatWeight } from '@/lib/format';
import type { ExercisePoint } from '@/lib/types';

const BRAND = '#009276';
const INK = '#374151';
const GRID = '#e5e7eb';

type Metric = 'best' | 'volume';

interface Datum {
  date: string;
  value: number;
  isPR: boolean;
}

interface DotProps {
  cx?: number;
  cy?: number;
  payload?: Datum;
}

// PR sessions get a large dot with a white ring; the rest are small so the line stays quiet.
function Dot({ cx, cy, payload }: DotProps) {
  if (cx === undefined || cy === undefined || !payload) return null;
  return payload.isPR ? (
    <circle cx={cx} cy={cy} r={6} fill={BRAND} stroke="#fff" strokeWidth={2} />
  ) : (
    <circle cx={cx} cy={cy} r={3} fill={BRAND} stroke="#fff" strokeWidth={1} />
  );
}

export default function ProgressChart({
  points,
  isBodyweight,
}: {
  points: ExercisePoint[];
  isBodyweight: boolean;
}) {
  const [metric, setMetric] = useState<Metric>('best');
  const bestLabel = isBodyweight ? 'Most reps' : 'Top weight';
  const volumeLabel = isBodyweight ? 'Total reps' : 'Volume';
  const unit = metric === 'best' ? (isBodyweight ? 'reps' : 'kg') : isBodyweight ? 'reps' : 'kg total';

  const data: Datum[] = points.map((p) => ({
    date: p.date,
    isPR: p.isPR,
    value: metric === 'volume' ? p.volume : isBodyweight ? p.max_reps : (p.top_weight ?? 0),
  }));

  return (
    <div>
      <div className="mb-3 grid grid-cols-2 gap-1 rounded-xl bg-gray-100 p-1" role="group" aria-label="Chart metric">
        {(
          [
            ['best', bestLabel],
            ['volume', volumeLabel],
          ] as [Metric, string][]
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            aria-pressed={metric === key}
            onClick={() => setMetric(key)}
            className={`min-h-11 rounded-lg text-base font-semibold ${
              metric === key ? 'bg-white text-brand-ink shadow-sm' : 'text-gray-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="h-60 w-full" role="img" aria-label={`${metric === 'best' ? bestLabel : volumeLabel} per session`}>
        <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 360, height: 240 }}>
          <LineChart data={data} margin={{ top: 12, right: 12, bottom: 0, left: 0 }}>
            <CartesianGrid stroke={GRID} vertical={false} />
            <XAxis
              dataKey="date"
              tickFormatter={formatShortDate}
              tick={{ fill: INK, fontSize: 12 }}
              tickLine={false}
              axisLine={{ stroke: GRID }}
              minTickGap={28}
              interval="preserveStartEnd"
            />
            <YAxis
              width={44}
              tick={{ fill: INK, fontSize: 12 }}
              tickLine={false}
              axisLine={false}
              allowDecimals={false}
              domain={[
                (min: number) => Math.max(0, Math.floor(min - (min === 0 ? 0 : 2))),
                (max: number) => Math.ceil(max + 2),
              ]}
            />
            <Tooltip
              cursor={{ stroke: GRID }}
              content={({ active, payload }) => {
                const d = payload?.[0]?.payload as Datum | undefined;
                if (!active || !d) return null;
                return (
                  <div className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm shadow-md">
                    <p className="font-medium text-gray-700">{formatShortDate(d.date)}</p>
                    <p className="text-base font-bold text-gray-900">
                      {formatWeight(d.value)} {unit}
                    </p>
                    {d.isPR && <p className="font-semibold text-brand-ink">New PR</p>}
                  </div>
                );
              }}
            />
            <Line
              type="monotone"
              dataKey="value"
              stroke={BRAND}
              strokeWidth={2}
              dot={<Dot />}
              activeDot={{ r: 7, fill: BRAND, stroke: '#fff', strokeWidth: 2 }}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-2 text-xs text-gray-600">Large dots mark sessions where you set a new PR. Tap the chart for details.</p>
    </div>
  );
}
