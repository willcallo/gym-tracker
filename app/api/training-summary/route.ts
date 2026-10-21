import { getSummaryContext, saveTrainingSummary } from '@/lib/db';
import { aiEnabled, buildSummaryPrompt, generateText } from '@/lib/ai';
import { AI_NOT_CONFIGURED, badRequest, serverError, upstreamError } from '@/lib/http';

export const maxDuration = 60;

// Only ever called from the button on the Exercises tab.
export async function POST() {
  if (!aiEnabled()) return Response.json({ error: AI_NOT_CONFIGURED }, { status: 503 });

  let stage: 'db' | 'ai' = 'db';
  try {
    const ctx = await getSummaryContext();
    if (ctx.sessionCount === 0) return badRequest('Log a session first');
    stage = 'ai';
    const summary = await generateText(buildSummaryPrompt(ctx));
    stage = 'db';
    await saveTrainingSummary(summary, ctx.sessionCount);
    return Response.json({
      summary,
      session_count: ctx.sessionCount,
      generated_at: new Date().toISOString(),
    });
  } catch (e) {
    return stage === 'ai' ? upstreamError(e, 'summary ai') : serverError(e, 'POST /api/training-summary');
  }
}
