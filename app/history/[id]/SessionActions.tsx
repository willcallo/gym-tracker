'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import ConfirmButton from '@/app/components/ConfirmButton';
import { ButtonLink } from '@/app/components/ui';
import { clearDraft, editDraftKey } from '@/lib/draftStore';

export default function SessionActions({ id }: { id: number }) {
  const router = useRouter();
  const [error, setError] = useState('');

  async function remove() {
    setError('');
    try {
      const res = await fetch(`/api/sessions/${id}`, { method: 'DELETE' });
      if (!res.ok && res.status !== 404) throw new Error();
      clearDraft(editDraftKey(id));
      router.replace('/history');
    } catch {
      setError('Could not delete the session. Try again.');
    }
  }

  return (
    <div className="space-y-3">
      <ButtonLink href={`/history/${id}/edit`} variant="secondary" className="w-full">
        Edit session
      </ButtonLink>
      <ConfirmButton
        label="Delete session"
        confirmLabel="Delete"
        message="Delete this session and all its sets? This can't be undone."
        onConfirm={remove}
        className="w-full"
      />
      {error && <p className="text-sm text-red-700">{error}</p>}
    </div>
  );
}
