# Evidencia de Rollout - Producción

## Contexto

- Fecha/hora (UY): 2026-03-07 16:15:03 -03
- Operador: Codex
- URL producción: `https://gymcrm-mvp.vercel.app`
- Deployment Vercel: `https://gymcrm-m0zxaqqx8-marios-projects-4a53e443.vercel.app`
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
- Nota: smoke mantiene idempotencia de nutrición cerrando plan activo previo antes de crear uno nuevo.

## E2E crítica

- Resultado global: PASS
- Totales: `total=14`, `unexpected=0`, `skipped=0`, `flaky=0`
- Cobertura crítica validada: `/`, `/dashboard`, `/admin*`, `/cliente`

## QA manual mínima

### Staff
- `/admin/builder`: PASS
- `/admin/comunidad`: PASS
- `/admin/nutricion`: PASS

### Cliente
- `/cliente` reservas dinámicas: PASS
- `/cliente` canjes: PASS
- `/cliente` nutrición: PASS

### Evidencia manual
- Barrido guiado por rol (`admin`/`cliente`) con capturas: `.playwright-artifacts/manual-qa-prod/summary.json`

## Incidencias y workaround

- Incidencia: flake en cancelación dinámica de cliente en prod.
- Resolución: endurecimiento E2E (cancelación dirigida por `reservaId` + fallback API cliente) y resolución determinista de cliente por `auth_user_id` en rutas live de reservas/me.

## Cierre de producción

- [x] Aprobado para operación.
- Observaciones: gate automático completo en verde y release estable en URL productiva.
