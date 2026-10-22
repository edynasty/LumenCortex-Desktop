package backend

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"testing"

	lcx "github.com/edynasty/LumenCortex/runtime"
)

// openMCPWorkspace opens workspace with a project mcp.json that defines one server. The workspace is
// untrusted unless the caller writes a trustedWorkspaces entry into the global file.
func openMCPWorkspace(t *testing.T, projectConfig string) (*Runtime, string) {
	t.Helper()
	workspace := t.TempDir()
	writeFile(t, filepath.Join(workspace, ".lumencortex", "mcp.json"), projectConfig)
	r := New()
	t.Cleanup(func() { r.Close() })
	if _, err := r.OpenWorkspace(context.Background(), workspace); err != nil {
		t.Fatal(err)
	}
	return r, workspace
}

// trustWorkspace lists workspace in the global trustedWorkspaces. Core re-reads the global file on
// every check, so a workspace opened untrusted becomes trusted without reopening it.
func trustWorkspace(t *testing.T, globalPath, workspace string) {
	t.Helper()
	resolved, err := filepath.EvalSymlinks(workspace)
	if err != nil {
		t.Fatal(err)
	}
	writeFile(t, globalPath, fmt.Sprintf("{\"trustedWorkspaces\": [%q]}\n", resolved))
}

func findConfig(t *testing.T, configs []MCPConfig, id string) MCPConfig {
	t.Helper()
	for _, cfg := range configs {
		if cfg.ID == id {
			return cfg
		}
	}
	t.Fatalf("server %q is not in %+v", id, configs)
	return MCPConfig{}
}

// ADR-0013: a server defined only by the project file of an untrusted workspace is refused before a
// process exists, and the refusal is the sentinel the UI matches instead of a raw error.
func TestMCPStartRefusesProjectServerOfUntrustedWorkspace(t *testing.T) {
	useConfigDir(t)
	workspace := t.TempDir()
	marker := filepath.Join(workspace, "started")
	writeFile(t, filepath.Join(workspace, ".lumencortex", "mcp.json"), fmt.Sprintf(`{
  "servers": {"evil": {"command": "/bin/sh", "args": ["-c", "touch %s"]}}
}
`, marker))
	r := New()
	t.Cleanup(func() { r.Close() })
	if _, err := r.OpenWorkspace(context.Background(), workspace); err != nil {
		t.Fatal(err)
	}

	_, err := r.MCPStart(context.Background(), "", "evil")
	if !errors.Is(err, ErrUntrustedWorkspace) {
		t.Fatalf("err=%v, want ErrUntrustedWorkspace", err)
	}
	if _, statErr := os.Stat(marker); !os.IsNotExist(statErr) {
		t.Fatalf("the refused server ran: %v", statErr)
	}
	if statuses, err := r.MCPStatuses(context.Background(), ""); err != nil {
		t.Fatal(err)
	} else if len(statuses) != 0 {
		t.Fatalf("statuses=%+v, want none", statuses)
	}
	// The listing explains the refusal instead of hiding the entry.
	configs, err := r.MCPConfigs()
	if err != nil {
		t.Fatal(err)
	}
	evil := findConfig(t, configs, "evil")
	if evil.Scope != "project" || !evil.BlockedByTrust {
		t.Fatalf("evil=%+v, want a blocked project entry", evil)
	}
}

// Trust is read on every listing, so the same workspace entry stops being blocked once the global
// file lists it.
func TestMCPConfigsFollowWorkspaceTrust(t *testing.T) {
	globalPath := useConfigDir(t)
	r, workspace := openMCPWorkspace(t, `{"servers": {"evil": {"command": "/bin/sh"}}}`)

	configs, err := r.MCPConfigs()
	if err != nil {
		t.Fatal(err)
	}
	if evil := findConfig(t, configs, "evil"); !evil.BlockedByTrust {
		t.Fatalf("evil=%+v, want blockedByTrust while untrusted", evil)
	}

	trustWorkspace(t, globalPath, workspace)

	configs, err = r.MCPConfigs()
	if err != nil {
		t.Fatal(err)
	}
	evil := findConfig(t, configs, "evil")
	if evil.BlockedByTrust || evil.Scope != "project" {
		t.Fatalf("evil=%+v, want an unblocked project entry", evil)
	}
}

// The permission override the pane writes travels as the MCPConfig the bridge already saves: it must
// land in LC's own project file and disappear again when the override is cleared.
func TestMCPUpsertConfigScopePersistsToolOverrides(t *testing.T) {
	useConfigDir(t)
	r, workspace := openMCPWorkspace(t, `{"servers": {"helper": {"command": "helper-server"}}}`)

	var cfg MCPConfig
	if err := json.Unmarshal([]byte(`{
  "id": "helper",
  "command": "helper-server",
  "tools": {"read_file": {"permission": "read"}}
}`), &cfg); err != nil {
		t.Fatal(err)
	}
	if err := r.MCPUpsertConfigScope("project", cfg); err != nil {
		t.Fatal(err)
	}

	path := filepath.Join(workspace, ".lumencortex", "mcp.json")
	var saved struct {
		Servers map[string]struct {
			Tools map[string]struct {
				Permission string `json:"permission"`
			} `json:"tools"`
		} `json:"servers"`
	}
	if err := json.Unmarshal([]byte(readFile(t, path)), &saved); err != nil {
		t.Fatal(err)
	}
	if got := saved.Servers["helper"].Tools["read_file"].Permission; got != "read" {
		t.Fatalf("permission=%q, want read", got)
	}
	if _, err := os.Stat(filepath.Join(workspace, "mcp.json")); !os.IsNotExist(err) {
		t.Fatalf("the override was written outside LC's config directory: %v", err)
	}

	// Clearing sends the entry back without the tool.
	cfg.Tools = nil
	if err := r.MCPUpsertConfigScope("project", cfg); err != nil {
		t.Fatal(err)
	}
	saved.Servers = nil
	if err := json.Unmarshal([]byte(readFile(t, path)), &saved); err != nil {
		t.Fatal(err)
	}
	if tools := saved.Servers["helper"].Tools; len(tools) != 0 {
		t.Fatalf("tools=%+v, want the cleared override gone", tools)
	}
}

// A tool that is not overridden keeps the permission the server's annotation gave it, so the pane can
// label the source.
func TestMCPAgentToolPermissionShape(t *testing.T) {
	var tool lcx.MCPAgentTool
	if err := json.Unmarshal([]byte(`{
  "name": "mcp__helper__read_file",
  "serverId": "helper",
  "toolName": "read_file",
  "readOnly": true,
  "permission": "read",
  "permissionSource": "annotation",
  "scope": "global"
}`), &tool); err != nil {
		t.Fatal(err)
	}
	if tool.Permission != "read" || tool.PermissionSource != "annotation" || tool.Scope != "global" {
		t.Fatalf("tool=%+v", tool)
	}
}
