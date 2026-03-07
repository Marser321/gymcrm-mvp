import { expect, test } from '@playwright/test';
import { expectNoBrokenCriticalResources } from './helpers';

test.describe('Landing Luxury Sport Tech', () => {
  test('CTAs principales tienen destino funcional', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => window.scrollTo({ top: 0, left: 0, behavior: 'instant' }));

    await expect(page.locator('header')).toBeVisible();
    await expect(page.getByRole('heading', { level: 1, name: /Transforma tu/i })).toBeInViewport();

    const ctaStartFree = page.getByTestId('cta-start-free');
    const ctaViewFeatures = page.getByTestId('cta-view-features');
    const ctaVipDashboard = page.getByTestId('cta-vip-dashboard');
    const ctaVipWhatsapp = page.getByTestId('cta-vip-whatsapp');
    const ctaFloatingWhatsapp = page.getByTestId('cta-whatsapp-floating');

    await expect(ctaStartFree).toBeVisible();
    await expect(ctaViewFeatures).toBeVisible();
    await expect(ctaVipDashboard).toBeVisible();
    await expect(ctaVipWhatsapp).toBeVisible();
    await expect(ctaFloatingWhatsapp).toBeVisible();
    await expect(ctaStartFree).toBeInViewport({ ratio: 0.2 });

    await expect(ctaStartFree).toHaveAttribute('href', '/dashboard');

    await page.goto('/');
    await ctaViewFeatures.click();
    await expect(page.locator('#benefits')).toBeInViewport();

    await expect(ctaVipWhatsapp).toHaveAttribute('href', /https:\/\/wa\.me\/\d+/);
    await expect(ctaFloatingWhatsapp).toHaveAttribute('href', /https:\/\/wa\.me\/\d+/);

    await expect(page.getByTestId('cta-vip-dashboard')).toHaveAttribute('href', '/dashboard');
  });

  test('no hay assets críticos rotos en landing + PWA manifest', async ({ page, request }) => {
    await page.goto('/');
    await expectNoBrokenCriticalResources(page);

    const manifest = await request.get('/manifest.webmanifest');
    expect(manifest.ok(), 'manifest.webmanifest debe responder 200').toBeTruthy();

    const sw = await request.get('/sw.js');
    expect(sw.ok(), 'service worker /sw.js debe responder 200').toBeTruthy();
  });

  test('preferencia de hápticos persiste (toggle ON/OFF)', async ({ page }) => {
    await page.goto('/');

    const toggle = page.getByTestId('toggle-haptics');
    await expect(toggle).toBeVisible();

    await toggle.click({ force: true });
    await expect(toggle).toContainText(/Haptics ON|Haptics OFF/);

    const afterFirstClick = await toggle.textContent();

    await page.reload();
    await expect(toggle).toHaveText(afterFirstClick ?? '');
  });
});
