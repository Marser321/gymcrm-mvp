import { ok, okList, fail, parseJsonBody } from '@/lib/gymcrm/api';
import { hasRole, PERMISSIONS } from '@/lib/gymcrm/permissions';
import { getAuthContext, gymTable, parsePagination } from '@/lib/gymcrm/server';

type CreateConsultaBody = {
  cliente_id?: string;
  asunto: string;
  mensaje?: string;
};

const resolveClientId = async (authCtx: Extract<Awaited<ReturnType<typeof getAuthContext>>, { ok: true }>) => {
  const { data, error } = await authCtx.client.database
    .from(gymTable('clientes'))
    .select('id')
    .eq('gimnasio_id', authCtx.context.gimnasioId)
    .eq('auth_user_id', authCtx.authUserId)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data?.id ?? null;
};

export async function GET(request: Request) {
  const authCtx = await getAuthContext();
  if (!authCtx.ok) return authCtx.response;

  const url = new URL(request.url);
  const estado = url.searchParams.get('estado');
  const { from, to } = parsePagination(url.searchParams);

  const query = authCtx.client.database
    .from(gymTable('nutricion_consultas'))
    .select('*', { count: 'exact' })
    .eq('gimnasio_id', authCtx.context.gimnasioId)
    .order('updated_at', { ascending: false })
    .range(from, to);

  if (estado) query.eq('estado', estado);

  if (authCtx.context.role === 'cliente') {
    const clienteId = await resolveClientId(authCtx);
    if (!clienteId) return okList([], 0);
    query.eq('cliente_id', clienteId);
  }

  const { data, error, count } = await query;
  if (error) return fail(`No se pudieron cargar consultas: ${error.message}`, 500);

  return okList(data ?? [], count ?? 0);
}

export async function POST(request: Request) {
  const authCtx = await getAuthContext();
  if (!authCtx.ok) return authCtx.response;

  const isNutri = hasRole(authCtx.context.role, PERMISSIONS.nutricion);
  const isClient = authCtx.context.role === 'cliente';

  if (!isNutri && !isClient) {
    return fail('No tienes permisos para crear consultas.', 403);
  }

  let body: CreateConsultaBody;
  try {
    body = await parseJsonBody<CreateConsultaBody>(request);
  } catch (error) {
    return fail(error instanceof Error ? error.message : 'Body inválido.', 400);
  }

  if (!body.asunto?.trim()) {
    return fail('asunto es obligatorio.', 400);
  }

  let clientId = body.cliente_id;
  if (isClient || !clientId) {
    clientId = await resolveClientId(authCtx);
  }

  if (!clientId) {
    return fail('No se pudo determinar el cliente para la consulta.', 400);
  }

  const insertConsulta = await authCtx.client.database
    .from(gymTable('nutricion_consultas'))
    .insert([
      {
        gimnasio_id: authCtx.context.gimnasioId,
        cliente_id: clientId,
        nutricionista_user_id: isNutri ? authCtx.authUserId : null,
        asunto: body.asunto.trim(),
        estado: 'abierta',
        created_by: authCtx.authUserId,
      },
    ])
    .select('*')
    .single();

  if (insertConsulta.error || !insertConsulta.data) {
    return fail(`No se pudo crear consulta: ${insertConsulta.error?.message ?? 'unknown error'}`, 500);
  }

  if (body.mensaje?.trim()) {
    const insertMessage = await authCtx.client.database
      .from(gymTable('nutricion_mensajes'))
      .insert([
        {
          consulta_id: insertConsulta.data.id,
          autor_user_id: authCtx.authUserId,
          mensaje: body.mensaje.trim(),
        },
      ])
      .select('*')
      .single();

    if (insertMessage.error) {
      return fail(`Consulta creada pero falló mensaje inicial: ${insertMessage.error.message}`, 500);
    }

    return ok({
      ...insertConsulta.data,
      mensaje_inicial: insertMessage.data,
    }, { status: 201 });
  }

  return ok(insertConsulta.data, { status: 201 });
}
