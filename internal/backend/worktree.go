package backend

import (
	"context"
	"errors"
	"strings"

	lcx "github.com/edynasty/LumenCortex/runtime"
)

type SessionRuntime = lcx.SessionRuntime
type RuntimeOwner = lcx.RuntimeOwner
type WorktreeConflict = lcx.WorktreeConflict
type WorktreeHandoffPlan = lcx.WorktreeHandoffPlan
type WorktreeApplyResult = lcx.WorktreeApplyResult
type WorktreeInspection = lcx.WorktreeInspection
type WorktreeCleanup = lcx.WorktreeCleanup
type WorktreeDiscard = lcx.WorktreeDiscard
type WorktreeCleanupResult = lcx.WorktreeCleanupResult
type DeleteSessionResult = lcx.DeleteSessionResult
type SessionDependent = lcx.SessionDependent

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

// Worktree cleanup and session deletion are enforced by Core (ADR-0005): the run lock,
// the cross-process worktree lease, ownership and the cleanup matrix. The adapter
// only classifies Core's typed refusals for the UI; it keeps no guard of its own.

// WorktreeRefusal is a cleanup or deletion Core refused before writing anything.
// Code is one of the WorktreeRefusal* constants; Inspection is Core's fresh view of
// what would have been lost, when it has one.
type WorktreeRefusal struct {
	Code       string              `json:"code"`
	Message    string              `json:"message"`
	Inspection *WorktreeInspection `json:"inspection,omitempty"`
	Dependents []SessionDependent  `json:"dependents,omitempty"`
}

const (
	WorktreeRefusalDirty      = "dirty"
	WorktreeRefusalUnapplied  = "unapplied"
	WorktreeRefusalIgnored    = "ignored"
	WorktreeRefusalOwnership  = "ownership"
	WorktreeRefusalBorrowed   = "borrowed"
	WorktreeRefusalStale      = "stale"
	WorktreeRefusalBusy       = "busy"
	WorktreeRefusalRunHeld    = "runHeld"
	WorktreeRefusalDependents = "dependents"
)

// WorktreeCleanupOutcome holds exactly one of Result and Refusal.
type WorktreeCleanupOutcome struct {
	Result  *WorktreeCleanupResult `json:"result,omitempty"`
	Refusal *WorktreeRefusal       `json:"refusal,omitempty"`
}

// DeleteSessionOutcome holds exactly one of Result and Refusal.
type DeleteSessionOutcome struct {
	Result  *DeleteSessionResult `json:"result,omitempty"`
	Refusal *WorktreeRefusal     `json:"refusal,omitempty"`
}

// worktreeRefusal classifies err when it is a refusal the user can act on; other
// errors stay errors.
func worktreeRefusal(err error) *WorktreeRefusal {
	out := &WorktreeRefusal{Message: err.Error()}
	var refusal *lcx.WorktreeRefusal
	var dependents *lcx.DependentsError
	switch {
	case errors.As(err, &dependents):
		out.Code, out.Dependents = WorktreeRefusalDependents, dependents.Dependents
		return out
	case errors.As(err, &refusal):
		inspection := refusal.Inspection
		out.Inspection = &inspection
	}
	codes := []struct {
		err  error
		code string
	}{
		{lcx.ErrWorktreeDirty, WorktreeRefusalDirty},
		{lcx.ErrWorktreeUnapplied, WorktreeRefusalUnapplied},
		{lcx.ErrWorktreeIgnored, WorktreeRefusalIgnored},
		{lcx.ErrWorktreeOwnership, WorktreeRefusalOwnership},
		{lcx.ErrWorktreeBorrowed, WorktreeRefusalBorrowed},
		{lcx.ErrDiscardStale, WorktreeRefusalStale},
		{lcx.ErrWorktreeBusy, WorktreeRefusalBusy},
		{lcx.ErrRunHeld, WorktreeRefusalRunHeld},
	}
	for _, c := range codes {
		if errors.Is(err, c.err) {
			out.Code = c.code
			return out
		}
	}
	return nil
}

// InspectSessionWorktree is Core's read of what a cleanup of the session's worktree
// would affect; the UI shows it before offering KeepBranch or Discard.
func (r *Runtime) InspectSessionWorktree(ctx context.Context, sessionID string) (WorktreeInspection, error) {
	r.mu.RLock()
	engine := r.engine
	r.mu.RUnlock()
	if engine == nil {
		return WorktreeInspection{}, ErrNoWorkspace
	}
	return engine.InspectSessionWorktree(ctx, sessionID)
}

// RemoveSessionWorktree unbinds the session from its worktree under Core's cleanup
// matrix; the session stays. A Discard is re-validated by Core against the HEAD and
// status digest it carries.
func (r *Runtime) RemoveSessionWorktree(ctx context.Context, sessionID string, cleanup WorktreeCleanup) (WorktreeCleanupOutcome, error) {
	r.mu.RLock()
	engine := r.engine
	r.mu.RUnlock()
	if engine == nil {
		return WorktreeCleanupOutcome{}, ErrNoWorkspace
	}
	result, err := engine.RemoveSessionWorktree(ctx, sessionID, cleanup)
	if err != nil {
		if refusal := worktreeRefusal(err); refusal != nil {
			return WorktreeCleanupOutcome{Refusal: refusal}, nil
		}
		return WorktreeCleanupOutcome{}, err
	}
	return WorktreeCleanupOutcome{Result: &result}, nil
}

// DeleteSession deletes the session, its worktree under the same matrix, and its
// finished temporary subagents. It is a different operation from removing the
// worktree: the session and its transcript are gone afterwards.
func (r *Runtime) DeleteSession(ctx context.Context, sessionID string, cleanup WorktreeCleanup) (DeleteSessionOutcome, error) {
	r.mu.RLock()
	engine := r.engine
	r.mu.RUnlock()
	if engine == nil {
		return DeleteSessionOutcome{}, ErrNoWorkspace
	}
	result, err := engine.DeleteSession(ctx, sessionID, cleanup)
	if err != nil {
		if refusal := worktreeRefusal(err); refusal != nil {
			return DeleteSessionOutcome{Refusal: refusal}, nil
		}
		return DeleteSessionOutcome{}, err
	}
	return DeleteSessionOutcome{Result: &result}, nil
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


func (r *Runtime) WorktreeHandoffPlan(ctx context.Context, sessionID string) (WorktreeHandoffPlan, error) {
	r.mu.RLock()
	engine := r.engine
	r.mu.RUnlock()
	if engine == nil {
		return WorktreeHandoffPlan{}, ErrNoWorkspace
	}
	return engine.WorktreeHandoffPlan(ctx, sessionID)
}

// ApplySessionWorktree cherry-picks the worktree's commits onto the main checkout.
// Core refuses while the session or any borrower runs (ErrRunHeld, ErrWorktreeBusy)
// and serializes Applies on the main checkout.
func (r *Runtime) ApplySessionWorktree(ctx context.Context, sessionID string) (WorktreeApplyResult, error) {
	r.mu.RLock()
	engine := r.engine
	r.mu.RUnlock()
	if engine == nil {
		return WorktreeApplyResult{}, ErrNoWorkspace
	}
	return engine.ApplySessionWorktree(ctx, sessionID)
}
