#!/usr/bin/env bash
# Poll Vercel until a deployment for GITHUB_SHA is READY (or fail).
# Used after Git integration deploys asynchronously (development push).
# Requires: VERCEL_TOKEN, VERCEL_ORG_ID, VERCEL_PROJECT_ID, GITHUB_SHA
# Optional: WAIT_TARGET=production (default) | preview
set -euo pipefail

if [[ -z "${VERCEL_TOKEN:-}" || -z "${VERCEL_ORG_ID:-}" || -z "${VERCEL_PROJECT_ID:-}" || -z "${GITHUB_SHA:-}" ]]; then
  echo "error: VERCEL_TOKEN, VERCEL_ORG_ID, VERCEL_PROJECT_ID, and GITHUB_SHA are required." >&2
  exit 1
fi

WAIT_TARGET="${WAIT_TARGET:-production}"
SHA="$(printf '%s' "$GITHUB_SHA" | tr '[:upper:]' '[:lower:]')"
DEADLINE=$((SECONDS + 900))
SLEEP=8

echo "Waiting for ${WAIT_TARGET} deploy of ${SHA:0:7} on project ${VERCEL_PROJECT_ID}"

while (( SECONDS < DEADLINE )); do
  json="$(
    curl -sS -H "Authorization: Bearer ${VERCEL_TOKEN}" \
      "https://api.vercel.com/v6/deployments?projectId=${VERCEL_PROJECT_ID}&teamId=${VERCEL_ORG_ID}&limit=20"
  )"
  result="$(
    printf '%s' "$json" | SHA="$SHA" WAIT_TARGET="$WAIT_TARGET" node -e '
      const fs = require("fs");
      let data;
      try { data = JSON.parse(fs.readFileSync(0, "utf8")); } catch { process.stdout.write("parse_error"); process.exit(0); }
      const sha = process.env.SHA;
      const wantPreview = process.env.WAIT_TARGET === "preview";
      const list = Array.isArray(data.deployments) ? data.deployments : [];
      const sameSha = list.filter((d) => String(d.meta?.githubCommitSha || "").toLowerCase() === sha);
      const match = wantPreview
        ? sameSha.find((d) => d.target !== "production") || sameSha[0]
        : sameSha.find((d) => d.target === "production") || sameSha[0];
      if (!match) { process.stdout.write("missing"); process.exit(0); }
      const state = match.readyState || match.state || "unknown";
      const url = match.url || "";
      process.stdout.write(`${state} ${url}`);
    '
  )"
  state="${result%% *}"
  url="${result#* }"
  echo "  $(date -u +%H:%M:%S) ${result}"
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

echo "error: timed out waiting for ${WAIT_TARGET} deploy of ${SHA:0:7}" >&2
exit 1
