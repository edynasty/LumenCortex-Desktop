package main

import (
	"context"
	"sync"

	"github.com/edynasty/LumenCortex-Desktop/internal/backend"
	wailsruntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

type App struct {
	ctx        context.Context
	backend    *backend.Runtime
	eventMu    sync.Mutex
	stopEvents func()

	menuMu     sync.Mutex
	menuLocale string

	// Seams for the quit path (quit.go). A test replaces them because the native dialog and a live
	// run supervisor exist only inside a running app.
	activeRuns func() int
	askToQuit  func(activeRuns int) bool
}

func NewApp() *App {
	app := &App{backend: backend.New()}
	app.activeRuns = app.countActiveRuns
	app.askToQuit = app.confirmQuit
	return app
}

func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
}

func (a *App) shutdown(context.Context) {
	a.stopEventForwarder()
	_ = a.backend.Close()
}

func (a *App) stopEventForwarder() {
	a.eventMu.Lock()
	defer a.eventMu.Unlock()
	if a.stopEvents != nil {
		a.stopEvents()
		a.stopEvents = nil
	}
}

func (a *App) startEventForwarder() {
	a.stopEventForwarder()
	events, stop, ok := a.backend.Events(256)
	if !ok {
		return
	}
	a.eventMu.Lock()
	a.stopEvents = stop
	a.eventMu.Unlock()

	ctx := a.ctx
	go func() {
		for event := range events {
			if ctx == nil {
				continue
			}
			wailsruntime.EventsEmit(ctx, "runtime:event", event)
		}
	}()
}

func (a *App) PickWorkspace() (backend.WorkspaceState, error) {
	path, err := wailsruntime.OpenDirectoryDialog(a.ctx, wailsruntime.OpenDialogOptions{
		Title: "Open LumenCortex workspace",
	})
	if err != nil {
		return backend.WorkspaceState{}, err
	}
	if path == "" {
		return a.backend.State(context.Background())
	}
	return a.OpenWorkspace(path)
}

func (a *App) OpenWorkspace(path string) (backend.WorkspaceState, error) {
	state, err := a.backend.OpenWorkspace(context.Background(), path)
	if err != nil {
		return backend.WorkspaceState{}, err
	}
	a.startEventForwarder()
	return state, nil
}

func (a *App) GetState() (backend.WorkspaceState, error) {
	return a.backend.State(context.Background())
}

func (a *App) ListSessions(limit, offset int) ([]backend.Session, error) {
	return a.backend.ListSessions(context.Background(), limit, offset)
}

func (a *App) GetSession(sessionID string) (backend.Session, error) {
	return a.backend.GetSession(context.Background(), sessionID)
}

func (a *App) UpdateSessionUI(sessionID string, patch backend.SessionUIPatch) (backend.Session, error) {
	return a.backend.UpdateSessionUI(context.Background(), sessionID, patch)
}

func (a *App) CreateSession(goal string) (backend.Session, error) {
	return a.backend.CreateSession(context.Background(), goal)
}

func (a *App) CreateSessionWithContext(goal string, paths []string) (backend.Session, error) {
	return a.backend.CreateSessionWithContext(context.Background(), goal, paths)
}

func (a *App) CreateSessionWithRuntime(goal string, paths []string, runtimeKind, base string) (backend.Session, error) {
	return a.backend.CreateSessionWithRuntime(context.Background(), goal, paths, runtimeKind, base)
}

func (a *App) GetSessionRuntime(sessionID string) (backend.SessionRuntime, error) {
	return a.backend.SessionRuntime(context.Background(), sessionID)
}

func (a *App) InspectSessionWorktree(sessionID string) (backend.WorktreeInspection, error) {
	return a.backend.InspectSessionWorktree(context.Background(), sessionID)
}

// RemoveSessionWorktree unbinds the session from its worktree; the session stays.
func (a *App) RemoveSessionWorktree(sessionID string, cleanup backend.WorktreeCleanup) (backend.WorktreeCleanupOutcome, error) {
	return a.backend.RemoveSessionWorktree(context.Background(), sessionID, cleanup)
}

// DeleteSession deletes the session and, under the same cleanup rules, its worktree.
func (a *App) DeleteSession(sessionID string, cleanup backend.WorktreeCleanup) (backend.DeleteSessionOutcome, error) {
	return a.backend.DeleteSession(context.Background(), sessionID, cleanup)
}

func (a *App) WorktreeConflicts() ([]backend.WorktreeConflict, error) {
	return a.backend.WorktreeConflicts(context.Background())
}

func (a *App) WorktreeHandoffPlan(sessionID string) (backend.WorktreeHandoffPlan, error) {
	return a.backend.WorktreeHandoffPlan(context.Background(), sessionID)
}

func (a *App) ApplySessionWorktree(sessionID string) (backend.WorktreeApplyResult, error) {
	return a.backend.ApplySessionWorktree(context.Background(), sessionID)
}

func (a *App) PickContextFiles() ([]string, error) {
	state, err := a.backend.State(context.Background())
	if err != nil {
		return nil, err
	}
	if state.Workspace == "" {
		return nil, backend.ErrNoWorkspace
	}
	paths, err := wailsruntime.OpenMultipleFilesDialog(a.ctx, wailsruntime.OpenDialogOptions{
		Title:            "Attach workspace files",
		DefaultDirectory: state.Workspace,
	})
	if err != nil {
		return nil, err
	}
	return a.backend.NormalizeContextPaths(paths)
}

func (a *App) PickContextDirectory() ([]string, error) {
	state, err := a.backend.State(context.Background())
	if err != nil {
		return nil, err
	}
	if state.Workspace == "" {
		return nil, backend.ErrNoWorkspace
	}
	path, err := wailsruntime.OpenDirectoryDialog(a.ctx, wailsruntime.OpenDialogOptions{
		Title:            "Attach workspace folder",
		DefaultDirectory: state.Workspace,
	})
	if err != nil || path == "" {
		return nil, err
	}
	return a.backend.NormalizeContextPaths([]string{path})
}

func (a *App) MessagePage(sessionID string, beforeSeq int64, limit int) (backend.MessagePage, error) {
	return a.backend.MessagePage(context.Background(), sessionID, beforeSeq, limit)
}

func (a *App) RecentMessages(sessionID string, limit int) ([]backend.Message, error) {
	return a.backend.RecentMessages(context.Background(), sessionID, limit)
}

func (a *App) DiscoverProviderModels(providerID string) ([]backend.DiscoveredModel, error) {
	return a.backend.DiscoverProviderModels(providerID)
}

func (a *App) TestProviderConnection(providerID string) (backend.ProviderConnectionResult, error) {
	return a.backend.TestProviderConnection(providerID)
}

func (a *App) GetConfigState() (backend.ConfigState, error) {
	return a.backend.ConfigState()
}

func (a *App) TrustWorkspace(globalDigest string) (backend.ConfigState, error) {
	return a.backend.TrustWorkspace(globalDigest)
}

func (a *App) SaveConcurrency(globalDigest string, limits backend.AgentConcurrency) (backend.ConfigState, error) {
	return a.backend.SaveConcurrency(globalDigest, limits)
}

func (a *App) GetProviderCatalogScope(scope string) (backend.ProviderCatalogDocument, error) {
	return a.backend.ProviderCatalogScope(scope)
}

// GetReasoningFormats lists the reasoning.format values the provider package implements, the
// package default ("") first. Core owns the list; the model form fills its select from it.
func (a *App) GetReasoningFormats(pkg string) ([]string, error) {
	return backend.ReasoningFormats(pkg), nil
}

// GetReasoningEfforts lists Core's effort levels, lowest first, for a model's efforts list.
func (a *App) GetReasoningEfforts() ([]string, error) {
	return backend.ReasoningEfforts(), nil
}

func (a *App) SaveProviderCatalogScope(scope string, doc backend.ProviderCatalogDocument) (backend.ProviderCatalogDocument, error) {
	return a.backend.SaveProviderCatalogScope(scope, doc)
}

func (a *App) GetProviderCredentialStatus(scope, providerID string) (backend.CredentialStatus, error) {
	return a.backend.GetProviderCredentialStatus(scope, providerID)
}

// SaveProviderCredential stores the provider's key in the platform secret store and points its
// apiKey at a {secret:NAME} reference; the key itself is never returned or stored in the config.
func (a *App) SaveProviderCredential(scope, providerID, apiKey string) (backend.CredentialStatus, error) {
	return a.backend.SaveProviderCredential(scope, providerID, apiKey)
}

func (a *App) RemoveProviderCredential(scope, providerID string) (backend.CredentialStatus, error) {
	return a.backend.RemoveProviderCredential(scope, providerID)
}

func (a *App) StartAgent(sessionID string, config backend.AgentConfig) (backend.Session, error) {
	return a.backend.StartAgent(context.Background(), sessionID, config)
}

func (a *App) ContinueAgent(sessionID, content string, config backend.AgentConfig) (backend.Session, error) {
	return a.backend.ContinueAgent(context.Background(), sessionID, content, config)
}

func (a *App) StartProposedTask(parentSessionID, taskID string) (backend.ExecutionTask, error) {
	return a.backend.StartProposedTask(context.Background(), parentSessionID, taskID)
}

func (a *App) CancelSubtree(sessionID string) ([]string, error) {
	return a.backend.CancelSubtree(context.Background(), sessionID)
}

func (a *App) GetWorkflowSummary(sessionID string) (any, error) {
	return a.backend.WorkflowSummary(context.Background(), sessionID)
}

func (a *App) ApproveWorkflowGate(sessionID, gateID string) (any, error) {
	return a.backend.ApproveWorkflowGate(context.Background(), sessionID, gateID, "desktop-user")
}

func (a *App) GetTaskState(sessionID string) (backend.TaskStateInfo, error) {
	return a.backend.TaskState(context.Background(), sessionID)
}

func (a *App) SetTaskBrief(sessionID, brief string) (backend.TaskStateInfo, error) {
	return a.backend.SetTaskBrief(context.Background(), sessionID, brief)
}

func (a *App) EditTaskReference(sessionID string, edit backend.TaskReferenceEdit) (backend.TaskStateInfo, error) {
	return a.backend.EditTaskReference(context.Background(), sessionID, edit)
}

func (a *App) EditTaskNote(sessionID string, edit backend.TaskNoteEdit) (backend.TaskStateInfo, error) {
	return a.backend.EditTaskNote(context.Background(), sessionID, edit)
}

// ThreadNotes returns one thread's notes with each cite's freshness (ADR-0010 D4).
func (a *App) ThreadNotes(sessionID string) ([]backend.ThreadNote, error) {
	return a.backend.ThreadNotes(context.Background(), sessionID)
}

func (a *App) ResolveThread(sessionID, state string) (backend.TaskStateInfo, error) {
	return a.backend.ResolveThread(context.Background(), sessionID, state, "desktop-user")
}

func (a *App) ResetContext(sessionID string) (backend.TaskStateInfo, error) {
	return a.backend.ResetContext(context.Background(), sessionID)
}

func (a *App) GetSessionChecks(sessionID string) (backend.ChecksInfo, error) {
	return a.backend.SessionChecks(context.Background(), sessionID)
}

func (a *App) GetCheckResults(sessionID string, beforeSeq int64, limit int) ([]backend.CheckResult, error) {
	return a.backend.CheckResults(context.Background(), sessionID, beforeSeq, limit)
}

func (a *App) GetCheckArtifact(sessionID, hash string) (backend.CheckArtifact, error) {
	return a.backend.CheckArtifact(context.Background(), sessionID, hash)
}

func (a *App) AcceptCheck(sessionID, checkID string) (backend.CheckResult, error) {
	return a.backend.AcceptCheck(context.Background(), sessionID, checkID, "desktop-user")
}

func (a *App) SearchText(query, path string, limit int) (backend.SearchResult, error) {
	return a.backend.SearchText(context.Background(), query, path, limit)
}

func (a *App) FindFiles(pattern, path string, limit int) (backend.FileResult, error) {
	return a.backend.FindFiles(context.Background(), pattern, path, limit)
}

func (a *App) GitStatus() (backend.GitStatus, error) {
	return a.backend.GitStatus(context.Background())
}

func (a *App) SessionGitStatus(sessionID string) (backend.GitStatus, error) {
	return a.backend.SessionGitStatus(context.Background(), sessionID)
}

func (a *App) GitDiff(path string, staged bool) (backend.GitDiff, error) {
	return a.backend.GitDiff(context.Background(), path, staged)
}

func (a *App) SessionGitDiff(sessionID, path string, staged bool) (backend.GitDiff, error) {
	return a.backend.SessionGitDiff(context.Background(), sessionID, path, staged)
}

func (a *App) GitStage(path string) (backend.GitActionResult, error) {
	return a.backend.GitStage(context.Background(), path)
}

func (a *App) SessionGitStage(sessionID, path string) (backend.GitActionResult, error) {
	return a.backend.SessionGitStage(context.Background(), sessionID, path)
}

func (a *App) GitUnstage(path string) (backend.GitActionResult, error) {
	return a.backend.GitUnstage(context.Background(), path)
}

func (a *App) SessionGitUnstage(sessionID, path string) (backend.GitActionResult, error) {
	return a.backend.SessionGitUnstage(context.Background(), sessionID, path)
}

func (a *App) GitRevert(path string) (backend.GitActionResult, error) {
	return a.backend.GitRevert(context.Background(), path)
}

func (a *App) SessionGitRevert(sessionID, path string) (backend.GitActionResult, error) {
	return a.backend.SessionGitRevert(context.Background(), sessionID, path)
}

func (a *App) GitCommit(message string) (backend.GitActionResult, error) {
	return a.backend.GitCommit(context.Background(), message)
}

func (a *App) SessionGitCommit(sessionID, message string) (backend.GitActionResult, error) {
	return a.backend.SessionGitCommit(context.Background(), sessionID, message)
}

func (a *App) GitPush() (backend.GitActionResult, error) {
	return a.backend.GitPush(context.Background())
}

func (a *App) SessionGitPush(sessionID string) (backend.GitActionResult, error) {
	return a.backend.SessionGitPush(context.Background(), sessionID)
}

func (a *App) RunShell(sessionID, command string) (backend.ShellResult, error) {
	return a.backend.RunShell(context.Background(), sessionID, command)
}

func (a *App) StartLSP(sessionID string, config backend.LSPConfig) (backend.LSPStatus, error) {
	return a.backend.StartLSP(context.Background(), sessionID, config)
}

func (a *App) StopLSP(sessionID string) error {
	return a.backend.StopLSP(context.Background(), sessionID)
}

func (a *App) GetLSPStatus(sessionID string) (backend.LSPStatus, error) {
	return a.backend.LSPStatus(context.Background(), sessionID)
}

func (a *App) GetLSPDiagnostics(sessionID, path string) ([]backend.LSPDiagnostic, error) {
	return a.backend.LSPDiagnostics(context.Background(), sessionID, path)
}

func (a *App) GetMCPConfigs() ([]backend.MCPConfig, error) {
	return a.backend.MCPConfigs()
}

func (a *App) GetMCPConfigsScope(scope string) ([]backend.MCPConfig, error) {
	return a.backend.MCPConfigsScope(scope)
}

func (a *App) SaveMCPConfig(config backend.MCPConfig) error {
	return a.backend.MCPUpsertConfig(config)
}

func (a *App) SaveMCPConfigScope(scope string, config backend.MCPConfig) error {
	return a.backend.MCPUpsertConfigScope(scope, config)
}

func (a *App) DeleteMCPConfig(id string) error {
	return a.backend.MCPDeleteConfig(id)
}

func (a *App) DeleteMCPConfigScope(scope, id string) error {
	return a.backend.MCPDeleteConfigScope(scope, id)
}

func (a *App) StartMCP(sessionID, serverID string) (backend.MCPStatus, error) {
	return a.backend.MCPStart(context.Background(), sessionID, serverID)
}

func (a *App) StopMCP(sessionID, serverID string) error {
	return a.backend.MCPStop(context.Background(), sessionID, serverID)
}

func (a *App) GetMCPStatuses(sessionID string) ([]backend.MCPStatus, error) {
	return a.backend.MCPStatuses(context.Background(), sessionID)
}

func (a *App) GetMCPTools(sessionID string) ([]backend.MCPAgentTool, error) {
	return a.backend.MCPTools(context.Background(), sessionID)
}

func (a *App) RefreshMCPTools(sessionID, serverID string) error {
	return a.backend.MCPRefreshTools(context.Background(), sessionID, serverID)
}

func (a *App) GetSubagentTree(parentSessionID string) ([]backend.SubagentNode, error) {
	return a.backend.SubagentTree(context.Background(), parentSessionID)
}

func (a *App) GetSessionCheckpoints(sessionID string, limit int) ([]backend.SessionCheckpoint, error) {
	return a.backend.SessionCheckpoints(context.Background(), sessionID, limit)
}

func (a *App) GetSkills(scope string) ([]backend.Skill, error) {
	return a.backend.Skills(scope)
}

func (a *App) GetSkillContent(scope, id string) (string, error) {
	return a.backend.SkillContent(scope, id)
}

func (a *App) SaveSkill(scope, id, content string) error {
	return a.backend.SaveSkill(scope, id, content)
}

func (a *App) DeleteSkill(scope, id string) error {
	return a.backend.DeleteSkill(scope, id)
}

func (a *App) SetSkillEnabled(scope, id string, enabled bool) error {
	return a.backend.SetSkillEnabled(scope, id, enabled)
}

func (a *App) GetToolPermissions() (backend.ToolPermissions, error) {
	return a.backend.ToolPermissions()
}

func (a *App) SaveToolPermissions(value backend.ToolPermissions) (backend.ToolPermissions, error) {
	return a.backend.SaveToolPermissions(value)
}

// ImportSources lists the session import sources whose plugin is running. A disabled or failed
// plugin has no source, so the import dialog shows an empty state instead of a list.
func (a *App) ImportSources() ([]backend.ImportSource, error) {
	return a.backend.ImportSources(context.Background())
}

// ListImportSessions lists one source's sessions for the import dialog. The source directory is
// always the source's default one; All widens the list from this workspace to every workspace.
func (a *App) ListImportSessions(source string, opts backend.ImportListOptions) ([]backend.ImportSessionSummary, error) {
	return a.backend.ListImportSessions(context.Background(), source, opts)
}

// PreviewImport reports what importing one session of a source would write; it writes nothing.
func (a *App) PreviewImport(source, path string) (backend.ImportPreview, error) {
	return a.backend.PreviewImport(context.Background(), source, "", path)
}

// ImportSession imports one session and its subagents as native sessions of this workspace.
// Importing a session imported before writes nothing and reports alreadyImported.
func (a *App) ImportSession(source, path string) (backend.ImportResult, error) {
	return a.backend.ImportSession(context.Background(), source, "", path)
}

// Plugins lists the registered plugins with their enablement, state and failures (ADR-0012).
func (a *App) Plugins() (backend.PluginCatalog, error) {
	return a.backend.Plugins(context.Background())
}

// SetPluginEnabled enables or disables a plugin for every workspace and applies it to the open
// Engine now.
func (a *App) SetPluginEnabled(id string, enabled bool) error {
	return a.backend.SetPluginEnabled(context.Background(), id, enabled)
}

// GetAgents returns Core's merged agent catalog: the four built-ins first, then the custom agents.
// The retired Desktop agents.json is imported the first time this is read; the result rides along
// so the page can report what the import skipped.
func (a *App) GetAgents() (backend.AgentCatalog, error) {
	return a.backend.Agents()
}

// GetAgentPresets returns the compiled-in specialists the page may start a draft from. They are not
// in the catalog until the user saves one.
func (a *App) GetAgentPresets() ([]backend.AgentEntry, error) {
	return a.backend.AgentPresets()
}

// SaveAgent creates a custom agent (empty id) or updates one in the global file. A built-in keeps
// its name, description, use and ceilings; only its instructions, effort and models are written.
// globalDigest is the digest the page last read: a changed file is a conflict and nothing is written.
func (a *App) SaveAgent(globalDigest string, agent backend.AgentEntry) (backend.AgentCatalog, error) {
	return a.backend.SaveAgent(globalDigest, agent)
}

// DeleteAgent removes a custom agent from the global file; built-ins cannot be deleted.
func (a *App) DeleteAgent(globalDigest, id string) (backend.AgentCatalog, error) {
	return a.backend.DeleteAgent(globalDigest, id)
}

// DismissAgentImport closes the one-time agents.json notice; the record keeps what it says about
// the import, so the file still explains what happened.
func (a *App) DismissAgentImport() (backend.AgentCatalog, error) {
	return a.backend.DismissAgentImport()
}

// MigrateSubagentModel rewrites the retired subagentModel key in the global file and, when a
// workspace is open, in its lumencortex.json. It is the repair behind the load error that names it.
func (a *App) MigrateSubagentModel() (backend.SubagentModelMigration, error) {
	return a.backend.MigrateSubagentModel()
}
