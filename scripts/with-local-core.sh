#!/usr/bin/env bash
# Run a Desktop command against the sibling Core checkout, restoring module files on every exit.
# Usage: LCX_CORE_SOURCE=../LumenCortex-Core scripts/with-local-core.sh <command> [args...]
set -euo pipefail
cd "$(dirname "$0")/.."

if [[ $# -lt 1 ]]; then
  echo "usage: scripts/with-local-core.sh <command> [args...]" >&2
  exit 2
fi
core_source="${LCX_CORE_SOURCE:-../LumenCortex-Core}"
core_dir="$(cd "$core_source" && pwd)"
[[ -f "$core_dir/go.mod" ]] || { echo "Core checkout has no go.mod: $core_dir" >&2; exit 2; }
grep -q '^module github.com/edynasty/LumenCortex$' "$core_dir/go.mod" || { echo "not a LumenCortex Core module: $core_dir" >&2; exit 2; }

tmpdir="$(mktemp -d "${TMPDIR:-/tmp}/lcx-module-pin.XXXXXX")"
cp go.mod "$tmpdir/go.mod"
cp go.sum "$tmpdir/go.sum"
cleanup() {
  cp "$tmpdir/go.mod" go.mod
  cp "$tmpdir/go.sum" go.sum
  rm -rf "$tmpdir"
}
trap cleanup EXIT

go mod edit -replace="github.com/edynasty/LumenCortex=$core_dir"
"$@"
