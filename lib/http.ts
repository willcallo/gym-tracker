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
