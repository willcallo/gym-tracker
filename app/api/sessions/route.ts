import { createSession, addSets } from '@/lib/db';
import type { SetInput } from '@/lib/db';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { date, label, notes, sets } = body as {
      date: string;
      label?: string;
      notes?: string;
      sets: SetInput[];
    };

    if (!date) return Response.json({ error: 'date is required' }, { status: 400 });
    if (!sets?.length) return Response.json({ error: 'at least one set is required' }, { status: 400 });

    const session = await createSession(date, label, notes);
    await addSets(session.id, sets);

    return Response.json({ sessionId: session.id }, { status: 201 });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}
