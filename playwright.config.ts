import { defineConfig, devices } from '@playwright/test';

const port = Number(process.env.PLAYWRIGHT_PORT ?? process.env.PORT ?? '3100');
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://127.0.0.1:${port}`;
const runId = Date.now().toString();
const artifactsDir = `.playwright-artifacts/test-results-${runId}`;

export default defineConfig({
  testDir: './tests/e2e',
  testIgnore: ['**/._*'],
  outputDir: artifactsDir,
  globalSetup: './tests/e2e/global-setup.ts',
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  expect: {
    timeout: 12_000,
  },
  reporter: process.env.CI
    ? [
        ['list'],
        ['html', { open: 'never' }],
        ['json', { outputFile: `${artifactsDir}/e2e-report.json` }],
      ]
    : [['list'], ['json', { outputFile: `${artifactsDir}/e2e-report.json` }]],
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: `npm run dev -- --port ${port}`,
        url: baseURL,
        timeout: 180_000,
        reuseExistingServer: false,
      },
  projects: [
    {
      name: 'chromium-desktop',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'chromium-mobile',
      use: { ...devices['Pixel 7'] },
    },
  ],
});
