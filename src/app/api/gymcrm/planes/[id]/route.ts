import { ok, fail, parseJsonBody } from '@/lib/gymcrm/api';
import { PERMISSIONS, hasRole } from '@/lib/gymcrm/permissions';
import { getAuthContext, gymTable } from '@/lib/gymcrm/server';

type Params = { params: Promise<{ id: string }> };

type UpdatePlanBody = {
  nombre?: string;
  descripcion?: string | null;
  precio?: number;
  moneda?: string;
  duracion_dias?: number;
  incluye_reservas?: boolean;
  activo?: boolean;
};

export async function PATCH(request: Request, { params }: Params) {
  const authCtx = await getAuthContext();
  if (!authCtx.ok) return authCtx.response;

  if (!hasRole(authCtx.context.role, PERMISSIONS.membresias)) {
    return fail('No tienes permisos para editar planes.', 403);
  }

  const { id } = await params;

  let body: UpdatePlanBody;
  try {
    body = await parseJsonBody<UpdatePlanBody>(request);
  } catch (error) {
    return fail(error instanceof Error ? error.message : 'Body inválido.', 400);
  }

  const payload: Record<string, string | number | boolean | null> = {};

  if (body.nombre !== undefined) payload.nombre = body.nombre.trim();
  if (body.descripcion !== undefined) payload.descripcion = body.descripcion?.trim() || null;
  if (body.precio !== undefined) payload.precio = body.precio;
  if (body.moneda !== undefined) payload.moneda = body.moneda;
  if (body.duracion_dias !== undefined) payload.duracion_dias = body.duracion_dias;
  if (body.incluye_reservas !== undefined) payload.incluye_reservas = body.incluye_reservas;
  if (body.activo !== undefined) payload.activo = body.activo;

  if (Object.keys(payload).length === 0) return fail('No hay campos para actualizar.', 400);

  const { data, error } = await authCtx.client.database
    .from(gymTable('planes_membresia'))
    .update(payload)
    .eq('gimnasio_id', authCtx.context.gimnasioId)
    .eq('id', id)
    .select('*')
    .single();

  if (error || !data) return fail(`No se pudo actualizar plan: ${error?.message ?? 'unknown error'}`, 500);

  return ok(data);
}

export async function DELETE(_: Request, { params }: Params) {
  const authCtx = await getAuthContext();
  if (!authCtx.ok) return authCtx.response;

  if (!hasRole(authCtx.context.role, PERMISSIONS.membresias)) {
    return fail('No tienes permisos para pausar planes.', 403);
  }

  const { id } = await params;

  const { data, error } = await authCtx.client.database
    .from(gymTable('planes_membresia'))
    .update({ activo: false })
    .eq('gimnasio_id', authCtx.context.gimnasioId)
    .eq('id', id)
    .select('*')
    .single();

  if (error || !data) return fail(`No se pudo pausar plan: ${error?.message ?? 'unknown error'}`, 500);

  return ok(data);
}
