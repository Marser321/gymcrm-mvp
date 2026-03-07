#!/usr/bin/env node

import { existsSync, readdirSync, readFileSync, writeFileSync, statSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

const root = process.cwd();
const artifactsRoot = resolve(root, '.playwright-artifacts');
const smokeReportPath = resolve(root, process.env.SMOKE_REPORT_PATH ?? '.playwright-artifacts/smoke-report.json');
const outputPath = resolve(root, process.env.QA_EVIDENCE_PATH ?? '.playwright-artifacts/qa-evidence.json');
const qaEnv = process.env.QA_ENV ?? 'local';

const readJson = (path) => {
  try {
    return JSON.parse(readFileSync(path, 'utf-8'));
  } catch {
    return null;
  }
};

const findLatestE2EReport = () => {
  if (!existsSync(artifactsRoot)) return null;
  const dirs = readdirSync(artifactsRoot)
    .map((name) => ({ name, path: join(artifactsRoot, name) }))
    .filter((entry) => entry.name.startsWith('test-results-'))
    .filter((entry) => existsSync(join(entry.path, 'e2e-report.json')))
    .map((entry) => ({
      ...entry,
      mtime: statSync(join(entry.path, 'e2e-report.json')).mtimeMs,
    }))
    .sort((a, b) => b.mtime - a.mtime);

  return dirs[0]?.path ?? null;
};

const e2eDir = findLatestE2EReport();
const e2eReportPath = e2eDir ? join(e2eDir, 'e2e-report.json') : null;
const e2e = e2eReportPath ? readJson(e2eReportPath) : null;
const smoke = existsSync(smokeReportPath) ? readJson(smokeReportPath) : null;

const getTestRows = (report) => {
  if (!report?.suites) return [];
  const rows = [];
  const walk = (suites) => {
    for (const suite of suites ?? []) {
      for (const spec of suite.specs ?? []) {
        for (const test of spec.tests ?? []) {
          const results = test.results ?? [];
          const latest = results[results.length - 1];
          rows.push({
            file: spec.file ?? '',
            title: spec.title ?? '',
            project: test.projectName ?? '',
            status: latest?.status ?? 'unknown',
          });
        }
      }
      walk(suite.suites ?? []);
    }
  };
  walk(report.suites);
  return rows;
};

const e2eRows = getTestRows(e2e);

const statusCountByFile = (fileName) => {
  const rows = e2eRows.filter((row) => row.file === fileName || row.file.endsWith(`/${fileName}`));
  return {
    total: rows.length,
    passed: rows.filter((row) => row.status === 'passed').length,
    skipped: rows.filter((row) => row.status === 'skipped').length,
    failed: rows.filter((row) => ['failed', 'timedOut', 'interrupted'].includes(row.status)).length,
  };
};

const staffSummary = statusCountByFile('staff.spec.ts');
const clientSummary = statusCountByFile('client.spec.ts');
const landingSummary = statusCountByFile('landing.spec.ts');

const routeCoverage = {
  '/': landingSummary.passed > 0,
  '/dashboard': staffSummary.passed > 0,
  '/admin*': staffSummary.passed > 0,
  '/cliente': clientSummary.passed > 0,
};

const requiredCoverageMissing = Object.entries(routeCoverage)
  .filter(([, covered]) => !covered)
  .map(([route]) => route);

const gateFailures = [];
if (!e2e) gateFailures.push('missing_e2e_report');
if (!smoke) gateFailures.push('missing_smoke_report');
if ((e2e?.stats?.unexpected ?? 0) > 0) gateFailures.push('e2e_unexpected_failures');
if ((smoke?.totals?.failed ?? 0) > 0) gateFailures.push('smoke_failures');
if (requiredCoverageMissing.length > 0) gateFailures.push(`missing_route_coverage:${requiredCoverageMissing.join(',')}`);

const enforceNoCriticalSkips = process.env.QA_ENFORCE_NO_CRITICAL_SKIPS === 'true';
if (enforceNoCriticalSkips) {
  if (staffSummary.skipped > 0) gateFailures.push('critical_skip_staff');
  if (clientSummary.skipped > 0) gateFailures.push('critical_skip_client');
}

const evidence = {
  generatedAt: new Date().toISOString(),
  environment: qaEnv,
  reports: {
    e2e: {
      path: e2eReportPath,
      found: Boolean(e2e),
      status: e2e ? 'available' : 'missing',
    },
    smoke: {
      path: existsSync(smokeReportPath) ? smokeReportPath : null,
      found: Boolean(smoke),
      status: smoke ? 'available' : 'missing',
    },
  },
  summary: {
    e2e: e2e
      ? {
          total: e2e.stats?.expected ?? null,
          unexpected: e2e.stats?.unexpected ?? null,
          flaky: e2e.stats?.flaky ?? null,
          skipped: e2e.stats?.skipped ?? null,
        }
      : null,
    smoke: smoke?.totals ?? null,
  },
  coverage: {
    routes: routeCoverage,
    criticalSuites: {
      staff: staffSummary,
      client: clientSummary,
      landing: landingSummary,
    },
  },
  gate: {
    enforceNoCriticalSkips,
    passed: gateFailures.length === 0,
    failures: gateFailures,
  },
};

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, JSON.stringify(evidence, null, 2), 'utf-8');
console.log(`QA evidence JSON generated: ${outputPath}`);
