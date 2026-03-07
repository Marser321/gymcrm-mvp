import { fail, ok, okList, parseJsonBody } from '@/lib/gymcrm/api';
import { hasRole, PERMISSIONS } from '@/lib/gymcrm/permissions';
import { getAuthContext, gymTable, parsePagination } from '@/lib/gymcrm/server';
import { isConsentimientoMedio } from '@/lib/gymcrm/types';

type CreateConsentBody = {
  cliente_id?: string;
  version_texto: string;
  medio?: string;
  metadata?: Record<string, unknown>;
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
  const active = url.searchParams.get('active');
  const clienteIdQuery = url.searchParams.get('clienteId');
  const { from, to } = parsePagination(url.searchParams);

  let clienteId = clienteIdQuery;
  if (authCtx.context.role === 'cliente') {
    clienteId = await resolveClientId(authCtx);
    if (!clienteId) return okList([], 0);
  }

  const query = authCtx.client.database
    .from(gymTable('nutricion_consentimientos'))
    .select('*', { count: 'exact' })
    .eq('gimnasio_id', authCtx.context.gimnasioId)
    .order('created_at', { ascending: false })
    .range(from, to);

  if (clienteId) query.eq('cliente_id', clienteId);
  if (active === 'true') {
    query.eq('activo', true).is('revocado_en', null);
  }

  const { data, error, count } = await query;
  if (error) return fail(`No se pudieron cargar consentimientos: ${error.message}`, 500);

  return okList(data ?? [], count ?? 0);
}

export async function POST(request: Request) {
  const authCtx = await getAuthContext();
  if (!authCtx.ok) return authCtx.response;

  const isStaff = hasRole(authCtx.context.role, PERMISSIONS.nutricion);
  const isClient = authCtx.context.role === 'cliente';
  if (!isStaff && !isClient) {
    return fail('No tienes permisos para registrar consentimiento.', 403, 'forbidden');
  }

  let body: CreateConsentBody;
  try {
    body = await parseJsonBody<CreateConsentBody>(request);
  } catch (error) {
    return fail(error instanceof Error ? error.message : 'Body inválido.', 400);
  }

  if (!body.version_texto?.trim()) {
    return fail('version_texto es obligatorio.', 400);
  }

  const medio = body.medio ?? (isClient ? 'app' : 'staff');
  if (!isConsentimientoMedio(medio)) {
    return fail('medio inválido.', 400);
  }

  let clienteId = body.cliente_id;
  if (isClient || !clienteId) {
    clienteId = await resolveClientId(authCtx);
  }

  if (!clienteId) {
    return fail('No se pudo resolver cliente para consentimiento.', 400);
  }

  const revokePrev = await authCtx.client.database
    .from(gymTable('nutricion_consentimientos'))
    .update({
      activo: false,
      revocado_en: new Date().toISOString(),
      revocado_por: authCtx.authUserId,
    })
    .eq('gimnasio_id', authCtx.context.gimnasioId)
    .eq('cliente_id', clienteId)
    .eq('activo', true)
    .is('revocado_en', null);

  if (revokePrev.error) {
    return fail(`No se pudo cerrar consentimiento anterior: ${revokePrev.error.message}`, 500);
  }

  const { data, error } = await authCtx.client.database
    .from(gymTable('nutricion_consentimientos'))
    .insert([
      {
        gimnasio_id: authCtx.context.gimnasioId,
        cliente_id: clienteId,
        version_texto: body.version_texto.trim(),
        medio,
        aceptado_por: authCtx.authUserId,
        activo: true,
        metadata: body.metadata ?? {},
      },
    ])
    .select('*')
    .single();

  if (error || !data) {
    return fail(`No se pudo registrar consentimiento: ${error?.message ?? 'unknown error'}`, 500);
  }

  return ok(data, { status: 201 });
}
