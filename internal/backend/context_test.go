package backend

import (
	"context"
	"encoding/json"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"testing"
)

func TestContextPathsStayInsideWorkspace(t *testing.T) {
	root := t.TempDir()
	if err := os.MkdirAll(filepath.Join(root, "src"), 0o755); err != nil {
		t.Fatal(err)
	}
	file := filepath.Join(root, "src", "main.go")
	if err := os.WriteFile(file, []byte("package main\n"), 0o644); err != nil {
		t.Fatal(err)
	}

	got, err := normalizeContextPaths(root, []string{file, filepath.Join(root, "src"), file})
	if err != nil {
		t.Fatal(err)
	}
	if len(got) != 2 || got[0] != "src/main.go" || got[1] != "src" {
		t.Fatalf("paths=%#v", got)
	}
}

func TestContextPathsRejectSymlinkEscape(t *testing.T) {
	if runtime.GOOS == "windows" {
		t.Skip("symlink privilege varies on Windows")
	}
	root := t.TempDir()
	outside := t.TempDir()
	target := filepath.Join(outside, "secret.txt")
	if err := os.WriteFile(target, []byte("secret"), 0o644); err != nil {
		t.Fatal(err)
	}
	link := filepath.Join(root, "escape.txt")
	if err := os.Symlink(target, link); err != nil {
		t.Fatal(err)
	}
	if _, err := normalizeContextPaths(root, []string{link}); err == nil {
		t.Fatal("expected symlink escape rejection")
	}
}

func TestCreateSessionWithContextPersistsRelativeHints(t *testing.T) {
	root := t.TempDir()
	if err := os.MkdirAll(filepath.Join(root, "src"), 0o755); err != nil {
		t.Fatal(err)
	}
	file := filepath.Join(root, "src", "main.go")
	if err := os.WriteFile(file, []byte("package main\n"), 0o644); err != nil {
		t.Fatal(err)
	}

	r := New()
	defer r.Close()
	if _, err := r.OpenWorkspace(context.Background(), root); err != nil {
		t.Fatal(err)
	}
	session, err := r.CreateSessionWithContext(context.Background(), "fix the bug", []string{file})
	if err != nil {
		t.Fatal(err)
	}

	var metadata map[string]any
	if err := json.Unmarshal(session.Metadata, &metadata); err != nil {
		t.Fatal(err)
	}
	rawPaths, ok := metadata["contextPaths"].([]any)
	if !ok || len(rawPaths) != 1 || rawPaths[0] != "src/main.go" {
		t.Fatalf("metadata=%#v", metadata)
	}

	messages, err := r.RecentMessages(context.Background(), session.ID, 10)
	if err != nil {
		t.Fatal(err)
	}
	if len(messages) != 1 {
		t.Fatalf("messages=%d", len(messages))
	}
	var payload map[string]any
	if err := json.Unmarshal(messages[0].JSON, &payload); err != nil {
		t.Fatal(err)
	}
	content, _ := payload["content"].(string)
	if !strings.Contains(content, "fix the bug") || !strings.Contains(content, "@src/main.go") {
		t.Fatalf("content=%q", content)
	}
}
