# Evidencia de Rollout - Staging

## Contexto

- Fecha/hora (UY): 2026-03-06 20:06:23 -03
- Operador: Codex
- Backend staging: no definido en `.env` (`STAGING_BASE_URL` ausente)
- Commit/referencia código frontend: no disponible (workspace sin `.git`)
- Entorno (`QA_ENV`): `staging`
- Base URL usada (`PLAYWRIGHT_BASE_URL`/`SMOKE_BASE_URL`): N/A
- Ruta evidencia JSON: `.playwright-artifacts/qa-evidence-staging.json`
- Ruta smoke JSON: `.playwright-artifacts/smoke-report-staging.json`
- Ruta gate summary: `.playwright-artifacts/qa-gate-summary-staging.json`

## Migraciones aplicadas

- [ ] `0001_gymcrm_schema.sql` (no validado en esta corrida)
- [ ] `0002_gymcrm_profundizacion.sql` (no validado en esta corrida)

Notas de ejecución SQL:
- No se ejecutaron migraciones en este cierre (scope congelado sin schema changes).

## Health check

- Endpoint: `GET /api/gymcrm/health`
- Resultado: FAIL (no ejecutado contra staging por falta de base URL)
- `healthy`: N/A
- Checks fallidos: `missing STAGING_BASE_URL`

## Smoke API (`npm run smoke:gymcrm`)

- Resultado global: FAIL
- Resumen:
  - Total PASS: 0
  - Total FAIL: N/A (no corrió checks por preflight)

Detalle por check:
- Bloqueado por `Missing SMOKE_STAFF_COOKIE (env) and seed staffCookie in .playwright-artifacts/e2e-seed.json`.

## E2E crítica (`npm run test:e2e:seed`)

- Resultado global: FAIL (gate no ejecutable por preflight)
- Stats (último reporte disponible no-seed):
  - expected: 8
  - unexpected: 0
  - skipped: 14
  - flaky: 0
- Cobertura crítica:
  - `/`: PASS
  - `/dashboard`: FAIL
  - `/admin*`: FAIL
  - `/cliente`: FAIL
- Suites críticas sin skip:
  - `staff.spec.ts`: FAIL
  - `client.spec.ts`: FAIL

## QA manual

### Staff
- `/admin/builder`: no ejecutado
- `/admin/comunidad`: no ejecutado
- `/admin/nutricion`: no ejecutado

### Cliente
- `/cliente` reservas dinámicas: no ejecutado
- `/cliente` canjes: no ejecutado
- `/cliente` nutrición: no ejecutado

## Incidencias y workaround

- Incidencia: faltan variables operativas para staging/prod (`STAGING_BASE_URL`, `PRODUCTION_BASE_URL`, `STAGING_E2E_*`, `PROD_E2E_*`)
- Severidad: P0 (bloquea gate automático)
- Workaround: cargar secretos reales en `.env` y reintentar `npm run qa:gate:staging`.

## Aprobación para promover a producción

- [ ] Aprobado
- [x] Rechazado
- Motivo: staging gate no ejecutable por faltantes de entorno/credenciales.
