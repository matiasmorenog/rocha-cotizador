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

## Branch protection (cuando esté verde estable)

GitHub → Settings → Branches → `development` → Require status checks → `lint-and-typecheck`.
