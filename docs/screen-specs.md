# LumenCortex Desktop — Screen Specifications

Figma source:
`https://www.figma.com/design/Jr6qaL9kGPtj45VYn9m62q`

Figma delivery contract:
- `tools/figma/delivery-manifest.json`
- `tools/figma/finalize-lumencortex.mjs`

The source-controlled finalizer defines the complete reference set for:
- New Task at 1440 / 1180 / 820 / 560,
- Provider Settings at 1440 / 1180 / 820 / 560,
- Running Thread at 1440 / 1180 / 820 / 560,
- Review Diff at 1440 / 1180 / 820 / 560.

As of 2026-09-23, applying those generated frames to the linked Figma file is externally blocked by the Figma Starter MCP call quota. Production Playwright screenshots remain the rendered implementation reference until the finalizer can be executed against the file.

## 1. New Task

### Purpose
Start a coding task with minimum friction.

### Layout
- Left: project/thread sidebar.
- Top: workspace mode navigation.
- Center: task prompt and composer.
- Inspector closed by default.

### Required elements
- project context,
- model selector,
- permission selector,
- run environment,
- task text,
- send action,
- context/extension affordances only when capability exists.

### States
- no project,
- project selected,
- no model configured,
- ready,
- starting,
- start error.

### Acceptance
- task can be started without opening settings,
- model is visible,
- primary action obvious,
- no empty inspector.

## 2. Provider Settings

### Purpose
Configure providers/models without editing JSON.

### Layout
- dedicated/wide settings workspace,
- scope control at top,
- provider list,
- expandable model rows,
- advanced JSON collapsed at bottom.

### Provider card
Shows:
- name,
- provider ID,
- baseURL/protocol,
- number of models,
- edit/delete.

### Model row
Shows:
- name,
- upstream modelID,
- context/output limits,
- reasoning format and accepted effort levels (the package default when unset),
- default badge,
- set-default/edit/delete.

### Model details (edit form)
- model ID, display name, upstream modelID, context/output limits,
- reasoning format, from Core's per-package list (the empty value is the package default),
- accepted effort levels as one checkbox per Core level; adaptive drops "none",
- Core's refusal (a format the package does not implement, adaptive with "none") inline in the form.

### States
- global scope,
- project scope,
- inherited project state,
- empty provider list,
- editing provider,
- editing model,
- invalid config,
- save error,
- secret env reference missing.

### Acceptance
- normal setup requires no JSON,
- global/project scope cannot be confused,
- effective model updates Composer,
- resolved secret never shown.

## 3. Running Thread

### Purpose
Supervise work without raw-log overload.

### Main column
- task intro,
- conversation,
- compact tool cards,
- plan/milestone block,
- final result,
- follow-up composer.

### Inspector
Activity contains:
- event timeline,
- tool status,
- memory/runtime summary.

### States
- created,
- running,
- waiting_gate,
- interrupted,
- completed,
- provider error,
- tool error.

### Acceptance
User can answer:
- what is running?
- what did it just do?
- what is blocked?
- what files/commands are involved?
- how do I stop/continue?

## 3a. Agents

### Purpose
Edit Core's agent catalog (ADR-0009): the four built-ins and the user's custom agents.

### Layout
- catalog list (built-ins first, each with a `Built-in` or `From this project` badge),
- editor for the selected agent,
- the one-time `agents.json` import report, when there was one.

### Editor views
- Settings: the fields below.
- Effective prompt: the layers and tools Core would send for this agent (read-only), the
  workspace's trust state with the trust action, and a refresh. Shown per the open session when
  there is one; without a project, or before a new agent is saved, the view says so.

### Editor fields
- name and description (fixed for a built-in),
- use: conversation, delegated child, or both (fixed for a built-in),
- permission ceiling and delegation ceiling (fixed for a built-in; a delegated agent never delegates),
- instructions with a 16 KiB counter,
- default effort,
- ordered model candidates: add, remove, reorder, per-entry effort, at most 8.

### States
- saved, unsaved (inline confirm before switching),
- read-only: a built-in's fixed fields, or a definition from the project's lumencortex.json,
- refused save: stale digest (conflict) or an invalid agent; nothing is written,
- import report: imported, renamed to `agents.json.imported`, skipped entries and warnings,
- effective prompt: a project file is "not loaded · workspace not trusted" until the workspace is
  trusted, then loaded with its text.

### Acceptance
User can answer:
- which agents exist and where each one comes from?
- what may this agent do, and which models does it try in order?
- did my save apply, and did the old profile file import without losing anything?
- what exactly will this agent's run send, and what does it not load because of trust or permission?

## 4. Review / Diff

### Purpose
Complete the coding loop inside LumenCortex.

### Left file rail
- changed-file list,
- status badge,
- additions/deletions.

### Main
- file header,
- unified/split toggle,
- syntax-highlighted diff,
- inline comments,
- test/check summary.

### Actions
- inline feedback to agent,
- stage/unstage,
- revert,
- commit,
- push.

### States
- no changes,
- loading diff,
- large diff,
- binary file,
- conflict,
- test failure,
- ready to commit.

### Acceptance
- review does not require leaving the app,
- file status and test state visible,
- inline feedback returns to the task loop.

## 5. Sidebar

### Sections
- New Task
- Project
- Running
- Needs attention
- Recent
- Completed
- Models & Providers
- Language/runtime footer

### Thread row states
- idle,
- running,
- waiting approval,
- completed unread,
- selected,
- error.

## 6. Responsive requirements

### 1440
- all wide layouts supported.

### 1180
- inspector drawer,
- center remains primary.

### 820
- sidebar drawer,
- inspector drawer.

### 560
- compact controls,
- composer retained,
- metadata collapsed,
- no horizontal scroll.

## 7. Visual QA checklist

For every screen:
- no text clipping,
- no horizontal overflow,
- all icon-only controls labeled,
- Chinese and English fit,
- focus state visible,
- selected/hover/disabled states distinct,
- status color paired with text/icon,
- composer and run/stop always reachable.
