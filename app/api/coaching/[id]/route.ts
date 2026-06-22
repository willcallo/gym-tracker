import { buildCoachingData, updateSessionCoaching } from '@/lib/db';
import { anthropic } from '@/lib/anthropic';

function buildPrompt(data: NonNullable<ReturnType<typeof buildCoachingData>>): string {
  const { session, recentHistory, newPRs } = data;

  const sessionHeader = [
    `## Session: ${session.date}${session.label ? ` (${session.label})` : ''}`,
    session.notes ? `Notes from athlete: "${session.notes}"` : '',
  ]
    .filter(Boolean)
    .join('\n');

  const exerciseLines = session.exercises
    .map((ex) => {
      const muscleTag = `[${ex.primary_muscle}${ex.secondary_muscle ? ` → ${ex.secondary_muscle}` : ''}]`;
      const setLines = ex.sets
        .map((s) => {
          const vol = s.is_bodyweight ? `${s.reps} reps` : `${s.reps} × ${s.weight}kg`;
          const rpe = s.rpe ? ` (RPE ${s.rpe})` : '';
          return `    • ${vol}${rpe}`;
        })
        .join('\n');
      return `**${ex.exercise_name}** ${muscleTag}\n${setLines}`;
    })
    .join('\n\n');

  // Muscle set counts this session
  const muscleCounts: Record<string, number> = {};
  for (const ex of session.exercises) {
    muscleCounts[ex.primary_muscle] = (muscleCounts[ex.primary_muscle] ?? 0) + ex.sets.length;
  }
  const muscleCountLine = Object.entries(muscleCounts)
    .map(([m, n]) => `${m}: ${n}`)
    .join(' | ');

  // Accumulated counts over last 5 sessions + today
  const accumulated: Record<string, number> = { ...muscleCounts };
  for (const h of recentHistory) {
    for (const [m, n] of Object.entries(h.muscleCounts)) {
      accumulated[m] = (accumulated[m] ?? 0) + n;
    }
  }

  // Antagonist pair analysis
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
      const ratio = bCount === 0 ? (aCount > 0 ? '∞' : 'even') : (aCount / bCount).toFixed(1);
      const bLabel = bArr.join('/');
      return `  • ${a} (${aCount}) vs ${bLabel} (${bCount}) — ratio ${ratio}:1`;
    })
    .join('\n');

  const historyLines =
    recentHistory.length > 0
      ? recentHistory
          .map((h) => {
            const summary = Object.entries(h.muscleCounts)
              .map(([m, n]) => `${m}×${n}`)
              .join(', ');
            return `  ${h.date}${h.label ? ` (${h.label})` : ''}: ${summary || 'no sets logged'}`;
          })
          .join('\n')
      : '  (no prior sessions)';

  return `You are a direct, honest personal training coach. Analyse this workout and provide specific, actionable feedback. Do not be sycophantic — flag low effort, bad choices, and missed opportunities just as readily as you note good work.

${sessionHeader}

### Exercises performed:
${exerciseLines}

### Muscle set counts (this session):
${muscleCountLine || 'none'}

${newPRs.length > 0 ? `### New personal records:\n${newPRs.map((p) => `  ★ ${p}`).join('\n')}\n` : ''}
### Recent history (last ${recentHistory.length} sessions):
${historyLines}

### Antagonist balance (accumulated — today + last ${recentHistory.length} sessions):
${pairLines}
  (Flag any pair where one side is >2× the other. Flag muscles absent from all recent sessions.)

Respond in exactly 4 short paragraphs:
1. **Effort & quality** — was the session hard enough? Comment on RPE values and volume honestly.
2. **Progression** — any PRs, regressions, or stagnation worth noting?
3. **Balance & gaps** — any antagonist imbalance or neglected muscle groups? Be specific with numbers.
4. **Next session focus** — one clear, actionable recommendation.

Max 220 words total. Be direct. Do not pad with generic praise.`;
}

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const sessionId = parseInt(id);

    if (!process.env.ANTHROPIC_API_KEY) {
      return Response.json(
        { error: 'ANTHROPIC_API_KEY is not configured' },
        { status: 503 }
      );
    }

    const data = buildCoachingData(sessionId);
    if (!data) return Response.json({ error: 'Session not found' }, { status: 404 });

    const prompt = buildPrompt(data);

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    });

    const coaching_note =
      message.content[0].type === 'text' ? message.content[0].text : 'Could not generate coaching note.';

    updateSessionCoaching(sessionId, coaching_note);

    return Response.json({ coaching_note });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}
