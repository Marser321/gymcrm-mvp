# Runbook QA + Release GymCRM

## 1) Validación local obligatoria
```bash
npm run lint
npm run test -- --run
npm run build
npm run qa:gate:mvp
```

Criterio PASS local:
- Lint/test/build en verde.
- `qa:gate:mvp` con:
  - E2E `unexpected=0`
  - Smoke `failed=0`
  - Cobertura rutas críticas (`/`, `/dashboard`, `/admin*`, `/cliente`).

## 2) Validación productiva obligatoria
```bash
QA_BASE_URL=https://gymcrm-mvp.vercel.app QA_ENV=prod npm run qa:gate:prod
```

Criterio PASS prod:
- E2E `unexpected=0`
- Smoke `failed=0`
- Health en PASS (`/api/gymcrm/health`)

## 3) Deploy a Vercel
```bash
npx vercel --prod -y
```

Luego repetir gate prod completo.

## 4) Evidencia mínima a conservar
- `.playwright-artifacts/smoke-report-staging.json`
- `.playwright-artifacts/qa-evidence-staging.json`
- `.playwright-artifacts/qa-gate-summary-staging.json`
- `.playwright-artifacts/smoke-report-prod.json`
- `.playwright-artifacts/qa-evidence-prod.json`
- `.playwright-artifacts/qa-gate-summary-prod.json`

## 5) Troubleshooting rápido
- Error `EADDRINUSE` en Playwright: matar proceso previo en puerto 3100 o rerun limpio.
- Falla puntual por sincronía UI: validar que el request PATCH/POST asociado ocurra antes de `reload`/assert.
- Si prod falla pero local pasa: confirmar deploy/alias activo y rerun gate contra URL pública.
