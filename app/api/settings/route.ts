import { getUser, unauthorised } from '@/lib/session';
import { saveSettings } from '@/lib/db';
import { badRequest, serverError } from '@/lib/http';
import { parseSettingsInput } from '@/lib/validate';

export async function PUT(request: Request) {
  try {
    const user = await getUser();
    if (!user) return unauthorised();
    const body = await request.json().catch(() => null);
    const parsed = parseSettingsInput(body);
    if (!parsed.ok) return badRequest(parsed.error);
    return Response.json(await saveSettings(user.id, parsed.value));
  } catch (e) {
    return serverError(e, 'PUT /api/settings');
  }
}
