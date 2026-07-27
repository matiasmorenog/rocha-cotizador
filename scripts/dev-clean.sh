#!/usr/bin/env bash
# Kill stale next/dev servers scoped to this repo, then start a clean `npm run dev`.
# Safe: never pkill node system-wide; only PIDs whose cwd is this workspace
# and/or listeners on 3000/3001 that belong to this repo.
set -euo pipefail

REPO="$(cd "$(dirname "$0")/.." && pwd)"
PORTS=(3000 3001)

kill_pid() {
  local pid="$1"
  if ! kill -0 "$pid" 2>/dev/null; then
    return 0
  fi
  kill "$pid" 2>/dev/null || true
  for _ in 1 2 3 4 5; do
    if ! kill -0 "$pid" 2>/dev/null; then
      return 0
    fi
    sleep 0.2
  done
  kill -9 "$pid" 2>/dev/null || true
}

pid_cwd() {
  lsof -a -p "$1" -d cwd 2>/dev/null | awk 'NR==2 {print $NF}'
}

echo "dev-clean: repo=$REPO"

# 1) Listeners on 3000/3001 whose cwd is this repo
for port in "${PORTS[@]}"; do
  while IFS= read -r pid; do
    [ -z "$pid" ] && continue
    cwd="$(pid_cwd "$pid" || true)"
    if [ "$cwd" = "$REPO" ]; then
      echo "dev-clean: kill port $port pid=$pid"
      kill_pid "$pid"
    else
      echo "dev-clean: skip port $port pid=$pid (cwd=${cwd:-unknown})"
    fi
  done < <(lsof -tiTCP:"$port" -sTCP:LISTEN 2>/dev/null || true)
done

# 2) next / next-server processes with cwd = repo (covers orphans not holding the port yet)
if command -v pgrep >/dev/null 2>&1; then
  while IFS= read -r pid; do
    [ -z "$pid" ] && continue
    cwd="$(pid_cwd "$pid" || true)"
    if [ "$cwd" = "$REPO" ]; then
      cmd="$(ps -p "$pid" -o command= 2>/dev/null || true)"
      case "$cmd" in
        *next*|*next-server*)
          echo "dev-clean: kill next pid=$pid"
          kill_pid "$pid"
          ;;
      esac
    fi
  done < <(pgrep -f "next" 2>/dev/null || true)
fi

# 3) Stale Next.js lock file
LOCK="$REPO/.next/dev/lock"
if [ -f "$LOCK" ]; then
  echo "dev-clean: remove $LOCK"
  rm -f "$LOCK"
fi

# Confirm ports free (or not ours)
for port in "${PORTS[@]}"; do
  if lsof -tiTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1; then
    pid="$(lsof -tiTCP:"$port" -sTCP:LISTEN | head -1)"
    cwd="$(pid_cwd "$pid" || true)"
    if [ "$cwd" = "$REPO" ]; then
      echo "dev-clean: ERROR port $port still held by repo pid=$pid" >&2
      exit 1
    fi
    echo "dev-clean: port $port still in use by other app (pid=$pid) — next may pick another port"
  else
    echo "dev-clean: port $port free"
  fi
done

if [ "${1:-}" = "--kill-only" ]; then
  echo "dev-clean: kill-only done"
  exit 0
fi

cd "$REPO"
echo "dev-clean: starting npm run dev"
exec npm run dev
