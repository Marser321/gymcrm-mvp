import { ok, okList, fail, parseJsonBody } from '@/lib/gymcrm/api';
import { hasRole, PERMISSIONS } from '@/lib/gymcrm/permissions';
import { getAuthContext, gymTable, parsePagination } from '@/lib/gymcrm/server';

type CreateEventoBody = {
  sede_id?: string | null;
  nombre: string;
  tipo: string;
  descripcion?: string | null;
  cupo?: number | null;
  fecha_inicio: string;
  fecha_fin: string;
  estado?: 'programado' | 'abierto' | 'cerrado' | 'cancelado';
};

export async function GET(request: Request) {
  const authCtx = await getAuthContext();
  if (!authCtx.ok) return authCtx.response;

  const url = new URL(request.url);
  const { from, to } = parsePagination(url.searchParams);

  const { data, error, count } = await authCtx.client.database
    .from(gymTable('eventos_deportivos'))
    .select('*', { count: 'exact' })
    .eq('gimnasio_id', authCtx.context.gimnasioId)
    .order('fecha_inicio', { ascending: true })
    .range(from, to);

  if (error) return fail(`No se pudieron cargar eventos: ${error.message}`, 500);

  return okList(data ?? [], count ?? 0);
}

export async function POST(request: Request) {
  const authCtx = await getAuthContext();
  if (!authCtx.ok) return authCtx.response;

  if (!hasRole(authCtx.context.role, PERMISSIONS.eventos)) {
    return fail('No tienes permisos para crear eventos.', 403);
  }

  let body: CreateEventoBody;
  try {
    body = await parseJsonBody<CreateEventoBody>(request);
  } catch (error) {
    return fail(error instanceof Error ? error.message : 'Body inválido.', 400);
  }

  if (!body.nombre?.trim() || !body.tipo?.trim() || !body.fecha_inicio || !body.fecha_fin) {
    return fail('nombre, tipo, fecha_inicio y fecha_fin son obligatorios.', 400);
  }

  const { data, error } = await authCtx.client.database
    .from(gymTable('eventos_deportivos'))
    .insert([
      {
        gimnasio_id: authCtx.context.gimnasioId,
        sede_id: body.sede_id ?? null,
        nombre: body.nombre.trim(),
        tipo: body.tipo.trim(),
        descripcion: body.descripcion?.trim() || null,
        cupo: body.cupo ?? null,
        fecha_inicio: body.fecha_inicio,
        fecha_fin: body.fecha_fin,
        estado: body.estado ?? 'programado',
      },
    ])
    .select('*')
    .single();

  if (error || !data) return fail(`No se pudo crear evento: ${error?.message ?? 'unknown error'}`, 500);

  return ok(data, { status: 201 });
}
