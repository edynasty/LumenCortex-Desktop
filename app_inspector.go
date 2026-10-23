package main

import (
	"context"
	"errors"
	"path/filepath"
	"strings"

	"github.com/edynasty/LumenCortex-Desktop/internal/backend"
	wailsruntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

// Inspector surfaces that are Desktop integration rather than Core runtime: the workspace tree
// and the Finder reveal go through Core's listing; the terminal is a local pty.

func (a *App) ListDir(path string) (backend.DirListing, error) {
	return a.backend.ListDir(context.Background(), path)
}

func (a *App) SessionListDir(sessionID, path string) (backend.DirListing, error) {
	return a.backend.SessionListDir(context.Background(), sessionID, path)
}

func (a *App) RevealInFinder(path string) error {
	return a.backend.RevealInFinder(context.Background(), path)
}

// TerminalStart opens a shell in the workspace (or in cwd, a workspace-relative directory) and
// returns its id. Output and exit arrive as terminal:output / terminal:exit events.
func (a *App) TerminalStart(cwd string, cols, rows int) (string, error) {
	root := a.backend.WorkspacePath()
	if root == "" {
		return "", backend.ErrNoWorkspace
	}
	target := root
	if trimmed := strings.TrimSpace(cwd); trimmed != "" {
		target = trimmed
		if !filepath.IsAbs(target) {
			target = filepath.Join(root, filepath.FromSlash(target))
		}
	}
	realRoot, err := filepath.EvalSymlinks(root)
	if err != nil {
		return "", err
	}
	real, err := filepath.EvalSymlinks(target)
	if err != nil {
		return "", err
	}
	rel, err := filepath.Rel(realRoot, real)
	if err != nil || rel == ".." || strings.HasPrefix(rel, ".."+string(filepath.Separator)) || filepath.IsAbs(rel) {
		return "", errors.New("terminal directory is outside the workspace")
	}
	return a.terminals.Start(real, cols, rows)
}

func (a *App) TerminalWrite(id, data string) error {
	return a.terminals.Write(id, data)
}

func (a *App) TerminalResize(id string, cols, rows int) error {
	return a.terminals.Resize(id, cols, rows)
}

func (a *App) TerminalClose(id string) error {
	return a.terminals.Close(id)
}

func (a *App) emitTerminal(event string, payload any) {
	if a.ctx == nil {
		return
	}
	wailsruntime.EventsEmit(a.ctx, event, payload)
}
