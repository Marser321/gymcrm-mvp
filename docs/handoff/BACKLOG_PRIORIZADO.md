# Backlog Priorizado Post-MVP

## P0 (siguiente iteración)
1. Limpieza controlada de datos demo/live históricos de QA.
- Resultado esperado: demo comercial con dataset curado y consistente.

2. Endurecer políticas de promoción release.
- Resultado esperado: gate prod ejecutado siempre post-deploy con acta obligatoria.

3. Cobertura E2E de operación diaria extendida.
- Resultado esperado: incluir reactivación staff y más casos de error UX (`code/message/details`).

## P1 (corto plazo)
1. Activar modo `role_scoped` para build final por rol.
- Mantener `demo_all` en demos comerciales, `role_scoped` para operación real.

2. Refinar accesibilidad AA en paneles críticos.
- Foco visible, contraste y navegación teclado en tablas/forms admin.

3. Consolidar observabilidad UX.
- Dashboard interno de eventos de onboarding, abandono y conversión por portal.

## P2 (mediano plazo)
1. Endurecimiento de seguridad al salir de modo abierto.
- Reintroducción progresiva de auth real sin romper UX actual.

2. Optimización de performance en rutas admin pesadas.
- Reducir jank en tablas grandes y carga de datos concurrentes.
