package backend

import (
	"context"
	"errors"
	"fmt"
	"path/filepath"
	"strings"
	"sync"

	"github.com/edynasty/LumenCortex/config"
	"github.com/edynasty/LumenCortex/protocol"
	"github.com/edynasty/LumenCortex/provider"
	lcx "github.com/edynasty/LumenCortex/runtime"
)

var (
	ErrNoWorkspace = errors.New("no workspace is open")
	// ErrRunHeld means another Engine (this process or another) owns the session's
	// run. Start wrote nothing; the UI shows "running elsewhere".
	ErrRunHeld       = lcx.ErrRunHeld
	ErrInvalidPolicy = errors.New("invalid agent policy")
	ErrArchiveActive = errors.New("cannot archive an active agent run")
	// ErrUntrustedWorkspace is Core's refusal to use a project input (an MCP server, project skills,
	// project instructions) of a workspace the user has not trusted (ADR-0013). Nothing was started
	// and nothing was written; the UI offers to trust the workspace instead of showing the raw error.
	ErrUntrustedWorkspace = lcx.ErrUntrustedWorkspace
)

type Runtime struct {
	mu         sync.RWMutex
	engine     *lcx.Engine
	supervisor *lcx.RunSupervisor
	workspace  string
	// credentials is Core's file-backed secret store behind {secret:NAME} provider references.
	credentials credentialStore
	// agentsMu serializes read-modify-write of the Core agent catalog in the global file, and the
	// one-time import of the retired agents.json.
	agentsMu sync.Mutex
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
type MessagePage = lcx.MessagePage
type SessionUIPatch = lcx.SessionUIPatch

type AgentConfig struct {
	ModelRef string `json:"modelRef,omitempty"`
	// Effort is one of Core's five levels, "auto" (Core classifies each turn and resolves one level
	// before its first request), or "" for the configured default. Core validates it per model; the
	// bridge refuses an unknown string before the run starts.
	Effort              string   `json:"effort,omitempty"`
	Policy              string   `json:"policy,omitempty"`
	MaxSteps            int      `json:"maxSteps,omitempty"`
	MaxToolCallsPerStep int      `json:"maxToolCallsPerStep,omitempty"`
	ToolDenylist        []string `json:"toolDenylist,omitempty"`
	MaxTokens           int      `json:"maxTokens,omitempty"`
	Temperature         *float64 `json:"temperature,omitempty"`
	// Delegation is the thread's grant for start_task: "" or none, propose, isolated (ADR-0006 D4).
	// Core validates it and enforces it; Desktop only passes the user's choice. The thread's agent
	// caps it further (ADR-0009), so this is the grant, never the effective authority.
	Delegation string `json:"delegation,omitempty"`
	// Agent names the Core catalog agent the turn runs (ADR-0009). Empty keeps the session's pinned
	// agent, or pins "agent" on a session that has none. Switching agent re-pins the model to the
	// agent's first model unless ModelRef names one in the same Start. The agent's instructions and
	// ceilings are Core's: the frontend names an agent, it never sends their text.
	Agent string `json:"agent,omitempty"`
}

type WorkspaceState struct {
	Workspace  string      `json:"workspace"`
	Health     *Health     `json:"health,omitempty"`
	Sessions   []Session   `json:"sessions"`
	ActiveRuns []ActiveRun `json:"activeRuns"`
}

func New() *Runtime {
	r := &Runtime{}
	if store, err := defaultCredentialStore(); err == nil {
		r.credentials = store
	}
	return r
}

// providerFactory builds each run's provider client through Core's package dispatcher, so the
// provider's own wire protocol (openai-compatible or anthropic-messages) is honored and
// {secret:NAME} references resolve from the credential store instead of the environment only.
// It is what runtime.Options.ProviderFactory exists for; Core's default factory would stay
// environment-only.
func (r *Runtime) providerFactory(m config.ResolvedModel) (protocol.Provider, error) {
	return provider.FromModel(m, provider.Options{Credentials: r.credentialResolver()})
}

// credentialResolver returns the resolver over the credential store. Runs, the picker's
// availability, connection tests and model discovery all read {secret:NAME} references through
// it; {env:NAME} references never consult it. A Runtime whose default store path could not be
// resolved has none: every secret reference reports unset, and saving one fails.
func (r *Runtime) credentialResolver() credentialResolver {
	r.mu.RLock()
	store := r.credentials
	r.mu.RUnlock()
	return credentialResolver{store: store}
}
func (r *Runtime) OpenWorkspace(ctx context.Context, path string) (WorkspaceState, error) {
	if path == "" {
		return WorkspaceState{}, errors.New("workspace path is required")
	}
	abs, err := filepath.Abs(path)
	if err != nil {
		return WorkspaceState{}, err
	}
	next, err := lcx.Open(lcx.Options{Workspace: abs, ProviderFactory: r.providerFactory})
	if err != nil {
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

func (r *Runtime) UpdateSessionUI(ctx context.Context, sessionID string, patch SessionUIPatch) (Session, error) {
	r.mu.RLock()
	engine := r.engine
	supervisor := r.supervisor
	r.mu.RUnlock()
	if engine == nil {
		return Session{}, ErrNoWorkspace
	}
	if patch.Archived != nil && *patch.Archived && supervisor != nil && supervisor.Active(sessionID) {
		return Session{}, ErrArchiveActive
	}
	return engine.UpdateSessionUI(ctx, sessionID, patch)
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

func (r *Runtime) MessagePage(ctx context.Context, sessionID string, beforeSeq int64, limit int) (MessagePage, error) {
	r.mu.RLock()
	engine := r.engine
	r.mu.RUnlock()
	if engine == nil {
		return MessagePage{}, ErrNoWorkspace
	}
	return engine.MessagePage(ctx, sessionID, beforeSeq, limit)
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
	return r.startAgent(ctx, sessionID, "", cfg)
}

// startAgent starts a run; input, when set, is appended by Core as the next user
// message under the run lock, after Core has reconciled the transcript.
func (r *Runtime) startAgent(ctx context.Context, sessionID, input string, cfg AgentConfig) (Session, error) {
	r.mu.RLock()
	workspace := r.workspace
	supervisor := r.supervisor
	r.mu.RUnlock()
	if supervisor == nil {
		return Session{}, ErrNoWorkspace
	}

	if !validPolicy(cfg.Policy) {
		return Session{}, ErrInvalidPolicy
	}
	if !validEffort(cfg.Effort) {
		return Session{}, fmt.Errorf("%w: %q", lcx.ErrInvalidEffort, strings.TrimSpace(cfg.Effort))
	}
	permissions, err := loadToolPermissions(workspace)
	if err != nil {
		return Session{}, err
	}
	toolDenylist := mergeToolDenylists(permissions.Disabled, cfg.ToolDenylist)

	return supervisor.Start(ctx, sessionID, agentOptionsFor(cfg, toolDenylist, input))
}

// agentOptionsFor maps the bridge's AgentConfig onto Core's AgentOptions. The agent is named, never
// described: Core applies its instructions and caps Policy and Delegation by its ceilings
// (ADR-0009), which is why a read-only agent such as Ask needs no Desktop-side guard. What is sent
// here is the user's own grant; the effective authority is the lower of it and the agent's ceiling.
func agentOptionsFor(cfg AgentConfig, toolDenylist []string, input string) lcx.AgentOptions {
	return lcx.AgentOptions{
		// Empty Agent keeps the session's pinned agent; empty ModelRef continues it on its pinned
		// model. Core resolves everything else.
		Agent:               strings.TrimSpace(cfg.Agent),
		ModelRef:            config.ModelRef(strings.TrimSpace(cfg.ModelRef)),
		Effort:              config.Effort(strings.TrimSpace(cfg.Effort)),
		Input:               input,
		Policy:              normalizedPolicy(cfg.Policy),
		MaxSteps:            cfg.MaxSteps,
		MaxToolCallsPerStep: cfg.MaxToolCallsPerStep,
		ToolDenylist:        toolDenylist,
		MaxTokens:           cfg.MaxTokens,
		Temperature:         cfg.Temperature,
		Delegation:          strings.TrimSpace(cfg.Delegation),
		// Every Desktop thread is a conversation (ADR-0006 D3): an answer ends the turn, and the thread's
		// resolution, not the run status, says whether the task is done.
		Interactive: true,
	}
}

// validEffort accepts Core's concrete levels and "auto"; "" leaves Core's configured default in
// charge. Core performs the same check against the model, but refusing here keeps an unknown
// string from ever reaching a run.
func validEffort(effort string) bool {
	e := config.Effort(strings.TrimSpace(effort))
	return e == "" || e == config.EffortAuto || e.IsLevel()
}

func (r *Runtime) ContinueAgent(ctx context.Context, sessionID, content string, cfg AgentConfig) (Session, error) {
	content = strings.TrimSpace(content)
	if content == "" {
		return Session{}, errors.New("follow-up content is required")
	}
	return r.startAgent(ctx, sessionID, content, cfg)
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
