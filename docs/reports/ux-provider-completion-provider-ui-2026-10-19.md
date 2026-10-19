# UX & Provider Completion — Provider UI: protocol selector + Keychain API keys (stage B/C frontend)

Date: 2026-10-19
Repo: LumenCortex-Desktop (`~/IdeaProjects/me/LumenCortex-Desktop`), branch `main`, local only.
Scope owner: DesktopProviderUI (frontend only). Backend counterpart: commit `00f2504`
("feat(desktop): provider protocol support and Keychain credential storage (stage B/C backend)").

## Scope

Settings → Models & providers (Provider pane) only:

1. **Protocol selector** in the provider form — exactly two options, `[OI] Compatible`
   (`openai-compatible`) and `Anthropic Messages` (`anthropic-messages`), persisted in the
   provider definition's `package`. Switching to Anthropic swaps the base URL/endpoint hints
   (default base `https://api.anthropic.com`, endpoint placeholder
   `https://api.anthropic.com/v1/messages`, help "defaults to baseURL + /v1/messages when
   empty"); the [OI] hints are unchanged. Brief factual copy explains the wire difference
   (`/chat/completions` + `Authorization: Bearer` vs `/v1/messages` + `x-api-key` +
   `anthropic-version`) with no marketing. An Anthropic preset was added to the quick-add row;
   the three existing presets are byte-identical. Legacy providers without a `package`
   display as [OI] Compatible and are saved unchanged unless the user edits the provider form
   (covered by a test: a model/default-model save does not add `package`).
2. **API key section per provider** (view mode of an existing provider) with two sources:
   `Environment variable` (the unchanged {env:NAME} flow — name field in the edit form) and
   `macOS Keychain`. Keychain mode: masked input (`type=password`,
   `autocomplete="new-password"`, `autocorrect/spellcheck` off, dot-mask placeholder when a
   key exists), Save → Replace (when a secret ref is configured) → Remove with an inline
   confirm, status line from `GetProviderCredentialStatus` (aria-live=polite: "Saved in
   Keychain" / "Environment variable NAME is set/not set" / "No API key configured"),
   labeled `Test connection` button sharing the existing runtime action (loading disables the
   button, the result lands in the existing notice row). `keychainAvailable=false` disables
   the Keychain radio with a visible explanation.
3. Literal keys pasted into the old env-name field are refused at three layers: the form marks
   the field invalid with a copy message and disables Save; `commitProvider` refuses
   (`envNameValid` matches Core's `{env:NAME}` schema shape); Core's schema would reject the
   save anyway.

### Key hygiene

The typed key lives only in `ProviderCredentialSection`'s input state, travels to Go exactly
once as the `SaveProviderCredential` argument, and is cleared after every save attempt
(success or failure). The catch paths drop the backend's error text entirely and show fixed
generic copy, so an error that echoes the key cannot reach the DOM (covered by a test whose
rejection smuggles the key). The key never enters the provider draft, the catalog JSON, React
persisted state, localStorage/sessionStorage, URLs, logs or toasts; the section never fetches
or displays a stored key (placeholder mask only). A `{secret:NAME}` reference loaded from the
catalog round-trips as `ProviderDraft.secretRef` so saving an unrelated form edit does not
wipe it; an env name takes precedence when entered.

## Contract consumed (matches backend `00f2504` exactly)

```go
type CredentialStatus struct {
  ProviderID        string `json:"providerId"`
  Scope             string `json:"scope"`
  Source            string `json:"source"`            // "none" | "env" | "keychain"
  Ref               string `json:"ref,omitempty"`
  Set               bool   `json:"set"`
  KeychainAvailable bool   `json:"keychainAvailable"`
}
GetProviderCredentialStatus(scope, providerID) / SaveProviderCredential(scope, providerID, apiKey)
RemoveProviderCredential(scope, providerID)
```

Bridge: `frontend/src/lib/bridge.ts` adds the three `AppAPI` declarations plus
`providerCredentialStatus` / `saveProviderCredential` / `removeProviderCredential`, following
the existing `window.go.main.App` pattern (no `frontend/wailsjs` import; generated bindings
stay untracked). Types: `CredentialStatus` and `ProviderPackage` (`"openai-compatible" |
"anthropic-messages"`) in `frontend/src/types.ts`; `ProviderDefinition.package` is now typed
`ProviderPackage`.

## Validation (commands run, observed results)

| Check | Command | Result |
|---|---|---|
| Types | `cd frontend && npx tsc --noEmit` | 0 errors |
| Unit tests | `cd frontend && npx vitest run` | **48 files / 213 tests passed** (was 47/204 before this task) |
| Playwright | `cd frontend && npx playwright test` | **61 passed** (58 pre-existing + 3 new provider-pane cases) |
| Build | `cd frontend && npm run build` | built in 1.22 s (chunk-size warning is pre-existing and unrelated) |

Focused during development: `npx playwright test -g "provider pane"` — 3/3 passed.

## Files

- `frontend/src/types.ts` — `ProviderPackage`, `CredentialStatus`, typed `package`.
- `frontend/src/components/provider/ProviderForms.tsx` — protocol SegmentedControl, protocol-
  dependent hints/placeholders, invalid env-name state.
- `frontend/src/components/provider/ProviderCredentialSection.tsx` (new) — the API key section.
- `frontend/src/components/provider/ProviderCatalogList.tsx` — renders the section for the
  selected provider in view mode (view-only by design: the form's env field covers editing and
  the section writes the file itself, so no draft/digest race).
- `frontend/src/components/provider/useProviderSettingsController.ts` — draft carries `package`
  (replaces `previous?.package || "openai-compatible"`), env-name refusal, `{secret:}` ref
  preservation, `reloadCatalog()` for the section's writes.
- `frontend/src/components/provider/provider-settings.css` — section styles + invalid field
  styles (tokens only).
- `frontend/src/visual/fixture-data.ts` — in-memory stub keychain: `visualKeychain` Map,
  `credentialStatusFor`, the three methods on `visualAppStub`; every response is built from
  fixed strings, the key value is never returned (the stub also gained an `anthropic` provider
  and `ANTHROPIC_API_KEY` in the fake env map). `keychainSecretName` mirrors the backend's
  `provider.<scope>.<id>.<hash>` shape.
- `frontend/src/components/provider/ProviderSettingsPanel.test.tsx` — 3 new protocol/validation
  tests; credential bridge mocks in the harness.
- `frontend/src/components/provider/ProviderCredentialSection.test.tsx` (new) — 6 tests:
  env status + source switch + input attributes; save→clear→replace with exact bridge args +
  catalog reload + key absent from text/innerHTML/non-password inputs; failure clears input
  and shows only the generic redacted message; inline-confirm remove with exact args;
  keychain-unavailable disables the radio with the explanation; test-connection loading →
  visible result → re-enable.
- `frontend/visual-tests/app.spec.ts` — new describe: pane with the new controls unclipped at
  1440/1180/820/560 (protocol selector + keychain controls present, `clippedControls`/
  `hardClippedText` empty); save → "Saved in Keychain" → input cleared → key absent →
  inline-confirm remove → "No API key configured"; `page.evaluate` proving no stub answer
  (status/catalog/config/test/save responses) contains the saved marker key.

## Decisions

- The credential section renders only in view mode (not while the provider form is open): the
  backend writes the file on Save/Remove, which would invalidate the form's digest mid-edit;
  after committing an edit the section remounts with fresh status.
- `ProviderDraft.secretRef` keeps the loaded `{secret:NAME}` so an unrelated provider-form save
  does not clear the Keychain wiring; entering an env name intentionally overrides it.
- The Keychain radio is disabled while the status is still loading (unknown availability) and
  the unavailable-explanation renders only once a status answered — no flash of wrong copy.
- Save response status is applied directly (guarded by a scope:provider ref so a mid-flight
  provider switch cannot land stale status); `reloadCatalog()` re-reads the file so the
  advanced JSON and digest stay truthful after the section's writes.
- i18n lives in `provider-copy.ts` (the pane's established bilingual copy module); no strings
  in components.



## Unverified / handoffs

- macOS Keychain behavior itself is backend `00f2504`'s (its own report:
  `docs/reports/ux-provider-completion-credentials-desktop-2026-10-19.md`); the UI was
  exercised over the in-memory stub only.
