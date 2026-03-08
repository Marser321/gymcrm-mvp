import { ok, okList, fail, parseJsonBody } from '@/lib/gymcrm/api';
import { resolveMembershipState } from '@/lib/gymcrm/domain';
import { PERMISSIONS, hasRole } from '@/lib/gymcrm/permissions';
import { getAuthContext, gymTable, parsePagination, resolveCurrentClientId } from '@/lib/gymcrm/server';
import type { MembershipState } from '@/lib/gymcrm/types';

type CreateMembresiaBody = {
  cliente_id: string;
  plan_id: string;
  fecha_inicio: string;
  fecha_fin: string;
  estado?: MembershipState;
  renovacion_automatica?: boolean;
  observaciones?: string | null;
};

export async function GET(request: Request) {
  const authCtx = await getAuthContext();
  if (!authCtx.ok) {
    return authCtx.response;
  }

  const url = new URL(request.url);
  const clienteId = url.searchParams.get('clienteId');
  const estado = url.searchParams.get('estado') as MembershipState | null;
  const { from, to } = parsePagination(url.searchParams);

  const query = authCtx.client.database
    .from(gymTable('membresias'))
    .select('*', { count: 'exact' })
    .eq('gimnasio_id', authCtx.context.gimnasioId)
    .order('created_at', { ascending: false })
    .range(from, to);

  if (clienteId) {
    query.eq('cliente_id', clienteId);
  }

  if (estado) {
    query.eq('estado', estado);
  }

  if (authCtx.context.role === 'cliente') {
    const currentClientId = await resolveCurrentClientId(authCtx, { allowFallback: true, autoCreate: true });
    if (!currentClientId) {
      return okList([], 0);
    }

    query.eq('cliente_id', currentClientId);
  }

  const { data, error, count } = await query;
  if (error) {
    return fail(`No se pudieron cargar membresías: ${error.message}`, 500);
  }

  const resolved = (data ?? []).map((row) => ({
    ...row,
    estado: resolveMembershipState(row.estado as MembershipState, row.fecha_fin),
  }));

  return okList(resolved, count ?? 0);
}

export async function POST(request: Request) {
  const authCtx = await getAuthContext();
  if (!authCtx.ok) {
    return authCtx.response;
  }

  if (!hasRole(authCtx.context.role, PERMISSIONS.membresias)) {
    return fail('No tienes permisos para crear membresías.', 403);
  }

  let body: CreateMembresiaBody;
  try {
    body = await parseJsonBody<CreateMembresiaBody>(request);
  } catch (error) {
    return fail(error instanceof Error ? error.message : 'Body inválido.', 400);
  }

  if (!body.cliente_id || !body.plan_id || !body.fecha_inicio || !body.fecha_fin) {
    return fail('cliente_id, plan_id, fecha_inicio y fecha_fin son obligatorios.', 400);
  }

  const payload = {
    gimnasio_id: authCtx.context.gimnasioId,
    cliente_id: body.cliente_id,
    plan_id: body.plan_id,
    fecha_inicio: body.fecha_inicio,
    fecha_fin: body.fecha_fin,
    estado: body.estado ?? 'activa',
    renovacion_automatica: body.renovacion_automatica ?? false,
    observaciones: body.observaciones ?? null,
  };

  const { data, error } = await authCtx.client.database
    .from(gymTable('membresias'))
    .insert([payload])
    .select('*')
    .single();

  if (error || !data) {
    return fail(`No se pudo crear membresía: ${error?.message ?? 'unknown error'}`, 500);
  }

  return ok(data, { status: 201 });
}
