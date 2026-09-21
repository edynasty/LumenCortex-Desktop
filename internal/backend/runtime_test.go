package backend

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestWorkspaceUsesEmbeddedLumenCortexRuntime(t *testing.T) {
	ctx := context.Background()
	r := New()
	defer r.Close()

	state, err := r.OpenWorkspace(ctx, t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	if state.Health == nil || state.Workspace == "" {
		t.Fatalf("unexpected state: %#v", state)
	}
	session, err := r.CreateSession(ctx, "desktop smoke")
	if err != nil {
		t.Fatal(err)
	}
	if session.ID == "" {
		t.Fatal("session id is empty")
	}
	messages, err := r.RecentMessages(ctx, session.ID, 8)
	if err != nil {
		t.Fatal(err)
	}
	if len(messages) != 0 {
		t.Fatalf("new session has %d messages", len(messages))
	}
}

func TestDesktopCanRunEmbeddedAgent(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		w.Header().Set("Content-Type", "text/event-stream")
		fmt.Fprintln(w, `data: {"choices":[{"delta":{"role":"assistant","content":"done"},"finish_reason":"stop"}]}`)
		fmt.Fprintln(w, `data: {"choices":[],"usage":{"prompt_tokens":4,"completion_tokens":1,"total_tokens":5}}`)
		fmt.Fprintln(w, "data: [DONE]")
	}))
	defer server.Close()

	ctx := context.Background()
	r := New()
	defer r.Close()
	if _, err := r.OpenWorkspace(ctx, t.TempDir()); err != nil {
		t.Fatal(err)
	}
	session, err := r.CreateSession(ctx, "answer without tools")
	if err != nil {
		t.Fatal(err)
	}
	result, err := r.RunAgent(ctx, AgentRunRequest{
		SessionID: session.ID,
		Endpoint:  server.URL,
		Model:     "desktop-test",
		Policy:    "read-only",
		MaxSteps:  2,
	})
	if err != nil {
		t.Fatal(err)
	}
	if result.Status != "completed" || result.Final != "done" {
		t.Fatalf("result=%#v", result)
	}
}
