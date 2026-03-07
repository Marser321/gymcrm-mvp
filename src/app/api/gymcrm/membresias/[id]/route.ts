import { ok, fail, parseJsonBody } from '@/lib/gymcrm/api';
import { PERMISSIONS, hasRole } from '@/lib/gymcrm/permissions';
import { getAuthContext, gymTable } from '@/lib/gymcrm/server';
import type { MembershipState } from '@/lib/gymcrm/types';

type Params = { params: Promise<{ id: string }> };

type UpdateMembresiaBody = {
  plan_id?: string;
  estado?: MembershipState;
  fecha_inicio?: string;
  fecha_fin?: string;
  renovacion_automatica?: boolean;
  observaciones?: string | null;
};

export async function PATCH(request: Request, { params }: Params) {
  const authCtx = await getAuthContext();
  if (!authCtx.ok) {
    return authCtx.response;
  }

  if (!hasRole(authCtx.context.role, PERMISSIONS.membresias)) {
    return fail('No tienes permisos para editar membresías.', 403);
  }

  const { id } = await params;

  let body: UpdateMembresiaBody;
  try {
    body = await parseJsonBody<UpdateMembresiaBody>(request);
  } catch (error) {
    return fail(error instanceof Error ? error.message : 'Body inválido.', 400);
  }

  const payload: Record<string, string | boolean | null> = {};

  if (body.plan_id !== undefined) payload.plan_id = body.plan_id;
  if (body.estado !== undefined) payload.estado = body.estado;
  if (body.fecha_inicio !== undefined) payload.fecha_inicio = body.fecha_inicio;
  if (body.fecha_fin !== undefined) payload.fecha_fin = body.fecha_fin;
  if (body.renovacion_automatica !== undefined) payload.renovacion_automatica = body.renovacion_automatica;
  if (body.observaciones !== undefined) payload.observaciones = body.observaciones ?? null;

  if (Object.keys(payload).length === 0) {
    return fail('No hay campos para actualizar.', 400);
  }

  const { data, error } = await authCtx.client.database
    .from(gymTable('membresias'))
    .update(payload)
    .eq('gimnasio_id', authCtx.context.gimnasioId)
    .eq('id', id)
    .select('*')
    .single();

  if (error || !data) {
    return fail(`No se pudo actualizar membresía: ${error?.message ?? 'unknown error'}`, 500);
  }

  return ok(data);
}

export async function DELETE(_: Request, { params }: Params) {
  const authCtx = await getAuthContext();
  if (!authCtx.ok) {
    return authCtx.response;
  }

  if (!hasRole(authCtx.context.role, PERMISSIONS.membresias)) {
    return fail('No tienes permisos para cancelar membresías.', 403);
  }

  const { id } = await params;

  const { data, error } = await authCtx.client.database
    .from(gymTable('membresias'))
    .update({ estado: 'cancelada' })
    .eq('gimnasio_id', authCtx.context.gimnasioId)
    .eq('id', id)
    .select('*')
    .single();

  if (error || !data) {
    return fail(`No se pudo cancelar membresía: ${error?.message ?? 'unknown error'}`, 500);
  }

  return ok(data);
}
