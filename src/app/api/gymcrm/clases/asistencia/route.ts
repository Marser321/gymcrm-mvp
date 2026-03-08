import { fail, ok, parseJsonBody } from '@/lib/gymcrm/api';
import { hasRole, PERMISSIONS } from '@/lib/gymcrm/permissions';
import { getAuthContext, gymTable, resolveCurrentClientId } from '@/lib/gymcrm/server';
import type { ReservationState } from '@/lib/gymcrm/types';

type AttendanceState = Extract<ReservationState, 'asistio' | 'ausente' | 'confirmada'>;

type UpsertAttendanceBody = {
  horario_id: string;
  reserva_id?: string;
  cliente_id?: string;
  estado?: AttendanceState;
  metodo_checkin?: 'qr' | 'manual';
};

const PRECHECKIN_MINUTES_BEFORE = 90;
const PRECHECKIN_MINUTES_AFTER = 20;

const resolveReservationForMutation = async (
  authCtx: Extract<Awaited<ReturnType<typeof getAuthContext>>, { ok: true }>,
  payload: { horarioId: string; reservaId?: string; clienteId?: string }
) => {
  if (payload.reservaId) {
    return authCtx.client.database
      .from(gymTable('reservas_clases'))
      .select('id, horario_id, cliente_id, estado')
      .eq('gimnasio_id', authCtx.context.gimnasioId)
      .eq('id', payload.reservaId)
      .maybeSingle();
  }

  if (!payload.clienteId) {
    return { data: null, error: null };
  }

  return authCtx.client.database
    .from(gymTable('reservas_clases'))
    .select('id, horario_id, cliente_id, estado')
    .eq('gimnasio_id', authCtx.context.gimnasioId)
    .eq('horario_id', payload.horarioId)
    .eq('cliente_id', payload.clienteId)
    .in('estado', ['confirmada', 'espera', 'asistio', 'ausente'])
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
};

const ensureCheckin = async (
  authCtx: Extract<Awaited<ReturnType<typeof getAuthContext>>, { ok: true }>,
  payload: {
    clienteId: string;
    horarioId: string;
    metodo: 'qr' | 'manual';
  }
) => {
  const existing = await authCtx.client.database
    .from(gymTable('checkins'))
    .select('id, metodo, created_at')
    .eq('gimnasio_id', authCtx.context.gimnasioId)
    .eq('cliente_id', payload.clienteId)
    .eq('horario_id', payload.horarioId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing.error) {
    throw new Error(existing.error.message);
  }

  if (existing.data) {
    return existing.data;
  }

  const inserted = await authCtx.client.database
    .from(gymTable('checkins'))
    .insert([
      {
        gimnasio_id: authCtx.context.gimnasioId,
        cliente_id: payload.clienteId,
        horario_id: payload.horarioId,
        metodo: payload.metodo,
        registrado_por: authCtx.authUserId,
      },
    ])
    .select('id, metodo, created_at')
    .single();

  if (inserted.error || !inserted.data) {
    throw new Error(inserted.error?.message ?? 'No se pudo registrar check-in.');
  }

  return inserted.data;
};

export async function GET(request: Request) {
  const authCtx = await getAuthContext();
  if (!authCtx.ok) return authCtx.response;

  if (!hasRole(authCtx.context.role, PERMISSIONS.checkins) && authCtx.context.role !== 'cliente') {
    return fail('No tienes permisos para consultar asistencia.', 403, 'forbidden');
  }

  const url = new URL(request.url);
  const horarioId = url.searchParams.get('horarioId');

  if (!horarioId) {
    return fail('horarioId es obligatorio para consultar asistencia.', 400);
  }

  const horarioResp = await authCtx.client.database
    .from(gymTable('clases_horarios'))
    .select('id, clase_base_id, inicio, fin, cupo_total, estado')
    .eq('gimnasio_id', authCtx.context.gimnasioId)
    .eq('id', horarioId)
    .maybeSingle();

  if (horarioResp.error || !horarioResp.data) {
    return fail(`Horario inválido: ${horarioResp.error?.message ?? 'not found'}`, 404);
  }

  const claseResp = await authCtx.client.database
    .from(gymTable('clases_base'))
    .select('id, nombre, instructor_nombre')
    .eq('gimnasio_id', authCtx.context.gimnasioId)
    .eq('id', horarioResp.data.clase_base_id)
    .maybeSingle();

  const reservationsResp = await authCtx.client.database
    .from(gymTable('reservas_clases'))
    .select('id, cliente_id, estado, created_at')
    .eq('gimnasio_id', authCtx.context.gimnasioId)
    .eq('horario_id', horarioId)
    .order('created_at', { ascending: true });

  if (reservationsResp.error) {
    return fail(`No se pudo cargar reservas para asistencia: ${reservationsResp.error.message}`, 500);
  }

  let reservations = reservationsResp.data ?? [];
  if (authCtx.context.role === 'cliente') {
    const currentClientId = await resolveCurrentClientId(authCtx, { allowFallback: true, autoCreate: true });
    if (!currentClientId) {
      reservations = [];
    } else {
      reservations = reservations.filter((item) => item.cliente_id === currentClientId);
    }
  }

  const clientIds = Array.from(new Set(reservations.map((item) => item.cliente_id)));
  const clientsResp = clientIds.length
    ? await authCtx.client.database
        .from(gymTable('clientes'))
        .select('id, nombres, apellidos')
        .eq('gimnasio_id', authCtx.context.gimnasioId)
        .in('id', clientIds)
    : { data: [], error: null };

  if (clientsResp.error) {
    return fail(`No se pudo cargar listado de clientes para asistencia: ${clientsResp.error.message}`, 500);
  }

  const checkinsResp = clientIds.length
    ? await authCtx.client.database
        .from(gymTable('checkins'))
        .select('id, cliente_id, metodo, created_at')
        .eq('gimnasio_id', authCtx.context.gimnasioId)
        .eq('horario_id', horarioId)
        .in('cliente_id', clientIds)
        .order('created_at', { ascending: false })
    : { data: [], error: null };

  if (checkinsResp.error) {
    return fail(`No se pudo cargar check-ins para asistencia: ${checkinsResp.error.message}`, 500);
  }

  const clientMap = new Map<string, { nombres: string; apellidos: string }>();
  for (const item of clientsResp.data ?? []) {
    clientMap.set(item.id, {
      nombres: item.nombres ?? '',
      apellidos: item.apellidos ?? '',
    });
  }

  const latestCheckinByClient = new Map<string, { id: string; metodo: string; created_at: string }>();
  for (const checkin of checkinsResp.data ?? []) {
    if (!latestCheckinByClient.has(checkin.cliente_id)) {
      latestCheckinByClient.set(checkin.cliente_id, checkin);
    }
  }

  const asistentes = reservations.map((reservation) => {
    const client = clientMap.get(reservation.cliente_id);
    const checkin = latestCheckinByClient.get(reservation.cliente_id);
    const attendanceState =
      reservation.estado === 'asistio' || reservation.estado === 'ausente'
        ? reservation.estado
        : checkin
          ? 'asistio'
          : 'pendiente';

    return {
      reserva_id: reservation.id,
      cliente_id: reservation.cliente_id,
      cliente_nombre: `${client?.nombres ?? 'Cliente'} ${client?.apellidos ?? ''}`.trim(),
      estado_reserva: reservation.estado,
      asistencia_estado: attendanceState,
      checkin: checkin
        ? {
            id: checkin.id,
            metodo: checkin.metodo,
            created_at: checkin.created_at,
          }
        : null,
    };
  });

  return ok({
    horario: horarioResp.data,
    clase: claseResp.data ?? null,
    asistentes,
  });
}

const upsertAttendance = async (request: Request) => {
  const authCtx = await getAuthContext();
  if (!authCtx.ok) return authCtx.response;

  let body: UpsertAttendanceBody;
  try {
    body = await parseJsonBody<UpsertAttendanceBody>(request);
  } catch (error) {
    return fail(error instanceof Error ? error.message : 'Body inválido.', 400);
  }

  if (!body.horario_id) {
    return fail('horario_id es obligatorio.', 400);
  }

  const horarioResp = await authCtx.client.database
    .from(gymTable('clases_horarios'))
    .select('id, inicio, estado')
    .eq('gimnasio_id', authCtx.context.gimnasioId)
    .eq('id', body.horario_id)
    .maybeSingle();

  if (horarioResp.error || !horarioResp.data) {
    return fail(`Horario inválido: ${horarioResp.error?.message ?? 'not found'}`, 404);
  }

  const isStaff = hasRole(authCtx.context.role, PERMISSIONS.checkins);
  const isCliente = authCtx.context.role === 'cliente';

  if (!isStaff && !isCliente) {
    return fail('No tienes permisos para registrar asistencia.', 403, 'forbidden');
  }

  let targetClientId = body.cliente_id ?? null;
  if (isCliente) {
    targetClientId = await resolveCurrentClientId(authCtx, { allowFallback: true, autoCreate: true });
    if (!targetClientId) {
      return fail('No se pudo resolver cliente para pre-check-in.', 400);
    }
  }

  const reservationResp = await resolveReservationForMutation(authCtx, {
    horarioId: body.horario_id,
    reservaId: body.reserva_id,
    clienteId: targetClientId ?? undefined,
  });

  if (reservationResp.error || !reservationResp.data) {
    return fail(`No se encontró reserva para asistencia: ${reservationResp.error?.message ?? 'not found'}`, 404);
  }

  const reservation = reservationResp.data;
  const resolvedClientId = reservation.cliente_id;

  if (isCliente) {
    const now = Date.now();
    const start = new Date(horarioResp.data.inicio).getTime();
    const minOpen = start - PRECHECKIN_MINUTES_BEFORE * 60 * 1000;
    const maxOpen = start + PRECHECKIN_MINUTES_AFTER * 60 * 1000;
    if (now < minOpen || now > maxOpen) {
      return fail(
        `Pre-check-in habilitado desde ${PRECHECKIN_MINUTES_BEFORE} min antes hasta ${PRECHECKIN_MINUTES_AFTER} min después del inicio.`,
        400,
        'precheck_window_closed'
      );
    }

    try {
      const checkin = await ensureCheckin(authCtx, {
        clienteId: resolvedClientId,
        horarioId: body.horario_id,
        metodo: 'qr',
      });

      return ok({
        mode: 'precheckin',
        horario_id: body.horario_id,
        reserva_id: reservation.id,
        cliente_id: resolvedClientId,
        checkin,
      });
    } catch (error) {
      return fail(error instanceof Error ? error.message : 'No se pudo registrar pre-check-in.', 500);
    }
  }

  if (!body.estado || !['asistio', 'ausente', 'confirmada'].includes(body.estado)) {
    return fail('estado inválido para staff. Usa asistio, ausente o confirmada.', 400);
  }

  const updatePayload: Record<string, string | null> = {
    estado: body.estado,
  };
  if (body.estado === 'confirmada') {
    updatePayload.cancelada_en = null;
  }

  const updateResp = await authCtx.client.database
    .from(gymTable('reservas_clases'))
    .update(updatePayload)
    .eq('gimnasio_id', authCtx.context.gimnasioId)
    .eq('id', reservation.id)
    .select('*')
    .single();

  if (updateResp.error || !updateResp.data) {
    return fail(`No se pudo actualizar estado de asistencia: ${updateResp.error?.message ?? 'unknown error'}`, 500);
  }

  let checkin: { id: string; metodo: string; created_at: string } | null = null;
  if (body.estado === 'asistio') {
    try {
      checkin = await ensureCheckin(authCtx, {
        clienteId: resolvedClientId,
        horarioId: body.horario_id,
        metodo: body.metodo_checkin ?? 'manual',
      });
    } catch (error) {
      return fail(error instanceof Error ? error.message : 'No se pudo registrar check-in.', 500);
    }
  }

  return ok({
    mode: 'staff',
    reserva: updateResp.data,
    checkin,
  });
};

export async function POST(request: Request) {
  return upsertAttendance(request);
}

export async function PATCH(request: Request) {
  return upsertAttendance(request);
}
