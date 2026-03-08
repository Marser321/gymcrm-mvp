import { fail, ok, parseJsonBody } from '@/lib/gymcrm/api';
import { calculatePointsBalance } from '@/lib/gymcrm/domain';
import { hasRole, PERMISSIONS } from '@/lib/gymcrm/permissions';
import { getAuthContext, gymTable, parsePagination, resolveCurrentClientId } from '@/lib/gymcrm/server';

type CreatePuntosBody = {
  cliente_id: string;
  puntos: number;
  motivo: string;
  reto_id?: string | null;
  origen_tipo?: 'manual' | 'reto' | 'reserva' | 'evento' | 'canje_ajuste';
  origen_ref?: string | null;
  metadata?: Record<string, unknown>;
};

export async function GET(request: Request) {
  const authCtx = await getAuthContext();
  if (!authCtx.ok) return authCtx.response;

  const url = new URL(request.url);
  const clienteIdQuery = url.searchParams.get('clienteId');
  const desde = url.searchParams.get('desde');
  const hasta = url.searchParams.get('hasta');
  const { from, to } = parsePagination(url.searchParams);

  let clienteId = clienteIdQuery;
  if (authCtx.context.role === 'cliente') {
    clienteId = await resolveCurrentClientId(authCtx, { allowFallback: true, autoCreate: true });
    if (!clienteId) {
      return ok({
        data: [],
        count: 0,
        balance: 0,
      });
    }
  }

  const query = authCtx.client.database
    .from(gymTable('comunidad_puntos_movimientos'))
    .select('*', { count: 'exact' })
    .eq('gimnasio_id', authCtx.context.gimnasioId)
    .order('created_at', { ascending: false })
    .range(from, to);

  if (clienteId) query.eq('cliente_id', clienteId);
  if (desde) query.gte('created_at', `${desde}T00:00:00.000Z`);
  if (hasta) query.lte('created_at', `${hasta}T23:59:59.999Z`);

  const { data, error, count } = await query;
  if (error) {
    return fail(`No se pudieron cargar movimientos de puntos: ${error.message}`, 500);
  }

  const balance = calculatePointsBalance((data ?? []) as Array<{ puntos: number }>);

  return ok({
    data: data ?? [],
    count: count ?? 0,
    balance,
  });
}

export async function POST(request: Request) {
  const authCtx = await getAuthContext();
  if (!authCtx.ok) return authCtx.response;

  if (!hasRole(authCtx.context.role, PERMISSIONS.comunidadCanjesStaff)) {
    return fail('No tienes permisos para registrar puntos.', 403, 'forbidden');
  }

  let body: CreatePuntosBody;
  try {
    body = await parseJsonBody<CreatePuntosBody>(request);
  } catch (error) {
    return fail(error instanceof Error ? error.message : 'Body inválido.', 400);
  }

  if (!body.cliente_id || !body.motivo?.trim() || !Number.isFinite(Number(body.puntos)) || Number(body.puntos) === 0) {
    return fail('cliente_id, motivo y puntos (distinto de 0) son obligatorios.', 400);
  }

  const { data, error } = await authCtx.client.database
    .from(gymTable('comunidad_puntos_movimientos'))
    .insert([
      {
        gimnasio_id: authCtx.context.gimnasioId,
        cliente_id: body.cliente_id,
        reto_id: body.reto_id ?? null,
        puntos: Math.trunc(body.puntos),
        motivo: body.motivo.trim(),
        origen_tipo: body.origen_tipo ?? 'manual',
        origen_ref: body.origen_ref ?? null,
        aprobado_por: authCtx.authUserId,
        created_by: authCtx.authUserId,
        metadata: body.metadata ?? {},
      },
    ])
    .select('*')
    .single();

  if (error || !data) {
    return fail(`No se pudo registrar movimiento de puntos: ${error?.message ?? 'unknown error'}`, 500);
  }

  return ok(data, { status: 201 });
}
