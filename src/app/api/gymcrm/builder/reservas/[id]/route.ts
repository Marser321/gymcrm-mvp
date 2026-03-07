import { fail, ok, parseJsonBody } from '@/lib/gymcrm/api';
import { canCancelReservation } from '@/lib/gymcrm/domain';
import { hasRole, PERMISSIONS } from '@/lib/gymcrm/permissions';
import { getAuthContext, gymTable } from '@/lib/gymcrm/server';
import type { ReservationState } from '@/lib/gymcrm/types';

type Params = { params: Promise<{ id: string }> };

type UpdateReservaBody = {
  estado: ReservationState;
};

const tryPromoteWaitlist = async (
  authCtx: Extract<Awaited<ReturnType<typeof getAuthContext>>, { ok: true }>,
  sesionId: string
) => {
  try {
    await authCtx.client.database.rpc('gymcrm_promover_lista_espera_builder', { p_sesion_id: sesionId });
  } catch {
    // Safe fallback: cancellation still succeeds.
  }
};

export async function PATCH(request: Request, { params }: Params) {
  const authCtx = await getAuthContext();
  if (!authCtx.ok) return authCtx.response;

  const { id } = await params;

  let body: UpdateReservaBody;
  try {
    body = await parseJsonBody<UpdateReservaBody>(request);
  } catch (error) {
    return fail(error instanceof Error ? error.message : 'Body inválido.', 400);
  }

  if (!body.estado) return fail('estado es obligatorio.', 400);

  const reservationResp = await authCtx.client.database
    .from(gymTable('builder_reservas'))
    .select('id, cliente_id, sesion_id, estado')
    .eq('gimnasio_id', authCtx.context.gimnasioId)
    .eq('id', id)
    .single();

  if (reservationResp.error || !reservationResp.data) {
    return fail(`Reserva no encontrada: ${reservationResp.error?.message ?? 'unknown error'}`, 404);
  }

  const reservation = reservationResp.data;
  const isStaff = hasRole(authCtx.context.role, PERMISSIONS.builderRuntimeStaff);

  if (!isStaff) {
    if (authCtx.context.role !== 'cliente') {
      return fail('No tienes permisos para actualizar reservas.', 403, 'forbidden');
    }

    if (body.estado !== 'cancelada') {
      return fail('El cliente solo puede cancelar su reserva.', 403, 'forbidden');
    }

    const clientResp = await authCtx.client.database
      .from(gymTable('clientes'))
      .select('id')
      .eq('gimnasio_id', authCtx.context.gimnasioId)
      .eq('auth_user_id', authCtx.authUserId)
      .limit(1)
      .maybeSingle();

    if (clientResp.error || !clientResp.data || clientResp.data.id !== reservation.cliente_id) {
      return fail('Solo puedes cancelar tus propias reservas.', 403, 'forbidden');
    }

    const sessionResp = await authCtx.client.database
      .from(gymTable('builder_sesiones'))
      .select('inicio, reglas')
      .eq('gimnasio_id', authCtx.context.gimnasioId)
      .eq('id', reservation.sesion_id)
      .single();

    if (sessionResp.error || !sessionResp.data) {
      return fail('No se pudo validar la sesión de la reserva.', 400);
    }

    const reglas = (sessionResp.data.reglas ?? {}) as Record<string, unknown>;
    const minCancel = Number(reglas.cancelacionMinutosAntes ?? 30);
    const minCancelSafe = Number.isFinite(minCancel) && minCancel > 0 ? Math.floor(minCancel) : 30;

    if (!canCancelReservation(sessionResp.data.inicio, new Date(), minCancelSafe)) {
      return fail(`La cancelación debe realizarse con al menos ${minCancelSafe} minutos de anticipación.`, 400);
    }
  }

  const payload: Record<string, string | null> = {
    estado: body.estado,
  };

  if (body.estado === 'cancelada') {
    payload.cancelada_en = new Date().toISOString();
  }

  const { data, error } = await authCtx.client.database
    .from(gymTable('builder_reservas'))
    .update(payload)
    .eq('gimnasio_id', authCtx.context.gimnasioId)
    .eq('id', id)
    .select('*')
    .single();

  if (error || !data) {
    return fail(`No se pudo actualizar reserva: ${error?.message ?? 'unknown error'}`, 500);
  }

  if (reservation.estado === 'confirmada' && body.estado === 'cancelada') {
    await tryPromoteWaitlist(authCtx, reservation.sesion_id);
  }

  return ok(data);
}
