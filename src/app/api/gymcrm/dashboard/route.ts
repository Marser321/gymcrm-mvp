import { ok, fail } from '@/lib/gymcrm/api';
import { calculateRetentionRate } from '@/lib/gymcrm/domain';
import { getAuthContext, gymTable } from '@/lib/gymcrm/server';

const getMonthBounds = (reference: Date) => {
  const start = new Date(Date.UTC(reference.getUTCFullYear(), reference.getUTCMonth(), 1));
  const end = new Date(Date.UTC(reference.getUTCFullYear(), reference.getUTCMonth() + 1, 0));
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
    nowIso: reference.toISOString(),
  };
};

export async function GET() {
  const authCtx = await getAuthContext();
  if (!authCtx.ok) {
    return authCtx.response;
  }

  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const { start, end } = getMonthBounds(now);

  const [
    clientesActivos,
    membresiasActivas,
    pagosMes,
    reservasHoy,
    recentClientes,
    upcomingSchedules,
    activeAtStart,
    activeAtEnd,
    dynamicReservationsMonth,
    canjesMonth,
    puntosRetoMonth,
    adherenciaMonth,
  ] = await Promise.all([
    authCtx.client.database
      .from(gymTable('clientes'))
      .select('id', { count: 'exact', head: true })
      .eq('gimnasio_id', authCtx.context.gimnasioId)
      .eq('estado', 'activo'),
    authCtx.client.database
      .from(gymTable('membresias'))
      .select('id', { count: 'exact', head: true })
      .eq('gimnasio_id', authCtx.context.gimnasioId)
      .eq('estado', 'activa')
      .lte('fecha_inicio', today)
      .gte('fecha_fin', today),
    authCtx.client.database
      .from(gymTable('pagos'))
      .select('monto')
      .eq('gimnasio_id', authCtx.context.gimnasioId)
      .eq('estado', 'registrado')
      .gte('fecha_pago', `${start}T00:00:00.000Z`)
      .lte('fecha_pago', `${end}T23:59:59.999Z`),
    authCtx.client.database
      .from(gymTable('reservas_clases'))
      .select('id', { count: 'exact', head: true })
      .eq('gimnasio_id', authCtx.context.gimnasioId)
      .in('estado', ['confirmada', 'asistio'])
      .gte('created_at', `${today}T00:00:00.000Z`)
      .lte('created_at', `${today}T23:59:59.999Z`),
    authCtx.client.database
      .from(gymTable('clientes'))
      .select('id, nombres, apellidos, email, estado, created_at, codigo_qr')
      .eq('gimnasio_id', authCtx.context.gimnasioId)
      .order('created_at', { ascending: false })
      .limit(5),
    authCtx.client.database
      .from(gymTable('clases_horarios'))
      .select('id, clase_base_id, inicio, fin, estado, cupo_total')
      .eq('gimnasio_id', authCtx.context.gimnasioId)
      .eq('estado', 'programada')
      .gte('inicio', now.toISOString())
      .order('inicio', { ascending: true })
      .limit(5),
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
    authCtx.client.database
      .from(gymTable('builder_reservas'))
      .select('cliente_id, estado')
      .eq('gimnasio_id', authCtx.context.gimnasioId)
      .gte('created_at', `${start}T00:00:00.000Z`)
      .lte('created_at', `${end}T23:59:59.999Z`)
      .in('estado', ['confirmada', 'asistio']),
    authCtx.client.database
      .from(gymTable('comunidad_canjes'))
      .select('estado')
      .eq('gimnasio_id', authCtx.context.gimnasioId)
      .gte('created_at', `${start}T00:00:00.000Z`)
      .lte('created_at', `${end}T23:59:59.999Z`),
    authCtx.client.database
      .from(gymTable('comunidad_puntos_movimientos'))
      .select('cliente_id, reto_id, origen_tipo')
      .eq('gimnasio_id', authCtx.context.gimnasioId)
      .gte('created_at', `${start}T00:00:00.000Z`)
      .lte('created_at', `${end}T23:59:59.999Z`),
    authCtx.client.database
      .from(gymTable('nutricion_mediciones'))
      .select('adherencia_pct')
      .eq('gimnasio_id', authCtx.context.gimnasioId)
      .gte('created_at', `${start}T00:00:00.000Z`)
      .lte('created_at', `${end}T23:59:59.999Z`),
  ]);

  const requiredErrors = [
    clientesActivos.error,
    membresiasActivas.error,
    pagosMes.error,
    reservasHoy.error,
    recentClientes.error,
    upcomingSchedules.error,
    activeAtStart.error,
    activeAtEnd.error,
  ].filter(Boolean);

  if (requiredErrors.length > 0) {
    return fail(`No se pudo cargar el dashboard: ${requiredErrors[0]?.message ?? 'unknown error'}`, 500);
  }

  const isMissingTableError = (error: { message?: string } | null | undefined) =>
    Boolean(error?.message && /relation .* does not exist/i.test(error.message));

  const optionalErrors = [
    dynamicReservationsMonth.error,
    canjesMonth.error,
    puntosRetoMonth.error,
    adherenciaMonth.error,
  ].filter(Boolean);

  const optionalHardError = optionalErrors.find((error) => !isMissingTableError(error));
  if (optionalHardError) {
    return fail(`No se pudo cargar métricas avanzadas: ${optionalHardError.message ?? 'unknown error'}`, 500);
  }

  const dynamicReservationsData = isMissingTableError(dynamicReservationsMonth.error)
    ? []
    : dynamicReservationsMonth.data ?? [];
  const canjesData = isMissingTableError(canjesMonth.error) ? [] : canjesMonth.data ?? [];
  const puntosRetoData = isMissingTableError(puntosRetoMonth.error) ? [] : puntosRetoMonth.data ?? [];
  const adherenciaData = isMissingTableError(adherenciaMonth.error) ? [] : adherenciaMonth.data ?? [];

  const totalPagosMes = (pagosMes.data ?? []).reduce((sum, row) => sum + Number(row.monto ?? 0), 0);
  const retencionMensual = calculateRetentionRate(activeAtStart.count ?? 0, activeAtEnd.count ?? 0);
  const dynamicParticipants = new Set(dynamicReservationsData.map((row) => row.cliente_id)).size;
  const adopcionServiciosDinamicos =
    (clientesActivos.count ?? 0) > 0
      ? Number(((dynamicParticipants / (clientesActivos.count ?? 0)) * 100).toFixed(2))
      : 0;

  const canjesSolicitados = canjesData.filter((row) => row.estado === 'solicitado').length;
  const canjesResueltos = canjesData.filter((row) => row.estado === 'entregado').length;
  const tasaCanje =
    canjesSolicitados > 0 ? Number(((canjesResueltos / canjesSolicitados) * 100).toFixed(2)) : 0;

  const retoParticipants = new Set(
    puntosRetoData
      .filter((row) => row.reto_id !== null || row.origen_tipo === 'reto')
      .map((row) => row.cliente_id)
  ).size;
  const participacionRetos =
    (clientesActivos.count ?? 0) > 0
      ? Number(((retoParticipants / (clientesActivos.count ?? 0)) * 100).toFixed(2))
      : 0;

  const adherenciaValores = adherenciaData
    .map((row) => Number(row.adherencia_pct))
    .filter((value) => Number.isFinite(value));
  const adherenciaNutricional =
    adherenciaValores.length > 0
      ? Number(
          (
            adherenciaValores.reduce((sum, value) => sum + value, 0) /
            adherenciaValores.length
          ).toFixed(2)
        )
      : 0;

  return ok({
    kpis: {
      totalClientesActivos: clientesActivos.count ?? 0,
      membresiasActivas: membresiasActivas.count ?? 0,
      pagosMes: Number(totalPagosMes.toFixed(2)),
      retencionMensual,
      reservasConfirmadasHoy: reservasHoy.count ?? 0,
      adopcionServiciosDinamicos,
      tasaCanje,
      participacionRetos,
      adherenciaNutricional,
    },
    recientes: {
      clientes: recentClientes.data ?? [],
      horarios: upcomingSchedules.data ?? [],
    },
  });
}
