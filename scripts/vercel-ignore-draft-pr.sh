#!/usr/bin/env bash
# Vercel Ignored Build Step — cancel builds we do not want to pay for.
# Exit 0 = cancel build; exit 1 = proceed.
# Docs: https://vercel.com/docs/project-configuration/vercel-json#ignorecommand
#
# All Git-triggered builds are cancelled. Actions owns both ships on push to `main`:
# - rocha-cotizador (prod, Neon main)
# - rocha-cotizador-dev (portfolio demo, Neon development — project Production env)
#
# vercel.json also sets deploymentEnabled false for main / development / **.

set -u

skip() {
  echo "🛑 $1 — build cancelled"
  exit 0
}

skip "Git deploy disabled; Actions-only ship on main (prod + demo)"
