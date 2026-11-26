# CI

Workflows:
- [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) — lint/typecheck (PRs ready + push)
- [`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml) — push `main` only: ship **prod** + **demo**
- [`.github/workflows/refresh-demo.yml`](../.github/workflows/refresh-demo.yml) — cron weekly + `workflow_dispatch`: `npm run dev:refresh-demo` on Neon **development** only

Feature PR **preview deploys are off**. Validate via `lint-and-typecheck`; smoke on `rocha-cotizador-dev` after merge to `main`, or local.

## Draft PRs (sin checks)

Los PRs en **draft** no deben consumir CI:

| Superficie | Comportamiento |
|------------|----------------|
| GitHub Actions | Job `lint-and-typecheck` con `if: … draft == false`. También escucha `ready_for_review`. |
| Vercel Git (push) | **Off** para todas las branches (`vercel.json` `deploymentEnabled` false) + ignore cancela residuales. |
| Vercel ignore | [`scripts/vercel-ignore-draft-pr.sh`](../scripts/vercel-ignore-draft-pr.sh): cancela **todo** Git build (Actions-only). |
| Push a `development` | CI only — **sin** deploy Vercel. |
| Push / merge a `main` | Actions: `deploy-production` (**`rocha-cotizador`**, Neon `main`) + `deploy-demo` (**`rocha-cotizador-dev`**, Neon `development`). |

**Proyecto prod** (`rocha-cotizador` / `prj_q87cwzCd…`): sin Git auto-deploy. `main` = Actions-only → Neon **main**.

**Proyecto demo** (`rocha-cotizador-dev` / `prj_Oagw7Pq3…`): sin Git auto-deploy ni Preview de PRs. Actions en `main` redeploya Production pública (`https://rocha-cotizador-dev.vercel.app`) con el **mismo SHA** que prod; env Production del proyecto demo = Neon **development** (`SEED_TARGET=development`). **No** apuntar `-dev` a Neon `main`.

### Checks en un PR ready (feature → `development`)

| Check | Necesario | Notas |
|-------|-----------|--------|
| `lint-and-typecheck` | Sí | tsc + eslint + admin-chrome |
| `Vercel – rocha-cotizador` | No (cancelado / off) | Git deploy disabled |
| `Vercel – rocha-cotizador-dev` | No (cancelado / off) | demo project, esperado |

### Troubleshooting: “Canceled by Ignored Build Step”

| Síntoma | Causa | Qué hacer |
|---------|--------|-----------|
| **Canceled** en **`rocha-cotizador`** o **`rocha-cotizador-dev`** en cualquier Git push/PR | Esperado: Actions-only | Ignorar; esperar `lint-and-typecheck` / jobs de `deploy.yml` en `main`. |

Probar ignore local (exit **0** = cancel, **1** = proceed):

```bash
VERCEL_ENV=preview VERCEL_GIT_COMMIT_REF=feat/my-branch \
  bash scripts/vercel-ignore-draft-pr.sh; echo exit=$?
# cualquier ref → exit 0 (cancel)
```

WIP → **draft** (`gh pr create --draft`). **Ready**: `lint-and-typecheck`. Cada push **ready** re-dispara CI.

## Job `lint-and-typecheck` (CI)

Corre en PR **ready** y push a `development`. En push a `main` solo corre en `deploy.yml` (evita duplicado con CI).

1. `npm ci`
2. `npx prisma generate` (con `DATABASE_URL` dummy; schema includes `rhel-openssl-3.0.x` for Vercel)
3. `npm run typecheck`
4. `npm run lint`
5. Admin chrome guards (sidebar visibility CSS)

## Deploy (`deploy.yml`)

Push `main` only (parallel after lint/typecheck):

| Job | Proyecto | DB | Pasos |
|-----|----------|----|--------|
| `deploy-production` | `rocha-cotizador` | Neon **main** | schema gate → build → deploy → smoke → cache |
| `deploy-demo` | `rocha-cotizador-dev` | Neon **development** (env Production del proyecto) | build → deploy → smoke → cache (**sin** schema gate de Neon main) |

Push `development`: **no** corre `deploy.yml`.

## Refresh demo (`refresh-demo.yml`)

Keeps portfolio/demo charts current on Neon **development** (stock + quotes relative to “today”).

| Trigger | When |
|---------|------|
| `schedule` | Mondays **09:00** America/Argentina (`0 12 * * 1` UTC) |
| `workflow_dispatch` | Actions → Run workflow (manual) |

- Env: `SEED_TARGET=development` + secret **`DATABASE_URL_DEVELOPMENT`** (Neon development; prefer **direct** host, same as local `.env` — not Production / not `DATABASE_URL_PRODUCTION`).
- Guard: `assertSafeDestructiveDb` refuses Neon `main`.
- Cron only runs from the **default** branch (`development`). Merge the workflow there before the first scheduled run.
- Manual local: `npm run dev:refresh-demo`.

## Branch protection

Verificado vía API (`GET .../branches/{development,main}/protection`): **ninguna** rama protegida (404). Rulesets del repo: `[]`. En plan **privado Free**, GitHub no ofrece enforcement real de “block merge on conflicts” ni required checks sin **Pro** (o repo público).

### Qué pasó (ago 2026)

Varios PR (#106–#109) salieron del mismo `base` (`83c540a`, #103) y se mergearon seguidos. En la UI algunos quedaron **desactualizados** respecto a `development` mientras otro mergeaba el mismo archivo (`excel-sync-panel.tsx` en #107 vs #108). Sin branch protection, GitHub **no** exige “branch up to date” ni bloquea por política de repo; el squash se aplicó en cadena (`107` → `108` → `106` → `109`). **No** hay marcadores `<<<<<<<` en `development`; `tsc` y `lint` pasan. El riesgo es mergear con base vieja y perder hunks (GitHub a veces resuelve en silencio en squash), no un árbol roto con conflict markers.

**Antes de mergear:** `Update branch` / mergear `development` en el feature branch, revisar banner de conflictos en GitHub, y esperar `lint-and-typecheck` verde.

### Opciones con Pro

1. Settings → Branches / Rulesets en `development` y `main`: require status check `lint-and-typecheck`, y **Require branches to be up to date before merging**.
2. Hasta entonces: **no mergear** con checks rojos ni con banner de conflictos (regla de equipo + agente).

Prod sigue acotada por Actions: sin `lint-and-typecheck` verde en el workflow de deploy no hay ship a `main`; schema gate + health frenan drift.

## Vercel Deployment Checks (opcional extra)

Si querés freno también en el dashboard:
[Deployment Checks](https://vercel.com/tutemorenos-projects/rocha-cotizador/settings/deployment-checks)
→ Add Checks → GitHub → `lint-and-typecheck`.

Con el gate de Actions + `main: false`, esto es backup, no obligatorio.
