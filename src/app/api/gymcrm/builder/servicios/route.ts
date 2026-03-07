import { ok, okList, fail, parseJsonBody } from '@/lib/gymcrm/api';
import { isBuilderTemplateKey, normalizeBuilderDefinition } from '@/lib/gymcrm/builder';
import { hasRole, PERMISSIONS } from '@/lib/gymcrm/permissions';
import { getAuthContext, gymTable, parsePagination } from '@/lib/gymcrm/server';

type CreateServicioBody = {
  slug: string;
  nombre: string;
  plantilla: string;
  modulo_base?: string | null;
  estado?: 'borrador' | 'publicado' | 'pausado';
  definicion?: unknown;
};

export async function GET(request: Request) {
  const authCtx = await getAuthContext();
  if (!authCtx.ok) return authCtx.response;

  const url = new URL(request.url);
  const estado = url.searchParams.get('estado');
  const active = url.searchParams.get('active');
  const { from, to } = parsePagination(url.searchParams);

  const query = authCtx.client.database
    .from(gymTable('builder_servicios'))
    .select('*', { count: 'exact' })
    .eq('gimnasio_id', authCtx.context.gimnasioId)
    .order('created_at', { ascending: false })
    .range(from, to);

  if (estado) query.eq('estado', estado);
  if (active === 'true') query.eq('activo', true);
  if (active === 'false') query.eq('activo', false);

  const { data, error, count } = await query;

  if (error) return fail(`No se pudieron cargar servicios: ${error.message}`, 500);

  return okList(data ?? [], count ?? 0);
}

export async function POST(request: Request) {
  const authCtx = await getAuthContext();
  if (!authCtx.ok) return authCtx.response;

  if (!hasRole(authCtx.context.role, PERMISSIONS.builder)) {
    return fail('No tienes permisos para crear servicios del builder.', 403);
  }

  let body: CreateServicioBody;
  try {
    body = await parseJsonBody<CreateServicioBody>(request);
  } catch (error) {
    return fail(error instanceof Error ? error.message : 'Body inválido.', 400);
  }

  if (!body.slug?.trim() || !body.nombre?.trim() || !body.plantilla?.trim()) {
    return fail('slug, nombre y plantilla son obligatorios.', 400);
  }

  if (!isBuilderTemplateKey(body.plantilla)) {
    return fail('plantilla inválida.', 400);
  }

  const definition = normalizeBuilderDefinition(body.plantilla, body.definicion);

  const insertServicio = await authCtx.client.database
    .from(gymTable('builder_servicios'))
    .insert([
      {
        gimnasio_id: authCtx.context.gimnasioId,
        slug: body.slug.trim().toLowerCase(),
        nombre: body.nombre.trim(),
        modulo_base: body.modulo_base ?? body.plantilla,
        estado: body.estado ?? 'borrador',
        created_by: authCtx.authUserId,
      },
    ])
    .select('*')
    .single();

  if (insertServicio.error || !insertServicio.data) {
    return fail(`No se pudo crear servicio: ${insertServicio.error?.message ?? 'unknown error'}`, 500);
  }

  const versionInsert = await authCtx.client.database
    .from(gymTable('builder_servicio_versiones'))
    .insert([
      {
        servicio_id: insertServicio.data.id,
        version: 1,
        definicion: definition,
        publicado: body.estado === 'publicado',
        created_by: authCtx.authUserId,
      },
    ])
    .select('*')
    .single();

  if (versionInsert.error || !versionInsert.data) {
    return fail(`Servicio creado pero falló versión inicial: ${versionInsert.error?.message ?? 'unknown error'}`, 500);
  }

  return ok(
    {
      servicio: insertServicio.data,
      version: versionInsert.data,
    },
    { status: 201 }
  );
}
