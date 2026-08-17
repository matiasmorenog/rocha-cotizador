#!/usr/bin/env bash
# Purge Vercel CDN + Data Cache, invalidate Next.js tags, bust brand Image Optimization.
# Used after production (Actions) and after development-project deploys.
# Requires: VERCEL_TOKEN, VERCEL_ORG_ID, VERCEL_PROJECT_ID
# Optional: REVALIDATE_SECRET + APP_URL (or AUTH_URL) → POST /api/revalidate
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ -z "${VERCEL_ORG_ID:-}" || -z "${VERCEL_PROJECT_ID:-}" ]]; then
  echo "error: VERCEL_ORG_ID and VERCEL_PROJECT_ID are required." >&2
  exit 1
fi

# Keep in sync with src/lib/cache-tags.ts CACHE_TAGS.
TAGS="products,price-lists,customers,admin-dashboard"
# New mark + leftover optimizer entries from the old path.
SRCIMGS=(
  /brand/rocha-mark.png
  /brand/rocha-logo.png
  /brand/login-pattern-teal.png
)

# repo.json in this checkout points at the production project. Isolate CLI
# targeting so a development purge cannot hit rocha-cotizador by accident.
TMP="$(mktemp -d)"
cleanup() { rm -rf "$TMP"; }
trap cleanup EXIT
mkdir -p "$TMP/.vercel"
node -e '
  const fs = require("fs");
  fs.writeFileSync(
    process.argv[1],
    JSON.stringify({
      orgId: process.env.VERCEL_ORG_ID,
      projectId: process.env.VERCEL_PROJECT_ID,
    }),
  );
' "$TMP/.vercel/project.json"

vc() {
  if [[ -n "${VERCEL_TOKEN:-}" ]]; then
    vercel "$@" --cwd "$TMP" --yes --token "$VERCEL_TOKEN"
  else
    vercel "$@" --cwd "$TMP" --yes
  fi
}

echo "Purging CDN + Data Cache for project ${VERCEL_PROJECT_ID}"
vc cache purge --type cdn
vc cache purge --type data

echo "Invalidating Data Cache tags: ${TAGS}"
vc cache invalidate --tag "$TAGS"

for src in "${SRCIMGS[@]}"; do
  echo "Invalidating Image Optimization cache for ${src}"
  vc cache invalidate --srcimg "$src"
done

# HTTP path/tag bust — same helper as seed/DB scripts.
if [[ -x "$ROOT/node_modules/.bin/tsx" ]]; then
  echo "POST /api/revalidate via scripts/revalidate-app-cache.ts"
  "$ROOT/node_modules/.bin/tsx" "$ROOT/scripts/revalidate-app-cache.ts" || \
    echo "warn: revalidate helper failed to start (CDN/tag purge still ran)." >&2
else
  base="${APP_URL:-${AUTH_URL:-}}"
  base="${base%/}"
  if [[ -n "${REVALIDATE_SECRET:-}" && -n "$base" ]]; then
    echo "POST ${base}/api/revalidate"
    code="$(
      curl -sS -o /tmp/revalidate.json -w "%{http_code}" \
        -X POST "${base}/api/revalidate" \
        -H "Authorization: Bearer ${REVALIDATE_SECRET}" \
        -H "Content-Type: application/json" \
        || echo 000
    )"
    echo "  HTTP ${code}"
    cat /tmp/revalidate.json 2>/dev/null || true
    echo
    if [[ "$code" != "200" ]]; then
      echo "warn: /api/revalidate returned ${code} (CDN/tag purge still ran)." >&2
    fi
  else
    echo "Skip POST /api/revalidate (set REVALIDATE_SECRET and APP_URL to enable)."
  fi
fi

echo "ok: post-deploy cache purge finished"
