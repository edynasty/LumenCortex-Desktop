package backend

import (
	"context"
	"os"
	"path/filepath"
	"runtime"
	"testing"
)

func TestToolPermissionsPersistNormalizedDenylist(t *testing.T) {
	root := t.TempDir()
	r := New()
	defer r.Close()
	if _, err := r.OpenWorkspace(context.Background(), root); err != nil {
		t.Fatal(err)
	}

	saved, err := r.SaveToolPermissions(ToolPermissions{
		Disabled: []string{"shell", "lsp_rename", "shell", "mcp__server__write"},
	})
	if err != nil {
		t.Fatal(err)
	}
	want := []string{"lsp_rename", "mcp__server__write", "shell"}
	if len(saved.Disabled) != len(want) {
		t.Fatalf("disabled=%#v", saved.Disabled)
	}
	for i := range want {
		if saved.Disabled[i] != want[i] {
			t.Fatalf("disabled=%#v want=%#v", saved.Disabled, want)
		}
	}

	loaded, err := r.ToolPermissions()
	if err != nil {
		t.Fatal(err)
	}
	if len(loaded.Disabled) != len(want) {
		t.Fatalf("loaded=%#v", loaded.Disabled)
	}

	path := filepath.Join(root, ".lumencortex", ToolPermissionsFilename)
	info, err := os.Stat(path)
	if err != nil {
		t.Fatal(err)
	}
	if runtime.GOOS != "windows" && info.Mode().Perm() != 0o600 {
		t.Fatalf("mode=%o want=600", info.Mode().Perm())
	}
}

func TestToolPermissionsRejectInvalidAndOversizedLists(t *testing.T) {
	root := t.TempDir()
	r := New()
	defer r.Close()
	if _, err := r.OpenWorkspace(context.Background(), root); err != nil {
		t.Fatal(err)
	}

	if _, err := r.SaveToolPermissions(ToolPermissions{Disabled: []string{"bad tool name"}}); err == nil {
		t.Fatal("expected invalid tool name rejection")
	}

	values := make([]string, MaxDisabledTools+1)
	for i := range values {
		values[i] = "tool_" + string(rune('a'+(i%26)))
	}
	if _, err := r.SaveToolPermissions(ToolPermissions{Disabled: values}); err == nil {
		t.Fatal("expected disabled tool count limit")
	}
}
