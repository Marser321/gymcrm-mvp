# Decisiones Cerradas y Contratos (No Romper)

## Decisiones de producto vigentes
- Demo comercial sin fricción: acceso abierto por rol (sin login obligatorio en UX CRM).
- Navegación por defecto: `NEXT_PUBLIC_GYMCRM_NAV_MODE=demo_all`.
- Datos:
  - QA local: `GYMCRM_DATA_MODE=demo`.
  - Producción demo: `GYMCRM_DATA_MODE=live`.

## Contratos API (sin breaking changes)
- Mantener `api/gymcrm/*` existente.
- No renombrar estados de dominio ya activos (`membresia`, `pago`, `reserva`, `canje`, `plan_nutricion`).
- Reusar endpoint existente para staff:
  - `PATCH /api/gymcrm/staff/[id]` (`activo=true` para reactivación).

## Reglas técnicas de continuidad
- No tocar schema en hotfixes UI salvo bloqueo crítico real.
- Cualquier cambio de flujo crítico debe pasar por:
  - `lint`, `test`, `build`, `qa:gate:mvp`, `qa:gate:prod`.
- No introducir UI decorativa sin acción real.

## Criterios de calidad que siguen obligatorios
- Cero botones muertos en rutas críticas.
- Errores visibles y accionables (sin fallos silenciosos).
- Evidencia JSON por entorno siempre actualizada.
