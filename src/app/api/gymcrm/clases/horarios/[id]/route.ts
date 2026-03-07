import { ok, fail, parseJsonBody } from '@/lib/gymcrm/api';
import { PERMISSIONS, hasRole } from '@/lib/gymcrm/permissions';
import { getAuthContext, gymTable } from '@/lib/gymcrm/server';

type Params = { params: Promise<{ id: string }> };

type UpdateHorarioBody = {
  sede_id?: string | null;
  inicio?: string;
  fin?: string;
  cupo_total?: number;
  estado?: 'programada' | 'cancelada' | 'finalizada';
};

export async function PATCH(request: Request, { params }: Params) {
  const authCtx = await getAuthContext();
  if (!authCtx.ok) {
    return authCtx.response;
  }

  if (!hasRole(authCtx.context.role, PERMISSIONS.clases)) {
    return fail('No tienes permisos para editar horarios.', 403);
  }

  const { id } = await params;

  let body: UpdateHorarioBody;
  try {
    body = await parseJsonBody<UpdateHorarioBody>(request);
  } catch (error) {
    return fail(error instanceof Error ? error.message : 'Body inválido.', 400);
  }

  const payload: Record<string, string | number | null> = {};

  if (body.sede_id !== undefined) payload.sede_id = body.sede_id;
  if (body.inicio !== undefined) payload.inicio = body.inicio;
  if (body.fin !== undefined) payload.fin = body.fin;
  if (body.cupo_total !== undefined) {
    if (!Number.isFinite(body.cupo_total) || body.cupo_total <= 0) {
      return fail('cupo_total debe ser mayor a 0.', 400);
    }
    payload.cupo_total = body.cupo_total;
  }

  if (body.estado !== undefined) payload.estado = body.estado;

  if (Object.keys(payload).length === 0) {
    return fail('No hay campos para actualizar.', 400);
  }

  const { data, error } = await authCtx.client.database
    .from(gymTable('clases_horarios'))
    .update(payload)
    .eq('gimnasio_id', authCtx.context.gimnasioId)
    .eq('id', id)
    .select('*')
    .single();

  if (error || !data) {
    return fail(`No se pudo actualizar horario: ${error?.message ?? 'unknown error'}`, 500);
  }

  return ok(data);
}

export async function DELETE(_: Request, { params }: Params) {
  const authCtx = await getAuthContext();
  if (!authCtx.ok) {
    return authCtx.response;
  }

  if (!hasRole(authCtx.context.role, PERMISSIONS.clases)) {
    return fail('No tienes permisos para cancelar horarios.', 403);
  }

  const { id } = await params;

  const { data, error } = await authCtx.client.database
    .from(gymTable('clases_horarios'))
    .update({ estado: 'cancelada' })
    .eq('gimnasio_id', authCtx.context.gimnasioId)
    .eq('id', id)
    .select('*')
    .single();

  if (error || !data) {
    return fail(`No se pudo cancelar horario: ${error?.message ?? 'unknown error'}`, 500);
  }

  return ok(data);
}
