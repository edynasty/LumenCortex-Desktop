# LumenCortex Desktop — Frontend Architecture

## 1. Decision

LumenCortex Desktop keeps:

- Wails v2 as the desktop host,
- Go as the runtime/control plane,
- React + TypeScript as the presentation layer.

We are **not** migrating to Vue, Svelte, Solid, or another frontend framework.

Reason:

The current structural problems came from ownership boundaries, not from React itself:

- too much UI and orchestration in `App.tsx`,
- duplicate active-run state,
- missing desktop primitives,
- navigation state that was not modeled explicitly.

A framework rewrite would recreate the same problems unless these ownership rules changed first.

## 2. Architecture principle

```text
React Presentation
├── AppShell
├── Sidebar
├── Workspace Views
│   ├── New Task
│   ├── Thread
│   ├── Provider Settings
│   └── future Review / Extensions
├── Inspector
└── Desktop Primitives
        │
        │ typed Wails bridge
        ▼
Desktop Go Adapter
        │
        ▼
Core Run Supervisor
        │
        ▼
runtime.Engine
        │
        ├── SQLite sessions/messages
        ├── agent loop
        ├── tools
        ├── events
        └── resource manager
```

React owns presentation state.

Go/Core owns execution state.

## 3. Source-of-truth rules

### Core-owned

- active agent runs,
- session lifecycle,
- messages,
- agent steps,
- provider/model execution identity,
- usage,
- durable errors,
- future Git/diff/worktree state.

### Desktop adapter-owned

- Wails lifecycle,
- native dialogs,
- event forwarding,
- global/project configuration I/O,
- mapping Core types to Desktop APIs.

### React-owned

Only transient presentation state:

- selected thread,
- current workspace view,
- sidebar open/closed,
- inspector open/tab,
- form drafts,
- unsaved composer text,
- local filter/search state.

React must not own a second copy of active execution truth.

## 4. Active-run contract

`runtime.RunSupervisor` is the process-local source of truth for whether a session has a live agent goroutine.

```text
RunSupervisor
    │
    ├── Start(session)
    ├── Cancel(session)
    ├── Active(session)
    ├── Runs()
    └── Close()
```

`WorkspaceState.activeRuns` exposes this state to React.

Persistent `session.status` answers a different question: the durable lifecycle state recorded in SQLite.

On workspace open, stale persisted `running` sessions are recovered to `interrupted` before the new supervisor starts.

This avoids:

```text
Sidebar says Running
but
there is no live agent process
```

## 5. Frontend component boundaries

Current target:

```text
frontend/src/
  components/
    app-shell/
      AppShell.tsx
    sidebar/
      Sidebar.tsx
    composer/
      NewTaskComposer.tsx
    thread/
      ThreadWorkspace.tsx
    inspector/
      Inspector.tsx
    provider/
      ProviderSettingsPanel.tsx
    primitives/
      Dialog.tsx
      Popover.tsx
      Select.tsx
  lib/
    bridge.ts
  types.ts
  App.tsx
```

`App.tsx` is the orchestration layer.

It may:
- load data,
- coordinate selected entities,
- call bridge methods,
- compose domain components.

It should not:
- contain large feature markup,
- own a duplicate runtime state machine,
- implement generic controls,
- directly access `window.go`.

## 6. Desktop primitive strategy

We intentionally use small internal primitives before adopting a large UI framework.

Current primitives:
- Dialog,
- Popover,
- Select.

Requirements:
- keyboard support,
- Escape handling,
- focus management,
- reduced-motion compatibility,
- semantic roles/labels,
- shared visual tokens.

Why not a large component framework now:
- avoid visual lock-in,
- avoid shipping unused runtime code,
- preserve LumenCortex desktop identity,
- keep memory/bundle costs predictable.

If accessibility or interaction complexity outgrows our primitives, adopting a headless library may be reconsidered.

## 7. State-management strategy

Do not add Redux/Zustand by default.

Current state volume does not justify another global state runtime.

Use:
- backend/Core for durable domain state,
- component-local state for forms,
- App orchestration for selected navigation context,
- domain hooks/reducers when a feature becomes complex.

A global frontend store should only be introduced when multiple independent views need coordinated transient state that cannot be expressed cleanly through current ownership.

## 8. Navigation model

Current:
- workspace,
- providers.

Target route-like model:

```text
WorkspaceRoute
├── new-task
├── thread(sessionId)
├── provider-settings
├── review(sessionId)
└── extensions
```

This does not require React Router immediately.

It does require an explicit discriminated navigation state before Review and Extensions are added.

## 9. Event model

Wails runtime events are hints that state changed.

They are not the source of truth.

Pattern:

```text
Core event
   ↓
Wails event forwarder
   ↓
React receives event
   ↓
React refreshes authoritative backend state
```

The frontend may retain a bounded event tail for Activity.

It must not reconstruct runtime truth by replaying live events.

## 10. When React should be reconsidered

A framework migration is justified only if a concrete constraint appears that React cannot satisfy economically, such as:

- measured renderer memory that cannot be reduced through architecture/component work,
- a required native UI technology incompatible with the webview stack,
- unacceptable Wails/WebView performance after profiling,
- a product direction that removes web UI entirely.

A preference for different syntax is not sufficient.

## 11. Current architecture status

Completed:
- AppShell extracted,
- Sidebar extracted,
- Thread workspace extracted,
- Inspector extracted,
- Provider domain extracted,
- Composer domain extracted,
- Dialog/Popover/Select primitives added,
- active run ownership moved into Core RunSupervisor,
- stale running sessions recovered on workspace open.

Remaining:
- central i18n module,
- explicit route-like workspace navigation,
- component tests,
- shared token files,
- Review domain,
- Extensions domain.
