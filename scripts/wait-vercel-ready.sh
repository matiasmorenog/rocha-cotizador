#!/usr/bin/env bash
# Poll Vercel until a production deployment for GITHUB_SHA is READY (or fail).
# Used after push to development — Git integration builds asynchronously.
# Requires: VERCEL_TOKEN, VERCEL_ORG_ID, VERCEL_PROJECT_ID, GITHUB_SHA
set -euo pipefail

if [[ -z "${VERCEL_TOKEN:-}" || -z "${VERCEL_ORG_ID:-}" || -z "${VERCEL_PROJECT_ID:-}" || -z "${GITHUB_SHA:-}" ]]; then
  echo "error: VERCEL_TOKEN, VERCEL_ORG_ID, VERCEL_PROJECT_ID, and GITHUB_SHA are required." >&2
  exit 1
fi

SHA="$(printf '%s' "$GITHUB_SHA" | tr '[:upper:]' '[:lower:]')"
DEADLINE=$((SECONDS + 900))
SLEEP=8

echo "Waiting for production deploy of ${SHA:0:7} on project ${VERCEL_PROJECT_ID}"

while (( SECONDS < DEADLINE )); do
  json="$(
    curl -sS -H "Authorization: Bearer ${VERCEL_TOKEN}" \
      "https://api.vercel.com/v6/deployments?projectId=${VERCEL_PROJECT_ID}&teamId=${VERCEL_ORG_ID}&limit=20"
  )"
  result="$(
    printf '%s' "$json" | SHA="$SHA" node -e '
      const fs = require("fs");
      let data;
      try { data = JSON.parse(fs.readFileSync(0, "utf8")); } catch { process.stdout.write("parse_error"); process.exit(0); }
      const sha = process.env.SHA;
      const list = Array.isArray(data.deployments) ? data.deployments : [];
      const sameSha = list.filter((d) => String(d.meta?.githubCommitSha || "").toLowerCase() === sha);
      const prod = sameSha.find((d) => d.target === "production") || sameSha[0];
      if (!prod) { process.stdout.write("missing"); process.exit(0); }
      const state = prod.readyState || prod.state || "unknown";
      const url = prod.url || "";
      process.stdout.write(`${state} ${url}`);
    '
  )"
  state="${result%% *}"
  url="${result#* }"
  echo "  $(date -u +%H:%M:%S) → ${result}"
  case "$state" in
    READY)
      echo "ok: deployment READY https://${url}"
      exit 0
      ;;
    ERROR|CANCELED)
      echo "error: deployment ${state} https://${url}" >&2
      exit 1
      ;;
  esac
  sleep "$SLEEP"
done

echo "error: timed out waiting for production deploy of ${SHA:0:7}" >&2
exit 1
