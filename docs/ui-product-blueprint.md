# LumenCortex Desktop UI Product Blueprint

This document defines the product and UI direction for LumenCortex Desktop.

It is informed by:
- OpenAI Codex desktop interaction patterns,
- Open Vetta's open-source local-first agent workspace,
- LumenCortex's own Go runtime, persistence, bounded-memory, and provider architecture.

The goal is not a pixel clone. The goal is a coherent desktop coding-agent product.

## 1. Product model

LumenCortex Desktop is organized around five first-class objects:

1. **Project**
   - one or more local repositories/workspaces,
   - provider/runtime defaults,
   - environment actions,
   - project-scoped sessions.

2. **Thread**
   - one coding task,
   - durable conversation,
   - agent state,
   - usage,
   - tool execution history,
   - review state.

3. **Run environment**
   - local workspace,
   - future worktree,
   - permission profile,
   - model/provider,
   - shell/process state.

4. **Review**
   - files changed,
   - unified/split diff,
   - inline comments,
   - stage/revert/commit/push,
   - future PR context.

5. **Extensions**
   - providers/models,
   - skills,
   - MCP servers,
   - plugins/tools,
   - future LSP/language services.

The main product is not a dashboard. It is a command center for agent tasks.

---

## 2. What to learn from Codex

Codex's useful product patterns for LumenCortex:

### Projects and threads
- Threads are organized by project.
- Each task has independent context.
- Multiple agents/tasks can run in parallel.
- The UI optimizes switching between active work rather than showing global metrics.

### Composer as the primary control surface
The new-task composer should expose the most important execution choices inline:
- project/workspace,
- model,
- permission profile,
- local/worktree environment,
- future skill/context attachments.

Advanced settings should not dominate the new-task screen.

### Review is a first-class workspace
A coding agent is incomplete if the user cannot inspect the result.

The review surface should support:
- changed-file list,
- diff,
- inline comments/instructions,
- stage/revert,
- commit/push,
- future PR review context.

Review should be a peer of conversation, not a tiny widget inside chat.

### Parallel isolation
Worktrees are the correct product abstraction for safely running multiple coding tasks against one repository.

LumenCortex should eventually show:
- Local,
- Worktree,
- branch/base,
- run state,
- handoff/apply status.

### Project actions
Common commands such as build, test, dev server, lint, and formatting should become named project actions instead of requiring manual terminal entry each time.

---

## 3. What to learn from Open Vetta

Open Vetta is especially relevant because it is a local-first desktop agent rather than only a hosted chat interface.

Useful patterns:

### Provider/model management
Provider configuration is graphical:
- provider list,
- expand/collapse,
- edit/delete,
- model rows,
- default model,
- model metadata,
- add model,
- provider-specific configuration.

Raw config remains an advanced escape hatch.

### Local-first execution visibility
The user can see:
- project/session context,
- tools,
- permissions,
- progress,
- artifacts,
- execution trail.

The runtime must be inspectable without turning the entire product into a log viewer.

### Extension hierarchy
Different extension types have distinct product surfaces:
- model providers,
- skills,
- MCP,
- plugins,
- themes/appearance.

Do not mix all extensions into one generic JSON settings page.

### Desktop architecture
Vetta separates UI domains and shared UI primitives rather than growing one application component indefinitely.

LumenCortex should follow the same architectural principle even though its host/runtime stack is Wails + Go.

### Source reuse
Open Vetta is Apache-2.0.

LumenCortex MAY reuse small, relevant implementation patterns or source when that is materially better than rewriting, provided:
- license and NOTICE obligations are preserved,
- copied code is adapted to LumenCortex architecture,
- Vetta branding/assets are not copied,
- we do not import Electron-specific architecture into Wails without reason.

Prefer learning from its component contracts and UX structure over wholesale copying.

---

## 4. Product-manager view

The desktop product should optimize these workflows in this order.

### Journey A — Start a task
1. Open/select project.
2. Describe task.
3. Select model.
4. Select permission profile.
5. Select Local/Worktree.
6. Start.

Target: < 10 seconds from project selection to running task.

### Journey B — Supervise a running agent
The user needs to answer:
- What is it doing?
- Is it blocked?
- Is it waiting for permission?
- What files has it touched?
- Can I stop or redirect it?

The main thread should show meaningful milestones. Raw events belong in Activity.

### Journey C — Review work
The user needs:
- summary,
- changed files,
- diff,
- tests/results,
- inline feedback,
- accept/revert/commit.

Review is the completion loop for coding work.

### Journey D — Run tasks in parallel
The user needs to understand:
- which tasks are active,
- which workspace/worktree each uses,
- whether they conflict,
- which ones need attention.

### Journey E — Configure the harness
The user needs graphical surfaces for:
- models/providers,
- permissions,
- MCP,
- skills,
- project actions,
- future LSP.

JSON is advanced configuration only.

---

## 5. UI-designer view

## 5.1 Desktop spatial model

Canonical wide layout:

```text
┌──────────────────┬─────────────────────────────────┬─────────────────────┐
│ Sidebar          │ Primary workspace               │ Context inspector   │
│ 232–264 px       │ flexible                        │ 336–620 px          │
│                  │                                 │                     │
│ projects         │ thread / review / new task      │ activity            │
│ threads          │                                 │ run                 │
│ running state    │ composer                        │ provider/settings   │
└──────────────────┴─────────────────────────────────┴─────────────────────┘
```

Rules:
- Sidebar navigation is persistent on desktop.
- Inspector is optional.
- Configuration-heavy inspector views may widen to ~520–620 px.
- The center workspace always gets priority.
- At narrower widths, inspector becomes a drawer.
- At mobile-like widths, sidebar becomes a drawer.

## 5.2 Visual language

Use:
- system typography,
- neutral surfaces,
- 1 px separators,
- compact 28–36 px controls,
- subtle hover fills,
- low-radius desktop controls,
- sparse shadows only for floating surfaces.

Avoid:
- giant empty dashboard cards,
- decorative gradients,
- AI sparkle branding everywhere,
- excessive badges,
- web landing-page spacing,
- dense telemetry as the home screen.

## 5.3 Hierarchy

Visual emphasis order:

1. current task / composer,
2. assistant result,
3. changed code / review,
4. important approvals or blockers,
5. secondary activity,
6. runtime telemetry.

## 5.4 Icons

Use Lucide consistently.

Do not use:
- emoji icons,
- Unicode substitutes,
- mixed icon libraries,
- generic sparkle icons for every AI action.

## 5.5 Settings surfaces

Settings should use native desktop management patterns:
- segmented scope selector,
- rows/cards,
- expandable detail,
- inline forms,
- explicit destructive actions,
- advanced raw configuration collapsed by default.

---

## 6. Frontend-architect view

Target domain structure:

```text
frontend/src/
  app/
    AppShell.tsx
  components/
    shared/
    sidebar/
    composer/
    inspector/
  domains/
    project/
    session/
    provider/
    review/
    runtime/
    terminal/
  lib/
    bridge.ts
    i18n/
  styles/
    tokens.css
    global.css
```

Migration is incremental; new features should not make `App.tsx` larger.

### State ownership

Backend/Core owns:
- sessions,
- messages,
- agent lifecycle,
- provider config,
- usage,
- durable events/steps,
- future diffs/worktree metadata.

React owns:
- selected tab,
- panel visibility,
- form drafts,
- search/filter state,
- current composer draft.

Bounded live buffers:
- runtime events,
- terminal tail,
- transient progress.

### Data-flow rule

```text
component
  ↓
domain model/hook
  ↓
typed bridge
  ↓
Desktop Go adapter
  ↓
Core runtime / filesystem
```

No component accesses Wails globals directly.

### Settings/config rule

A settings UI edits one explicit source:
- global provider config,
- project provider config,
- effective merged runtime config is read-only.

Never edit a merged/effective object and write it back into one source implicitly.

---

## 7. UI implementation order

We implement one slice at a time.

### UI-01 — Provider graphical management
Status: in progress.

Includes:
- Global / Project scope,
- provider CRUD,
- model CRUD,
- default model,
- advanced JSON fallback,
- composer sync.

### UI-02 — New Task Composer
Target:
- Codex-style centered prompt composer,
- project selector,
- model picker,
- permission picker,
- Local/Worktree selector placeholder only when runtime support exists,
- context/skill attachment affordance only when real support exists.

### UI-03 — Sidebar / project / threads
Target:
- project section,
- pinned/recent/running thread grouping,
- active indicators,
- search/filter,
- compact desktop density.

### UI-04 — Thread workspace
Target:
- clean conversation transcript,
- tool steps as compact expandable activity,
- approvals inline,
- running plan/milestones,
- terminal output linked to tool steps.

### UI-05 — Review / Diff
Target:
- file list,
- per-file diff,
- inline feedback,
- change stats,
- stage/revert,
- future commit/push.

### UI-06 — Parallel runs / worktrees
Target:
- Local vs Worktree,
- active runs,
- worktree identity,
- branch/base,
- apply/handoff workflow.

### UI-07 — Extensions
Target:
- Skills,
- MCP,
- Plugins/tools,
- future LSP.

Each slice must pass the frontend standard before the next starts.

---

## 8. Acceptance criteria for each slice

Every slice must answer:

### Product
- Does it complete a real workflow?
- Is the primary action obvious?
- Are advanced controls hidden until needed?

### UI
- Does it look like a desktop application?
- Is hierarchy clear at a glance?
- Does it work at 1440 / 1180 / 820 / 560?
- Are icon and spacing rules consistent?

### Architecture
- Is source of truth correct?
- Is the new component/domain bounded?
- Did `App.tsx` avoid growing?
- Are backend contracts typed?

### Runtime
- Is state durable where required?
- Is live state bounded?
- Does cancellation still work?
- Are secrets kept out of unsafe storage?

## 9. Implementation TODO

Status legend:

- [ ] Not started
- [~] In progress
- [x] Completed
- [!] Blocked

### P0 — Product and design foundation

- [x] **P0.1 Define desktop product model**
  - Project
  - Thread
  - Run environment
  - Review
  - Extensions
- [x] **P0.2 Define UI development standard**
  - responsive rules
  - icon rules
  - design-token rules
  - i18n rules
  - bounded-memory rules
- [x] **P0.3 Define AI development standard**
- [x] **P0.4 Review Codex desktop interaction model**
- [x] **P0.5 Review Open Vetta desktop architecture and Provider UX**
- [x] **P0.6 Confirm Vetta license before source reuse**
  - Apache-2.0
  - preserve applicable LICENSE / NOTICE obligations when source is reused
- [x] **P0.7 Create this UI product blueprint**
- [ ] **P0.8 Split current CSS into design-token and global layers**
  - target: `styles/tokens.css`
  - target: `styles/global.css`
- [ ] **P0.9 Establish reusable desktop primitives**
  - Button
  - IconButton
  - SegmentedControl
  - Popover
  - Select
  - TextField
  - EmptyState
  - Drawer
  - Dialog
  - Tooltip
  - StatusIndicator

Acceptance:
- Product/UI direction is documented.
- New UI work no longer invents local visual rules.
- Common controls stop being reimplemented inside feature components.

---

### UI-01 — Provider graphical management

Priority: **P0**

- [x] **UI-01.1 Add global Provider config**
  - `~/.config/lumencortex/lumencortex.json`
- [x] **UI-01.2 Add workspace Provider override**
  - `<workspace>/lumencortex.json`
- [x] **UI-01.3 Separate raw global/workspace configuration APIs**
- [x] **UI-01.4 Preserve effective merged Provider catalog for runtime use**
- [x] **UI-01.5 Add Provider settings entry in sidebar**
- [x] **UI-01.6 Replace JSON-only configuration with graphical Provider UI**
- [x] **UI-01.7 Provider CRUD**
- [x] **UI-01.8 Model CRUD**
- [x] **UI-01.9 Default model selection**
- [x] **UI-01.10 Show model metadata**
  - upstream `modelID`
  - context limit
  - output limit
- [x] **UI-01.11 Keep raw JSON as an advanced editor**
- [x] **UI-01.12 Sync Provider changes into Composer model picker**
- [x] **UI-01.13 Test global/project/effective precedence**
- [ ] **UI-01.14 Add Provider presets**
  - OpenAI
  - DeepSeek
  - OpenRouter
  - Anthropic-compatible adapter when runtime support exists
  - custom OpenAI-compatible
- [ ] **UI-01.15 Add test-connection action**
- [ ] **UI-01.16 Add `/models` discovery where provider supports it**
- [ ] **UI-01.17 Add secret-state UX**
  - distinguish configured env reference / missing secret
  - never reveal resolved secret value
- [ ] **UI-01.18 Add delete/rename conflict validation**
- [ ] **UI-01.19 Add Provider component tests**

Acceptance:
- Normal Provider/model configuration requires no JSON editing.
- Global and project scopes are visually explicit.
- Composer immediately sees effective model changes.
- Secrets are never persisted or displayed unsafely.

---

### UI-02 — Codex/Vetta-style New Task Composer

Priority: **P0**

- [ ] **UI-02.1 Replace current empty-state task screen with Composer-first layout**
- [ ] **UI-02.2 Make the Composer the visual center of the new-task workspace**
- [ ] **UI-02.3 Add project selector inside Composer**
- [ ] **UI-02.4 Add model picker as a popover/select**
  - provider name
  - model name
  - context/reasoning metadata where available
- [ ] **UI-02.5 Add permission-profile picker**
  - read-only
  - workspace
  - full
- [ ] **UI-02.6 Add run-environment picker**
  - Local initially
  - Worktree only after runtime support exists
- [ ] **UI-02.7 Add context attachment entry**
  - files
  - folders
  - future Skills/MCP context
- [ ] **UI-02.8 Add keyboard behavior**
  - Enter = run
  - Shift+Enter = newline
  - Cmd/Ctrl+Enter optional explicit run shortcut
- [ ] **UI-02.9 Add recent project quick-pick**
- [ ] **UI-02.10 Add empty-model state linking directly to Provider settings**
- [ ] **UI-02.11 Add running/cancel state directly in Composer**
- [ ] **UI-02.12 Verify 1440 / 1180 / 820 / 560 layouts**

Acceptance:
- A user can start a coding task in under 10 seconds.
- No advanced runtime settings dominate the new-task view.
- Provider/model/project/permission context is visible before submission.

---

### UI-03 — Project and Thread Sidebar

Priority: **P0**

- [ ] **UI-03.1 Refactor sidebar out of `App.tsx`**
- [ ] **UI-03.2 Add project switcher**
- [ ] **UI-03.3 Persist recent projects**
- [ ] **UI-03.4 Group threads**
  - running
  - recent
  - completed
- [ ] **UI-03.5 Add active/running indicators**
- [ ] **UI-03.6 Add thread search**
- [ ] **UI-03.7 Add thread rename**
- [ ] **UI-03.8 Add thread delete/archive when backend semantics are defined**
- [ ] **UI-03.9 Add pinned threads**
- [ ] **UI-03.10 Add compact project/thread context menu**
- [ ] **UI-03.11 Add unread/attention state for approval/error**
- [ ] **UI-03.12 Keep sidebar list bounded/virtualized for large histories**

Acceptance:
- Parallel work is understandable at a glance.
- Running or blocked tasks are immediately discoverable.
- Large session histories do not create linear frontend memory growth.

---

### UI-04 — Thread / Agent Workspace

Priority: **P0**

- [ ] **UI-04.1 Refactor thread view out of `App.tsx`**
- [ ] **UI-04.2 Build proper conversation message components**
  - user
  - assistant
  - tool
  - system
- [ ] **UI-04.3 Render Markdown**
- [ ] **UI-04.4 Render syntax-highlighted code blocks**
- [ ] **UI-04.5 Collapse raw tool events by default**
- [ ] **UI-04.6 Show meaningful milestones instead of event spam**
- [ ] **UI-04.7 Add expandable tool-call cards**
- [ ] **UI-04.8 Add file/command metadata to tool rows**
- [ ] **UI-04.9 Add inline workflow approval UI**
- [ ] **UI-04.10 Add Agent running plan/progress surface**
- [ ] **UI-04.11 Add stop/resume controls**
- [ ] **UI-04.12 Add copy/retry/follow-up actions**
- [ ] **UI-04.13 Add bounded/paginated transcript loading**
- [ ] **UI-04.14 Add scroll-to-latest behavior without breaking manual review**

Acceptance:
- The thread answers: what is the Agent doing, what changed, and does it need attention?
- Raw telemetry does not overwhelm the conversation.
- Long-running tasks remain memory-bounded.

---

### UI-05 — Review / Diff Workspace

Priority: **P0**

Runtime dependency:
- Core Git status/diff tools
- durable changed-file metadata

- [ ] **UI-05.1 Add Review as a first-class workspace tab/mode**
- [ ] **UI-05.2 Add changed-file sidebar/list**
- [ ] **UI-05.3 Add file change statistics**
- [ ] **UI-05.4 Add unified diff renderer**
- [ ] **UI-05.5 Add split diff renderer**
- [ ] **UI-05.6 Add syntax highlighting**
- [ ] **UI-05.7 Add inline review comments/instructions**
- [ ] **UI-05.8 Add per-file revert**
- [ ] **UI-05.9 Add stage/unstage**
- [ ] **UI-05.10 Add commit action**
- [ ] **UI-05.11 Add push action**
- [ ] **UI-05.12 Add test/check summary beside changes**
- [ ] **UI-05.13 Lazy-load very large diffs**
- [ ] **UI-05.14 Add binary/large-file fallback states**

Acceptance:
- A coding task can be reviewed without leaving LumenCortex.
- Review is a peer of conversation, not a tiny Inspector widget.

---

### UI-06 — Parallel Runs and Worktrees

Priority: **P1**

Runtime dependency:
- Core run supervisor
- bounded agent scheduler
- Git worktree support

- [ ] **UI-06.1 Move active-run supervision into Core**
- [ ] **UI-06.2 Add bounded multi-session concurrency**
- [ ] **UI-06.3 Add Local / Worktree runtime identity**
- [ ] **UI-06.4 Create worktree flow**
- [ ] **UI-06.5 Show branch/base/worktree path**
- [ ] **UI-06.6 Show parallel run status in sidebar**
- [ ] **UI-06.7 Detect worktree conflicts**
- [ ] **UI-06.8 Add apply/handoff workflow**
- [ ] **UI-06.9 Add cleanup flow**
- [ ] **UI-06.10 Recover stale running sessions after Desktop restart**

Acceptance:
- Multiple coding tasks can run safely in parallel.
- Users can always tell which filesystem/worktree a task owns.

---

### UI-07 — Extensions: Skills / MCP / Plugins / LSP

Priority: **P1**

- [ ] **UI-07.1 Add Extensions/settings navigation**
- [ ] **UI-07.2 Skills management UI**
- [ ] **UI-07.3 MCP server management UI**
- [ ] **UI-07.4 MCP tools list/status**
- [ ] **UI-07.5 Plugin/tool permission management**
- [ ] **UI-07.6 LSP server status**
- [ ] **UI-07.7 Language capability diagnostics**
- [ ] **UI-07.8 Per-project extension overrides**
- [ ] **UI-07.9 Enable/disable extension controls**
- [ ] **UI-07.10 Surface extension failures without blocking unrelated work**

Acceptance:
- Extensions are managed graphically.
- Different extension types remain conceptually separate.
- Advanced config remains available without becoming the main UX.

---

### CORE-01 — Repository search and coding tools

Priority: **P0**

- [ ] **CORE-01.1 Add bounded text search**
  - prefer `rg` subprocess when installed
- [ ] **CORE-01.2 Add file-name/glob search**
- [ ] **CORE-01.3 Add Git status tool**
- [ ] **CORE-01.4 Add Git diff tool**
- [ ] **CORE-01.5 Add bounded diff output**
- [ ] **CORE-01.6 Add file-change metadata**
- [ ] **CORE-01.7 Expose coding/search tools to Agent**
- [ ] **CORE-01.8 Add tests for large-output truncation and cancellation**

Dependency:
- Enables UI-05 Review/Diff.

---

### CORE-02 — LSP

Priority: **P1**

- [ ] **CORE-02.1 Managed language-server process**
- [ ] **CORE-02.2 JSON-RPC stdio client**
- [ ] **CORE-02.3 Cancellation**
- [ ] **CORE-02.4 bounded request map**
- [ ] **CORE-02.5 hover**
- [ ] **CORE-02.6 definition**
- [ ] **CORE-02.7 references**
- [ ] **CORE-02.8 document/workspace symbols**
- [ ] **CORE-02.9 diagnostics**
- [ ] **CORE-02.10 rename**
- [ ] **CORE-02.11 expose LSP tools to Agent**
- [ ] **CORE-02.12 Desktop LSP status UI**

---

### CORE-03 — MCP

Priority: **P1**

- [ ] **CORE-03.1 MCP stdio transport**
- [ ] **CORE-03.2 tool discovery**
- [ ] **CORE-03.3 tool invocation**
- [ ] **CORE-03.4 bounded output**
- [ ] **CORE-03.5 cancellation**
- [ ] **CORE-03.6 merge MCP tools into Agent registry**
- [ ] **CORE-03.7 persistence/configuration model**
- [ ] **CORE-03.8 Desktop MCP management UI**
- [ ] **CORE-03.9 HTTP transport if needed**

---

### CORE-04 — Subagents and long-running execution

Priority: **P1**

- [ ] **CORE-04.1 Integrate `resource.Manager.MaxAgents` into Agent scheduling**
- [ ] **CORE-04.2 Add bounded subagent scheduler**
- [ ] **CORE-04.3 Persist parent/child session relationships**
- [ ] **CORE-04.4 Aggregate child events**
- [ ] **CORE-04.5 Move Desktop active-run map into Core supervisor**
- [ ] **CORE-04.6 Recover stale `running` sessions as interrupted**
- [ ] **CORE-04.7 Add resumable checkpoints where useful**
- [ ] **CORE-04.8 Add Desktop subagent tree/status UI**

---

### ARCH-01 — Frontend architecture cleanup

Priority: **P0 / continuous**

- [ ] **ARCH-01.1 Extract AppShell**
- [ ] **ARCH-01.2 Extract Sidebar domain**
- [ ] **ARCH-01.3 Extract Composer domain**
- [x] **ARCH-01.4 Extract Provider domain**
- [ ] **ARCH-01.5 Extract Thread domain**
- [ ] **ARCH-01.6 Extract Inspector domain**
- [ ] **ARCH-01.7 Create shared primitive components**
- [ ] **ARCH-01.8 Centralize i18n copy**
- [ ] **ARCH-01.9 Split design tokens from component CSS**
- [ ] **ARCH-01.10 Add frontend unit/component test setup**
- [ ] **ARCH-01.11 Prevent new direct `window.go` access outside bridge**
- [ ] **ARCH-01.12 Keep live UI buffers bounded**
- [ ] **ARCH-01.13 Add screenshot/visual-regression workflow when practical**

---

### QA-01 — Desktop quality gates

Priority: **P0 / continuous**

For every significant UI slice:

- [ ] **QA-01.1 1440 px visual check**
- [ ] **QA-01.2 1180 px visual check**
- [ ] **QA-01.3 820 px visual check**
- [ ] **QA-01.4 560 px visual check**
- [ ] **QA-01.5 No horizontal overflow**
- [ ] **QA-01.6 Keyboard navigation**
- [ ] **QA-01.7 Accessible labels for icon-only controls**
- [ ] **QA-01.8 Chinese copy**
- [ ] **QA-01.9 English copy**
- [ ] **QA-01.10 Frontend production build**
- [ ] **QA-01.11 Backend tests/vet when bridge/backend changes**
- [ ] **QA-01.12 macOS universal Wails build when integration changes**
- [ ] **QA-01.13 Verify no secret persistence**
- [ ] **QA-01.14 Verify no new unbounded frontend collection**

---

## 10. Immediate execution order

Work should continue in this order unless a blocking runtime dependency changes the sequence:

1. **Finish UI-01 Provider graphical management**
   - Provider presets
   - connection test
   - Provider UI tests
2. **UI-02 New Task Composer**
3. **UI-03 Sidebar / Projects / Threads**
4. **ARCH-01 component extraction while implementing UI-02/UI-03**
5. **CORE-01 repository search + Git diff/status**
6. **UI-04 Thread workspace**
7. **UI-05 Review / Diff**
8. **CORE-04 multi-run supervisor + worktree foundation**
9. **UI-06 parallel runs/worktrees**
10. **CORE-02 LSP**
11. **CORE-03 MCP**
12. **UI-07 Extensions**
13. **Subagent visualization and advanced long-task recovery**

Rule: do not start a later visual layer merely to make screenshots look complete when the underlying runtime capability does not exist.
