package backend

import (
	"context"
	"errors"
	"strings"

	lcx "github.com/edynasty/LumenCortex/runtime"
)

var ErrWorktreeActive = errors.New("cannot remove worktree for an active agent run")

type SessionRuntime = lcx.SessionRuntime
type RuntimeOwner = lcx.RuntimeOwner
type WorktreeConflict = lcx.WorktreeConflict

const (
	RuntimeLocal    = lcx.RuntimeLocal
	RuntimeWorktree = lcx.RuntimeWorktree
)

func (r *Runtime) CreateSessionWithRuntime(ctx context.Context, goal string, paths []string, runtimeKind, base string) (Session, error) {
	runtimeKind = strings.TrimSpace(runtimeKind)
	if runtimeKind == "" {
		runtimeKind = RuntimeLocal
	}
	if runtimeKind != RuntimeLocal && runtimeKind != RuntimeWorktree {
		return Session{}, errors.New("invalid session runtime")
	}

	created, err := r.CreateSessionWithContext(ctx, goal, paths)
	if err != nil {
		return Session{}, err
	}
	if runtimeKind == RuntimeLocal {
		return created, nil
	}

	r.mu.RLock()
	engine := r.engine
	r.mu.RUnlock()
	if engine == nil {
		return Session{}, ErrNoWorkspace
	}
	if _, err := engine.AttachWorktree(ctx, created.ID, base); err != nil {
		return Session{}, err
	}
	return r.GetSession(ctx, created.ID)
}

func (r *Runtime) SessionRuntime(ctx context.Context, sessionID string) (SessionRuntime, error) {
	r.mu.RLock()
	engine := r.engine
	r.mu.RUnlock()
	if engine == nil {
		return SessionRuntime{}, ErrNoWorkspace
	}
	return engine.SessionRuntime(ctx, sessionID)
}

func (r *Runtime) RemoveSessionWorktree(ctx context.Context, sessionID string, force bool) error {
	r.mu.RLock()
	engine := r.engine
	supervisor := r.supervisor
	r.mu.RUnlock()
	if engine == nil {
		return ErrNoWorkspace
	}
	if supervisor != nil && supervisor.Active(sessionID) {
		return ErrWorktreeActive
	}
	return engine.RemoveSessionWorktree(ctx, sessionID, force)
}

func (r *Runtime) SessionGitStatus(ctx context.Context, sessionID string) (GitStatus, error) {
	r.mu.RLock()
	engine := r.engine
	r.mu.RUnlock()
	if engine == nil {
		return GitStatus{}, ErrNoWorkspace
	}
	return engine.SessionGitStatus(ctx, sessionID)
}

func (r *Runtime) SessionGitDiff(ctx context.Context, sessionID, path string, staged bool) (GitDiff, error) {
	r.mu.RLock()
	engine := r.engine
	r.mu.RUnlock()
	if engine == nil {
		return GitDiff{}, ErrNoWorkspace
	}
	return engine.SessionGitDiff(ctx, sessionID, path, staged)
}

func (r *Runtime) SessionGitStage(ctx context.Context, sessionID, path string) (GitActionResult, error) {
	r.mu.RLock()
	engine := r.engine
	r.mu.RUnlock()
	if engine == nil {
		return GitActionResult{}, ErrNoWorkspace
	}
	return engine.SessionGitStage(ctx, sessionID, path)
}

func (r *Runtime) SessionGitUnstage(ctx context.Context, sessionID, path string) (GitActionResult, error) {
	r.mu.RLock()
	engine := r.engine
	r.mu.RUnlock()
	if engine == nil {
		return GitActionResult{}, ErrNoWorkspace
	}
	return engine.SessionGitUnstage(ctx, sessionID, path)
}

func (r *Runtime) SessionGitRevert(ctx context.Context, sessionID, path string) (GitActionResult, error) {
	r.mu.RLock()
	engine := r.engine
	r.mu.RUnlock()
	if engine == nil {
		return GitActionResult{}, ErrNoWorkspace
	}
	return engine.SessionGitRevert(ctx, sessionID, path)
}

func (r *Runtime) SessionGitCommit(ctx context.Context, sessionID, message string) (GitActionResult, error) {
	r.mu.RLock()
	engine := r.engine
	r.mu.RUnlock()
	if engine == nil {
		return GitActionResult{}, ErrNoWorkspace
	}
	return engine.SessionGitCommit(ctx, sessionID, message)
}

func (r *Runtime) SessionGitPush(ctx context.Context, sessionID string) (GitActionResult, error) {
	r.mu.RLock()
	engine := r.engine
	r.mu.RUnlock()
	if engine == nil {
		return GitActionResult{}, ErrNoWorkspace
	}
	return engine.SessionGitPush(ctx, sessionID)
}


func (r *Runtime) WorktreeConflicts(ctx context.Context) ([]WorktreeConflict, error) {
	r.mu.RLock()
	engine := r.engine
	r.mu.RUnlock()
	if engine == nil {
		return nil, ErrNoWorkspace
	}
	return engine.WorktreeConflicts(ctx)
}
