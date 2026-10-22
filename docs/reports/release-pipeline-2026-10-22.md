# macOS release pipeline — 2026-10-22

- **Status:** implemented and verified locally. A local arm64 release candidate was built from
  Desktop `af93c34` against Core `d2eaa01` and passed every verification step, including the launch
  check. CI workflows were updated to call the same scripts but were not executed. Signing and
  notarization are **not** implemented.
- **Baseline:** Desktop `af93c344940e2e121e2a331cbe406ca75f00b718` (branch `main`), Core
  `d2eaa01dbe01ce4b103865042f798a7d7efde75e`. No tags exist in either repository; nothing was
  committed, tagged or pushed.
- **Process contract:** [docs/release-process.md](../release-process.md); repository rules:
  Desktop `AGENTS.md` "Release and packaging contract", Core `AGENTS.md` "Core module release
  contract".

## What changed

### Version and diagnostics

- `wails.json` now carries `info` (`companyName`, `productName`, `productVersion: "0.1.0"`,
  `copyright`, `comments`). `info.productVersion` is the single version source: Wails writes it into
  `CFBundleShortVersionString`/`CFBundleVersion`, and the build scripts compile it into the binary.
- `version.go` (new): `appVersion`/`appCommit` injected by `-ldflags`; `--version` prints one JSON
  object with app version, commit, Core module version (`runtime/debug.ReadBuildInfo`, with a
  `replace` reported as `coreLocal`/`coreLocalPath`), Core runtime version
  (`runtime.GoRuntimePreviewVersion`) and Go version; `--self-check` additionally opens a Core
  Engine with `runtime.Open` over a fresh temp workspace and temp state dir (`Options.RepoDir`),
  with `HOME`/`XDG_CONFIG_HOME` pointed at the temp root, reports `Health()`, closes it and exits
  non-zero on failure.
- `main.go` handles both flags before `wails.Run` (no window) and shows the same versions in the
  macOS About box.
- Core APIs used: only those present at the pinned version. The pinned Core `d2eaa01` has no
  `Engine.Plugins()`, so the self-check omits the plugin list (the plugin platform is in flight in
  Core's working tree); add it when the pin moves.

### Scripts (Desktop)

| Script | Role |
| --- | --- |
| `scripts/release-lib.sh` (new) | Shared helpers: version read, toolchain report, Core pin, SemVer/pseudo-version predicates, isolated-HOME launch check. Bash 3.2 compatible. |
| `scripts/release-check.sh` (new) | Pre-flight gate: clean tree (tracked and non-ignored untracked), exact tag = `v` + version, Core pin rules per mode, toolchain, Go build/vet/test, frontend `tsc`/`vitest`/build, optional Playwright. |
| `scripts/release-candidate.sh` (new) | Isolated build from `git archive HEAD`, optional `--core-ref` and declared `--overlay`, DMG + ZIP + `SHA256SUMS` + `manifest.json` + `RELEASE_NOTES.md` under `build/releases/<version>/`, full verification, launch check, refuse/backup semantics. |
| `scripts/install-local-macos.sh` (new) | Verify source, back up an existing app under `<dest>/.lumencortex-backups/`, `ditto` install, verify result. Default `~/Applications`. |
| `scripts/bump-version.sh` (new) | Edits only `wails.json` `info.productVersion` and prints follow-up steps. |
| `scripts/build-macos.sh` | Now reads the version, injects `-ldflags "-X main.appVersion=… -X main.appCommit=…"` (unless the caller passes `-ldflags`) and passes the version to the bundle verifier. |
| `scripts/verify-macos-bundle.sh` | Now also verifies bundle identifier, `CFBundleShortVersionString` == `CFBundleVersion` (and == the expected version), `iconfile.icns`, the bundled binary's `--version` agreement and `--self-check`. |
| `scripts/package-macos.sh`, `scripts/package-local-macos.sh` | Removed: superseded by `release-candidate.sh`, which has the isolated build, versioned output, manifest and overwrite protection the old scripts lacked. `with-local-core.sh` remains for `build-local-macos.sh`. |

### CI and ignore rules

- Desktop `.github/workflows/release.yml`: tag `v*` → install deps + Playwright browser →
  `scripts/release-check.sh --mode release --with-visual` →
  `scripts/release-candidate.sh --mode release --arch universal --skip-check` → attach DMG, ZIP,
  `SHA256SUMS`, `manifest.json`, `RELEASE_NOTES.md`.
- Core `.github/workflows/release.yml`: tag `v*` → `scripts/release-check.sh --mode release` →
  GitHub Release.
- `.gitignore`: added `frontend/test-results/` and `frontend/playwright-report/`; release artifacts
  stay under the already-ignored `build/releases/`.

### Core

- `scripts/release-check.sh` (new): clean tree, exact tag, version agreement, toolchain, then
  `go mod verify`, `go build ./...`, `go vet ./...`, `go test -count=1 ./...`. Version agreement is
  the numeric core of `runtime.GoRuntimePreviewVersion` (`0.1.0-preview` ↔ tag `v0.1.0`), so the
  runtime may stay marked preview while the module tag is stable. `runtime/engine.go` was not
  changed.

## Verified evidence

Environment: macOS 27.0.1 (arm64), Go 1.26.5, Node v24.20.0, npm 11.19.0, Wails CLI v2.16.0, Xcode
CLT at `/Applications/Xcode.app/Contents/Developer`.

### Release candidate

Command (pre-commit change set; the working tree carries other agents' uncommitted work):

```bash
scripts/release-candidate.sh --mode local --arch arm64 --core-ref HEAD \
  --overlay main.go --overlay version.go --overlay wails.json --overlay scripts
```

Result: exit 0. The source was `git archive` of Desktop `af93c34`; Core was `git archive` of the
sibling checkout at `d2eaa01`, applied with a local `replace` inside the temporary tree. Nothing was
read from `build/bin` and nothing was written to `/Applications`.

Steps printed by the run, all OK:

1. `release-check.sh --mode local --allow-dirty` (working-tree pre-flight): repository state, Core
   pin, toolchain, `go build/vet/test`, `npx tsc --noEmit`, 334 Vitest tests, production build. This
   tree also carries other agents' uncommitted frontend work.
2. Isolated build (`wails build -clean -trimpath`) with the injected version/commit.
3. Bundle verification: `com.wails.lumencortex-desktop`, version `0.1.0` in both Info.plist keys and
   in the binary, arm64, `commit af93c34…`, `--self-check` ok.
4. `hdiutil verify`, read-only DMG mount, `Applications` symlink → `/Applications`, app inside the
   image verified, detached.
5. `unzip -tq`, ZIP extraction, extracted app verified.
6. Launch check: the extracted app started with an isolated `HOME`, stayed alive 8 s and terminated
   with `SIGTERM`.
7. Artifact-source checks (Go build/vet/test and frontend `tsc` + 327 Vitest tests inside the
   extracted tree — the commit plus the declared overlay, i.e. what actually ships).
8. `SHA256SUMS`, `manifest.json`, `RELEASE_NOTES.md`, published to `build/releases/0.1.0/`.

Artifacts (final run):

| File | Size | SHA-256 |
| --- | --- | --- |
| `LumenCortex-Desktop-0.1.0-macos-arm64.dmg` | 7,684,661 bytes (7.3 MB) | `86086004cdfe1effef2c122b188dc1dc9cfdeab7287bdb59c2270bd66b61aad0` |
| `LumenCortex-Desktop-0.1.0-macos-arm64.zip` | 6,901,249 bytes (6.6 MB) | `9f9fa49eaba17fffb051c63f9ac915784d5b403ac0169d53fa5580b1a52c28a6` |

`manifest.json` records `buildMode: local`, `release: false`, `dirty: false` (the artifact comes from
the exact commit), the overlay list, Core `v0.0.0-20261022025533-d2eaa01dbe01` with
`releasePinned: false`, `local: true`, `localCommit d2eaa01…`, `runtimeVersion 0.1.0-preview`,
toolchain versions, artifact sizes/hashes, `signing: ad-hoc`, `notarized: false` and the launch
result.

### Failure modes demonstrated

- **Dirty tree in release mode:** `scripts/release-check.sh --mode release` → exit 1,
  `FAIL: working tree is not clean; commit or stash the changes (ignored files are allowed)`, after
  listing the tracked modifications and non-ignored untracked files.
- **Overwrite refusal:** running `release-candidate.sh` again for an existing version → exit 1,
  `FAIL: refusing to overwrite non-empty build/releases/0.1.0 (pass --force to move it to
  build/releases/.backup/<version>-<timestamp>)`.
- **`--force` backup:** each forced run moved the previous directory to
  `build/releases/.backup/0.1.0-<timestamp>` before publishing.
- **Failure keeps previous artifacts:** an interrupted run failed at `hdiutil verify` (transient
  `resource temporarily unavailable`); `build/releases/0.1.0/` from the previous successful run was
  untouched, and the failed run left its `build.log` in
  `build/releases/.staging/0.1.0-<pid>/`. The DMG itself verified afterwards, so `hdiutil verify`
  and `hdiutil attach` now retry before failing.
- **`--self-check` failure exit:** with an unusable `TMPDIR`, the binary printed
  `self-check failed: create temp root: …` and exited 1.

### Install helper

`scripts/install-local-macos.sh <dmg> <temp>/Applications` verified the source, installed with
`ditto`, and verified the installed app. A second install moved the previous app to
`<temp>/Applications/.lumencortex-backups/LumenCortex Desktop-<timestamp>.app` and installed the new
copy. It was never run against the real `~/Applications` or `/Applications`.

### Invariants

- `git diff --stat go.mod go.sum` is empty after all runs: both files are byte-identical to HEAD.
- `build/bin/LumenCortex Desktop.app` was not written; its executable mtime stayed at 12:30, before
  the first release run.
- `bash -n` passes for every Desktop and Core script; `shellcheck` is not installed on this machine.
- `go build ./...` and `go vet ./...` pass in Desktop with the new `main.go`/`version.go` against the
  pinned Core `d2eaa01`.

## Limits and risks

- **Signing and notarization are not implemented or verified.** The app bundle is ad-hoc signed
  (`codesign --sign -`); the DMG and ZIP containers are not signed, and nothing is notarized or
  stapled. Gatekeeper will warn on download. The release notes say so explicitly.
- **CI was not run.** Both workflows call the scripts but no tag was created and nothing was pushed.
  The universal build path was not exercised locally (arm64 only).
- **Pre-commit overlay.** The candidate was built from HEAD plus the declared overlay
  (`main.go`, `version.go`, `wails.json`, `scripts`) because those changes are uncommitted by
  instruction. Every overlaid path is recorded in `manifest.json`; other agents' uncommitted changes
  were not included. Once these files are committed, rebuild without `--overlay`.
- **Core source.** Core's working tree did not build at the time of the candidate build (the plugin
  platform and session-import work were in flight: `internal/ompsession` and `cmd/lcx-go/omp.go`
  referenced APIs not yet in `runtime`), so the candidate used Core's committed `d2eaa01` via
  `--core-ref HEAD`. Core's own Go tests were therefore not run here; the Core change in this task
  is scripts/docs/workflow only, and `runtime/engine.go` was not modified.
- **About box** shows the versions through `mac.AboutInfo`; the rendered menu text was not
  inspected in a native session.
- **Bundle identifier** remains Wails' derivation `com.wails.lumencortex-desktop`. Changing it needs
  a tracked `build/darwin/Info.plist` template, which is outside this change.
- `hdiutil attach -readonly … -mountpoint` is deprecated on macOS 27 (warning only); it still works.
- `unzip` is used for the ZIP integrity test; `ditto` is used for creation and extraction.

## Next actions

1. Commit the release tooling (Desktop and Core) with the version bump, then rebuild without
   `--overlay` and record the new hashes.
2. Bump Core's pin only after a Core tag is published; run `release-check.sh --mode release` on both
   sides.
3. Add Developer ID signing and notarization (documented but unimplemented) before any public
   distribution.
