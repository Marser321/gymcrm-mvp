import { fail, ok, okList, parseJsonBody } from '@/lib/gymcrm/api';
import { hasRole, PERMISSIONS } from '@/lib/gymcrm/permissions';
import { getAuthContext, gymTable, parsePagination } from '@/lib/gymcrm/server';
import { isPlanNutricionState } from '@/lib/gymcrm/types';

type CreatePlanBody = {
  cliente_id: string;
  consentimiento_id?: string | null;
  estado?: string;
  objetivo_general?: string | null;
  notas?: string | null;
  activo_desde?: string | null;
  activo_hasta?: string | null;
  version_inicial?: {
    contenido: Record<string, unknown>;
    notas?: string;
    publicado?: boolean;
  };
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
  const estado = url.searchParams.get('estado');
  const { from, to } = parsePagination(url.searchParams);

  let clienteId = clienteIdQuery;
  if (authCtx.context.role === 'cliente') {
    clienteId = await resolveClientId(authCtx);
    if (!clienteId) return okList([], 0);
  }

  const query = authCtx.client.database
    .from(gymTable('nutricion_planes'))
    .select('*', { count: 'exact' })
    .eq('gimnasio_id', authCtx.context.gimnasioId)
    .order('updated_at', { ascending: false })
    .range(from, to);

  if (clienteId) query.eq('cliente_id', clienteId);
  if (estado) query.eq('estado', estado);

  const { data, error, count } = await query;
  if (error) return fail(`No se pudieron cargar planes: ${error.message}`, 500);

  return okList(data ?? [], count ?? 0);
}

export async function POST(request: Request) {
  const authCtx = await getAuthContext();
  if (!authCtx.ok) return authCtx.response;

  if (!hasRole(authCtx.context.role, PERMISSIONS.nutricion)) {
    return fail('No tienes permisos para crear planes nutricionales.', 403, 'forbidden');
  }

  let body: CreatePlanBody;
  try {
    body = await parseJsonBody<CreatePlanBody>(request);
  } catch (error) {
    return fail(error instanceof Error ? error.message : 'Body inválido.', 400);
  }

  if (!body.cliente_id) {
    return fail('cliente_id es obligatorio.', 400);
  }

  const estado = body.estado ?? 'borrador';
  if (!isPlanNutricionState(estado)) {
    return fail('estado inválido.', 400);
  }

  let consentimientoId = body.consentimiento_id ?? null;
  if (estado === 'activo' && !consentimientoId) {
    const latestConsent = await authCtx.client.database
      .from(gymTable('nutricion_consentimientos'))
      .select('id')
      .eq('gimnasio_id', authCtx.context.gimnasioId)
      .eq('cliente_id', body.cliente_id)
      .eq('activo', true)
      .is('revocado_en', null)
      .order('aceptado_en', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (latestConsent.error) {
      return fail(`No se pudo validar consentimiento: ${latestConsent.error.message}`, 500);
    }

    consentimientoId = latestConsent.data?.id ?? null;
  }

  const insertPlan = await authCtx.client.database
    .from(gymTable('nutricion_planes'))
    .insert([
      {
        gimnasio_id: authCtx.context.gimnasioId,
        cliente_id: body.cliente_id,
        nutricionista_user_id: authCtx.authUserId,
        consentimiento_id: consentimientoId,
        estado,
        objetivo_general: body.objetivo_general?.trim() || null,
        notas: body.notas?.trim() || null,
        activo_desde: body.activo_desde ?? null,
        activo_hasta: body.activo_hasta ?? null,
      },
    ])
    .select('*')
    .single();

  if (insertPlan.error || !insertPlan.data) {
    return fail(`No se pudo crear plan: ${insertPlan.error?.message ?? 'unknown error'}`, 500);
  }

  const versionContent = body.version_inicial?.contenido ?? {
    comidas: [],
    recomendaciones: [],
    habitos: [],
  };

  const insertVersion = await authCtx.client.database
    .from(gymTable('nutricion_plan_versiones'))
    .insert([
      {
        plan_id: insertPlan.data.id,
        version: 1,
        contenido: versionContent,
        publicado: body.version_inicial?.publicado ?? estado === 'activo',
        notas: body.version_inicial?.notas?.trim() || null,
        created_by: authCtx.authUserId,
      },
    ])
    .select('*')
    .single();

  if (insertVersion.error || !insertVersion.data) {
    return fail(`Plan creado pero falló versión inicial: ${insertVersion.error?.message ?? 'unknown error'}`, 500);
  }

  return ok(
    {
      plan: insertPlan.data,
      version: insertVersion.data,
    },
    { status: 201 }
  );
}
