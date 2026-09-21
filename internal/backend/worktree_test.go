package backend

import (
	"context"
	"os"
	"os/exec"
	"path/filepath"
	"testing"
)

func setupGitWorkspace(t *testing.T) string {
	t.Helper()
	if _, err := exec.LookPath("git"); err != nil {
		t.Skip("git not installed")
	}
	root := t.TempDir()
	run := func(args ...string) {
		cmd := exec.Command("git", args...)
		cmd.Dir = root
		if out, err := cmd.CombinedOutput(); err != nil {
			t.Fatalf("git %v: %v: %s", args, err, out)
		}
	}
	run("init")
	run("config", "user.email", "test@example.com")
	run("config", "user.name", "Test")
	if err := os.WriteFile(filepath.Join(root, "README.md"), []byte("base\n"), 0o644); err != nil {
		t.Fatal(err)
	}
	run("add", "README.md")
	run("commit", "-m", "initial")
	return root
}

func TestDesktopWorktreeRuntimeLifecycle(t *testing.T) {
	root := setupGitWorkspace(t)
	r := New()
	defer r.Close()

	if _, err := r.OpenWorkspace(context.Background(), root); err != nil {
		t.Fatal(err)
	}
	session, err := r.CreateSessionWithRuntime(context.Background(), "isolated task", nil, RuntimeWorktree, "HEAD")
	if err != nil {
		t.Fatal(err)
	}
	identity, err := r.SessionRuntime(context.Background(), session.ID)
	if err != nil {
		t.Fatal(err)
	}
	if identity.Kind != RuntimeWorktree || identity.Path == "" || identity.Branch == "" {
		t.Fatalf("runtime=%#v", identity)
	}
	if identity.Path == root {
		t.Fatalf("worktree path must differ from main workspace")
	}

	if err := os.WriteFile(filepath.Join(identity.Path, "README.md"), []byte("changed\n"), 0o644); err != nil {
		t.Fatal(err)
	}
	status, err := r.SessionGitStatus(context.Background(), session.ID)
	if err != nil {
		t.Fatal(err)
	}
	if len(status.Files) == 0 {
		t.Fatal("expected session worktree changes")
	}
	mainStatus, err := r.GitStatus(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	if len(mainStatus.Files) != 0 {
		t.Fatalf("main workspace should stay clean: %#v", mainStatus.Files)
	}

	if err := r.RemoveSessionWorktree(context.Background(), session.ID, false); err == nil {
		t.Fatal("safe cleanup should reject a dirty worktree")
	}
	if err := r.RemoveSessionWorktree(context.Background(), session.ID, true); err != nil {
		t.Fatal(err)
	}
	after, err := r.SessionRuntime(context.Background(), session.ID)
	if err != nil {
		t.Fatal(err)
	}
	if after.Kind != RuntimeLocal || after.Path != root {
		t.Fatalf("runtime after cleanup=%#v", after)
	}
}
