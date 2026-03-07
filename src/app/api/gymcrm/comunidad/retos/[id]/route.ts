import { ok, fail, parseJsonBody } from '@/lib/gymcrm/api';
import { hasRole, PERMISSIONS } from '@/lib/gymcrm/permissions';
import { getAuthContext, gymTable } from '@/lib/gymcrm/server';

type Params = { params: Promise<{ id: string }> };

type UpdateRetoBody = {
  titulo?: string;
  descripcion?: string | null;
  puntos_recompensa?: number;
  fecha_inicio?: string;
  fecha_fin?: string;
  estado?: 'programado' | 'activo' | 'cerrado';
};

export async function PATCH(request: Request, { params }: Params) {
  const authCtx = await getAuthContext();
  if (!authCtx.ok) return authCtx.response;

  if (!hasRole(authCtx.context.role, PERMISSIONS.comunidad)) {
    return fail('No tienes permisos para actualizar retos.', 403);
  }

  const { id } = await params;

  let body: UpdateRetoBody;
  try {
    body = await parseJsonBody<UpdateRetoBody>(request);
  } catch (error) {
    return fail(error instanceof Error ? error.message : 'Body inválido.', 400);
  }

  const payload: Record<string, string | number | null> = {};
  if (body.titulo !== undefined) payload.titulo = body.titulo.trim();
  if (body.descripcion !== undefined) payload.descripcion = body.descripcion?.trim() || null;
  if (body.puntos_recompensa !== undefined) payload.puntos_recompensa = body.puntos_recompensa;
  if (body.fecha_inicio !== undefined) payload.fecha_inicio = body.fecha_inicio;
  if (body.fecha_fin !== undefined) payload.fecha_fin = body.fecha_fin;
  if (body.estado !== undefined) payload.estado = body.estado;

  if (Object.keys(payload).length === 0) return fail('No hay campos para actualizar.', 400);

  const { data, error } = await authCtx.client.database
    .from(gymTable('comunidad_retos'))
    .update(payload)
    .eq('gimnasio_id', authCtx.context.gimnasioId)
    .eq('id', id)
    .select('*')
    .single();

  if (error || !data) return fail(`No se pudo actualizar reto: ${error?.message ?? 'unknown error'}`, 500);

  return ok(data);
}
