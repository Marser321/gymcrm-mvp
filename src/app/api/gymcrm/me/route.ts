import { ok } from '@/lib/gymcrm/api';
import { getAuthContext, resolveCurrentClient } from '@/lib/gymcrm/server';
import { getGymcrmDataMode } from '@/lib/gymcrm/open-session';

export async function GET(request: Request) {
  const authCtx = await getAuthContext(undefined, request);
  if (!authCtx.ok) return authCtx.response;

  const clienteResult = await resolveCurrentClient(authCtx, {
    allowFallback: authCtx.context.role === 'cliente',
    autoCreate: authCtx.context.role === 'cliente',
  });

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
    cliente: clienteResult
      ? {
          id: clienteResult.id,
          gimnasio_id: clienteResult.gimnasio_id,
          nombres: clienteResult.nombres,
          apellidos: clienteResult.apellidos,
          email: clienteResult.email,
          codigo_qr: clienteResult.codigo_qr,
          estado: clienteResult.estado,
          fallback: clienteResult.fallback,
          source: clienteResult.source,
        }
      : null,
    ready: true,
    sourceMode: getGymcrmDataMode(),
  });
}
