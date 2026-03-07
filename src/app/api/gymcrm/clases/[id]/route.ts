import { ok, fail, parseJsonBody } from '@/lib/gymcrm/api';
import { PERMISSIONS, hasRole } from '@/lib/gymcrm/permissions';
import { getAuthContext, gymTable } from '@/lib/gymcrm/server';

type Params = { params: Promise<{ id: string }> };

type UpdateClaseBody = {
  sede_id?: string | null;
  nombre?: string;
  descripcion?: string | null;
  cupo_total?: number;
  duracion_min?: number;
  instructor_nombre?: string | null;
  nivel?: string | null;
  activa?: boolean;
};

export async function PATCH(request: Request, { params }: Params) {
  const authCtx = await getAuthContext();
  if (!authCtx.ok) {
    return authCtx.response;
  }

  if (!hasRole(authCtx.context.role, PERMISSIONS.clases)) {
    return fail('No tienes permisos para editar clases.', 403);
  }

  const { id } = await params;

  let body: UpdateClaseBody;
  try {
    body = await parseJsonBody<UpdateClaseBody>(request);
  } catch (error) {
    return fail(error instanceof Error ? error.message : 'Body inválido.', 400);
  }

  const payload: Record<string, string | number | boolean | null> = {};

  if (body.sede_id !== undefined) payload.sede_id = body.sede_id;
  if (body.nombre !== undefined) payload.nombre = body.nombre.trim();
  if (body.descripcion !== undefined) payload.descripcion = body.descripcion ? body.descripcion.trim() : null;
  if (body.cupo_total !== undefined) {
    if (!Number.isFinite(body.cupo_total) || body.cupo_total <= 0) {
      return fail('cupo_total debe ser mayor a 0.', 400);
    }
    payload.cupo_total = body.cupo_total;
  }

  if (body.duracion_min !== undefined) {
    if (!Number.isFinite(body.duracion_min) || body.duracion_min <= 0) {
      return fail('duracion_min debe ser mayor a 0.', 400);
    }
    payload.duracion_min = body.duracion_min;
  }

  if (body.instructor_nombre !== undefined) payload.instructor_nombre = body.instructor_nombre ? body.instructor_nombre.trim() : null;
  if (body.nivel !== undefined) payload.nivel = body.nivel ? body.nivel.trim() : null;
  if (body.activa !== undefined) payload.activa = body.activa;

  if (Object.keys(payload).length === 0) {
    return fail('No hay campos para actualizar.', 400);
  }

  const { data, error } = await authCtx.client.database
    .from(gymTable('clases_base'))
    .update(payload)
    .eq('gimnasio_id', authCtx.context.gimnasioId)
    .eq('id', id)
    .select('*')
    .single();

  if (error || !data) {
    return fail(`No se pudo actualizar clase: ${error?.message ?? 'unknown error'}`, 500);
  }

  return ok(data);
}

export async function DELETE(_: Request, { params }: Params) {
  const authCtx = await getAuthContext();
  if (!authCtx.ok) {
    return authCtx.response;
  }

  if (!hasRole(authCtx.context.role, PERMISSIONS.clases)) {
    return fail('No tienes permisos para pausar clases.', 403);
  }

  const { id } = await params;

  const { data, error } = await authCtx.client.database
    .from(gymTable('clases_base'))
    .update({ activa: false })
    .eq('gimnasio_id', authCtx.context.gimnasioId)
    .eq('id', id)
    .select('*')
    .single();

  if (error || !data) {
    return fail(`No se pudo pausar clase: ${error?.message ?? 'unknown error'}`, 500);
  }

  return ok(data);
}
