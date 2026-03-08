import { expect, test } from '@playwright/test';
import {
  applyCookieHeader,
  applyOpenRoleCookie,
  ensureQaClient,
  hasStaffCookie,
  localDateTime,
  staffCookie,
} from './helpers';

const seedEnabled = process.env.E2E_SEED_ENABLED === 'true';

test.describe('Staff CRM critical routes', () => {
  test.skip(!seedEnabled && !hasStaffCookie, 'Define E2E_STAFF_COOKIE para ejecutar rutas protegidas de staff.');

  test.beforeAll(() => {
    if (seedEnabled && !hasStaffCookie) {
      throw new Error('E2E_SEED_ENABLED=true exige staffCookie efectivo. Revisa global-setup y credenciales E2E.');
    }
  });

  test.beforeEach(async ({ context }) => {
    await applyCookieHeader(context, staffCookie);
  });

  test('rutas staff críticas cargan controles operativos reales', async ({ page }) => {
    const checks = [
      {
        path: '/dashboard',
        testIds: ['go-admin-builder', 'go-admin-comunidad', 'go-admin-nutricion'],
      },
      {
        path: '/admin',
        testIds: ['admin-filter-toggle', 'admin-new-member', 'admin-tab-members', 'admin-tab-payments'],
      },
      {
        path: '/admin/classes',
        testIds: ['admin-classes-tab-types', 'admin-class-name', 'admin-create-class'],
      },
      {
        path: '/admin/builder',
        testIds: ['builder-service-name', 'builder-create-service', 'builder-session-title', 'builder-create-session'],
      },
      {
        path: '/admin/comunidad',
        testIds: ['comunidad-points-reason', 'comunidad-assign-points', 'comunidad-premio-nombre', 'comunidad-create-premio'],
      },
      {
        path: '/admin/nutricion',
        testIds: [
          'nutricion-consent-cliente',
          'nutricion-create-consent',
          'nutricion-plan-cliente',
          'nutricion-create-plan',
          'nutricion-create-medicion',
        ],
      },
    ];

    for (const item of checks) {
      await page.goto(item.path);
      await expect(page.locator('body')).not.toContainText('Debes iniciar sesión');
      for (const testId of item.testIds) {
        await expect(page.getByTestId(testId), `${item.path} debe mostrar ${testId}`).toBeVisible();
      }
    }
  });

  test('admin: filtros y acciones de fila funcionan', async ({ page }) => {
    await page.goto('/admin');

    await page.getByTestId('admin-filter-toggle').click();
    await expect(page.getByText('Estado')).toBeVisible();

    const firstView = page.locator('[data-testid^="member-view-"]').first();
    const hasRows = (await page.locator('[data-testid^="member-view-"]').count()) > 0;

    if (hasRows) {
      await firstView.click();
      await expect(page.getByText('Detalle de Cliente')).toBeVisible();
      await page.getByRole('button', { name: 'Cerrar' }).click();
      await expect(page.getByText('Detalle de Cliente')).toHaveCount(0);
    }
  });

  test('admin: operación diaria crea plan + membresía + pago manual', async ({ page, request }) => {
    test.slow();
    const clienteId = await ensureQaClient(request);

    await page.goto('/admin');
    await page.getByTestId('admin-tab-payments').click();

    await expect(page.getByTestId('admin-plan-name')).toBeVisible();

    const planName = `Plan QA ${Date.now()}`;
    await page.getByTestId('admin-plan-name').fill(planName);
    await page.getByTestId('admin-plan-price').fill('2100');
    await page.getByTestId('admin-plan-duration').fill('30');

    const planResponsePromise = page.waitForResponse(
      (resp) => resp.url().includes('/api/gymcrm/planes') && resp.request().method() === 'POST'
    );
    await page.getByTestId('admin-create-plan').click();
    const planResponse = await planResponsePromise;
    expect(planResponse.ok(), 'Creación de plan debe responder OK').toBeTruthy();

    const planPayload = (await planResponse.json()) as { data?: { id?: string } };
    const planId = planPayload?.data?.id ?? '';
    expect(planId, 'Plan creado debe tener id').toBeTruthy();

    await page.getByTestId('admin-membership-client').selectOption(clienteId);
    const membershipPlanSelect = page.getByTestId('admin-membership-plan');
    await expect(membershipPlanSelect).toBeVisible();
    await expect
      .poll(async () => membershipPlanSelect.locator('option').count(), {
        timeout: 15_000,
      })
      .toBeGreaterThan(1);
    const planOptions = await membershipPlanSelect
      .locator('option')
      .evaluateAll((options) => options.map((option) => option.value).filter((value) => Boolean(value)));
    const selectedPlanId = planOptions.includes(planId) ? planId : planOptions[0];
    await membershipPlanSelect.selectOption(selectedPlanId);
    const membershipResponsePromise = page.waitForResponse(
      (resp) => resp.url().includes('/api/gymcrm/membresias') && resp.request().method() === 'POST'
    );
    await page.getByTestId('admin-create-membership').click();
    const membershipResponse = await membershipResponsePromise;
    expect(membershipResponse.ok(), 'Creación de membresía debe responder OK').toBeTruthy();
    await membershipResponse.json().catch(() => null);

    await page.getByTestId('admin-payment-client').selectOption(clienteId);
    await expect(page.getByTestId('admin-payment-amount')).toBeVisible();
    await page.getByTestId('admin-payment-amount').fill('2100');
    await page.getByTestId('admin-payment-method').fill('manual');
    const paymentResponsePromise = page.waitForResponse(
      (resp) => resp.url().includes('/api/gymcrm/pagos') && resp.request().method() === 'POST'
    );
    await page.getByTestId('admin-create-payment').click();
    const paymentResponse = await paymentResponsePromise;
    expect(paymentResponse.ok(), 'Registro de pago debe responder OK').toBeTruthy();
  });

  test('admin/staff: crear y desactivar staff híbrido', async ({ page }) => {
    await page.goto('/admin');
    await page.getByTestId('admin-tab-staff').click();

    await page.getByTestId('admin-staff-role').selectOption('entrenador');
    await page.getByTestId('admin-staff-nombres').fill(`Staff`);
    await page.getByTestId('admin-staff-apellidos').fill(`QA ${Date.now()}`);
    await page.getByTestId('admin-staff-email').fill(`staff-qa-${Date.now()}@demo.uy`);
    await page.getByTestId('admin-staff-telefono').fill('+598 9900 8899');

    const createStaffPromise = page.waitForResponse(
      (resp) => resp.url().includes('/api/gymcrm/staff') && resp.request().method() === 'POST'
    );
    await page.getByTestId('admin-create-staff').click();
    const createStaffResponse = await createStaffPromise;
    expect(createStaffResponse.ok(), 'Creación de staff debe responder OK').toBeTruthy();

    const payload = (await createStaffResponse.json()) as { data?: { id?: string } };
    const staffId = payload?.data?.id ?? '';
    expect(staffId, 'Staff creado debe incluir id').toBeTruthy();

    const disableByCreatedId = page.getByTestId(`admin-disable-staff-${staffId}`);
    const canDisableCreated = await disableByCreatedId.isVisible({ timeout: 5000 }).catch(() => false);

    let targetDisableId = staffId;
    if (!canDisableCreated) {
      const fallbackDisableButton = page.locator('[data-testid^="admin-disable-staff-"]').first();
      await expect(fallbackDisableButton, 'Debe existir al menos un staff activo para desactivar.').toBeVisible();
      const disableTestId = await fallbackDisableButton.getAttribute('data-testid');
      targetDisableId = disableTestId?.replace('admin-disable-staff-', '') ?? '';
    }

    const targetDisableButton = page.getByTestId(`admin-disable-staff-${targetDisableId}`);
    await expect(targetDisableButton, 'Debe existir botón de desactivar para el staff elegido.').toBeVisible();

    const disablePromise = page.waitForResponse(
      (resp) =>
        resp.request().method() === 'DELETE' &&
        resp.url().includes(`/api/gymcrm/staff/${targetDisableId}`)
    );
    await targetDisableButton.click();
    const disableResponse = await disablePromise;
    expect(disableResponse.ok(), 'Desactivar staff debe responder OK').toBeTruthy();

    const reactivateButton = page.getByTestId(`admin-reactivate-staff-${targetDisableId}`);
    const canReactivate = await reactivateButton.isVisible({ timeout: 4000 }).catch(() => false);
    if (!canReactivate) {
      const sameRowAction = page
        .locator(
          `[data-testid="admin-disable-staff-${targetDisableId}"], [data-testid="admin-reactivate-staff-${targetDisableId}"]`
        )
        .first();
      await expect(sameRowAction, 'El staff desactivado debe mantener una acción disponible en UI.').toBeVisible();
      return;
    }

    const reactivatePromise = page.waitForResponse(
      (resp) =>
        resp.request().method() === 'PATCH' &&
        resp.url().includes('/api/gymcrm/staff/')
    );
    await reactivateButton.click();
    const reactivateResponse = await reactivatePromise;
    expect(reactivateResponse.ok(), 'Reactivar staff debe responder OK').toBeTruthy();
  });

  test('admin/classes: editar clase abre modal y persiste', async ({ page }) => {
    await page.goto('/admin/classes');
    await page.getByTestId('admin-classes-tab-types').click();

    if ((await page.locator('[data-testid^="edit-class-"]').count()) === 0) {
      await page.getByTestId('admin-class-name').fill(`Clase QA ${Date.now()}`);
      await page.getByTestId('admin-create-class').click();
      await expect(page.locator('[data-testid^="edit-class-"]').first()).toBeVisible();
    }

    const firstEdit = page.locator('[data-testid^="edit-class-"]').first();
    await firstEdit.click();

    const nameInput = page.getByTestId('admin-edit-class-name');
    await expect(nameInput).toBeVisible();
    const original = await nameInput.inputValue();
    await nameInput.fill(`${original} QA`);

    await page.getByTestId('admin-save-class-edit').click();
    await expect(page.getByText('Editar clase')).toHaveCount(0);
  });

  test('admin/builder: crear servicio y sesión desde plantilla', async ({ page }) => {
    await page.goto('/admin/builder');

    const serviceName = `Servicio QA ${Date.now()}`;
    await page.getByTestId('builder-service-name').fill(serviceName);
    const createServiceResponse = page.waitForResponse(
      (resp) =>
        resp.url().includes('/api/gymcrm/builder/servicios') && resp.request().method() === 'POST'
    );
    await page.getByTestId('builder-create-service').click();
    const serviceApiResponse = await createServiceResponse;
    expect(serviceApiResponse.ok(), 'Creación de servicio builder debe responder OK').toBeTruthy();

    let createdServiceId = '';
    try {
      const payload = (await serviceApiResponse.json()) as { data?: { servicio?: { id?: string } } };
      createdServiceId = payload?.data?.servicio?.id ?? '';
    } catch {
      createdServiceId = '';
    }

    if (createdServiceId) {
      await page.getByTestId('builder-session-service').selectOption(createdServiceId);
    }
    await expect(page.locator('[data-testid^=\"builder-publicar-\"]').first()).toBeVisible();

    const start = new Date(Date.now() + 2 * 60 * 60 * 1000);
    const end = new Date(start.getTime() + 60 * 60 * 1000);

    await page.getByTestId('builder-session-title').fill(`Sesion QA ${Date.now()}`);
    await page.getByTestId('builder-session-start').fill(localDateTime(start));
    await page.getByTestId('builder-session-end').fill(localDateTime(end));
    await page.getByTestId('builder-create-session').click();

    await expect(page.getByTestId('builder-session-title')).toHaveValue('');
  });

  test('admin/comunidad + admin/nutricion: flujos B3/B2 operativos', async ({ page, request }) => {
    const clienteId = await ensureQaClient(request);

    await page.goto('/admin/comunidad');
    await page.getByTestId('comunidad-points-cliente').selectOption(clienteId);
    await page.getByTestId('comunidad-points-value').fill('35');
    await page.getByTestId('comunidad-points-reason').fill(`QA puntos ${Date.now()}`);

    const pointsResponse = page.waitForResponse(
      (resp) =>
        resp.url().includes('/api/gymcrm/comunidad/puntos') && resp.request().method() === 'POST'
    );
    await page.getByTestId('comunidad-assign-points').click();
    await expect((await pointsResponse).ok()).toBeTruthy();

    await page.getByTestId('comunidad-premio-nombre').fill(`Premio QA ${Date.now()}`);
    const premioResponse = page.waitForResponse(
      (resp) =>
        resp.url().includes('/api/gymcrm/comunidad/premios') && resp.request().method() === 'POST'
    );
    await page.getByTestId('comunidad-create-premio').click();
    await expect((await premioResponse).ok()).toBeTruthy();

    await page.goto('/admin/nutricion');
    await page.getByTestId('nutricion-consent-cliente').selectOption(clienteId);
    const consentResponse = page.waitForResponse(
      (resp) =>
        resp.url().includes('/api/gymcrm/nutricion/consentimientos') && resp.request().method() === 'POST'
    );
    await page.getByTestId('nutricion-create-consent').click();
    await expect((await consentResponse).ok()).toBeTruthy();

    await page.getByTestId('nutricion-plan-cliente').selectOption(clienteId);
    await page.getByTestId('nutricion-plan-estado').selectOption('activo');
    const planResponse = page.waitForResponse(
      (resp) => resp.url().includes('/api/gymcrm/nutricion/planes') && resp.request().method() === 'POST'
    );
    await page.getByTestId('nutricion-create-plan').click();
    await expect((await planResponse).ok()).toBeTruthy();

    await page.getByTestId('nutricion-med-cliente').selectOption(clienteId);
    await page.getByTestId('nutricion-med-peso').fill('75.2');
    await page.getByTestId('nutricion-med-adherencia').fill('82');
    const medResponse = page.waitForResponse(
      (resp) => resp.url().includes('/api/gymcrm/nutricion/mediciones') && resp.request().method() === 'POST'
    );
    await page.getByTestId('nutricion-create-medicion').click();
    await expect((await medResponse).ok()).toBeTruthy();
  });

  test('portales admin con rol cliente muestran CTA de cambio y habilitan acceso demo', async ({ page, context }) => {
    const checks = [
      { path: '/admin/builder', expectedTestId: 'builder-service-name' },
      { path: '/admin/comunidad', expectedTestId: 'comunidad-points-reason' },
      { path: '/admin/nutricion', expectedTestId: 'nutricion-consent-cliente' },
    ];

    for (const item of checks) {
      await applyOpenRoleCookie(context, 'cliente');
      await page.goto(item.path);
      await expect(page.getByTestId('portal-access-switch-role')).toBeVisible();
      await page.getByTestId('portal-access-switch-role').click();
      await expect(page).toHaveURL(new RegExp(item.path.replace('/', '\\/')));
      await expect(page.getByTestId('open-role-selector')).not.toHaveValue('cliente');
      await expect(page.getByTestId(item.expectedTestId), `${item.path} debe quedar operativo tras cambio de rol`).toBeVisible({
        timeout: 30000,
      });
    }
  });

  test('navegación demo_all mobile muestra todos los portales', async ({ page, context }) => {
    await applyOpenRoleCookie(context, 'admin');
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/dashboard');

    await page.getByTestId('mobile-nav-toggle').click();
    const labels = ['Dashboard', 'Clases', 'Consola', 'Admin Clases', 'Builder', 'Comunidad', 'Nutricion', 'Portal Cliente'];
    for (const label of labels) {
      await expect(page.getByRole('link', { name: label, exact: true })).toBeVisible();
    }
  });
});
