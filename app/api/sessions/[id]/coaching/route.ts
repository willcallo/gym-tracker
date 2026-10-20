import { getCoachingContext, getSession, saveCoachingNote } from '@/lib/db';
import { aiEnabled, buildCoachingPrompt, generateText } from '@/lib/ai';
import { AI_NOT_CONFIGURED, badRequest, parseId, serverError, upstreamError } from '@/lib/http';

// Only ever called from the "Get AI coaching" / "Regenerate" buttons.
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!aiEnabled()) return Response.json({ error: AI_NOT_CONFIGURED }, { status: 503 });

  let stage: 'db' | 'ai' = 'db';
  try {
    const id = parseId((await params).id);
    if (id === null) return badRequest('Invalid session id');
    const session = await getSession(id);
    if (!session) return Response.json({ error: 'Session not found' }, { status: 404 });

    const prompt = buildCoachingPrompt(session, await getCoachingContext(session));
    stage = 'ai';
    const note = await generateText(prompt);
    stage = 'db';
    await saveCoachingNote(id, note);
    return Response.json({ coaching_note: note, coaching_at: new Date().toISOString() });
  } catch (e) {
    return stage === 'ai' ? upstreamError(e, 'coaching ai') : serverError(e, 'POST /api/sessions/[id]/coaching');
  }
}
