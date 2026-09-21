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

func (a *App) CreateSession(goal string) (backend.Session, error) {
	return a.backend.CreateSession(context.Background(), goal)
}

func (a *App) RecentMessages(sessionID string, limit int) ([]backend.Message, error) {
	return a.backend.RecentMessages(context.Background(), sessionID, limit)
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

func (a *App) CancelAgent(sessionID string) bool {
	return a.backend.CancelAgent(sessionID)
}

func (a *App) RunShell(sessionID, command string) (backend.ShellResult, error) {
	return a.backend.RunShell(context.Background(), sessionID, command)
}
