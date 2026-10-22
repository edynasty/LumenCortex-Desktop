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
| Local development build | `build/bin/LumenCortex Desktop.app` | Whatever the working tree builds now. Not a release. Regenerate with `scripts/build-macos.sh`. |
| Local release candidate | `build/releases/<version>/` | Isolated build of an exact commit, optionally with a local Core checkout. Recorded as non-release. |
| Published release | GitHub Release for tag `vX.Y.Z` | Universal DMG + ZIP + `SHA256SUMS` + `manifest.json` + `RELEASE_NOTES.md`. |

The DMG is the installer: open it and drag **LumenCortex Desktop.app** to Applications. A `.pkg` is
unnecessary for a self-contained per-user app.

## Single version source

`wails.json` `info.productVersion` is the only place the app version is written.

- Wails writes it into the bundle's `CFBundleShortVersionString` and `CFBundleVersion`.
- `scripts/build-macos.sh` reads it and compiles it into the binary with
  `-ldflags "-X main.appVersion=<version> -X main.appCommit=<sha>"`.
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
"build/bin/LumenCortex Desktop.app/Contents/MacOS/LumenCortex" --version
"build/bin/LumenCortex Desktop.app/Contents/MacOS/LumenCortex" --self-check
```

`--version` prints one JSON object: `appVersion`, `commit`, `coreModule`, `coreVersion`,
`coreLocal`/`coreLocalPath` (set when the build used a `replace`), `coreRuntimeVersion`,
`goVersion`. `--self-check` additionally opens a Core Engine on a throwaway workspace with an
isolated `HOME`, reports `Health()` and closes it; it exits non-zero on failure. Neither mode opens
a window.

## 1. Local development build

```bash
scripts/build-macos.sh                 # build the committed Core pin
scripts/build-local-macos.sh           # build against the sibling Core checkout
```

Both verify the bundle afterwards: structure, executable, architecture, ad-hoc signature, bundle
identifier, icon, Info.plist version, the binary's `--version` agreement and `--self-check`.

`wails dev` shares `build/bin` and deletes the development binary from the bundle when it exits.
That is why a dev session can leave `LumenCortex Desktop.app` without an executable; run
`scripts/build-macos.sh` to restore it.

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
  work in the working tree cannot leak into an artifact (that is what `--overlay` is for: it names
  the few pre-commit paths that are deliberately copied over the extracted tree and records them in
  `manifest.json`);
- never writes into `build/bin` (the development bundle) or `/Applications`;
- refuses to overwrite a non-empty `build/releases/<version>/`; `--force` moves the old directory to
  `build/releases/.backup/<version>-<timestamp>`;
- keeps the previous artifacts intact on failure and leaves `build.log` in the staging directory,
  printing its path;
- for `--mode local`, points the Desktop module at the sibling Core with a local `replace` and
  records the Core commit, so the result is explicitly a **non-release** candidate.

Artifacts per version directory:

```text
build/releases/<version>/
  LumenCortex-Desktop-<version>-macos-<arch>.dmg
  LumenCortex-Desktop-<version>-macos-<arch>.zip
  SHA256SUMS
  manifest.json
  RELEASE_NOTES.md
  build.log
  launch.log
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
   `LumenCortex-Core/`, commit, then run `scripts/release-check.sh --mode release` on the tagged
   commit. The tag `vX.Y.Z` must agree with the numeric core of
   `runtime.GoRuntimePreviewVersion` (for example `0.1.0-preview` ↔ `v0.1.0`). Push the commit and
   tag. `Core release` publishes the module.
2. **Desktop**: pin the published Core tag in `go.mod` (`go mod tidy`, review the `go.mod`/`go.sum`
   diff), commit the pin together with the version bump.
3. Run `scripts/release-check.sh --mode release` and
   `scripts/release-candidate.sh --mode release --arch universal` on that commit. The release mode
   refuses a pseudo-version, a `replace` and a `go.work`; the artifact must be built from the clean
   commit.
4. Push the Desktop commit, then create the tag `vX.Y.Z` on that exact commit and push it. The
   `macOS release` workflow re-runs the same check, builds the isolated universal artifacts and
   attaches the DMG, ZIP, `SHA256SUMS`, `manifest.json` and `RELEASE_NOTES.md` to the GitHub
   Release.
5. Download the published artifacts and verify `SHA256SUMS` before calling the release delivered.

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
