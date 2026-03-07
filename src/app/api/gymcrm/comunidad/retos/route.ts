import { ok, okList, fail, parseJsonBody } from '@/lib/gymcrm/api';
import { hasRole, PERMISSIONS } from '@/lib/gymcrm/permissions';
import { getAuthContext, gymTable, parsePagination } from '@/lib/gymcrm/server';

type CreateRetoBody = {
  titulo: string;
  descripcion?: string | null;
  puntos_recompensa?: number;
  fecha_inicio: string;
  fecha_fin: string;
  estado?: 'programado' | 'activo' | 'cerrado';
};

export async function GET(request: Request) {
  const authCtx = await getAuthContext();
  if (!authCtx.ok) return authCtx.response;

  const url = new URL(request.url);
  const { from, to } = parsePagination(url.searchParams);

  const { data, error, count } = await authCtx.client.database
    .from(gymTable('comunidad_retos'))
    .select('*', { count: 'exact' })
    .eq('gimnasio_id', authCtx.context.gimnasioId)
    .order('fecha_inicio', { ascending: false })
    .range(from, to);

  if (error) return fail(`No se pudieron cargar retos: ${error.message}`, 500);

  return okList(data ?? [], count ?? 0);
}

export async function POST(request: Request) {
  const authCtx = await getAuthContext();
  if (!authCtx.ok) return authCtx.response;

  if (!hasRole(authCtx.context.role, PERMISSIONS.comunidad)) {
    return fail('No tienes permisos para crear retos.', 403);
  }

  let body: CreateRetoBody;
  try {
    body = await parseJsonBody<CreateRetoBody>(request);
  } catch (error) {
    return fail(error instanceof Error ? error.message : 'Body inválido.', 400);
  }

  if (!body.titulo?.trim() || !body.fecha_inicio || !body.fecha_fin) {
    return fail('titulo, fecha_inicio y fecha_fin son obligatorios.', 400);
  }

  const { data, error } = await authCtx.client.database
    .from(gymTable('comunidad_retos'))
    .insert([
      {
        gimnasio_id: authCtx.context.gimnasioId,
        titulo: body.titulo.trim(),
        descripcion: body.descripcion?.trim() || null,
        puntos_recompensa: body.puntos_recompensa ?? 0,
        fecha_inicio: body.fecha_inicio,
        fecha_fin: body.fecha_fin,
        estado: body.estado ?? 'programado',
      },
    ])
    .select('*')
    .single();

  if (error || !data) {
    return fail(`No se pudo crear reto: ${error?.message ?? 'unknown error'}`, 500);
  }

  return ok(data, { status: 201 });
}
