# UX & Provider Completion — Provider UI: protocol selector + single key-or-placeholder field (stage B/C frontend)

Date: 2026-10-19
Repo: LumenCortex-Desktop (`~/IdeaProjects/me/LumenCortex-Desktop`), branch `main`, local only.
Scope owner: DesktopProviderUI (frontend only). Backend counterpart: `00f2504` plus its
owner-decision reworks (Keychain → local credentials file; classification inside
`SaveProviderCredential`).

## Owner decisions recorded in this revision

1. ~~macOS Keychain~~ → **superseded**: keys are stored in a local credentials file (0600,
   LumenCortex config folder) with a `{secret:NAME}` reference in `lumencortex.json`.
2. ~~Two-source selector (Environment variable | Direct input)~~ → **superseded**: **ONE API
   key field**, like a Spring yml value: the user types either a literal key or an environment
   placeholder `${NAME}` (also `{env:NAME}`). This revision is the clean cutover: no source
   radio group, no mode copy, no two-source tests remain.

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
2. **API key section per provider** (view mode of an existing provider) — ONE field:
   - `source=env`: the current placeholder text `${NAME}` is the field's editable value (it
     is not a secret; rendered as plain text), status "Reads environment variable NAME
     (set|not set)".
   - `source=stored`: dot-mask placeholder; buttons Replace / Remove (inline confirm) /
     Test; the stored literal is never read back or shown.
   - `source=none`: empty field, placeholder `sk-… or ${ENV_NAME}`.
   - Input type is dynamic: `type=password` while the value may be a literal; a value
     matching `^\$\{NAME\}$` or `^\{env:NAME\}$` switches the input to plain text
     (`autocomplete=off`, no spellcheck). `Save`/`Replace`, inline-confirm Remove, labeled
     `Test connection` (shared runtime action; loading disables the button, the result lands
     in the existing notice row), status line aria-live=polite.
   - **Classification is the backend's**, inside `SaveProviderCredential(scope, providerID,
     value)`: placeholder → `{env:NAME}` reference in config, stored key removed; literal →
     stored locally with a `{secret:}` reference; Spring-style `${NAME:default}` is rejected.
   - **Remove semantics (owner's open choice, resolved simply):** Remove appears only when
     `source=stored` (there is a stored key). With an env reference the backend leaves it
     alone, so the UI shows no Remove button for env — the user edits the field to change or
     empty it. Tested in Playwright (`Remove` count 0 while env, 1 after storing a literal).
3. The provider EDIT form's old env-var field stays (it is the only key-setting surface while
   creating a provider, before the section exists), and literal keys typed there are refused
   at three layers: form invalid state + disabled Save; `commitProvider` refusal
   (`envNameValid` = Core's `{env:NAME}` schema shape); Core's schema would reject the save.

### Key hygiene

The typed value lives only in `ProviderCredentialSection`'s input state, travels to Go
exactly once as the `SaveProviderCredential` argument, and is cleared (reset to the visible
env reference or empty) after every save attempt, success or failure. Catch paths drop the
backend's error text entirely and show fixed generic copy, so an error that echoes the key
cannot reach the DOM (covered by a test whose rejection smuggles the key). The key never
enters the provider draft, the catalog JSON, React persisted state, localStorage/
sessionStorage, URLs, logs or toasts; a stored literal is never fetched or displayed. A
`{secret:NAME}` reference loaded from the catalog round-trips as `ProviderDraft.secretRef`
so saving an unrelated form edit does not wipe it; an env name takes precedence.

## Contract consumed

```go
type CredentialStatus struct {
  ProviderID string `json:"providerId"`
  Scope      string `json:"scope"`
  Source     string `json:"source"` // "none" | "env" | "stored"
  Ref        string `json:"ref,omitempty"`
  Set        bool   `json:"set"`
}
GetProviderCredentialStatus(scope, providerID) / SaveProviderCredential(scope, providerID, value)
RemoveProviderCredential(scope, providerID)
```

`source=env` carries the env reference in `ref` so the field can show `${NAME}`. Bridge:
`frontend/src/lib/bridge.ts` declares the three `AppAPI` methods plus
`providerCredentialStatus` / `saveProviderCredential` / `removeProviderCredential`, following
the existing `window.go.main.App` pattern (no `frontend/wailsjs` import; generated bindings
stay untracked). Types: `CredentialStatus` and `ProviderPackage` in
`frontend/src/types.ts`; `ProviderDefinition.package` is typed `ProviderPackage`.

## Files

- `frontend/src/types.ts` — `ProviderPackage`, `CredentialStatus`, typed `package`.
- `frontend/src/lib/bridge.ts` — three new AppAPI methods + bridge wrappers.
- `frontend/src/components/provider/provider-presets.ts` — `package` on presets + Anthropic preset.
- `frontend/src/components/provider/provider-settings-model.ts` — draft `package`/`secretRef`,
  `secretReference`, `envNameValid` (Core's env-name shape).
- `frontend/src/components/provider/provider-copy.ts` — new keys, zh-CN + en, centralized:
  `keySaved` (已保存在本机 / Saved locally), `keyEnvSet`/`keyEnvUnset` (读取环境变量 {name}
  （已设置/未设置） / Reads environment variable {name} (set|not set)), `keyNone`,
  `keyInputPlaceholder` (sk-… 或 ${ENV_NAME} / sk-… or ${ENV_NAME}), `keyMasked`,
  `replaceKey`, `removeKey`, `confirmRemoveKey`, `statusLoadFailed`, `storedHint` (owner's
  honest wording: enter the key itself or ${ENV_NAME}; stored in a local file in the config
  folder, readable only by your user, not encrypted; the config file keeps only a reference),
  protocol hints, `invalidEnvName`, redacted failure texts.
- `frontend/src/components/provider/ProviderForms.tsx` — protocol SegmentedControl, protocol-
  dependent hints/placeholders, invalid env-name state.
- `frontend/src/components/provider/ProviderCredentialSection.tsx` (new) — the single
  key-or-placeholder field with dynamic input type, stored/env/none presentation,
  save/replace/remove-with-inline-confirm, shared test connection.
- `frontend/src/components/provider/ProviderCatalogList.tsx` — renders the section for the
  selected provider in view mode (view-only by design: the form's env field covers editing
  and the section writes the file itself, so no draft/digest race).
- `frontend/src/components/provider/useProviderSettingsController.ts` — draft carries
  `package` (replaces `previous?.package || "openai-compatible"`), env-name refusal,
  `{secret:}` ref preservation, `reloadCatalog()` for the section's writes.
- `frontend/src/components/provider/provider-settings.css` — section styles + invalid field
  styles (tokens only).
- `frontend/src/visual/fixture-data.ts` — stub mirroring the backend rules: `visualStoredKeys`
  Map as the credentials file, `ENV_VALUE` classification inside `SaveProviderCredential`
  (placeholder → `{env:NAME}` ref + stored key removed; literal → stored + `{secret:NAME}`;
  `${NAME:default}` rejected with an error), status `source "stored"|"env"|"none"`, responses
  built from fixed strings only (also gained an `anthropic` provider and `ANTHROPIC_API_KEY`
  in the fake env map).
- `frontend/src/components/provider/ProviderSettingsPanel.test.tsx` — 3 protocol/validation
  tests (Save clicks scoped to the provider/model form now that the section also has a Save
  button); credential bridge mocks in the harness.
- `frontend/src/components/provider/ProviderCredentialSection.test.tsx` (new) — 6 tests: env
  reference shown as field value with plain-text type and no source radio; `${NAME}` edit
  saved with exact bridge arg and env status adopted; literal masked while typed, stored on
  save, cleared, dot-mask placeholder, Replace offered, key absent from text/innerHTML/
  non-password inputs; failure resets the field and shows only the generic redacted message;
  inline-confirm remove with exact args; test-connection loading → visible result →
  re-enable.
- `frontend/visual-tests/app.spec.ts` — provider-pane describe: unclipped at
  1440/1180/820/560 with the single field (value `${DEEPSEEK_API_KEY}`, no source radios,
  protocol selector present); the flow test covers literal save → "Saved locally" → cleared +
  dot-mask placeholder → `${MY_PROVIDER_KEY}` replace (plain text, env status) → no Remove
  button while env → literal again → inline-confirm remove → "No API key configured"; and the
  `page.evaluate` sweep proving no stub answer contains the saved marker key.

## Decisions

- The field's value derivation: `edited ? keyInput : envRefText` — the env reference is the
  field's value until the user edits it; after a save (success or failure) the field resets
  to the freshly reported reference (or empty), never to a literal.
- Input type switches dynamically: a value matching the placeholder shape is plain text,
  anything else is masked. `autocomplete="off"`.
- Remove appears only for `source=stored` — the simplest correct behavior for env refs (the
  backend's `RemoveProviderCredential` leaves env references alone; hiding Remove avoids a
  no-op button and an empty-reference save path through the catalog).
- Save response status is applied directly (guarded by a scope:provider ref so a mid-flight
  provider switch cannot land stale status); `reloadCatalog()` re-reads the file so the
  advanced JSON and digest stay truthful after the section's writes.
- The edit form keeps its env-name field: it is the only key surface while creating a
  provider (the section needs an existing provider), and its literal-refusal protection stays
  meaningful for creation.
- i18n lives in `provider-copy.ts` (the pane's established bilingual copy module); no strings
  in components.

## Validation (commands run, observed results)

| Check | Command | Result |
|---|---|---|
| Types | `cd frontend && npx tsc --noEmit` | 0 errors |
| Unit tests | `cd frontend && npx vitest run` | **48 files / 213 tests passed** |
| Playwright | `cd frontend && npx playwright test` | **61 passed** (58 pre-existing + 3 provider-pane cases) |
| Build | `cd frontend && npm run build` | built in 1.18 s (chunk-size warning pre-existing, unrelated) |
| Cutover sweep | `grep -ri "sourceEnv\|sourceStored\|Direct input\|radiogroup.*Source" src/ visual-tests/` | 0 hits — no two-source UI remains |

## Unverified / handoffs

- Credentials-file behavior (classification, 0600 file, never echo) is the backend's; the UI
  was exercised over the in-memory stub only. The stub mirrors the documented rules including
  the `${NAME:default}` rejection.
