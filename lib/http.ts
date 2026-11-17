export function serverError(e: unknown, context: string): Response {
  console.error(`[${context}]`, e);
  return Response.json({ error: 'Something went wrong' }, { status: 500 });
}

export function badRequest(message: string): Response {
  return Response.json({ error: message }, { status: 400 });
}

export function isPgError(e: unknown, code: string): boolean {
  return typeof e === 'object' && e !== null && (e as { code?: string }).code === code;
}

export function parseId(raw: string): number | null {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 && n < 2_147_483_647 ? n : null;
}

// For failed calls to the AI provider: log the details, tell the client something generic.
export function upstreamError(e: unknown, context: string): Response {
  console.error(`[${context}]`, e);
  return Response.json({ error: 'The AI request failed. Try again in a moment.' }, { status: 502 });
}

export function aiLimitReached(limit: number): Response {
  return Response.json(
    { error: `You have used today's ${limit} AI requests. They reset at midnight UTC.` },
    { status: 429 }
  );
}

export const AI_NOT_CONFIGURED = 'AI is not set up. Add ANTHROPIC_API_KEY to enable it.';
