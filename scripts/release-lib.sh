#!/usr/bin/env bash
# Shared helpers for the Desktop release scripts. Sourced, never executed.
#
# Bash 3.2 compatible: macOS still ships /bin/bash 3.2, so no mapfile, associative arrays, or
# ${var,,}.
# shellcheck shell=bash

lcx_die() {
  printf 'FAIL: %s\n' "$*" >&2
  exit 1
}

lcx_step() {
  printf '\n== %s ==\n' "$*"
}

lcx_ok() {
  printf 'OK: %s\n' "$*"
}

# lcx_read_version <repo-root> prints wails.json info.productVersion.
lcx_read_version() {
  /usr/bin/plutil -extract info.productVersion raw -o - "$1/wails.json" 2>/dev/null || true
}

# lcx_wails_path prints the wails CLI path, or nothing.
lcx_wails_path() {
  local wails
  wails="$(command -v wails || true)"
  if [[ -z "$wails" ]]; then
    wails="$(go env GOPATH 2>/dev/null || true)/bin/wails"
    [[ -x "$wails" ]] || wails=""
  fi
  printf '%s' "$wails"
}

# lcx_semver <version> succeeds for X.Y.Z or X.Y.Z-prerelease.
lcx_semver() {
  [[ "$1" =~ ^[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z.-]+)?$ ]]
}

# lcx_pseudo_version <version> succeeds for a Go pseudo-version (v0.0.0-<timestamp>-<rev>).
lcx_pseudo_version() {
  [[ "$1" =~ ^v[0-9]+\.[0-9]+\.[0-9]+-[0-9]{14}-[0-9a-f]{12}$ ]]
}

# lcx_arch_check <arch> validates the build architecture.
lcx_arch_check() {
  case "$1" in
    arm64|x86_64|universal) ;;
    *) lcx_die "unsupported architecture: $1 (expected arm64, x86_64, or universal)" ;;
  esac
}

# lcx_toolchain_report prints the toolchain used for a build or check.
lcx_toolchain_report() {
  local wails wails_version node npm
  wails="$(lcx_wails_path)"
  wails_version="missing"
  if [[ -n "$wails" ]]; then
    wails_version="$("$wails" version 2>/dev/null | sed -n '1p')"
  fi
  node="$(node --version 2>/dev/null || printf 'missing')"
  npm="$(npm --version 2>/dev/null || printf 'missing')"
  printf 'go: %s\n' "$(go version 2>/dev/null || printf 'missing')"
  printf 'node: %s\n' "$node"
  printf 'npm: %s\n' "$npm"
  printf 'wails: %s\n' "$wails_version"
  printf 'macOS: %s (%s)\n' "$(sw_vers -productVersion 2>/dev/null || printf 'unknown')" "$(uname -m)"
  printf 'xcode: %s\n' "$(xcode-select -p 2>/dev/null || printf 'missing')"
}

# lcx_core_pin prints "<version>|<replace-path>|<replace-version>" for the Core module.
lcx_core_pin() {
  go list -m -f '{{.Version}}|{{if .Replace}}{{.Replace.Path}}|{{.Replace.Version}}{{end}}' \
    github.com/edynasty/LumenCortex 2>/dev/null
}

# lcx_core_runtime_version prints Core's runtime version constant from the checkout at $1.
lcx_core_runtime_version() {
  sed -n 's/^const GoRuntimePreviewVersion = "\(.*\)"$/\1/p' "$1/runtime/engine.go" | sed -n '1p'
}

# lcx_launch_check <app-bundle> <seconds> <log-path>
# Launches the packaged app with an isolated HOME, confirms it stays alive, then stops it. It never
# installs anything and never touches the user's data directories.
lcx_launch_check() {
  local app="$1" seconds="$2" log="$3"
  local exe home pid i
  exe="$(/usr/bin/plutil -extract CFBundleExecutable raw -o - "$app/Contents/Info.plist" 2>/dev/null || true)"
  [[ -n "$exe" ]] || { printf 'launch check: no CFBundleExecutable in %s\n' "$app" >&2; return 1; }
  [[ -x "$app/Contents/MacOS/$exe" ]] || { printf 'launch check: not executable: %s\n' "$app/Contents/MacOS/$exe" >&2; return 1; }
  home="$(mktemp -d "${TMPDIR:-/tmp}/lcx-launch-home.XXXXXX")"
  mkdir -p "$home/.config"
  HOME="$home" XDG_CONFIG_HOME="$home/.config" "$app/Contents/MacOS/$exe" >"$log" 2>&1 &
  pid=$!
  for ((i = 0; i < seconds; i++)); do
    sleep 1
    if ! kill -0 "$pid" 2>/dev/null; then
      wait "$pid" 2>/dev/null || true
      printf 'launch check: process exited within %ss\n' "$i" >&2
      rm -rf "$home"
      return 1
    fi
  done
  kill -TERM "$pid" 2>/dev/null || true
  for ((i = 0; i < 10; i++)); do
    kill -0 "$pid" 2>/dev/null || break
    sleep 1
  done
  if kill -0 "$pid" 2>/dev/null; then
    kill -KILL "$pid" 2>/dev/null || true
    wait "$pid" 2>/dev/null || true
    rm -rf "$home"
    printf 'launch check: alive %ss but SIGTERM did not stop it (SIGKILL used)\n' "$seconds" >&2
    return 1
  fi
  wait "$pid" 2>/dev/null || true
  rm -rf "$home"
  printf 'alive %ss; terminated with SIGTERM' "$seconds"
}
