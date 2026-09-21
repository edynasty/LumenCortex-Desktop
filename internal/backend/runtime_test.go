package backend

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
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

func TestStartAgentRunsLatestEmbeddedHarness(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		if req.Method != http.MethodPost {
			t.Fatalf("method=%s", req.Method)
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte("{\"choices\":[{\"message\":{\"role\":\"assistant\",\"content\":\"desktop agent complete\"},\"finish_reason\":\"stop\"}],\"usage\":{\"prompt_tokens\":3,\"completion_tokens\":2,\"total_tokens\":5}}"))
	}))
	defer server.Close()

	ctx := context.Background()
	r := New()
	defer r.Close()
	if _, err := r.OpenWorkspace(ctx, t.TempDir()); err != nil {
		t.Fatal(err)
	}
	session, err := r.CreateSession(ctx, "finish without tools")
	if err != nil {
		t.Fatal(err)
	}

	events, stop, ok := r.Events(32)
	if !ok {
		t.Fatal("runtime event stream is unavailable")
	}
	defer stop()

	started, err := r.StartAgent(ctx, session.ID, AgentConfig{
		Provider: ProviderConfig{
			Endpoint:         server.URL,
			Model:            "desktop-test",
			DisableStreaming: true,
			DisableRetries:   true,
		},
		Policy:   "read-only",
		MaxSteps: 2,
	})
	if err != nil {
		t.Fatal(err)
	}
	if started.Status != "running" {
		t.Fatalf("started status=%s", started.Status)
	}

	deadline := time.After(3 * time.Second)
	for {
		select {
		case event := <-events:
			if event.Type == "session.complete" && event.SessionID == session.ID {
				current, err := r.GetSession(ctx, session.ID)
				if err != nil {
					t.Fatal(err)
				}
				if current.Final == nil || *current.Final != "desktop agent complete" {
					t.Fatalf("final=%v", current.Final)
				}
				messages, err := r.RecentMessages(ctx, session.ID, 8)
				if err != nil {
					t.Fatal(err)
				}
				if len(messages) < 2 {
					t.Fatalf("expected durable user/assistant transcript, got %d", len(messages))
				}
				return
			}
		case <-deadline:
			t.Fatal("agent did not complete")
		}
	}
}

func TestCloseCancelsActiveAgentBeforeClosingEngine(t *testing.T) {
	started := make(chan struct{})
	cancelled := make(chan struct{})
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		close(started)
		select {
		case <-req.Context().Done():
			close(cancelled)
		case <-time.After(2 * time.Second):
			http.Error(w, "request was not cancelled", http.StatusGatewayTimeout)
		}
	}))
	defer server.Close()

	ctx := context.Background()
	r := New()
	if _, err := r.OpenWorkspace(ctx, t.TempDir()); err != nil {
		t.Fatal(err)
	}
	session, err := r.CreateSession(ctx, "wait for cancellation")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := r.StartAgent(ctx, session.ID, AgentConfig{
		Provider: ProviderConfig{
			Endpoint:         server.URL,
			Model:            "desktop-test",
			DisableStreaming: true,
			DisableRetries:   true,
		},
		Policy: "read-only",
	}); err != nil {
		t.Fatal(err)
	}

	select {
	case <-started:
	case <-time.After(2 * time.Second):
		t.Fatal("provider request did not start")
	}
	if err := r.Close(); err != nil {
		t.Fatal(err)
	}
	select {
	case <-cancelled:
	case <-time.After(250 * time.Millisecond):
		t.Fatal("provider request context was not cancelled")
	}
}
