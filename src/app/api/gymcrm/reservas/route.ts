import { ok, okList, fail, parseJsonBody } from '@/lib/gymcrm/api';
import { resolveReservationStateByCapacity } from '@/lib/gymcrm/domain';
import { PERMISSIONS, hasRole } from '@/lib/gymcrm/permissions';
import { getAuthContext, gymTable, parsePagination, resolveCurrentClientId } from '@/lib/gymcrm/server';
import type { ReservationState } from '@/lib/gymcrm/types';

type CreateReservaBody = {
  horario_id: string;
  clase_base_id?: string;
  cliente_id?: string;
  estado?: ReservationState;
};

export async function GET(request: Request) {
  const authCtx = await getAuthContext();
  if (!authCtx.ok) {
    return authCtx.response;
  }

  const url = new URL(request.url);
  const horarioId = url.searchParams.get('horarioId');
  const estado = url.searchParams.get('estado');
  const { from, to } = parsePagination(url.searchParams);

  const query = authCtx.client.database
    .from(gymTable('reservas_clases'))
    .select('*', { count: 'exact' })
    .eq('gimnasio_id', authCtx.context.gimnasioId)
    .order('created_at', { ascending: false })
    .range(from, to);

  if (horarioId) query.eq('horario_id', horarioId);
  if (estado) query.eq('estado', estado);

  if (authCtx.context.role === 'cliente') {
    const clienteId = await resolveCurrentClientId(authCtx, { allowFallback: true, autoCreate: true });
    if (!clienteId) {
      return okList([], 0);
    }
    query.eq('cliente_id', clienteId);
  }

  const { data, error, count } = await query;
  if (error) {
    return fail(`No se pudieron cargar reservas: ${error.message}`, 500);
  }

  return okList(data ?? [], count ?? 0);
}

export async function POST(request: Request) {
  const authCtx = await getAuthContext();
  if (!authCtx.ok) {
    return authCtx.response;
  }

  const isStaff = hasRole(authCtx.context.role, PERMISSIONS.reservasStaff);
  const isCliente = authCtx.context.role === 'cliente';

  if (!isStaff && !isCliente) {
    return fail('No tienes permisos para crear reservas.', 403);
  }

  let body: CreateReservaBody;
  try {
    body = await parseJsonBody<CreateReservaBody>(request);
  } catch (error) {
    return fail(error instanceof Error ? error.message : 'Body inválido.', 400);
  }

  if (!body.horario_id) {
    return fail('horario_id es obligatorio.', 400);
  }

  const horarioResp = await authCtx.client.database
    .from(gymTable('clases_horarios'))
    .select('id, clase_base_id, cupo_total, estado, inicio')
    .eq('gimnasio_id', authCtx.context.gimnasioId)
    .eq('id', body.horario_id)
    .single();

  if (horarioResp.error || !horarioResp.data) {
    return fail(`Horario inválido: ${horarioResp.error?.message ?? 'not found'}`, 400);
  }

  if (horarioResp.data.estado !== 'programada') {
    return fail('Solo se pueden reservar horarios programados.', 400);
  }

  let clienteId: string | null | undefined = body.cliente_id;
  if (isCliente || !clienteId) {
    clienteId = await resolveCurrentClientId(authCtx, { allowFallback: true, autoCreate: true });
  }

  if (!clienteId) {
    return fail('No se pudo resolver el cliente para la reserva.', 400);
  }

  const today = new Date().toISOString().slice(0, 10);
  const { count: activeMembershipCount, error: membershipError } = await authCtx.client.database
    .from(gymTable('membresias'))
    .select('id', { count: 'exact', head: true })
    .eq('gimnasio_id', authCtx.context.gimnasioId)
    .eq('cliente_id', clienteId)
    .eq('estado', 'activa')
    .lte('fecha_inicio', today)
    .gte('fecha_fin', today);

  if (membershipError) {
    return fail(`No se pudo validar membresía activa: ${membershipError.message}`, 500);
  }

  if ((activeMembershipCount ?? 0) === 0) {
    return fail('El cliente no tiene membresía activa para reservar.', 400);
  }

  const { count: confirmedCount, error: confirmedError } = await authCtx.client.database
    .from(gymTable('reservas_clases'))
    .select('id', { count: 'exact', head: true })
    .eq('gimnasio_id', authCtx.context.gimnasioId)
    .eq('horario_id', body.horario_id)
    .in('estado', ['confirmada', 'asistio']);

  if (confirmedError) {
    return fail(`No se pudo validar cupo: ${confirmedError.message}`, 500);
  }

  const finalState = resolveReservationStateByCapacity(
    body.estado ?? 'confirmada',
    confirmedCount ?? 0,
    horarioResp.data.cupo_total
  );

  const { data, error } = await authCtx.client.database
    .from(gymTable('reservas_clases'))
    .insert([
      {
        gimnasio_id: authCtx.context.gimnasioId,
        horario_id: body.horario_id,
        clase_base_id: body.clase_base_id ?? horarioResp.data.clase_base_id,
        cliente_id: clienteId,
        estado: finalState,
      },
    ])
    .select('*')
    .single();

  if (error || !data) {
    return fail(`No se pudo crear reserva: ${error?.message ?? 'unknown error'}`, 500);
  }

  return ok(data, { status: 201 });
}
