import { ok, fail } from '@/lib/gymcrm/api';
import { calculateRetentionRate } from '@/lib/gymcrm/domain';
import { getAuthContext, gymTable } from '@/lib/gymcrm/server';

const getMonthBounds = (reference: Date) => {
  const start = new Date(Date.UTC(reference.getUTCFullYear(), reference.getUTCMonth(), 1));
  const end = new Date(Date.UTC(reference.getUTCFullYear(), reference.getUTCMonth() + 1, 0));
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  };
};

export async function GET(request: Request) {
  const authCtx = await getAuthContext();
  if (!authCtx.ok) {
    return authCtx.response;
  }

  const url = new URL(request.url);
  const month = url.searchParams.get('month');
  const reference = month ? new Date(`${month}-01T00:00:00.000Z`) : new Date();

  if (Number.isNaN(reference.getTime())) {
    return fail('month inválido. Usa formato YYYY-MM.', 400);
  }

  const isoDate = reference.toISOString().slice(0, 10);

  const rpc = await authCtx.client.database.rpc('gymcrm_retencion_mensual', {
    p_gimnasio_id: authCtx.context.gimnasioId,
    p_referencia: isoDate,
  });

  if (!rpc.error && typeof rpc.data === 'number') {
    return ok({
      month: isoDate.slice(0, 7),
      retencion: Number(rpc.data.toFixed(2)),
      source: 'rpc',
    });
  }

  const { start, end } = getMonthBounds(reference);

  const [{ count: activeAtStart, error: startError }, { count: activeAtEnd, error: endError }] = await Promise.all([
    authCtx.client.database
      .from(gymTable('membresias'))
      .select('id', { count: 'exact', head: true })
      .eq('gimnasio_id', authCtx.context.gimnasioId)
      .lte('fecha_inicio', start)
      .gte('fecha_fin', start)
      .in('estado', ['activa', 'vencida', 'suspendida']),
    authCtx.client.database
      .from(gymTable('membresias'))
      .select('id', { count: 'exact', head: true })
      .eq('gimnasio_id', authCtx.context.gimnasioId)
      .lte('fecha_inicio', end)
      .gte('fecha_fin', end)
      .in('estado', ['activa', 'vencida', 'suspendida']),
  ]);

  if (startError || endError) {
    return fail(
      `No se pudo calcular retención: ${startError?.message ?? endError?.message ?? 'unknown error'}`,
      500
    );
  }

  const retencion = calculateRetentionRate(activeAtStart ?? 0, activeAtEnd ?? 0);

  return ok({
    month: isoDate.slice(0, 7),
    retencion,
    source: 'fallback',
  });
}
