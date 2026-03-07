# Evidencia de Rollout - Producción

## Contexto

- Fecha/hora (UY): 2026-03-06 20:06:23 -03
- Operador: Codex
- Backend producción: no definido en `.env` (`PRODUCTION_BASE_URL` ausente)
- Commit/referencia código frontend: no disponible (workspace sin `.git`)
- Entorno (`QA_ENV`): `prod`
- Base URL usada (`PLAYWRIGHT_BASE_URL`/`SMOKE_BASE_URL`): N/A
- Ruta evidencia JSON: `.playwright-artifacts/qa-evidence-prod.json`
- Ruta smoke JSON: `.playwright-artifacts/smoke-report-prod.json`
- Ruta gate summary: `.playwright-artifacts/qa-gate-summary-prod.json`

## Precondición antes de correr gate

- [ ] Gate staging completado en verde en el mismo día.
- [x] Sin cambios de schema adicionales desde staging.
- [ ] Variables/credenciales productivas cargadas.

## Health check

- Endpoint: `GET /api/gymcrm/health`
- Resultado: FAIL (no ejecutado contra producción por falta de base URL)
- `healthy`: N/A
- Checks fallidos: `missing PRODUCTION_BASE_URL`

## Smoke API (`npm run smoke:gymcrm`)

- Resultado global: FAIL
- Resumen:
  - Total PASS: 0
  - Total FAIL: N/A (no corrió checks por preflight)

Detalle por check:
- Bloqueado por falta de cookie seed (`SMOKE_STAFF_COOKIE`/`staffCookie`).

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

## QA manual mínima

### Staff
- `/admin/builder`: no ejecutado
- `/admin/comunidad`: no ejecutado
- `/admin/nutricion`: no ejecutado

### Cliente
- `/cliente` reservas dinámicas: no ejecutado
- `/cliente` canjes: no ejecutado
- `/cliente` nutrición: no ejecutado

## Incidencias y workaround

- Incidencia: faltan variables/secretos productivos para gate reproducible.
- Severidad: P0 (bloquea promoción misma jornada).
- Workaround: completar `PRODUCTION_BASE_URL` + `PROD_E2E_*` y ejecutar `npm run qa:gate:prod` luego de staging verde.

## Cierre de release

- [ ] Aprobado para operar.
- [x] Requiere rollback.
- Motivo: no hay base URL productiva ni seed credentials para ejecución del gate.
