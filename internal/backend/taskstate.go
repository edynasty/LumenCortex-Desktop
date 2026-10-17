package backend

import (
	"context"

	lcx "github.com/edynasty/LumenCortex/runtime"
)

// TaskStateInfo is Core's host view of a session's Task State: the newest version with queued edits
// already applied, the obligations that keep the thread open and the derived "ready for review".
type TaskStateInfo = lcx.TaskStateInfo

// TaskReferenceEdit includes, excludes or removes one context reference of the thread (kind "path"
// or "thread"). Note replaces the stored note when non-nil.
type TaskReferenceEdit struct {
	Kind   string  `json:"kind"`
	Target string  `json:"target"`
	Note   *string `json:"note,omitempty"`
	State  string  `json:"state"`
}

func (r *Runtime) currentEngine() (*lcx.Engine, error) {
	r.mu.RLock()
	engine := r.engine
	r.mu.RUnlock()
	if engine == nil {
		return nil, ErrNoWorkspace
	}
	return engine, nil
}

// TaskState reads the session's Task State without any lock, so it works while a run is active.
func (r *Runtime) TaskState(ctx context.Context, sessionID string) (TaskStateInfo, error) {
	engine, err := r.currentEngine()
	if err != nil {
		return TaskStateInfo{}, err
	}
	return engine.TaskState(ctx, sessionID)
}

// SetTaskBrief queues a brief edit; "" restores the goal. A running loop applies it at its next step.
func (r *Runtime) SetTaskBrief(ctx context.Context, sessionID, brief string) (TaskStateInfo, error) {
	engine, err := r.currentEngine()
	if err != nil {
		return TaskStateInfo{}, err
	}
	return engine.EditTaskState(ctx, sessionID, lcx.TaskStateEdit{Brief: &brief})
}

// EditTaskReference queues a reference edit.
func (r *Runtime) EditTaskReference(ctx context.Context, sessionID string, edit TaskReferenceEdit) (TaskStateInfo, error) {
	engine, err := r.currentEngine()
	if err != nil {
		return TaskStateInfo{}, err
	}
	return engine.EditTaskState(ctx, sessionID, lcx.TaskStateEdit{Reference: &lcx.TaskReferenceEdit{
		Kind: edit.Kind, Target: edit.Target, Note: edit.Note, State: edit.State,
	}})
}

// ResolveThread sets the thread's resolution (open, done or dropped) as the user.
func (r *Runtime) ResolveThread(ctx context.Context, sessionID, state, actor string) (TaskStateInfo, error) {
	engine, err := r.currentEngine()
	if err != nil {
		return TaskStateInfo{}, err
	}
	return engine.ResolveThread(ctx, sessionID, state, actor)
}

// ResetContext starts later requests after the current transcript. It returns ErrRunHeld while a run
// holds the session.
func (r *Runtime) ResetContext(ctx context.Context, sessionID string) (TaskStateInfo, error) {
	engine, err := r.currentEngine()
	if err != nil {
		return TaskStateInfo{}, err
	}
	return engine.ResetContext(ctx, sessionID)
}
