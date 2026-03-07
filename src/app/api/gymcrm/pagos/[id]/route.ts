import { ok, fail, parseJsonBody } from '@/lib/gymcrm/api';
import { PERMISSIONS, hasRole } from '@/lib/gymcrm/permissions';
import { getAuthContext, gymTable } from '@/lib/gymcrm/server';
import type { PaymentState } from '@/lib/gymcrm/types';

type Params = { params: Promise<{ id: string }> };

type UpdatePagoBody = {
  monto?: number;
  moneda?: string;
  estado?: PaymentState;
  metodo?: string;
  referencia?: string | null;
  fecha_pago?: string;
  notas?: string | null;
};

export async function PATCH(request: Request, { params }: Params) {
  const authCtx = await getAuthContext();
  if (!authCtx.ok) {
    return authCtx.response;
  }

  if (!hasRole(authCtx.context.role, PERMISSIONS.pagos)) {
    return fail('No tienes permisos para editar pagos.', 403);
  }

  const { id } = await params;

  let body: UpdatePagoBody;
  try {
    body = await parseJsonBody<UpdatePagoBody>(request);
  } catch (error) {
    return fail(error instanceof Error ? error.message : 'Body inválido.', 400);
  }

  const payload: Record<string, number | string | null> = {};

  if (body.monto !== undefined) {
    if (!Number.isFinite(body.monto) || body.monto < 0) {
      return fail('monto debe ser un número mayor o igual a 0.', 400);
    }
    payload.monto = body.monto;
  }

  if (body.moneda !== undefined) payload.moneda = body.moneda;
  if (body.estado !== undefined) payload.estado = body.estado;
  if (body.metodo !== undefined) payload.metodo = body.metodo;
  if (body.referencia !== undefined) payload.referencia = body.referencia;
  if (body.fecha_pago !== undefined) payload.fecha_pago = body.fecha_pago;
  if (body.notas !== undefined) payload.notas = body.notas;

  if (Object.keys(payload).length === 0) {
    return fail('No hay campos para actualizar.', 400);
  }

  const { data, error } = await authCtx.client.database
    .from(gymTable('pagos'))
    .update(payload)
    .eq('gimnasio_id', authCtx.context.gimnasioId)
    .eq('id', id)
    .select('*')
    .single();

  if (error || !data) {
    return fail(`No se pudo actualizar pago: ${error?.message ?? 'unknown error'}`, 500);
  }

  return ok(data);
}

export async function DELETE(_: Request, { params }: Params) {
  const authCtx = await getAuthContext();
  if (!authCtx.ok) {
    return authCtx.response;
  }

  if (!hasRole(authCtx.context.role, PERMISSIONS.pagos)) {
    return fail('No tienes permisos para anular pagos.', 403);
  }

  const { id } = await params;

  const { data, error } = await authCtx.client.database
    .from(gymTable('pagos'))
    .update({ estado: 'anulado' })
    .eq('gimnasio_id', authCtx.context.gimnasioId)
    .eq('id', id)
    .select('*')
    .single();

  if (error || !data) {
    return fail(`No se pudo anular pago: ${error?.message ?? 'unknown error'}`, 500);
  }

  return ok(data);
}
