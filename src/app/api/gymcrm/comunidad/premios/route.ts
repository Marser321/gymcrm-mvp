import { fail, ok, okList, parseJsonBody } from '@/lib/gymcrm/api';
import { hasRole, PERMISSIONS } from '@/lib/gymcrm/permissions';
import { getAuthContext, gymTable, parsePagination } from '@/lib/gymcrm/server';
import { isPremioTipo } from '@/lib/gymcrm/types';

type CreatePremioBody = {
  nombre: string;
  descripcion?: string | null;
  tipo: string;
  costo_puntos: number;
  monto_descuento?: number | null;
  servicio_id?: string | null;
  vigencia_desde?: string | null;
  vigencia_hasta?: string | null;
  stock_total?: number | null;
  activa?: boolean;
  metadata?: Record<string, unknown>;
};

export async function GET(request: Request) {
  const authCtx = await getAuthContext();
  if (!authCtx.ok) return authCtx.response;

  const url = new URL(request.url);
  const activa = url.searchParams.get('activa');
  const { from, to } = parsePagination(url.searchParams);

  const query = authCtx.client.database
    .from(gymTable('comunidad_premios_catalogo'))
    .select('*', { count: 'exact' })
    .eq('gimnasio_id', authCtx.context.gimnasioId)
    .order('created_at', { ascending: false })
    .range(from, to);

  if (activa === 'true') query.eq('activa', true);
  if (activa === 'false') query.eq('activa', false);

  const { data, error, count } = await query;
  if (error) return fail(`No se pudieron cargar premios: ${error.message}`, 500);

  return okList(data ?? [], count ?? 0);
}

export async function POST(request: Request) {
  const authCtx = await getAuthContext();
  if (!authCtx.ok) return authCtx.response;

  if (!hasRole(authCtx.context.role, PERMISSIONS.comunidadPremios)) {
    return fail('No tienes permisos para crear premios.', 403, 'forbidden');
  }

  let body: CreatePremioBody;
  try {
    body = await parseJsonBody<CreatePremioBody>(request);
  } catch (error) {
    return fail(error instanceof Error ? error.message : 'Body inválido.', 400);
  }

  if (!body.nombre?.trim() || !body.tipo || !Number.isFinite(Number(body.costo_puntos))) {
    return fail('nombre, tipo y costo_puntos son obligatorios.', 400);
  }

  if (!isPremioTipo(body.tipo)) {
    return fail('tipo inválido.', 400);
  }

  if (Number(body.costo_puntos) <= 0) {
    return fail('costo_puntos debe ser mayor a 0.', 400);
  }

  if (body.tipo === 'descuento_pago' && (!Number.isFinite(Number(body.monto_descuento)) || Number(body.monto_descuento) <= 0)) {
    return fail('monto_descuento debe ser mayor a 0 para premios tipo descuento_pago.', 400);
  }

  if (body.tipo === 'pase_servicio' && !body.servicio_id) {
    return fail('servicio_id es obligatorio para premios tipo pase_servicio.', 400);
  }

  const stockTotal = body.stock_total ?? null;

  const { data, error } = await authCtx.client.database
    .from(gymTable('comunidad_premios_catalogo'))
    .insert([
      {
        gimnasio_id: authCtx.context.gimnasioId,
        nombre: body.nombre.trim(),
        descripcion: body.descripcion?.trim() || null,
        tipo: body.tipo,
        costo_puntos: Math.trunc(body.costo_puntos),
        monto_descuento: body.tipo === 'descuento_pago' ? Number(body.monto_descuento) : null,
        moneda: 'UYU',
        servicio_id: body.tipo === 'pase_servicio' ? body.servicio_id : null,
        vigencia_desde: body.vigencia_desde ?? null,
        vigencia_hasta: body.vigencia_hasta ?? null,
        stock_total: stockTotal,
        stock_disponible: stockTotal,
        activa: body.activa ?? true,
        metadata: body.metadata ?? {},
        created_by: authCtx.authUserId,
      },
    ])
    .select('*')
    .single();

  if (error || !data) {
    return fail(`No se pudo crear premio: ${error?.message ?? 'unknown error'}`, 500);
  }

  return ok(data, { status: 201 });
}
