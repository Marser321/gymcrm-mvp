# Evidencia de Rollout - Staging

## Contexto

- Fecha/hora (UY): 2026-03-07 19:38:14 -03
- Operador: Codex
- Backend staging usado: `https://dpxpa3f5.us-east.insforge.app`
- Commit frontend base: `8df2b76`
- Entorno (`QA_ENV`): `staging`
- Base URL gate: `http://127.0.0.1:3100`
- Evidencia JSON: `.playwright-artifacts/qa-evidence-staging.json`
- Smoke JSON: `.playwright-artifacts/smoke-report-staging.json`
- Gate summary: `.playwright-artifacts/qa-gate-summary-staging.json`

## Migraciones / alineación backend

- Sin cambios de schema durante este cierre.
- `0001_gymcrm_schema.sql` y `0002_gymcrm_profundizacion.sql` se mantienen como base operativa.
- Modo de validación en staging: `GYMCRM_DATA_MODE=demo`.

## Health check

- Endpoint: `GET /api/gymcrm/health`
- Resultado: PASS
- `healthy`: `true`

## Smoke API

- Resultado global: PASS
- Totales: `16 PASS / 0 FAIL`
- Flujos cubiertos: builder, comunidad/canjes/pagos, nutrición y cola WhatsApp.

## E2E crítica

- Resultado global: PASS
- Totales: `total=16`, `unexpected=0`, `skipped=0`, `flaky=0`
- Cobertura validada: `/`, `/dashboard`, `/admin*`, `/cliente`
- Incluye test anti-clipping de tour onboarding.

## Aprobación

- [x] Aprobado staging
- Observaciones: listo para promoción, evidencia completa y reproducible.
