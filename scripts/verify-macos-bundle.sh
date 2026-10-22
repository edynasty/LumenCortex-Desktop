#!/usr/bin/env bash
# Verify that a macOS .app bundle produced by `wails build` is complete, correctly versioned and
# launchable.
#
# Fails when Contents/MacOS is empty, CFBundleExecutable is missing or empty, the declared
# executable is absent/not executable, the binary is not Mach-O, the architecture does not match,
# the ad-hoc signature does not verify, the icon resource is missing, the Info.plist version or
# identifier disagrees with wails.json, the bundled binary's `--version` disagrees with the bundle,
# or the bundled binary's `--self-check` fails.
#
# Usage: scripts/verify-macos-bundle.sh ["build/bin/LumenCortex Desktop.app"] [arm64|x86_64|universal] [expected-version]
set -euo pipefail

bundle="${1:-build/bin/LumenCortex Desktop.app}"
expected_arch="${2:-$(uname -m)}"
expected_version="${3:-}"

# The identifier is Wails' derivation: "com.wails." + the lowercased project name with runs of
# non-alphanumerics replaced by "-" (wails v2.16 pkg/buildassets safeBundleID). wails.json's name is
# "LumenCortex Desktop"; override for a fork.
expected_bundle_id="${LCX_EXPECT_BUNDLE_ID:-com.wails.lumencortex-desktop}"

fail() {
  printf 'FAIL: %s\n' "$*" >&2
  exit 1
}

plist_value() {
  /usr/bin/plutil -extract "$1" raw -o - "$bundle/Contents/Info.plist" 2>/dev/null || true
}

[[ -d "$bundle" ]] || fail "app bundle not found: $bundle (run: wails build -platform darwin/$expected_arch)"
[[ -f "$bundle/Contents/Info.plist" ]] || fail "missing $bundle/Contents/Info.plist (incomplete bundle)"
[[ -d "$bundle/Contents/Resources" ]] || fail "missing $bundle/Contents/Resources (incomplete bundle)"

executable="$(plist_value CFBundleExecutable)"
[[ -n "$executable" ]] || fail "CFBundleExecutable is missing or empty in $bundle/Contents/Info.plist"

binary="$bundle/Contents/MacOS/$executable"
[[ -d "$bundle/Contents/MacOS" ]] || fail "missing $bundle/Contents/MacOS (incomplete bundle)"
[[ -f "$binary" ]] || fail "declared executable is missing: $binary (wails dev deletes its binary on exit; run wails build)"
[[ -s "$binary" ]] || fail "declared executable is empty: $binary"
[[ -x "$binary" ]] || fail "declared executable is not executable: $binary"

bundle_id="$(plist_value CFBundleIdentifier)"
[[ "$bundle_id" == "$expected_bundle_id" ]] ||
  fail "bundle identifier mismatch: Info.plist has '${bundle_id:-missing}', expected '$expected_bundle_id'"

short_version="$(plist_value CFBundleShortVersionString)"
bundle_version="$(plist_value CFBundleVersion)"
[[ -n "$short_version" ]] || fail "CFBundleShortVersionString is missing or empty"
[[ "$short_version" == "$bundle_version" ]] ||
  fail "Info.plist version mismatch: CFBundleShortVersionString='$short_version' CFBundleVersion='$bundle_version'"
if [[ -n "$expected_version" && "$short_version" != "$expected_version" ]]; then
  fail "Info.plist version '$short_version' does not match expected '$expected_version'"
fi

icon_name="$(plist_value CFBundleIconFile)"
[[ -n "$icon_name" ]] || fail "CFBundleIconFile is missing or empty"
icon_path="$bundle/Contents/Resources/${icon_name%.icns}.icns"
[[ -s "$icon_path" ]] || fail "bundle icon resource is missing or empty: $icon_path"

file_output="$(/usr/bin/file "$binary")"
case "$file_output" in
  *Mach-O*) ;;
  *) fail "not a Mach-O executable: $binary ($file_output)" ;;
esac

archs="$(/usr/bin/lipo -archs "$binary" 2>/dev/null || true)"
[[ -n "$archs" ]] || fail "cannot read architectures from $binary"
if [[ "$expected_arch" == "universal" ]]; then
  case " $archs " in *" arm64 "*) ;; *) fail "architecture mismatch: expected universal (arm64 + x86_64), found '$archs' in $binary" ;; esac
  case " $archs " in *" x86_64 "*) ;; *) fail "architecture mismatch: expected universal (arm64 + x86_64), found '$archs' in $binary" ;; esac
else
  case " $archs " in
    *" $expected_arch "*) ;;
    *) fail "architecture mismatch: expected $expected_arch, found '$archs' in $binary" ;;
  esac
fi

/usr/bin/codesign --verify --deep --strict "$bundle" >/dev/null 2>&1 ||
  fail "code signature does not verify: $bundle (run wails build to re-sign)"

# The bundled binary must agree with its own Info.plist and must be able to open a Core engine.
# --self-check uses a throwaway workspace and HOME, so verifying a bundle never touches user data.
version_json="$("$binary" --version 2>/dev/null)" || fail "bundled binary --version failed: $binary"
version_fields="$(
  printf '%s' "$version_json" | /usr/bin/python3 -c '
import json, sys
info = json.load(sys.stdin)
print("\t".join(str(info.get(key, "")) for key in
      ("appVersion", "commit", "coreVersion", "coreRuntimeVersion", "goVersion")))
' 2>/dev/null
)" || fail "bundled binary --version did not print the expected JSON: $version_json"
IFS=$'\t' read -r binary_version binary_commit core_version core_runtime go_version <<<"$version_fields"
[[ "$binary_version" == "$short_version" ]] ||
  fail "binary reports appVersion '$binary_version' but Info.plist says '$short_version'"
[[ -n "$binary_commit" ]] || fail "binary --version reports no commit"
[[ -n "$core_version" ]] || fail "binary --version reports no Core module version"
[[ -n "$core_runtime" ]] || fail "binary --version reports no Core runtime version"
[[ -n "$go_version" ]] || fail "binary --version reports no Go version"

self_check_json="$("$binary" --self-check 2>/dev/null)" || fail "bundled binary --self-check failed: $self_check_json"
self_check_ok="$(
  printf '%s' "$self_check_json" | /usr/bin/python3 -c '
import json, sys
result = json.load(sys.stdin)
print("ok" if result.get("ok") is True and isinstance(result.get("engine"), dict) else "failed")
' 2>/dev/null
)" || fail "bundled binary --self-check did not print the expected JSON: $self_check_json"
[[ "$self_check_ok" == "ok" ]] || fail "bundled binary --self-check did not report a healthy engine: $self_check_json"

printf 'OK: %s\n' "$bundle"
printf '    identifier: %s\n' "$bundle_id"
printf '    version: %s (%s)\n' "$short_version" "$binary_version"
printf '    executable: Contents/MacOS/%s\n' "$executable"
printf '    architecture: %s\n' "$archs"
printf '    commit: %s\n' "$binary_commit"
printf '    core: %s (runtime %s)\n' "$core_version" "$core_runtime"
printf '    self-check: ok\n'
