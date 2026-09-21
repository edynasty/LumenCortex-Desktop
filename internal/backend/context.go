package backend

import (
	"context"
	"errors"
	"fmt"
	"path/filepath"
	"strings"

	lcx "github.com/edynasty/LumenCortex/runtime"
)

const maxContextPaths = 32

func normalizeContextPaths(workspace string, paths []string) ([]string, error) {
	if strings.TrimSpace(workspace) == "" {
		return nil, ErrNoWorkspace
	}
	workspaceAbs, err := filepath.Abs(workspace)
	if err != nil {
		return nil, err
	}
	workspaceReal, err := filepath.EvalSymlinks(workspaceAbs)
	if err != nil {
		return nil, err
	}

	out := make([]string, 0, min(len(paths), maxContextPaths))
	seen := map[string]bool{}
	for _, input := range paths {
		if len(out) >= maxContextPaths {
			break
		}
		input = strings.TrimSpace(input)
		if input == "" {
			continue
		}
		candidate := input
		if !filepath.IsAbs(candidate) {
			candidate = filepath.Join(workspaceAbs, candidate)
		}
		candidate, err = filepath.Abs(candidate)
		if err != nil {
			return nil, err
		}
		real, err := filepath.EvalSymlinks(candidate)
		if err != nil {
			return nil, err
		}
		rel, err := filepath.Rel(workspaceReal, real)
		if err != nil || rel == ".." || strings.HasPrefix(rel, ".."+string(filepath.Separator)) {
			return nil, fmt.Errorf("context path escapes workspace: %s", input)
		}
		rel = filepath.ToSlash(rel)
		if rel == "." || seen[rel] {
			continue
		}
		seen[rel] = true
		out = append(out, rel)
	}
	return out, nil
}

func (r *Runtime) NormalizeContextPaths(paths []string) ([]string, error) {
	r.mu.RLock()
	workspace := r.workspace
	r.mu.RUnlock()
	return normalizeContextPaths(workspace, paths)
}

func (r *Runtime) CreateSessionWithContext(ctx context.Context, goal string, paths []string) (Session, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	if r.engine == nil {
		return Session{}, ErrNoWorkspace
	}
	normalized, err := normalizeContextPaths(r.workspace, paths)
	if err != nil {
		return Session{}, err
	}

	metadata := map[string]any{}
	if len(normalized) > 0 {
		metadata["contextPaths"] = normalized
	}
	handle, err := r.engine.NewSession(ctx, lcx.SessionOptions{Goal: goal, Metadata: metadata})
	if err != nil {
		return Session{}, err
	}
	if len(normalized) > 0 {
		var prompt strings.Builder
		prompt.WriteString(strings.TrimSpace(goal))
		prompt.WriteString("\n\nWorkspace context attachments:\n")
		for _, path := range normalized {
			prompt.WriteString("- @")
			prompt.WriteString(path)
			prompt.WriteByte('\n')
		}
		if _, err := handle.AppendMessage(ctx, "user", map[string]string{"content": strings.TrimSpace(prompt.String())}); err != nil {
			return Session{}, err
		}
	}
	_, info, err := r.engine.Session(ctx, handle.ID)
	return info, err
}

var _ = errors.Is
