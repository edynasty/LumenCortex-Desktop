#!/usr/bin/env bash
# Build, verify and package a macOS release candidate from the exact HEAD commit.
#
# The source is extracted with `git archive` into a temporary directory, so uncommitted work in the
# working tree can never leak into an artifact, and the development bundle build/bin is never
# touched. Artifacts go to build/releases/<version>/ (ignored) with SHA256SUMS, manifest.json and
# RELEASE_NOTES.md.
#
# Usage: scripts/release-candidate.sh [--mode local|release] [--arch arm64|universal] [--force]
#                                     [--skip-check] [--core <path>] [--core-ref <rev>]
#                                     [--overlay <path>]...
#
#   --mode local    (default) The Core pin may be a pseudo-version or a local replace; the build uses
#                   the sibling Core checkout and the artifacts are recorded as non-release.
#   --core-ref <rev> Build against a Core revision extracted from the sibling checkout instead of its
#                   working tree, so uncommitted Core work cannot leak into the artifact either.
#   --overlay <path> Copy a working-tree path over the extracted HEAD tree before building. This is
#                   for verifying a change set before it is committed: every overlaid path is
#                   recorded in manifest.json, and nothing else from the working tree is included.
#   --mode release  Requires the exact tag v<productVersion> on HEAD and a published Core SemVer pin.
#   --force         Move an existing build/releases/<version>/ to build/releases/.backup/<version>-<ts>
#                   instead of refusing to overwrite it.
#   --skip-check    Skip scripts/release-check.sh (CI runs it as a separate step).
set -Eeuo pipefail

cd "$(dirname "$0")/.."
# shellcheck source=scripts/release-lib.sh
source scripts/release-lib.sh

mode=local
arch=arm64
force=0
skip_check=0
core_source="${LCX_CORE_SOURCE:-../LumenCortex-Core}"
core_ref=""
overlays=()
while [[ $# -gt 0 ]]; do
  case "$1" in
    --mode) mode="${2:-}"; shift 2 ;;
    --mode=*) mode="${1#*=}"; shift ;;
    --arch) arch="${2:-}"; shift 2 ;;
    --arch=*) arch="${1#*=}"; shift ;;
    --core) core_source="${2:-}"; shift 2 ;;
    --core=*) core_source="${1#*=}"; shift ;;
    --core-ref) core_ref="${2:-}"; shift 2 ;;
    --core-ref=*) core_ref="${1#*=}"; shift ;;
    --overlay) overlays+=("${2:-}"); shift 2 ;;
    --overlay=*) overlays+=("${1#*=}"); shift ;;
    --force) force=1; shift ;;
    --skip-check) skip_check=1; shift ;;
    -h|--help) sed -n '2,23p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) lcx_die "unknown argument: $1" ;;
  esac
done
[[ "$mode" == local || "$mode" == release ]] || lcx_die "--mode must be local or release (got: $mode)"
lcx_arch_check "$arch"

version="$(lcx_read_version .)"
lcx_semver "$version" || lcx_die "wails.json info.productVersion is not SemVer: '${version}'"
commit="$(git rev-parse HEAD)"
tag=""
if tag_at_head="$(git describe --tags --exact-match HEAD 2>/dev/null)"; then
  tag="$tag_at_head"
fi
if [[ "$mode" == "release" && "$tag" != "v$version" ]]; then
  lcx_die "release mode requires tag v$version on HEAD (found: ${tag:-none})"
fi

out_root="build/releases"
out_dir="$out_root/$version"
backup_root="$out_root/.backup"

# Fail before the long build when the destination is taken.
if [[ -d "$out_dir" && -n "$(ls -A "$out_dir" 2>/dev/null)" && "$force" -eq 0 ]]; then
  lcx_die "refusing to overwrite non-empty $out_dir (pass --force to move it to $backup_root/<version>-<timestamp>)"
fi

if [[ "$skip_check" -eq 0 ]]; then
  check_args=(--mode "$mode")
  if [[ "$mode" == local ]]; then
    # The artifact is built from HEAD only, so a dirty working tree is recorded, not fatal.
    check_args+=(--allow-dirty)
  fi
  scripts/release-check.sh "${check_args[@]}"
fi

staging="$out_root/.staging/$version-$$"
mkdir -p "$staging"
log="$staging/build.log"
exec > >(tee -a "$log") 2>&1
on_error() {
  status=$?
  printf '\nFAILED (exit %s). Build log: %s\n' "$status" "$log" >&2
  exit "$status"
}
trap on_error ERR

work="$(mktemp -d "${TMPDIR:-/tmp}/lcx-rc.XXXXXX")"
mnt=""
# A mounted DMG must be detached before the temporary tree can be removed; a busy volume is retried
# and then force-detached, and if it is still mounted the tree is left in place rather than deleted.
detach_dmg() {
  [[ -n "$mnt" ]] || return 0
  for _ in 1 2 3 4 5; do
    if hdiutil detach "$mnt" -quiet >/dev/null 2>&1; then
      return 0
    fi
    sleep 1
  done
  hdiutil detach "$mnt" -force -quiet >/dev/null 2>&1 || true
  return 0
}
cleanup() {
  detach_dmg
  if [[ -n "$mnt" ]] && mount | grep -q " on ${mnt} "; then
    printf 'warning: DMG is still mounted at %s; leaving %s in place\n' "$mnt" "$work" >&2
    return 0
  fi
  rm -rf "$work"
}
trap cleanup EXIT

lcx_step "Source (commit $commit, mode $mode, arch $arch)"
src="$work/src"
mkdir -p "$src"
git archive --format=tar HEAD | tar -x -C "$src"
[[ -f "$src/wails.json" ]] || lcx_die "git archive did not produce a project tree"
if [[ "${#overlays[@]}" -gt 0 ]]; then
  for path in "${overlays[@]}"; do
    [[ -e "$path" ]] || lcx_die "overlay path does not exist: $path"
    [[ "$path" != /* ]] || lcx_die "overlay paths must be relative to the repository: $path"
    mkdir -p "$src/$(dirname "$path")"
    if [[ -d "$path" ]]; then
      mkdir -p "$src/$path"
      ditto "$path" "$src/$path"
    else
      ditto "$path" "$src/$path"
    fi
  done
  printf 'overlay (pre-commit files recorded in the manifest): %s\n' "${overlays[*]}"
fi
if [[ "$mode" == local ]]; then
  core_dir="$(cd "$core_source" && pwd)"
  [[ -f "$core_dir/go.mod" ]] || lcx_die "Core checkout has no go.mod: $core_dir"
  grep -q '^module github.com/edynasty/LumenCortex$' "$core_dir/go.mod" ||
    lcx_die "not a LumenCortex Core module: $core_dir"
  if [[ -n "$core_ref" ]]; then
    core_local_commit="$(git -C "$core_dir" rev-parse "${core_ref}^{commit}" 2>/dev/null)" ||
      lcx_die "unknown Core revision: $core_ref"
    core_dir_archive="$work/core"
    mkdir -p "$core_dir_archive"
    git -C "$core_dir" archive --format=tar "$core_local_commit" | tar -x -C "$core_dir_archive"
    core_dir="$core_dir_archive"
    core_desc="$core_source@$core_local_commit"
    printf 'core: %s at %s (local replace, non-release)\n' "$core_source" "$core_local_commit"
  else
    core_local_commit="$(git -C "$core_dir" rev-parse HEAD 2>/dev/null || printf 'unknown')"
    core_desc="$core_dir (working tree)"
    printf 'core: %s at %s (working tree, local replace, non-release)\n' "$core_dir" "$core_local_commit"
  fi
  (cd "$src" && go mod edit -replace="github.com/edynasty/LumenCortex=$core_dir")
  printf 'source: git archive of %s\n' "$commit"
else
  if (cd "$src" && go list -m -f '{{if .Replace}}{{.Replace.Path}}{{end}}' github.com/edynasty/LumenCortex | grep -q .); then
    lcx_die "release mode forbids a Core replace directive"
  fi
  printf 'source: git archive of %s (tag %s)\ncore: published module pin\n' "$commit" "$tag"
fi

lcx_step "Build"
(
  cd "$src"
  LCX_BUILD_ARCH="$arch" LCX_APP_VERSION="$version" LCX_APP_COMMIT="$commit" \
    scripts/build-macos.sh -clean -trimpath
)
app="$src/build/bin/LumenCortex Desktop.app"
[[ -d "$app" ]] || lcx_die "build produced no app bundle: $app"

if [[ "$skip_check" -eq 0 ]]; then
  # The pre-flight check ran against the working tree; these run against the extracted commit plus
  # the declared overlay, which is what actually ships. wails build already installed node_modules.
  lcx_step "Artifact source checks"
  (cd "$src" && go build ./... && go vet ./... && go test -count=1 ./...)
  (cd "$src/frontend" && npx tsc --noEmit && npm test)
fi

lcx_step "Package"
base="LumenCortex-Desktop-${version}-macos-${arch}"
dmg="$staging/${base}.dmg"
zip_path="$staging/${base}.zip"
dmg_stage="$work/dmg"
mkdir -p "$dmg_stage"
ditto "$app" "$dmg_stage/LumenCortex Desktop.app"
ln -s /Applications "$dmg_stage/Applications"
hdiutil create -quiet -volname "LumenCortex Desktop ${version}" -srcfolder "$dmg_stage" -ov -format UDZO "$dmg"
ditto -c -k --sequesterRsrc --keepParent "$app" "$zip_path"
printf 'dmg: %s\nzip: %s\n' "$dmg" "$zip_path"

lcx_step "Verify DMG"
# hdiutil can transiently fail with EAGAIN when the disk-image state is busy (a stale attached image
# from an interrupted run, for example). Retry before declaring the artifact broken.
verify_attempt=0
until hdiutil verify "$dmg" >/dev/null 2>&1; do
  verify_attempt=$((verify_attempt + 1))
  [[ "$verify_attempt" -lt 3 ]] || lcx_die "hdiutil verify failed for $dmg"
  sleep 2
done
lcx_ok "hdiutil verify"
mnt="$work/mnt"
mkdir -p "$mnt"
mnt="$(cd "$mnt" && pwd -P)"
attach_attempt=0
until hdiutil attach -readonly -nobrowse -noautoopen -mountpoint "$mnt" "$dmg" >/dev/null 2>&1; do
  attach_attempt=$((attach_attempt + 1))
  [[ "$attach_attempt" -lt 3 ]] || lcx_die "cannot mount $dmg read-only"
  sleep 2
done
[[ -L "$mnt/Applications" ]] || lcx_die "DMG has no /Applications symlink"
[[ "$(readlink "$mnt/Applications")" == "/Applications" ]] || lcx_die "DMG Applications link does not point at /Applications"
scripts/verify-macos-bundle.sh "$mnt/LumenCortex Desktop.app" "$arch" "$version"
detach_dmg
mnt=""

lcx_step "Verify ZIP"
unzip -tq "$zip_path" >/dev/null
lcx_ok "zip integrity"
extract="$work/extract"
mkdir -p "$extract"
ditto -x -k "$zip_path" "$extract"
scripts/verify-macos-bundle.sh "$extract/LumenCortex Desktop.app" "$arch" "$version"

lcx_step "Launch check"
launch_log="$work/launch.log"
launch_seconds="${LCX_LAUNCH_SECONDS:-8}"
if launch_result="$(lcx_launch_check "$extract/LumenCortex Desktop.app" "$launch_seconds" "$launch_log")"; then
  lcx_ok "launch check: $launch_result"
  cp "$launch_log" "$staging/launch.log"
else
  lcx_die "launch check failed (log: $launch_log)"
fi

lcx_step "Checksums"
(
  cd "$staging"
  shasum -a 256 "$(basename "$dmg")" "$(basename "$zip_path")" > SHA256SUMS
)
cat "$staging/SHA256SUMS"

lcx_step "Manifest and release notes"
app_json="$("$app/Contents/MacOS/LumenCortex" --version)"
app_field() {
  printf '%s' "$app_json" | /usr/bin/python3 -c 'import json,sys; print(json.load(sys.stdin).get(sys.argv[1], ""))' "$1"
}
core_artifact_version="$(app_field coreVersion)"
core_required_version="$(cd "$src" && go list -m -f '{{.Version}}' github.com/edynasty/LumenCortex 2>/dev/null || true)"
core_version="${core_required_version:-$core_artifact_version}"
core_local="$(app_field coreLocal)"
core_local_path="$(app_field coreLocalPath)"
core_runtime="$(app_field coreRuntimeVersion)"
artifact_go="$(app_field goVersion)"
wails_path="$(lcx_wails_path)"
wails_version=""
if [[ -n "$wails_path" ]]; then wails_version="$("$wails_path" version 2>/dev/null | sed -n '1p')"; fi
release_pinned=false
if [[ "$mode" == release && "$core_local" != "True" && "$core_local" != "true" ]] && ! lcx_pseudo_version "$core_version"; then
  release_pinned=true
fi

prev_tag="$(git describe --tags --abbrev=0 HEAD 2>/dev/null || true)"
if [[ -n "$prev_tag" ]]; then
  change_range="$prev_tag..HEAD"
  changes_scope="since $prev_tag"
else
  change_range="HEAD"
  changes_scope="since the first commit (no previous tag)"
fi
git --no-pager log -n 40 --pretty=format:'- %h %s' "$change_range" > "$staging/changes.txt" || true

LCX_MANIFEST_PATH="$staging/manifest.json" \
LCX_VERSION="$version" \
LCX_MODE="$mode" \
LCX_COMMIT="$commit" \
LCX_TAG="$tag" \
LCX_ARCH="$arch" \
LCX_CORE_VERSION="$core_version" \
LCX_CORE_ARTIFACT_VERSION="$core_artifact_version" \
LCX_CORE_LOCAL="$core_local" \
LCX_CORE_LOCAL_PATH="$core_local_path" \
LCX_CORE_LOCAL_DESC="${core_desc:-}" \
LCX_CORE_LOCAL_COMMIT="${core_local_commit:-}" \
LCX_CORE_RUNTIME="$core_runtime" \
LCX_CORE_RELEASE_PINNED="$release_pinned" \
LCX_ARTIFACT_GO="$artifact_go" \
LCX_GO="$(go version | awk '{print $3}')" \
LCX_NODE="$(node --version)" \
LCX_NPM="$(npm --version)" \
LCX_WAILS="$wails_version" \
LCX_MACOS="$(sw_vers -productVersion)" \
LCX_XCODE="$(xcode-select -p)" \
LCX_DMG="$dmg" \
LCX_ZIP="$zip_path" \
LCX_LAUNCH_RESULT="$launch_result" \
LCX_OVERLAY="${overlays[*]:-}" \
/usr/bin/python3 - <<'PY'
import hashlib, json, os
from datetime import datetime, timezone

def artifact(path):
    digest = hashlib.sha256()
    with open(path, "rb") as handle:
        for chunk in iter(lambda: handle.read(1 << 20), b""):
            digest.update(chunk)
    return {"name": os.path.basename(path), "size": os.path.getsize(path), "sha256": digest.hexdigest()}

env = os.environ
manifest = {
    "schema": 1,
    "app": "LumenCortex Desktop",
    "version": env["LCX_VERSION"],
    "buildMode": env["LCX_MODE"],
    "release": env["LCX_MODE"] == "release",
    "gitCommit": env["LCX_COMMIT"],
    "gitTag": env["LCX_TAG"] or None,
    "dirty": False,
    "overlay": env["LCX_OVERLAY"].split() if env["LCX_OVERLAY"] else [],
    "arch": env["LCX_ARCH"],
    "builtAt": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
    "core": {
        "module": "github.com/edynasty/LumenCortex",
        "version": env["LCX_CORE_VERSION"],
        "artifactVersion": env["LCX_CORE_ARTIFACT_VERSION"],
        "releasePinned": env["LCX_CORE_RELEASE_PINNED"] == "true",
        "local": env["LCX_CORE_LOCAL"] in ("True", "true"),
        "localPath": env["LCX_CORE_LOCAL_DESC"] or env["LCX_CORE_LOCAL_PATH"] or None,
        "localCommit": env["LCX_CORE_LOCAL_COMMIT"] or None,
        "runtimeVersion": env["LCX_CORE_RUNTIME"],
    },
    "toolchain": {
        "go": env["LCX_GO"],
        "artifactGo": env["LCX_ARTIFACT_GO"],
        "node": env["LCX_NODE"],
        "npm": env["LCX_NPM"],
        "wails": env["LCX_WAILS"],
        "macOS": env["LCX_MACOS"],
        "xcode": env["LCX_XCODE"],
    },
    "signing": "ad-hoc",
    "notarized": False,
    "artifacts": [artifact(env["LCX_DMG"]), artifact(env["LCX_ZIP"])],
    "verification": {
        "bundle": "ok",
        "dmg": "ok",
        "zip": "ok",
        "launch": env["LCX_LAUNCH_RESULT"],
    },
}
with open(env["LCX_MANIFEST_PATH"], "w", encoding="utf-8") as handle:
    json.dump(manifest, handle, indent=2, ensure_ascii=False)
    handle.write("\n")
PY

LCX_NOTES_PATH="$staging/RELEASE_NOTES.md" \
LCX_VERSION="$version" \
LCX_MODE="$mode" \
LCX_COMMIT="$commit" \
LCX_TAG="$tag" \
LCX_ARCH="$arch" \
LCX_CORE_VERSION="$core_version" \
LCX_CORE_ARTIFACT_VERSION="$core_artifact_version" \
LCX_CORE_RUNTIME="$core_runtime" \
LCX_CORE_LOCAL_PATH="$core_local_path" \
LCX_CORE_LOCAL_DESC="${core_desc:-}" \
LCX_CORE_RELEASE_PINNED="$release_pinned" \
LCX_CHANGES_SCOPE="$changes_scope" \
LCX_STAGING="$staging" \
LCX_OVERLAY="${overlays[*]:-}" \
LCX_DMG_NAME="$(basename "$dmg")" \
LCX_ZIP_NAME="$(basename "$zip_path")" \
/usr/bin/python3 - <<'PY'
import os

env = os.environ
staging = env["LCX_STAGING"]
with open(os.path.join(staging, "changes.txt"), encoding="utf-8") as handle:
    changes = handle.read().strip() or "- (no commits)"
with open(os.path.join(staging, "SHA256SUMS"), encoding="utf-8") as handle:
    checksums = handle.read().strip()
core_line = "%s (%s)" % (
    env["LCX_CORE_VERSION"],
    "local replace: " + (env["LCX_CORE_LOCAL_DESC"] or env["LCX_CORE_LOCAL_PATH"]) if (env["LCX_CORE_LOCAL_DESC"] or env["LCX_CORE_LOCAL_PATH"]) else "release-pinned",
)
if env["LCX_CORE_ARTIFACT_VERSION"] != env["LCX_CORE_VERSION"]:
    core_line += ", binary reports " + env["LCX_CORE_ARTIFACT_VERSION"]
status = (
    "Published release candidate."
    if env["LCX_MODE"] == "release"
    else "Local release candidate. Not a published release: it is built from the exact commit below "
    "with a local Core checkout and is intended for local testing only."
)
overlay_line = ""
if env.get("LCX_OVERLAY"):
    overlay_line = "\n- Pre-commit overlay (not yet in the commit): " + env["LCX_OVERLAY"].replace(" ", ", ")

notes = f"""# LumenCortex Desktop {env['LCX_VERSION']}

{status}

- Commit: `{env['LCX_COMMIT']}` ({('tag `' + env['LCX_TAG'] + '`') if env['LCX_TAG'] else 'untagged'})
- Architecture: {env['LCX_ARCH']}
- Core module: {core_line}
- Core runtime: {env['LCX_CORE_RUNTIME']}
- Build mode: {env['LCX_MODE']}{overlay_line}

## Changes {env['LCX_CHANGES_SCOPE']}

{changes}

## Artifacts

| File | SHA-256 |
| --- | --- |
| `{env['LCX_DMG_NAME']}` | see `SHA256SUMS` |
| `{env['LCX_ZIP_NAME']}` | see `SHA256SUMS` |

```
{checksums}
```

## Signing and notarization

- Signing: **ad-hoc** (`codesign --sign -`). This is not Developer ID signing.
- Notarization: **not notarized** (no Apple notary ticket, nothing stapled).

macOS Gatekeeper treats a downloaded ad-hoc-signed app as untrusted. For local use, right-click the
app and choose Open, or build it yourself with `scripts/release-candidate.sh`.

## Install

1. Open `{env['LCX_DMG_NAME']}` and drag **LumenCortex Desktop.app** to Applications, or run
   `scripts/install-local-macos.sh <dmg-or-app> [destination]` (default `~/Applications`).
2. The first launch creates the app's configuration under your home directory. Workspaces keep
   their state in `<workspace>/.lumencortex`.

## Upgrade

- Quit the app, then replace the bundle. `scripts/install-local-macos.sh` moves the previous app to
  `<destination>/.lumencortex-backups/<name>-<timestamp>.app` instead of overwriting it.
- Workspace data is not stored in the app bundle, so replacing the app does not touch it. Core
  migrates an older workspace database forward on first open; a database written by a newer Core is
  refused (`ErrSchemaTooNew`) rather than modified, so back up a workspace before downgrading.
"""
with open(env["LCX_NOTES_PATH"], "w", encoding="utf-8") as handle:
    handle.write(notes)
PY

lcx_step "Publish"
if [[ -d "$out_dir" ]]; then
  if [[ -n "$(ls -A "$out_dir" 2>/dev/null)" ]]; then
    [[ "$force" -eq 1 ]] ||
      lcx_die "refusing to overwrite non-empty $out_dir (pass --force to move it to $backup_root)"
    mkdir -p "$backup_root"
    backup="$backup_root/${version}-$(date -u +%Y%m%dT%H%M%SZ)"
    mv "$out_dir" "$backup"
    printf 'moved previous artifacts to %s\n' "$backup"
  else
    rmdir "$out_dir"
  fi
fi
mkdir -p "$out_root"
mv "$staging" "$out_dir"
lcx_ok "release candidate published"

printf '\nRelease candidate %s:\n' "$version"
printf '  directory: %s\n' "$out_dir"
printf '  dmg:       %s\n' "$out_dir/${base}.dmg"
printf '  zip:       %s\n' "$out_dir/${base}.zip"
printf '  checksums: %s\n' "$out_dir/SHA256SUMS"
printf '  manifest:  %s\n' "$out_dir/manifest.json"
printf '  notes:     %s\n' "$out_dir/RELEASE_NOTES.md"
printf '  log:       %s\n' "$out_dir/build.log"
