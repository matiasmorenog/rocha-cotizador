#!/usr/bin/env bash
# Create a linked worktree and bootstrap it (.env, port, npm install).
#
# Usage:
#   bash scripts/worktree-add.sh <path> <branch> [base-branch]
#
# Examples:
#   bash scripts/worktree-add.sh ../rocha-cotizador-solapas-tabs feat/solapas-tabs development
#   bash scripts/worktree-add.sh ../rocha-cotizador-hotfix fix/auth-secret development
set -euo pipefail

MAIN="$(cd "$(dirname "$0")/.." && pwd)"

usage() {
  echo "Usage: bash scripts/worktree-add.sh <path> <branch> [base-branch]" >&2
  echo "  base-branch defaults to development" >&2
  exit 1
}

[ $# -ge 2 ] || usage

WT_PATH="$1"
BRANCH="$2"
BASE="${3:-development}"

# Resolve relative paths from repo root (not cwd).
case "$WT_PATH" in
  /*) ;;
  *) WT_PATH="$(cd "$MAIN/.." && pwd)/${WT_PATH#../}" ;;
esac

if [ -e "$WT_PATH" ]; then
  echo "worktree-add: ERROR path already exists: $WT_PATH" >&2
  exit 1
fi

cd "$MAIN"
git fetch origin "$BASE" 2>/dev/null || true

if git show-ref --verify --quiet "refs/heads/$BRANCH"; then
  echo "worktree-add: branch $BRANCH exists — checking out"
  git worktree add "$WT_PATH" "$BRANCH"
else
  echo "worktree-add: new branch $BRANCH from $BASE"
  git worktree add -b "$BRANCH" "$WT_PATH" "$BASE"
fi

bash "$WT_PATH/scripts/worktree-bootstrap.sh"

echo ""
echo "worktree-add: ready at $WT_PATH ($BRANCH)"
echo "  cd $WT_PATH && npm run dev:wt"
