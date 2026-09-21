package backend

import (
	"context"
	"errors"
	"path/filepath"
	"sync"

	"github.com/edynasty/LumenCortex/provider/openai"
	lcx "github.com/edynasty/LumenCortex/runtime"
)

var ErrNoWorkspace = errors.New("no workspace is open")

type Runtime struct {
	mu        sync.RWMutex
	engine    *lcx.Engine
	workspace string

	activeMu sync.Mutex
	active   map[string]context.CancelFunc
}

type Health = lcx.Health
type Session = lcx.SessionInfo
type Message = lcx.Message
type ShellResult = lcx.ShellResult
type Event = lcx.Event
type AgentResult = lcx.AgentResult

type WorkspaceState struct {
	Workspace string    `json:"workspace"`
	Health    *Health   `json:"health,omitempty"`
	Sessions  []Session `json:"sessions"`
}

type AgentRunRequest struct {
	SessionID        string `json:"sessionId"`
	Endpoint         string `json:"endpoint,omitempty"`
	BaseURL          string `json:"baseUrl,omitempty"`
	APIKey           string `json:"apiKey,omitempty"`
	Model            string `json:"model"`
	Policy           string `json:"policy,omitempty"`
	MaxSteps         int    `json:"maxSteps,omitempty"`
	RecentMessages   int    `json:"recentMessages,omitempty"`
	MaxToolCalls     int    `json:"maxToolCalls,omitempty"`
	Workflow         string `json:"workflow,omitempty"`
	DisableStreaming bool   `json:"disableStreaming,omitempty"`
}

func New() *Runtime {
	return &Runtime{active: map[string]context.CancelFunc{}}
}

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

	r.cancelAll()
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
	r.cancelAll()
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

func (r *Runtime) RunAgent(ctx context.Context, req AgentRunRequest) (AgentResult, error) {
	if req.SessionID == "" {
		return AgentResult{}, errors.New("sessionId is required")
	}
	if req.Model == "" {
		return AgentResult{}, errors.New("model is required")
	}
	provider, err := openai.New(openai.Config{
		Endpoint:         req.Endpoint,
		BaseURL:          req.BaseURL,
		APIKey:           req.APIKey,
		Model:            req.Model,
		DisableStreaming: req.DisableStreaming,
	})
	if err != nil {
		return AgentResult{}, err
	}
	policy := req.Policy
	if policy == "" {
		policy = "read-only"
	}

	r.mu.RLock()
	defer r.mu.RUnlock()
	if r.engine == nil {
		return AgentResult{}, ErrNoWorkspace
	}

	runCtx, cancel := context.WithCancel(ctx)
	if !r.registerAgent(req.SessionID, cancel) {
		cancel()
		return AgentResult{}, errors.New("session already has an active agent run")
	}
	defer func() {
		cancel()
		r.unregisterAgent(req.SessionID)
	}()

	return r.engine.RunAgent(runCtx, req.SessionID, provider, lcx.AgentOptions{
		Policy:              policy,
		MaxSteps:            req.MaxSteps,
		RecentMessages:      req.RecentMessages,
		MaxToolCallsPerStep: req.MaxToolCalls,
		Workflow:            []byte(req.Workflow),
	})
}

func (r *Runtime) CancelAgent(sessionID string) bool {
	r.activeMu.Lock()
	cancel := r.active[sessionID]
	r.activeMu.Unlock()
	if cancel == nil {
		return false
	}
	cancel()
	return true
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

func (r *Runtime) registerAgent(sessionID string, cancel context.CancelFunc) bool {
	r.activeMu.Lock()
	defer r.activeMu.Unlock()
	if _, exists := r.active[sessionID]; exists {
		return false
	}
	r.active[sessionID] = cancel
	return true
}

func (r *Runtime) unregisterAgent(sessionID string) {
	r.activeMu.Lock()
	delete(r.active, sessionID)
	r.activeMu.Unlock()
}

func (r *Runtime) cancelAll() {
	r.activeMu.Lock()
	cancels := make([]context.CancelFunc, 0, len(r.active))
	for _, cancel := range r.active {
		cancels = append(cancels, cancel)
	}
	r.activeMu.Unlock()
	for _, cancel := range cancels {
		cancel()
	}
}
