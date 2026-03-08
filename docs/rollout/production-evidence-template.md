# Evidencia de Rollout - Producción

## Contexto

- Fecha/hora (UY): 2026-03-07 19:41:25 -03
- Operador: Codex
- URL producción: `https://gymcrm-mvp.vercel.app`
- Deployment Vercel validado: `https://gymcrm-ma7c6nn67-marios-projects-4a53e443.vercel.app`
- Backend live: `https://dpxpa3f5.us-east.insforge.app`
- Entorno (`QA_ENV`): `prod`
- Evidencia JSON: `.playwright-artifacts/qa-evidence-prod.json`
- Smoke JSON: `.playwright-artifacts/smoke-report-prod.json`
- Gate summary: `.playwright-artifacts/qa-gate-summary-prod.json`

## Health check

- Endpoint: `GET /api/gymcrm/health`
- Resultado: PASS
- `healthy`: `true`

## Smoke API

- Resultado global: PASS
- Totales: `16 PASS / 0 FAIL`
- Incluye validación idempotente de canje monetario en pago manual.

## E2E crítica

- Resultado global: PASS
- Totales: `total=16`, `unexpected=0`, `skipped=0`, `flaky=0`
- Cobertura validada: `/`, `/dashboard`, `/admin*`, `/cliente`
- Incluye:
  - tour onboarding sin recorte,
  - staff híbrido crear/desactivar (+acción de reactivación disponible),
  - operación diaria completa (plan+membresía+pago).

## QA manual mínima

- Header + botón `Ver demo`: PASS
- `/admin` (staff + operación diaria): PASS
- `/cliente` sin bloqueos ambiguos: PASS

## Cierre de producción

- [x] Aprobado para operación
- Observaciones: release estable y demo comercial funcional para presentación.
