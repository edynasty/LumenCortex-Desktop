# LumenCortex Desktop — Screen Specifications

Figma source:
`https://www.figma.com/design/Jr6qaL9kGPtj45VYn9m62q`

Reference frames:
- Screen / New Task / 1440
- Screen / Provider Settings / 1440
- Screen / Running Thread / 1440
- Screen / Review Diff / 1440

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
- default badge,
- set-default/edit/delete.

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
