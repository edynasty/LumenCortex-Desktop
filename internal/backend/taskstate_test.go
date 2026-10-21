package backend

import (
	"context"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"testing"
	"time"

	lcx "github.com/edynasty/LumenCortex/runtime"
)

// gatedRun starts a run whose first step calls a shell tool that waits for the file "go" in the
// workspace, and answers every later request with "done". It returns once the tool has started, with
// the workspace, the session and the provider requests seen so far.
type gatedRun struct {
	r         *Runtime
	workspace string
	sessionID string
	mu        sync.Mutex
	requests  []string
}

func startGatedRun(t *testing.T) *gatedRun {
	t.Helper()
	g := &gatedRun{}
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		body, _ := io.ReadAll(req.Body)
		g.mu.Lock()
		g.requests = append(g.requests, string(body))
		n := len(g.requests)
		g.mu.Unlock()
		if n == 1 {
			replyToolCall(w, "wait-1", "shell", `{"command":"echo ready; while [ ! -f go ]; do sleep 0.05; done"}`)
			return
		}
		replyText(w, "done")
	}))
	t.Cleanup(server.Close)
	writeTestCatalog(t, useConfigDir(t), server.URL+"/v1", "test/a")

	ctx := context.Background()
	g.r = New()
	t.Cleanup(func() { g.r.Close() })
	g.workspace = t.TempDir()
	if _, err := g.r.OpenWorkspace(ctx, g.workspace); err != nil {
		t.Fatal(err)
	}
	session, err := g.r.CreateSession(ctx, "wait for the gate")
	if err != nil {
		t.Fatal(err)
	}
	g.sessionID = session.ID
	events, stop, _ := g.r.Events(256)
	defer stop()
	if _, err := g.r.StartAgent(ctx, session.ID, AgentConfig{Policy: "full", MaxSteps: 4}); err != nil {
		t.Fatal(err)
	}
	deadline := time.After(10 * time.Second)
	for ready := false; !ready; {
		select {
		case event := <-events:
			ready = event.Type == "tool.output" && strings.Contains(string(event.Data), "ready")
		case <-deadline:
			t.Fatal("the tool never started")
		}
	}
	return g
}

func (g *gatedRun) release(t *testing.T) {
	t.Helper()
	if err := os.WriteFile(filepath.Join(g.workspace, "go"), nil, 0o600); err != nil {
		t.Fatal(err)
	}
	waitIdle(t, g.r, context.Background())
}

// M3.3 acceptance (design §8.2): a reset during a run returns ErrRunHeld and changes nothing; after the
// run it moves the window start past every existing row.
func TestResetContextDuringRunReturnsRunHeld(t *testing.T) {
	g := startGatedRun(t)
	ctx := context.Background()
	before, err := g.r.TaskState(ctx, g.sessionID)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := g.r.ResetContext(ctx, g.sessionID); !errors.Is(err, ErrRunHeld) {
		t.Fatalf("reset during a run: err=%v, want ErrRunHeld", err)
	}
	if during, _ := g.r.TaskState(ctx, g.sessionID); during.State.WindowStartSeq != before.State.WindowStartSeq {
		t.Fatalf("a refused reset moved windowStartSeq %d -> %d", before.State.WindowStartSeq, during.State.WindowStartSeq)
	}
	g.release(t)

	rows, err := g.r.RecentMessages(ctx, g.sessionID, 50)
	if err != nil {
		t.Fatal(err)
	}
	info, err := g.r.ResetContext(ctx, g.sessionID)
	if err != nil {
		t.Fatal(err)
	}
	if want := rows[len(rows)-1].Seq + 1; info.State.WindowStartSeq != want {
		t.Fatalf("windowStartSeq after reset = %d, want %d", info.State.WindowStartSeq, want)
	}
}

// M3.3 acceptance (design §8.2): a brief edited while the run is active is visible in the run's next
// request, and is shown to the host at once, before any run applies it.
func TestBriefEditDuringRunReachesNextStep(t *testing.T) {
	g := startGatedRun(t)
	ctx := context.Background()
	const brief = "Prefer the smallest patch; keep the public API."
	info, err := g.r.SetTaskBrief(ctx, g.sessionID, brief)
	if err != nil {
		t.Fatal(err)
	}
	if info.State.Brief != brief || info.PendingEdits != 1 {
		t.Fatalf("host view during the run: brief=%q pending=%d", info.State.Brief, info.PendingEdits)
	}
	g.release(t)

	g.mu.Lock()
	requests := append([]string(nil), g.requests...)
	g.mu.Unlock()
	if len(requests) < 2 {
		t.Fatalf("requests=%d, want the step after the tool", len(requests))
	}
	if strings.Contains(requests[0], brief) {
		t.Fatal("the brief reached a request sent before it was edited")
	}
	if !strings.Contains(requests[1], brief) {
		t.Fatalf("the next step's request does not carry the brief: %s", requests[1])
	}
	after, err := g.r.TaskState(ctx, g.sessionID)
	if err != nil {
		t.Fatal(err)
	}
	if after.PendingEdits != 0 || after.State.Brief != brief || after.Version <= info.Version {
		t.Fatalf("after the run: %+v", after)
	}
}

// References and resolution round-trip through Core with the user's authority; invalid edits are
// refused before anything is queued.
func TestTaskReferencesAndResolution(t *testing.T) {
	useConfigDir(t)
	ctx := context.Background()
	r := New()
	defer r.Close()
	if _, err := r.OpenWorkspace(ctx, t.TempDir()); err != nil {
		t.Fatal(err)
	}
	session, err := r.CreateSession(ctx, "curate context")
	if err != nil {
		t.Fatal(err)
	}
	note := "entry point"
	info, err := r.EditTaskReference(ctx, session.ID, TaskReferenceEdit{Kind: "path", Target: "cmd/main.go", Note: &note, State: "included"})
	if err != nil {
		t.Fatal(err)
	}
	if len(info.State.References) != 1 || info.State.References[0].State != "included" || info.State.References[0].Note != note {
		t.Fatalf("after include: %+v", info.State.References)
	}
	info, err = r.EditTaskReference(ctx, session.ID, TaskReferenceEdit{Kind: "path", Target: "cmd/main.go", State: "excluded"})
	if err != nil {
		t.Fatal(err)
	}
	if got := info.State.References[0]; got.State != "excluded" || got.Note != note {
		t.Fatalf("exclude must keep the note: %+v", got)
	}
	info, err = r.EditTaskReference(ctx, session.ID, TaskReferenceEdit{Kind: "path", Target: "cmd/main.go", State: "removed"})
	if err != nil {
		t.Fatal(err)
	}
	if len(info.State.References) != 0 {
		t.Fatalf("after remove: %+v", info.State.References)
	}
	if _, err := r.EditTaskReference(ctx, session.ID, TaskReferenceEdit{Kind: "path", Target: "x", State: "suggested"}); err == nil {
		t.Fatal("the host may not write a suggested reference")
	}

	info, err = r.ResolveThread(ctx, session.ID, "done", "desktop-user")
	if err != nil {
		t.Fatal(err)
	}
	if got := info.State.Resolution; got.State != "done" || got.By != "user" || got.Actor != "desktop-user" {
		t.Fatalf("resolution %+v", got)
	}
	if _, err := r.ResolveThread(ctx, session.ID, "finished", "desktop-user"); err == nil {
		t.Fatal("an unknown resolution was accepted")
	}
	if info, _ = r.TaskState(ctx, session.ID); info.PendingEdits != 4 {
		t.Fatalf("pending edits %d, want the 4 accepted ones", info.PendingEdits)
	}
}

// The user's notes round-trip through Core as user notes; Core's text limit and the marker the UI
// matches for a full thread hold through the adapter.
func TestTaskNotes(t *testing.T) {
	useConfigDir(t)
	ctx := context.Background()
	r := New()
	defer r.Close()
	if _, err := r.OpenWorkspace(ctx, t.TempDir()); err != nil {
		t.Fatal(err)
	}
	session, err := r.CreateSession(ctx, "remember decisions")
	if err != nil {
		t.Fatal(err)
	}
	info, err := r.EditTaskNote(ctx, session.ID, TaskNoteEdit{Text: "  Staging host is stg-7.internal.  "})
	if err != nil {
		t.Fatal(err)
	}
	if len(info.State.Notes) != 1 || info.State.Notes[0].By != "user" || info.State.Notes[0].Text != "Staging host is stg-7.internal." {
		t.Fatalf("after add: %+v", info.State.Notes)
	}
	id := info.State.Notes[0].ID
	if info, err = r.EditTaskNote(ctx, session.ID, TaskNoteEdit{ID: id, Text: "Staging host is stg-8.internal."}); err != nil || info.State.Notes[0].Text != "Staging host is stg-8.internal." {
		t.Fatalf("after rewrite: %+v %v", info.State.Notes, err)
	}
	if info, err = r.EditTaskNote(ctx, session.ID, TaskNoteEdit{ID: id, Remove: true}); err != nil || len(info.State.Notes) != 0 {
		t.Fatalf("after remove: %+v %v", info.State.Notes, err)
	}
	if _, err := r.EditTaskNote(ctx, session.ID, TaskNoteEdit{Text: strings.Repeat("x", lcx.MaxThreadNoteBytes+1)}); err == nil {
		t.Fatal("an over-limit note was queued")
	}
	for i := 0; i < lcx.MaxThreadNotes; i++ {
		if _, err := r.EditTaskNote(ctx, session.ID, TaskNoteEdit{Text: "fact"}); err != nil {
			t.Fatal(err)
		}
	}
	_, err = r.EditTaskNote(ctx, session.ID, TaskNoteEdit{Text: "one too many"})
	if !errors.Is(err, lcx.ErrTooManyNotes) {
		t.Fatalf("full thread: %v", err)
	}
}
