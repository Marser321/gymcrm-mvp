# Evidencia de Rollout - Staging

## Contexto

- Fecha/hora (UY): 2026-03-07 16:10:47 -03
- Operador: Codex
- Backend staging usado: `https://dpxpa3f5.us-east.insforge.app`
- Commit frontend: `b2e2808`
- Entorno (`QA_ENV`): `staging`
- Base URL gate: `http://127.0.0.1:3100`
- Evidencia JSON: `.playwright-artifacts/qa-evidence-staging.json`
- Smoke JSON: `.playwright-artifacts/smoke-report-staging.json`
- Gate summary: `.playwright-artifacts/qa-gate-summary-staging.json`

## Migraciones / alineación backend

- Sin cambios de schema durante este cierre.
- `0001_gymcrm_schema.sql` y `0002_gymcrm_profundizacion.sql` se mantienen como base operativa.
- Modo de validación en staging: `GYMCRM_DATA_MODE=demo` para reproducibilidad local del gate MVP.

## Health check

- Endpoint: `GET /api/gymcrm/health`
- Resultado: PASS
- `healthy`: `true`
- Checks críticos: PASS en smoke (`health`).

## Smoke API

- Resultado global: PASS
- Totales: `16 PASS / 0 FAIL`
- Flujo B3/B2 cubierto: builder, comunidad/canjes/pagos, nutrición, whatsapp queue.

## E2E crítica

- Resultado global: PASS
- Totales: `total=14`, `unexpected=0`, `skipped=0`, `flaky=0`
- Cobertura crítica validada: `/`, `/dashboard`, `/admin*`, `/cliente`

## QA manual

- Ejecutada manual corta asistida por rol: sí (barrido guiado + capturas).
- Evidencia: `.playwright-artifacts/manual-qa-prod/summary.json`
- Bloqueantes P0/P1 detectados: no.

## Aprobación

- [x] Aprobado staging
- Observaciones: staging listo para promoción a producción con gate reproducible en verde.
