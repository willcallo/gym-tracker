import { getUser, unauthorised } from '@/lib/session';
import { getCoachingContext, getSession, getSessionUpdatedAt, saveCoachingNote, countAiRequest } from '@/lib/db';
import { aiDailyLimit, aiEnabled, buildCoachingPrompt, generateText } from '@/lib/ai';
import { AI_NOT_CONFIGURED, aiLimitReached, badRequest, parseId, serverError, upstreamError } from '@/lib/http';

export const maxDuration = 60;

// Only ever called from the "Get AI coaching" / "Regenerate" buttons.
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  let stage: 'db' | 'ai' = 'db';
  try {
    const user = await getUser();
    if (!user) return unauthorised();
    if (!aiEnabled()) return Response.json({ error: AI_NOT_CONFIGURED }, { status: 503 });
    const id = parseId((await params).id);
    if (id === null) return badRequest('Invalid session id');
    const session = await getSession(user.id, id);
    if (!session) return Response.json({ error: 'Session not found' }, { status: 404 });

    const limit = aiDailyLimit();
    if (!(await countAiRequest(user.id, limit))) return aiLimitReached(limit);

    const updatedAt = await getSessionUpdatedAt(user.id, id);
    const prompt = buildCoachingPrompt(session, await getCoachingContext(user.id, session));
    stage = 'ai';
    const note = await generateText(prompt);
    stage = 'db';
    await saveCoachingNote(user.id, id, note, updatedAt ?? new Date().toISOString());
    return Response.json({ coaching_note: note, coaching_at: new Date().toISOString() });
  } catch (e) {
    return stage === 'ai' ? upstreamError(e, 'coaching ai') : serverError(e, 'POST /api/sessions/[id]/coaching');
  }
}
