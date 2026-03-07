import { fail, ok, parseJsonBody } from '@/lib/gymcrm/api';
import { hasRole, PERMISSIONS } from '@/lib/gymcrm/permissions';
import { getAuthContext, gymTable } from '@/lib/gymcrm/server';
import { isPremioTipo } from '@/lib/gymcrm/types';

type Params = { params: Promise<{ id: string }> };

type UpdatePremioBody = {
  nombre?: string;
  descripcion?: string | null;
  tipo?: string;
  costo_puntos?: number;
  monto_descuento?: number | null;
  servicio_id?: string | null;
  vigencia_desde?: string | null;
  vigencia_hasta?: string | null;
  stock_total?: number | null;
  stock_disponible?: number | null;
  activa?: boolean;
  metadata?: Record<string, unknown>;
};

export async function PATCH(request: Request, { params }: Params) {
  const authCtx = await getAuthContext();
  if (!authCtx.ok) return authCtx.response;

  if (!hasRole(authCtx.context.role, PERMISSIONS.comunidadPremios)) {
    return fail('No tienes permisos para actualizar premios.', 403, 'forbidden');
  }

  const { id } = await params;

  let body: UpdatePremioBody;
  try {
    body = await parseJsonBody<UpdatePremioBody>(request);
  } catch (error) {
    return fail(error instanceof Error ? error.message : 'Body inválido.', 400);
  }

  const payload: Record<string, unknown> = {};
  if (body.nombre !== undefined) payload.nombre = body.nombre.trim();
  if (body.descripcion !== undefined) payload.descripcion = body.descripcion?.trim() || null;
  if (body.tipo !== undefined) {
    if (!isPremioTipo(body.tipo)) return fail('tipo inválido.', 400);
    payload.tipo = body.tipo;
  }
  if (body.costo_puntos !== undefined) payload.costo_puntos = Math.trunc(body.costo_puntos);
  if (body.monto_descuento !== undefined) payload.monto_descuento = body.monto_descuento;
  if (body.servicio_id !== undefined) payload.servicio_id = body.servicio_id;
  if (body.vigencia_desde !== undefined) payload.vigencia_desde = body.vigencia_desde;
  if (body.vigencia_hasta !== undefined) payload.vigencia_hasta = body.vigencia_hasta;
  if (body.stock_total !== undefined) payload.stock_total = body.stock_total;
  if (body.stock_disponible !== undefined) payload.stock_disponible = body.stock_disponible;
  if (body.activa !== undefined) payload.activa = body.activa;
  if (body.metadata !== undefined) payload.metadata = body.metadata;

  if (Object.keys(payload).length === 0) {
    return fail('No hay cambios para aplicar.', 400);
  }

  const { data, error } = await authCtx.client.database
    .from(gymTable('comunidad_premios_catalogo'))
    .update(payload)
    .eq('gimnasio_id', authCtx.context.gimnasioId)
    .eq('id', id)
    .select('*')
    .single();

  if (error || !data) {
    return fail(`No se pudo actualizar premio: ${error?.message ?? 'unknown error'}`, 500);
  }

  return ok(data);
}
