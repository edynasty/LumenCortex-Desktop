#!/usr/bin/env bash
# Verify that a macOS .app bundle produced by `wails build` is complete and launchable.
#
# Fails when Contents/MacOS is empty, CFBundleExecutable is missing or empty, the
# declared executable is absent/not executable, the binary is not Mach-O, the
# architecture does not match, or the ad-hoc signature does not verify.
#
# Usage: scripts/verify-macos-bundle.sh ["build/bin/LumenCortex Desktop.app"] [arm64|x86_64]
set -euo pipefail

bundle="${1:-build/bin/LumenCortex Desktop.app}"
expected_arch="${2:-$(uname -m)}"

fail() {
  printf 'FAIL: %s\n' "$*" >&2
  exit 1
}

[[ -d "$bundle" ]] || fail "app bundle not found: $bundle (run: wails build -platform darwin/$expected_arch)"
[[ -f "$bundle/Contents/Info.plist" ]] || fail "missing $bundle/Contents/Info.plist (incomplete bundle)"
[[ -d "$bundle/Contents/Resources" ]] || fail "missing $bundle/Contents/Resources (incomplete bundle)"

executable="$(/usr/bin/plutil -extract CFBundleExecutable raw -o - "$bundle/Contents/Info.plist" 2>/dev/null || true)"
[[ -n "$executable" ]] || fail "CFBundleExecutable is missing or empty in $bundle/Contents/Info.plist"

binary="$bundle/Contents/MacOS/$executable"
[[ -d "$bundle/Contents/MacOS" ]] || fail "missing $bundle/Contents/MacOS (incomplete bundle)"
[[ -f "$binary" ]] || fail "declared executable is missing: $binary (wails dev deletes its binary on exit; run wails build)"
[[ -s "$binary" ]] || fail "declared executable is empty: $binary"
[[ -x "$binary" ]] || fail "declared executable is not executable: $binary"

file_output="$(/usr/bin/file "$binary")"
case "$file_output" in
  *Mach-O*) ;;
  *) fail "not a Mach-O executable: $binary ($file_output)" ;;
esac

archs="$(/usr/bin/lipo -archs "$binary" 2>/dev/null || true)"
[[ -n "$archs" ]] || fail "cannot read architectures from $binary"
case " $archs " in
  *" $expected_arch "*) ;;
  *) fail "architecture mismatch: expected $expected_arch, found '$archs' in $binary" ;;
esac

/usr/bin/codesign --verify --deep --strict "$bundle" >/dev/null 2>&1 ||
  fail "code signature does not verify: $bundle (run wails build to re-sign)"

printf 'OK: %s\n' "$bundle"
printf '    executable: Contents/MacOS/%s\n' "$executable"
printf '    architecture: %s\n' "$archs"
