package backend

import (
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
)

const (
	ToolPermissionsFilename = "tool-permissions.json"
	MaxDisabledTools        = 512
	MaxToolPermissionsBytes = 128 << 10
)

var toolNamePattern = regexp.MustCompile(`^[A-Za-z0-9_.:-]{1,128}$`)

type ToolPermissions struct {
	Disabled []string `json:"disabled"`
}

func toolPermissionsPath(workspace string) (string, error) {
	if strings.TrimSpace(workspace) == "" {
		return "", ErrNoWorkspace
	}
	return filepath.Join(workspace, ".lumencortex", ToolPermissionsFilename), nil
}

func loadToolPermissions(workspace string) (ToolPermissions, error) {
	path, err := toolPermissionsPath(workspace)
	if err != nil {
		return ToolPermissions{}, err
	}
	raw, err := os.ReadFile(path)
	if errors.Is(err, os.ErrNotExist) {
		return ToolPermissions{Disabled: []string{}}, nil
	}
	if err != nil {
		return ToolPermissions{}, err
	}
	if len(raw) > MaxToolPermissionsBytes {
		return ToolPermissions{}, errors.New("tool permissions configuration exceeds size limit")
	}
	var value ToolPermissions
	if err := json.Unmarshal(raw, &value); err != nil {
		return ToolPermissions{}, err
	}
	disabled, err := normalizeDisabledTools(value.Disabled)
	if err != nil {
		return ToolPermissions{}, err
	}
	return ToolPermissions{Disabled: disabled}, nil
}

func saveToolPermissions(workspace string, value ToolPermissions) error {
	path, err := toolPermissionsPath(workspace)
	if err != nil {
		return err
	}
	disabled, err := normalizeDisabledTools(value.Disabled)
	if err != nil {
		return err
	}
	value.Disabled = disabled
	raw, err := json.MarshalIndent(value, "", "  ")
	if err != nil {
		return err
	}
	raw = append(raw, '\n')
	if len(raw) > MaxToolPermissionsBytes {
		return errors.New("tool permissions configuration exceeds size limit")
	}
	dir := filepath.Dir(path)
	if err := os.MkdirAll(dir, 0o700); err != nil {
		return err
	}
	tmp, err := os.CreateTemp(dir, ".tool-permissions-*.json")
	if err != nil {
		return err
	}
	tmpName := tmp.Name()
	defer os.Remove(tmpName)
	if err := tmp.Chmod(0o600); err != nil {
		_ = tmp.Close()
		return err
	}
	if _, err := tmp.Write(raw); err != nil {
		_ = tmp.Close()
		return err
	}
	if err := tmp.Sync(); err != nil {
		_ = tmp.Close()
		return err
	}
	if err := tmp.Close(); err != nil {
		return err
	}
	return os.Rename(tmpName, path)
}

func normalizeDisabledTools(values []string) ([]string, error) {
	if len(values) > MaxDisabledTools {
		return nil, errors.New("too many disabled tools")
	}
	seen := make(map[string]struct{}, len(values))
	out := make([]string, 0, len(values))
	for _, value := range values {
		name := strings.TrimSpace(value)
		if name == "" {
			continue
		}
		if !toolNamePattern.MatchString(name) {
			return nil, errors.New("invalid tool name in permissions: " + name)
		}
		if _, ok := seen[name]; ok {
			continue
		}
		seen[name] = struct{}{}
		out = append(out, name)
	}
	sort.Strings(out)
	return out, nil
}

func mergeToolDenylists(values ...[]string) []string {
	seen := map[string]struct{}{}
	for _, list := range values {
		for _, name := range list {
			name = strings.TrimSpace(name)
			if name == "" {
				continue
			}
			seen[name] = struct{}{}
		}
	}
	out := make([]string, 0, len(seen))
	for name := range seen {
		out = append(out, name)
	}
	sort.Strings(out)
	return out
}

func (r *Runtime) ToolPermissions() (ToolPermissions, error) {
	r.mu.RLock()
	workspace := r.workspace
	r.mu.RUnlock()
	return loadToolPermissions(workspace)
}

func (r *Runtime) SaveToolPermissions(value ToolPermissions) (ToolPermissions, error) {
	r.mu.RLock()
	workspace := r.workspace
	r.mu.RUnlock()
	if err := saveToolPermissions(workspace, value); err != nil {
		return ToolPermissions{}, err
	}
	return loadToolPermissions(workspace)
}
