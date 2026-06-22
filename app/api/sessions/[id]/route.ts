import { getSessionById } from '@/lib/db';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = getSessionById(parseInt(id));
    if (!session) return Response.json({ error: 'Not found' }, { status: 404 });
    return Response.json(session);
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}
