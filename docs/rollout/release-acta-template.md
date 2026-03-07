# Acta de Release GymCRM (Staging -> Producción)

## Datos de release

- Fecha/hora inicio (UY): 2026-03-07 11:38:17 -03
- Fecha/hora cierre (UY): 2026-03-07 12:08:19 -03
- Operador: Codex
- Commit release: `827f133`
- Repo: `https://github.com/Marser321/gymcrm-mvp`
- Producción: `https://gymcrm-mvp.vercel.app`

## Resultado de gates

| Gate | Resultado |
|---|---|
| `qa:gate:staging` | PASS |
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
- `docs/rollout/staging-evidence-template.md`
- `docs/rollout/production-evidence-template.md`

## Incidencias y decisiones

- Incidencia 1: backend inicial de `.env` no alineado para `live`.
  - Decisión: mover release al backend administrable en MCP (`dpxpa3f5`) con esquema GymCRM operativo.
- Incidencia 2: conflicto peer deps en Vercel.
  - Decisión: `.npmrc` con `legacy-peer-deps=true`.
- Incidencia 3: smoke prod no idempotente en creación de plan activo.
  - Decisión: cerrar planes activos previos en `scripts/smoke-gymcrm.mjs` antes de crear nuevo plan.

## Backlog residual priorizado

1. Ejecutar QA manual visual corta post-release con stakeholders (staff/cliente).
2. Reemplazar dependencia deprecated `@studio-freight/react-lenis` por `lenis` para eliminar workaround `legacy-peer-deps`.
3. Volver a endurecer seguridad/RLS al terminar fase de test abierto.

## Aprobación final

- [x] Aprobado para operación.
- [ ] Requiere rollback.
- Observaciones: release LIVE publicado y validado con gate completo en verde.
