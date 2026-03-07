import { expect, test } from '@playwright/test';

test.describe('Haptics behavior', () => {
  test('mobile vibra en preview y desktop degrada sin vibración', async ({ page }) => {
    await page.addInitScript(() => {
      const globalWithHaptics = window as Window & { __hapticCalls?: unknown[] };
      globalWithHaptics.__hapticCalls = [];

      try {
        Object.defineProperty(navigator, 'vibrate', {
          configurable: true,
          value: (pattern: unknown) => {
            globalWithHaptics.__hapticCalls?.push(pattern);
            return true;
          },
        });
      } catch {
        // no-op: browsers where vibrate is non-configurable keep native behavior.
      }
    });

    await page.goto('/');

    const toggle = page.getByTestId('toggle-haptics');
    await expect(toggle).toBeVisible();
    await toggle.click({ force: true });

    const preview = page.getByTestId('preview-haptics');
    await expect(preview).toBeVisible();
    await preview.click({ force: true });

    const calls = await page.evaluate(() => {
      const globalWithHaptics = window as Window & { __hapticCalls?: unknown[] };
      return globalWithHaptics.__hapticCalls?.length ?? 0;
    });

    const isMobileProject = test.info().project.name.includes('mobile');
    if (isMobileProject) {
      expect(calls, 'en mobile debe invocarse vibración al probar hápticos').toBeGreaterThan(0);
      return;
    }

    expect(calls, 'en desktop no debe ejecutarse vibración').toBe(0);
  });
});
