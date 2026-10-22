'use client';

import { useEffect } from 'react';
import { ButtonLink } from './ui';
import { DraftAge } from './Elapsed';
import ConfirmButton from './ConfirmButton';
import { NEW_DRAFT_KEY, clearDraft, pruneStaleNewDraft, useDraftStart, useHasDraft } from '@/lib/draftStore';

export default function StartSession() {
  const hasDraft = useHasDraft(NEW_DRAFT_KEY);
  const startedAt = useDraftStart(NEW_DRAFT_KEY);

  useEffect(() => {
    pruneStaleNewDraft();
  }, []);

  if (!hasDraft) {
    return (
      <ButtonLink href="/log" size="lg" className="w-full min-h-24! text-2xl!">
        Start session
      </ButtonLink>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-700">
        You have an unsaved session in progress
        {startedAt !== null && <DraftAge since={startedAt} />}
        .
      </p>
      <ButtonLink href="/log" size="lg" className="w-full min-h-24! text-2xl!">
        Resume session
      </ButtonLink>
      <ConfirmButton
        label="Discard draft"
        confirmLabel="Discard"
        message="Throw away the unsaved session? This can't be undone."
        onConfirm={() => clearDraft(NEW_DRAFT_KEY)}
        variant="secondary"
        className="w-full"
      />
    </div>
  );
}
