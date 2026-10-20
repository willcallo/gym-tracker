'use client';

import { useState } from 'react';
import AiText from '../components/AiText';
import ConfirmButton from '../components/ConfirmButton';
import { btn, Card } from '../components/ui';
import type { TrainingSummary as Summary } from '@/lib/types';

export default function TrainingSummary({
  initial,
  sessionCount,
  aiEnabled,
}: {
  initial: Summary | null;
  sessionCount: number;
  aiEnabled: boolean;
}) {
  const [summary, setSummary] = useState(initial);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [count, setCount] = useState(sessionCount);

  async function generate() {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/training-summary', { method: 'POST' });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? 'Could not get the summary. Try again.');
      setSummary(data);
      setCount(data.session_count);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not get the summary. Try again.');
    } finally {
      setLoading(false);
    }
  }

  const behind = summary ? count - summary.session_count : 0;

  return (
    <Card className="mb-6 space-y-3">
      <h2 className="text-lg font-bold">What to train</h2>
      {summary ? (
        <>
          <AiText text={summary.summary} />
          <p className="text-xs text-gray-600">
            Based on {summary.session_count} session{summary.session_count === 1 ? '' : 's'}
            {behind > 0 ? `. You have logged ${behind} more since.` : '. Up to date.'}
          </p>
          {aiEnabled && (
            <ConfirmButton
              label="Regenerate"
              confirmLabel={loading ? 'Working...' : 'Regenerate'}
              message="Ask the AI for a fresh summary? This uses an API call and replaces the stored one."
              onConfirm={generate}
              variant="secondary"
              className="w-full"
            />
          )}
        </>
      ) : (
        <>
          <p className="text-sm text-gray-700">
            An AI read of your recent training: what you hit, what you skip, and what to focus on next. One API
            call, only when you tap.
          </p>
          <button
            type="button"
            onClick={generate}
            disabled={!aiEnabled || loading || count === 0}
            className={`${btn('primary')} w-full`}
          >
            {loading ? 'Analysing...' : 'Get training summary'}
          </button>
          {count === 0 && <p className="text-sm text-gray-600">Log a session first.</p>}
        </>
      )}
      {!aiEnabled && <p className="text-sm text-gray-600">AI is not set up. Add ANTHROPIC_API_KEY to enable it.</p>}
      {error && (
        <p role="alert" className="text-sm font-medium text-red-700">
          {error}
        </p>
      )}
    </Card>
  );
}
