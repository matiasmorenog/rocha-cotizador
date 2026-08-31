#!/usr/bin/env bash
# Vercel Ignored Build Step — cancel builds we do not want to pay for.
# Exit 0 = cancel build; exit 1 = proceed.
# Docs: https://vercel.com/docs/project-configuration/vercel-json#ignorecommand
#
# Feature / ready PR previews: Actions job `vercel-preview` only (rocha-cotizador).
# Git integration skips feature-branch previews on the prod project to avoid duplicate
# checks (`Vercel – rocha-cotizador` + `vercel-preview`).
#
# Demo `rocha-cotizador-dev` (prj_Oagw7Pq3…): Git Production on push/merge to
# `development` only — never feature/ready PR Previews.

set -u

PROD_PROJECT_ID="prj_q87cwzCd7xVN7eDPzm81fDmjLKNz"

proceed() {
  echo "✅ $1 — build proceeds"
  exit 1
}

skip() {
  echo "🛑 $1 — build cancelled"
  exit 0
}

# True production builds (Actions on prod project; Git Production on demo project).
if [[ "${VERCEL_ENV:-}" == "production" ]]; then
  proceed "production"
fi

ref="${VERCEL_GIT_COMMIT_REF:-}"

# main auto-deploy is off in vercel.json; if something still hits ignore, cancel.
if [[ "$ref" == "main" ]]; then
  skip "main (Actions-only ship)"
fi

# Integration branch Preview (prod project) / any non-production hit with this ref.
if [[ "$ref" == "development" ]]; then
  proceed "branch ${ref}"
fi

# Demo project: never feature previews (only development Production).
if [[ "${VERCEL_PROJECT_ID:-}" != "$PROD_PROJECT_ID" ]]; then
  skip "feature preview only on prod project (rocha-cotizador)"
fi

# Prod project feature branches: Actions `vercel-preview` job (draft + ready).
skip "feature preview via Actions (vercel-preview job)"
