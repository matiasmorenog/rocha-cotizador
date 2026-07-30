#!/usr/bin/env bash
# Vercel Ignored Build Step — skip preview builds for GitHub draft PRs.
# Exit 0 = cancel build; exit 1 = proceed.
# Docs: https://vercel.com/docs/project-configuration/vercel-json#ignorecommand
#
# Requires Preview env var GITHUB_TOKEN (or GH_TOKEN) with repo / pull_requests:read
# so the GitHub API can see draft status on this private repo.
# Missing token or API errors on feature branches → fail closed (cancel build).

set -u

proceed() {
  echo "✅ $1 — build proceeds"
  exit 1
}

skip() {
  echo "🛑 $1 — build cancelled"
  exit 0
}

# Production ship is Actions-only (deploymentEnabled.main=false), but never
# draft-skip a production build if one is triggered another way.
if [[ "${VERCEL_ENV:-}" == "production" ]]; then
  proceed "production"
fi

# Integration / prod branches always build when Vercel is allowed to deploy them.
ref="${VERCEL_GIT_COMMIT_REF:-}"
if [[ "$ref" == "development" || "$ref" == "main" ]]; then
  proceed "branch ${ref}"
fi

owner="${VERCEL_GIT_REPO_OWNER:-}"
repo="${VERCEL_GIT_REPO_SLUG:-}"
pr_id="${VERCEL_GIT_PULL_REQUEST_ID:-}"
token="${GITHUB_TOKEN:-${GH_TOKEN:-}}"

if [[ -z "$owner" || -z "$repo" ]]; then
  skip "missing VERCEL_GIT_REPO_* (fail closed)"
fi

if [[ -z "$token" ]]; then
  # Without a token we cannot see draft status on a private repo. Fail closed
  # on feature branches so missing Preview env does not burn preview minutes.
  # Set GITHUB_TOKEN (or GH_TOKEN) in Vercel → Project → Env → Preview
  # (PAT or gh OAuth with pull_requests:read / repo).
  echo "⚠️ GITHUB_TOKEN/GH_TOKEN unset — cannot detect draft; fail closed"
  skip "no GitHub token (fail closed)"
fi

api="https://api.github.com"
auth=(-H "Authorization: Bearer ${token}" -H "Accept: application/vnd.github+json" -H "X-GitHub-Api-Version: 2022-11-28")

json_is_draft() {
  # stdin: GitHub PR JSON object → echo "true" or "false"
  # Prefer python; fall back to grep for minimal images.
  if command -v python3 >/dev/null 2>&1; then
    python3 -c 'import json,sys; d=json.load(sys.stdin); print("true" if d.get("draft") is True else "false")' 2>/dev/null || echo "false"
  else
    if grep -Eq '"draft"[[:space:]]*:[[:space:]]*true'; then
      echo "true"
    else
      echo "false"
    fi
  fi
}

fetch_pr_by_number() {
  curl -fsS "${auth[@]}" "${api}/repos/${owner}/${repo}/pulls/${1}"
}

fetch_open_prs_for_head() {
  # head filter is owner:branch
  local encoded_ref
  encoded_ref=$(python3 -c "import urllib.parse,sys; print(urllib.parse.quote(sys.argv[1], safe=''))" "$ref" 2>/dev/null || echo "$ref")
  curl -fsS "${auth[@]}" \
    "${api}/repos/${owner}/${repo}/pulls?state=open&head=${owner}:${encoded_ref}&per_page=5"
}

if [[ -n "$pr_id" ]]; then
  body="$(fetch_pr_by_number "$pr_id")" || skip "GitHub API error for PR #${pr_id} (fail closed)"
  draft="$(printf '%s' "$body" | json_is_draft)"
  if [[ "$draft" == "true" ]]; then
    skip "draft PR #${pr_id}"
  fi
  proceed "ready PR #${pr_id}"
fi

# Branch push with no PR id yet (or first deploy before id is wired): look up open PRs.
prs="$(fetch_open_prs_for_head)" || skip "GitHub API list error (fail closed)"

if command -v python3 >/dev/null 2>&1; then
  result="$(printf '%s' "$prs" | python3 -c '
import json, sys
try:
    items = json.load(sys.stdin)
except Exception:
    print("none")
    raise SystemExit(0)
if not isinstance(items, list) or not items:
    print("none")
elif any(p.get("draft") is True for p in items):
    print("draft")
else:
    print("ready")
')"
else
  if grep -Eq '"draft"[[:space:]]*:[[:space:]]*true' <<<"$prs"; then
    result="draft"
  elif grep -Eq '"number"' <<<"$prs"; then
    result="ready"
  else
    result="none"
  fi
fi

case "$result" in
  draft) skip "open draft PR for ${ref}" ;;
  ready) proceed "open ready PR for ${ref}" ;;
  *) proceed "no open PR for ${ref}" ;;
esac
