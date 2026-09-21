package backend

import (
	"context"
	"errors"
	"path/filepath"
	"sync"

	lcx "github.com/edynasty/LumenCortex/runtime"
)

var ErrNoWorkspace = errors.New("no workspace is open")

type Runtime struct {
	mu        sync.RWMutex
	engine    *lcx.Engine
	workspace string
}

type Health = lcx.Health
type Session = lcx.SessionInfo
type Message = lcx.Message
type ShellResult = lcx.ShellResult
type Event = lcx.Event

type WorkspaceState struct {
	Workspace string    `json:"workspace"`
	Health    *Health   `json:"health,omitempty"`
	Sessions  []Session `json:"sessions"`
}

func New() *Runtime { return &Runtime{} }

func (r *Runtime) OpenWorkspace(ctx context.Context, path string) (WorkspaceState, error) {
	if path == "" {
		return WorkspaceState{}, errors.New("workspace path is required")
	}
	abs, err := filepath.Abs(path)
	if err != nil {
		return WorkspaceState{}, err
	}
	next, err := lcx.Open(lcx.Options{Workspace: abs})
	if err != nil {
		return WorkspaceState{}, err
	}

	r.mu.Lock()
	previous := r.engine
	r.engine = next
	r.workspace = abs
	r.mu.Unlock()

	if previous != nil {
		_ = previous.Close()
	}
	return r.State(ctx)
}

func (r *Runtime) Close() error {
	r.mu.Lock()
	defer r.mu.Unlock()
	if r.engine == nil {
		return nil
	}
	err := r.engine.Close()
	r.engine = nil
	r.workspace = ""
	return err
}

func (r *Runtime) State(ctx context.Context) (WorkspaceState, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	if r.engine == nil {
		return WorkspaceState{Sessions: []Session{}}, nil
	}
	health := r.engine.Health()
	sessions, err := r.engine.ListSessions(ctx, 100, 0)
	if err != nil {
		return WorkspaceState{}, err
	}
	return WorkspaceState{
		Workspace: r.workspace,
		Health:    &health,
		Sessions:  sessions,
	}, nil
}

func (r *Runtime) ListSessions(ctx context.Context, limit, offset int) ([]Session, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	if r.engine == nil {
		return nil, ErrNoWorkspace
	}
	return r.engine.ListSessions(ctx, limit, offset)
}

func (r *Runtime) CreateSession(ctx context.Context, goal string) (Session, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	if r.engine == nil {
		return Session{}, ErrNoWorkspace
	}
	handle, err := r.engine.NewSession(ctx, lcx.SessionOptions{Goal: goal})
	if err != nil {
		return Session{}, err
	}
	_, info, err := r.engine.Session(ctx, handle.ID)
	return info, err
}

func (r *Runtime) RecentMessages(ctx context.Context, sessionID string, limit int) ([]Message, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	if r.engine == nil {
		return nil, ErrNoWorkspace
	}
	handle, _, err := r.engine.Session(ctx, sessionID)
	if err != nil {
		return nil, err
	}
	return handle.RecentMessages(ctx, limit)
}

func (r *Runtime) RunShell(ctx context.Context, sessionID, command string) (ShellResult, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	if r.engine == nil {
		return ShellResult{}, ErrNoWorkspace
	}
	handle, _, err := r.engine.Session(ctx, sessionID)
	if err != nil {
		return ShellResult{}, err
	}
	return handle.RunShell(ctx, command)
}

func (r *Runtime) Events(buffer int) (<-chan Event, func(), bool) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	if r.engine == nil {
		return nil, func() {}, false
	}
	ch, stop := r.engine.Events(buffer)
	return ch, stop, true
}
