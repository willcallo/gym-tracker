'use client';

import { useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Dot,
} from 'recharts';
import type { ProgressPoint } from '@/lib/types';

interface Props {
  data: ProgressPoint[];
  exerciseName: string;
}

function shortDate(date: string) {
  return new Date(date + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function CustomDot(props: { cx?: number; cy?: number; payload?: ProgressPoint }) {
  const { cx, cy, payload } = props;
  if (!cx || !cy || !payload) return null;
  if (payload.isPR) {
    return (
      <g>
        <circle cx={cx} cy={cy} r={6} fill="#facc15" stroke="#ca8a04" strokeWidth={1.5} />
        <text x={cx} y={cy - 10} textAnchor="middle" fontSize={9} fill="#facc15" fontWeight="bold">
          PR
        </text>
      </g>
    );
  }
  return <circle cx={cx} cy={cy} r={3} fill="#818cf8" />;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const d: ProgressPoint = payload[0].payload;
  return (
    <div className="rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-xs shadow-lg">
      <p className="font-medium text-gray-200">{shortDate(d.date)}</p>
      {d.max_weight !== null && (
        <p className="text-gray-400">
          Weight: <span className="text-gray-100">{d.max_weight}kg</span>
          {d.isPR && <span className="ml-1 text-yellow-400 font-bold">★ PR</span>}
        </p>
      )}
      <p className="text-gray-400">
        Volume: <span className="text-gray-100">{Math.round(d.volume).toLocaleString()}</span>
      </p>
    </div>
  );
}

export default function ProgressChart({ data, exerciseName }: Props) {
  const [view, setView] = useState<'weight' | 'volume'>('weight');

  if (data.length === 0) {
    return (
      <div className="rounded-xl border border-gray-800 bg-gray-900 px-5 py-12 text-center">
        <p className="text-gray-500">No data yet for {exerciseName}</p>
      </div>
    );
  }

  const dataKey = view === 'weight' ? 'max_weight' : 'volume';
  const yLabel = view === 'weight' ? 'kg' : 'vol';

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 px-5 py-5">
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-gray-400">{data.length} sessions</p>
        <div className="flex rounded-lg border border-gray-700 overflow-hidden text-xs">
          {(['weight', 'volume'] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`px-3 py-1.5 font-medium transition-colors capitalize ${
                view === v ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:bg-gray-800'
              }`}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      <ResponsiveContainer width="100%" height={240}>
        <LineChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
          <XAxis
            dataKey="date"
            tickFormatter={shortDate}
            tick={{ fill: '#6b7280', fontSize: 11 }}
            axisLine={{ stroke: '#374151' }}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: '#6b7280', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => `${Math.round(v)}${yLabel}`}
          />
          <Tooltip content={<CustomTooltip />} />
          <Line
            type="monotone"
            dataKey={dataKey}
            stroke="#818cf8"
            strokeWidth={2}
            dot={<CustomDot />}
            activeDot={{ r: 5, fill: '#818cf8' }}
            connectNulls
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
