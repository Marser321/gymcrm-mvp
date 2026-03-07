import { ok, fail, parseJsonBody } from '@/lib/gymcrm/api';
import { hasRole, PERMISSIONS } from '@/lib/gymcrm/permissions';
import { getAuthContext, gymTable } from '@/lib/gymcrm/server';

type Params = { params: Promise<{ id: string }> };

type UpdateFichaBody = {
  nutricionista_user_id?: string | null;
  objetivos?: string | null;
  recomendaciones?: string | null;
  evolucion?: unknown;
  estado?: 'activa' | 'cerrada';
};

export async function PATCH(request: Request, { params }: Params) {
  const authCtx = await getAuthContext();
  if (!authCtx.ok) return authCtx.response;

  if (!hasRole(authCtx.context.role, PERMISSIONS.nutricion)) {
    return fail('No tienes permisos para editar fichas nutricionales.', 403);
  }

  const { id } = await params;

  let body: UpdateFichaBody;
  try {
    body = await parseJsonBody<UpdateFichaBody>(request);
  } catch (error) {
    return fail(error instanceof Error ? error.message : 'Body inválido.', 400);
  }

  const payload: Record<string, unknown> = {};
  if (body.nutricionista_user_id !== undefined) payload.nutricionista_user_id = body.nutricionista_user_id;
  if (body.objetivos !== undefined) payload.objetivos = body.objetivos;
  if (body.recomendaciones !== undefined) payload.recomendaciones = body.recomendaciones;
  if (body.evolucion !== undefined) payload.evolucion = body.evolucion;
  if (body.estado !== undefined) payload.estado = body.estado;

  if (Object.keys(payload).length === 0) return fail('No hay campos para actualizar.', 400);

  const { data, error } = await authCtx.client.database
    .from(gymTable('nutricion_fichas'))
    .update(payload)
    .eq('gimnasio_id', authCtx.context.gimnasioId)
    .eq('id', id)
    .select('*')
    .single();

  if (error || !data) return fail(`No se pudo actualizar ficha: ${error?.message ?? 'unknown error'}`, 500);

  return ok(data);
}
