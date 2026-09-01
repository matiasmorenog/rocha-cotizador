#!/usr/bin/env bash
# Bootstrap a linked git worktree: .env from sibling checkout, free dev port, deps.
#
# Run inside any worktree after `git worktree add`:
#   bash scripts/worktree-bootstrap.sh
#
# Or use scripts/worktree-add.sh to create + bootstrap in one step.
set -euo pipefail

REPO="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO"

PORT_MIN="${WORKTREE_PORT_MIN:-3000}"
PORT_MAX="${WORKTREE_PORT_MAX:-3010}"

log() {
  echo "worktree-bootstrap: $*"
}

is_linked_worktree() {
  local git_dir
  git_dir="$(git rev-parse --git-dir)"
  [[ "$git_dir" == *"/.git/worktrees/"* ]]
}

list_worktrees() {
  git worktree list --porcelain | awk '/^worktree / {print $2}'
}

find_env_source() {
  if [ -n "${WORKTREE_ENV_SOURCE:-}" ]; then
    if [ -f "$WORKTREE_ENV_SOURCE" ]; then
      echo "$WORKTREE_ENV_SOURCE"
      return 0
    fi
    log "ERROR WORKTREE_ENV_SOURCE not found: $WORKTREE_ENV_SOURCE" >&2
    return 1
  fi

  local wt
  while IFS= read -r wt; do
    [ "$wt" = "$REPO" ] && continue
    if [ -f "$wt/.env" ]; then
      echo "$wt/.env"
      return 0
    fi
  done < <(list_worktrees)

  # Primary checkout last (may be the one we branched from).
  while IFS= read -r wt; do
    if [ -f "$wt/.env" ]; then
      echo "$wt/.env"
      return 0
    fi
  done < <(list_worktrees)

  return 1
}

port_in_use() {
  local port="$1"
  lsof -tiTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1
}

find_free_port() {
  local port="$1"
  while [ "$port" -le "$PORT_MAX" ]; do
    if ! port_in_use "$port"; then
      echo "$port"
      return 0
    fi
    port=$((port + 1))
  done
  return 1
}

read_auth_port() {
  local env_file="$1"
  local line url
  if [ ! -f "$env_file" ]; then
    echo "$PORT_MIN"
    return 0
  fi
  line="$(grep -E '^AUTH_URL=' "$env_file" | head -1 || true)"
  if [ -z "$line" ]; then
    echo "$PORT_MIN"
    return 0
  fi
  url="${line#AUTH_URL=}"
  url="${url%\"}"
  url="${url#\"}"
  if [[ "$url" =~ :([0-9]+)$ ]]; then
    echo "${BASH_REMATCH[1]}"
  else
    echo "$PORT_MIN"
  fi
}

set_auth_port() {
  local env_file="$1"
  local port="$2"
  if grep -qE '^AUTH_URL=' "$env_file"; then
    if [[ "$(uname)" == Darwin ]]; then
      sed -i '' -E "s|^AUTH_URL=.*|AUTH_URL=\"http://localhost:${port}\"|" "$env_file"
    else
      sed -i -E "s|^AUTH_URL=.*|AUTH_URL=\"http://localhost:${port}\"|" "$env_file"
    fi
  else
    echo "AUTH_URL=\"http://localhost:${port}\"" >>"$env_file"
  fi
}

log "repo=$REPO"

if ! is_linked_worktree; then
  log "primary checkout — skip .env copy (already yours)"
else
  if [ -f "$REPO/.env" ] && [ "${WORKTREE_FORCE_ENV:-0}" != "1" ]; then
    log ".env already exists (set WORKTREE_FORCE_ENV=1 to overwrite from sibling)"
  else
    ENV_SRC="$(find_env_source)" || {
      log "ERROR no sibling .env found — copy .env.example manually" >&2
      exit 1
    }
    cp "$ENV_SRC" "$REPO/.env"
    log "copied .env from $ENV_SRC"
  fi
fi

if [ -f "$REPO/.env" ]; then
  desired_port="$(read_auth_port "$REPO/.env")"
  if port_in_use "$desired_port"; then
    free_port="$(find_free_port "$PORT_MIN")" || {
      log "ERROR no free port between $PORT_MIN and $PORT_MAX" >&2
      exit 1
    }
    set_auth_port "$REPO/.env" "$free_port"
    log "port $desired_port busy — AUTH_URL -> http://localhost:$free_port"
  else
    log "AUTH_URL port $desired_port is free"
    free_port="$desired_port"
  fi
else
  free_port="$PORT_MIN"
  log "WARN no .env — create from .env.example before npm run dev"
fi

if [ ! -d "$REPO/node_modules" ]; then
  log "node_modules missing — npm install"
  npm install
else
  log "node_modules present — skip npm install"
fi

log "done"
if [ -f "$REPO/.env" ]; then
  echo ""
  echo "  Dev:  npm run dev:wt"
  echo "  Or:   npm run dev -- -p ${free_port:-$PORT_MIN}"
  echo "  URL:  http://localhost:${free_port:-$PORT_MIN}"
fi
