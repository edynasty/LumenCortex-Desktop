#!/usr/bin/env bash
# Build the native app against the sibling Core checkout without retaining a go.mod replace.
set -euo pipefail
cd "$(dirname "$0")/.."
exec scripts/with-local-core.sh scripts/build-macos.sh "$@"
