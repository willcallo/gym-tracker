import { getDashboardData } from '@/lib/db';
import { getDashboardSummary } from '@/lib/ai';

export async function GET() {
  try {
    const [data, cachedSummary] = await Promise.all([getDashboardData(), getDashboardSummary()]);
    return Response.json({ ...data, cachedSummary });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}
