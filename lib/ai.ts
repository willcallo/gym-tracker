import Anthropic from '@anthropic-ai/sdk';
import { formatWeight } from './format';
import type { CoachingContext, SummaryContext } from './db';
import type { SessionWithSets } from './types';

export const MODEL = 'claude-sonnet-5-5';

export function aiEnabled(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}

let client: Anthropic | null = null;

export async function generateText(prompt: string): Promise<string> {
  client ??= new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 1024,
    messages: [{ role: 'user', content: prompt }],
  });
  const block = message.content.find((b) => b.type === 'text');
  if (!block || block.type !== 'text' || !block.text.trim()) throw new Error('Empty response from model');
  return block.text.trim();
}

// ── Per-session coaching ─────────────────────────────────────

export function findNewPRs(session: SessionWithSets, priorBest: CoachingContext['priorBest']): string[] {
  const prior = new Map(priorBest.map((p) => [p.exercise_id, p]));
  const prs: string[] = [];
  for (const ex of session.exercises) {
    const before = prior.get(ex.exercise_id);
    if (ex.is_bodyweight) {
      const best = Math.max(...ex.sets.map((s) => s.reps));
      if (!before || best > before.max_reps) prs.push(`${ex.exercise_name} (${best} reps)`);
    } else {
      const weights = ex.sets.map((s) => s.weight ?? 0).filter((w) => w > 0);
      if (!weights.length) continue;
      const best = Math.max(...weights);
      if (!before || before.max_weight === null || best > before.max_weight) {
        prs.push(`${ex.exercise_name} (${formatWeight(best)}kg)`);
      }
    }
  }
  return prs;
}

export function buildCoachingPrompt(session: SessionWithSets, ctx: CoachingContext): string {
  const { recentHistory } = ctx;
  const newPRs = findNewPRs(session, ctx.priorBest);

  const sessionHeader = [
    `## Session: ${session.date}${session.label ? ` (${session.label})` : ''}`,
    session.notes ? `Notes from athlete: "${session.notes}"` : '',
  ]
    .filter(Boolean)
    .join('\n');

  const exerciseLines = session.exercises
    .map((ex) => {
      const muscleTag = `[${ex.primary_muscle}${ex.secondary_muscle ? ` -> ${ex.secondary_muscle}` : ''}]`;
      const setLines = ex.sets
        .map((s) => {
          const vol = ex.is_bodyweight || s.weight === null ? `${s.reps} reps` : `${s.reps} x ${formatWeight(s.weight)}kg`;
          const rpe = s.rpe ? ` (RPE ${s.rpe})` : '';
          return `    * ${vol}${rpe}`;
        })
        .join('\n');
      return `**${ex.exercise_name}** ${muscleTag}\n${setLines}`;
    })
    .join('\n\n');

  const muscleCounts: Record<string, number> = {};
  for (const ex of session.exercises) {
    muscleCounts[ex.primary_muscle] = (muscleCounts[ex.primary_muscle] ?? 0) + ex.sets.length;
  }
  const muscleCountLine = Object.entries(muscleCounts)
    .map(([m, n]) => `${m}: ${n}`)
    .join(' | ');

  const accumulated: Record<string, number> = { ...muscleCounts };
  for (const h of recentHistory) {
    for (const [m, n] of Object.entries(h.muscle_counts)) {
      accumulated[m] = (accumulated[m] ?? 0) + n;
    }
  }

  const pairs: [string, string[]][] = [
    ['chest', ['lats', 'upper back']],
    ['shoulders', ['lats', 'upper back']],
    ['triceps', ['biceps']],
    ['quads', ['hamstrings', 'glutes']],
    ['lower back', ['core']],
  ];
  const pairLines = pairs
    .map(([a, bArr]) => {
      const aCount = accumulated[a] ?? 0;
      const bCount = bArr.reduce((s, m) => s + (accumulated[m] ?? 0), 0);
      const ratio = bCount === 0 ? (aCount > 0 ? 'infinite' : 'even') : (aCount / bCount).toFixed(1);
      return `  * ${a} (${aCount}) vs ${bArr.join('/')} (${bCount}), ratio ${ratio}:1`;
    })
    .join('\n');

  const historyLines =
    recentHistory.length > 0
      ? recentHistory
          .map((h) => {
            const summary = Object.entries(h.muscle_counts)
              .map(([m, n]) => `${m}x${n}`)
              .join(', ');
            return `  ${h.date}${h.label ? ` (${h.label})` : ''}: ${summary || 'no sets logged'}`;
          })
          .join('\n')
      : '  (no prior sessions)';

  return `You are a direct, honest personal training coach. Analyse this workout and provide specific, actionable feedback. Do not be sycophantic. Flag low effort, bad choices, and missed opportunities just as readily as you note good work.

${sessionHeader}

### Exercises performed:
${exerciseLines}

### Muscle set counts (this session):
${muscleCountLine || 'none'}

${newPRs.length > 0 ? `### New personal records:\n${newPRs.map((p) => `  * ${p}`).join('\n')}\n` : ''}### Recent history (the ${recentHistory.length} sessions before this one):
${historyLines}

### Antagonist balance (accumulated: this session + the ${recentHistory.length} before it):
${pairLines}
  (Flag any pair where one side is >2x the other. Flag muscles absent from all recent sessions.)

Respond in exactly 4 short paragraphs:
1. **Effort & quality**: was the session hard enough? Comment on RPE values and volume honestly.
2. **Progression**: any PRs, regressions, or stagnation worth noting?
3. **Balance & gaps**: any antagonist imbalance or neglected muscle groups? Be specific with numbers.
4. **Next session focus**: one clear, actionable recommendation.

Max 220 words total. Be direct. Do not pad with generic praise. Never use em dashes.`;
}

// ── "What to train" summary ──────────────────────────────────

export function buildSummaryPrompt(ctx: SummaryContext): string {
  const muscleBreakdown = ctx.muscles.map((m) => `${m.muscle}: ${m.sets} sets`).join(', ');
  const prList = ctx.prs
    .map((p) => `${p.name} ${p.is_bodyweight ? `${p.best} reps` : `${formatWeight(p.best)}kg`}`)
    .join(', ');

  return `You are a personal training analyst. Based on the last ${ctx.recentSessions} workout sessions, write a single paragraph (80 to 120 words) summarising training trends. Cover: what's being trained frequently, what's neglected, whether volume is adequate, and one specific actionable focus. Be direct and specific: mention muscle groups and approximate set counts. Do not be generic.

Muscle group set counts (last ${ctx.recentSessions} sessions): ${muscleBreakdown || 'no data'}
Current PRs: ${prList || 'none yet'}
Training frequency: ${ctx.recentSessions} sessions

Write only the paragraph. No headers. Never use em dashes.`;
}
