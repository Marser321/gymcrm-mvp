#!/usr/bin/env node

import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';

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

const qaEnv = (process.env.QA_ENV ?? 'staging').toLowerCase();
const isProd = qaEnv === 'prod' || qaEnv === 'production';
const envPrefix = isProd ? 'PROD' : 'STAGING';
const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';

const pickEnv = (name, extra = []) => {
  const candidates = [
    process.env[name],
    process.env[`${envPrefix}_${name}`],
    ...extra.map((candidate) => process.env[candidate]),
  ];
  return candidates.find((value) => typeof value === 'string' && value.trim().length > 0)?.trim() ?? '';
};

const baseURL = pickEnv(
  'QA_BASE_URL',
  isProd
    ? ['PRODUCTION_BASE_URL', 'PROD_BASE_URL', 'PROD_PLAYWRIGHT_BASE_URL']
    : ['STAGING_BASE_URL', 'STAGING_PLAYWRIGHT_BASE_URL']
);

const defaultLocalPort = Number(process.env.PLAYWRIGHT_PORT ?? process.env.PORT ?? '3100');
const resolvedBaseURL = baseURL || (!isProd ? `http://127.0.0.1:${defaultLocalPort}` : '');

if (!resolvedBaseURL) {
  console.error(
    isProd
      ? 'Missing production base URL. Define QA_BASE_URL, PRODUCTION_BASE_URL o PROD_BASE_URL.'
      : 'Missing staging base URL. Define QA_BASE_URL o STAGING_BASE_URL.'
  );
  process.exit(2);
}

const smokeReportPath =
  process.env.SMOKE_REPORT_PATH ?? `.playwright-artifacts/smoke-report-${isProd ? 'prod' : 'staging'}.json`;
const qaEvidencePath =
  process.env.QA_EVIDENCE_PATH ?? `.playwright-artifacts/qa-evidence-${isProd ? 'prod' : 'staging'}.json`;
const gateSummaryPath =
  process.env.QA_GATE_SUMMARY_PATH ?? `.playwright-artifacts/qa-gate-summary-${isProd ? 'prod' : 'staging'}.json`;
const useOpenSession = (process.env.E2E_OPEN_SESSION ?? 'true').trim().toLowerCase() !== 'false';
const e2eProfile = (
  process.env.QA_E2E_PROFILE ??
  (useOpenSession ? 'critical_desktop' : 'seed_all')
).trim().toLowerCase();

const mergedEnv = {
  ...process.env,
  QA_ENV: isProd ? 'prod' : 'staging',
  PLAYWRIGHT_BASE_URL: resolvedBaseURL,
  SMOKE_BASE_URL: resolvedBaseURL,
  E2E_SEED_ENABLED: 'true',
  E2E_OPEN_SESSION: useOpenSession ? 'true' : 'false',
  SMOKE_USE_SEED: 'true',
  SMOKE_REPORT_PATH: smokeReportPath,
  QA_EVIDENCE_PATH: qaEvidencePath,
  QA_ENFORCE_NO_CRITICAL_SKIPS: 'true',
  GYMCRM_DATA_MODE: process.env.GYMCRM_DATA_MODE ?? 'demo',
  E2E_ADMIN_API_KEY: pickEnv('E2E_ADMIN_API_KEY'),
  E2E_STAFF_EMAIL: pickEnv('E2E_STAFF_EMAIL'),
  E2E_STAFF_PASSWORD: pickEnv('E2E_STAFF_PASSWORD'),
  E2E_CLIENT_EMAIL: pickEnv('E2E_CLIENT_EMAIL'),
  E2E_CLIENT_PASSWORD: pickEnv('E2E_CLIENT_PASSWORD'),
};

const requiredSeedVars = [
  'E2E_ADMIN_API_KEY',
  'E2E_STAFF_EMAIL',
  'E2E_STAFF_PASSWORD',
  'E2E_CLIENT_EMAIL',
  'E2E_CLIENT_PASSWORD',
];

if (!useOpenSession) {
  const missingSeedVars = requiredSeedVars.filter((key) => !mergedEnv[key] || mergedEnv[key].trim().length === 0);
  if (missingSeedVars.length > 0) {
    console.error(`Missing required seed vars for ${qaEnv}: ${missingSeedVars.join(', ')}`);
    process.exit(2);
  }
}

const runStep = (name, cmd, args) => {
  console.log(`\n== ${name} ==`);
  const result = spawnSync(cmd, args, {
    stdio: 'inherit',
    env: mergedEnv,
    cwd: process.cwd(),
  });
  if (result.status !== 0) {
    console.error(`Step failed: ${name}`);
    process.exit(result.status ?? 1);
  }
};

const isLocalUrl = (url) => {
  try {
    const parsed = new URL(url);
    return ['127.0.0.1', 'localhost', '::1'].includes(parsed.hostname);
  } catch {
    return false;
  }
};

const resolvePort = (url) => {
  try {
    const parsed = new URL(url);
    if (parsed.port) return Number(parsed.port);
    return parsed.protocol === 'https:' ? 443 : 80;
  } catch {
    return defaultLocalPort;
  }
};

const healthUrl = `${resolvedBaseURL.replace(/\/+$/, '')}/api/gymcrm/health`;

const waitForHealth = async (timeoutMs = 120_000) => {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const response = await fetch(healthUrl, { method: 'GET' });
      if (response.ok) return true;
    } catch {
      // Retry until timeout.
    }
    await sleep(1000);
  }
  return false;
};

let localServerProcess = null;
if (isLocalUrl(resolvedBaseURL) && !(await waitForHealth(4_000))) {
  const port = resolvePort(resolvedBaseURL);
  console.log(`Starting local server for QA gate on port ${port}...`);
  localServerProcess = spawn(npmCmd, ['run', 'dev', '--', '--port', String(port)], {
    stdio: 'inherit',
    env: mergedEnv,
    cwd: process.cwd(),
  });

  const healthy = await waitForHealth(180_000);
  if (!healthy) {
    console.error(`Local server did not become healthy at ${healthUrl}`);
    if (localServerProcess && localServerProcess.exitCode === null) {
      localServerProcess.kill('SIGTERM');
    }
    process.exit(1);
  }
}

try {
  if (e2eProfile === 'critical_desktop') {
    runStep('E2E Critical Desktop', npmCmd, [
      'run',
      'test:e2e',
      '--',
      'tests/e2e/landing.spec.ts',
      'tests/e2e/staff.spec.ts',
      'tests/e2e/client.spec.ts',
      '--project=chromium-desktop',
    ]);
  } else {
    runStep('E2E Seed', npmCmd, ['run', 'test:e2e:seed']);
  }
  runStep('Smoke Report', process.execPath, ['scripts/smoke-gymcrm.mjs']);
  runStep('QA Evidence', process.execPath, ['scripts/collect-qa-evidence.mjs']);
} finally {
  if (localServerProcess && localServerProcess.exitCode === null) {
    localServerProcess.kill('SIGTERM');
  }
}

const absEvidencePath = resolve(process.cwd(), qaEvidencePath);
if (!existsSync(absEvidencePath)) {
  console.error(`Missing QA evidence file: ${absEvidencePath}`);
  process.exit(1);
}

const evidence = JSON.parse(readFileSync(absEvidencePath, 'utf-8'));
const gateFailures = evidence?.gate?.failures ?? [];
const gatePassed = Boolean(evidence?.gate?.passed) && gateFailures.length === 0;

const summary = {
  generatedAt: new Date().toISOString(),
  environment: isProd ? 'prod' : 'staging',
  baseURL: resolvedBaseURL,
  e2eProfile,
  smokeReportPath: resolve(process.cwd(), smokeReportPath),
  qaEvidencePath: absEvidencePath,
  gatePassed,
  gateFailures,
  e2e: evidence?.summary?.e2e ?? null,
  smoke: evidence?.summary?.smoke ?? null,
  coverage: evidence?.coverage ?? null,
};

const absSummaryPath = resolve(process.cwd(), gateSummaryPath);
mkdirSync(dirname(absSummaryPath), { recursive: true });
writeFileSync(absSummaryPath, JSON.stringify(summary, null, 2), 'utf-8');
console.log(`Gate summary: ${absSummaryPath}`);

if (!gatePassed) {
  console.error(`Gate FAILED for ${qaEnv}: ${gateFailures.join(', ')}`);
  process.exit(1);
}

console.log(`Gate PASSED for ${qaEnv}.`);
