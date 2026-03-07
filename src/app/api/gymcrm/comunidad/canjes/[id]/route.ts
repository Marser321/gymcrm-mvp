import { randomUUID } from 'crypto';
import { fail, ok, parseJsonBody } from '@/lib/gymcrm/api';
import { hasRole, PERMISSIONS } from '@/lib/gymcrm/permissions';
import { getAuthContext, gymTable } from '@/lib/gymcrm/server';
import { isCanjeState } from '@/lib/gymcrm/types';

type Params = { params: Promise<{ id: string }> };

type UpdateCanjeBody = {
  estado: string;
  motivo_rechazo?: string | null;
};

const ALLOWED_TRANSITIONS: Record<string, readonly string[]> = {
  solicitado: ['aprobado', 'rechazado', 'anulado'],
  aprobado: ['entregado', 'anulado'],
  rechazado: ['anulado'],
  entregado: ['anulado'],
  anulado: [],
};

const createCouponCode = () => {
  const token = randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase();
  return `GYM-${token}`;
};

const addPointsMovement = async (
  authCtx: Extract<Awaited<ReturnType<typeof getAuthContext>>, { ok: true }>,
  args: {
    clienteId: string;
    puntos: number;
    canjeId: string;
    motivo: string;
    movementTag: 'CANJE_DEBITO' | 'CANJE_REVERSO';
  }
) => {
  const { error } = await authCtx.client.database.from(gymTable('comunidad_puntos_movimientos')).insert([
    {
      gimnasio_id: authCtx.context.gimnasioId,
      cliente_id: args.clienteId,
      puntos: args.puntos,
      motivo: `${args.movementTag}:${args.canjeId}`,
      origen_tipo: 'canje_ajuste',
      origen_ref: args.canjeId,
      aprobado_por: authCtx.authUserId,
      created_by: authCtx.authUserId,
      metadata: {
        canje_id: args.canjeId,
        movement: args.movementTag,
        detail: args.motivo,
      },
    },
  ]);

  if (error) {
    if (/duplicate key value violates unique constraint/i.test(error.message)) {
      return;
    }
    throw new Error(error.message);
  }
};

export async function PATCH(request: Request, { params }: Params) {
  const authCtx = await getAuthContext();
  if (!authCtx.ok) return authCtx.response;

  if (!hasRole(authCtx.context.role, PERMISSIONS.comunidadCanjesStaff)) {
    return fail('No tienes permisos para actualizar canjes.', 403, 'forbidden');
  }

  const { id } = await params;

  let body: UpdateCanjeBody;
  try {
    body = await parseJsonBody<UpdateCanjeBody>(request);
  } catch (error) {
    return fail(error instanceof Error ? error.message : 'Body inválido.', 400);
  }

  if (!body.estado || !isCanjeState(body.estado)) {
    return fail('estado inválido.', 400);
  }

  const canjeResp = await authCtx.client.database
    .from(gymTable('comunidad_canjes'))
    .select('*')
    .eq('gimnasio_id', authCtx.context.gimnasioId)
    .eq('id', id)
    .single();

  if (canjeResp.error || !canjeResp.data) {
    return fail(`Canje no encontrado: ${canjeResp.error?.message ?? 'unknown error'}`, 404);
  }

  const canje = canjeResp.data;
  const premioResp = await authCtx.client.database
    .from(gymTable('comunidad_premios_catalogo'))
    .select('id, tipo, stock_disponible')
    .eq('gimnasio_id', authCtx.context.gimnasioId)
    .eq('id', canje.premio_id)
    .single();

  if (premioResp.error || !premioResp.data) {
    return fail(`No se pudo cargar premio de canje: ${premioResp.error?.message ?? 'unknown error'}`, 500);
  }

  const premio = premioResp.data;

  if (canje.estado === body.estado) {
    return fail('El canje ya tiene ese estado.', 400);
  }

  if (!ALLOWED_TRANSITIONS[canje.estado]?.includes(body.estado)) {
    return fail(`Transición inválida de ${canje.estado} a ${body.estado}.`, 400, 'invalid_transition');
  }

  if (body.estado === 'aprobado') {
    if (canje.estado !== 'solicitado') {
      return fail('Solo se puede aprobar un canje solicitado.', 400);
    }

    try {
      await addPointsMovement(authCtx, {
        clienteId: canje.cliente_id,
        puntos: -Math.abs(Number(canje.puntos)),
        canjeId: canje.id,
        motivo: `Canje aprobado ${canje.id}`,
        movementTag: 'CANJE_DEBITO',
      });
    } catch (error) {
      return fail(
        `No se pudo descontar puntos del canje: ${error instanceof Error ? error.message : 'unknown error'}`,
        500
      );
    }

    const premioId = typeof canje.premio_id === 'string' ? canje.premio_id : null;
    const stock = typeof premio.stock_disponible === 'number' ? premio.stock_disponible : null;

    if (premioId && stock !== null && stock <= 0) {
      return fail('No hay stock disponible para aprobar este canje.', 400);
    }

    if (premioId && stock !== null) {
      const updateStock = await authCtx.client.database
        .from(gymTable('comunidad_premios_catalogo'))
        .update({ stock_disponible: stock - 1 })
        .eq('gimnasio_id', authCtx.context.gimnasioId)
        .eq('id', premioId)
        .eq('stock_disponible', stock);

      if (updateStock.error) {
        return fail(`No se pudo actualizar stock del premio: ${updateStock.error.message}`, 500);
      }
    }
  }

  if (body.estado === 'anulado' && (canje.estado === 'aprobado' || canje.estado === 'entregado')) {
    try {
      await addPointsMovement(authCtx, {
        clienteId: canje.cliente_id,
        puntos: Math.abs(Number(canje.puntos)),
        canjeId: canje.id,
        motivo: `Reverso de canje ${canje.id}`,
        movementTag: 'CANJE_REVERSO',
      });
    } catch (error) {
      return fail(
        `No se pudo reversar puntos del canje: ${error instanceof Error ? error.message : 'unknown error'}`,
        500
      );
    }
  }

  const payload: Record<string, unknown> = {
    estado: body.estado,
    motivo_rechazo: body.estado === 'rechazado' ? body.motivo_rechazo?.trim() || null : null,
    aprobado_por: body.estado === 'aprobado' ? authCtx.authUserId : canje.aprobado_por,
    aprobado_en: body.estado === 'aprobado' ? new Date().toISOString() : canje.aprobado_en,
    resuelto_por: body.estado === 'entregado' || body.estado === 'anulado' ? authCtx.authUserId : canje.resuelto_por,
    entregado_en: body.estado === 'entregado' ? new Date().toISOString() : canje.entregado_en,
    anulado_en: body.estado === 'anulado' ? new Date().toISOString() : canje.anulado_en,
  };

  if (body.estado === 'aprobado' && premio.tipo === 'pase_servicio' && !canje.cupon_codigo) {
    payload.cupon_codigo = createCouponCode();
  }

  const { data, error } = await authCtx.client.database
    .from(gymTable('comunidad_canjes'))
    .update(payload)
    .eq('gimnasio_id', authCtx.context.gimnasioId)
    .eq('id', id)
    .eq('estado', canje.estado)
    .select('*')
    .single();

  if (error || !data) {
    return fail(`No se pudo actualizar canje: ${error?.message ?? 'unknown error'}`, 500);
  }

  return ok(data);
}
