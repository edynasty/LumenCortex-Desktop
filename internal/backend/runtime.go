package backend

import (
	"context"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"sync"

	"github.com/edynasty/LumenCortex/provider/openai"
	lcx "github.com/edynasty/LumenCortex/runtime"
)

var (
	ErrNoWorkspace   = errors.New("no workspace is open")
	ErrAgentRunning  = lcx.ErrRunAlreadyActive
	ErrModelRequired = errors.New("provider model is required (set it in the UI or LCX_MODEL)")
	ErrInvalidPolicy = errors.New("invalid agent policy")
)

type Runtime struct {
	mu         sync.RWMutex
	engine     *lcx.Engine
	supervisor *lcx.RunSupervisor
	workspace  string
}

type Health = lcx.Health
type Session = lcx.SessionInfo
type Message = lcx.Message
type ShellResult = lcx.ShellResult
type Event = lcx.Event
type ActiveRun = lcx.ActiveRun
type SearchResult = lcx.SearchResult
type FileResult = lcx.FileResult
type GitStatus = lcx.GitStatus
type GitDiff = lcx.GitDiff
type GitActionResult = lcx.GitActionResult

type ProviderConfig struct {
	Endpoint         string `json:"endpoint,omitempty"`
	BaseURL          string `json:"baseUrl,omitempty"`
	APIKey           string `json:"apiKey,omitempty"`
	Model            string `json:"model,omitempty"`
	DisableStreaming bool   `json:"disableStreaming,omitempty"`
	DisableRetries   bool   `json:"disableRetries,omitempty"`
}

type AgentConfig struct {
	Provider            ProviderConfig `json:"provider"`
	ModelRef            string         `json:"modelRef,omitempty"`
	Policy              string         `json:"policy,omitempty"`
	MaxSteps            int            `json:"maxSteps,omitempty"`
	RecentMessages      int            `json:"recentMessages,omitempty"`
	MaxToolCallsPerStep int            `json:"maxToolCallsPerStep,omitempty"`
	MaxTokens           int            `json:"maxTokens,omitempty"`
	Temperature         *float64       `json:"temperature,omitempty"`
}

type WorkspaceState struct {
	Workspace  string      `json:"workspace"`
	Health     *Health     `json:"health,omitempty"`
	Sessions   []Session   `json:"sessions"`
	ActiveRuns []ActiveRun `json:"activeRuns"`
}

func New() *Runtime {
	return &Runtime{}
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
	if _, err := next.RecoverStaleRuns(ctx); err != nil {
		_ = next.Close()
		return WorkspaceState{}, err
	}
	nextSupervisor, err := lcx.NewRunSupervisor(next)
	if err != nil {
		_ = next.Close()
		return WorkspaceState{}, err
	}

	r.mu.Lock()
	previous := r.engine
	previousSupervisor := r.supervisor
	r.engine = next
	r.supervisor = nextSupervisor
	r.workspace = abs
	r.mu.Unlock()

	if previousSupervisor != nil {
		previousSupervisor.Close()
	}
	if previous != nil {
		_ = previous.Close()
	}
	return r.State(ctx)
}

func (r *Runtime) Close() error {
	r.mu.Lock()
	engine := r.engine
	supervisor := r.supervisor
	r.engine = nil
	r.supervisor = nil
	r.workspace = ""
	r.mu.Unlock()

	if supervisor != nil {
		supervisor.Close()
	}
	if engine == nil {
		return nil
	}
	return engine.Close()
}

func (r *Runtime) State(ctx context.Context) (WorkspaceState, error) {
	r.mu.RLock()
	engine := r.engine
	supervisor := r.supervisor
	workspace := r.workspace
	r.mu.RUnlock()

	if engine == nil {
		return WorkspaceState{Sessions: []Session{}, ActiveRuns: []ActiveRun{}}, nil
	}
	health := engine.Health()
	sessions, err := engine.ListSessions(ctx, 100, 0)
	if err != nil {
		return WorkspaceState{}, err
	}
	activeRuns := []ActiveRun{}
	if supervisor != nil {
		activeRuns = supervisor.Runs()
	}
	return WorkspaceState{
		Workspace:  workspace,
		Health:     &health,
		Sessions:   sessions,
		ActiveRuns: activeRuns,
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

func (r *Runtime) GetSession(ctx context.Context, sessionID string) (Session, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	if r.engine == nil {
		return Session{}, ErrNoWorkspace
	}
	_, info, err := r.engine.Session(ctx, sessionID)
	return info, err
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

func (r *Runtime) SearchText(ctx context.Context, query, path string, limit int) (SearchResult, error) {
	r.mu.RLock()
	engine := r.engine
	r.mu.RUnlock()
	if engine == nil {
		return SearchResult{}, ErrNoWorkspace
	}
	return engine.SearchText(ctx, query, path, limit)
}

func (r *Runtime) FindFiles(ctx context.Context, pattern, path string, limit int) (FileResult, error) {
	r.mu.RLock()
	engine := r.engine
	r.mu.RUnlock()
	if engine == nil {
		return FileResult{}, ErrNoWorkspace
	}
	return engine.FindFiles(ctx, pattern, path, limit)
}

func (r *Runtime) GitStatus(ctx context.Context) (GitStatus, error) {
	r.mu.RLock()
	engine := r.engine
	r.mu.RUnlock()
	if engine == nil {
		return GitStatus{}, ErrNoWorkspace
	}
	return engine.GitStatus(ctx)
}

func (r *Runtime) GitDiff(ctx context.Context, path string, staged bool) (GitDiff, error) {
	r.mu.RLock()
	engine := r.engine
	r.mu.RUnlock()
	if engine == nil {
		return GitDiff{}, ErrNoWorkspace
	}
	return engine.GitDiff(ctx, path, staged)
}

func (r *Runtime) GitStage(ctx context.Context, path string) (GitActionResult, error) {
	r.mu.RLock()
	engine := r.engine
	r.mu.RUnlock()
	if engine == nil {
		return GitActionResult{}, ErrNoWorkspace
	}
	return engine.GitStage(ctx, path)
}

func (r *Runtime) GitUnstage(ctx context.Context, path string) (GitActionResult, error) {
	r.mu.RLock()
	engine := r.engine
	r.mu.RUnlock()
	if engine == nil {
		return GitActionResult{}, ErrNoWorkspace
	}
	return engine.GitUnstage(ctx, path)
}

func (r *Runtime) GitRevert(ctx context.Context, path string) (GitActionResult, error) {
	r.mu.RLock()
	engine := r.engine
	r.mu.RUnlock()
	if engine == nil {
		return GitActionResult{}, ErrNoWorkspace
	}
	return engine.GitRevert(ctx, path)
}

func (r *Runtime) GitCommit(ctx context.Context, message string) (GitActionResult, error) {
	r.mu.RLock()
	engine := r.engine
	r.mu.RUnlock()
	if engine == nil {
		return GitActionResult{}, ErrNoWorkspace
	}
	return engine.GitCommit(ctx, message)
}

func (r *Runtime) GitPush(ctx context.Context) (GitActionResult, error) {
	r.mu.RLock()
	engine := r.engine
	r.mu.RUnlock()
	if engine == nil {
		return GitActionResult{}, ErrNoWorkspace
	}
	return engine.GitPush(ctx)
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

func (r *Runtime) StartAgent(ctx context.Context, sessionID string, cfg AgentConfig) (Session, error) {
	r.mu.RLock()
	workspace := r.workspace
	supervisor := r.supervisor
	r.mu.RUnlock()
	if supervisor == nil {
		return Session{}, ErrNoWorkspace
	}

	client, providerName, err := providerFromAgentConfig(workspace, cfg)
	if err != nil {
		return Session{}, err
	}
	if !validPolicy(cfg.Policy) {
		return Session{}, ErrInvalidPolicy
	}

	return supervisor.Start(ctx, sessionID, client, lcx.AgentOptions{
		ProviderName:        providerName,
		Policy:              normalizedPolicy(cfg.Policy),
		MaxSteps:            cfg.MaxSteps,
		RecentMessages:      cfg.RecentMessages,
		MaxToolCallsPerStep: cfg.MaxToolCallsPerStep,
		MaxTokens:           cfg.MaxTokens,
		Temperature:         cfg.Temperature,
	})
}

func (r *Runtime) ContinueAgent(ctx context.Context, sessionID, content string, cfg AgentConfig) (Session, error) {
	if strings.TrimSpace(content) == "" {
		return Session{}, errors.New("follow-up content is required")
	}

	r.mu.RLock()
	engine := r.engine
	r.mu.RUnlock()
	if engine == nil {
		return Session{}, ErrNoWorkspace
	}
	handle, _, err := engine.Session(ctx, sessionID)
	if err != nil {
		return Session{}, err
	}
	if _, err := handle.AppendMessage(ctx, "user", map[string]string{"content": strings.TrimSpace(content)}); err != nil {
		return Session{}, err
	}
	return r.StartAgent(ctx, sessionID, cfg)
}

func (r *Runtime) CancelAgent(sessionID string) bool {
	r.mu.RLock()
	supervisor := r.supervisor
	r.mu.RUnlock()
	if supervisor == nil {
		return false
	}
	return supervisor.Cancel(sessionID)
}

func (r *Runtime) WorkflowSummary(ctx context.Context, sessionID string) (any, error) {
	r.mu.RLock()
	engine := r.engine
	r.mu.RUnlock()
	if engine == nil {
		return nil, ErrNoWorkspace
	}
	return engine.WorkflowSummary(ctx, sessionID)
}

func (r *Runtime) ApproveWorkflowGate(ctx context.Context, sessionID, gateID, actor string) (any, error) {
	r.mu.RLock()
	engine := r.engine
	r.mu.RUnlock()
	if engine == nil {
		return nil, ErrNoWorkspace
	}
	return engine.ApproveWorkflowGate(ctx, sessionID, gateID, actor)
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

func (r *Runtime) DiscoverProviderModels(providerID string) ([]DiscoveredModel, error) {
	r.mu.RLock()
	workspace := r.workspace
	r.mu.RUnlock()
	catalog, err := loadProviderCatalog(workspace)
	if err != nil {
		return nil, err
	}
	return discoverProviderModels(catalog, providerID)
}

func (r *Runtime) TestProviderConnection(providerID string) (ProviderConnectionResult, error) {
	models, err := r.DiscoverProviderModels(providerID)
	if err != nil {
		return ProviderConnectionResult{}, err
	}
	return ProviderConnectionResult{
		OK: true,
		Models: len(models),
		Message: fmt.Sprintf("provider reachable; discovered %d models", len(models)),
	}, nil
}

func (r *Runtime) ProviderCatalog() (ProviderCatalog, error) {
	r.mu.RLock()
	workspace := r.workspace
	r.mu.RUnlock()
	return loadProviderCatalog(workspace)
}

func (r *Runtime) SaveProviderCatalog(catalog ProviderCatalog) (ProviderCatalog, error) {
	r.mu.RLock()
	workspace := r.workspace
	r.mu.RUnlock()
	if err := saveProviderCatalog(workspace, catalog); err != nil {
		return ProviderCatalog{}, err
	}
	return loadProviderCatalog(workspace)
}

func (r *Runtime) ProviderCatalogScope(scope string) (ProviderCatalog, error) {
	r.mu.RLock()
	workspace := r.workspace
	r.mu.RUnlock()
	return loadProviderCatalogScope(workspace, scope)
}

func (r *Runtime) SaveProviderCatalogScope(scope string, catalog ProviderCatalog) (ProviderCatalog, error) {
	r.mu.RLock()
	workspace := r.workspace
	r.mu.RUnlock()
	if err := saveProviderCatalogScope(workspace, scope, catalog); err != nil {
		return ProviderCatalog{}, err
	}
	return loadProviderCatalogScope(workspace, scope)
}

func providerFromAgentConfig(workspace string, cfg AgentConfig) (*openai.Client, string, error) {
	providerName := "openai-compatible"
	providerCfg := cfg.Provider

	if strings.TrimSpace(cfg.ModelRef) != "" || strings.TrimSpace(providerCfg.Model) == "" {
		catalog, err := loadProviderCatalog(workspace)
		if err != nil && !errors.Is(err, ErrNoWorkspace) {
			return nil, "", err
		}
		ref := strings.TrimSpace(cfg.ModelRef)
		if ref == "" && catalog.Model != "" {
			ref = catalog.Model
		}
		if ref != "" {
			resolved, name, err := resolveCatalogProvider(catalog, ref)
			if err != nil {
				return nil, "", err
			}
			resolved.DisableRetries = providerCfg.DisableRetries
			resolved.DisableStreaming = providerCfg.DisableStreaming
			providerCfg = resolved
			providerName = name
		}
	}

	client, err := providerFromConfig(providerCfg)
	if err != nil {
		return nil, "", err
	}
	return client, providerName, nil
}

func providerFromConfig(cfg ProviderConfig) (*openai.Client, error) {
	model := firstNonEmpty(cfg.Model, os.Getenv("LCX_MODEL"))
	if model == "" {
		return nil, ErrModelRequired
	}
	return openai.New(openai.Config{
		Endpoint:         firstNonEmpty(cfg.Endpoint, os.Getenv("LCX_ENDPOINT")),
		BaseURL:          firstNonEmpty(cfg.BaseURL, os.Getenv("LCX_BASE_URL")),
		APIKey:           firstNonEmpty(cfg.APIKey, os.Getenv("LCX_API_KEY")),
		Model:            model,
		DisableStreaming: cfg.DisableStreaming,
		DisableRetries:   cfg.DisableRetries,
	})
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if trimmed := strings.TrimSpace(value); trimmed != "" {
			return trimmed
		}
	}
	return ""
}

func normalizedPolicy(policy string) string {
	if strings.TrimSpace(policy) == "" {
		return "read-only"
	}
	return strings.TrimSpace(policy)
}

func validPolicy(policy string) bool {
	switch normalizedPolicy(policy) {
	case "read-only", "workspace", "full":
		return true
	default:
		return false
	}
}
