#!/usr/bin/env bash
# Pre-release gate for LumenCortex Desktop.
#
# Checks the repository state, the version/tag agreement, the Core module pin and the toolchain,
# then runs the backend and frontend test suites. It never builds a release artifact; see
# scripts/release-candidate.sh for the isolated build and packaging step.
#
# Usage: scripts/release-check.sh [--mode local|release] [--allow-dirty] [--with-visual] [--skip-tests]
#
#   --mode release  A publishable candidate: clean tree, HEAD tagged v<productVersion>, and the
#                   Core module pinned to a published SemVer tag (no pseudo-version, no replace,
#                   no go.work).
#   --mode local    A local candidate: a pseudo-version or a local replace is allowed and recorded
#                   as non-release by scripts/release-candidate.sh. Default.
#   --allow-dirty   Local mode only: list uncommitted changes as warnings instead of failing. The
#                   isolated build still uses the exact HEAD commit.
#   --with-visual   Also run the Playwright suite (requires installed browsers).
#   --skip-tests    Run only the static checks.
set -euo pipefail

cd "$(dirname "$0")/.."
# shellcheck source=scripts/release-lib.sh
source scripts/release-lib.sh

mode=local
allow_dirty=0
with_visual=0
skip_tests=0
while [[ $# -gt 0 ]]; do
  case "$1" in
    --mode) mode="${2:-}"; shift 2 ;;
    --mode=*) mode="${1#*=}"; shift ;;
    --allow-dirty) allow_dirty=1; shift ;;
    --with-visual) with_visual=1; shift ;;
    --skip-tests) skip_tests=1; shift ;;
    -h|--help) sed -n '2,18p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) lcx_die "unknown argument: $1" ;;
  esac
done
[[ "$mode" == local || "$mode" == release ]] || lcx_die "--mode must be local or release (got: $mode)"
if [[ "$allow_dirty" -eq 1 && "$mode" == release ]]; then
  lcx_die "--allow-dirty cannot be combined with --mode release"
fi

version="$(lcx_read_version .)"
lcx_semver "$version" || lcx_die "wails.json info.productVersion is not SemVer: '${version}' (run scripts/bump-version.sh X.Y.Z)"
expected_tag="v$version"

lcx_step "Repository state (mode: $mode)"
commit="$(git rev-parse HEAD)"
branch="$(git rev-parse --abbrev-ref HEAD)"
printf 'commit: %s\nbranch: %s\nversion: %s\n' "$commit" "$branch" "$version"

status="$(git status --porcelain --untracked-files=normal)"
tracked_changes="$(printf '%s\n' "$status" | grep -v '^?? ' | grep -v '^$' || true)"
untracked_files="$(printf '%s\n' "$status" | grep '^?? ' || true)"
if [[ -n "$tracked_changes" || -n "$untracked_files" ]]; then
  printf '\nUncommitted state:\n' >&2
  [[ -z "$tracked_changes" ]] || printf 'tracked modifications:\n%s\n' "$tracked_changes" >&2
  [[ -z "$untracked_files" ]] || printf 'untracked files (not ignored):\n%s\n' "$untracked_files" >&2
  if [[ "$allow_dirty" -eq 1 ]]; then
    printf 'Continuing because --allow-dirty was given; the isolated build uses only commit %s.\n' "$commit" >&2
  else
    lcx_die "working tree is not clean; commit or stash the changes (ignored files are allowed)"
  fi
else
  lcx_ok "working tree clean"
fi

tag=""
if tag_at_head="$(git describe --tags --exact-match HEAD 2>/dev/null)"; then
  tag="$tag_at_head"
fi
if [[ -n "$tag" && "$tag" != "$expected_tag" ]]; then
  lcx_die "tag $tag does not match wails.json info.productVersion (expected $expected_tag)"
fi
if [[ "$mode" == "release" && -z "$tag" ]]; then
  lcx_die "release mode requires the exact tag $expected_tag on HEAD (none found)"
fi
if [[ -n "$tag" ]]; then
  printf 'tag: %s (HEAD)\n' "$tag"
else
  printf 'tag: none (local candidate, not a published release)\n'
fi


lcx_step "Core module pin"
pin="$(lcx_core_pin)" || lcx_die "cannot read the Core module pin (go list -m failed)"
IFS='|' read -r core_version core_replace_path core_replace_version <<<"$pin"
[[ -n "$core_version" ]] || lcx_die "go.mod does not require github.com/edynasty/LumenCortex"
printf 'module: github.com/edynasty/LumenCortex %s\n' "$core_version"
if [[ -n "$core_replace_path" ]]; then
  printf 'replace: %s %s\n' "$core_replace_path" "$core_replace_version"
else
  printf 'replace: none\n'
fi
gowork="$(go env GOWORK 2>/dev/null || true)"
if [[ -n "$gowork" && "$gowork" != "off" ]]; then
  printf 'go.work: %s\n' "$gowork"
else
  printf 'go.work: none\n'
fi

if [[ "$mode" == release ]]; then
  [[ -z "$core_replace_path" ]] || lcx_die "release mode forbids a Core replace directive (found: $core_replace_path)"
  [[ -z "$gowork" || "$gowork" == "off" ]] || lcx_die "release mode forbids a go.work workspace ($gowork)"
  if lcx_pseudo_version "$core_version"; then
    lcx_die "release mode requires a published Core SemVer tag, not a pseudo-version ($core_version)"
  fi
  [[ "$core_version" =~ ^v[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z.-]+)?$ ]] ||
    lcx_die "release mode requires a Core SemVer tag (got: $core_version)"
  go mod download github.com/edynasty/LumenCortex ||
    lcx_die "cannot download the pinned Core module; publish the Core tag first"
  lcx_ok "Core pin $core_version is a published SemVer tag"
else
  if lcx_pseudo_version "$core_version" || [[ -n "$core_replace_path" ]]; then
    printf 'local candidate: the Core pin is not a published release; artifacts are recorded as non-release.\n'
  fi
  lcx_ok "Core pin recorded"
fi
go mod verify >/dev/null || lcx_die "go mod verify failed"

lcx_step "Toolchain"
lcx_toolchain_report
wails_path="$(lcx_wails_path)"
[[ -n "$wails_path" ]] || lcx_die "wails CLI not found (go install github.com/wailsapp/wails/v2/cmd/wails@v2.16.0)"
node_major="$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null || true)"
[[ "$node_major" =~ ^[0-9]+$ && "$node_major" -ge 22 ]] ||
  lcx_die "Node.js 22 or newer is required (found: $(node --version 2>/dev/null || printf 'missing'))"

if [[ "$skip_tests" -eq 1 ]]; then
  lcx_step "Tests skipped (--skip-tests)"
else
  lcx_step "Backend checks"
  go build ./...
  go vet ./...
  go test -count=1 ./...

  lcx_step "Frontend checks"
  (
    cd frontend
    if [[ ! -d node_modules ]]; then
      npm ci
    fi
    npx tsc --noEmit
    npm test
    npm run build
    if [[ "$with_visual" -eq 1 ]]; then
      npm run visual:test
    fi
  )
fi

lcx_step "Result"
lcx_ok "release check passed (mode=$mode, version=$version, commit=$commit)"
