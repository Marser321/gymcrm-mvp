# Evidencia de Rollout - Producción

## Contexto

- Fecha/hora (UY): 2026-03-07 12:08:19 -03
- Operador: Codex
- URL producción: `https://gymcrm-mvp.vercel.app`
- Backend live: `https://dpxpa3f5.us-east.insforge.app`
- Entorno (`QA_ENV`): `prod`
- Evidencia JSON: `.playwright-artifacts/qa-evidence-prod.json`
- Smoke JSON: `.playwright-artifacts/smoke-report-prod.json`
- Gate summary: `.playwright-artifacts/qa-gate-summary-prod.json`

## Health check

- Endpoint: `GET /api/gymcrm/health`
- Resultado: PASS
- `healthy`: `true`
- Checks: 15/15 OK

## Smoke API

- Resultado global: PASS
- Totales: `16 PASS / 0 FAIL`
- Nota: smoke nutrición se hizo idempotente cerrando planes activos previos antes de crear plan activo.

## E2E crítica

- Resultado global: PASS
- Totales: `total=10`, `unexpected=0`, `skipped=0`, `flaky=0`
- Cobertura crítica validada: `/`, `/dashboard`, `/admin*`, `/cliente`

## QA manual mínima

### Staff
- `/admin/builder`: cubierto por E2E (PASS)
- `/admin/comunidad`: cubierto por E2E (PASS)
- `/admin/nutricion`: cubierto por E2E (PASS)

### Cliente
- `/cliente` reservas dinámicas: cubierto por E2E (PASS)
- `/cliente` canjes: cubierto por E2E (PASS)
- `/cliente` nutrición: cubierto por E2E (PASS)

## Incidencias y workaround

- Incidencia: conflicto peer deps en build Vercel.
- Resolución: agregado `.npmrc` con `legacy-peer-deps=true`.
- Incidencia: variable `GYMCRM_DATA_MODE` en prod quedaba en `demo`.
- Resolución: recreadas variables de entorno de Production + redeploy.

## Cierre de producción

- [x] Aprobado para operación.
- Observaciones: gate automático completo en verde y health live estable.
