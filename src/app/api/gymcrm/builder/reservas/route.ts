import { fail, ok, okList, parseJsonBody } from '@/lib/gymcrm/api';
import { resolveReservationStateByCapacity } from '@/lib/gymcrm/domain';
import { hasRole, PERMISSIONS } from '@/lib/gymcrm/permissions';
import { getAuthContext, gymTable, parsePagination, resolveCurrentClientId } from '@/lib/gymcrm/server';
import type { ReservationState } from '@/lib/gymcrm/types';

type CreateReservaBody = {
  sesion_id: string;
  servicio_id?: string;
  cliente_id?: string;
  estado?: ReservationState;
};

export async function GET(request: Request) {
  const authCtx = await getAuthContext();
  if (!authCtx.ok) return authCtx.response;

  const url = new URL(request.url);
  const sesionId = url.searchParams.get('sesionId');
  const estado = url.searchParams.get('estado');
  const { from, to } = parsePagination(url.searchParams);

  const query = authCtx.client.database
    .from(gymTable('builder_reservas'))
    .select('*', { count: 'exact' })
    .eq('gimnasio_id', authCtx.context.gimnasioId)
    .order('created_at', { ascending: false })
    .range(from, to);

  if (sesionId) query.eq('sesion_id', sesionId);
  if (estado) query.eq('estado', estado);

  if (authCtx.context.role === 'cliente') {
    const clienteId = await resolveCurrentClientId(authCtx, { allowFallback: true, autoCreate: true });
    if (!clienteId) return okList([], 0);
    query.eq('cliente_id', clienteId);
  }

  const { data, error, count } = await query;
  if (error) return fail(`No se pudieron cargar reservas: ${error.message}`, 500);

  return okList(data ?? [], count ?? 0);
}

export async function POST(request: Request) {
  const authCtx = await getAuthContext();
  if (!authCtx.ok) return authCtx.response;

  const isStaff = hasRole(authCtx.context.role, PERMISSIONS.builderRuntimeStaff);
  const isCliente = authCtx.context.role === 'cliente';

  if (!isStaff && !isCliente) {
    return fail('No tienes permisos para crear reservas dinámicas.', 403, 'forbidden');
  }

  let body: CreateReservaBody;
  try {
    body = await parseJsonBody<CreateReservaBody>(request);
  } catch (error) {
    return fail(error instanceof Error ? error.message : 'Body inválido.', 400);
  }

  if (!body.sesion_id) {
    return fail('sesion_id es obligatorio.', 400);
  }

  const sesionResp = await authCtx.client.database
    .from(gymTable('builder_sesiones'))
    .select('id, servicio_id, cupo_total, estado, inicio')
    .eq('gimnasio_id', authCtx.context.gimnasioId)
    .eq('id', body.sesion_id)
    .single();

  if (sesionResp.error || !sesionResp.data) {
    return fail(`Sesión inválida: ${sesionResp.error?.message ?? 'not found'}`, 400);
  }

  if (sesionResp.data.estado !== 'programada') {
    return fail('Solo se pueden reservar sesiones programadas.', 400);
  }

  let clienteId: string | null | undefined = body.cliente_id;
  if (isCliente || !clienteId) {
    clienteId = await resolveCurrentClientId(authCtx, { allowFallback: true, autoCreate: true });
  }

  if (!clienteId) {
    return fail('No se pudo resolver el cliente de la reserva.', 400);
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
    .from(gymTable('builder_reservas'))
    .select('id', { count: 'exact', head: true })
    .eq('gimnasio_id', authCtx.context.gimnasioId)
    .eq('sesion_id', body.sesion_id)
    .in('estado', ['confirmada', 'asistio']);

  if (confirmedError) {
    return fail(`No se pudo validar cupo: ${confirmedError.message}`, 500);
  }

  const finalState = resolveReservationStateByCapacity(
    body.estado ?? 'confirmada',
    confirmedCount ?? 0,
    sesionResp.data.cupo_total
  );

  const { data, error } = await authCtx.client.database
    .from(gymTable('builder_reservas'))
    .insert([
      {
        gimnasio_id: authCtx.context.gimnasioId,
        sesion_id: body.sesion_id,
        servicio_id: body.servicio_id ?? sesionResp.data.servicio_id,
        cliente_id: clienteId,
        estado: finalState,
        registrado_por: isStaff ? authCtx.authUserId : null,
      },
    ])
    .select('*')
    .single();

  if (error || !data) {
    return fail(`No se pudo crear reserva: ${error?.message ?? 'unknown error'}`, 500);
  }

  return ok(data, { status: 201 });
}
