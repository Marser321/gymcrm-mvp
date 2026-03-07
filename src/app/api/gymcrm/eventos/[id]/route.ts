import { ok, fail, parseJsonBody } from '@/lib/gymcrm/api';
import { hasRole, PERMISSIONS } from '@/lib/gymcrm/permissions';
import { getAuthContext, gymTable } from '@/lib/gymcrm/server';

type Params = { params: Promise<{ id: string }> };

type UpdateEventoBody = {
  sede_id?: string | null;
  nombre?: string;
  tipo?: string;
  descripcion?: string | null;
  cupo?: number | null;
  fecha_inicio?: string;
  fecha_fin?: string;
  estado?: 'programado' | 'abierto' | 'cerrado' | 'cancelado';
};

export async function PATCH(request: Request, { params }: Params) {
  const authCtx = await getAuthContext();
  if (!authCtx.ok) return authCtx.response;

  if (!hasRole(authCtx.context.role, PERMISSIONS.eventos)) {
    return fail('No tienes permisos para actualizar eventos.', 403);
  }

  const { id } = await params;

  let body: UpdateEventoBody;
  try {
    body = await parseJsonBody<UpdateEventoBody>(request);
  } catch (error) {
    return fail(error instanceof Error ? error.message : 'Body inválido.', 400);
  }

  const payload: Record<string, string | number | null> = {};
  if (body.sede_id !== undefined) payload.sede_id = body.sede_id;
  if (body.nombre !== undefined) payload.nombre = body.nombre.trim();
  if (body.tipo !== undefined) payload.tipo = body.tipo.trim();
  if (body.descripcion !== undefined) payload.descripcion = body.descripcion?.trim() || null;
  if (body.cupo !== undefined) payload.cupo = body.cupo;
  if (body.fecha_inicio !== undefined) payload.fecha_inicio = body.fecha_inicio;
  if (body.fecha_fin !== undefined) payload.fecha_fin = body.fecha_fin;
  if (body.estado !== undefined) payload.estado = body.estado;

  if (Object.keys(payload).length === 0) return fail('No hay campos para actualizar.', 400);

  const { data, error } = await authCtx.client.database
    .from(gymTable('eventos_deportivos'))
    .update(payload)
    .eq('gimnasio_id', authCtx.context.gimnasioId)
    .eq('id', id)
    .select('*')
    .single();

  if (error || !data) return fail(`No se pudo actualizar evento: ${error?.message ?? 'unknown error'}`, 500);

  return ok(data);
}
