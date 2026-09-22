package backend

import (
	"context"

	lcx "github.com/edynasty/LumenCortex/runtime"
)

type MCPConfig = lcx.MCPConfig
type MCPStatus = lcx.MCPStatus
type MCPAgentTool = lcx.MCPAgentTool

func (r *Runtime) MCPConfigs() ([]MCPConfig, error) {
	r.mu.RLock()
	engine := r.engine
	r.mu.RUnlock()
	if engine == nil {
		return nil, ErrNoWorkspace
	}
	return engine.MCPConfigs(), nil
}

func (r *Runtime) MCPUpsertConfig(cfg MCPConfig) error {
	r.mu.RLock()
	engine := r.engine
	r.mu.RUnlock()
	if engine == nil {
		return ErrNoWorkspace
	}
	return engine.MCPUpsertConfig(cfg)
}

func (r *Runtime) MCPDeleteConfig(id string) error {
	r.mu.RLock()
	engine := r.engine
	r.mu.RUnlock()
	if engine == nil {
		return ErrNoWorkspace
	}
	return engine.MCPDeleteConfig(id)
}

func (r *Runtime) MCPStart(ctx context.Context, sessionID, serverID string) (MCPStatus, error) {
	r.mu.RLock()
	engine := r.engine
	r.mu.RUnlock()
	if engine == nil {
		return MCPStatus{}, ErrNoWorkspace
	}
	return engine.MCPStart(ctx, sessionID, serverID)
}

func (r *Runtime) MCPStop(ctx context.Context, sessionID, serverID string) error {
	r.mu.RLock()
	engine := r.engine
	r.mu.RUnlock()
	if engine == nil {
		return ErrNoWorkspace
	}
	return engine.MCPStop(ctx, sessionID, serverID)
}

func (r *Runtime) MCPStatuses(ctx context.Context, sessionID string) ([]MCPStatus, error) {
	r.mu.RLock()
	engine := r.engine
	r.mu.RUnlock()
	if engine == nil {
		return nil, ErrNoWorkspace
	}
	return engine.MCPStatuses(ctx, sessionID)
}

func (r *Runtime) MCPTools(ctx context.Context, sessionID string) ([]MCPAgentTool, error) {
	r.mu.RLock()
	engine := r.engine
	r.mu.RUnlock()
	if engine == nil {
		return nil, ErrNoWorkspace
	}
	return engine.MCPTools(ctx, sessionID)
}

func (r *Runtime) MCPRefreshTools(ctx context.Context, sessionID, serverID string) error {
	r.mu.RLock()
	engine := r.engine
	r.mu.RUnlock()
	if engine == nil {
		return ErrNoWorkspace
	}
	_, err := engine.MCPRefreshTools(ctx, sessionID, serverID)
	return err
}
