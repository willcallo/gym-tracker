import { anthropic } from './anthropic';
import { getDashboardData, setDashboardCache } from './db';
import type { SessionWithSets, PRRecord } from './types';

function buildSummaryPrompt(sessions: SessionWithSets[], prs: PRRecord[]): string {
  const muscleTotals: Record<string, number> = {};
  for (const s of sessions) {
    for (const ex of s.exercises) {
      muscleTotals[ex.primary_muscle] = (muscleTotals[ex.primary_muscle] ?? 0) + ex.sets.length;
    }
  }
  const muscleBreakdown = Object.entries(muscleTotals)
    .sort((a, b) => b[1] - a[1])
    .map(([m, n]) => `${m}: ${n} sets`)
    .join(', ');

  const prList = prs
    .slice(0, 10)
    .map((p) => `${p.exercise_name} ${p.max_weight}kg`)
    .join(', ');

  return `You are a personal training analyst. Based on the last ${sessions.length} workout sessions, write a single paragraph (80–120 words) summarising training trends. Cover: what's being trained frequently, what's neglected, whether volume is adequate, and one specific actionable focus. Be direct and specific — mention muscle groups and approximate set counts. Do not be generic.

Muscle group set counts (last ${sessions.length} sessions): ${muscleBreakdown || 'no data'}
Current PRs: ${prList || 'none yet'}
Training frequency: ${sessions.length} sessions

Write only the paragraph. No headers.`;
}

export async function getDashboardSummary(): Promise<string | null> {
  const data = getDashboardData();

  if (data.cachedSummary) return data.cachedSummary;
  if (!data.recentSessions.length || !process.env.ANTHROPIC_API_KEY) return null;

  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      messages: [{ role: 'user', content: buildSummaryPrompt(data.recentSessions, data.prs) }],
    });
    const summary = message.content[0].type === 'text' ? message.content[0].text : null;
    if (summary) setDashboardCache(summary, data.sessionCount);
    return summary;
  } catch {
    return null;
  }
}
