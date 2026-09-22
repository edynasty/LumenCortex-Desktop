package backend

import (
	"context"

	lcx "github.com/edynasty/LumenCortex/runtime"
)

type LSPConfig = lcx.LSPConfig
type LSPStatus = lcx.LSPStatus

func (r *Runtime) StartLSP(ctx context.Context, sessionID string, cfg LSPConfig) (LSPStatus, error) {
	r.mu.RLock()
	engine := r.engine
	r.mu.RUnlock()
	if engine == nil {
		return LSPStatus{}, ErrNoWorkspace
	}
	return engine.LSPStart(ctx, sessionID, cfg)
}

func (r *Runtime) StopLSP(ctx context.Context, sessionID string) error {
	r.mu.RLock()
	engine := r.engine
	r.mu.RUnlock()
	if engine == nil {
		return ErrNoWorkspace
	}
	return engine.LSPStop(ctx, sessionID)
}

func (r *Runtime) LSPStatus(ctx context.Context, sessionID string) (LSPStatus, error) {
	r.mu.RLock()
	engine := r.engine
	r.mu.RUnlock()
	if engine == nil {
		return LSPStatus{}, ErrNoWorkspace
	}
	return engine.LSPStatus(ctx, sessionID)
}
