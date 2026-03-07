import { fail, ok, okList, parseJsonBody } from '@/lib/gymcrm/api';
import { hasRole, PERMISSIONS } from '@/lib/gymcrm/permissions';
import { getAuthContext, gymTable, parsePagination } from '@/lib/gymcrm/server';

type CreateSesionBody = {
  servicio_id: string;
  version_id?: string | null;
  sede_id?: string | null;
  titulo: string;
  descripcion?: string | null;
  inicio: string;
  fin: string;
  cupo_total: number;
  reglas?: Record<string, unknown>;
};

export async function GET(request: Request) {
  const authCtx = await getAuthContext();
  if (!authCtx.ok) return authCtx.response;

  const url = new URL(request.url);
  const servicioId = url.searchParams.get('servicioId');
  const estado = url.searchParams.get('estado');
  const start = url.searchParams.get('start');
  const end = url.searchParams.get('end');
  const { from, to } = parsePagination(url.searchParams);

  const query = authCtx.client.database
    .from(gymTable('builder_sesiones'))
    .select('*', { count: 'exact' })
    .eq('gimnasio_id', authCtx.context.gimnasioId)
    .order('inicio', { ascending: true })
    .range(from, to);

  if (servicioId) query.eq('servicio_id', servicioId);
  if (estado) query.eq('estado', estado);
  if (start) query.gte('inicio', start);
  if (end) query.lte('inicio', end);

  const { data, error, count } = await query;
  if (error) {
    return fail(`No se pudieron cargar sesiones: ${error.message}`, 500);
  }

  return okList(data ?? [], count ?? 0);
}

export async function POST(request: Request) {
  const authCtx = await getAuthContext();
  if (!authCtx.ok) return authCtx.response;

  if (!hasRole(authCtx.context.role, PERMISSIONS.builderRuntimeStaff)) {
    return fail('No tienes permisos para crear sesiones dinámicas.', 403, 'forbidden');
  }

  let body: CreateSesionBody;
  try {
    body = await parseJsonBody<CreateSesionBody>(request);
  } catch (error) {
    return fail(error instanceof Error ? error.message : 'Body inválido.', 400);
  }

  if (!body.servicio_id || !body.titulo?.trim() || !body.inicio || !body.fin || !body.cupo_total) {
    return fail('servicio_id, titulo, inicio, fin y cupo_total son obligatorios.', 400);
  }

  if (Number(body.cupo_total) <= 0) {
    return fail('cupo_total debe ser mayor a 0.', 400);
  }

  const inicio = new Date(body.inicio);
  const fin = new Date(body.fin);

  if (Number.isNaN(inicio.getTime()) || Number.isNaN(fin.getTime()) || fin <= inicio) {
    return fail('Rango de fecha inválido.', 400);
  }

  const { data: servicio, error: servicioError } = await authCtx.client.database
    .from(gymTable('builder_servicios'))
    .select('id, estado, activo')
    .eq('gimnasio_id', authCtx.context.gimnasioId)
    .eq('id', body.servicio_id)
    .single();

  if (servicioError || !servicio) {
    return fail(`Servicio inválido: ${servicioError?.message ?? 'not found'}`, 400);
  }

  if (!servicio.activo) {
    return fail('El servicio está inactivo.', 400);
  }

  const { data, error } = await authCtx.client.database
    .from(gymTable('builder_sesiones'))
    .insert([
      {
        gimnasio_id: authCtx.context.gimnasioId,
        sede_id: body.sede_id ?? null,
        servicio_id: body.servicio_id,
        version_id: body.version_id ?? null,
        titulo: body.titulo.trim(),
        descripcion: body.descripcion?.trim() || null,
        inicio: inicio.toISOString(),
        fin: fin.toISOString(),
        cupo_total: Math.floor(body.cupo_total),
        reglas: body.reglas ?? {},
        created_by: authCtx.authUserId,
      },
    ])
    .select('*')
    .single();

  if (error || !data) {
    return fail(`No se pudo crear sesión: ${error?.message ?? 'unknown error'}`, 500);
  }

  return ok(data, { status: 201 });
}
