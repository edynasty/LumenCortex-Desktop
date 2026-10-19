# UX & Provider Completion — Keychain credential storage and protocol support in the Desktop (stage B/C backend)

Date: 2026-10-19
Repo: LumenCortex Desktop (`~/IdeaProjects/me/LumenCortex-Desktop`), branch `main`, local only.
Scope owner: DesktopProviderBackend (Go side). The frontend panel is DesktopProviderUI's stage; this report covers the Go contract only.
Core: pinned `github.com/edynasty/LumenCortex v0.0.0-20261019073512-7b8c69004bc7` (Core `7b8c690`, stage B core + `465eda7` stage C core; resolved with the local `url.insteadOf`, no `replace`, no `go.work`).

## What landed

### Core pin and compile

- `go.mod`/`go.sum`: Core bumped `aa12861c3798` → `7b8c69004bc7` through the same local `url.insteadOf` mechanism as C1/M3.3/M4.2 (temporary `url."$HOME/IdeaProjects/me/LumenCortex".insteadOf = https://github.com/edynasty/LumenCortex`, `GOPROXY=direct GOPRIVATE=…`, removed afterwards). Core `7b8c690` contains the `provider` dispatcher, `provider/anthropic` and the `{secret:NAME}` credential API the rest builds on.
- The only compile break (`internal/backend/config.go` `ResolveAPIKey()`) became resolver-aware; see discovery below.

### Platform secret store (`internal/backend/keychain_darwin.go`, `keychain_other.go`)

- `credentialStore{Set, Get, Delete, Available}` (`internal/backend/credentials.go`) over the macOS Keychain via cgo Security.framework: `SecItemAdd` → `errSecDuplicateItem` → `SecItemUpdate`, `SecItemCopyMatching` (`kSecReturnData`), `SecItemDelete`.
- Generic passwords, service `com.lumencortex.desktop.provider-credentials`, account = the secret name, `kSecAttrAccessibleWhenUnlockedThisDeviceOnly`. The `security` CLI is deliberately not used (its argv would carry the secret).
- The CF dictionary work lives in C helpers: cgo maps opaque CF pointer typedefs (`CFDataRef` etc.) to Go `uintptr`, which must not be wrapped in `unsafe.Pointer` — `go vet` enforces that, the helpers keep the file vet-clean.
- Errors carry only `SecCopyErrorMessageString` text plus the OSStatus; never a value. Missing items wrap `errSecretNotFound`, which `credentialResolver` maps to Core's `config.ErrCredentialNotFound`.
- Non-darwin builds: `unavailableStore` with `Available() == false` and clear errors; `{env:NAME}` references keep working everywhere.

### Resolver, naming, timeouts

- `credentialResolver` implements Core's `config.CredentialResolver` (`Resolve`), and `set`/`delete`/`read` helpers bound **every** store call with `credentialStoreTimeout` (5 s): a Keychain that stalls behind a prompt fails fast instead of blocking a Wails callback or a run indefinitely. The underlying call is not cancellable; it finishes on its goroutine and its result is dropped.
- Secret name: `provider.<scope>.<sanitized-id>.<8 hex of sha256(scope\0id)>` — deterministic, collision-free for any provider id the schema allows (ids that sanitize alike are separated by the hash), inside Core's NAME pattern `^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$`.

### Runtime wiring (`internal/backend/runtime.go`, `config.go`)

- `Runtime` holds the store (`New()` installs the platform one; tests swap their own before opening a workspace). `lcx.Open` now passes `ProviderFactory: r.providerFactory`, a closure over `provider.FromModel(m, provider.Options{Credentials: resolver})`: every run speaks the provider's own protocol (`openai-compatible` or `anthropic-messages`) and resolves `{secret:NAME}` from the Keychain. Env references never consult the resolver (Core's rule).
- `ConfigState` re-reports each `ModelInfo.APIKeySet` through the resolver (`applyCredentialAvailability`), so `{secret:}` providers show as set in the picker; Core's `Catalog()` alone knows only the environment.
- `DiscoverProviderModels`/`TestProviderConnection` are protocol-aware: `GET {baseURL}/models` with `Authorization: Bearer` for openai-compatible, `GET {baseURL}/v1/models` with `x-api-key` + `anthropic-version: 2023-06-01` for anthropic-messages (endpoint variants trimmed accordingly); the provider's configured headers override both defaults; keys resolve through the store; redirects stay refused. Non-2xx errors now carry a one-line 256-byte body excerpt with **every** occurrence of the key replaced by `[redacted]` (`secretRedactor`), applied to all error texts after the key is known.
- `SaveProviderCatalogScope` validates `ProviderDefinition.package` at save time through Core's `NormalizePackage`: the legacy ids collapse to `openai-compatible`, unknown values are refused with a clear error naming the value and the two supported protocols; an absent DTO package preserves the file's (`applyCatalog` → `providerPackageForSave`).

### Wails APIs (`app.go`, per contract)

```go
type CredentialStatus struct {
  ProviderID        string `json:"providerId"`
  Scope             string `json:"scope"`
  Source            string `json:"source"`            // "none" | "env" | "keychain"
  Ref               string `json:"ref,omitempty"`
  Set               bool   `json:"set"`
  KeychainAvailable bool   `json:"keychainAvailable"`
}
GetProviderCredentialStatus(scope, providerID) / SaveProviderCredential(scope, providerID, apiKey) / RemoveProviderCredential(scope, providerID)
```

- `SaveProviderCredential`: writes the store, then sets `settings.apiKey = {secret:NAME}` in that scope's file through the same `config.Save` path as the provider panel (digest conflict included). A failed config save rolls the Keychain back — a replaced key is restored to its previous value, a first-time key is deleted again.
- `RemoveProviderCredential`: deletes the Keychain item and clears the reference only when it is a `{secret:..}` one; an `{env:..}` reference is left untouched (reported, not an error).
- The key value crosses the boundary exactly once (the save argument). It is never returned, logged, exported, evented or written to disk.

### Docs

- `docs/lumencortex.schema.json`: byte-identical copy of Core's (package enum + `{secret:NAME}` apiKey pattern); `TestSchemaIdentityWithCore` enforces it.
- `docs/architecture.md`: new "Provider protocols and credentials" section.

## Tests (`internal/backend/credentials_test.go`, `keychain_darwin_test.go`)

Deterministic (fake in-memory store, httptest upstreams, no network):
- `TestProviderCredentialLifecycle` — save → status keychain/set → file holds only the reference → picker shows set → replace → resolver returns the new value → remove → status none/store empty/picker unset; `{env:NAME}` set and unset states; removal leaves an env reference alone.
- `TestProviderCredentialRejectsInvalidInput` — unknown provider (status/save/remove), empty/whitespace key, unknown scope; the store is never written.
- `TestSaveProviderCredentialRollsBackWhenConfigSaveFails` — config dir made unwritable after the store write: replaced key restored to its previous value, first-time key deleted, file byte-identical to before.
- `TestCredentialNameShape` — names deterministic, scope-distinct, inside Core's NAME pattern, hash-separating ids that sanitize alike.
- `TestSaveProviderCatalogScopeValidatesPackage` — unknown package refused with a clear error; `anthropic-messages` saved; `@ai-sdk/openai-compatible` normalized to `openai-compatible`; absent DTO package preserves the file's; a new provider defaults to empty.
- `TestCredentialResolverContract` — missing/empty secret is `config.ErrCredentialNotFound`; a stored value passes through.
- `TestProviderRunAndAPINeverLeakTheSecret` (leak proof) — full agent runs through the Desktop runtime path (supervisor.Start → Engine → dispatcher factory) against a fake Anthropic Messages server and a fake OpenAI server, both providers keyed by `{secret:NAME}`: the wire auth carries the key (`x-api-key` + `anthropic-version`, no Bearer, path `/v1/messages`; `Authorization: Bearer`, path `/v1/chat/completions`), and the value appears in **no** returned struct JSON (ConfigState, catalog documents, both `CredentialStatus`, session, messages), neither log sink (`log` and `slog` captured), no event forwarded to the frontend, no file at rest under the workspace (store db included) or the configuration directory.
- `TestDiscoveryAndConnectionRedactEchoedKeys` — discovery/test speak each protocol's auth and endpoint; upstreams echoing the key in a 401 error body get it redacted to `[redacted]` in every returned error.
- `TestRealKeychainLifecycle` (darwin, real Keychain) — set, get, replace, get, delete, get-not-found, delete-not-found, not-found and empty-name errors free of the value; unique per-run service name, `t.Cleanup` removal, skips with a message when the Keychain is unavailable.

### Real Keychain run (this machine)

First run skipped with `keychain: The authorization was canceled by the user. (OSStatus -60006)`: `TestMain` isolates `HOME`, and the client-side Security framework resolves the login keychain through it — a faithful-ness gap, since the app always runs with the user's real HOME. `TestMain` now records `originalHome` and the test restores it with `t.Setenv`, exactly matching production. Result after the fix:

```text
=== RUN   TestRealKeychainLifecycle
--- PASS: TestRealKeychainLifecycle (0.55s)
```

Real items were created, replaced and deleted in the user's login keychain under the per-run test service (no prompt; the items are created by the calling process itself).

## Validation (exact commands, observed)

- `go build ./...` — pass.
- `go vet . ./internal/backend` — no findings (the cgo CF helpers keep `unsafe.Pointer` misuse checks clean).
- `go test -timeout 90s ./internal/backend .` — all pass (full package, incl. all tests above and the pre-existing suite).
- `gofmt` — clean on every touched file; pre-existing findings in untouched files (`main.go`, `context.go`, `lsp.go`, `tasks_test.go`, `worktree.go`) left as they are.

## Decisions

- Store created lazily per `Runtime` in `New()`; in-package tests swap the field before `OpenWorkspace`. The factory closure reads the resolver at call time, so a swap is honored even after a workspace opens.
- Rollback order on save: store write first, config save second; on save failure the previous store value (read before the write) is restored, or the item deleted when none existed. Remove deletes the store item first, tolerating not-found, then clears the reference.
- Discovery errors include a bounded body excerpt — better diagnostics — which is exactly why every such text is run through the redactor; errors that would carry the key lose their error identity (`errors.New`), acceptable only on that path.
- `SaveProviderCredential` on a provider whose `apiKey` is an `{env:..}` reference replaces it with `{secret:NAME}`: saving a key means the key lives in the store from then on. `RemoveProviderCredential` is the only path that refuses to touch env references.

## Blockers / handoffs

- None on the Go side. DesktopProviderUI owns `bridge.ts`/`types.ts` (entries for the three APIs already present) and the panel UI.
- The bridge contract test (`TestBridgeDeclaresExactlyTheBoundAppMethods`) passed at validation time with the frontend's current `AppAPI`.
