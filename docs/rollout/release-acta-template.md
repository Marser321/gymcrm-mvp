# Acta de Release GymCRM (Staging -> Producción)

## Datos de release

- Fecha/hora inicio (UY): 2026-03-07 16:02:32 -03
- Fecha/hora cierre (UY): 2026-03-07 16:16:30 -03
- Operador: Codex
- Commit release: `b2e2808`
- Repo: `https://github.com/Marser321/gymcrm-mvp`
- Producción: `https://gymcrm-mvp.vercel.app`

## Resultado de gates

| Gate | Resultado |
|---|---|
| `qa:gate:mvp` | PASS |
| `qa:gate:prod` | PASS |
| `health staging` | PASS (`healthy=true`) |
| `health producción` | PASS (`healthy=true`) |

## Evidencias adjuntas

- `.playwright-artifacts/qa-evidence-staging.json`
- `.playwright-artifacts/smoke-report-staging.json`
- `.playwright-artifacts/qa-gate-summary-staging.json`
- `.playwright-artifacts/qa-evidence-prod.json`
- `.playwright-artifacts/smoke-report-prod.json`
- `.playwright-artifacts/qa-gate-summary-prod.json`
- `.playwright-artifacts/manual-qa-prod/summary.json`
- `docs/rollout/staging-evidence-template.md`
- `docs/rollout/production-evidence-template.md`

## Incidencias y decisiones

- Incidencia 1: gate prod falló inicialmente en flujo cliente por cancelación dinámica.
  - Decisión: corregir resolución no determinista de cliente por `auth_user_id` en API live (`me` + `builder/reservas`) y endurecer validación E2E para cancelar por `reservaId` con fallback API cliente.
- Incidencia 2: CLI `vercel` no instalada globalmente en la máquina.
  - Decisión: usar `npx vercel` para deploy y operación sin bloqueo.

## Backlog residual priorizado

1. Unificar resolución de `cliente_id` por `auth_user_id` en el resto de endpoints live para eliminar riesgo de ambigüedad por duplicados históricos.
2. Ejecutar limpieza de datos históricos de clientes duplicados por `auth_user_id` en entorno live (operación controlada).
3. Definir política de retención para artefactos de QA (`.playwright-artifacts`) en CI/CD.

## Aprobación final

- [x] Aprobado para operación.
- [ ] Requiere rollback.
- Observaciones: MVP publicado y validado end-to-end con gate técnico en verde y navegación demo sin login.
