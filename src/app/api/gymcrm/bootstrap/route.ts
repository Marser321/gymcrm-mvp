import { ok, fail } from '@/lib/gymcrm/api';
import { getAuthContext, gymTable } from '@/lib/gymcrm/server';

export async function GET(request: Request) {
  const authCtx = await getAuthContext(undefined, request);
  if (!authCtx.ok) return authCtx.response;

  return ok({
    ready: true,
    role: authCtx.roleRecord,
  });
}

export async function POST(request: Request) {
  const authCtx = await getAuthContext(undefined, request);
  if (!authCtx.ok) return authCtx.response;

  const existingGym = await authCtx.client.database
    .from(gymTable('gimnasios'))
    .select('id, nombre, moneda, pais, zona_horaria')
    .eq('id', authCtx.context.gimnasioId)
    .limit(1)
    .maybeSingle();

  if (existingGym.error) {
    return fail(`No se pudo validar bootstrap: ${existingGym.error.message}`, 500);
  }

  return ok({
    bootstrap: 'already_initialized',
    role: authCtx.roleRecord,
    gimnasio: existingGym.data ?? null,
  });
}

