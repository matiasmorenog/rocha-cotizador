#!/usr/bin/env bash
# Post-deploy smoke for production. Fail the Actions job on any non-200.
set -euo pipefail

BASE="${PRODUCTION_URL:-https://rocha-cotizador.vercel.app}"
BASE="${BASE%/}"
HEALTH_URL="${PRODUCTION_HEALTH_URL:-$BASE/api/health}"
HOME_URL="${PRODUCTION_HOME_URL:-$BASE/}"

probe() {
  local name="$1"
  local url="$2"
  local out="$3"
  local ok=0
  echo "Probing $name → $url"
  for i in 1 2 3 4 5 6; do
    local code
    code="$(curl -sS -o "$out" -w "%{http_code}" "$url" || echo 000)"
    echo "  attempt $i → HTTP $code"
    if [[ "$code" == "200" ]]; then
      ok=1
      break
    fi
    sleep 10
  done
  if [[ "$ok" != "1" ]]; then
    echo "FAIL: $name did not return 200 after deploy" >&2
    cat "$out" 2>/dev/null || true
    echo >&2
    return 1
  fi
  return 0
}

probe "health" "$HEALTH_URL" /tmp/health.json || {
  echo "If body has schema_drift: Neon main is behind prisma/schema.prisma — db push, redeploy." >&2
  exit 1
}
cat /tmp/health.json
echo

probe "homepage" "$HOME_URL" /tmp/home.html || exit 1
echo "ok: post-deploy smoke passed"
