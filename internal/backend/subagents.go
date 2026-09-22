package backend

import (
	"context"

	lcx "github.com/edynasty/LumenCortex/runtime"
)

type SubagentNode = lcx.SubagentNode
type SessionCheckpoint = lcx.SessionCheckpoint

func (r *Runtime) SubagentTree(ctx context.Context, parentSessionID string) ([]SubagentNode, error) {
	r.mu.RLock()
	supervisor := r.supervisor
	r.mu.RUnlock()
	if supervisor == nil {
		return nil, ErrNoWorkspace
	}
	return supervisor.SubagentTree(ctx, parentSessionID)
}

func (r *Runtime) SessionCheckpoints(ctx context.Context, sessionID string, limit int) ([]SessionCheckpoint, error) {
	r.mu.RLock()
	engine := r.engine
	r.mu.RUnlock()
	if engine == nil {
		return nil, ErrNoWorkspace
	}
	return engine.SessionCheckpoints(ctx, sessionID, limit)
}

func (r *Runtime) HasActiveSubagents(ctx context.Context, parentSessionID string) (bool, error) {
	r.mu.RLock()
	supervisor := r.supervisor
	r.mu.RUnlock()
	if supervisor == nil {
		return false, ErrNoWorkspace
	}
	return supervisor.HasActiveSubagents(ctx, parentSessionID)
}
