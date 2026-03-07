import { randomUUID } from 'crypto';
import { ok, okList, fail, parseJsonBody } from '@/lib/gymcrm/api';
import { PERMISSIONS, hasRole } from '@/lib/gymcrm/permissions';
import { getAuthContext, gymTable, parsePagination } from '@/lib/gymcrm/server';
import type { PaymentState } from '@/lib/gymcrm/types';

type CreatePagoBody = {
  cliente_id: string;
  membresia_id?: string | null;
  monto: number;
  canje_id?: string | null;
  moneda?: string;
  estado?: PaymentState;
  metodo?: string;
  referencia?: string | null;
  fecha_pago?: string;
  notas?: string | null;
};

export async function GET(request: Request) {
  const authCtx = await getAuthContext();
  if (!authCtx.ok) {
    return authCtx.response;
  }

  const url = new URL(request.url);
  const clienteId = url.searchParams.get('clienteId');
  const estado = url.searchParams.get('estado') as PaymentState | null;
  const { from, to } = parsePagination(url.searchParams);

  const query = authCtx.client.database
    .from(gymTable('pagos'))
    .select('*', { count: 'exact' })
    .eq('gimnasio_id', authCtx.context.gimnasioId)
    .order('fecha_pago', { ascending: false })
    .range(from, to);

  if (clienteId) {
    query.eq('cliente_id', clienteId);
  }

  if (estado) {
    query.eq('estado', estado);
  }

  if (authCtx.context.role === 'cliente') {
    const { data: cliente } = await authCtx.client.database
      .from(gymTable('clientes'))
      .select('id')
      .eq('gimnasio_id', authCtx.context.gimnasioId)
      .eq('auth_user_id', authCtx.authUserId)
      .limit(1)
      .maybeSingle();

    if (!cliente?.id) {
      return okList([], 0);
    }

    query.eq('cliente_id', cliente.id);
  }

  const { data, error, count } = await query;
  if (error) {
    return fail(`No se pudieron cargar pagos: ${error.message}`, 500);
  }

  return okList(data ?? [], count ?? 0);
}

export async function POST(request: Request) {
  const authCtx = await getAuthContext();
  if (!authCtx.ok) {
    return authCtx.response;
  }

  if (!hasRole(authCtx.context.role, PERMISSIONS.pagos)) {
    return fail('No tienes permisos para registrar pagos.', 403);
  }

  let body: CreatePagoBody;
  try {
    body = await parseJsonBody<CreatePagoBody>(request);
  } catch (error) {
    return fail(error instanceof Error ? error.message : 'Body inválido.', 400);
  }

  if (!body.cliente_id) {
    return fail('cliente_id es obligatorio.', 400);
  }

  if (!Number.isFinite(body.monto) || body.monto < 0) {
    return fail('monto debe ser un número mayor o igual a 0.', 400);
  }

  let descuentoCanje = 0;
  let claimedCanjeId: string | null = null;
  let claimToken: string | null = null;
  let originalCanjeMetadata: Record<string, unknown> | null = null;
  let originalCanjeResueltoPor: string | null = null;
  let originalCanjeEntregadoEn: string | null = null;

  if (body.canje_id) {
    const canjeResp = await authCtx.client.database
      .from(gymTable('comunidad_canjes'))
      .select('id, cliente_id, estado, credito_monto, premio_id, metadata, resuelto_por, entregado_en')
      .eq('gimnasio_id', authCtx.context.gimnasioId)
      .eq('id', body.canje_id)
      .single();

    if (canjeResp.error || !canjeResp.data) {
      return fail(`Canje inválido: ${canjeResp.error?.message ?? 'not found'}`, 400);
    }

    if (canjeResp.data.cliente_id !== body.cliente_id) {
      return fail('El canje no pertenece al cliente del pago.', 400);
    }

    const canjeMetadata =
      canjeResp.data.metadata && typeof canjeResp.data.metadata === 'object'
        ? (canjeResp.data.metadata as Record<string, unknown>)
        : {};
    const existingPaymentId =
      typeof canjeMetadata.pago_id === 'string' && canjeMetadata.pago_id.trim()
        ? canjeMetadata.pago_id
        : null;

    if (canjeResp.data.estado === 'entregado' && existingPaymentId) {
      return fail(
        'El canje ya fue aplicado a un pago.',
        409,
        'canje_already_applied',
        { canje_id: body.canje_id, pago_id: existingPaymentId }
      );
    }

    if (canjeResp.data.estado !== 'aprobado') {
      return fail(
        'Solo se pueden aplicar canjes aprobados.',
        400,
        'invalid_canje_state',
        { canje_id: body.canje_id, estado: canjeResp.data.estado }
      );
    }

    const premioResp = await authCtx.client.database
      .from(gymTable('comunidad_premios_catalogo'))
      .select('id, tipo')
      .eq('gimnasio_id', authCtx.context.gimnasioId)
      .eq('id', canjeResp.data.premio_id)
      .single();

    if (premioResp.error || !premioResp.data) {
      return fail(`No se pudo validar premio de canje: ${premioResp.error?.message ?? 'unknown error'}`, 400);
    }

    if (premioResp.data.tipo !== 'descuento_pago') {
      return fail('El canje seleccionado no aplica descuento monetario.', 400);
    }

    descuentoCanje = Number(canjeResp.data.credito_monto ?? 0);
    if (!Number.isFinite(descuentoCanje) || descuentoCanje <= 0) {
      return fail('El canje no tiene crédito monetario aplicable.', 400);
    }

    claimToken = randomUUID();
    originalCanjeMetadata = canjeMetadata;
    originalCanjeResueltoPor = canjeResp.data.resuelto_por ?? null;
    originalCanjeEntregadoEn = canjeResp.data.entregado_en ?? null;

    const claimCanje = await authCtx.client.database
      .from(gymTable('comunidad_canjes'))
      .update({
        estado: 'entregado',
        resuelto_por: authCtx.authUserId,
        entregado_en: new Date().toISOString(),
        metadata: {
          ...canjeMetadata,
          claim_token: claimToken,
          claim_at: new Date().toISOString(),
          descuento_aplicado: descuentoCanje,
        },
      })
      .eq('gimnasio_id', authCtx.context.gimnasioId)
      .eq('id', body.canje_id)
      .eq('estado', 'aprobado')
      .select('id')
      .maybeSingle();

    if (claimCanje.error) {
      return fail(`No se pudo bloquear canje para aplicar pago: ${claimCanje.error.message}`, 500, 'canje_claim_failed');
    }

    if (!claimCanje.data) {
      const currentCanje = await authCtx.client.database
        .from(gymTable('comunidad_canjes'))
        .select('estado, metadata')
        .eq('gimnasio_id', authCtx.context.gimnasioId)
        .eq('id', body.canje_id)
        .maybeSingle();

      if (currentCanje.error) {
        return fail(
          `No se pudo validar estado de canje concurrente: ${currentCanje.error.message}`,
          500,
          'canje_claim_failed'
        );
      }

      const currentMetadata =
        currentCanje.data?.metadata && typeof currentCanje.data.metadata === 'object'
          ? (currentCanje.data.metadata as Record<string, unknown>)
          : {};
      const currentPaymentId =
        typeof currentMetadata.pago_id === 'string' && currentMetadata.pago_id.trim()
          ? currentMetadata.pago_id
          : null;

      if (currentCanje.data?.estado === 'entregado' && currentPaymentId) {
        return fail(
          'El canje ya fue aplicado a un pago.',
          409,
          'canje_already_applied',
          { canje_id: body.canje_id, pago_id: currentPaymentId }
        );
      }

      return fail(
        'El canje ya no está disponible para aplicar (operación concurrente).',
        409,
        'canje_conflict',
        { canje_id: body.canje_id, estado: currentCanje.data?.estado ?? 'unknown' }
      );
    }

    claimedCanjeId = body.canje_id;
  }

  const montoFinal = Math.max(Number((body.monto - descuentoCanje).toFixed(2)), 0);

  const payload = {
    gimnasio_id: authCtx.context.gimnasioId,
    cliente_id: body.cliente_id,
    membresia_id: body.membresia_id ?? null,
    monto: montoFinal,
    moneda: body.moneda ?? 'UYU',
    estado: body.estado ?? 'registrado',
    metodo: body.metodo?.trim() || 'manual',
    referencia: body.referencia?.trim() || null,
    fecha_pago: body.fecha_pago ?? new Date().toISOString(),
    registrado_por: authCtx.authUserId,
    notas: (body.notas?.trim() || descuentoCanje > 0)
      ? [body.notas?.trim(), descuentoCanje > 0 ? `Canje aplicado: -${descuentoCanje} UYU` : null]
          .filter(Boolean)
          .join(' | ')
      : null,
  };

  const { data, error } = await authCtx.client.database
    .from(gymTable('pagos'))
    .insert([payload])
    .select('*')
    .single();

  if (error || !data) {
    if (claimedCanjeId) {
      const rollbackCanje = await authCtx.client.database
        .from(gymTable('comunidad_canjes'))
        .update({
          estado: 'aprobado',
          resuelto_por: originalCanjeResueltoPor,
          entregado_en: originalCanjeEntregadoEn,
          metadata: originalCanjeMetadata ?? {},
        })
        .eq('gimnasio_id', authCtx.context.gimnasioId)
        .eq('id', claimedCanjeId)
        .eq('estado', 'entregado');

      if (rollbackCanje.error) {
        return fail(
          `No se pudo registrar pago y tampoco revertir canje: ${rollbackCanje.error.message}`,
          500,
          'canje_rollback_failed',
          { canje_id: claimedCanjeId }
        );
      }
    }

    return fail(`No se pudo registrar pago: ${error?.message ?? 'unknown error'}`, 500);
  }

  if (body.canje_id && descuentoCanje > 0) {
    const finalMetadata: Record<string, unknown> = {
      ...(originalCanjeMetadata ?? {}),
      claim_token: claimToken,
      descuento_aplicado: descuentoCanje,
      pago_id: data.id,
      pago_estado: data.estado,
      aplicado_en: new Date().toISOString(),
    };

    const updateCanje = await authCtx.client.database
      .from(gymTable('comunidad_canjes'))
      .update({
        estado: 'entregado',
        resuelto_por: authCtx.authUserId,
        entregado_en: new Date().toISOString(),
        metadata: finalMetadata,
      })
      .eq('gimnasio_id', authCtx.context.gimnasioId)
      .eq('id', body.canje_id)
      .eq('estado', 'entregado');

    if (updateCanje.error) {
      return fail(`Pago registrado pero falló actualizar canje: ${updateCanje.error.message}`, 500);
    }
  }

  return ok(data, { status: 201 });
}
