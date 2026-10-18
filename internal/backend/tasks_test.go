package backend

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	lcx "github.com/edynasty/LumenCortex/runtime"
	"github.com/edynasty/LumenCortex/protocol"
)

const taskObjective = "Write ok.txt in the task worktree"

// taskProvider answers the parent thread and its execution child. The child is the request that
// offers write_file (the parent runs read-only); the parent proposes one task on its first request.
type taskProvider struct {
	mu            sync.Mutex
	parentTools   [][]string
	childRequests atomic.Int32
	// childBlock, when set, holds the child's first request until the request is cancelled.
	childBlock bool
}

func (p *taskProvider) serve(w http.ResponseWriter, req *http.Request) {
	body, _ := io.ReadAll(req.Body)
	var request struct {
		Tools []struct {
			Function struct {
				Name string `json:"name"`
			} `json:"function"`
		} `json:"tools"`
	}
	_ = json.Unmarshal(body, &request)
	var tools []string
	for _, tool := range request.Tools {
		tools = append(tools, tool.Function.Name)
	}
	if containsString(tools, "write_file") {
		n := p.childRequests.Add(1)
		if p.childBlock {
			<-req.Context().Done()
			return
		}
		switch n {
		case 1:
			replyToolCall(w, "w", "write_file", `{"path":"ok.txt","content":"ok\n"}`)
		case 2:
			replyToolCall(w, "u", "work_unit_update", `{"id":"task","status":"completed","summary":"wrote ok.txt"}`)
		default:
			replyText(w, "ok.txt written")
		}
		return
	}
	p.mu.Lock()
	p.parentTools = append(p.parentTools, tools)
	first := len(p.parentTools) == 1
	p.mu.Unlock()
	if first && containsString(tools, "start_task") {
		replyToolCall(w, "t", "start_task", `{"objective":"`+taskObjective+`"}`)
		return
	}
	replyText(w, "noted")
}

func (p *taskProvider) toolsOf(request int) []string {
	p.mu.Lock()
	defer p.mu.Unlock()
	if request >= len(p.parentTools) {
		return nil
	}
	return p.parentTools[request]
}

func containsString(values []string, want string) bool {
	for _, v := range values {
		if v == want {
			return true
		}
	}
	return false
}

func waitSessionsIdle(t *testing.T, r *Runtime, ids ...string) {
	t.Helper()
	deadline := time.Now().Add(15 * time.Second)
	for _, id := range ids {
		for r.supervisor.Active(id) {
			if time.Now().After(deadline) {
				t.Fatalf("session %s is still running", id)
			}
			time.Sleep(10 * time.Millisecond)
		}
	}
}

// C3 (ADR-0006 D4) through the Desktop adapter: the thread's grant reaches Core as the user set it.
// none offers no start_task; propose records a proposal and starts nothing; the user's
// StartProposedTask starts exactly that proposal once, as an execution child in its own worktree; the
// child's result reaches the parent as one task_result row at the parent's next turn.
func TestDelegationGrantProposalStartAndDelivery(t *testing.T) {
	workspace := setupGitWorkspace(t)
	provider := &taskProvider{}
	r := openChecksWorkspace(t, workspace, provider.serve)
	ctx := context.Background()
	session, err := r.CreateSession(ctx, "discuss a change")
	if err != nil {
		t.Fatal(err)
	}

	// none: no start_task, no proposal.
	if _, err := r.StartAgent(ctx, session.ID, AgentConfig{Policy: "read-only", MaxSteps: 4}); err != nil {
		t.Fatal(err)
	}
	waitSessionsIdle(t, r, session.ID)
	if containsString(provider.toolsOf(0), "start_task") {
		t.Fatalf("start_task offered without a grant: %v", provider.toolsOf(0))
	}

	// An unknown grant is refused before the run starts or writes anything.
	if _, err := r.ContinueAgent(ctx, session.ID, "go on", AgentConfig{Policy: "read-only", Delegation: "full"}); err == nil {
		t.Fatal("an unknown grant was accepted")
	}

	// propose: the parent's first propose turn records the proposal and starts nothing.
	provider.mu.Lock()
	provider.parentTools = nil
	provider.mu.Unlock()
	if _, err := r.ContinueAgent(ctx, session.ID, "please make the change", AgentConfig{Policy: "read-only", MaxSteps: 4, Delegation: "propose"}); err != nil {
		t.Fatal(err)
	}
	waitSessionsIdle(t, r, session.ID)
	if !containsString(provider.toolsOf(0), "start_task") {
		t.Fatalf("start_task not offered under propose: %v", provider.toolsOf(0))
	}
	info, err := r.TaskState(ctx, session.ID)
	if err != nil {
		t.Fatal(err)
	}
	if len(info.State.Tasks) != 1 || info.State.Tasks[0].State != "proposed" || info.State.Tasks[0].SessionID != "" {
		t.Fatalf("tasks after a propose turn = %+v", info.State.Tasks)
	}
	if tree, err := r.SubagentTree(ctx, session.ID); err != nil || len(tree) != 0 {
		t.Fatalf("a proposal started a child: %+v %v", tree, err)
	}
	proposal := info.State.Tasks[0]

	// An unknown proposal is refused; the user's Start starts exactly the proposal.
	if _, err := r.StartProposedTask(ctx, session.ID, "nope"); !errors.Is(err, lcx.ErrTaskProposalNotFound) {
		t.Fatalf("unknown proposal: %v", err)
	}
	started, err := r.StartProposedTask(ctx, session.ID, proposal.ID)
	if err != nil {
		t.Fatal(err)
	}
	if started.TaskID != proposal.ID || started.ParentSessionID != session.ID || started.Runtime.Kind != "worktree" {
		t.Fatalf("started = %+v", started)
	}
	// A second Start of the same proposal is refused and starts nothing.
	if _, err := r.StartProposedTask(ctx, session.ID, proposal.ID); !errors.Is(err, lcx.ErrTaskProposalStarted) {
		t.Fatalf("duplicate start: %v", err)
	}
	waitSessionsIdle(t, r, started.SessionID)
	tree, err := r.SubagentTree(ctx, session.ID)
	if err != nil || len(tree) != 1 || tree[0].Kind != "execution" || tree[0].SessionID != started.SessionID || tree[0].Status != "completed" {
		t.Fatalf("tree = %+v %v", tree, err)
	}
	// The child wrote in its own worktree, never in the main checkout.
	if _, err := os.Stat(filepath.Join(workspace, "ok.txt")); !os.IsNotExist(err) {
		t.Fatalf("the child wrote to the main checkout: %v", err)
	}
	if _, err := os.Stat(filepath.Join(started.Runtime.Path, "ok.txt")); err != nil {
		t.Fatalf("the child's write is missing from its worktree: %v", err)
	}
	// A finished child keeps nothing open, so the parent is not held by a "tasks" obligation.
	if info, err = r.TaskState(ctx, session.ID); err != nil || containsString(info.Obligations, "tasks") {
		t.Fatalf("obligations after the child finished: %v %v", info.Obligations, err)
	}

	// The parent's next turn receives the result once, as a task_result row.
	if _, err := r.ContinueAgent(ctx, session.ID, "how did it go?", AgentConfig{Policy: "read-only", MaxSteps: 4, Delegation: "propose"}); err != nil {
		t.Fatal(err)
	}
	waitSessionsIdle(t, r, session.ID)
	if _, err := r.ContinueAgent(ctx, session.ID, "thanks", AgentConfig{Policy: "read-only", MaxSteps: 4}); err != nil {
		t.Fatal(err)
	}
	waitSessionsIdle(t, r, session.ID)
	page, err := r.MessagePage(ctx, session.ID, -1, 200)
	if err != nil {
		t.Fatal(err)
	}
	var results []lcx.TaskResult
	for _, m := range page.Messages {
		var row protocol.Message
		if err := json.Unmarshal(m.JSON, &row); err != nil {
			t.Fatal(err)
		}
		if row.Origin != protocol.OriginTaskResult {
			continue
		}
		_, raw, _ := strings.Cut(row.Content, "\n")
		var result lcx.TaskResult
		if err := json.Unmarshal([]byte(raw), &result); err != nil {
			t.Fatal(err)
		}
		results = append(results, result)
	}
	if len(results) != 1 || results[0].TaskID != proposal.ID || results[0].Status != "completed" || results[0].Handoff == nil || results[0].Handoff.DirtyCount == 0 {
		t.Fatalf("task results = %+v", results)
	}
}

// Stop through the adapter is Core's CancelSubtree: it stops a running execution child that the
// parent's own Cancel does not reach, and reports the ids it cancelled.
func TestCancelSubtreeStopsARunningTask(t *testing.T) {
	workspace := setupGitWorkspace(t)
	provider := &taskProvider{childBlock: true}
	r := openChecksWorkspace(t, workspace, provider.serve)
	ctx := context.Background()
	session, err := r.CreateSession(ctx, "discuss a change")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := r.StartAgent(ctx, session.ID, AgentConfig{Policy: "read-only", MaxSteps: 4, Delegation: "propose"}); err != nil {
		t.Fatal(err)
	}
	waitSessionsIdle(t, r, session.ID)
	info, err := r.TaskState(ctx, session.ID)
	if err != nil || len(info.State.Tasks) != 1 {
		t.Fatalf("tasks = %+v %v", info.State.Tasks, err)
	}
	started, err := r.StartProposedTask(ctx, session.ID, info.State.Tasks[0].ID)
	if err != nil {
		t.Fatal(err)
	}
	deadline := time.Now().Add(10 * time.Second)
	for provider.childRequests.Load() == 0 {
		if time.Now().After(deadline) {
			t.Fatal("the child never asked the model")
		}
		time.Sleep(10 * time.Millisecond)
	}
	if info, err = r.TaskState(ctx, session.ID); err != nil || !containsString(info.Obligations, "tasks") || info.ReadyForReview {
		t.Fatalf("parent while its task runs: obligations=%v ready=%v err=%v", info.Obligations, info.ReadyForReview, err)
	}
	// The idle parent is not running; its Stop still reaches the task it started.
	if !r.supervisor.Active(started.SessionID) {
		t.Fatal("the task is not running")
	}
	cancelled, err := r.CancelSubtree(ctx, session.ID)
	if err != nil || !containsString(cancelled, started.SessionID) {
		t.Fatalf("CancelSubtree = %v, %v", cancelled, err)
	}
	waitSessionsIdle(t, r, started.SessionID)
	child, err := r.GetSession(ctx, started.SessionID)
	if err != nil || child.Status != "interrupted" {
		t.Fatalf("child after Stop: %+v %v", child, err)
	}
	// The stopped task no longer keeps the parent open as a task, and the parent is not done.
	if info, err = r.TaskState(ctx, session.ID); err != nil || containsString(info.Obligations, "tasks") || info.State.Resolution.State != "open" {
		t.Fatalf("parent after Stop: obligations=%v resolution=%+v err=%v", info.Obligations, info.State.Resolution, err)
	}
	// Nothing is left to stop.
	if cancelled, err = r.CancelSubtree(ctx, session.ID); err != nil || len(cancelled) != 0 {
		t.Fatalf("second Stop = %v, %v", cancelled, err)
	}
}
