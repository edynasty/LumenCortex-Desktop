package backend

import (
	"context"

	lcx "github.com/edynasty/LumenCortex/runtime"
)

// ExecutionTask is a started execution task (ADR-0006 D4): the child session, its worktree and base.
type ExecutionTask = lcx.ExecutionTask

// StartProposedTask starts exactly the parent's proposed task taskID, as the user's approval. Core
// holds the parent's run lock: it returns ErrRunHeld while the parent runs, and refuses an unknown or
// already started proposal, a workspace without a commit and a parent at its child limit.
func (r *Runtime) StartProposedTask(ctx context.Context, parentID, taskID string) (ExecutionTask, error) {
	r.mu.RLock()
	supervisor := r.supervisor
	r.mu.RUnlock()
	if supervisor == nil {
		return ExecutionTask{}, ErrNoWorkspace
	}
	return supervisor.StartProposedTask(ctx, parentID, taskID)
}

// CancelSubtree is the thread's Stop: it cancels the session's run and every descendant this process
// runs, and returns the ids it cancelled. Runs held by another process are not reachable; an empty
// result while the tree shows running children means they run elsewhere.
func (r *Runtime) CancelSubtree(ctx context.Context, sessionID string) ([]string, error) {
	r.mu.RLock()
	supervisor := r.supervisor
	r.mu.RUnlock()
	if supervisor == nil {
		return nil, ErrNoWorkspace
	}
	cancelled, err := supervisor.CancelSubtree(ctx, sessionID)
	if cancelled == nil {
		cancelled = []string{}
	}
	return cancelled, err
}
