import { fail, ok, okList, parseJsonBody } from '@/lib/gymcrm/api';
import { canRedeemPoints } from '@/lib/gymcrm/domain';
import { hasRole, PERMISSIONS } from '@/lib/gymcrm/permissions';
import { getAuthContext, gymTable, parsePagination, resolveCurrentClientId } from '@/lib/gymcrm/server';

type CreateCanjeBody = {
  premio_id: string;
  cliente_id?: string;
  metadata?: Record<string, unknown>;
};

const computeReservedPoints = async (
  authCtx: Extract<Awaited<ReturnType<typeof getAuthContext>>, { ok: true }>,
  clienteId: string
): Promise<number> => {
  const { data, error } = await authCtx.client.database
    .from(gymTable('comunidad_canjes'))
    .select('puntos')
    .eq('gimnasio_id', authCtx.context.gimnasioId)
    .eq('cliente_id', clienteId)
    .in('estado', ['solicitado', 'aprobado']);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).reduce((sum, item) => sum + Number(item.puntos ?? 0), 0);
};

export async function GET(request: Request) {
  const authCtx = await getAuthContext();
  if (!authCtx.ok) return authCtx.response;

  const url = new URL(request.url);
  const estado = url.searchParams.get('estado');
  const clienteIdQuery = url.searchParams.get('clienteId');
  const { from, to } = parsePagination(url.searchParams);

  let clienteId = clienteIdQuery;
  if (authCtx.context.role === 'cliente') {
    clienteId = await resolveCurrentClientId(authCtx, { allowFallback: true, autoCreate: true });
    if (!clienteId) return okList([], 0);
  }

  const query = authCtx.client.database
    .from(gymTable('comunidad_canjes'))
    .select('*', { count: 'exact' })
    .eq('gimnasio_id', authCtx.context.gimnasioId)
    .order('created_at', { ascending: false })
    .range(from, to);

  if (estado) query.eq('estado', estado);
  if (clienteId) query.eq('cliente_id', clienteId);

  const { data, error, count } = await query;
  if (error) return fail(`No se pudieron cargar canjes: ${error.message}`, 500);

  return okList(data ?? [], count ?? 0);
}

export async function POST(request: Request) {
  const authCtx = await getAuthContext();
  if (!authCtx.ok) return authCtx.response;

  const isStaff = hasRole(authCtx.context.role, PERMISSIONS.comunidadCanjesStaff);
  const isClient = authCtx.context.role === 'cliente';

  if (!isStaff && !isClient) {
    return fail('No tienes permisos para solicitar canjes.', 403, 'forbidden');
  }

  let body: CreateCanjeBody;
  try {
    body = await parseJsonBody<CreateCanjeBody>(request);
  } catch (error) {
    return fail(error instanceof Error ? error.message : 'Body inválido.', 400);
  }

  if (!body.premio_id) {
    return fail('premio_id es obligatorio.', 400);
  }

  let clienteId: string | null | undefined = body.cliente_id;
  if (isClient || !clienteId) {
    clienteId = await resolveCurrentClientId(authCtx, { allowFallback: true, autoCreate: true });
  }

  if (!clienteId) {
    return fail('No se pudo resolver cliente para el canje.', 400);
  }

  const { data: premio, error: premioError } = await authCtx.client.database
    .from(gymTable('comunidad_premios_catalogo'))
    .select('*')
    .eq('gimnasio_id', authCtx.context.gimnasioId)
    .eq('id', body.premio_id)
    .eq('activa', true)
    .single();

  if (premioError || !premio) {
    return fail(`Premio inválido: ${premioError?.message ?? 'not found'}`, 400);
  }

  const today = new Date().toISOString().slice(0, 10);
  if (premio.vigencia_desde && premio.vigencia_desde > today) {
    return fail('El premio todavía no está vigente.', 400);
  }
  if (premio.vigencia_hasta && premio.vigencia_hasta < today) {
    return fail('El premio ya no está vigente.', 400);
  }

  if (premio.stock_disponible !== null && Number(premio.stock_disponible) <= 0) {
    return fail('No hay stock disponible para este premio.', 400);
  }

  const balanceRpc = await authCtx.client.database.rpc('gymcrm_comunidad_saldo_cliente', {
    p_gimnasio_id: authCtx.context.gimnasioId,
    p_cliente_id: clienteId,
  });

  if (balanceRpc.error) {
    return fail(`No se pudo calcular saldo de puntos: ${balanceRpc.error.message}`, 500);
  }

  const reserved = await computeReservedPoints(authCtx, clienteId);
  const available = Number(balanceRpc.data ?? 0) - reserved;

  if (!canRedeemPoints(available, Number(premio.costo_puntos))) {
    return fail('Puntos insuficientes para solicitar el canje.', 400);
  }

  const { data, error } = await authCtx.client.database
    .from(gymTable('comunidad_canjes'))
    .insert([
      {
        gimnasio_id: authCtx.context.gimnasioId,
        cliente_id: clienteId,
        premio_id: premio.id,
        estado: 'solicitado',
        puntos: premio.costo_puntos,
        credito_monto: premio.tipo === 'descuento_pago' ? premio.monto_descuento : null,
        credito_moneda: 'UYU',
        metadata: body.metadata ?? {},
      },
    ])
    .select('*')
    .single();

  if (error || !data) {
    return fail(`No se pudo crear canje: ${error?.message ?? 'unknown error'}`, 500);
  }

  return ok(data, { status: 201 });
}
