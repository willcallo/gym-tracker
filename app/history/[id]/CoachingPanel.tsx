'use client';

import { useState } from 'react';
import AiText from '@/app/components/AiText';
import ConfirmButton from '@/app/components/ConfirmButton';
import { btn, Card, SectionTitle } from '@/app/components/ui';

export default function CoachingPanel({
  sessionId,
  initialNote,
  initialAt,
  initialStale,
  aiEnabled,
}: {
  sessionId: number;
  initialNote: string | null;
  initialAt: string | null;
  initialStale: boolean;
  aiEnabled: boolean;
}) {
  const [note, setNote] = useState(initialNote);
  const [at, setAt] = useState(initialAt);
  const [stale, setStale] = useState(initialStale);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function generate() {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/sessions/${sessionId}/coaching`, { method: 'POST' });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? 'Could not get coaching. Try again.');
      setNote(data.coaching_note);
      setAt(data.coaching_at);
      setStale(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not get coaching. Try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <section>
      <SectionTitle>AI coaching</SectionTitle>
      <Card className="space-y-4">
        {note ? (
          <>
            {stale && (
              <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm font-medium text-amber-900">
                This session was edited after the note was written, so it may be out of date.
              </p>
            )}
            <AiText text={note} />
            {at && (
              <p className="text-xs text-gray-600" suppressHydrationWarning>
                Written {new Date(at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
              </p>
            )}
            {aiEnabled && (
              <ConfirmButton
                label="Regenerate"
                confirmLabel={loading ? 'Working...' : 'Regenerate'}
                message="Ask the AI for a fresh note? This uses an API call and replaces the stored one."
                onConfirm={generate}
                variant="secondary"
                className="w-full"
              />
            )}
          </>
        ) : (
          <>
            <p className="text-sm text-gray-700">
              Get feedback on effort, progression and balance. This makes one API call, only when you tap.
            </p>
            <button
              type="button"
              onClick={generate}
              disabled={!aiEnabled || loading}
              className={`${btn('primary')} w-full`}
            >
              {loading ? 'Analysing session...' : 'Get AI coaching'}
            </button>
          </>
        )}
        {!aiEnabled && (
          <p className="text-sm text-gray-600">AI is not set up. Add ANTHROPIC_API_KEY to enable it.</p>
        )}
        {error && (
          <p role="alert" className="text-sm font-medium text-red-700">
            {error}
          </p>
        )}
      </Card>
    </section>
  );
}
