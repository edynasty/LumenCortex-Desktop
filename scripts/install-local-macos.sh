#!/usr/bin/env bash
# Install a packaged LumenCortex Desktop build into a per-user Applications directory.
#
# The source is verified before anything is written, an existing installation is moved to a
# timestamped backup instead of being overwritten, and the installed copy is verified again.
#
# Usage: scripts/install-local-macos.sh <dmg-or-app> [destination]
#   destination defaults to ~/Applications.
set -euo pipefail

cd "$(dirname "$0")/.."
# shellcheck source=scripts/release-lib.sh
source scripts/release-lib.sh

source_path="${1:-}"
dest="${2:-$HOME/Applications}"
if [[ -z "$source_path" ]]; then
  lcx_die "usage: scripts/install-local-macos.sh <dmg-or-app> [destination]"
fi
[[ -e "$source_path" ]] || lcx_die "no such file: $source_path"
case "$source_path" in
  *.dmg) kind=dmg ;;
  *.app) kind=app ;;
  *) lcx_die "expected a .dmg or an .app bundle: $source_path" ;;
esac

mnt=""
cleanup() {
  if [[ -n "$mnt" ]]; then
    hdiutil detach "$mnt" -quiet >/dev/null 2>&1 || true
    rmdir "$mnt" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

if [[ "$kind" == dmg ]]; then
  mnt="$(mktemp -d "${TMPDIR:-/tmp}/lcx-install-mnt.XXXXXX")"
  hdiutil attach -readonly -nobrowse -noautoopen -mountpoint "$mnt" "$source_path" >/dev/null
  app=""
  for candidate in "$mnt"/*.app; do
    if [[ -d "$candidate" ]]; then
      app="$candidate"
      break
    fi
  done
  [[ -n "$app" ]] || lcx_die "no .app bundle inside $source_path"
else
  app="$source_path"
fi

arch="$(uname -m)"
lcx_step "Verify source"
scripts/verify-macos-bundle.sh "$app" "$arch"

name="$(basename "$app")"
target="$dest/$name"
if [[ -e "$target" ]]; then
  lcx_step "Move existing installation aside"
  backup_root="$dest/.lumencortex-backups"
  mkdir -p "$backup_root"
  backup="$backup_root/${name%.app}-$(date -u +%Y%m%dT%H%M%SZ).app"
  mv "$target" "$backup"
  printf 'moved %s to %s\n' "$target" "$backup"
fi

lcx_step "Install"
mkdir -p "$dest"
ditto "$app" "$target"
scripts/verify-macos-bundle.sh "$target" "$arch"
lcx_ok "installed $target"
