import { fail, ok } from '@/lib/gymcrm/api';
import { getAuthContext, gymTable } from '@/lib/gymcrm/server';

const toMonthBounds = (monthParam: string | null) => {
  const reference = monthParam ? new Date(`${monthParam}-01T00:00:00.000Z`) : new Date();
  if (Number.isNaN(reference.getTime())) {
    return null;
  }

  const start = new Date(Date.UTC(reference.getUTCFullYear(), reference.getUTCMonth(), 1));
  const end = new Date(Date.UTC(reference.getUTCFullYear(), reference.getUTCMonth() + 1, 0, 23, 59, 59, 999));

  return {
    month: start.toISOString().slice(0, 7),
    start: start.toISOString(),
    end: end.toISOString(),
  };
};

export async function GET(request: Request) {
  const authCtx = await getAuthContext();
  if (!authCtx.ok) return authCtx.response;

  const url = new URL(request.url);
  const bounds = toMonthBounds(url.searchParams.get('month'));
  const limitRaw = Number(url.searchParams.get('limit') ?? '20');
  const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(Math.floor(limitRaw), 100) : 20;

  if (!bounds) {
    return fail('month inválido. Usa formato YYYY-MM.', 400);
  }

  const [movementsResp, clientsResp] = await Promise.all([
    authCtx.client.database
      .from(gymTable('comunidad_puntos_movimientos'))
      .select('cliente_id, puntos')
      .eq('gimnasio_id', authCtx.context.gimnasioId)
      .gte('created_at', bounds.start)
      .lte('created_at', bounds.end),
    authCtx.client.database
      .from(gymTable('clientes'))
      .select('id, nombres, apellidos')
      .eq('gimnasio_id', authCtx.context.gimnasioId),
  ]);

  if (movementsResp.error || clientsResp.error) {
    return fail(
      `No se pudo construir ranking: ${movementsResp.error?.message ?? clientsResp.error?.message ?? 'unknown error'}`,
      500
    );
  }

  const scoreByClient = new Map<string, number>();
  for (const movement of movementsResp.data ?? []) {
    const current = scoreByClient.get(movement.cliente_id) ?? 0;
    scoreByClient.set(movement.cliente_id, current + Number(movement.puntos ?? 0));
  }

  const nameByClient = new Map<string, string>();
  for (const client of clientsResp.data ?? []) {
    nameByClient.set(client.id, `${client.nombres} ${client.apellidos}`.trim());
  }

  const ranking = Array.from(scoreByClient.entries())
    .map(([clienteId, puntos]) => ({
      cliente_id: clienteId,
      nombre: nameByClient.get(clienteId) ?? 'Cliente',
      puntos,
    }))
    .sort((a, b) => b.puntos - a.puntos)
    .slice(0, limit)
    .map((item, index) => ({
      ...item,
      posicion: index + 1,
    }));

  return ok({
    month: bounds.month,
    ranking,
  });
}
