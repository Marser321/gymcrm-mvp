import { fail, ok, okList, parseJsonBody } from '@/lib/gymcrm/api';
import { hasRole, PERMISSIONS } from '@/lib/gymcrm/permissions';
import { getAuthContext, gymTable, parsePagination } from '@/lib/gymcrm/server';

type CreateMedicionBody = {
  cliente_id?: string;
  plan_id?: string | null;
  peso_kg?: number | null;
  grasa_pct?: number | null;
  perimetros?: Record<string, number> | null;
  adherencia_pct?: number | null;
  notas?: string | null;
  fecha_medicion?: string | null;
};

const resolveClientId = async (authCtx: Extract<Awaited<ReturnType<typeof getAuthContext>>, { ok: true }>) => {
  const { data, error } = await authCtx.client.database
    .from(gymTable('clientes'))
    .select('id')
    .eq('gimnasio_id', authCtx.context.gimnasioId)
    .eq('auth_user_id', authCtx.authUserId)
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data?.id ?? null;
};

export async function GET(request: Request) {
  const authCtx = await getAuthContext();
  if (!authCtx.ok) return authCtx.response;

  const url = new URL(request.url);
  const clienteIdQuery = url.searchParams.get('clienteId');
  const { from, to } = parsePagination(url.searchParams);

  let clienteId = clienteIdQuery;
  if (authCtx.context.role === 'cliente') {
    clienteId = await resolveClientId(authCtx);
    if (!clienteId) return okList([], 0);
  }

  const query = authCtx.client.database
    .from(gymTable('nutricion_mediciones'))
    .select('*', { count: 'exact' })
    .eq('gimnasio_id', authCtx.context.gimnasioId)
    .order('fecha_medicion', { ascending: false })
    .range(from, to);

  if (clienteId) query.eq('cliente_id', clienteId);

  const { data, error, count } = await query;
  if (error) return fail(`No se pudieron cargar mediciones: ${error.message}`, 500);

  return okList(data ?? [], count ?? 0);
}

export async function POST(request: Request) {
  const authCtx = await getAuthContext();
  if (!authCtx.ok) return authCtx.response;

  const canStaff = hasRole(authCtx.context.role, PERMISSIONS.nutricion);
  const isClient = authCtx.context.role === 'cliente';
  if (!canStaff && !isClient) {
    return fail('No tienes permisos para registrar mediciones.', 403, 'forbidden');
  }

  let body: CreateMedicionBody;
  try {
    body = await parseJsonBody<CreateMedicionBody>(request);
  } catch (error) {
    return fail(error instanceof Error ? error.message : 'Body inválido.', 400);
  }

  let clienteId = body.cliente_id;
  if (isClient || !clienteId) {
    clienteId = await resolveClientId(authCtx);
  }

  if (!clienteId) {
    return fail('No se pudo resolver el cliente para la medición.', 400);
  }

  if (
    body.adherencia_pct !== undefined &&
    body.adherencia_pct !== null &&
    (Number(body.adherencia_pct) < 0 || Number(body.adherencia_pct) > 100)
  ) {
    return fail('adherencia_pct debe estar entre 0 y 100.', 400);
  }

  const { data, error } = await authCtx.client.database
    .from(gymTable('nutricion_mediciones'))
    .insert([
      {
        gimnasio_id: authCtx.context.gimnasioId,
        cliente_id: clienteId,
        plan_id: body.plan_id ?? null,
        peso_kg: body.peso_kg ?? null,
        grasa_pct: body.grasa_pct ?? null,
        perimetros: body.perimetros ?? null,
        adherencia_pct: body.adherencia_pct ?? null,
        notas: body.notas?.trim() || null,
        fecha_medicion: body.fecha_medicion ?? new Date().toISOString().slice(0, 10),
        registrado_por: authCtx.authUserId,
      },
    ])
    .select('*')
    .single();

  if (error || !data) {
    return fail(`No se pudo registrar medición: ${error?.message ?? 'unknown error'}`, 500);
  }

  return ok(data, { status: 201 });
}
