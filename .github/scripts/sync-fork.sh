#!/usr/bin/env bash

set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"

UPSTREAM_REMOTE="${UPSTREAM_REMOTE:-upstream}"
UPSTREAM_URL="${UPSTREAM_URL:-https://github.com/anomalyco/opencode.git}"
UPSTREAM_EDGE_BRANCH="${UPSTREAM_EDGE_BRANCH:-dev}"
PATCH_BRANCH_REF="${PATCH_BRANCH_REF:-refs/remotes/origin/fork-patches}"
EDGE_BRANCH="${EDGE_BRANCH:-main}"
STABLE_BRANCH="${STABLE_BRANCH:-stable}"
RELEASE_SUFFIX="${RELEASE_SUFFIX:-local.1}"
REPO_SLUG="${GITHUB_REPOSITORY:-}"
MANAGE_REPO_METADATA="${MANAGE_REPO_METADATA:-0}"

git remote get-url "$UPSTREAM_REMOTE" >/dev/null 2>&1 || git remote add "$UPSTREAM_REMOTE" "$UPSTREAM_URL"

git fetch --prune "$UPSTREAM_REMOTE" "+refs/heads/*:refs/remotes/$UPSTREAM_REMOTE/*" "+refs/tags/*:refs/tags/*"
git fetch --prune origin "+refs/heads/fork-patches:$PATCH_BRANCH_REF"

mapfile -t PATCH_COMMITS < <(git rev-list --reverse "refs/remotes/$UPSTREAM_REMOTE/$UPSTREAM_EDGE_BRANCH..$PATCH_BRANCH_REF")
if [ "${#PATCH_COMMITS[@]}" -eq 0 ]; then
  echo "No patch commits found between upstream/${UPSTREAM_EDGE_BRANCH} and ${PATCH_BRANCH_REF}" >&2
  exit 1
fi

LATEST_TAG=""
for tag in $(git tag --list 'v[0-9]*' --sort=-v:refname); do
  if [[ "$tag" =~ ^v[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    LATEST_TAG="$tag"
    break
  fi
done
if [ -z "$LATEST_TAG" ]; then
  echo "Failed to determine the latest upstream release tag" >&2
  exit 1
fi

TMPDIR="$(mktemp -d)"
cleanup() {
  git worktree remove --force "$TMPDIR/edge" >/dev/null 2>&1 || true
  git worktree remove --force "$TMPDIR/stable" >/dev/null 2>&1 || true
  rm -rf "$TMPDIR"
}
trap cleanup EXIT

build_branch() {
  local target_branch="$1"
  local base_ref="$2"
  local worktree_dir="$3"

  git worktree add --detach "$worktree_dir" "$base_ref" >/dev/null
  (
    cd "$worktree_dir"
    for commit in "${PATCH_COMMITS[@]}"; do
      git cherry-pick "$commit"
    done
    "$ROOT/.github/scripts/verify-local-web.sh"
    git push --force origin "HEAD:$target_branch"
    git rev-parse HEAD >"$TMPDIR/${target_branch}.sha"
  )
}

build_branch "$EDGE_BRANCH" "refs/remotes/$UPSTREAM_REMOTE/$UPSTREAM_EDGE_BRANCH" "$TMPDIR/edge"
build_branch "$STABLE_BRANCH" "$LATEST_TAG" "$TMPDIR/stable"

STABLE_SHA="$(cat "$TMPDIR/${STABLE_BRANCH}.sha")"
LOCAL_TAG="${LATEST_TAG}-${RELEASE_SUFFIX}"

git tag -fa "$LOCAL_TAG" "$STABLE_SHA" -m "OpenCode Local ${LOCAL_TAG} (upstream ${LATEST_TAG})"
git push --force origin "refs/tags/${LOCAL_TAG}"

if command -v gh >/dev/null 2>&1 && [ -n "${GH_TOKEN:-${GITHUB_TOKEN:-}}" ] && [ -n "$REPO_SLUG" ]; then
  RELEASE_NOTES="$TMPDIR/release-notes.md"
  cat >"$RELEASE_NOTES" <<EOF
Patched OpenCode Local release based on upstream \`${LATEST_TAG}\`.

Channels:

- \`${EDGE_BRANCH}\`: patched upstream \`${UPSTREAM_EDGE_BRANCH}\`
- \`${STABLE_BRANCH}\`: patched upstream \`${LATEST_TAG}\`
- \`${LOCAL_TAG}\`: immutable patched release tag

This fork only carries the local-web patch set needed to avoid mandatory runtime dependency on hosted OpenCode web infrastructure.
EOF

  if [ "$MANAGE_REPO_METADATA" = "1" ]; then
    gh api --method PATCH "repos/${REPO_SLUG}" \
      -f description='Local-web fork of OpenCode with no required runtime dependency on opencode.ai or models.dev for the core web UI.' \
      -f homepage='https://github.com/anomalyco/opencode' \
      -f default_branch="${EDGE_BRANCH}" >/dev/null

    gh api --method PUT "repos/${REPO_SLUG}/topics" \
      -H 'Accept: application/vnd.github+json' \
      -f names[]='opencode' \
      -f names[]='fork' \
      -f names[]='local-first' \
      -f names[]='self-hosted' \
      -f names[]='ai-agent' >/dev/null
  fi

  if gh release view "$LOCAL_TAG" --repo "$REPO_SLUG" >/dev/null 2>&1; then
    gh release edit "$LOCAL_TAG" \
      --repo "$REPO_SLUG" \
      --title "OpenCode Local ${LOCAL_TAG}" \
      --notes-file "$RELEASE_NOTES" >/dev/null
  else
    gh release create "$LOCAL_TAG" \
      --repo "$REPO_SLUG" \
      --title "OpenCode Local ${LOCAL_TAG}" \
      --notes-file "$RELEASE_NOTES" >/dev/null
  fi
fi
