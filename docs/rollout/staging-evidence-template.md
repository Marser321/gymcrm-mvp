# Evidencia de Rollout - Staging

## Contexto

- Fecha/hora (UY): 2026-03-07 12:08:19 -03
- Operador: Codex
- Backend staging usado: `https://dpxpa3f5.us-east.insforge.app`
- Commit frontend: `827f133`
- Entorno (`QA_ENV`): `staging`
- Base URL gate: `http://127.0.0.1:3100`
- Evidencia JSON: `.playwright-artifacts/qa-evidence-staging.json`
- Smoke JSON: `.playwright-artifacts/smoke-report-staging.json`
- Gate summary: `.playwright-artifacts/qa-gate-summary-staging.json`

## Migraciones / alineación backend

- `0001_gymcrm_schema.sql`: objetos críticos presentes y operativos.
- `0002_gymcrm_profundizacion.sql`: tablas/RPC críticas presentes; se completó ajuste de columnas/view bridge para `comunidad_puntos_movimientos`.
- Ajustes operativos aplicados:
  - permisos abiertos en `gymcrm` para modo libre (`anon/authenticated`).
  - seed base (`gimnasio`, roles open, cliente open, plan y membresía activa).
  - `GYMCRM_OPEN_GYM_ID` definido a UUID válido.

## Health check

- Endpoint: `GET /api/gymcrm/health`
- Resultado: PASS
- `healthy`: `true`
- Checks: 15/15 OK

## Smoke API

- Resultado global: PASS
- Totales: `15 PASS / 0 FAIL`
- Flujo B3/B2 cubierto: builder, comunidad/canjes/pagos, nutrición, whatsapp queue

## E2E crítica

- Resultado global: PASS
- Totales: `total=10`, `unexpected=0`, `skipped=0`, `flaky=0`
- Cobertura crítica validada: `/`, `/dashboard`, `/admin*`, `/cliente`

## QA manual

- Ejecutada manual corta: no (reemplazada en este cierre por E2E crítica completa + smoke verde).
- Bloqueantes P0/P1 detectados: no.

## Aprobación

- [x] Aprobado staging
- Observaciones: staging listo para promoción inmediata a producción.
