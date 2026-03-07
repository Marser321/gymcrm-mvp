import { ok, fail } from '@/lib/gymcrm/api';
import { getAuthContext, gymTable } from '@/lib/gymcrm/server';
import { getGymcrmDataMode } from '@/lib/gymcrm/open-session';

export async function GET(request: Request) {
  const authCtx = await getAuthContext(undefined, request);
  if (!authCtx.ok) return authCtx.response;

  const clienteResult = await authCtx.client.database
    .from(gymTable('clientes'))
    .select('id, gimnasio_id, nombres, apellidos, email, codigo_qr, estado')
    .eq('gimnasio_id', authCtx.context.gimnasioId)
    .eq('auth_user_id', authCtx.authUserId)
    .limit(1)
    .maybeSingle();

  if (clienteResult.error) {
    return fail(`No se pudo cargar perfil de cliente: ${clienteResult.error.message}`, 500);
  }

  return ok({
    auth: {
      userId: authCtx.authUserId,
      email: authCtx.roleRecord.email,
      profile: {
        open: true,
      },
    },
    role: {
      id: authCtx.roleRecord.id,
      gimnasio_id: authCtx.roleRecord.gimnasio_id,
      rol: authCtx.roleRecord.rol,
      email: authCtx.roleRecord.email,
      activo: authCtx.roleRecord.activo,
      created_at: authCtx.roleRecord.created_at,
    },
    cliente: clienteResult.data ?? null,
    ready: true,
    sourceMode: getGymcrmDataMode(),
  });
}

