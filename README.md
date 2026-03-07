# GymCRM (Next.js + InsForge)

CRM profesional para gimnasios con arquitectura por bloques:

- Bloque 0: Fundación técnica (schema `gymcrm`, roles, seguridad, APIs internas)
- Bloque 1: Operación diaria + portal cliente PWA
- Bloque 2+: Nutrición, builder no-code, comunidad, eventos

## Stack

- Next.js 15 + TypeScript + App Router
- Tailwind CSS 3.4
- InsForge SDK (modo abierto sin login para MVP)

## Rutas principales

- `/dashboard` resumen operativo (KPI, retención, ingresos, reservas)
- `/admin` gestión staff/clientes
- `/dashboard/classes` reservas de clases base
- `/admin/classes` tipos de clase + horarios
- `/cliente` portal cliente (membresía, pagos, QR, reservas)

## API interna versionada

Se implementaron endpoints en `api/gymcrm/*`:

- `clientes`, `planes`, `membresias`, `pagos`
- `clases`, `clases/horarios`, `reservas`, `checkins`
- `roles`, `dashboard`, `metricas/retencion`, `auditoria`
- `nutricion/fichas`, `nutricion/consultas`, `nutricion/consentimientos`, `nutricion/planes`, `nutricion/mediciones`
- `builder/plantillas`, `builder/servicios`, `builder/sesiones`, `builder/reservas`
- `comunidad/retos`, `comunidad/puntos`, `comunidad/premios`, `comunidad/canjes`, `comunidad/ranking`
- `eventos`, `health`
- `notificaciones/whatsapp` (cola + reintentos Meta Cloud API)

## Setup

1. Instalar dependencias:

```bash
npm install
```

2. Configurar `.env`:

```env
NEXT_PUBLIC_INSFORGE_BASE_URL=...
NEXT_PUBLIC_INSFORGE_ANON_KEY=...
GYMCRM_DATA_MODE=demo
E2E_OPEN_SESSION=true
META_WHATSAPP_API_URL=...   # opcional
META_WHATSAPP_TOKEN=...     # opcional
NEXT_PUBLIC_GYMCRM_WHATSAPP_PHONE=59800000000

# QA E2E en modo abierto (sin login)
E2E_SEED_ENABLED=true

# Rollout por entorno (opcional: prefijos)
STAGING_BASE_URL=https://staging.example.com
PRODUCTION_BASE_URL=https://app.example.com
STAGING_E2E_ADMIN_API_KEY=...
STAGING_E2E_STAFF_EMAIL=...
STAGING_E2E_STAFF_PASSWORD=...
STAGING_E2E_CLIENT_EMAIL=...
STAGING_E2E_CLIENT_PASSWORD=...
PROD_E2E_ADMIN_API_KEY=...
PROD_E2E_STAFF_EMAIL=...
PROD_E2E_STAFF_PASSWORD=...
PROD_E2E_CLIENT_EMAIL=...
PROD_E2E_CLIENT_PASSWORD=...
```

3. Aplicar migraciones SQL al backend InsForge (en orden):

- `db/migrations/0001_gymcrm_schema.sql`
- `db/migrations/0002_gymcrm_profundizacion.sql`

Nota técnica: el modelo canónico vive en esquema `gymcrm`, y la migración crea también puente `public.gymcrm_*` para compatibilidad con PostgREST del SDK.

4. Correr en local:

```bash
npm run dev
```

5. Uso MVP sin fricción

- Entrar a `/`, `/dashboard`, `/admin` o `/cliente`
- Cambiar rol con el selector global (`admin`, `recepcion`, `entrenador`, `cliente`, `nutricionista`)
- No hay pantallas de login en el flujo CRM para pruebas

## Calidad

```bash
npm run check:appledouble
npm run lint
npm run test
npm run build
```

## QA crítica (smoke + E2E)

```bash
# Gate MVP local automático (levanta server local si hace falta)
npm run qa:gate:mvp

# E2E con seed automático de sesión/datos mínimos
npm run test:e2e:seed

# Smoke API con reporte JSON
npm run smoke:gymcrm:report

# Consolidado de evidencia de QA
npm run qa:evidence

# Gate por entorno (staging -> prod)
npm run qa:gate:staging
npm run qa:gate:prod
```

`smoke:gymcrm:report` soporta seed automático cuando `SMOKE_USE_SEED=true`:
- Prioridad de valores: `env explícito > .playwright-artifacts/e2e-seed.json`.
- `qa:gate:*` y `smoke:gymcrm:*` cargan `.env`/`.env.local` automáticamente.
- Si `qa:gate:staging` no recibe `STAGING_BASE_URL`, usa fallback local `http://127.0.0.1:3100` y levanta server automáticamente.

## Notas

- Middleware en `demo`: reescribe `api/gymcrm/*` a `api/gymcrm_open/*` y habilita sesión abierta por rol.
- PWA base lista (manifest + service worker).
- Moneda/región inicial: Uruguay (`UYU`, `es-UY`).
