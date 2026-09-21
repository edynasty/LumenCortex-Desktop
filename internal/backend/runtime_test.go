package backend

import (
	"context"
	"encoding/json"
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
	release := make(chan struct{})
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		close(started)
		<-release
		http.Error(w, "released after client cancellation", http.StatusGatewayTimeout)
	}))
	defer server.Close()
	defer close(release)

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
	begin := time.Now()
	if err := r.Close(); err != nil {
		t.Fatal(err)
	}
	if elapsed := time.Since(begin); elapsed > time.Second {
		t.Fatalf("runtime close waited for provider response: %s", elapsed)
	}
}


func TestProviderCatalogResolvesConfiguredModelAndEnvKey(t *testing.T) {
	t.Setenv("LCX_TEST_PROVIDER_KEY", "secret-from-env")
	var gotAuthorization string
	var gotModel string
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		gotAuthorization = req.Header.Get("Authorization")
		var body map[string]any
		if err := json.NewDecoder(req.Body).Decode(&body); err != nil {
			t.Fatal(err)
		}
		if value, ok := body["model"].(string); ok {
			gotModel = value
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte("{\"choices\":[{\"message\":{\"role\":\"assistant\",\"content\":\"configured\"},\"finish_reason\":\"stop\"}]}"))
	}))
	defer server.Close()

	ctx := context.Background()
	r := New()
	defer r.Close()
	workspace := t.TempDir()
	if _, err := r.OpenWorkspace(ctx, workspace); err != nil {
		t.Fatal(err)
	}
	catalog := ProviderCatalog{
		Model: "test/coder",
		Providers: map[string]ProviderDefinition{
			"test": {
				Name:    "Test Provider",
				Package: "openai-compatible",
				Settings: ProviderSettings{
					Endpoint: server.URL,
					APIKey:   "{env:LCX_TEST_PROVIDER_KEY}",
				},
				Models: map[string]ProviderModel{
					"coder": {Name: "Coder", ModelID: "real-model-id"},
				},
			},
		},
	}
	if _, err := r.SaveProviderCatalog(catalog); err != nil {
		t.Fatal(err)
	}
	loaded, err := r.ProviderCatalog()
	if err != nil {
		t.Fatal(err)
	}
	if loaded.Model != "test/coder" || loaded.Providers["test"].Models["coder"].ModelID != "real-model-id" {
		t.Fatalf("unexpected catalog: %#v", loaded)
	}

	session, err := r.CreateSession(ctx, "provider catalog")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := r.StartAgent(ctx, session.ID, AgentConfig{
		ModelRef: "test/coder",
		Provider: ProviderConfig{DisableStreaming: true, DisableRetries: true},
		Policy: "read-only",
		MaxSteps: 2,
	}); err != nil {
		t.Fatal(err)
	}

	deadline := time.Now().Add(3 * time.Second)
	for time.Now().Before(deadline) {
		current, err := r.GetSession(ctx, session.ID)
		if err != nil {
			t.Fatal(err)
		}
		if current.Status == "completed" {
			if current.Provider != "test" || current.Model != "real-model-id" {
				t.Fatalf("identity=%s/%s", current.Provider, current.Model)
			}
			if gotAuthorization != "Bearer secret-from-env" {
				t.Fatalf("authorization=%q", gotAuthorization)
			}
			if gotModel != "real-model-id" {
				t.Fatalf("model=%q", gotModel)
			}
			return
		}
		time.Sleep(20 * time.Millisecond)
	}
	t.Fatal("configured agent did not complete")
}
