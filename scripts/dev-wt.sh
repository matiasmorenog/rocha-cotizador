#!/usr/bin/env bash
# Start dev on the port from AUTH_URL (.env) — for linked worktrees.
set -euo pipefail

REPO="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO"

PORT=3000
if [ -f .env ]; then
  line="$(grep -E '^AUTH_URL=' .env | head -1 || true)"
  if [ -n "$line" ]; then
    url="${line#AUTH_URL=}"
    url="${url%\"}"
    url="${url#\"}"
    if [[ "$url" =~ :([0-9]+)$ ]]; then
      PORT="${BASH_REMATCH[1]}"
    fi
  fi
fi

echo "dev-wt: starting on port $PORT (from AUTH_URL)"
exec npm run dev -- -p "$PORT"
