# UX & Provider Completion — credential storage and protocol support in the Desktop (stage B/C backend)

Date: 2026-10-19
Repo: LumenCortex Desktop (`~/IdeaProjects/me/LumenCortex-Desktop`), branch `main`, local only.
Scope owner: DesktopProviderBackend (Go side). The frontend panel is DesktopProviderUI's stage; this report covers the Go contract only.
Core: pinned `github.com/edynasty/LumenCortex v0.0.0-20261019112438-003ebd838350` (Core `003ebd8`, the file-backed credential store, on top of `7b8c690` stage B core; resolved with the local `url.insteadOf`, no `replace`, no `go.work`).

> **OWNER DECISION (supersedes the Keychain design):** no macOS Keychain anywhere. Direct-input
> API keys are stored in Core's file-backed credential store (`config.FileCredentialStore`,
> `credentials.json` 0600 in the global config dir, shared with the CLI). The first iteration of
> this stage shipped a cgo Keychain store; commit `refactor(desktop): file-backed credential store
> replaces Keychain (stage C backend)` is the clean cutover — the Keychain code, its cgo Security
> code, the real-Keychain test and all Keychain wording are gone. `CredentialStatus` lost
> `keychainAvailable` and `source: "keychain"` became `source: "stored"` (the UI's committed shape
> in Desktop d05660f).

## What landed

### Core pin and compile

- `go.mod`/`go.sum`: Core bumped `aa12861c3798` → `7b8c69004bc7` → `003ebd838350` through the same local `url.insteadOf` mechanism as C1/M3.3/M4.2 (temporary `url."$HOME/IdeaProjects/me/LumenCortex".insteadOf = https://github.com/edynasty/LumenCortex`, `GOPROXY=direct GOPRIVATE=…`, removed afterwards). Core `7b8c690` contains the `provider` dispatcher, `provider/anthropic` and the `{secret:NAME}` credential API; Core `003ebd8` adds the file-backed credential store the cutover uses.
- The only compile break (`internal/backend/config.go` `ResolveAPIKey()`) became resolver-aware; see discovery below.

### Credential store (`internal/backend/credentials.go` over Core's `config.FileCredentialStore`)

- `credentialStore` is the thin three-method subset (`Set`/`Get`/`Delete`) of Core's
  `config.FileCredentialStore`; the Desktop constructs it at `config.DefaultCredentialStorePath()`
  (GlobalDir/credentials.json, XDG-aware, the same file the CLI resolves through), so both hosts
  share one store. The interface stays only as the tests' injection seam.
- Core guarantees (Core `003ebd8`): file 0600, dir group/other bits repaired on write, atomic
  temp+fsync+rename writes, cross-process advisory lock, fail-closed on a wrong file mode,
  corrupt-file errors without content, values never in errors/JSON/`%v`. It is not encrypted at
  rest — Core's docs/security-and-trust.md states this; the trust level of an environment variable.
- Missing items wrap `config.ErrCredentialNotFound`; `Delete` is idempotent; `Has`/`Names` (names
  only) exist on the store but the Desktop needs none of them.

### Resolver, naming, timeouts

- `credentialResolver` implements Core's `config.CredentialResolver` (`Resolve`), and `set`/`delete`/`read` helpers bound **every** store call with `credentialStoreTimeout` (5 s): a store lock stalled behind another writer fails fast instead of blocking a Wails callback or a run indefinitely. The underlying call is not cancellable; it finishes on its goroutine and its result is dropped.
- Secret name (unchanged by the pivot): `provider.<scope>.<sanitized-id>.<8 hex of sha256(scope\0id)>` — deterministic, collision-free for any provider id the schema allows (ids that sanitize alike are separated by the hash), inside Core's NAME pattern `^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$`.

### Runtime wiring (`internal/backend/runtime.go`, `config.go`)

- `Runtime` holds the store (`New()` installs Core's file store at the default path; tests swap their own before opening a workspace). `lcx.Open` now passes `ProviderFactory: r.providerFactory`, a closure over `provider.FromModel(m, provider.Options{Credentials: resolver})`: every run speaks the provider's own protocol (`openai-compatible` or `anthropic-messages`) and resolves `{secret:NAME}` from the store. Env references never consult the resolver (Core's rule).
- `ConfigState` re-reports each `ModelInfo.APIKeySet` through the resolver (`applyCredentialAvailability`), so `{secret:}` providers show as set in the picker; Core's `Catalog()` alone knows only the environment.
- `DiscoverProviderModels`/`TestProviderConnection` are protocol-aware: `GET {baseURL}/models` with `Authorization: Bearer` for openai-compatible, `GET {baseURL}/v1/models` with `x-api-key` + `anthropic-version: 2023-06-01` for anthropic-messages (endpoint variants trimmed accordingly); the provider's configured headers override both defaults; keys resolve through the store; redirects stay refused. Non-2xx errors now carry a one-line 256-byte body excerpt with **every** occurrence of the key replaced by `[redacted]` (`secretRedactor`), applied to all error texts after the key is known.
- `SaveProviderCatalogScope` validates `ProviderDefinition.package` at save time through Core's `NormalizePackage`: the legacy ids collapse to `openai-compatible`, unknown values are refused with a clear error naming the value and the two supported protocols; an absent DTO package preserves the file's (`applyCatalog` → `providerPackageForSave`).

### Wails APIs (`app.go`, per contract)

```go
type CredentialStatus struct {
  ProviderID string `json:"providerId"`
  Scope      string `json:"scope"`
  Source     string `json:"source"`      // "none" | "env" | "stored"
  Ref        string `json:"ref,omitempty"`
  Set        bool   `json:"set"`
}
GetProviderCredentialStatus(scope, providerID) / SaveProviderCredential(scope, providerID, apiKey) / RemoveProviderCredential(scope, providerID)
```

- `SaveProviderCredential`: writes the store, then sets `settings.apiKey = {secret:NAME}` in that scope's file through the same `config.Save` path as the provider panel (digest conflict included). A failed config save rolls the store write back — a replaced key is restored to its previous value, a first-time key is deleted again.
- `RemoveProviderCredential`: deletes the stored item and clears the reference only when it is a `{secret:..}` one; an `{env:..}` reference is left untouched (reported, not an error).
- The key value crosses the boundary exactly once (the save argument). It is never returned, logged, exported, evented or written to disk.

### Docs

- `docs/lumencortex.schema.json`: byte-identical copy of Core's (package enum + `{secret:NAME}` apiKey pattern); `TestSchemaIdentityWithCore` enforces it.
- `docs/architecture.md`: new "Provider protocols and credentials" section (rewritten for the file store by the cutover).
- `docs/ui-design-audit.md`: the P0-02 "future hardening" Keychain note replaced — `{secret:NAME}` now resolves through the file store the contract already accommodates.

## Tests (`internal/backend/credentials_test.go`)

Deterministic (httptest upstreams, no network); every test runs under an isolated `XDG_CONFIG_HOME`
(temporary HOME via `useConfigDir`/`TestMain`), never the user's real `~/.config`. The lifecycle,
leak and redaction tests use the **real** `config.FileCredentialStore` at its default path inside
that isolated dir, so the Desktop path is exercised end to end (0600 file, shared-with-CLI path);
only the rollback test uses the in-memory fake, because it needs store writes to succeed while the
configuration directory is unwritable.

- `TestProviderCredentialLifecycle` — save → status stored/set → file holds only the reference → picker shows set → replace → resolver returns the new value → remove → status none/store empty/picker unset; `{env:NAME}` set and unset states; removal leaves an env reference alone.
- `TestProviderCredentialRejectsInvalidInput` — unknown provider (status/save/remove), empty/whitespace key, unknown scope; no credentials.json is created.
- `TestSaveProviderCredentialRollsBackWhenConfigSaveFails` — config dir made unwritable after the store write: replaced key restored to its previous value, first-time key deleted, file byte-identical to before.
- `TestCredentialNameShape` — names deterministic, scope-distinct, inside Core's NAME pattern, hash-separating ids that sanitize alike.
- `TestSaveProviderCatalogScopeValidatesPackage` — unknown package refused with a clear error; `anthropic-messages` saved; `@ai-sdk/openai-compatible` normalized to `openai-compatible`; absent DTO package preserves the file's; a new provider defaults to empty.
- `TestCredentialResolverContract` — missing/empty secret is `config.ErrCredentialNotFound`; a stored value passes through.
- `TestProviderRunAndAPINeverLeakTheSecret` (leak proof) — full agent runs through the Desktop runtime path (supervisor.Start → Engine → dispatcher factory) against a fake Anthropic Messages server and a fake [OI] server, both providers keyed by `{secret:NAME}` in the **real** store: the wire auth carries the key (`x-api-key` + `anthropic-version`, no Bearer, path `/v1/messages`; `Authorization: Bearer`, path `/v1/chat/completions`), and the value appears in **no** returned struct JSON (ConfigState, catalog documents, both `CredentialStatus`, session, messages), neither log sink (`log` and `slog` captured), no event forwarded to the frontend, and no file at rest except the store itself — the store file is asserted to be exactly `GlobalDir/credentials.json`, mode 0600, holding both values, never returned by any API (the catalog document is checked for them too).
- `TestDiscoveryAndConnectionRedactEchoedKeys` — discovery/test speak each protocol's auth and endpoint; upstreams echoing the key in a 401 error body get it redacted to `[redacted]` in every returned error; keys resolve from the real store.

## Validation (exact commands, observed, after the cutover)

- `go build ./...` — pass.
- `go vet . ./internal/backend` — no findings (no cgo remains in the credential path).
- `go test -count=1 -timeout 90s . ./internal/backend` — all pass (full package, incl. all tests above and the pre-existing suite).
- `grep -ri keychain` over tracked Desktop sources and docs — empty outside this report's history section below.
- `gofmt` — clean on every touched file; pre-existing findings in untouched files (`main.go`, `context.go`, `lsp.go`, `tasks_test.go`, `worktree.go`) left as they are.

### History: the Keychain iteration (superseded)

The first iteration of this stage shipped a cgo Security.framework Keychain store and a real
login-keychain lifecycle test; it was committed as Desktop `00f2504`. The owner decision above
superseded it: the cgo store, the non-darwin stub, the real-Keychain test (which had passed against
the user's login keychain after a HOME fix) and all Keychain wording were removed in the cutover
commit. The design that survives unchanged: secret-name derivation, the bounded-timeout resolver,
rollback-on-config-save-failure, protocol-aware discovery with redaction, and every leak test.

## Decisions

- `New()` installs Core's store at the default path; a store path that cannot be resolved leaves the Runtime storeless (every secret reference reports unset, saving one fails). In-package tests swap the field before `OpenWorkspace`; the factory closure reads the resolver at call time, so a swap is honored even after a workspace opens.
- Rollback order on save: store write first, config save second; on save failure the previous store value (read before the write) is restored, or the item deleted when none existed. Remove deletes the store item first, tolerating not-found, then clears the reference.
- Discovery errors include a bounded body excerpt — better diagnostics — which is exactly why every such text is run through the redactor; errors that would carry the key lose their error identity (`errors.New`), acceptable only on that path.
- `SaveProviderCredential` on a provider whose `apiKey` is an `{env:..}` reference replaces it with `{secret:NAME}`: saving a key means the key lives in the store from then on. `RemoveProviderCredential` is the only path that refuses to touch env references.

## Owner decision 3: the single API key field (Spring-style value)

No two-source tabs: one field, and the user types either a literal key or an environment
placeholder `${NAME}` (the Core-native `{env:NAME}` form is accepted as the same thing).
`SaveProviderCredential` classifies the trimmed value first:

- `${NAME}` / `{env:NAME}` with NAME matching `[A-Za-z_][A-Za-z0-9_]*` → the provider's
  `settings.apiKey` becomes `{env:NAME}` in that scope (Core-native config, nothing stored). The
  configuration write happens first; then every stored key of the provider is deleted (the
  derived item plus whatever the previous `{secret:..}` reference named), so no stale secret
  remains in credentials.json. A delete failure rolls the configuration back to the previous
  reference — the switch is all-or-nothing, mirroring the literal path's store rollback.
- A value that starts like a placeholder or a `{secret:..}` reference but is not a valid one
  (`${A B}`, `${NAME:default}`, `${}`, `${1abc}`, `{env:1BAD}`, `{secret:x}` …) is refused with
  an error naming only the shape. Spring-style defaults are explicitly unsupported (a default
  would be a literal secret in config), and `{secret:..}` references are created only by storing
  a key, never typed.
- Anything else is a literal key: the existing path (file store + derived `{secret:NAME}`
  reference), including keys that merely contain `$` or `{` in the middle.
- Empty (or whitespace-only) is an error, unchanged.

`CredentialStatus` is unchanged (`source: none|env|stored`, `ref` carries the configured
reference — `{env:NAME}` for env, the `{secret:NAME}` reference for stored; the UI derives
`${NAME}` from it). `RemoveProviderCredential` is unchanged.

Tests added (`internal/backend/credentials_test.go`): `TestSaveProviderCredentialSingleFieldClassification`
(placeholder → env ref saved, status env, nothing left in credentials.json, previous stored value
removed; Core-native form; back to literal; literal with `$`/`{` in the middle stored verbatim),
`TestSaveProviderCredentialRejectsInvalidPlaceholders` (eleven invalid shapes refused, errors
never echo the typed text beyond the shape names, config and store byte-identical),
`TestSaveProviderCredentialEnvSwitchRollsBackWhenDeleteFails` (failing delete → error, config
rolled back to the previous `{secret:..}` reference, stored key intact). All prior tests,
including both leak proofs, unchanged and green.

## Blockers / handoffs

- None on the Go side. DesktopProviderUI owns `bridge.ts`/`types.ts`; their committed `CredentialStatus` (no `keychainAvailable`, `source: "stored"`) matches this backend exactly.
- The bridge contract test (`TestBridgeDeclaresExactlyTheBoundAppMethods`) passed at validation time with the frontend's current `AppAPI`.
- The store file is shared with the CLI by design (one `credentials.json`); Core's `cmd/lcx-go` preflight resolves the same references, so no coordination gap exists.
