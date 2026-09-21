# LumenCortex Desktop — Information Architecture

## 1. Top-level navigation model

LumenCortex Desktop uses a stable three-zone desktop layout:

```text
┌──────────────────┬─────────────────────────────────┬────────────────────────┐
│ Sidebar          │ Primary Workspace               │ Context Inspector      │
│ Project/Threads  │ Task / Conversation / Review    │ Activity / Run /       │
│                  │                                 │ Provider / Terminal    │
└──────────────────┴─────────────────────────────────┴────────────────────────┘
```

The primary workspace always has visual priority.

## 2. Navigation hierarchy

### Sidebar
1. Brand / app identity
2. New task
3. Project switcher
4. Thread groups
   - Running
   - Waiting / Needs attention
   - Recent
   - Completed
5. Models & Providers
6. Language
7. Runtime state

### Primary Workspace
Modes:
- New Task
- Thread
- Review

Future modes:
- Project actions
- Search/result workspace

### Context Inspector
Tabs:
- Activity
- Run
- Review metadata
- Providers
- Terminal

The Inspector is contextual, not the primary destination.

## 3. Project object hierarchy

```text
Project
├── Threads
│   ├── Thread
│   │   ├── Messages
│   │   ├── Agent Steps
│   │   ├── Tool Calls
│   │   ├── Usage
│   │   └── Review
│   └── ...
├── Provider Overrides
├── Project Actions
├── Future MCP/Skills Overrides
└── Future Worktrees
```

## 4. Thread state model

Canonical thread states:

| State | Meaning | Primary UI |
|---|---|---|
| created | session exists, not running | Run |
| running | agent owns execution | Stop |
| waiting_gate | user approval required | Approve / Deny |
| interrupted | cancelled or interrupted | Resume |
| completed | final result available | Review / Continue |

UI may derive secondary attention states:
- error,
- unread completion,
- needs review,
- needs approval.

These are presentation states and must not replace the durable backend status.

## 5. Provider configuration hierarchy

```text
Global Provider Catalog
~/.config/lumencortex/lumencortex.json
        │
        ▼
Project Provider Override
<project>/lumencortex.json
        │
        ▼
Effective Catalog
        │
        ├── Composer model picker
        └── Agent execution
```

Global and Project raw catalogs are editable independently.

The effective merged catalog is read-only from the user's perspective.

## 6. Review hierarchy

```text
Review
├── Summary
├── Test/Check Result
├── Changed Files
│   ├── File
│   │   ├── Unified Diff
│   │   ├── Split Diff
│   │   └── Inline Comments
│   └── ...
└── Git Actions
    ├── Stage / Unstage
    ├── Revert
    ├── Commit
    └── Push
```

## 7. Desktop responsive IA

### 1440+
- Sidebar persistent.
- Workspace full.
- Inspector optional.
- Provider settings may widen inspector to ~600 px.

### 1180
- Sidebar persistent.
- Inspector becomes drawer.

### 820
- Sidebar becomes drawer.
- Inspector remains drawer.

### 560
- Compact topbar.
- Composer remains reachable.
- Secondary metadata collapses.
- No horizontal page scrolling.

## 8. Navigation state

Current Wails app may use internal React state instead of URL routing initially, but state boundaries should behave like routes:

- selectedProject
- selectedThread
- workspaceMode: new-task | thread | review
- inspectorTab
- sidebarOpen
- inspectorOpen

These are transient UI navigation states.

Durable entities stay in Core/backend.

## 9. IA constraints

- No dashboard-first landing page.
- No giant settings page mixing unrelated concepts.
- Provider, MCP, Skills, Plugins, LSP remain separate concepts.
- Runtime telemetry cannot become the main center view.
- Review must be first-class once Git/diff support exists.
