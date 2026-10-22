# OMP session import integration closure — 2026-10-22

- **Status:** code and automated validation complete locally; native OMP end-to-end acceptance remains owner-check. Not pushed.
- **Scope:** close the previously documented missing `childMode: imported` presentation and rebuild the local app using the current local Core source.

## Changes

- Core `runtime.SubagentNode` exposes the mode stored in the child relation metadata, including `imported`.
- Desktop inspector shows a localized `Imported history` / `历史导入` marker independently of the child's execution status.
- Regression tests cover imported label display, native child status without the imported marker, child navigation, and Core relation metadata.
- The packaged app was rebuilt from the current local Core checkout using a temporary module replacement for local integration validation; the committed Desktop `go.mod` and `go.sum` are restored after the build. No local replacement is intended for a release.

## Validation

- Core: `go test -count=1 ./...`, `go build ./...`, `go vet ./...` passed; targeted plugin/OMP tests passed with `-race`.
- Desktop frontend: 68 Vitest files / 334 tests passed; Playwright 88/88 passed; TypeScript and production build passed.
- Desktop Go tests, build and vet passed against the current local Core checkout using the temporary local integration wrapper.
- Native arm64 bundle passed `scripts/verify-macos-bundle.sh`, launched successfully, and the local DMG/ZIP checksums passed.
- Screen capture permission is unavailable, and the native list → preview → import → open → continue flow has not been exercised end-to-end in this pass.

## Remaining acceptance

- Open the packaged app in a throwaway workspace and exercise OMP list, preview, import, open and continuation.
- Confirm the inspector shows the imported child marker in the real Wails window. The automated inspector test and current Core response-field test pass, but the native visual state still needs confirmation.
- Keep OMP image attachment transfer deferred until Core transcripts support attachments. Keep the large-preview memory item separately tracked.
