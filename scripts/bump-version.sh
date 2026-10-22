#!/usr/bin/env bash
# Change the Desktop application version. wails.json info.productVersion is the single source of
# truth: Wails writes it into the bundle's Info.plist and the build scripts compile it into the
# binary.
#
# Usage: scripts/bump-version.sh X.Y.Z
set -euo pipefail

cd "$(dirname "$0")/.."

version="${1:-}"
if [[ ! "$version" =~ ^[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z.-]+)?$ ]]; then
  echo "usage: scripts/bump-version.sh X.Y.Z (got: '${version}')" >&2
  exit 2
fi

/usr/bin/python3 - "$version" <<'PY'
import json
import sys

path = "wails.json"
with open(path, encoding="utf-8") as handle:
    config = json.load(handle)
info = config.setdefault("info", {})
info["productVersion"] = sys.argv[1]
with open(path, "w", encoding="utf-8") as handle:
    json.dump(config, handle, indent=2, ensure_ascii=False)
    handle.write("\n")
PY

printf 'wails.json info.productVersion is now %s.\n\n' "$version"
cat <<'EOF'
Follow-up steps:
  1. scripts/release-check.sh --mode local
  2. scripts/release-candidate.sh --mode local        # verify the DMG/ZIP and launch check
  3. Commit wails.json together with the release notes/report.
  4. For a published release: push the commit, create the tag, and let CI build it:
       git tag vX.Y.Z && git push origin main vX.Y.Z
     The tag must equal "v" + info.productVersion and point at the tested commit. Desktop tags
     require a published Core SemVer pin; release Core first. Do not tag or push without owner
     authorization.
EOF
