#!/usr/bin/env bash
# Kill stale Next dev for this repo (ports 3000/3001), then start with file logging.
set -euo pipefail

REPO="$(cd "$(dirname "$0")/.." && pwd)"
bash "$REPO/scripts/dev-clean.sh" --kill-only
rm -f "$REPO/.logs/dev.pid"
exec bash "$REPO/scripts/dev-with-logs.sh"
