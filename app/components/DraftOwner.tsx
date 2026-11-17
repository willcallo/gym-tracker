'use client';

import { setDraftOwner } from '@/lib/draftStore';

// Rendered first in the root layout so the draft store knows whose drafts to read before any
// other component asks. It is set during render (not in an effect) for that reason; the call
// only assigns a module variable, so repeating it is harmless.
export default function DraftOwner({ userId }: { userId: string }) {
  setDraftOwner(userId);
  return null;
}
