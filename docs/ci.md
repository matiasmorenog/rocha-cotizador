# CI

Workflow: [`.github/workflows/ci.yml`](../.github/workflows/ci.yml)

## Job `lint-and-typecheck`

Corre en PR/push a `development` y `main`:

1. `npm ci`
2. `npx prisma generate` (con `DATABASE_URL` dummy)
3. `npm run typecheck`
4. `npm run lint`

Node 24.

## Build

`next build` lo hace **Vercel** en preview/producción. No está en Actions (Fase 2 opcional).

## Branch protection / merge gate

Repo **privado** en plan Free: GitHub **no permite** branch protection ni rulesets
(`403 Upgrade to GitHub Pro or make this repository public`).

Opciones:

1. **GitHub Pro** (o repo público) → Settings → Branches / Rulesets → require
   `lint-and-typecheck` en `development` y `main`.
2. Hasta entonces: **no mergear** PRs con CI rojo (regla de equipo + agente).

## Vercel espera lint/typecheck (prod)

Deployment Checks (solo **promote a producción**, no frena el build preview):

1. Abrí
   [Deployment Checks](https://vercel.com/tutemorenos-projects/rocha-cotizador/settings/deployment-checks)
2. **Add Checks** → GitHub → elegí `lint-and-typecheck`
3. Guardá

Así el deploy a `main` se construye, pero **no se asigna al dominio** hasta que Actions esté verde.

Nota: preview sigue buildeando en paralelo al CI (comportamiento normal de Vercel).
