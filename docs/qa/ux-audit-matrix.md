# Auditoría UX por Rol (GymCRM Demo Premium)

Fecha: 2026-03-07 (America/Montevideo)

## Matriz de fricción

| Ruta / Flujo | Rol | Hallazgo | Severidad | Estado |
|---|---|---|---|---|
| `/cliente` carga inicial | cliente | Sin vínculo por `auth_user_id` podía dejar portal sin contenido usable | P0 bloqueante | **Corregido** con fallback/autocorrección demo en backend |
| `/cliente` desde rol no cliente | admin/recepción/entrenador/nutricionista | Mensaje ambiguo de bloqueo | P1 confuso | **Corregido** con asistente de cambio de rol y copy unificado |
| Preferencias tema/hápticos | todos | Persistían solo localmente (navegador) | P1 funcional | **Corregido** con `api/gymcrm/ui/preferences` + fallback local |
| Onboarding demo | todos | No había guía inicial ni relanzable | P1 experiencia | **Corregido** con tour interactivo + botón "Ver demo" |
| Asistencia clases base | staff | Faltaba panel operativo completo por horario | P0 bloqueante | **Corregido** con `api/gymcrm/clases/asistencia` + UI en `/admin/classes` |
| Pre-check-in cliente | cliente | No había flujo cliente dentro de ventana operativa | P1 funcional | **Corregido** con pre-check-in vía `/api/gymcrm/clases/asistencia` |
| Analytics UX | todos | Sin consentimiento explícito ni taxonomía base | P1 legal/operativo | **Corregido** con banner opt-in/opt-out y PostHog gated |

## Checklist por rol (resumen)

- `admin`: dashboard, admin, builder, comunidad, nutrición, clases/asistencia.
- `recepcion`: operación diaria, clases/asistencia, canjes/pagos manuales.
- `entrenador`: clases/asistencia, reservas y estado de alumnos.
- `nutricionista`: consentimientos, planes, mediciones y seguimiento.
- `cliente`: portal cliente, reservas dinámicas, canjes, consentimiento, pre-check-in.

## Criterio de cierre de esta auditoría

- 0 bloqueos duros en panel cliente demo.
- 0 acciones de asistencia sin backend.
- Preferencias UX y onboarding persistidos por `gimnasio + user + rol`.
- Analytics solo con consentimiento explícito.
