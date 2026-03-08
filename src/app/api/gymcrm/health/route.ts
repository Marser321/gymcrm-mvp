import { fail, ok } from '@/lib/gymcrm/api';
import { getAuthContext, gymTable } from '@/lib/gymcrm/server';

type CheckResult = {
  key: string;
  ok: boolean;
  detail?: string;
};

const probeTable = async (
  authCtx: Extract<Awaited<ReturnType<typeof getAuthContext>>, { ok: true }>,
  table: string
): Promise<CheckResult> => {
  const { error } = await authCtx.client.database.from(gymTable(table)).select('id').limit(1);
  return {
    key: `table:${table}`,
    ok: !error,
    detail: error?.message,
  };
};

export async function GET() {
  const authCtx = await getAuthContext();
  if (!authCtx.ok) return authCtx.response;

  const checks: CheckResult[] = [];

  const tableChecks = await Promise.all([
    probeTable(authCtx, 'usuarios_roles'),
    probeTable(authCtx, 'clientes'),
    probeTable(authCtx, 'membresias'),
    probeTable(authCtx, 'pagos'),
    probeTable(authCtx, 'builder_servicios'),
    probeTable(authCtx, 'builder_sesiones'),
    probeTable(authCtx, 'builder_reservas'),
    probeTable(authCtx, 'comunidad_premios_catalogo'),
    probeTable(authCtx, 'comunidad_canjes'),
    probeTable(authCtx, 'nutricion_consentimientos'),
    probeTable(authCtx, 'nutricion_planes'),
    probeTable(authCtx, 'nutricion_mediciones'),
    probeTable(authCtx, 'notificaciones_whatsapp_queue'),
    probeTable(authCtx, 'ui_preferencias'),
    probeTable(authCtx, 'ui_onboarding_estado'),
  ]);

  checks.push(...tableChecks);

  const retention = await authCtx.client.database.rpc('gymcrm_retencion_mensual', {
    p_gimnasio_id: authCtx.context.gimnasioId,
  });

  checks.push({
    key: 'rpc:gymcrm_retencion_mensual',
    ok: !retention.error,
    detail: retention.error?.message,
  });

  const dummyUuid = '00000000-0000-0000-0000-000000000000';
  const promote = await authCtx.client.database.rpc('gymcrm_promover_lista_espera_builder', {
    p_sesion_id: dummyUuid,
  });

  checks.push({
    key: 'rpc:gymcrm_promover_lista_espera_builder',
    ok: !promote.error,
    detail: promote.error?.message,
  });

  const failed = checks.filter((check) => !check.ok);
  if (failed.length > 0) {
    return fail('Faltan objetos de GymCRM en backend. Aplica migraciones pendientes.', 503, 'health_failed', {
      failed,
      appliedChecks: checks.length,
    });
  }

  return ok({
    healthy: true,
    checks,
    gymId: authCtx.context.gimnasioId,
  });
}
