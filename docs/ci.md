# CI

Workflows:
- [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) — lint/typecheck (PRs ready + push)
- [`.github/workflows/preview-on-ready.yml`](../.github/workflows/preview-on-ready.yml) — Vercel preview when PR leaves draft (`ready_for_review`)
- [`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml) — push only (`main` ship + `development` cache purge)

## Draft PRs (sin checks)

Los PRs en **draft** no deben consumir CI ni previews:

| Superficie | Comportamiento |
|------------|----------------|
| GitHub Actions | Job `lint-and-typecheck` con `if: … draft == false`. También escucha `ready_for_review`. |
| Vercel Git (push) | `git.deploymentEnabled`: `development` + `**` (feature) on; `main` off. Draft push → ignore cancela build. |
| Vercel preview on ready | Job `vercel-preview` en [`preview-on-ready.yml`](../.github/workflows/preview-on-ready.yml): en `ready_for_review` hace checkout del PR head + `vercel pull` / `vercel build` / `vercel deploy --prebuilt` (solo **`rocha-cotizador`**, `VERCEL_PROJECT_ID`). Cubre el caso “último push fue en draft”. |
| Vercel ignore | [`scripts/vercel-ignore-draft-pr.sh`](../scripts/vercel-ignore-draft-pr.sh): draft cancela; ready procede en **`rocha-cotizador`**; **`rocha-cotizador-dev`** sin feature Preview (solo `development` / Production). Sigue activo en builds por push y en los disparados por Actions. |
| Push a `development` / `main` | CI en push. `development` Git-deploya Preview en **`rocha-cotizador`** (SSO) y Production en **`rocha-cotizador-dev`** (público). Prod `main` = Actions. |

**Proyecto prod** (`rocha-cotizador` / `prj_q87cwzCd…`): ready feature PR → Preview URL (Neon **development** vía Preview env). Draft → cancel. Push `development` → Preview (SSO). `main` = Actions-only (no Git auto-deploy).

**Proyecto demo** (`rocha-cotizador-dev` / `prj_Oagw7Pq3…`): **no** Preview de feature/ready PRs (ignore cancela). Solo deploya cuando hay push/merge a **`development`** → Production pública (`https://rocha-cotizador-dev.vercel.app`, portfolio). Mismo `vercel.json` que prod; el gate por `VERCEL_PROJECT_ID` vive en el ignore script.

**Vercel:** Preview env en **`rocha-cotizador`** necesita `GITHUB_TOKEN` o `GH_TOKEN` (`repo` / `pull_requests: read`). Sin token → fail-closed.

### Troubleshooting: preview “Canceled by Ignored Build Step”

| Síntoma | Causa | Qué hacer |
|---------|--------|-----------|
| Check verde pero descripción **Canceled by Ignored Build Step** en **`rocha-cotizador-dev`** en un feature PR | Esperado: ignore cancela previews de feature en el proyecto demo | Ignorar; el preview útil es **`rocha-cotizador`**. |
| **`rocha-cotizador`** cancelado; marcaste **Ready** sin push nuevo | El último build fue en **draft** (ignore canceló). Vercel Git solo buildea en **push**; `ready_for_review` no re-dispara Git hasta [`preview-on-ready.yml`](../.github/workflows/preview-on-ready.yml) esté en `development`. | Mergear el fix de preview-on-ready, o push vacío / **Redeploy** en Vercel; luego marcar ready de nuevo si hace falta. |
| **Todos** los feature PR ready cancelan en **`rocha-cotizador`** (incluso con push después de ready) | Falta o inválido `GITHUB_TOKEN`/`GH_TOKEN` en **Preview** del proyecto prod | Vercel → rocha-cotizador → Settings → Environment Variables: agregar `GITHUB_TOKEN` (PAT con **Contents: read** + **Pull requests: read**) solo en **Preview**. Redeploy. |

Probar ignore local (exit **1** = build procede):

```bash
export GITHUB_TOKEN="$(gh auth token)"
VERCEL_ENV=preview VERCEL_PROJECT_ID=prj_q87cwzCd7xVN7eDPzm81fDmjLKNz \
  VERCEL_GIT_COMMIT_REF=<branch> VERCEL_GIT_REPO_OWNER=matiasmorenog \
  VERCEL_GIT_REPO_SLUG=rocha-cotizador VERCEL_GIT_PULL_REQUEST_ID=<n> \
  bash scripts/vercel-ignore-draft-pr.sh; echo exit=$?
```

WIP → abrí **draft** (`gh pr create --draft`). Al marcar **Ready for review**: Actions (`lint-and-typecheck`) + job `vercel-preview` (API → build en **`rocha-cotizador`**). Pushes posteriores en ready siguen por Git integration.

## Job `lint-and-typecheck` (CI)

Corre en PR **ready**/push a `development` y `main`:

1. `npm ci`
2. `npx prisma generate` (con `DATABASE_URL` dummy; schema includes `rhel-openssl-3.0.x` for Vercel)
3. `npm run typecheck`
4. `npm run lint`
5. `npm run ci:check-admin-chrome` — exige `.admin-desktop-sidebar` en `globals.css` y falla si `admin-nav` usa `lg:block` (regresión Tailwind singleton)

Node 24. En PRs **no** aparecen jobs de deploy (viven en `deploy.yml`).

## Job `deploy-production` (Deploy workflow)

Solo en **push a `main`**, y **solo si** el `lint-and-typecheck` de ese workflow pasó:

1. `vercel pull` (env production)
2. **Pre-deploy schema sync** — `scripts/check-schema-sync.sh` (`prisma migrate diff` DB → `schema.prisma`). Falla el job si Neon `main` está detrás del código (drift).
3. `vercel build --prod`
4. `vercel deploy --prebuilt --prod`
5. **Post-deploy smoke** — `npm run ci:post-deploy-smoke`:
   - `GET /api/health` → 200 `{ ok: true }` (503/`schema_drift` si faltan columnas/tablas)
   - `GET /` (homepage) → 200
6. **Post-deploy cache revalidate** — [`scripts/post-deploy-cache.sh`](../scripts/post-deploy-cache.sh): purge CDN + Data Cache, `vercel cache invalidate` de **todas** las tags en `src/lib/cache-tags.ts` (`products`, `price-lists`, `customers`, `admin-dashboard`, `staff-users`, `subscription-payments`), Image Optimization de `/brand/*`, y `POST /api/revalidate` si existe `REVALIDATE_SECRET`.

`vercel.json` desactiva auto-deploy de Vercel en `main` → no hay carrera paralela.
`development` Git-deploya en **ambos** proyectos: Preview en `rocha-cotizador` (env `gitBranch=development` → Neon development) y Production en **`rocha-cotizador-dev`**. Ready feature PRs Preview solo en **`rocha-cotizador`**. Prod `main` = Actions.

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

Verificado vía API (`GET .../branches/{development,main}/protection`): **ninguna** rama protegida (404). Rulesets del repo: `[]`. En plan **privado Free**, GitHub no ofrece enforcement real de “block merge on conflicts” ni required checks sin **Pro** (o repo público).

### Qué pasó (ago 2026)

Varios PR (#106–#109) salieron del mismo `base` (`83c540a`, #103) y se mergearon seguidos. En la UI algunos quedaron **desactualizados** respecto a `development` mientras otro mergeaba el mismo archivo (`excel-sync-panel.tsx` en #107 vs #108). Sin branch protection, GitHub **no** exige “branch up to date” ni bloquea por política de repo; el squash se aplicó en cadena (`107` → `108` → `106` → `109`). **No** hay marcadores `<<<<<<<` en `development`; `tsc` y `lint` pasan. El riesgo es mergear con base vieja y perder hunks (GitHub a veces resuelve en silencio en squash), no un árbol roto con conflict markers.

**Antes de mergear:** `Update branch` / mergear `development` en el feature branch y esperar CI verde. Evitá mergear varios PR que tocan los mismos archivos en paralelo.

### Mitigación en CI (sin Pro)

Job **`merge-conflict-gate`** en [`ci.yml`](../.github/workflows/ci.yml): en PRs **ready**, falla solo si `mergeable_state` es `dirty` (conflictos de merge). Estados como `unstable` (checks fallando/pendientes) o `behind` no implican conflictos y pasan el gate. No reemplaza branch protection (un admin puede mergear igual), pero deja el conflicto en rojo en checks.

### Opciones con Pro

1. Settings → Branches / Rulesets en `development` y `main`: require status checks `lint-and-typecheck` + `merge-conflict-gate`, y **Require branches to be up to date before merging**.
2. Hasta entonces: **no mergear** con checks rojos ni con banner de conflictos (regla de equipo + agente).

Prod sigue acotada por Actions: sin `lint-and-typecheck` verde en el workflow de deploy no hay ship a `main`; schema gate + health frenan drift.

## Vercel Deployment Checks (opcional extra)

Si querés freno también en el dashboard:
[Deployment Checks](https://vercel.com/tutemorenos-projects/rocha-cotizador/settings/deployment-checks)
→ Add Checks → GitHub → `lint-and-typecheck`.

Con el gate de Actions + `main: false`, esto es backup, no obligatorio.

Nota: Preview de ready PR en `rocha-cotizador` buildea en paralelo al CI (comportamiento normal de Vercel).
