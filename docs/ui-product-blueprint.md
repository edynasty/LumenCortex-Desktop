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
