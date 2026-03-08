import { ok, okList, fail, parseJsonBody } from '@/lib/gymcrm/api';
import { PERMISSIONS, hasRole } from '@/lib/gymcrm/permissions';
import { getAuthContext, gymTable, parsePagination, resolveCurrentClientId } from '@/lib/gymcrm/server';

type CreateCheckinBody = {
  cliente_id?: string;
  codigo_qr?: string;
  sede_id?: string | null;
  horario_id?: string | null;
  metodo?: 'qr' | 'manual';
};

export async function GET(request: Request) {
  const authCtx = await getAuthContext();
  if (!authCtx.ok) {
    return authCtx.response;
  }

  const url = new URL(request.url);
  const clienteId = url.searchParams.get('clienteId');
  const { from, to } = parsePagination(url.searchParams);

  const query = authCtx.client.database
    .from(gymTable('checkins'))
    .select('*', { count: 'exact' })
    .eq('gimnasio_id', authCtx.context.gimnasioId)
    .order('created_at', { ascending: false })
    .range(from, to);

  if (clienteId) {
    query.eq('cliente_id', clienteId);
  }

  if (authCtx.context.role === 'cliente') {
    const currentClientId = await resolveCurrentClientId(authCtx, { allowFallback: true, autoCreate: true });
    if (!currentClientId) {
      return okList([], 0);
    }

    query.eq('cliente_id', currentClientId);
  }

  const { data, error, count } = await query;
  if (error) {
    return fail(`No se pudieron cargar check-ins: ${error.message}`, 500);
  }

  return okList(data ?? [], count ?? 0);
}

export async function POST(request: Request) {
  const authCtx = await getAuthContext();
  if (!authCtx.ok) {
    return authCtx.response;
  }

  if (!hasRole(authCtx.context.role, PERMISSIONS.checkins)) {
    return fail('No tienes permisos para registrar check-ins.', 403);
  }

  let body: CreateCheckinBody;
  try {
    body = await parseJsonBody<CreateCheckinBody>(request);
  } catch (error) {
    return fail(error instanceof Error ? error.message : 'Body inválido.', 400);
  }

  let clienteId = body.cliente_id;

  if (!clienteId && body.codigo_qr) {
    const { data: clienteByQr, error: qrError } = await authCtx.client.database
      .from(gymTable('clientes'))
      .select('id')
      .eq('gimnasio_id', authCtx.context.gimnasioId)
      .eq('codigo_qr', body.codigo_qr)
      .eq('estado', 'activo')
      .single();

    if (qrError || !clienteByQr) {
      return fail(`Código QR inválido: ${qrError?.message ?? 'not found'}`, 400);
    }

    clienteId = clienteByQr.id;
  }

  if (!clienteId) {
    return fail('cliente_id o codigo_qr es obligatorio.', 400);
  }

  const { data, error } = await authCtx.client.database
    .from(gymTable('checkins'))
    .insert([
      {
        gimnasio_id: authCtx.context.gimnasioId,
        cliente_id: clienteId,
        sede_id: body.sede_id ?? null,
        horario_id: body.horario_id ?? null,
        metodo: body.metodo ?? (body.codigo_qr ? 'qr' : 'manual'),
        registrado_por: authCtx.authUserId,
      },
    ])
    .select('*')
    .single();

  if (error || !data) {
    return fail(`No se pudo registrar check-in: ${error?.message ?? 'unknown error'}`, 500);
  }

  return ok(data, { status: 201 });
}
