#!/usr/bin/env bash
# Start Next dev with stdout/stderr tee'd to .logs/dev.log (terminal still shows output).
# macOS-friendly; pair with `npm run dev:logs` in a second terminal if the IDE console drops lines.
set -euo pipefail

REPO="$(cd "$(dirname "$0")/.." && pwd)"
LOG_DIR="$REPO/.logs"
LOG_FILE="$LOG_DIR/dev.log"
PID_FILE="$LOG_DIR/dev.pid"

mkdir -p "$LOG_DIR"

if [ -f "$PID_FILE" ]; then
  existing="$(cat "$PID_FILE")"
  if kill -0 "$existing" 2>/dev/null; then
    echo "dev-with-logs: already running (pid $existing)." >&2
    echo "dev-with-logs: follow logs → npm run dev:logs" >&2
    echo "dev-with-logs: restart → npm run dev:restart" >&2
    exit 1
  fi
  rm -f "$PID_FILE"
fi

cd "$REPO"
started_at="$(date '+%Y-%m-%dT%H:%M:%S%z' 2>/dev/null || date)"
echo "dev-with-logs: started $started_at"
echo "dev-with-logs: log file → $LOG_FILE"
echo "dev-with-logs: second terminal → npm run dev:logs"

: > "$LOG_FILE"
{
  echo "=== dev-with-logs session $started_at ==="
} >> "$LOG_FILE"

cleanup() {
  rm -f "$PID_FILE"
}
trap cleanup EXIT INT TERM

npx prisma generate

export FORCE_COLOR="${FORCE_COLOR:-1}"
export CI="${CI:-false}"

(
  exec npx next dev
) > >(tee -a "$LOG_FILE") 2> >(tee -a "$LOG_FILE" >&2) &
DEV_PID=$!
echo "$DEV_PID" > "$PID_FILE"
wait "$DEV_PID"
