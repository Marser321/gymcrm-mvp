# Handoff Premium GymCRM

## Objetivo
Este paquete permite que un nuevo desarrollador/agente continúe el proyecto sin perder contexto ni romper contratos existentes.

## Orden recomendado de lectura (10-15 min)
1. `ESTADO_ACTUAL.md` — qué está operativo hoy y qué quedó parcial.
2. `DECISIONES_Y_CONTRATOS.md` — decisiones cerradas y límites para no romper el MVP.
3. `RUNBOOK_QA_RELEASE.md` — cómo validar y promover cambios con evidencia.
4. `BACKLOG_PRIORIZADO.md` — siguiente trabajo por impacto y riesgo.
5. `PLANTILLA_HANDOFF_AI.md` — formato estándar para próximos pases entre agentes.

## Estado de cierre (2026-03-07)
- Landing/CRM con acceso abierto por rol funcionando.
- Hotfix de tour aplicado (sin clipping en primer pliegue).
- Staff híbrido con alta + baja + reactivación en UI.
- Gates en verde:
  - `qa:gate:mvp`: PASS
  - `qa:gate:prod`: PASS

## Artefactos clave
- `.playwright-artifacts/qa-gate-summary-staging.json`
- `.playwright-artifacts/qa-gate-summary-prod.json`
- `docs/rollout/staging-evidence-template.md`
- `docs/rollout/production-evidence-template.md`
- `docs/rollout/release-acta-template.md`
