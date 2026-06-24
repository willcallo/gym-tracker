import { getUserSettings, setUserSettings } from '@/lib/db';

export async function GET() {
  return Response.json(await getUserSettings());
}

export async function PUT(request: Request) {
  try {
    const { bodyweight, age } = await request.json();
    await setUserSettings(
      bodyweight != null ? Number(bodyweight) : null,
      age != null ? Number(age) : null
    );
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}
