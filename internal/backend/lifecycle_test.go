package backend

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"
)

type wireMessage struct {
	Role       string `json:"role"`
	Content    string `json:"content"`
	ToolCallID string `json:"tool_call_id"`
	ToolCalls  []struct {
		ID string `json:"id"`
	} `json:"tool_calls"`
	Origin string `json:"origin"`
}

func decodeRows(t *testing.T, rows []Message) []wireMessage {
	t.Helper()
	out := make([]wireMessage, 0, len(rows))
	for _, row := range rows {
		var m wireMessage
		if err := json.Unmarshal(row.JSON, &m); err != nil {
			t.Fatal(err)
		}
		out = append(out, m)
	}
	return out
}

func waitIdle(t *testing.T, r *Runtime, ctx context.Context) {
	t.Helper()
	deadline := time.Now().Add(10 * time.Second)
	for time.Now().Before(deadline) {
		state, err := r.State(ctx)
		if err != nil {
			t.Fatal(err)
		}
		if len(state.ActiveRuns) == 0 {
			return
		}
		time.Sleep(10 * time.Millisecond)
	}
	t.Fatal("run did not stop")
}

// F8 end to end: cancel during a tool, then ContinueAgent. Core reconciles the
// stranded call under the run lock before appending the follow-up, so the
// transcript is paired and the model never sees an unanswered tool call.
func TestContinueAgentAfterCancelledToolLeavesPairedTranscript(t *testing.T) {
	var mu sync.Mutex
	var requests [][]byte
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		body, _ := io.ReadAll(req.Body)
		mu.Lock()
		requests = append(requests, body)
		n := len(requests)
		mu.Unlock()
		if n == 1 {
			replyToolCall(w, "sleep-1", "shell", `{"command":"echo ready && exec sleep 5"}`)
			return
		}
		replyText(w, "resumed")
	}))
	defer server.Close()
	writeTestCatalog(t, useConfigDir(t), server.URL+"/v1", "test/a")

	ctx := context.Background()
	r := New()
	defer r.Close()
	if _, err := r.OpenWorkspace(ctx, t.TempDir()); err != nil {
		t.Fatal(err)
	}
	session, err := r.CreateSession(ctx, "run a slow command")
	if err != nil {
		t.Fatal(err)
	}
	events, stop, _ := r.Events(256)
	defer stop()
	cfg := AgentConfig{Policy: "full", MaxSteps: 4}
	if _, err := r.StartAgent(ctx, session.ID, cfg); err != nil {
		t.Fatal(err)
	}
	deadline := time.After(10 * time.Second)
	for ready := false; !ready; {
		select {
		case event := <-events:
			ready = event.Type == "tool.output" && strings.Contains(string(event.Data), "ready")
		case <-deadline:
			t.Fatal("the tool never produced output")
		}
	}
	if !r.CancelAgent(session.ID) {
		t.Fatal("cancel reported no active run")
	}
	waitIdle(t, r, ctx)

	if _, err := r.ContinueAgent(ctx, session.ID, "now check the result", cfg); err != nil {
		t.Fatal(err)
	}
	waitIdle(t, r, ctx)

	rows, err := r.RecentMessages(ctx, session.ID, 20)
	if err != nil {
		t.Fatal(err)
	}
	got := decodeRows(t, rows)
	roles := make([]string, len(got))
	for i, m := range got {
		roles[i] = m.Role
	}
	if want := "user,assistant,tool,user,assistant"; strings.Join(roles, ",") != want {
		t.Fatalf("roles = %v, want %s", roles, want)
	}
	if got[2].ToolCallID != "sleep-1" || got[2].Origin != "tool_interrupted" {
		t.Fatalf("tool row = %+v, want runtime result for sleep-1 with origin tool_interrupted", got[2])
	}
	if got[3].Content != "now check the result" || got[3].Origin != "" {
		t.Fatalf("follow-up row = %+v", got[3])
	}

	mu.Lock()
	second := string(requests[len(requests)-1])
	mu.Unlock()
	if strings.Contains(second, `"origin"`) {
		t.Fatalf("origin reached the provider wire: %s", second)
	}
	if strings.Index(second, `"tool_call_id":"sleep-1"`) < 0 || strings.Index(second, `"tool_call_id":"sleep-1"`) > strings.Index(second, "now check the result") {
		t.Fatalf("provider request does not pair the call before the follow-up: %s", second)
	}
}

// A session another Engine owns stays running, Start reports ErrRunHeld, and
// opening a workspace never rewrites a held run to interrupted.
func TestRunHeldElsewhereIsNotRecovered(t *testing.T) {
	started := make(chan struct{})
	release := make(chan struct{})
	var once sync.Once
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		once.Do(func() { close(started) })
		select {
		case <-release:
		case <-req.Context().Done():
		}
		http.Error(w, "released", http.StatusGatewayTimeout)
	}))
	defer server.Close()
	defer close(release)
	writeTestCatalog(t, useConfigDir(t), server.URL+"/v1", "test/a")

	ctx := context.Background()
	workspace := t.TempDir()
	owner := New()
	defer owner.Close()
	if _, err := owner.OpenWorkspace(ctx, workspace); err != nil {
		t.Fatal(err)
	}
	session, err := owner.CreateSession(ctx, "held run")
	if err != nil {
		t.Fatal(err)
	}
	cfg := AgentConfig{Policy: "read-only"}
	if _, err := owner.StartAgent(ctx, session.ID, cfg); err != nil {
		t.Fatal(err)
	}
	select {
	case <-started:
	case <-time.After(5 * time.Second):
		t.Fatal("provider request did not start")
	}

	other := New()
	defer other.Close()
	if _, err := other.OpenWorkspace(ctx, workspace); err != nil {
		t.Fatal(err)
	}
	current, err := other.GetSession(ctx, session.ID)
	if err != nil {
		t.Fatal(err)
	}
	if current.Status != "running" {
		t.Fatalf("opening the workspace changed a held run to %q", current.Status)
	}
	if _, err := other.StartAgent(ctx, session.ID, cfg); !errors.Is(err, ErrRunHeld) {
		t.Fatalf("StartAgent err = %v, want ErrRunHeld", err)
	}
	if _, err := other.ContinueAgent(ctx, session.ID, "follow up", cfg); !errors.Is(err, ErrRunHeld) {
		t.Fatalf("ContinueAgent err = %v, want ErrRunHeld", err)
	}
	rows, err := other.RecentMessages(ctx, session.ID, 10)
	if err != nil {
		t.Fatal(err)
	}
	if len(rows) != 1 {
		t.Fatalf("a refused Start appended rows: %d", len(rows))
	}
}
