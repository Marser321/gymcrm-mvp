#!/usr/bin/env node
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const loadEnvFiles = () => {
  const candidates = ['.env.local', '.env'];
  for (const file of candidates) {
    try {
      process.loadEnvFile(file);
    } catch {
      // Ignore missing/unreadable env files; explicit process.env still applies.
    }
  }
};

loadEnvFiles();

const baseUrl = process.env.SMOKE_BASE_URL || 'http://localhost:3000';
const smokeUseSeed = process.env.SMOKE_USE_SEED === 'true';
const smokeSeedOutput = resolve(process.cwd(), process.env.SMOKE_SEED_OUTPUT || '.playwright-artifacts/e2e-seed.json');

const readSeedOutput = () => {
  if (!smokeUseSeed) return {};
  try {
    const raw = readFileSync(smokeSeedOutput, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return {};
  }
};

const seedOutput = readSeedOutput();

const staffCookie = process.env.SMOKE_STAFF_COOKIE || seedOutput.staffCookie || '';
const clientCookie = process.env.SMOKE_CLIENT_COOKIE || seedOutput.clientCookie || '';
const clientPrimary = process.env.SMOKE_CLIENT_ID_PRIMARY || process.env.SMOKE_CLIENT_ID || seedOutput.clientId || '';
const clientSecondary = process.env.SMOKE_CLIENT_ID_SECONDARY || '';

if (!staffCookie) {
  console.error(
    smokeUseSeed
      ? `Missing SMOKE_STAFF_COOKIE (env) and seed staffCookie in ${smokeSeedOutput}`
      : 'Missing SMOKE_STAFF_COOKIE'
  );
  process.exit(2);
}

if (!clientPrimary) {
  console.error(
    smokeUseSeed
      ? `Missing SMOKE_CLIENT_ID_PRIMARY/SMOKE_CLIENT_ID (env) and seed clientId in ${smokeSeedOutput}`
      : 'Missing SMOKE_CLIENT_ID_PRIMARY or SMOKE_CLIENT_ID'
  );
  process.exit(2);
}

const headersFor = (cookie = '') => {
  const headers = {
    'Content-Type': 'application/json',
  };
  if (cookie) headers.cookie = cookie;
  return headers;
};

const requestJson = async ({ method = 'GET', path, cookie = '', body }) => {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: headersFor(cookie),
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  let payload = {};
  try {
    payload = await response.json();
  } catch {
    payload = {};
  }

  return {
    ok: response.ok,
    status: response.status,
    payload,
  };
};

const expectOk = async (name, promise) => {
  const result = await promise;
  if (!result.ok) {
    const message = result.payload?.error?.message || JSON.stringify(result.payload);
    throw new Error(`${name} failed (${result.status}): ${message}`);
  }
  return result.payload;
};

const expectFail = async (name, promise) => {
  const result = await promise;
  if (result.ok) {
    throw new Error(`${name} was expected to fail but succeeded`);
  }
  return result.payload;
};

const checks = [];
const run = async (name, fn) => {
  try {
    await fn();
    checks.push({ name, status: 'PASS' });
    console.log(`PASS ${name}`);
  } catch (error) {
    checks.push({ name, status: 'FAIL', error: error instanceof Error ? error.message : String(error) });
    console.error(`FAIL ${name}`);
    console.error(error instanceof Error ? error.message : String(error));
  }
};

const state = {
  serviceId: '',
  sessionId: '',
  reservationAId: '',
  reservationBId: '',
  premioId: '',
  canjeId: '',
  planId: '',
  whatsappQueueId: '',
};

const runSmoke = async () => {
  await run('health', async () => {
    const payload = await expectOk(
      'health',
      requestJson({ method: 'GET', path: '/api/gymcrm/health', cookie: staffCookie })
    );

    if (!payload?.data?.healthy) {
      throw new Error('health did not return healthy=true');
    }
  });

  await run('builder.create_service', async () => {
    const timestamp = Date.now();
    const payload = await expectOk(
      'builder.create_service',
      requestJson({
        method: 'POST',
        path: '/api/gymcrm/builder/servicios',
        cookie: staffCookie,
        body: {
          slug: `smoke-servicio-${timestamp}`,
          nombre: `Smoke Servicio ${timestamp}`,
          plantilla: 'clase_grupal',
          estado: 'publicado',
        },
      })
    );

    state.serviceId = payload?.data?.servicio?.id || '';
    if (!state.serviceId) throw new Error('missing service id');
  });

  await run('builder.create_session', async () => {
    const now = new Date();
    const start = new Date(now.getTime() + 2 * 60 * 60 * 1000);
    const end = new Date(start.getTime() + 60 * 60 * 1000);

    const payload = await expectOk(
      'builder.create_session',
      requestJson({
        method: 'POST',
        path: '/api/gymcrm/builder/sesiones',
        cookie: staffCookie,
        body: {
          servicio_id: state.serviceId,
          titulo: 'Smoke Session',
          inicio: start.toISOString(),
          fin: end.toISOString(),
          cupo_total: 1,
        },
      })
    );

    state.sessionId = payload?.data?.id || '';
    if (!state.sessionId) throw new Error('missing session id');
  });

  await run('builder.reserve_confirmed_primary', async () => {
    const payload = await expectOk(
      'builder.reserve_confirmed_primary',
      requestJson({
        method: 'POST',
        path: '/api/gymcrm/builder/reservas',
        cookie: staffCookie,
        body: {
          sesion_id: state.sessionId,
          cliente_id: clientPrimary,
        },
      })
    );

    state.reservationAId = payload?.data?.id || '';
    const stateReservation = payload?.data?.estado;
    if (!state.reservationAId || !['confirmada', 'espera'].includes(stateReservation)) {
      throw new Error('invalid reservation A response');
    }
  });

  if (clientSecondary) {
    await run('builder.reserve_waitlist_secondary', async () => {
      const payload = await expectOk(
        'builder.reserve_waitlist_secondary',
        requestJson({
          method: 'POST',
          path: '/api/gymcrm/builder/reservas',
          cookie: staffCookie,
          body: {
            sesion_id: state.sessionId,
            cliente_id: clientSecondary,
          },
        })
      );

      state.reservationBId = payload?.data?.id || '';
      if (!state.reservationBId) throw new Error('missing reservation B id');
    });

    await run('builder.cancel_primary_and_promote_waitlist', async () => {
      await expectOk(
        'builder.cancel_primary',
        requestJson({
          method: 'PATCH',
          path: `/api/gymcrm/builder/reservas/${state.reservationAId}`,
          cookie: staffCookie,
          body: { estado: 'cancelada' },
        })
      );

      const list = await expectOk(
        'builder.list_reservations',
        requestJson({
          method: 'GET',
          path: `/api/gymcrm/builder/reservas?sesionId=${state.sessionId}&pageSize=20`,
          cookie: staffCookie,
        })
      );

      const reservations = list?.data || [];
      const secondary = reservations.find((item) => item.id === state.reservationBId);
      if (!secondary || secondary.estado !== 'confirmada') {
        throw new Error('waitlist secondary reservation was not promoted to confirmada');
      }
    });
  }

  await run('comunidad.create_premio_descuento', async () => {
    const payload = await expectOk(
      'comunidad.create_premio_descuento',
      requestJson({
        method: 'POST',
        path: '/api/gymcrm/comunidad/premios',
        cookie: staffCookie,
        body: {
          nombre: `Smoke Premio ${Date.now()}`,
          tipo: 'descuento_pago',
          costo_puntos: 100,
          monto_descuento: 100,
          stock_total: 50,
        },
      })
    );

    state.premioId = payload?.data?.id || '';
    if (!state.premioId) throw new Error('missing premio id');
  });

  await run('comunidad.assign_points_manual', async () => {
    await expectOk(
      'comunidad.assign_points_manual',
      requestJson({
        method: 'POST',
        path: '/api/gymcrm/comunidad/puntos',
        cookie: staffCookie,
        body: {
          cliente_id: clientPrimary,
          puntos: 250,
          motivo: 'Smoke points seed',
          origen_tipo: 'manual',
        },
      })
    );
  });

  await run('comunidad.request_canje', async () => {
    const cookie = clientCookie || staffCookie;
    const body = clientCookie
      ? { premio_id: state.premioId }
      : { premio_id: state.premioId, cliente_id: clientPrimary };

    const payload = await expectOk(
      'comunidad.request_canje',
      requestJson({
        method: 'POST',
        path: '/api/gymcrm/comunidad/canjes',
        cookie,
        body,
      })
    );

    state.canjeId = payload?.data?.id || '';
    if (!state.canjeId) throw new Error('missing canje id');
  });

  await run('comunidad.approve_canje', async () => {
    await expectOk(
      'comunidad.approve_canje',
      requestJson({
        method: 'PATCH',
        path: `/api/gymcrm/comunidad/canjes/${state.canjeId}`,
        cookie: staffCookie,
        body: { estado: 'aprobado' },
      })
    );
  });

  await run('pagos.apply_canje_discount', async () => {
    await expectOk(
      'pagos.apply_canje_discount',
      requestJson({
        method: 'POST',
        path: '/api/gymcrm/pagos',
        cookie: staffCookie,
        body: {
          cliente_id: clientPrimary,
          monto: 500,
          canje_id: state.canjeId,
          metodo: 'manual',
          notas: 'Smoke pago con canje',
        },
      })
    );
  });

  await run('pagos.prevent_double_apply_canje', async () => {
    const payload = await expectFail(
      'pagos.prevent_double_apply_canje',
      requestJson({
        method: 'POST',
        path: '/api/gymcrm/pagos',
        cookie: staffCookie,
        body: {
          cliente_id: clientPrimary,
          monto: 500,
          canje_id: state.canjeId,
          metodo: 'manual',
          notas: 'Smoke second apply should fail',
        },
      })
    );

    const code = payload?.error?.code;
    if (!['canje_already_applied', 'invalid_canje_state', 'canje_conflict'].includes(code)) {
      throw new Error(`unexpected error code for double apply: ${code || 'none'}`);
    }
  });

  await run('nutricion.register_consent', async () => {
    const payload = await expectOk(
      'nutricion.register_consent',
      requestJson({
        method: 'POST',
        path: '/api/gymcrm/nutricion/consentimientos',
        cookie: clientCookie || staffCookie,
        body: clientCookie
          ? {
              version_texto:
                process.env.SMOKE_CONSENT_TEXT ||
                'Acepto seguimiento nutricional no clínico en entorno de prueba smoke.',
              medio: 'app',
            }
          : {
              cliente_id: clientPrimary,
              version_texto:
                process.env.SMOKE_CONSENT_TEXT ||
                'Acepto seguimiento nutricional no clínico en entorno de prueba smoke.',
              medio: 'staff',
            },
      })
    );

    if (!payload?.data?.id) throw new Error('missing consentimiento id');
  });

  await run('nutricion.create_plan_activo', async () => {
    const payload = await expectOk(
      'nutricion.create_plan_activo',
      requestJson({
        method: 'POST',
        path: '/api/gymcrm/nutricion/planes',
        cookie: staffCookie,
        body: {
          cliente_id: clientPrimary,
          estado: 'activo',
          objetivo_general: 'Smoke objetivo',
          version_inicial: {
            contenido: {
              comidas: [],
              recomendaciones: ['Hidratarse', 'Cumplir horario'],
              habitos: [],
            },
            publicado: true,
          },
        },
      })
    );

    state.planId = payload?.data?.plan?.id || '';
    if (!state.planId) throw new Error('missing plan id');
  });

  await run('nutricion.create_medicion', async () => {
    await expectOk(
      'nutricion.create_medicion',
      requestJson({
        method: 'POST',
        path: '/api/gymcrm/nutricion/mediciones',
        cookie: clientCookie || staffCookie,
        body: clientCookie
          ? {
              plan_id: state.planId,
              adherencia_pct: 80,
              notas: 'Smoke adherencia',
            }
          : {
              cliente_id: clientPrimary,
              plan_id: state.planId,
              adherencia_pct: 80,
              notas: 'Smoke adherencia',
            },
      })
    );
  });

  await run('whatsapp.enqueue_notification', async () => {
    const payload = await expectOk(
      'whatsapp.enqueue_notification',
      requestJson({
        method: 'POST',
        path: '/api/gymcrm/notificaciones/whatsapp',
        cookie: staffCookie,
        body: {
          to: process.env.SMOKE_WHATSAPP_TO || '+59800000000',
          message: `Smoke test ${new Date().toISOString()}`,
        },
      })
    );

    state.whatsappQueueId = payload?.data?.notification?.id || '';
    if (!state.whatsappQueueId) throw new Error('missing whatsapp queue id');
  });

  await run('whatsapp.process_queue', async () => {
    const payload = await expectOk(
      'whatsapp.process_queue',
      requestJson({
        method: 'PUT',
        path: '/api/gymcrm/notificaciones/whatsapp',
        cookie: staffCookie,
      })
    );

    const processed = payload?.data?.processed || [];
    if (!Array.isArray(processed)) {
      throw new Error('invalid processed payload');
    }
  });

  const failed = checks.filter((item) => item.status === 'FAIL');
  const reportPath = process.env.SMOKE_REPORT_PATH;
  const summary = {
    generatedAt: new Date().toISOString(),
    baseUrl,
    totals: {
      total: checks.length,
      passed: checks.length - failed.length,
      failed: failed.length,
    },
    checks,
  };

  console.log('\n=== Smoke Summary ===');
  for (const item of checks) {
    if (item.status === 'PASS') {
      console.log(`PASS ${item.name}`);
    } else {
      console.log(`FAIL ${item.name} -> ${item.error}`);
    }
  }

  console.log(`\nResult: ${checks.length - failed.length} PASS / ${failed.length} FAIL`);
  if (reportPath) {
    const absolute = resolve(process.cwd(), reportPath);
    mkdirSync(dirname(absolute), { recursive: true });
    writeFileSync(absolute, JSON.stringify(summary, null, 2), 'utf-8');
    console.log(`Smoke JSON report: ${absolute}`);
  }
  process.exit(failed.length > 0 ? 1 : 0);
};

runSmoke().catch((error) => {
  console.error('Unhandled smoke error:', error instanceof Error ? error.message : String(error));
  process.exit(1);
});
