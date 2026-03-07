import { fail, ok, parseJsonBody } from '@/lib/gymcrm/api';
import { hasRole, PERMISSIONS } from '@/lib/gymcrm/permissions';
import { getAuthContext, gymTable } from '@/lib/gymcrm/server';
import { isPlanNutricionState } from '@/lib/gymcrm/types';

type Params = { params: Promise<{ id: string }> };

type UpdatePlanBody = {
  consentimiento_id?: string | null;
  estado?: string;
  objetivo_general?: string | null;
  notas?: string | null;
  activo_desde?: string | null;
  activo_hasta?: string | null;
  nueva_version?: {
    contenido: Record<string, unknown>;
    notas?: string;
    publicado?: boolean;
  };
};

export async function PATCH(request: Request, { params }: Params) {
  const authCtx = await getAuthContext();
  if (!authCtx.ok) return authCtx.response;

  if (!hasRole(authCtx.context.role, PERMISSIONS.nutricion)) {
    return fail('No tienes permisos para actualizar planes nutricionales.', 403, 'forbidden');
  }

  const { id } = await params;

  let body: UpdatePlanBody;
  try {
    body = await parseJsonBody<UpdatePlanBody>(request);
  } catch (error) {
    return fail(error instanceof Error ? error.message : 'Body inválido.', 400);
  }

  const payload: Record<string, unknown> = {};

  if (body.consentimiento_id !== undefined) payload.consentimiento_id = body.consentimiento_id;
  if (body.estado !== undefined) {
    if (!isPlanNutricionState(body.estado)) {
      return fail('estado inválido.', 400);
    }
    payload.estado = body.estado;
  }
  if (body.objetivo_general !== undefined) payload.objetivo_general = body.objetivo_general?.trim() || null;
  if (body.notas !== undefined) payload.notas = body.notas?.trim() || null;
  if (body.activo_desde !== undefined) payload.activo_desde = body.activo_desde;
  if (body.activo_hasta !== undefined) payload.activo_hasta = body.activo_hasta;

  let planData: Record<string, unknown> | null = null;
  if (Object.keys(payload).length > 0) {
    const updatePlan = await authCtx.client.database
      .from(gymTable('nutricion_planes'))
      .update(payload)
      .eq('gimnasio_id', authCtx.context.gimnasioId)
      .eq('id', id)
      .select('*')
      .single();

    if (updatePlan.error || !updatePlan.data) {
      return fail(`No se pudo actualizar plan: ${updatePlan.error?.message ?? 'unknown error'}`, 500);
    }

    planData = updatePlan.data;
  }

  let versionData: Record<string, unknown> | null = null;
  if (body.nueva_version?.contenido) {
    const latestVersionResp = await authCtx.client.database
      .from(gymTable('nutricion_plan_versiones'))
      .select('version')
      .eq('plan_id', id)
      .order('version', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (latestVersionResp.error) {
      return fail(`No se pudo obtener versión actual: ${latestVersionResp.error.message}`, 500);
    }

    const nextVersion = (latestVersionResp.data?.version ?? 0) + 1;

    const insertVersion = await authCtx.client.database
      .from(gymTable('nutricion_plan_versiones'))
      .insert([
        {
          plan_id: id,
          version: nextVersion,
          contenido: body.nueva_version.contenido,
          publicado: body.nueva_version.publicado ?? false,
          notas: body.nueva_version.notas?.trim() || null,
          created_by: authCtx.authUserId,
        },
      ])
      .select('*')
      .single();

    if (insertVersion.error || !insertVersion.data) {
      return fail(`No se pudo crear nueva versión: ${insertVersion.error?.message ?? 'unknown error'}`, 500);
    }

    versionData = insertVersion.data;
  }

  if (!planData && !versionData) {
    return fail('No hay cambios para aplicar.', 400);
  }

  return ok({
    plan: planData,
    nuevaVersion: versionData,
  });
}
