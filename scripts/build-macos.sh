#!/usr/bin/env bash
# Build the native macOS application bundle and verify that it is launchable.
#
# Extra arguments are passed to `wails build` (for example -v 2).
# Usage: scripts/build-macos.sh
set -euo pipefail

cd "$(dirname "$0")/.."

wails="$(command -v wails || true)"
if [[ -z "$wails" ]]; then
  gobin="$(go env GOPATH 2>/dev/null || true)/bin/wails"
  if [[ -x "$gobin" ]]; then
    wails="$gobin"
  else
    cat >&2 <<'EOF'
wails not found.
Install it and add the Go bin directory to PATH:
  go install github.com/wailsapp/wails/v2/cmd/wails@v2.16.0
  export PATH="$HOME/go/bin:$PATH"
EOF
    exit 1
  fi
fi

arch="$(uname -m)"

# `wails dev` writes its development binary into the same bundle and deletes it on
# exit, so a production build is required before the bundle can launch.
"$wails" build -platform "darwin/$arch" "$@"

exec "$(dirname "$0")/verify-macos-bundle.sh" "build/bin/LumenCortex Desktop.app" "$arch"
