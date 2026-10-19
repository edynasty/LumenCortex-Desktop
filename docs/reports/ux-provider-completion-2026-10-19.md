# Desktop UX & Provider Completion — milestone summary (2026-10-19)

Status: **implemented and validated locally; nothing pushed.** Detailed evidence lives in the per-area reports listed below.

## Commits

Core (`~/IdeaProjects/me/LumenCortex`, `main`):

| Hash | Content |
|---|---|
| `465eda7`, `42d617c` | `{secret:NAME}` credential references, `config.CredentialResolver`, redaction tests |
| `7b8c690` | Anthropic Messages adapter (`provider/anthropic`), package dispatcher `provider.FromModel` |
| `003ebd8` | pure-Go file-backed credential store (`config.FileCredentialStore`), CLI wired |

Desktop (`main`):

| Hash | Content |
|---|---|
| `a158829` | Stage A: composer redesign, Ask/Agent, searchable model + effort pickers, Local/Worktree moved to new session |
| `266e451` | Stage A: native title-bar double-click, A1 app icon, project switcher |
| `00f2504`, `7d9fa49` | Stage B/C first cut (Keychain) — superseded by the owner decision below |
| `fb7d8d3`, `d05660f` | clean cutover: Keychain removed, file-backed store |
| `248e1d8`, `a1a8ec0` | single API key field: literal key or `${ENV}` placeholder |
| `1e58edb` | Codex-style environment strip, composer spacing fixes, project chip removed from the toolbar |

## Owner decisions applied during the milestone

1. No macOS Keychain. API keys are an environment reference or direct input; direct input is stored in `credentials.json` (0600) in the global config dir and `lumencortex.json` keeps only `{secret:NAME}`. Not encrypted at rest (stated in `docs/security-and-trust.md`).
2. One field, Spring-yml style: `${NAME}` / `{env:NAME}` become an env reference; anything else is a stored literal. `${NAME:default}` is rejected on purpose (a default would be a literal secret in config).
3. The project chip is gone from the composer; the sidebar switcher is the only project selector.
4. omp providers were migrated into `~/.config/lumencortex/lumencortex.json` (12 providers; the two `openai-completions`/`anthropic-messages` APIs map to the two Core protocols; `sub` (`openai-responses`) and `ark-image` (no models) were skipped; efforts mapped onto Core's none/low/medium/high/max). Keys went to `credentials.json`, never into the config. Backup of the previous config: `/tmp/lumencortex.json.bak-pre-omp-migration`. Default model set to `local/deepseek-v4.1-flash`.

## Validation (final tree)

| Check | Result |
|---|---|
| Core `go vet ./... && go test -count=1 ./...` | all packages ok |
| Desktop `go vet . ./internal/backend`, `go test -count=1 -timeout 90s . ./internal/backend` | ok |
| Frontend `tsc --noEmit` / `vitest` / `playwright` / `npm run build` (at `1e58edb`) | 0 errors / 49 files, 217 tests / 71 passed / built |
| `scripts/build-macos.sh` | OK, arm64 bundle verified |
| Real run, OpenAI-compatible: `lcx-go agent` on `local/deepseek-v4.1-flash` with the migrated config, key from `credentials.json`, tool call `read_file` | `status: completed`, answer matched the file content |
| Real run, Anthropic Messages: same task on `local-anthropic/claude-sonnet-5-5` | `status: completed`, tool call round trip, correct answer |
| Native app (real bundle, AX tree + synthesized CGEvents) | see the platform and composer reports; fresh build shows the strip with the gear, no project chip, default model `deepseek-v4.1-flash` |
| Native credential flow (UI save of a canary key) | `credentials.json` 0600 holds it; `lumencortex.json` holds only `{secret:…}`; the canary string appears in no other file under the config dir, the app log or the test workspace |

## Limits

- No Screen Recording permission for this process: native evidence is accessibility-tree and window-bounds based, not screenshots. Harness screenshots are in `docs/reports/ux-provider-completion/`.
- A live agent turn inside the Desktop UI was not driven; the same Core path was run through the CLI with the real endpoints (above) and through Desktop-runtime tests against fake OpenAI/Anthropic servers.
- Anthropic adapter drops cache-usage fields and omits `is_error` (the protocol has no field for them) — documented in the protocol report.

## Reports

`ux-provider-completion-platform-…`, `-composer-…`, `-provider-ui-…`, `-credentials-desktop-…` (this repo) and Core's `docs/reports/ux-provider-completion-credentials-2026-10-19.md`, `…-protocol-2026-10-19.md`.
