# Estado Actual GymCRM (MVP Demo Open)

## Arquitectura operativa actual
- Frontend: Next.js App Router + Tailwind 3.4.
- Backend: InsForge (`api/gymcrm/*`) con modo abierto por rol para demo.
- Navegación demo: `NEXT_PUBLIC_GYMCRM_NAV_MODE=demo_all` (barra completa visible).
- Modo de datos:
  - Local QA MVP: `GYMCRM_DATA_MODE=demo`.
  - Producción demo comercial: `GYMCRM_DATA_MODE=live`.

## Estado funcional por bloques
- Operación diaria (B1): **operativo**
  - Clientes CRUD, planes, membresías, pagos manuales.
- Clases/asistencia/check-in: **operativo**
  - Tipos de clase, horarios, asistencia, check-in QR/manual.
- Builder/Comunidad (B3): **operativo en MVP**
  - Servicios/sesiones/reservas dinámicas, puntos, premios, canjes.
- Nutrición (B2): **operativo en MVP**
  - Consentimientos, planes, mediciones.
- Staff híbrido: **operativo**
  - Alta/edición/baja por rol y reactivación desde admin.

## Fixes de cierre incluidos hoy
- Tour de ayuda:
  - Overlay renderizado vía `portal` a `document.body`.
  - Layout robusto (`fixed inset-0`, `overflow-y-auto`, `min-h-[100svh]`) sin recorte en header.
- Staff:
  - Inserción optimista tras alta.
  - Baja sin vaciar grilla por error transitorio.
  - Botón explícito de `Reactivar` para filas inactivas.
- E2E:
  - Cobertura crítica ampliada a 16 tests (incluye test anti-clipping del tour).

## Riesgos residuales (no bloqueantes)
- El entorno live acumula datos de QA/seed histórico; conviene una limpieza controlada para demo comercial.
- El modo demo abierto no tiene seguridad endurecida por diseño (decisión explícita para test comercial).

## URL y release actual
- Producción: `https://gymcrm-mvp.vercel.app`
- Deploy validado: `https://gymcrm-ma7c6nn67-marios-projects-4a53e443.vercel.app`
