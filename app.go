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
}

func NewApp() *App {
	return &App{backend: backend.New()}
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

func (a *App) RemoveSessionWorktree(sessionID string, force bool) error {
	return a.backend.RemoveSessionWorktree(context.Background(), sessionID, force)
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

func (a *App) GetProviderCatalog() (backend.ProviderCatalog, error) {
	return a.backend.ProviderCatalog()
}

func (a *App) SaveProviderCatalog(config backend.ProviderCatalog) (backend.ProviderCatalog, error) {
	return a.backend.SaveProviderCatalog(config)
}

func (a *App) GetProviderCatalogScope(scope string) (backend.ProviderCatalog, error) {
	return a.backend.ProviderCatalogScope(scope)
}

func (a *App) SaveProviderCatalogScope(scope string, config backend.ProviderCatalog) (backend.ProviderCatalog, error) {
	return a.backend.SaveProviderCatalogScope(scope, config)
}

func (a *App) StartAgent(sessionID string, config backend.AgentConfig) (backend.Session, error) {
	return a.backend.StartAgent(context.Background(), sessionID, config)
}

func (a *App) ContinueAgent(sessionID, content string, config backend.AgentConfig) (backend.Session, error) {
	return a.backend.ContinueAgent(context.Background(), sessionID, content, config)
}

func (a *App) CancelAgent(sessionID string) bool {
	return a.backend.CancelAgent(sessionID)
}

func (a *App) GetWorkflowSummary(sessionID string) (any, error) {
	return a.backend.WorkflowSummary(context.Background(), sessionID)
}

func (a *App) ApproveWorkflowGate(sessionID, gateID string) (any, error) {
	return a.backend.ApproveWorkflowGate(context.Background(), sessionID, gateID, "desktop-user")
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
