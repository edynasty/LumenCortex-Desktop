package backend

import (
	"context"

	lcx "github.com/edynasty/LumenCortex/runtime"
)

// TaskStateInfo is Core's host view of a session's Task State: the newest version with queued edits
// already applied, the obligations that keep the thread open and the derived "ready for review".
type TaskStateInfo = lcx.TaskStateInfo

// ThreadNote is one Task State note as a reader sees it: the stored note plus each cite's freshness
// against the main checkout (ADR-0010 D3, D4).
type ThreadNote = lcx.ThreadNote

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

// TaskNoteEdit adds (no id), rewrites or removes one note of the thread as the user (ADR-0010 D1).
// A run cannot change or remove the user's notes.
type TaskNoteEdit struct {
	ID     string `json:"id,omitempty"`
	Text   string `json:"text,omitempty"`
	Remove bool   `json:"remove,omitempty"`
}

// EditTaskNote queues a note edit; a running loop applies it at its next step.
func (r *Runtime) EditTaskNote(ctx context.Context, sessionID string, edit TaskNoteEdit) (TaskStateInfo, error) {
	engine, err := r.currentEngine()
	if err != nil {
		return TaskStateInfo{}, err
	}
	return engine.EditTaskState(ctx, sessionID, lcx.TaskStateEdit{Note: &lcx.ThreadNoteEdit{
		ID: edit.ID, Text: edit.Text, Remove: edit.Remove,
	}})
}

// ThreadNotes returns the thread's notes with each cite's freshness, checked against the main
// checkout (ADR-0010 D3, D4). Stale notes are flagged, never hidden; the slice is never nil.
func (r *Runtime) ThreadNotes(ctx context.Context, sessionID string) ([]ThreadNote, error) {
	engine, err := r.currentEngine()
	if err != nil {
		return nil, err
	}
	view, err := engine.ReadThread(ctx, sessionID)
	if err != nil {
		return nil, err
	}
	if view.Notes == nil {
		return []ThreadNote{}, nil
	}
	return view.Notes, nil
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
