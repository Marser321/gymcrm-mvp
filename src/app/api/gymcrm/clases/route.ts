import { ok, okList, fail, parseJsonBody } from '@/lib/gymcrm/api';
import { PERMISSIONS, hasRole } from '@/lib/gymcrm/permissions';
import { getAuthContext, gymTable, parsePagination } from '@/lib/gymcrm/server';

type CreateClaseBody = {
  sede_id?: string | null;
  nombre: string;
  descripcion?: string | null;
  cupo_total: number;
  duracion_min: number;
  instructor_nombre?: string | null;
  nivel?: string | null;
  activa?: boolean;
};

export async function GET(request: Request) {
  const authCtx = await getAuthContext();
  if (!authCtx.ok) {
    return authCtx.response;
  }

  const url = new URL(request.url);
  const active = url.searchParams.get('active');
  const { from, to } = parsePagination(url.searchParams);

  const query = authCtx.client.database
    .from(gymTable('clases_base'))
    .select('*', { count: 'exact' })
    .eq('gimnasio_id', authCtx.context.gimnasioId)
    .order('created_at', { ascending: false })
    .range(from, to);

  if (active === 'true') query.eq('activa', true);
  if (active === 'false') query.eq('activa', false);

  const { data, error, count } = await query;
  if (error) {
    return fail(`No se pudieron cargar clases: ${error.message}`, 500);
  }

  return okList(data ?? [], count ?? 0);
}

export async function POST(request: Request) {
  const authCtx = await getAuthContext();
  if (!authCtx.ok) {
    return authCtx.response;
  }

  if (!hasRole(authCtx.context.role, PERMISSIONS.clases)) {
    return fail('No tienes permisos para crear clases.', 403);
  }

  let body: CreateClaseBody;
  try {
    body = await parseJsonBody<CreateClaseBody>(request);
  } catch (error) {
    return fail(error instanceof Error ? error.message : 'Body inválido.', 400);
  }

  if (!body.nombre?.trim()) {
    return fail('nombre es obligatorio.', 400);
  }

  if (!Number.isFinite(body.cupo_total) || body.cupo_total <= 0) {
    return fail('cupo_total debe ser mayor a 0.', 400);
  }

  if (!Number.isFinite(body.duracion_min) || body.duracion_min <= 0) {
    return fail('duracion_min debe ser mayor a 0.', 400);
  }

  const payload = {
    gimnasio_id: authCtx.context.gimnasioId,
    sede_id: body.sede_id ?? null,
    nombre: body.nombre.trim(),
    descripcion: body.descripcion?.trim() || null,
    cupo_total: body.cupo_total,
    duracion_min: body.duracion_min,
    instructor_nombre: body.instructor_nombre?.trim() || null,
    nivel: body.nivel?.trim() || null,
    activa: body.activa ?? true,
  };

  const { data, error } = await authCtx.client.database
    .from(gymTable('clases_base'))
    .insert([payload])
    .select('*')
    .single();

  if (error || !data) {
    return fail(`No se pudo crear clase: ${error?.message ?? 'unknown error'}`, 500);
  }

  return ok(data, { status: 201 });
}
