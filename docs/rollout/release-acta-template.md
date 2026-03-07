# Acta de Release GymCRM (Staging -> Producción)

## Datos de release

- Fecha/hora inicio (UY): 2026-03-06 20:06:23 -03
- Fecha/hora cierre (UY): 2026-03-06 20:06:23 -03
- Operador: Codex
- Referencia frontend: no disponible (workspace sin `.git`)
- Backend objetivo: no definido (faltan `STAGING_BASE_URL` y `PRODUCTION_BASE_URL`)

## Resultado de gates

| Gate | Resultado |
|---|---|
| `qa:gate:staging` | FAIL (`Missing staging base URL`) |
| `qa:gate:prod` | FAIL (`Missing production base URL`) |
| `health staging` | FAIL (no ejecutado por falta de base URL/cookie) |
| `health producción` | FAIL (no ejecutado por falta de base URL/cookie) |

## Evidencias adjuntas

- Staging evidence: `docs/rollout/staging-evidence-template.md` (actualizado)
- Producción evidence: `docs/rollout/production-evidence-template.md` (actualizado)
- `.playwright-artifacts/qa-evidence-staging.json`
- `.playwright-artifacts/qa-evidence-prod.json`
- `.playwright-artifacts/smoke-report-staging.json` (pendiente, no generado)
- `.playwright-artifacts/smoke-report-prod.json` (pendiente, no generado)
- `.playwright-artifacts/qa-gate-summary-staging.json` (pendiente, no generado)
- `.playwright-artifacts/qa-gate-summary-prod.json` (pendiente, no generado)

## Incidencias y decisiones

- Incidencia: faltan variables de entorno y secretos E2E por entorno (`STAGING_*`, `PROD_*`).
- Severidad: P0
- Impacto: bloqueo total del rollout staging -> producción.
- Decisión: release no promovido. Se deja pipeline listo y documentación con bloqueo explícito.

## Backlog residual priorizado

1. P0/P1: cargar `STAGING_BASE_URL`, `PRODUCTION_BASE_URL`, `STAGING_E2E_*`, `PROD_E2E_*` y rerun de gates.
2. P2: ejecutar QA manual corta por rol después de gates verdes.
3. Mejora futura: persistir secretos en secret manager + job de gate programado.

## Aprobación final

- [ ] Aprobado para operación
- [x] Rechazado / rollback
- Observaciones: sin secretos operativos no se puede certificar release.
