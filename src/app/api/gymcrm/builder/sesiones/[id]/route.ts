import { fail, ok, parseJsonBody } from '@/lib/gymcrm/api';
import { hasRole, PERMISSIONS } from '@/lib/gymcrm/permissions';
import { getAuthContext, gymTable } from '@/lib/gymcrm/server';
import { isBuilderSessionState } from '@/lib/gymcrm/types';

type Params = { params: Promise<{ id: string }> };

type UpdateSesionBody = {
  titulo?: string;
  descripcion?: string | null;
  inicio?: string;
  fin?: string;
  cupo_total?: number;
  estado?: string;
  reglas?: Record<string, unknown>;
};

export async function PATCH(request: Request, { params }: Params) {
  const authCtx = await getAuthContext();
  if (!authCtx.ok) return authCtx.response;

  if (!hasRole(authCtx.context.role, PERMISSIONS.builderRuntimeStaff)) {
    return fail('No tienes permisos para actualizar sesiones dinámicas.', 403, 'forbidden');
  }

  const { id } = await params;

  let body: UpdateSesionBody;
  try {
    body = await parseJsonBody<UpdateSesionBody>(request);
  } catch (error) {
    return fail(error instanceof Error ? error.message : 'Body inválido.', 400);
  }

  const payload: Record<string, unknown> = {};

  if (body.titulo !== undefined) payload.titulo = body.titulo.trim();
  if (body.descripcion !== undefined) payload.descripcion = body.descripcion?.trim() || null;
  if (body.inicio !== undefined) payload.inicio = body.inicio;
  if (body.fin !== undefined) payload.fin = body.fin;
  if (body.cupo_total !== undefined) {
    if (Number(body.cupo_total) <= 0) {
      return fail('cupo_total debe ser mayor a 0.', 400);
    }
    payload.cupo_total = Math.floor(body.cupo_total);
  }

  if (body.estado !== undefined) {
    if (!isBuilderSessionState(body.estado)) {
      return fail('estado inválido.', 400);
    }
    payload.estado = body.estado;
  }

  if (body.reglas !== undefined) payload.reglas = body.reglas;

  if (Object.keys(payload).length === 0) {
    return fail('No hay cambios para aplicar.', 400);
  }

  const { data, error } = await authCtx.client.database
    .from(gymTable('builder_sesiones'))
    .update(payload)
    .eq('gimnasio_id', authCtx.context.gimnasioId)
    .eq('id', id)
    .select('*')
    .single();

  if (error || !data) {
    return fail(`No se pudo actualizar sesión: ${error?.message ?? 'unknown error'}`, 500);
  }

  return ok(data);
}
