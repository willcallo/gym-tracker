import { getUser, unauthorised } from '@/lib/session';
import { getSummaryContext, saveTrainingSummary, countAiRequest } from '@/lib/db';
import { aiDailyLimit, aiEnabled, buildSummaryPrompt, generateText } from '@/lib/ai';
import { AI_NOT_CONFIGURED, aiLimitReached, badRequest, serverError, upstreamError } from '@/lib/http';

export const maxDuration = 60;

// Only ever called from the button on the Exercises tab.
export async function POST() {
  let stage: 'db' | 'ai' = 'db';
  try {
    const user = await getUser();
    if (!user) return unauthorised();
    if (!aiEnabled()) return Response.json({ error: AI_NOT_CONFIGURED }, { status: 503 });
    const ctx = await getSummaryContext(user.id);
    if (ctx.sessionCount === 0) return badRequest('Log a session first');
    const limit = aiDailyLimit();
    if (!(await countAiRequest(user.id, limit))) return aiLimitReached(limit);
    stage = 'ai';
    const summary = await generateText(buildSummaryPrompt(ctx));
    stage = 'db';
    await saveTrainingSummary(user.id, summary, ctx.sessionCount);
    return Response.json({
      summary,
      session_count: ctx.sessionCount,
      generated_at: new Date().toISOString(),
    });
  } catch (e) {
    return stage === 'ai' ? upstreamError(e, 'summary ai') : serverError(e, 'POST /api/training-summary');
  }
}
