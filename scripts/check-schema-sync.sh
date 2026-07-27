#!/usr/bin/env bash
# Fail if live DATABASE_URL schema drifts from prisma/schema.prisma.
# Used as pre-deploy gate on main (Neon production) so code never ships ahead of DB.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "error: DATABASE_URL is required (Neon target to check against)." >&2
  echo "hint: local .env = Neon development only — does NOT cover production." >&2
  exit 1
fi

# Log host only (never password). Helps catch wrong-DB mistakes.
host="$(
  node -e '
    try {
      const u = new URL(process.env.DATABASE_URL);
      process.stdout.write(u.hostname);
    } catch {
      process.stdout.write("(unparseable)");
    }
  '
)"
echo "Checking schema sync against host: ${host}"

if [[ "$host" == *"ep-noisy-darkness"* ]]; then
  echo "warn: host looks like Neon *development* (ep-noisy-darkness…)." >&2
  echo "warn: production gate must use Neon *main* (ep-cool-mud…)." >&2
fi

tmp="$(mktemp)"
trap 'rm -f "$tmp"' EXIT

set +e
npx prisma migrate diff \
  --from-url "$DATABASE_URL" \
  --to-schema-datamodel prisma/schema.prisma \
  --script \
  --exit-code >"$tmp" 2>&1
code=$?
set -e

case "$code" in
  0)
    echo "OK: database matches prisma/schema.prisma"
    exit 0
    ;;
  2)
    echo "FAIL: schema drift — database is behind (or ahead of) prisma/schema.prisma" >&2
    echo "---- SQL that would bring DB → schema ----" >&2
    cat "$tmp" >&2
    echo "------------------------------------------" >&2
    echo "Before release: prisma db push against Neon main DIRECT URL (not pooler, not local .env)." >&2
    echo "See DEPLOY.md § Schema drift / wrong DB." >&2
    exit 1
    ;;
  *)
    echo "FAIL: prisma migrate diff errored (exit ${code})" >&2
    cat "$tmp" >&2
    exit 1
    ;;
esac
