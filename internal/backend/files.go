package backend

import (
	"context"
	"errors"
	"fmt"
	"os/exec"
	"path/filepath"
	"strings"

	lcx "github.com/edynasty/LumenCortex/runtime"
)

// Directory listing for the inspector's file tree: Core owns the confinement, the ordering and the
// bound; the adapter only forwards the call.
type DirEntry = lcx.DirEntry
type DirListing = lcx.DirListing

func (r *Runtime) ListDir(ctx context.Context, path string) (DirListing, error) {
	r.mu.RLock()
	engine := r.engine
	r.mu.RUnlock()
	if engine == nil {
		return DirListing{}, ErrNoWorkspace
	}
	return engine.ListDir(ctx, path)
}

// SessionListDir lists the session's checkout: the workspace for a local session, its worktree for
// an isolated one.
func (r *Runtime) SessionListDir(ctx context.Context, sessionID, path string) (DirListing, error) {
	r.mu.RLock()
	engine := r.engine
	r.mu.RUnlock()
	if engine == nil {
		return DirListing{}, ErrNoWorkspace
	}
	return engine.SessionListDir(ctx, sessionID, path)
}

// WorkspacePath is the open workspace root, or "" when none is open.
func (r *Runtime) WorkspacePath() string {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return r.workspace
}

// RevealInFinder shows path (workspace-relative, forward slashes) in the macOS Finder. The path is
// resolved the way Core resolves a listing: the parent directory must list inside the workspace,
// and the entry must be one of that listing's names, so a crafted path cannot reveal something
// outside the project.
func (r *Runtime) RevealInFinder(ctx context.Context, path string) error {
	workspace := r.WorkspacePath()
	if workspace == "" {
		return ErrNoWorkspace
	}
	clean := strings.TrimSpace(strings.ReplaceAll(path, "\\", "/"))
	clean = strings.TrimPrefix(clean, "/")
	if clean == "" || clean == "." {
		return openInFinder(ctx, workspace, false)
	}
	parent := filepath.ToSlash(filepath.Dir(filepath.FromSlash(clean)))
	if parent == "." {
		parent = ""
	}
	name := filepath.Base(filepath.FromSlash(clean))
	listing, err := r.ListDir(ctx, parent)
	if err != nil {
		return err
	}
	found := false
	for _, entry := range listing.Entries {
		if entry.Name == name {
			found = true
			break
		}
	}
	if !found {
		return fmt.Errorf("%s is not in the workspace listing", clean)
	}
	return openInFinder(ctx, filepath.Join(workspace, filepath.FromSlash(clean)), true)
}

// openInFinder is the macOS reveal call. A test replaces it: actually opening Finder from a test
// run would be a visible side effect of no value.
var openInFinder = func(ctx context.Context, path string, reveal bool) error {
	args := []string{path}
	if reveal {
		args = []string{"-R", path}
	}
	cmd := exec.CommandContext(ctx, "open", args...)
	if out, err := cmd.CombinedOutput(); err != nil {
		message := strings.TrimSpace(string(out))
		if message == "" {
			message = err.Error()
		}
		return errors.New(message)
	}
	return nil
}
