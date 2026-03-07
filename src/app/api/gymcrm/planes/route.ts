import { ok, okList, fail, parseJsonBody } from '@/lib/gymcrm/api';
import { PERMISSIONS, hasRole } from '@/lib/gymcrm/permissions';
import { getAuthContext, gymTable, parsePagination } from '@/lib/gymcrm/server';

type CreatePlanBody = {
  nombre: string;
  descripcion?: string | null;
  precio: number;
  moneda?: string;
  duracion_dias: number;
  incluye_reservas?: boolean;
  activo?: boolean;
};

export async function GET(request: Request) {
  const authCtx = await getAuthContext();
  if (!authCtx.ok) return authCtx.response;

  const url = new URL(request.url);
  const active = url.searchParams.get('active');
  const { from, to } = parsePagination(url.searchParams);

  const query = authCtx.client.database
    .from(gymTable('planes_membresia'))
    .select('*', { count: 'exact' })
    .eq('gimnasio_id', authCtx.context.gimnasioId)
    .order('created_at', { ascending: false })
    .range(from, to);

  if (active === 'true') query.eq('activo', true);
  if (active === 'false') query.eq('activo', false);

  const { data, error, count } = await query;
  if (error) return fail(`No se pudieron cargar planes: ${error.message}`, 500);

  return okList(data ?? [], count ?? 0);
}

export async function POST(request: Request) {
  const authCtx = await getAuthContext();
  if (!authCtx.ok) return authCtx.response;

  if (!hasRole(authCtx.context.role, PERMISSIONS.membresias)) {
    return fail('No tienes permisos para crear planes.', 403);
  }

  let body: CreatePlanBody;
  try {
    body = await parseJsonBody<CreatePlanBody>(request);
  } catch (error) {
    return fail(error instanceof Error ? error.message : 'Body inválido.', 400);
  }

  if (!body.nombre?.trim()) return fail('nombre es obligatorio.', 400);
  if (!Number.isFinite(body.precio) || body.precio < 0) return fail('precio inválido.', 400);
  if (!Number.isFinite(body.duracion_dias) || body.duracion_dias <= 0) return fail('duracion_dias inválido.', 400);

  const { data, error } = await authCtx.client.database
    .from(gymTable('planes_membresia'))
    .insert([
      {
        gimnasio_id: authCtx.context.gimnasioId,
        nombre: body.nombre.trim(),
        descripcion: body.descripcion?.trim() || null,
        precio: body.precio,
        moneda: body.moneda ?? 'UYU',
        duracion_dias: body.duracion_dias,
        incluye_reservas: body.incluye_reservas ?? true,
        activo: body.activo ?? true,
      },
    ])
    .select('*')
    .single();

  if (error || !data) return fail(`No se pudo crear plan: ${error?.message ?? 'unknown error'}`, 500);

  return ok(data, { status: 201 });
}
