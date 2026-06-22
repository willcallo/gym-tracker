'use client';

import { useState } from 'react';

interface Props {
  sessionId: number;
  initialNote?: string | null;
}

export default function CoachingNote({ sessionId, initialNote }: Props) {
  const [note, setNote] = useState<string | null>(initialNote ?? null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/coaching/${sessionId}`, { method: 'POST' });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setNote(data.coaching_note);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to generate coaching note');
    } finally {
      setLoading(false);
    }
  }

  if (note) {
    return (
      <div className="rounded-xl border border-indigo-800 bg-indigo-950/40 px-5 py-4">
        <p className="text-xs font-semibold text-indigo-400 mb-2 uppercase tracking-wide">AI Coach</p>
        <p className="text-sm text-gray-200 leading-relaxed whitespace-pre-wrap">{note}</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 px-5 py-4">
      <p className="text-xs font-semibold text-gray-500 mb-3 uppercase tracking-wide">AI Coach</p>
      {error && <p className="text-sm text-red-400 mb-3">{error}</p>}
      <button
        onClick={generate}
        disabled={loading}
        className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {loading ? 'Analysing workout…' : 'Get AI Coaching'}
      </button>
    </div>
  );
}
