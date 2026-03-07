import { fail, ok, parseJsonBody } from '@/lib/gymcrm/api';
import { hasRole, PERMISSIONS } from '@/lib/gymcrm/permissions';
import { getAuthContext, gymTable } from '@/lib/gymcrm/server';

type Params = { params: Promise<{ id: string }> };

type UpdateConsentBody = {
  activo: boolean;
};

export async function PATCH(request: Request, { params }: Params) {
  const authCtx = await getAuthContext();
  if (!authCtx.ok) return authCtx.response;

  if (!hasRole(authCtx.context.role, PERMISSIONS.nutricion)) {
    return fail('No tienes permisos para actualizar consentimientos.', 403, 'forbidden');
  }

  const { id } = await params;

  let body: UpdateConsentBody;
  try {
    body = await parseJsonBody<UpdateConsentBody>(request);
  } catch (error) {
    return fail(error instanceof Error ? error.message : 'Body inválido.', 400);
  }

  const payload = body.activo
    ? {
        activo: true,
        revocado_en: null,
        revocado_por: null,
      }
    : {
        activo: false,
        revocado_en: new Date().toISOString(),
        revocado_por: authCtx.authUserId,
      };

  const { data, error } = await authCtx.client.database
    .from(gymTable('nutricion_consentimientos'))
    .update(payload)
    .eq('gimnasio_id', authCtx.context.gimnasioId)
    .eq('id', id)
    .select('*')
    .single();

  if (error || !data) {
    return fail(`No se pudo actualizar consentimiento: ${error?.message ?? 'unknown error'}`, 500);
  }

  return ok(data);
}
