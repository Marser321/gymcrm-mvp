# GymCRM Rollout Checklist (Staging -> Producción)

## 1) Preflight técnico

- [ ] Confirmar backend staging activo y accesible por MCP.
- [ ] Confirmar backend productivo objetivo: `3uaybi9f.us-west.insforge.app`.
- [ ] Congelar schema: no aplicar migraciones nuevas fuera de `0001` y `0002` durante rollout.
- [ ] Validar variables para smoke:
  - `SMOKE_BASE_URL`
  - `SMOKE_STAFF_COOKIE`
  - `SMOKE_CLIENT_ID_PRIMARY`
  - `SMOKE_CLIENT_ID_SECONDARY` (opcional, recomendado para probar espera/promoción)
  - `SMOKE_CLIENT_COOKIE` (opcional, recomendado)

## 2) Secuencia obligatoria de migraciones

1. Aplicar `db/migrations/0001_gymcrm_schema.sql`
2. Aplicar `db/migrations/0002_gymcrm_profundizacion.sql`
3. Ejecutar health check:

```bash
curl -sS "$BASE_URL/api/gymcrm/health" -H "cookie: $SMOKE_STAFF_COOKIE"
```

Condición de aprobación: `data.healthy === true`.

## 3) Smoke API automatizada

Ejecutar:

```bash
SMOKE_USE_SEED=true npm run smoke:gymcrm:report
```

La ejecución valida:
- Health (`/api/gymcrm/health`)
- Builder: servicio -> sesión -> reserva -> espera/promoción
- Comunidad: puntos -> canje -> aprobación
- Pagos/canjes: aplicación de descuento + bloqueo de doble aplicación
- Nutrición: consentimiento -> plan activo -> medición
- WhatsApp: encolar + reprocesar cola

## 4) Matriz PASS/FAIL de cierre

| Check | Staging | Producción |
|---|---|---|
| health | PASS/FAIL | PASS/FAIL |
| builder runtime | PASS/FAIL | PASS/FAIL |
| comunidad/canjes | PASS/FAIL | PASS/FAIL |
| idempotencia canje/pago | PASS/FAIL | PASS/FAIL |
| nutrición consentimiento/plan/medición | PASS/FAIL | PASS/FAIL |
| whatsapp queue | PASS/FAIL | PASS/FAIL |
| QA manual staff | PASS/FAIL | PASS/FAIL |
| QA manual cliente | PASS/FAIL | PASS/FAIL |

## 4.1) Gate automático por entorno

```bash
npm run qa:gate:staging
npm run qa:gate:prod
```

Condiciones de aprobación del gate:
- E2E: `unexpected=0`.
- Smoke: `failed=0`.
- Evidencia presente (`qa-evidence` + `smoke-report`).
- Cobertura crítica de rutas: `/`, `/dashboard`, `/admin*`, `/cliente`.
- Sin skips en suites críticas (`staff.spec.ts`, `client.spec.ts`) cuando seed está activo.

## 5) QA manual mínima

### Staff
- [ ] `/admin/builder`: crear servicio, crear sesión, gestionar reservas.
- [ ] `/admin/comunidad`: asignar puntos, crear premio, aprobar/anular canje.
- [ ] `/admin/nutricion`: registrar consentimiento, crear plan, registrar medición.

### Cliente
- [ ] `/cliente`: reservar/cancelar servicios dinámicos.
- [ ] `/cliente`: solicitar canje desde catálogo.
- [ ] `/cliente`: aceptar consentimiento y registrar seguimiento.

## 6) Criterio de salida

Se puede promover solo si:
- Smoke API: 100% PASS.
- Sin bloqueantes P0/P1 en QA manual.
- `health` estable con checks completos.
- Acta de release generada con incidencias y backlog residual.
