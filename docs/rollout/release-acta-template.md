# Acta de Release GymCRM (Cierre Final MVP)

## Datos de release

- Fecha/hora inicio (UY): 2026-03-07 19:34:54 -03
- Fecha/hora cierre (UY): 2026-03-07 19:41:25 -03
- Operador: Codex
- Commit base de rama: `8df2b76`
- Repo: `https://github.com/Marser321/gymcrm-mvp`
- Producción: `https://gymcrm-mvp.vercel.app`
- Deployment validado: `https://gymcrm-ma7c6nn67-marios-projects-4a53e443.vercel.app`

## Resultado de gates

| Gate | Resultado |
|---|---|
| `npm run lint` | PASS |
| `npm run test -- --run` | PASS |
| `npm run build` | PASS |
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
- `docs/rollout/staging-evidence-template.md`
- `docs/rollout/production-evidence-template.md`
- `docs/handoff/README.md`

## Incidencias relevantes y decisiones

1. Incidencia: recorte visual del tour de ayuda en header.
- Resolución: modal del tour movido a `portal` (`document.body`) + overlay robusto con `min-h-[100svh]` y `overflow-y-auto`.

2. Incidencia: inestabilidad intermitente en flujo staff híbrido.
- Resolución: endurecimiento UI (alta/baja/reactivación) y E2E determinista por acción efectiva.

3. Incidencia: gate prod falló antes del deploy por no contener último build.
- Resolución: deploy productivo con `npx vercel --prod -y` y rerun de gate prod en verde.

## Backlog residual priorizado

1. Limpieza de datos históricos QA en entorno live para demo comercial consistente.
2. Evolución de navegación a `role_scoped` para versión operativa cerrada por permisos.
3. Endurecimiento progresivo de seguridad al salir de modo abierto.

## Aprobación final

- [x] Aprobado para continuidad y producción demo.
- [ ] Requiere rollback.
- Observaciones: cierre funcional completo + handoff premium preparado para siguiente dev/agente.
