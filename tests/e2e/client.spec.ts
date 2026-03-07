import { expect, test } from '@playwright/test';
import {
  applyCookieHeader,
  clientCookie,
  hasClientCookie,
  hasStaffCookie,
  localDateTime,
  staffCookie,
} from './helpers';

type JsonResponse<T> = {
  data: T;
};

const seedEnabled = process.env.E2E_SEED_ENABLED === 'true';

test.describe('Cliente portal critical flows', () => {
  test.skip(!seedEnabled && !hasClientCookie, 'Define E2E_CLIENT_COOKIE para ejecutar portal cliente.');

  test.beforeAll(() => {
    if (seedEnabled && !hasClientCookie) {
      throw new Error('E2E_SEED_ENABLED=true exige clientCookie efectivo. Revisa global-setup y credenciales E2E.');
    }
    if (seedEnabled && !hasStaffCookie) {
      throw new Error('E2E_SEED_ENABLED=true exige staffCookie para preparar datos B3/B2 en cliente.spec.');
    }
  });

  test.beforeEach(async ({ context }) => {
    await applyCookieHeader(context, clientCookie);
  });

  test('ruta /cliente carga bloques operativos sin dead UI', async ({ page }) => {
    await page.goto('/cliente');

    await expect(page.locator('body')).not.toContainText('Debes iniciar sesión');
    await expect(page.getByTestId('cliente-select-premio')).toBeVisible();
    await expect(page.getByTestId('cliente-request-canje')).toBeVisible();
    await expect(page.getByTestId('cliente-save-seguimiento')).toBeVisible();
  });

  test('flujo cliente B3/B2: reservar/cancelar + canje + consentimiento/seguimiento', async ({ page, request }) => {
    test.skip(!seedEnabled && !hasStaffCookie, 'Este flujo requiere E2E_STAFF_COOKIE para preparar datos B3/B2.');

    const meResp = await request.get('/api/gymcrm/me', {
      headers: { cookie: clientCookie },
    });
    expect(meResp.ok(), 'No se pudo resolver /api/gymcrm/me con cookie cliente').toBeTruthy();

    const mePayload = (await meResp.json()) as JsonResponse<{
      cliente: {
        id: string;
      } | null;
    }>;

    const clienteId = mePayload?.data?.cliente?.id;
    expect(clienteId, 'No se obtuvo cliente_id desde /api/gymcrm/me').toBeTruthy();

    const seed = Date.now();

    const serviceResp = await request.post('/api/gymcrm/builder/servicios', {
      headers: { cookie: staffCookie },
      data: {
        nombre: `Servicio Cliente QA ${seed}`,
        slug: `servicio-cliente-qa-${seed}`,
        plantilla: 'clase_grupal',
        estado: 'publicado',
      },
    });
    expect(serviceResp.ok(), 'No se pudo crear servicio dinámico para cliente').toBeTruthy();
    const servicePayload = (await serviceResp.json()) as JsonResponse<{ servicio: { id: string } }>;
    const servicioId = servicePayload?.data?.servicio?.id;
    expect(servicioId).toBeTruthy();

    const start = new Date(Date.now() + 2 * 60 * 60 * 1000);
    const end = new Date(start.getTime() + 60 * 60 * 1000);

    const sessionResp = await request.post('/api/gymcrm/builder/sesiones', {
      headers: { cookie: staffCookie },
      data: {
        servicio_id: servicioId,
        titulo: `Sesion Cliente QA ${seed}`,
        inicio: new Date(localDateTime(start)).toISOString(),
        fin: new Date(localDateTime(end)).toISOString(),
        cupo_total: 2,
      },
    });
    expect(sessionResp.ok(), 'No se pudo crear sesión dinámica para cliente').toBeTruthy();
    const sessionPayload = (await sessionResp.json()) as JsonResponse<{ id: string }>;
    const sesionId = sessionPayload?.data?.id;
    expect(sesionId).toBeTruthy();

    const premioResp = await request.post('/api/gymcrm/comunidad/premios', {
      headers: { cookie: staffCookie },
      data: {
        nombre: `Premio Cliente QA ${seed}`,
        tipo: 'descuento_pago',
        costo_puntos: 40,
        monto_descuento: 80,
        stock_total: 20,
      },
    });
    expect(premioResp.ok(), 'No se pudo crear premio para canje cliente').toBeTruthy();
    const premioPayload = (await premioResp.json()) as JsonResponse<{ id: string }>;
    const premioId = premioPayload?.data?.id;
    expect(premioId).toBeTruthy();

    const pointsResp = await request.post('/api/gymcrm/comunidad/puntos', {
      headers: { cookie: staffCookie },
      data: {
        cliente_id: clienteId,
        puntos: 120,
        motivo: `Seed puntos cliente ${seed}`,
        origen_tipo: 'manual',
      },
    });
    expect(pointsResp.ok(), 'No se pudo asignar puntos para canje cliente').toBeTruthy();

    await page.goto('/cliente');

    const reserveBtn = page.getByTestId(`cliente-reservar-sesion-${sesionId}`);
    await expect(reserveBtn).toBeVisible();

    const reserveResponse = page.waitForResponse(
      (resp) => resp.url().includes('/api/gymcrm/builder/reservas') && resp.request().method() === 'POST'
    );
    await reserveBtn.click();
    const reserveApiResp = await reserveResponse;
    expect(reserveApiResp.ok(), 'Reserva dinámica cliente debe responder OK').toBeTruthy();

    const reservePayload = (await reserveApiResp.json()) as JsonResponse<{ id: string }>;
    const reservaId = reservePayload?.data?.id;
    expect(reservaId).toBeTruthy();

    let cancelBtn = page.getByTestId(`cliente-cancelar-reserva-${reservaId}`);
    let cancelVisible = await cancelBtn.isVisible({ timeout: 3000 }).catch(() => false);

    if (!cancelVisible) {
      await page.reload();
      cancelBtn = page.getByTestId(`cliente-cancelar-reserva-${reservaId}`);
      cancelVisible = await cancelBtn.isVisible({ timeout: 5000 }).catch(() => false);
    }

    if (!cancelVisible) {
      cancelBtn = page.locator('[data-testid^="cliente-cancelar-reserva-"]').first();
    }

    await expect(cancelBtn).toBeVisible();

    const cancelResponse = page.waitForResponse(
      (resp) => resp.url().includes('/api/gymcrm/builder/reservas/') && resp.request().method() === 'PATCH'
    );
    await cancelBtn.click();
    expect((await cancelResponse).ok(), 'Cancelación dinámica cliente debe responder OK').toBeTruthy();

    await page.getByTestId('cliente-select-premio').selectOption(premioId as string);
    const canjeResponse = page.waitForResponse(
      (resp) => resp.url().includes('/api/gymcrm/comunidad/canjes') && resp.request().method() === 'POST'
    );
    await page.getByTestId('cliente-request-canje').click();
    expect((await canjeResponse).ok(), 'Solicitud de canje cliente debe responder OK').toBeTruthy();

    const consentButton = page.getByTestId('cliente-accept-consent');
    if (await consentButton.count()) {
      const consentResponse = page.waitForResponse(
        (resp) => resp.url().includes('/api/gymcrm/nutricion/consentimientos') && resp.request().method() === 'POST'
      );
      await consentButton.click();
      expect((await consentResponse).ok(), 'Consentimiento cliente debe responder OK').toBeTruthy();
    }

    const medResponse = page.waitForResponse(
      (resp) => resp.url().includes('/api/gymcrm/nutricion/mediciones') && resp.request().method() === 'POST'
    );
    await page.getByTestId('cliente-save-seguimiento').click();
    expect((await medResponse).ok(), 'Seguimiento nutricional cliente debe responder OK').toBeTruthy();
  });
});
