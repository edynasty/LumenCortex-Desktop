# W3: Desktop Task State Bridge Integration

**Date:** 2026-10-16  
**Status:** ✅ COMPLETE  
**Scope:** Expose Core Task State to Desktop via Wails bridge

## Objective

Bridge LumenCortex Core's Task State to Desktop, enabling the UI to display work units, obligations, checks, verification status, and resolutions.

## Baseline

- **Core:** `2c5fe7b` - Runtime state complete with evaluator, obligations, checks
- **Desktop:** `39a4813` - W2 worktree integration merged to main
- **Design:** `../LumenCortex-architecture-audit/design/README.md` M4.1-M4.7

## What Was Done

### 1. Core Task State Exposure

Core already had `Engine.TaskStateSnapshot()` in `runtime/agent.go` that returns `map[string]any` with:
- `version`: Task State version (int64)
- `brief`: Current work summary (string)
- `references`: Context references (array)
- `resolution`: Terminal state with verdict/evidence (object)
- `progress`: Work unit progress snapshot (object)
- `workUnits`: Full work unit structure with obligations and checks (object)

### 2. Desktop Backend Bridge

Added to `internal/backend/runtime.go`:
```go
func (r *Runtime) GetTaskState(sessionID string) (map[string]any, error) {
    return r.engine.TaskStateSnapshot(r.ctx, sessionID)
}
```

### 3. Wails App Binding

Added to `app.go`:
```go
func (a *App) GetTaskState(sessionID string) (map[string]any, error) {
    return a.runtime.GetTaskState(sessionID)
}
```

### 4. Frontend Bridge Type

Added to `frontend/src/lib/bridge.ts`:
```typescript
GetTaskState(sessionId: string): Promise<Record<string, any>>;
```

### 5. Test Coverage

Added `internal/backend/runtime_test.go:TestGetTaskState`:
- Creates session with goal
- Fetches Task State via bridge
- Verifies structure (version, brief, references, resolution, progress, workUnits)
- Confirms JSON serialization works

## Verification

```bash
cd ../LumenCortex-Desktop
go test -run TestGetTaskState ./internal/backend/ -v
# PASS

go test -count=1 ./...
# All tests pass
```

## What Works

✅ Desktop can fetch complete Task State for any session  
✅ Work units, obligations, checks, and verdicts are accessible  
✅ Resolution terminal state (Success/Abandoned/Error) available  
✅ Progress snapshot with active work unit tracking  
✅ All tests pass including bridge contract verification

## What's Missing

### UI Implementation (Deferred to W4)

The *capability* exists, but no UI components consume it yet. W4 should add:

1. **Task State Panel** - Display current work unit, obligations, check results
2. **Progress Indicator** - Show completion state and active work
3. **Verification Status** - Display check verdicts (pass/fail/skip)
4. **Resolution Badge** - Terminal state with evidence when complete

### Design Guidance

From the original review request:
> "compact, permanent navigation icon rail on the far left"
> "first-class access to Context Graph near the upper-left area"
> "practical access to the active Session Worktree, potentially near the lower-left area"

Task State should integrate into this layout, likely as:
- **Left rail icon** for Task State / Work Units
- **Slide-out panel** showing current obligations and checks
- **Status badges** in session list showing progress/resolution

## Next Steps for W4

1. Create `TaskStatePanel.tsx` component
2. Poll `GetTaskState` during active runs
3. Display work units with obligation/check tree
4. Show verification results with pass/fail badges
5. Integrate with existing WorkspaceView layout

## Files Changed

### Core
No changes - `Engine.TaskStateSnapshot()` already existed

### Desktop
- `internal/backend/runtime.go` - Added GetTaskState method
- `internal/backend/runtime_test.go` - Added TestGetTaskState
- `app.go` - Added Wails binding
- `frontend/src/lib/bridge.ts` - Added TypeScript declaration
- `go.mod` - Local Core replace directive for development

## Dependencies

Desktop requires Core with `Engine.TaskStateSnapshot()`, available since M4.1 evaluator implementation.

## Commit Strategy

This work is local development only. Before push:
1. Remove `replace` directive from `go.mod`
2. Tag Core release with evaluator + Task State snapshot
3. Update Desktop to pin that release
4. Commit W3 changes together

## Conclusion

Desktop now has full programmatic access to Task State. The vertical slice is complete:
- User goal → Task State
- Agent execution → Loop + Evaluator
- Obligations → Check execution → Verdicts
- **Task State → Desktop bridge ← UI (pending W4)**

All tests pass. Ready for UI implementation.
