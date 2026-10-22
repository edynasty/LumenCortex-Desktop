# Release 0.1.0 (local) - 2026-10-22

- **Status:** Core `v0.1.0` and Desktop `v0.1.0` are tagged **locally** (annotated). Neither tag
  nor any commit is pushed, and there is no GitHub Release. The arm64 artifacts below are built in
  release mode, verified, installed into an isolated directory, and accepted in the native app.
- **Not done:** Developer ID signing, notarization, the tag workflow on GitHub, and a universal
  build. Gatekeeper rejects the app (`spctl --assess`: `rejected`); that is expected for ad-hoc
  signing.

## Versions

| | Version | Commit | Tag |
| --- | --- | --- | --- |
| Core module `github.com/edynasty/LumenCortex` | `v0.1.0` (runtime `0.1.0-preview`) | `1ac5932cffcdc2ea64ed08770eaea1282ed8de11` | `v0.1.0` (annotated, local) |
| Desktop app | `0.1.0` (`wails.json` `productVersion`) | `6162241a588c730975d07806b9557c3d35b5c3fe` | `v0.1.0` (annotated, local) |

- Desktop `go.mod` requires `github.com/edynasty/LumenCortex v0.1.0`; `go.sum` has
  `h1:yg1FQJi9CQFC8ojwYDp9VpNkzVe3IF5gxxhpWh6YP1s=`. The module was resolved from the local Core
  tag (`go mod download` reports origin hash `1ac5932…`). Because the hash depends only on the
  tagged tree, pushing the same Core tag yields the same checksum-database entry.
- The runtime version `0.1.0-preview` against tag `v0.1.0` is the existing Core convention
  (`scripts/release-check.sh`: the numeric core must equal the tag).
- Before tagging, `git tag -l v0.1.0` and `git ls-remote --tags origin` were empty in both
  repositories; no tag existed anywhere.
- Desktop commits after the tag change only release scripts, not the app: `da8684d`, `0614f8d`.

## Artifacts

Directory `LumenCortex-Desktop/build/releases/0.1.0/` (ignored by Git):

| File | Size | SHA-256 |
| --- | --- | --- |
| `LumenCortex-Desktop-0.1.0-macos-arm64.dmg` | 7.4 MB | `aee0f265aa130ea2efbdd6c40eddf31fae5f77c983417059e67a2a2a7584eb87` |
| `LumenCortex-Desktop-0.1.0-macos-arm64.zip` | 6.6 MB | `33396025aa7c72e24450deae21f75d8d25bbc92540a42fbbc09674f11b52308a` |

Also `SHA256SUMS` (`shasum -a 256 -c` OK for both), `manifest.json` (`buildMode: release`,
`gitCommit 6162241…`, `gitTag v0.1.0`, `dirty: false`, `overlay: []`, `core.version v0.1.0`,
`core.releasePinned: true`, `core.published: false`, `core.tagCommit 1ac5932…`,
`signing: ad-hoc`, `notarized: false`), `RELEASE_NOTES.md`, `build.log`, `launch.log`.

Provenance: the app was built from `git archive` of the tag. The packaging scripts that drove that
build were the ones from `0614f8d` copied into a temporary worktree of the tag, because the tag's
own `release-candidate.sh` wrote an empty change list into the release notes. That first build
(DMG `c0d37713…`, ZIP `655795a1…`, otherwise verified the same) is kept at
`build/releases/.backup/0.1.0-20261022T113709Z-notes-empty/`. Builds are not byte-reproducible
(DMG/ZIP timestamps), so the hashes differ between the two builds of the same commit.

## Build isolation (RELEASE-001 fixes)

| Output | Written by | Meaning |
| --- | --- | --- |
| `build/bin/` | `wails dev`, `wails build` | Wails scratch; `wails dev` deletes its binary on exit. Never trusted. |
| `build/local/LumenCortex Desktop.app` | `scripts/build-macos.sh` | Verified build of the working tree; previous one in `build/local/.previous/`; `<sha>-dirty` when the tree has changes. |
| `build/candidates/<version>-<commit12>/` | `release-candidate.sh --mode local` | Non-release; file names carry `-local.<commit7>`. |
| `build/releases/<version>/` | `release-candidate.sh --mode release` only | Release of the tag; never replaced by a build of another commit. |

Verified:

- `scripts/build-macos.sh` installed `build/local/…` with commit `cbcc1bd…-dirty`; a failing
  build (`-bogusflag`, exit 1) left it intact and still verifiable; the next build moved it to
  `build/local/.previous/`.
- `--mode local` produced `build/candidates/0.1.0-b5b523e59e4e/LumenCortex-Desktop-0.1.0-local.b5b523e-macos-arm64.{dmg,zip}`,
  all verification steps OK.
- Release mode ran `release-check.sh --mode release` in a clean temporary worktree of the tag
  (this checkout keeps unrelated untracked files), then built and verified.
- Rebuilding `build/releases/0.1.0` from another commit fails before building:
  `already holds release 0.1.0 from commit 6162241…; bump the version instead of rebuilding it from da8684d…`.
- `--core-git` with a missing tag fails (`has no tag v9.9.9`); with the cached `.info` removed it
  re-fetches from the local checkout and checks the origin hash.

Defects found and fixed while doing this:

- `b5b523e`: macOS attached a freshly created DMG without mounting it, and `hdiutil verify`
  failed with EAGAIN three times. The script now detaches any attachment of that exact image
  before retrying.
- `da8684d`: the `url.insteadOf` rule for the unpushed Core tag is a prefix rule, so exported
  into the shell it also rewrote `…/LumenCortex-Desktop` (observed: `ls-remote` went to
  `LumenCortex-Core-Desktop.git`). It now applies to the module download only. The remote tag
  check was repeated without it: no tags on either remote.
- `0614f8d`: release notes described changes since the tag being released (always empty).

## Native acceptance of the packaged app

Installed with `scripts/install-local-macos.sh build/releases/0.1.0/…dmg /tmp/lcx-native/Applications`
(source and installed copy verified). Launched the installed binary with
`HOME`/`XDG_CONFIG_HOME` under `/tmp/lcx-native/home` (Core config isolated, provider config
copied) and driven through macOS Accessibility (System Events). Screenshots are unavailable on this
host (`screencapture`: could not create image from display), so the evidence is the window's
accessibility tree, not pixels.

| Check | Result |
| --- | --- |
| `--version` | `appVersion 0.1.0`, `commit 6162241…`, `coreVersion v0.1.0`, `coreLocal false`, runtime `0.1.0-preview`, go1.26.5 |
| `--self-check`, `codesign`, structure | OK (verifier, at mount, at extraction and after install) |
| Launch | Native window `LumenCortex` 1440×900; quit with ⌘Q, exit code 0 |
| Workspace load | Opened `/tmp/lcx-native/ws` through 打开项目… and the native open panel; header shows `ws /private/tmp/lcx-native/ws` |
| Session creation | First turn with the configured default model `local-anthropic/claude-sonnet-5-5` **failed**: HTTP 400 "requires adaptive thinking or thinking.type=between_tools" (TODO PROVIDER-001) |
| Continue | Same session, model switched to `deepseek-v4.1-flash`, 继续: reply `native acceptance ok`; a further turn quoted the earlier request. Session `session_03d7ce436ade6016be1307c9` `completed` in the workspace DB |
| Settings → 插件 | `omp-import`, 内置, 运行中, version 1.0.0, API 1; state file under the isolated config |
| Settings → 关于 | Core 版本 `0.1.0-preview`, project and DB paths of the isolated workspace |
| Theme | 深色 / 浅色 / 跟随系统 each selected (radio state confirmed), left on 跟随系统 |
| Narrow window | At 820 and 560 px the sidebar collapses; 切换侧边栏 opens it as a drawer with the conversation list |
| OMP import | Dialog lists all-workspace sessions (sizes, child counts); preview of a 9.4 KB session shows counts, the other-directory warning and the read-only notices; cancelled without importing |

Side effects outside `/tmp`: WebKit keeps `localStorage` under the real
`~/Library/WebKit/com.wails.lumencortex-desktop` regardless of `HOME`, so the app first reopened
the most recent project (`…/me/LumenCortex`). Its `lumencortex.db` was opened but not written
(mtime still 09:22:38); only `-wal`/`-shm` were recreated. The recent-project list now also holds
`/private/tmp/lcx-native/ws`. The theme was restored to 跟随系统.

Not verified (owner, UX-001): pixel rendering of light/dark themes, drawer opacity, Increase
Contrast, icon in the Dock.

## Other checks

- Core `scripts/release-check.sh --mode local` and `--mode release` on `1ac5932`: passed (clean
  tree, tag = runtime version, `go mod verify`, build, vet, all tests).
- Desktop `release-check.sh --mode release` (in the clean worktree): passed; includes `go build`,
  `go vet`, `go test ./...`, `tsc --noEmit`, `npm test`, `npm run build`. Desktop
  `go vet ./...` and `go test ./...` also passed against the new pin before committing it.
- SESSION-003 re-measured with `lcx-go import preview omp` built from Core `v0.1.0` on the largest
  local session (204 MB root file, 464 MB of subagent files): 6.9 s / 7.3 s, 495 MB / 494 MB peak
  RSS.

## How to release

```bash
# Core (LumenCortex-Core)
scripts/release-check.sh --mode local
git tag -a vX.Y.Z -m "…"            # after checking git tag -l / git ls-remote --tags origin
scripts/release-check.sh --mode release

# Desktop (LumenCortex-Desktop): pin, commit, tag, build
GOPRIVATE=github.com/edynasty/LumenCortex GIT_CONFIG_COUNT=1 \
GIT_CONFIG_KEY_0="url.file://$(cd ../LumenCortex-Core && pwd -P).insteadOf" \
GIT_CONFIG_VALUE_0=https://github.com/edynasty/LumenCortex \
  go get github.com/edynasty/LumenCortex@vX.Y.Z && go mod tidy
git commit -m "build(deps): pin Core vX.Y.Z" go.mod go.sum
git tag -a vX.Y.Z -m "…"
scripts/release-candidate.sh --mode release --arch arm64 --core-git ../LumenCortex-Core
scripts/install-local-macos.sh build/releases/X.Y.Z/LumenCortex-Desktop-X.Y.Z-macos-arm64.dmg
```

`--core-git` is only for an unpushed Core tag; after the Core tag is pushed, omit it. Local
testing builds: `scripts/build-macos.sh` (→ `build/local`) and
`scripts/release-candidate.sh --mode local` (→ `build/candidates`). Full contract:
[docs/release-process.md](../release-process.md).

## Remaining work

1. Owner: push Core `main` + `v0.1.0`, then Desktop `main` + `v0.1.0`, and let the tag workflow
   build the universal artifacts (RELEASE-001).
2. Developer ID signing and notarization before public distribution (RELEASE-001).
3. PROVIDER-001: Core sends only `thinking.type=enabled` to Anthropic-protocol models; the
   configured `claude-sonnet-5-5` endpoint refuses it.
4. UX-001 visual checks (owner).
