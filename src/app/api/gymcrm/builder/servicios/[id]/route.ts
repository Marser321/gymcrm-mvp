import { ok, fail, parseJsonBody } from '@/lib/gymcrm/api';
import { isBuilderTemplateKey, normalizeBuilderDefinition } from '@/lib/gymcrm/builder';
import { hasRole, PERMISSIONS } from '@/lib/gymcrm/permissions';
import { getAuthContext, gymTable } from '@/lib/gymcrm/server';

type Params = { params: Promise<{ id: string }> };

type UpdateServicioBody = {
  nombre?: string;
  plantilla?: string;
  estado?: 'borrador' | 'publicado' | 'pausado';
  activo?: boolean;
  definicion?: unknown;
  publicarVersion?: boolean;
};

export async function PATCH(request: Request, { params }: Params) {
  const authCtx = await getAuthContext();
  if (!authCtx.ok) return authCtx.response;

  if (!hasRole(authCtx.context.role, PERMISSIONS.builder)) {
    return fail('No tienes permisos para editar servicios del builder.', 403);
  }

  const { id } = await params;

  let body: UpdateServicioBody;
  try {
    body = await parseJsonBody<UpdateServicioBody>(request);
  } catch (error) {
    return fail(error instanceof Error ? error.message : 'Body inválido.', 400);
  }

  let servicioUpdated: Record<string, unknown> | null = null;
  let plantillaServicio = '';

  const payload: Record<string, string | boolean> = {};
  if (body.nombre !== undefined) payload.nombre = body.nombre.trim();
  if (body.estado !== undefined) payload.estado = body.estado;
  if (body.activo !== undefined) payload.activo = body.activo;
  if (body.plantilla !== undefined) {
    if (!isBuilderTemplateKey(body.plantilla)) {
      return fail('plantilla inválida.', 400);
    }
    payload.modulo_base = body.plantilla;
  }

  if (Object.keys(payload).length > 0) {
    const { data, error } = await authCtx.client.database
      .from(gymTable('builder_servicios'))
      .update(payload)
      .eq('gimnasio_id', authCtx.context.gimnasioId)
      .eq('id', id)
      .select('*')
      .single();

    if (error || !data) {
      return fail(`No se pudo actualizar servicio: ${error?.message ?? 'unknown error'}`, 500);
    }

    servicioUpdated = data;
    plantillaServicio = typeof data.modulo_base === 'string' ? data.modulo_base : '';
  }

  let newVersion: Record<string, unknown> | null = null;
  if (body.definicion !== undefined) {
    if (!plantillaServicio) {
      const { data: servicio, error: servicioError } = await authCtx.client.database
        .from(gymTable('builder_servicios'))
        .select('modulo_base')
        .eq('gimnasio_id', authCtx.context.gimnasioId)
        .eq('id', id)
        .single();

      if (servicioError || !servicio) {
        return fail(`No se pudo obtener servicio: ${servicioError?.message ?? 'unknown error'}`, 500);
      }
      plantillaServicio = typeof servicio.modulo_base === 'string' ? servicio.modulo_base : '';
    }

    const plantilla = isBuilderTemplateKey(plantillaServicio) ? plantillaServicio : 'clase_grupal';
    const definicionNormalizada = normalizeBuilderDefinition(plantilla, body.definicion);

    const latestVersionResp = await authCtx.client.database
      .from(gymTable('builder_servicio_versiones'))
      .select('version')
      .eq('servicio_id', id)
      .order('version', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (latestVersionResp.error) {
      return fail(`No se pudo obtener última versión: ${latestVersionResp.error.message}`, 500);
    }

    const nextVersion = (latestVersionResp.data?.version ?? 0) + 1;

    const insertVersion = await authCtx.client.database
      .from(gymTable('builder_servicio_versiones'))
      .insert([
        {
          servicio_id: id,
          version: nextVersion,
          definicion: definicionNormalizada,
          publicado: body.publicarVersion ?? false,
          created_by: authCtx.authUserId,
        },
      ])
      .select('*')
      .single();

    if (insertVersion.error || !insertVersion.data) {
      return fail(`No se pudo crear nueva versión: ${insertVersion.error?.message ?? 'unknown error'}`, 500);
    }

    newVersion = insertVersion.data;
  }

  if (!servicioUpdated && !newVersion) {
    return fail('No hay cambios para aplicar.', 400);
  }

  return ok({
    servicio: servicioUpdated,
    nuevaVersion: newVersion,
  });
}
