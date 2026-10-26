# CI

Workflows:
- [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) — lint/typecheck (PRs ready + push)
- [`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml) — push only (`main` ship + `development` cache purge)

Feature PR **preview deploys are off** (Hobby Function Storage). Validate via `lint-and-typecheck`; smoke on `rocha-cotizador-dev` after merge to `development`, or local.

## Draft PRs (sin checks)

Los PRs en **draft** no deben consumir CI:

| Superficie | Comportamiento |
|------------|----------------|
| GitHub Actions | Job `lint-and-typecheck` con `if: … draft == false`. También escucha `ready_for_review`. |
| Vercel Git (push) | Feature-branch builds on **`rocha-cotizador`** canceladas (ignore) + project `previewDeploymentsDisabled`. |
| Vercel ignore | [`scripts/vercel-ignore-draft-pr.sh`](../scripts/vercel-ignore-draft-pr.sh): feature en prod project → cancel. `development` → proceed for **`rocha-cotizador-dev`**. |
| Push a `development` / `main` | CI en push. `development` → Production en **`rocha-cotizador-dev`** (público / portfolio). Prod `main` = Actions. |

**Proyecto prod** (`rocha-cotizador` / `prj_q87cwzCd…`): sin preview de feature PRs. `main` = Actions-only.

**Proyecto demo** (`rocha-cotizador-dev` / `prj_Oagw7Pq3…`): **no** Preview de feature PRs. Solo deploya cuando hay push/merge a **`development`** → Production pública (`https://rocha-cotizador-dev.vercel.app`, portfolio).

### Checks en un PR ready (feature → `development`)

| Check | Necesario | Notas |
|-------|-----------|--------|
| `lint-and-typecheck` | Sí | tsc + eslint + admin-chrome |
| `Vercel – rocha-cotizador` | No (cancelado) | ignore / preview disabled |
| `Vercel – rocha-cotizador-dev` | No (cancelado) | demo project, esperado |

### Troubleshooting: “Canceled by Ignored Build Step”

| Síntoma | Causa | Qué hacer |
|---------|--------|-----------|
| **Canceled** en **`rocha-cotizador`** o **`rocha-cotizador-dev`** en feature PR | Esperado: no hay feature preview | Ignorar; esperar `lint-and-typecheck` verde. |

Probar ignore local (exit **0** = cancel, **1** = proceed):

```bash
VERCEL_ENV=preview VERCEL_PROJECT_ID=prj_q87cwzCd7xVN7eDPzm81fDmjLKNz \
  VERCEL_GIT_COMMIT_REF=feat/my-branch \
  bash scripts/vercel-ignore-draft-pr.sh; echo exit=$?
# feature branch → exit 0 (cancel)
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

Push `main`: lint/typecheck → schema gate → build → production deploy → smoke → cache.
Push `development`: cache purge for demo project (see workflow).

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
