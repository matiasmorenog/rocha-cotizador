# CI

Workflow: [`.github/workflows/ci.yml`](../.github/workflows/ci.yml)

## Job `lint-and-typecheck`

Corre en PR/push a `development` y `main`:

1. `npm ci`
2. `npx prisma generate` (con `DATABASE_URL` dummy)
3. `npm run typecheck`
4. `npm run lint`

Node 24.

## Job `deploy-production` (gate real a prod)

Solo en **push a `main`**, y **solo si** `lint-and-typecheck` pasó:

1. `vercel pull` (env production)
2. `vercel build --prod`
3. `vercel deploy --prebuilt --prod`

`vercel.json` desactiva auto-deploy de Vercel en `main` → no hay carrera paralela.
Previews (`development` / feature branches) siguen con el Git integration de Vercel.

### Secrets GitHub (obligatorios para prod)

Repo → Settings → Secrets and variables → Actions:

| Secret | Valor |
|--------|--------|
| `VERCEL_TOKEN` | [Vercel → Account → Tokens](https://vercel.com/account/tokens) |
| `VERCEL_ORG_ID` | `team_QxlnpSeR7a1AsZiXtKSsqWFJ` (team tutemorenos-projects) |
| `VERCEL_PROJECT_ID` | `prj_q87cwzCd7xVN7eDPzm81fDmjLKNz` |

Sin estos secrets, el push a `main` falla en el job de deploy (lint igual corre).

## Branch protection

Repo **privado Free**: GitHub **no** permite rulesets / branch protection (`403` Pro).

Hasta upgrade o repo público:

- **No mergear** PRs con `lint-and-typecheck` rojo (regla de equipo + agente).
- Prod igual queda protegida: sin CI verde **no hay** deploy a `main` vía Actions.

## Vercel Deployment Checks (opcional extra)

Si querés freno también en el dashboard:
[Deployment Checks](https://vercel.com/tutemorenos-projects/rocha-cotizador/settings/deployment-checks)
→ Add Checks → GitHub → `lint-and-typecheck`.

Con el gate de Actions + `main: false`, esto es backup, no obligatorio.
