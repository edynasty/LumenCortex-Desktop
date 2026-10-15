package backend

import (
	"context"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"os/exec"
	"path/filepath"
	"slices"
	"strings"
	"testing"
	"time"

	lcx "github.com/edynasty/LumenCortex/runtime"
)

// The Desktop adapter over Core's worktree cleanup (ADR-0005): refusals arrive as
// structured outcomes with Core's fresh inspection, successes as Core's results.

func gitIn(t *testing.T, dir string, args ...string) string {
	t.Helper()
	cmd := exec.Command("git", args...)
	cmd.Dir = dir
	out, err := cmd.CombinedOutput()
	if err != nil {
		t.Fatalf("git %v in %s: %v: %s", args, dir, err, out)
	}
	return strings.TrimSpace(string(out))
}

func commitFile(t *testing.T, dir, name, content string) {
	t.Helper()
	writeFile(t, filepath.Join(dir, name), content)
	gitIn(t, dir, "add", name)
	gitIn(t, dir, "commit", "-m", "add "+name)
}

func hasBranch(root, branch string) bool {
	cmd := exec.Command("git", "rev-parse", "--verify", "--quiet", "refs/heads/"+branch)
	cmd.Dir = root
	return cmd.Run() == nil
}

func exists(path string) bool {
	_, err := os.Stat(path)
	return err == nil
}

func (r *Runtime) isActive(t *testing.T, sessionID string) bool {
	t.Helper()
	state, err := r.State(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	for _, run := range state.ActiveRuns {
		if run.SessionID == sessionID {
			return true
		}
	}
	return false
}

func worktreeRuntime(t *testing.T) (*Runtime, string) {
	t.Helper()
	root := setupGitWorkspace(t)
	commitFile(t, root, ".gitignore", ".env\nnode_modules/\n")
	r := New()
	t.Cleanup(func() { _ = r.Close() })
	if _, err := r.OpenWorkspace(context.Background(), root); err != nil {
		t.Fatal(err)
	}
	return r, root
}

func worktreeSession(t *testing.T, r *Runtime, goal string) (Session, SessionRuntime) {
	t.Helper()
	session, err := r.CreateSessionWithRuntime(context.Background(), goal, nil, RuntimeWorktree, "HEAD")
	if err != nil {
		t.Fatal(err)
	}
	identity, err := r.SessionRuntime(context.Background(), session.ID)
	if err != nil {
		t.Fatal(err)
	}
	return session, identity
}

func inspected(t *testing.T, r *Runtime, sessionID string) WorktreeCleanup {
	t.Helper()
	in, err := r.InspectSessionWorktree(context.Background(), sessionID)
	if err != nil {
		t.Fatal(err)
	}
	return WorktreeCleanup{Discard: &WorktreeDiscard{ExpectHead: in.Head, ExpectStatusDigest: in.StatusDigest}}
}

func discardInspected(t *testing.T, r *Runtime, sessionID string) WorktreeCleanupResult {
	t.Helper()
	outcome, err := r.RemoveSessionWorktree(context.Background(), sessionID, inspected(t, r, sessionID))
	if err != nil || outcome.Result == nil {
		t.Fatalf("discard: outcome=%+v err=%v", outcome, err)
	}
	return *outcome.Result
}

func refused(t *testing.T, outcome WorktreeCleanupOutcome, err error, code string) *WorktreeRefusal {
	t.Helper()
	if err != nil || outcome.Result != nil || outcome.Refusal == nil || outcome.Refusal.Code != code {
		t.Fatalf("outcome=%+v err=%v, want refusal %q", outcome, err, code)
	}
	return outcome.Refusal
}

func TestWorktreeCleanupOutcomes(t *testing.T) {
	ctx := context.Background()
	// The provider is never contacted: the only Start below fails on the missing worktree.
	writeTestCatalog(t, useConfigDir(t), "http://127.0.0.1:1/v1", "test/a")
	r, root := worktreeRuntime(t)

	t.Run("clean worktree is removed", func(t *testing.T) {
		session, identity := worktreeSession(t, r, "clean")
		outcome, err := r.RemoveSessionWorktree(ctx, session.ID, WorktreeCleanup{})
		if err != nil || outcome.Result == nil || outcome.Result.Action != "removed" || !outcome.Result.BranchDeleted {
			t.Fatalf("outcome=%+v err=%v", outcome, err)
		}
		if exists(identity.Path) || hasBranch(root, identity.Branch) {
			t.Fatal("the clean worktree was not removed")
		}
		if after, _ := r.SessionRuntime(ctx, session.ID); after.Kind != RuntimeLocal {
			t.Fatalf("the session is still bound: %+v", after)
		}
	})

	t.Run("dirty refuses, keep branch refuses, inspected discard removes", func(t *testing.T) {
		session, identity := worktreeSession(t, r, "dirty")
		writeFile(t, filepath.Join(identity.Path, "draft.txt"), "unsaved\n")
		outcome, err := r.RemoveSessionWorktree(ctx, session.ID, WorktreeCleanup{})
		refusal := refused(t, outcome, err, WorktreeRefusalDirty)
		if refusal.Inspection == nil || !slices.Equal(refusal.Inspection.DirtyFiles, []string{"draft.txt"}) {
			t.Fatalf("refusal inspection=%+v", refusal.Inspection)
		}
		outcome, err = r.RemoveSessionWorktree(ctx, session.ID, WorktreeCleanup{KeepBranch: true})
		refused(t, outcome, err, WorktreeRefusalDirty)
		if !exists(filepath.Join(identity.Path, "draft.txt")) {
			t.Fatal("a refusal deleted the unsaved file")
		}
		if result := discardInspected(t, r, session.ID); !result.Discarded || exists(identity.Path) {
			t.Fatalf("discard result=%+v", result)
		}
	})

	t.Run("a discard of changed work is stale", func(t *testing.T) {
		session, identity := worktreeSession(t, r, "stale")
		writeFile(t, filepath.Join(identity.Path, "draft.txt"), "first\n")
		confirmed := inspected(t, r, session.ID)
		writeFile(t, filepath.Join(identity.Path, "draft.txt"), "first, then more work\n")
		outcome, err := r.RemoveSessionWorktree(ctx, session.ID, confirmed)
		refusal := refused(t, outcome, err, WorktreeRefusalStale)
		if refusal.Inspection == nil || refusal.Inspection.StatusDigest == confirmed.Discard.ExpectStatusDigest {
			t.Fatalf("a stale refusal must carry the fresh state: %+v", refusal.Inspection)
		}
		if body := readFile(t, filepath.Join(identity.Path, "draft.txt")); body != "first, then more work\n" {
			t.Fatal("a stale discard destroyed the newer edit")
		}
		discardInspected(t, r, session.ID)
	})

	t.Run("unapplied commits refuse; keep branch keeps them", func(t *testing.T) {
		session, identity := worktreeSession(t, r, "commits")
		commitFile(t, identity.Path, "feature.txt", "feature\n")
		outcome, err := r.RemoveSessionWorktree(ctx, session.ID, WorktreeCleanup{})
		refusal := refused(t, outcome, err, WorktreeRefusalUnapplied)
		if refusal.Inspection == nil || len(refusal.Inspection.UnappliedCommits) != 1 {
			t.Fatalf("refusal inspection=%+v", refusal.Inspection)
		}
		outcome, err = r.RemoveSessionWorktree(ctx, session.ID, WorktreeCleanup{KeepBranch: true})
		if err != nil || outcome.Result == nil || !outcome.Result.BranchKept || !outcome.Result.DirectoryRemoved {
			t.Fatalf("keep branch: outcome=%+v err=%v", outcome, err)
		}
		if exists(identity.Path) || !hasBranch(root, identity.Branch) {
			t.Fatal("KeepBranch must remove the directory and keep the branch")
		}
	})

	t.Run("ignored local files refuse the default", func(t *testing.T) {
		session, identity := worktreeSession(t, r, "ignored")
		writeFile(t, filepath.Join(identity.Path, ".env"), "TOKEN=local\n")
		outcome, err := r.RemoveSessionWorktree(ctx, session.ID, WorktreeCleanup{})
		refusal := refused(t, outcome, err, WorktreeRefusalIgnored)
		if refusal.Inspection == nil || !slices.Equal(refusal.Inspection.IgnoredFiles, []string{".env"}) {
			t.Fatalf("refusal inspection=%+v", refusal.Inspection)
		}
		if !exists(filepath.Join(identity.Path, ".env")) {
			t.Fatal("the default deleted an ignored .env")
		}
		if result := discardInspected(t, r, session.ID); !slices.Equal(result.IgnoredFiles, []string{".env"}) {
			t.Fatalf("result=%+v", result)
		}
	})

	t.Run("uncertain ownership is retained only", func(t *testing.T) {
		session, identity := worktreeSession(t, r, "switched")
		gitIn(t, identity.Path, "checkout", "-q", "-b", "elsewhere")
		outcome, err := r.RemoveSessionWorktree(ctx, session.ID, inspected(t, r, session.ID))
		refused(t, outcome, err, WorktreeRefusalOwnership)
		outcome, err = r.RemoveSessionWorktree(ctx, session.ID, WorktreeCleanup{KeepBranch: true})
		if err != nil || outcome.Result == nil || outcome.Result.Action != "retained" || !exists(identity.Path) {
			t.Fatalf("retain: outcome=%+v err=%v", outcome, err)
		}
	})

	t.Run("missing directory is diagnosed and detachable", func(t *testing.T) {
		session, identity := worktreeSession(t, r, "missing")
		if err := os.RemoveAll(identity.Path); err != nil {
			t.Fatal(err)
		}
		in, err := r.InspectSessionWorktree(ctx, session.ID)
		if err != nil || in.Exists || !in.BranchExists {
			t.Fatalf("inspection=%+v err=%v", in, err)
		}
		_, err = r.StartAgent(ctx, session.ID, AgentConfig{Policy: "read-only", MaxSteps: 1})
		if !errors.Is(err, lcx.ErrWorktreeMissing) {
			t.Fatalf("Start on a missing worktree: err=%v, want ErrWorktreeMissing", err)
		}
		outcome, err := r.RemoveSessionWorktree(ctx, session.ID, WorktreeCleanup{})
		if err != nil || outcome.Result == nil || outcome.Result.Action != "removed" {
			t.Fatalf("detach: outcome=%+v err=%v", outcome, err)
		}
		if hasBranch(root, identity.Branch) {
			t.Fatal("the branch of a fully applied missing worktree was kept")
		}
	})

	t.Run("delete session is a different operation", func(t *testing.T) {
		session, identity := worktreeSession(t, r, "delete me")
		writeFile(t, filepath.Join(identity.Path, "draft.txt"), "unsaved\n")
		outcome, err := r.DeleteSession(ctx, session.ID, WorktreeCleanup{})
		if err != nil || outcome.Refusal == nil || outcome.Refusal.Code != WorktreeRefusalDirty {
			t.Fatalf("delete of a dirty session: outcome=%+v err=%v", outcome, err)
		}
		if _, err := r.GetSession(ctx, session.ID); err != nil {
			t.Fatalf("a refused deletion removed the session: %v", err)
		}
		outcome, err = r.DeleteSession(ctx, session.ID, inspected(t, r, session.ID))
		if err != nil || outcome.Result == nil || !outcome.Result.Worktree.DirectoryRemoved {
			t.Fatalf("delete: outcome=%+v err=%v", outcome, err)
		}
		state, err := r.State(ctx)
		if err != nil {
			t.Fatal(err)
		}
		for _, s := range state.Sessions {
			if s.ID == session.ID {
				t.Fatal("the deleted session is still listed")
			}
		}
	})
}

// A worktree session spawns a read-only subagent, which borrows the worktree. While
// the parent runs: runHeld. After the parent ends while the child still runs: the
// child's lease makes the owner's removal busy, and deletion lists the child as a
// running dependent. The borrower can never discard. Once the child ends, deleting
// the parent deletes the finished child with it.
func TestBorrowerAndDependentsThroughDesktop(t *testing.T) {
	parentWaiting := make(chan struct{})
	releaseParent := make(chan struct{})
	releaseChild := make(chan struct{})
	childStarted := make(chan struct{})
	var parentOnce, childOnce = make(chan struct{}, 1), make(chan struct{}, 1)
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		body, _ := io.ReadAll(req.Body)
		switch {
		case strings.Contains(string(body), "read-only LumenCortex subagent"):
			select {
			case childOnce <- struct{}{}:
				close(childStarted)
			default:
			}
			select {
			case <-releaseChild:
			case <-req.Context().Done():
				return
			}
			replyText(w, "child finding")
		case strings.Contains(string(body), `"role":"tool"`):
			select {
			case parentOnce <- struct{}{}:
				close(parentWaiting)
			default:
			}
			select {
			case <-releaseParent:
			case <-req.Context().Done():
				return
			}
			replyText(w, "parent answered")
		default:
			replyToolCall(w, "spawn-1", "spawn_subagent", `{"goal":"look around"}`)
		}
	}))
	defer server.Close()
	writeTestCatalog(t, useConfigDir(t), server.URL+"/v1", "test/a")

	ctx := context.Background()
	r, _ := worktreeRuntime(t)
	parent, identity := worktreeSession(t, r, "parent")
	if _, err := r.StartAgent(ctx, parent.ID, AgentConfig{Policy: "full", MaxSteps: 4}); err != nil {
		t.Fatal(err)
	}
	waitFor(t, parentWaiting, "the parent's second model call")
	waitFor(t, childStarted, "the child's first model call")

	outcome, err := r.RemoveSessionWorktree(ctx, parent.ID, WorktreeCleanup{})
	refused(t, outcome, err, WorktreeRefusalRunHeld)

	close(releaseParent)
	waitUntil(t, "the parent's run to end", func() bool { return !r.isActive(t, parent.ID) })

	tree, err := r.SubagentTree(ctx, parent.ID)
	if err != nil || len(tree) != 1 {
		t.Fatalf("subagent tree=%+v err=%v", tree, err)
	}
	child := tree[0].SessionID
	childRuntime, err := r.InspectSessionWorktree(ctx, child)
	if err != nil || childRuntime.Role != lcx.WorktreeBorrower || childRuntime.Owner != parent.ID || childRuntime.Path != identity.Path {
		t.Fatalf("child inspection=%+v err=%v", childRuntime, err)
	}

	outcome, err = r.RemoveSessionWorktree(ctx, parent.ID, WorktreeCleanup{})
	refused(t, outcome, err, WorktreeRefusalBusy)
	if _, err := r.ApplySessionWorktree(ctx, parent.ID); !errors.Is(err, lcx.ErrWorktreeBusy) {
		t.Fatalf("apply while the borrower runs: err=%v, want ErrWorktreeBusy", err)
	}
	deleted, err := r.DeleteSession(ctx, parent.ID, WorktreeCleanup{})
	if err != nil || deleted.Refusal == nil || deleted.Refusal.Code != WorktreeRefusalDependents ||
		len(deleted.Refusal.Dependents) != 1 || deleted.Refusal.Dependents[0].SessionID != child || deleted.Refusal.Dependents[0].Reason != "running" {
		t.Fatalf("delete while the child runs: outcome=%+v err=%v", deleted, err)
	}

	close(releaseChild)
	waitUntil(t, "the child's run to end", func() bool { return !r.isActive(t, child) })
	outcome, err = r.RemoveSessionWorktree(ctx, child, inspected(t, r, child))
	refused(t, outcome, err, WorktreeRefusalBorrowed)

	deleted, err = r.DeleteSession(ctx, parent.ID, WorktreeCleanup{})
	if err != nil || deleted.Result == nil || !slices.Equal(deleted.Result.DeletedChildren, []string{child}) || !deleted.Result.Worktree.DirectoryRemoved {
		t.Fatalf("delete after the child ended: outcome=%+v err=%v", deleted, err)
	}
	if exists(identity.Path) {
		t.Fatal("the parent's worktree survived its deletion")
	}
}

func waitFor(t *testing.T, ch <-chan struct{}, what string) {
	t.Helper()
	select {
	case <-ch:
	case <-time.After(15 * time.Second):
		t.Fatalf("timed out waiting for %s", what)
	}
}

func waitUntil(t *testing.T, what string, done func() bool) {
	t.Helper()
	deadline := time.Now().Add(15 * time.Second)
	for !done() {
		if time.Now().After(deadline) {
			t.Fatalf("timed out waiting for %s", what)
		}
		time.Sleep(10 * time.Millisecond)
	}
}
