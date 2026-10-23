package main

import (
	"context"
	"path/filepath"
	"testing"
)

// The inspector's shell starts in the workspace and nowhere else: a cwd outside it (a relative
// escape or an absolute path) is refused before any pty exists.
func TestTerminalStartConfinesToTheWorkspace(t *testing.T) {
	root := t.TempDir()
	app := NewApp()
	app.terminals.shell = "/bin/sh"
	if _, err := app.OpenWorkspace(root); err != nil {
		t.Fatal(err)
	}
	defer app.shutdown(context.Background())

	for _, cwd := range []string{"..", filepath.Dir(root), "/etc", "missing-dir"} {
		if _, err := app.TerminalStart(cwd, 80, 24); err == nil {
			t.Fatalf("TerminalStart(%q) should be refused", cwd)
		}
	}
	id, err := app.TerminalStart("", 80, 24)
	if err != nil {
		t.Fatal(err)
	}
	if err := app.TerminalResize(id, 100, 30); err != nil {
		t.Fatal(err)
	}
	if err := app.TerminalWrite(id, "echo ready\n"); err != nil {
		t.Fatal(err)
	}
	if err := app.TerminalClose(id); err != nil {
		t.Fatal(err)
	}
}

func TestTerminalStartNeedsAWorkspace(t *testing.T) {
	app := NewApp()
	if _, err := app.TerminalStart("", 80, 24); err == nil {
		t.Fatal("a terminal without a workspace should be refused")
	}
}
