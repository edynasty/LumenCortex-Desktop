# AI Development Standard

This document defines how AI coding agents are expected to develop LumenCortex Desktop.

The objective is not merely to produce code that compiles. AI-produced changes must preserve architecture, product coherence, security, bounded-memory behavior, and maintainability.

## 1. Core principles

AI agents working on this repository MUST:

1. Understand before editing.
2. Preserve ownership boundaries.
3. Make coherent, reviewable changes.
4. Validate claims with real checks.
5. Prefer durable architecture over local hacks.
6. Treat secrets and user workspaces as sensitive.
7. Avoid regressions in long-running-task behavior.
8. Leave the repository understandable for the next agent/human.

---

## 2. Required context before editing

Before modifying a subsystem, inspect the relevant files.

### Frontend work

Read:
- `AGENTS.md`
- `docs/frontend-development-standard.md`
- affected React files,
- `frontend/src/lib/bridge.ts`,
- related TypeScript types.

### Backend/Desktop integration work

Read:
- `AGENTS.md`
- `docs/architecture.md`
- affected Go adapter files,
- related Core runtime API,
- backend tests.

### Provider/model work

Also read:
- `docs/lumencortex.schema.json`
- provider config/resolver implementation,
- provider tests.

### Core/runtime capability work

Do not implement it in Desktop first.

Check whether the capability belongs in the Core repository:
- agent loop,
- tools,
- LSP,
- MCP,
- subagents,
- repository search,
- workflow,
- persistence,
- resource management.

Desktop should consume Core capability rather than fork it.

---

## 3. Change planning

For a non-trivial change, the AI SHOULD identify internally:

- user workflow being solved,
- source of truth,
- files likely affected,
- API/type changes,
- state ownership,
- failure modes,
- tests required,
- backward compatibility.

Do not create a speculative architecture document before every small change. Planning must be proportional to the task.

---

## 4. Source-of-truth rules

There must be one authoritative owner for each kind of state.

| State | Owner |
|---|---|
| Session/task history | Core / SQLite |
| Messages | Core / SQLite |
| Agent status | Core runtime |
| Provider catalog | `lumencortex.json` |
| Provider/model execution identity | Core/Desktop backend |
| Live transient events | bounded frontend buffer |
| Drawer/tab/search UI state | React |
| Secrets | environment / future secure credential store |

AI MUST NOT create a competing source of truth for convenience.

Examples of prohibited duplication:
- provider config in both localStorage and `lumencortex.json`,
- permanent session state in React only,
- duplicated agent scheduler in Desktop and Core.

---

## 5. Architectural decision rule

When deciding where code belongs:

### Put it in Core when it:
- changes agent behavior,
- implements coding tools,
- controls session lifecycle,
- manages persistence,
- implements provider transport,
- handles resource budgets,
- implements LSP/MCP/subagents/search.

### Put it in Desktop backend when it:
- adapts Core to Wails,
- handles native dialogs,
- manages Desktop-specific lifecycle,
- exposes typed Desktop APIs,
- handles Desktop-local configuration I/O.

### Put it in frontend when it:
- renders state,
- handles interaction,
- manages transient UI state,
- invokes typed Desktop operations.

If uncertain, prefer pushing reusable runtime behavior downward rather than duplicating it upward.

---

## 6. Frontend implementation rules for AI

AI MUST follow `docs/frontend-development-standard.md`.

Additional AI-specific constraints:
- Do not redesign the entire application when asked to add one feature.
- Do not invent a new visual style in a feature branch/change.
- Reuse established layout, typography, spacing, tokens and icon rules.
- New icons must come from Lucide.
- Do not add dependencies unless the benefit is clear and recurring.
- Do not write huge inline style objects.
- Do not hardcode user-visible copy in many JSX locations.
- Do not hide real backend limitations with fake/mock UI.
- Do not add controls that call no real capability unless clearly marked as unavailable/prototype and explicitly requested.

---

## 7. Backend implementation rules for AI

Go code SHOULD:
- use explicit types,
- return actionable errors,
- propagate context,
- keep lock scope small,
- avoid goroutine leaks,
- avoid unbounded channels/queues,
- avoid holding locks across network or slow filesystem operations,
- preserve cancellation semantics.

AI MUST consider:
- what happens when the app closes,
- what happens when workspace switches,
- what happens when a request is cancelled,
- what happens after process restart,
- whether state should be durable or transient.

Tests should verify behavior, not timing assumptions that transports do not guarantee.

---

## 8. Provider development rules

Provider changes MUST preserve the catalog model:

```text
provider/model -> provider definition -> model definition -> real modelID
```

Configuration surface:

```text
lumencortex.json
```

AI MUST NOT:
- hardcode vendor-specific secrets,
- expose resolved environment secret values to frontend,
- store API keys in SQLite/localStorage,
- treat display model name as the upstream model ID unless explicitly configured that way.

Provider behavior SHOULD support:
- custom display name,
- OpenAI-compatible base URL,
- exact endpoint override,
- environment-backed API key,
- multiple models,
- real upstream model ID,
- model limits.

When provider schema changes:
1. update Go types/resolver,
2. update JSON schema,
3. update frontend types,
4. update UI if needed,
5. update tests,
6. update README/docs.

---

## 9. Security rules

Never commit:
- real API keys,
- access tokens,
- cookies,
- private credentials,
- generated secret-bearing config.

Never log full secrets.

When displaying errors:
- avoid echoing Authorization headers,
- avoid dumping full request objects containing credentials,
- redact sensitive values if error context may contain them.

File operations must remain scoped to the selected workspace unless the explicit permission mode allows otherwise.

---

## 10. Bounded-memory rules

LumenCortex is designed for long-running tasks.

Every AI change that introduces a collection, cache, stream, queue or history MUST answer:

1. Can it grow with task duration?
2. What bounds it?
3. Is durable storage more appropriate?
4. Can it be paged/lazy-loaded?
5. What happens under memory pressure?

Forbidden:
- append-only React event arrays with no cap,
- unbounded tool output accumulation,
- reading entire huge repositories into memory for convenience,
- retaining historical session objects indefinitely in frontend state.

---

## 11. Error handling

AI MUST distinguish:
- expected user error,
- configuration error,
- runtime failure,
- provider/network failure,
- cancellation,
- internal invariant failure.

Error messages SHOULD include enough context to act:
- which provider/model,
- which config field,
- which operation,
- which session,
- which file when relevant.

Do not replace errors with generic "Something went wrong" if useful detail exists.

Frontend may show a friendly summary, but technical detail should remain available.

---

## 12. Concurrency rules

When adding concurrency:
- cancellation must be explicit,
- ownership of goroutines must be clear,
- shutdown must wait only for owned work,
- bounded concurrency is required,
- do not start unlimited subagents/tasks,
- shared mutable maps require synchronization or single-owner design.

Do not infer network cancellation correctness solely from remote server disconnect observation.

---

## 13. Testing standard

Behavior changes require tests at the lowest useful layer.

### Go backend

Prefer tests for:
- configuration resolution,
- session lifecycle,
- provider identity,
- cancellation,
- workspace switching,
- persistence boundary behavior.

Avoid brittle tests based on arbitrary sleeps. Use channels/events/deadlines where possible.

### Frontend

At minimum:
- TypeScript compile must pass,
- production Vite build must pass.

As component complexity grows, add targeted component/unit tests rather than relying solely on build success.

### Integration

When Wails bridge/backend contracts change, run a Wails build.

---

## 14. Validation matrix

AI MUST run all checks affected by its change.

| Change | Required checks |
|---|---|
| CSS/UI only | npm install + npm run build |
| React/TS logic | npm install + npm run build |
| Go backend | go test + go vet |
| Wails bridge contract | frontend build + Go tests + Wails build |
| Provider config/resolver | Go tests + frontend build + Wails build |
| Build config | relevant full CI/build |

Canonical commands:

```bash
cd frontend
npm install
npm run build
```

```bash
go test -v -timeout 90s ./internal/backend
go vet ./internal/backend
```

```bash
wails build -clean -platform darwin/universal
```

Passing an earlier commit's CI is not evidence that a later commit passes.

---

## 15. Commit/change quality

A coherent AI change SHOULD:
- solve one meaningful slice,
- keep related schema/types/tests together,
- avoid unrelated cleanup unless required,
- remove temporary scaffolding,
- use descriptive commit messages.

Examples:

```text
feat: add provider model catalog
ui: expose model picker in composer
fix: cancel active agent before workspace close
test: cover provider env key resolution
docs: define frontend development standard
```

Avoid meaningless messages such as:
- update
- changes
- fix stuff
- wip

---

## 16. Documentation rules

Update docs when changing:
- configuration schema,
- architecture boundary,
- security behavior,
- user workflow,
- public bridge/API contract,
- developer workflow.

Do not write documentation that describes future behavior as already implemented.

Keep docs synchronized with actual code.

---

## 17. AI interaction rules

When executing a task autonomously:

AI SHOULD:
- give concise progress updates for long/multi-step work,
- share concrete findings when discovered,
- continue through validation without repeatedly asking for confirmation,
- use existing user decisions from the conversation,
- report exact commit/check results.

AI MUST NOT:
- claim work is running in the background,
- promise a result later without executing now,
- fabricate test/build success,
- claim access to data or tools not actually available,
- repeatedly ask questions already answered.

If a safe, reasonable assumption can unblock implementation, make it and document the assumption.

---

## 18. UI-reference rule

External products may be used as references for:
- layout,
- density,
- interaction model,
- information hierarchy,
- UX patterns.

AI MUST NOT:
- copy proprietary assets,
- copy branding,
- clone screenshots pixel-for-pixel,
- introduce external code without a compatible license.

The goal is a coherent LumenCortex identity.

---

## 19. Refactoring rule

Refactor when:
- a file is becoming difficult to reason about,
- responsibilities are mixed,
- repeated logic is emerging,
- testing is blocked by structure.

Do not refactor merely because a different style is preferred.

When touching a large legacy file:
- improve the area being changed,
- avoid expanding the monolith,
- extract only stable responsibilities.

---

## 20. Definition of ready for merge/main

Before declaring a task complete, AI MUST verify:

### Product
- [ ] Requested workflow actually works.
- [ ] No fake/dead control was added.
- [ ] Existing core workflow still works.

### Architecture
- [ ] Source of truth is correct.
- [ ] No duplicated Core behavior in Desktop.
- [ ] No new unbounded state.

### Frontend
- [ ] Follows frontend standard.
- [ ] Uses Lucide for icons.
- [ ] Chinese default remains intact.
- [ ] Responsive behavior remains valid.

### Security
- [ ] No secrets committed/persisted.
- [ ] Provider keys are not exposed.

### Validation
- [ ] Frontend build passes when affected.
- [ ] Go tests/vet pass when affected.
- [ ] Wails build passes when integration is affected.

### Repository quality
- [ ] Temporary files/scaffolding removed.
- [ ] Docs/schema updated where required.
- [ ] Final reported SHA/check status matches actual latest commit.

If any item is not satisfied, the change is not complete unless the limitation is explicitly reported.
