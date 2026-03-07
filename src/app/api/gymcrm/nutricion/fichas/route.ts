import { ok, okList, fail, parseJsonBody } from '@/lib/gymcrm/api';
import { hasRole, PERMISSIONS } from '@/lib/gymcrm/permissions';
import { getAuthContext, gymTable, parsePagination } from '@/lib/gymcrm/server';

type CreateFichaBody = {
  cliente_id: string;
  nutricionista_user_id?: string | null;
  objetivos?: string | null;
  recomendaciones?: string | null;
  evolucion?: unknown;
  estado?: 'activa' | 'cerrada';
};

export async function GET(request: Request) {
  const authCtx = await getAuthContext();
  if (!authCtx.ok) return authCtx.response;

  const url = new URL(request.url);
  const clienteId = url.searchParams.get('clienteId');
  const { from, to } = parsePagination(url.searchParams);

  const query = authCtx.client.database
    .from(gymTable('nutricion_fichas'))
    .select('*', { count: 'exact' })
    .eq('gimnasio_id', authCtx.context.gimnasioId)
    .order('updated_at', { ascending: false })
    .range(from, to);

  if (clienteId) query.eq('cliente_id', clienteId);

  if (authCtx.context.role === 'cliente') {
    const { data: cliente } = await authCtx.client.database
      .from(gymTable('clientes'))
      .select('id')
      .eq('gimnasio_id', authCtx.context.gimnasioId)
      .eq('auth_user_id', authCtx.authUserId)
      .limit(1)
      .maybeSingle();

    if (!cliente?.id) {
      return okList([], 0);
    }

    query.eq('cliente_id', cliente.id);
  }

  const { data, error, count } = await query;
  if (error) return fail(`No se pudieron cargar fichas: ${error.message}`, 500);

  return okList(data ?? [], count ?? 0);
}

export async function POST(request: Request) {
  const authCtx = await getAuthContext();
  if (!authCtx.ok) return authCtx.response;

  if (!hasRole(authCtx.context.role, PERMISSIONS.nutricion)) {
    return fail('No tienes permisos para crear fichas nutricionales.', 403);
  }

  let body: CreateFichaBody;
  try {
    body = await parseJsonBody<CreateFichaBody>(request);
  } catch (error) {
    return fail(error instanceof Error ? error.message : 'Body inválido.', 400);
  }

  if (!body.cliente_id) return fail('cliente_id es obligatorio.', 400);

  const { data, error } = await authCtx.client.database
    .from(gymTable('nutricion_fichas'))
    .insert([
      {
        gimnasio_id: authCtx.context.gimnasioId,
        cliente_id: body.cliente_id,
        nutricionista_user_id: body.nutricionista_user_id ?? authCtx.authUserId,
        objetivos: body.objetivos ?? null,
        recomendaciones: body.recomendaciones ?? null,
        evolucion: body.evolucion ?? null,
        estado: body.estado ?? 'activa',
      },
    ])
    .select('*')
    .single();

  if (error || !data) return fail(`No se pudo crear ficha: ${error?.message ?? 'unknown error'}`, 500);

  return ok(data, { status: 201 });
}
