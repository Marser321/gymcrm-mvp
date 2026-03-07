import { ok } from '@/lib/gymcrm/api';
import { listBuilderTemplates } from '@/lib/gymcrm/builder';
import { getAuthContext } from '@/lib/gymcrm/server';

export async function GET() {
  const authCtx = await getAuthContext();
  if (!authCtx.ok) return authCtx.response;

  return ok({
    templates: listBuilderTemplates(),
  });
}
