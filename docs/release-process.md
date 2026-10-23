# LumenCortex Desktop release process

This document is the release contract for LumenCortex Desktop. Core and Desktop remain independent
Git repositories with independent tags. Every stage below is implemented by a script in
`scripts/`; the tag-triggered GitHub workflow calls the same scripts, so CI and local runs cannot
drift apart.

**Signing and notarization are not implemented.** Builds are ad-hoc signed for local and private
use. A public download still needs Developer ID signing and notarization (see
[Signing](#3-signing-developer-id-not-implemented) and
[Notarization](#4-notarization-not-implemented)).

## Artifact types

| Artifact | Where | What it is |
| --- | --- | --- |
| Wails scratch | `build/bin/` | Written by `wails dev` and `wails build`; `wails dev` deletes its binary on exit. Never kept, never trusted. |
| Local build | `build/local/LumenCortex Desktop.app` | Verified build of the working tree (`scripts/build-macos.sh`); commit recorded as `<sha>-dirty` when the tree has changes. Previous build in `build/local/.previous/`. Not a release. |
| Local candidate | `build/candidates/<version>-<commit12>/` | Isolated build of an exact commit against a local Core checkout. File names carry `-local.<commit7>`; the manifest says `buildMode: local`. Not a release. |
| Release build | `build/releases/<version>/` | Isolated build of the tag `v<version>` with a SemVer Core pin, checked in a clean worktree. Only `--mode release` writes here. |
| Published release | GitHub Release for tag `vX.Y.Z` | Universal DMG + ZIP + `SHA256SUMS` + `manifest.json` + `RELEASE_NOTES.md`. |

The DMG is the installer: open it and drag **LumenCortex Desktop.app** to Applications. A `.pkg` is
unnecessary for a self-contained per-user app.

## Single version source

`wails.json` `info.productVersion` is the only place the app version is written.

- Wails writes it into the bundle's `CFBundleShortVersionString` and `CFBundleVersion`.
- `scripts/build-macos.sh` reads it and compiles it into the binary with
  `-ldflags "-X main.appVersion=<version> -X main.appCommit=<sha> -X main.appBuiltAt=<UTC RFC 3339>"`.
- The About box and `LumenCortex --version` show the same value, together with the Core module
  version from `runtime/debug.ReadBuildInfo`, Core's runtime version constant and the Go version.

Change it only with:

```bash
scripts/bump-version.sh 0.2.0     # edits wails.json and prints the follow-up steps
```

A release tag must be exactly `v` + `productVersion`; `scripts/release-check.sh` fails otherwise,
and `scripts/verify-macos-bundle.sh` fails when the binary and Info.plist disagree.

### Binary diagnostics

```bash
"build/local/LumenCortex Desktop.app/Contents/MacOS/LumenCortex" --version
"build/local/LumenCortex Desktop.app/Contents/MacOS/LumenCortex" --self-check
```

`--version` prints one JSON object: `appVersion`, `commit`, `builtAt`, `coreModule`,
`coreVersion`, `coreLocal`/`coreLocalPath` (set when the build used a `replace`),
`coreRuntimeVersion`, `goVersion`, `goos`/`goarch`. `--self-check` additionally opens a Core Engine on a throwaway workspace with an
isolated `HOME`, reports `Health()` and closes it; it exits non-zero on failure. Neither mode opens
a window.

## 1. Local development build

```bash
scripts/build-macos.sh                 # build the committed Core pin
scripts/build-local-macos.sh           # build against the sibling Core checkout
```

Both verify the bundle afterwards: structure, executable, architecture, ad-hoc signature, bundle
identifier, icon, Info.plist version, the binary's `--version` agreement and `--self-check`. Only a
bundle that passes replaces `build/local/LumenCortex Desktop.app` (the replaced one moves to
`build/local/.previous/`); a failed build leaves both untouched.

`wails dev` builds into `build/bin` and deletes the development binary from that bundle when it
exits. It cannot affect `build/local`.

## 2. Local release candidate

```bash
# Pre-flight: repository state, version/tag agreement, Core pin, toolchain, Go + frontend tests.
scripts/release-check.sh --mode local

# Isolated build + packaging + verification, against the sibling Core checkout.
scripts/release-candidate.sh --mode local --arch arm64

# The same, but pinned to the sibling Core's committed state instead of its working tree, and with
# an explicit pre-commit overlay of files that are not committed yet.
scripts/release-candidate.sh --mode local --arch arm64 --core-ref HEAD \
  --overlay main.go --overlay version.go --overlay wails.json --overlay scripts
```

`release-candidate.sh`:

- extracts the **exact HEAD commit** with `git archive` into a temporary directory, so uncommitted
  work in the working tree cannot leak into an artifact (that is what `--overlay` is for, in local
  mode only: it names the few pre-commit paths that are deliberately copied over the extracted tree
  and records them in `manifest.json`);
- never writes into `build/bin`, `build/local` or `/Applications`;
- writes local candidates to `build/candidates/<version>-<commit12>/` and release builds to
  `build/releases/<version>/`, so a candidate never lands where a release is expected;
- refuses to overwrite a non-empty output directory; `--force` moves it to
  `<root>/.backup/<name>-<timestamp>`. A release directory whose manifest records another commit is
  never replaced: bump the version instead;
- assembles everything in `<root>/.staging/` and moves it into place only after every verification
  passed, so a failure keeps the previous artifacts intact; it prints the `build.log` path;
- for `--mode local`, points the Desktop module at the sibling Core with a local `replace` and
  records the Core commit, so the result is explicitly a **non-release** candidate.

Artifacts per output directory:

```text
build/releases/<version>/                         build/candidates/<version>-<commit12>/
  LumenCortex-Desktop-<version>-macos-<arch>.dmg    LumenCortex-Desktop-<version>-local.<commit7>-macos-<arch>.dmg
  LumenCortex-Desktop-<version>-macos-<arch>.zip    LumenCortex-Desktop-<version>-local.<commit7>-macos-<arch>.zip
  SHA256SUMS, manifest.json, RELEASE_NOTES.md, build.log, launch.log
```

Verification performed before the artifacts are published into that directory:

1. bundle structure, executable, architecture, ad-hoc signature (`codesign --verify --deep --strict`);
2. Info.plist identifier, executable and version, and `iconfile.icns` present;
3. the bundled binary's `--version` matches the Info.plist version;
4. `--self-check` opens and closes a Core Engine;
5. `hdiutil verify` on the DMG;
6. the DMG mounts read-only, contains an `Applications` symlink and the app inside passes the same
   checks;
7. `unzip -tq` plus extraction; the extracted app passes the same checks;
8. launch check: the extracted app is started with an isolated `HOME`, confirmed alive for
   `LCX_LAUNCH_SECONDS` (default 8), then terminated with `SIGTERM`.

`manifest.json` records version, commit, `dirty: false`, build mode, architecture, the Core module
version and whether it is release-pinned, the toolchain, artifact sizes and SHA-256 values,
`signing: "ad-hoc"`, `notarized: false`, the overlay (if any) and the launch result.

### Pre-flight check details

`scripts/release-check.sh` refuses:

- tracked modifications, or untracked files that are not ignored (`--allow-dirty` downgrades this to
  a warning and is rejected in `--mode release`);
- a tag on HEAD that is not `v` + `productVersion`;
- in `--mode release`: a missing tag, a Core pseudo-version, a Core `replace`, a `go.work`, or a
  Core module that cannot be downloaded;
- a Node.js older than 22, or a missing Wails CLI.

It then runs `go build ./...`, `go vet ./...`, `go test -count=1 ./...`, `npx tsc --noEmit`,
`npm test`, `npm run build`, and optionally `npm run visual:test` (`--with-visual`).

## 3. Signing (Developer ID) — not implemented

Current artifacts are ad-hoc signed (`codesign --sign -`). This validates bundle integrity locally
but is **not** Developer ID signing and does not satisfy Gatekeeper for public downloads. To add it:

1. import a Developer ID Application certificate into a temporary keychain in CI;
2. sign the app with `codesign --force --deep --options runtime --timestamp --sign "Developer ID
   Application: …"`;
3. sign the DMG, then notarize and staple (below);
4. set `manifest.json` `signing` to `developer-id` in the same change.

Never commit certificates, API keys or keychain passwords, and never print them in CI logs.

## 4. Notarization (notarytool + staple) — not implemented

No artifact is notarized and nothing is stapled. The documented path:

```bash
xcrun notarytool submit <dmg> --keychain-profile <profile> --wait
xcrun stapler staple <dmg>
xcrun stapler validate <dmg>
spctl --assess --type open --context context:primary-signature -v <dmg>
```

Only after stapling should `manifest.json` set `notarized: true` and the release notes stop warning
about Gatekeeper. Until then, the release notes state that Gatekeeper will warn and that the app is
for local/private use.

## 5. Formal release

Order is fixed: **Core first, Desktop second.**

1. **Core**: finish the change, run `scripts/release-check.sh --mode local` from
   `LumenCortex-Core/`, commit, create the annotated tag `vX.Y.Z` on that commit (check first that
   `git tag -l vX.Y.Z` and `git ls-remote --tags origin vX.Y.Z` are both empty), then run
   `scripts/release-check.sh --mode release`. The tag must agree with the numeric core of
   `runtime.GoRuntimePreviewVersion` (for example `0.1.0-preview` ↔ `v0.1.0`).
2. **Desktop pin**: point `go.mod` at the Core tag. Before the tag is pushed, resolve it from the
   local checkout with the same environment `--core-git` uses:

   ```bash
   GOPRIVATE=github.com/edynasty/LumenCortex GIT_CONFIG_COUNT=1 \
   GIT_CONFIG_KEY_0="url.file://$(cd ../LumenCortex-Core && pwd -P).insteadOf" \
   GIT_CONFIG_VALUE_0=https://github.com/edynasty/LumenCortex \
     go get github.com/edynasty/LumenCortex@vX.Y.Z && go mod tidy
   ```

   Review the `go.mod`/`go.sum` diff and commit the pin (with the version bump, if any). The
   `go.sum` hash depends only on the tagged tree, so it is the hash the checksum database records
   once the same tag is pushed.
3. **Desktop tag**: check that `vX.Y.Z` does not exist locally or on `origin`, then create the
   annotated tag on the pin commit. Never move or recreate an existing tag; a fix is a new version.
4. **Build**: `scripts/release-candidate.sh --mode release --arch arm64|universal`, adding
   `--core-git ../LumenCortex-Core` while the Core tag is unpushed. It runs `release-check.sh
   --mode release` in a clean temporary worktree of the tag, builds from `git archive` of the tag,
   verifies, and publishes `build/releases/X.Y.Z/`. The manifest records `core.published: false`
   and `core.tagCommit` for a locally resolved Core tag; the release notes say the tags must be
   pushed unchanged before distribution.
5. **Record**: write the commit, tags, artifact paths and SHA-256 values in a report.
6. **Publish** (owner): push the Core commit and tag, then the Desktop commit and tag. The
   `macOS release` workflow re-runs the check against the published Core module, builds the
   isolated universal artifacts and attaches DMG, ZIP, `SHA256SUMS`, `manifest.json` and
   `RELEASE_NOTES.md` to the GitHub Release. Download them and verify `SHA256SUMS` before calling
   the release delivered.

Core and Desktop tags are independent even when the numbers match. Never tag a dirty tree, and
never create or push tags without owner authorization.

## 6. Upgrade and data compatibility

- Install or replace an app:

  ```bash
  scripts/install-local-macos.sh build/releases/0.1.0/LumenCortex-Desktop-0.1.0-macos-arm64.dmg
  scripts/install-local-macos.sh <dmg-or-app> /path/to/Applications
  ```

  The helper verifies the source before writing, moves an existing installation to
  `<destination>/.lumencortex-backups/<name>-<timestamp>.app` instead of overwriting it, and
  verifies the installed copy. The default destination is `~/Applications`.

- Workspace data is not stored in the app bundle. Replacing the app does not touch it.
- Core migrates an older workspace database forward on first open. A database written by a newer
  Core is refused (`ErrSchemaTooNew`) rather than modified, so back up a workspace before
  downgrading, and use `lcx-go db downgrade --to <schema>` with the newer binary when a downgrade is
  intended.
- Global configuration lives under the user's config directory (`~/.config/lumencortex`), not in the
  bundle.

## Release checklist

- [ ] `scripts/release-check.sh --mode release` passes on the exact tag commit.
- [ ] Core tag published before Desktop pins it; no `replace`, no `go.work`, no pseudo-version.
- [ ] `scripts/release-candidate.sh --mode release` produced DMG, ZIP, `SHA256SUMS`,
      `manifest.json`, `RELEASE_NOTES.md`.
- [ ] Launch check and all bundle/DMG/ZIP verifications passed.
- [ ] Signing/notarization status stated in `RELEASE_NOTES.md` (currently ad-hoc / not notarized).
- [ ] Tag pushed; CI artifacts downloaded and checksums verified.
