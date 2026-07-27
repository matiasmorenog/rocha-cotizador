#!/usr/bin/env bash
# Guard critical admin chrome against Tailwind singleton CSS regressions.
# Historical outage: `hidden lg:block` on the desktop sidebar vanished when the
# utility was purged from the prod CSS chunk → sidebar stuck display:none.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CSS="$ROOT/src/app/globals.css"
NAV="$ROOT/src/components/admin/admin-nav.tsx"

fail() {
  echo "error: $*" >&2
  exit 1
}

has() {
  local pattern="$1"
  local file="$2"
  if command -v rg >/dev/null 2>&1; then
    rg -q "$pattern" "$file"
  else
    grep -Eq "$pattern" "$file"
  fi
}

has_line_pipe() {
  # stdin → filter lines matching $1 that also match $2
  local line_pat="$1"
  local needle="$2"
  if command -v rg >/dev/null 2>&1; then
    rg -n "$line_pat" | rg -q "$needle"
  else
    grep -E "$line_pat" | grep -Eq "$needle"
  fi
}

has 'admin-desktop-sidebar' "$CSS" \
  || fail "missing .admin-desktop-sidebar in src/app/globals.css (sidebar visibility must live here, not Tailwind)"

# Flag Tailwind visibility utilities only on className lines (comments may document the anti-pattern).
if has_line_pipe 'className' 'lg:block' <"$NAV"; then
  fail "src/components/admin/admin-nav.tsx must not use Tailwind lg:block on className — use .admin-desktop-sidebar in globals.css"
fi

echo "ok: admin chrome guards passed"
