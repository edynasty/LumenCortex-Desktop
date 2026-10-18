# AGENTS.md — LumenCortex Desktop

This file is the repository-level contract for AI coding agents.

Normative language:
- **MUST / MUST NOT**: required.
- **SHOULD / SHOULD NOT**: expected unless there is a documented reason.
- **MAY**: optional.

Before changing code, read:

1. [docs/frontend-development-standard.md](docs/frontend-development-standard.md)
2. [docs/ai-development-standard.md](docs/ai-development-standard.md)
3. [docs/architecture.md](docs/architecture.md)
4. [docs/lumencortex.schema.json](docs/lumencortex.schema.json) when changing providers/models.

## Product direction

LumenCortex Desktop is a local-first coding-agent workspace. The interaction model is:
- project/workspace oriented,
- thread/session oriented,
- agent-first rather than dashboard-first,
- compact and native-feeling,
- Chinese-first with English available,
- durable in Core/SQLite and bounded in frontend memory.

Visual references such as Codex or Vetta are references for information architecture and interaction quality, not assets to copy.

## Architecture boundary

```text
React / TypeScript UI
        │
        │ typed Wails bridge only
        ▼
Desktop Go adapter
        │
        ▼
LumenCortex Go runtime
        │
        ├── sessions
        ├── agents
        ├── tools
        ├── provider execution
        └── persistence
```

The Desktop frontend MUST NOT reimplement Core runtime behavior.

## Mandatory frontend rules

- Use React + TypeScript.
- Use **Lucide React** for general UI icons.
- Do not add hand-drawn SVG icon sets, emoji icons, Unicode-symbol buttons, or a second icon library.
- Chinese is the default UI language.
- User-visible copy MUST be centralized; do not scatter new bilingual strings through components.
- UI color, spacing, radius, typography and elevation MUST come from shared design tokens/CSS variables.
- New UI MUST work at these widths: 1440, 1180, 820, and 560 px.
- Long-lived UI collections MUST be bounded, paginated, or virtualized.
- Wails calls MUST go through `frontend/src/lib/bridge.ts`.
- Shared domain types MUST live in `frontend/src/types.ts` or a domain-specific type module.
- Do not store API keys in localStorage, sessionStorage, React persisted state, workspace SQLite, logs, or screenshots.
- Provider secrets SHOULD use `{env:VARIABLE_NAME}`.

## Mandatory Go/backend rules

- Desktop backend remains a thin adapter over LumenCortex Core.
- Runtime behavior belongs in Core unless it is Desktop-specific integration.
- Every new Wails API MUST have:
  1. Go implementation,
  2. typed frontend bridge method,
  3. TypeScript types,
  4. backend test when behavior is non-trivial.
- Context cancellation MUST propagate to I/O.
- Long-running operations MUST NOT block Wails UI callbacks indefinitely.
- Provider/model identity MUST be durable and explicit.
- Workspace configuration is `lumencortex.json`; the schema is `docs/lumencortex.schema.json`.

## Provider/model contract

Model references use:

```text
provider/model
```

Example:

```text
deepseek/coder
```

A provider may define:
- display name,
- package/adapter,
- `baseURL`,
- exact `endpoint`,
- API key or environment reference,
- multiple models,
- model display name,
- real upstream `modelID`,
- model limits.

The everyday UI SHOULD expose a model picker, not raw endpoint/key fields. Raw provider configuration belongs in the Provider configuration surface.

## AI change discipline

AI agents MUST:
- inspect relevant code before editing;
- preserve existing architecture unless the task explicitly changes it;
- make the smallest coherent change that fully solves the task;
- remove abandoned scaffolding;
- avoid duplicate implementations;
- add/update tests for behavior changes;
- update docs/schema when contracts change;
- validate frontend, backend and Wails build when affected;
- report exact validation status rather than claiming success without evidence.

AI agents MUST NOT:
- silently replace an established design system;
- add a dependency for a trivial function already supported by the stack;
- introduce a second source of truth for sessions, providers, runtime state or configuration;
- invent backend capabilities in the UI;
- persist secrets for convenience;
- leave mock/demo behavior on the production path;
- claim asynchronous/background work.

## Harness-first architecture priority

LumenCortex is a coding-agent **harness/runtime first**, not a model-specific integration project.

AI agents MUST keep architecture work centered on harness mechanics: execution state, tool orchestration, context construction, persistence, checkpoints, crash/cancel recovery, concurrency, idempotency, evaluation, observability, provider abstraction, and the Desktop/Core boundary.

Model/provider-specific behavior (DeepSeek, Anthropic, OpenAI, etc.) MAY be investigated only when it exposes a concrete compatibility requirement for the generic harness. In that case:
- reduce it to the smallest provider-adapter capability/protocol contract;
- keep model-specific details behind the adapter boundary;
- use the provider only as a conformance fixture/example, not as an architectural center;
- do not reshape Task State, recovery, orchestration, routing, or other core harness semantics around one model's quirks;
- stop provider-specific research once the generic contract and required regression test are clear.

Architecture documents SHOULD describe generic harness semantics first. Provider-specific examples belong in adapter notes/tests unless they materially change a generic contract.

## Long-running task progress and anti-loop rules

Compaction, handoff, resume, or context loss MUST NOT reset the task back to broad research.

Long architecture, implementation, audit, and migration work SHOULD be **artifact-led and iterative** rather than split into rigid research/design phases.

Use this working loop:

```text
Question → Evidence → Decision → Write/Implement → Verify → Next question
```

Reading, designing, writing, implementation, and targeted verification MAY interleave. The requirement is not "stop reading"; the requirement is that investigation continuously advances the active deliverable.

Agents MUST follow these rules:

- A durable checkpoint MUST record the active deliverable, current section/problem, completed work, verified facts/evidence, explicit decisions, unresolved questions/blockers, and the next concrete action.
- After compaction/resume, continue from the current artifact and open questions. Do not restart broad discovery merely to rebuild confidence.
- Every non-trivial investigation SHOULD be tied to a concrete design question, implementation decision, failing test, or active section of the deliverable.
- Once enough evidence exists to answer that question, update the artifact/code/test/decision before opening another broad line of investigation.
- Do not accumulate a large batch of research before writing. Prefer small cycles of evidence → decision → durable change.
- Re-reading the same source is allowed when the earlier evidence is insufficient, stale, contradicted, or needed for a precise reference. Re-reading only to regain confidence after compaction is prohibited.
- After compaction/resume, broad re-reading of the repository, audit, RECOVERY/checkpoint, provider documentation, or verification artifacts is prohibited unless a specific contradiction or blocker requires it. Read the smallest relevant slice instead.
- Repeated reading is considered a loop when it does not materially change at least one of: the active artifact, implementation, test evidence, explicit design decision, or recorded blocker.
- If the same TODO/open question survives two compactions without any durable design/code/test progress, the agent MUST break the loop by writing the current best design, marking narrow `VERIFY`/`TODO` gaps, or surfacing the exact blocker.
- Broad provider/model research MUST stop as soon as the generic adapter capability/contract and its regression or conformance test are clear.
- Context pressure SHOULD narrow the next question and increase checkpoint frequency, not trigger a restart of analysis.
- When uncertainty remains, prefer an explicit assumption or `VERIFY` marker in the artifact over postponing the entire deliverable.

A task is making progress when durable artifacts, implementation, tests, or explicit decisions advance. Token consumption, repeated verification, and repeated compaction do not count as progress.

## Non-negotiable reasoning and recovery boundary

**Reasoning is ephemeral. Observable state is persistent.**

AI agents and runtime/recovery implementations MUST treat this as a hard invariant:

- Hidden model reasoning MUST NOT be used as durable task state or as a recovery source. This includes `thinking`, `redacted_thinking`, chain-of-thought, scratchpads, internal notes, or equivalent provider-private reasoning fields.
- Agents MUST NOT inspect, reconstruct, summarize, replay, or migrate hidden reasoning from previous agent sessions in order to continue work.
- Raw OMP/agent session JSONL, compaction frames/history, or similar private session internals MUST NOT be used to recover prior reasoning. Diagnostic inspection MAY use non-reasoning metadata such as timestamps, record types, counts, tool-call status, and visible outputs, but hidden-reasoning content remains off limits.
- Renaming hidden reasoning to `summary`, `memory`, `notes`, or another field does not make it persistable or recoverable.
- Cross-session continuation MUST be reconstructed only from observable evidence: explicit Task State/TODOs, visible user/assistant messages, tool calls/results, artifacts, source files, Git state, tests, checkpoints, explicit decisions, and their evidence.
- If a prior rationale is absent from observable state, the next agent MUST re-derive it from current evidence rather than recover how the previous model thought.
- Compaction, checkpoint, and handoff MUST be state-based, not reasoning-based. They MUST preserve goals, constraints, completed/pending work, blockers, artifacts, evidence, tool outcomes, and explicit decisions while excluding hidden reasoning.
- Provider protocols MAY require opaque reasoning echo data within an active protocol/tool-use flow. Such data MUST remain provider-private and opaque to runtime/task logic, MUST NOT be summarized or interpreted, and MUST NOT be used for cross-session recovery.
- Any change to persistence, compaction, handoff, or recovery MUST include regression coverage proving that hidden-reasoning blocks are neither persisted into durable recovery state nor reloaded as recovery context.

This boundary MUST NOT be weakened to improve resume quality or avoid re-derivation.

## Durable reports and handoffs

For substantial architecture/design reviews, implementation milestones, security audits, migration acceptance, and cross-repository handoffs, agents MUST write and maintain a readable Markdown report in the project files. A chat-only completion report is insufficient.

- Use the existing canonical document when one exists. Otherwise use a descriptive path such as `docs/reports/<task>-<date>.md` (repository-specific work) or `../LumenCortex-architecture-audit/design/handoffs/<task>-<date>.md` (cross-repository design). Do not create redundant competing sources of truth.
- Start the document when the task begins and update it as verified evidence, decisions, and progress become available; do not wait until the final chat response.
- Record scope and exact baseline/commits; status (planned/implemented/validated/blocked); findings with severity and evidence; decisions (distinguish proposed from owner-approved); changes and affected files; tests actually run and results; unverified/platform limits; unresolved risks; next actions and handoff dependencies. Omit sections that are genuinely inapplicable.
- Link to source code, tests, authoritative design and verification artifacts rather than copying large sections. Never put credentials, hidden model reasoning, raw private agent traces, or secret-bearing log output in reports.
- Keep the report in sync with corrections. Final chat output SHOULD be a concise summary with the exact report path, commit state, and open blockers, not a substitute for the document.
- When the report is inside a Git repository, include it in the task's commit without staging unrelated changes. If its directory is not version-controlled, disclose that limitation explicitly and retain the exact local path.
- A brief chat summary is sufficient for trivial questions and tiny edits unless the user explicitly requests a document.

## Required validation

Frontend changes:

```bash
cd frontend
npm install
npm run build
```

Backend changes:

```bash
go test -v -timeout 90s ./internal/backend
go vet ./internal/backend
```

Desktop integration changes:

```bash
scripts/build-macos.sh
```

A change is not complete until all affected checks pass or the failure is explicitly documented.

## Definition of done

A completed change:
- solves the requested user workflow,
- follows the frontend standard,
- follows the AI development standard,
- has no obvious responsive regression,
- has no unbounded new in-memory collection,
- has no new secret persistence,
- has tests for non-trivial backend behavior,
- builds successfully,
- leaves the repository cleaner or equally maintainable.
