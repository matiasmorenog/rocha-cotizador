# CI

Workflow: [`.github/workflows/ci.yml`](../.github/workflows/ci.yml)

## Draft PRs (sin checks)

Los PRs en **draft** no deben consumir CI ni previews:

| Superficie | Comportamiento |
|------------|----------------|
| GitHub Actions | Job `lint-and-typecheck` con `if: … draft == false`. También escucha `ready_for_review`. |
| Vercel Git | `git.deploymentEnabled`: solo `development` auto-deploy; `main` y `**` (feature branches) off — **no** dispara deploy Git en PRs. |
| Vercel ignore | Belt-and-suspenders: [`scripts/vercel-ignore-draft-pr.sh`](../scripts/vercel-ignore-draft-pr.sh) cancela si algo igual dispara (draft, proyecto prod en preview, sin token). |
| Push a `development` / `main` | CI sigue en push. Preview Git solo en **`rocha-cotizador-dev`** para `development`. Prod = Actions. |

`vercel.json` no usa hacks por branch de feature: el catch-all `**` apaga PRs; `development: true` gana por “cualquier regla true ⇒ deploy”.

**Proyecto prod** (`prj_q87cwzCd…`): el ignore cancela **todo** Git no-`production` (PRs / `development`). Ship solo vía Actions.

**Vercel:** Preview env en **`rocha-cotizador-dev`** necesita `GITHUB_TOKEN` o `GH_TOKEN` (`repo` / `pull_requests: read`) por si un deploy llega al ignore con PR. Sin token → fail-closed en feature.

WIP → abrí **draft** (`gh pr create --draft`). Checks/preview: el usuario marca **Ready for review** (y, con `deploymentEnabled`, el preview de feature branch sigue off — validá en local o mergeá a `development`).

> Nota: con `**` false, **no hay preview URL de feature branch** ni en ready. Preview de integración = push/merge a `development` → `rocha-cotizador-dev`. Ahorra los 2–3 checks Vercel por push de PR.

## Job `lint-and-typecheck`

Corre en PR **ready**/push a `development` y `main`:

1. `npm ci`
2. `npx prisma generate` (con `DATABASE_URL` dummy; schema includes `rhel-openssl-3.0.x` for Vercel)
3. `npm run typecheck`
4. `npm run lint`
5. `npm run ci:check-admin-chrome` — exige `.admin-desktop-sidebar` en `globals.css` y falla si `admin-nav` usa `lg:block` (regresión Tailwind singleton)

Node 24.

## Job `deploy-production` (gate real a prod)

Solo en **push a `main`**, y **solo si** `lint-and-typecheck` pasó:

1. `vercel pull` (env production)
2. **Pre-deploy schema sync** — `scripts/check-schema-sync.sh` (`prisma migrate diff` DB → `schema.prisma`). Falla el job si Neon `main` está detrás del código (drift).
3. `vercel build --prod`
4. `vercel deploy --prebuilt --prod`
5. **Post-deploy smoke** — `npm run ci:post-deploy-smoke`:
   - `GET /api/health` → 200 `{ ok: true }` (503/`schema_drift` si faltan columnas/tablas)
   - `GET /` (homepage) → 200
6. **Post-deploy cache revalidate** — [`scripts/post-deploy-cache.sh`](../scripts/post-deploy-cache.sh): purge CDN + Data Cache, `vercel cache invalidate` de **todas** las tags en `src/lib/cache-tags.ts` (`products`, `price-lists`, `customers`, `admin-dashboard`, `staff-users`, `subscription-payments`), Image Optimization de `/brand/*`, y `POST /api/revalidate` si existe `REVALIDATE_SECRET`.

`vercel.json` desactiva auto-deploy de Vercel en `main` → no hay carrera paralela.
Previews (`development` branch → **`rocha-cotizador-dev`**) usan Git integration. Feature-branch PRs **no** auto-deploy (`vercel.json` `**`: false) — draft o ready da igual para Vercel; ready solo dispara Actions. Prod = Actions.

### Job `post-deploy-cache-development`

En **push a `development`**: espera a que el Git integration de **`rocha-cotizador-dev`** (`prj_Oagw7Pq3Tg9MpBaQSWSuH7IOhD5O`) deje el SHA en `READY`, y corre el mismo `post-deploy-cache.sh` contra ese proyecto (alias `https://rocha-cotizador-dev.vercel.app`). No usa `vercel --prod` del proyecto de producción.

### Schema gate: de dónde sale `DATABASE_URL`

El check **debe** apuntar a Neon **main** (prod), nunca a local/development.

| Preferencia | Fuente |
|-------------|--------|
| Recomendado | GitHub Actions secret **`DATABASE_URL_PRODUCTION`** (Neon `main`, URL **direct** `ep-cool-mud…` sin pooler) |
| Fallback | `DATABASE_URL` dentro de `.vercel/.env.production.local` tras `vercel pull` |

**Local `.env` = Neon development** (`ep-noisy-darkness…`). Un `db push` local **no** actualiza producción. Ver [`DEPLOY.md`](../DEPLOY.md) § Schema drift y `.cursor/rules/neon-prod-parity.mdc`.

Local / manual:

```bash
DATABASE_URL="postgresql://…@ep-cool-mud-….us-west-2.aws.neon.tech/neondb?sslmode=require" npm run db:check-sync
```

### Secrets GitHub (obligatorios para prod)

Repo → Settings → Secrets and variables → Actions:

| Secret | Valor |
|--------|--------|
| `VERCEL_TOKEN` | [Vercel → Account → Tokens](https://vercel.com/account/tokens) |
| `VERCEL_ORG_ID` | `team_QxlnpSeR7a1AsZiXtKSsqWFJ` (team tutemorenos-projects) |
| `VERCEL_PROJECT_ID` | `prj_q87cwzCd7xVN7eDPzm81fDmjLKNz` |
| `DATABASE_URL_PRODUCTION` (opcional, recomendado) | Neon `main` connection string (prefer **direct**, no pooler) |
| `REVALIDATE_SECRET` (opcional) | Mismo secret que `POST /api/revalidate` en Vercel env — post-deploy HTTP tag/path bust |

Sin `VERCEL_*`, el push a `main` falla en el job de deploy (lint igual corre).
Sin `DATABASE_URL_PRODUCTION`, el gate intenta leer `DATABASE_URL` del `vercel pull`; si tampoco está, el job falla en el schema gate (no deploya).

## Runtime health

`GET /api/health` — selecciona campos críticos en `User` (`inAppNotificationsEnabled`) y existe `PushSubscription`. 503 + `schema_drift` si el schema de prod está roto.

## Branch protection

Repo **privado Free**: GitHub **no** permite rulesets / branch protection (`403` Pro).

Opciones:

1. **GitHub Pro** (o repo público) → Settings → Branches / Rulesets → require
   `lint-and-typecheck` en `development` y `main`.
2. Hasta entonces: **no mergear** PRs con `lint-and-typecheck` rojo (regla de equipo + agente).

Prod igual queda protegida: sin CI verde **no hay** deploy a `main` vía Actions; además el schema gate + health frenan drift.

## Vercel Deployment Checks (opcional extra)

Si querés freno también en el dashboard:
[Deployment Checks](https://vercel.com/tutemorenos-projects/rocha-cotizador/settings/deployment-checks)
→ Add Checks → GitHub → `lint-and-typecheck`.

Con el gate de Actions + `main: false`, esto es backup, no obligatorio.

Nota: preview sigue buildeando en paralelo al CI (comportamiento normal de Vercel).
