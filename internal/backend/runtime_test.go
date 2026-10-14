package backend

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"sync"
	"testing"
	"time"
)

func TestWorkspaceUsesEmbeddedLumenCortexRuntime(t *testing.T) {
	useConfigDir(t)
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
	if session.ModelRef != "" {
		t.Fatalf("a session that never started has modelRef %q", session.ModelRef)
	}
	messages, err := r.RecentMessages(ctx, session.ID, 8)
	if err != nil {
		t.Fatal(err)
	}
	if len(messages) != 1 {
		t.Fatalf("new session has %d messages, want exactly the goal row", len(messages))
	}
}

func TestStartAgentRunsLatestEmbeddedHarness(t *testing.T) {
	configPath := useConfigDir(t)
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		if req.Method != http.MethodPost {
			t.Errorf("method=%s", req.Method)
		}
		replyText(w, "desktop agent complete")
	}))
	defer server.Close()
	writeTestCatalog(t, configPath, server.URL+"/v1", "test/a")

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

	started, err := r.StartAgent(ctx, session.ID, AgentConfig{Policy: "read-only", MaxSteps: 2})
	if err != nil {
		t.Fatal(err)
	}
	if started.Status != "running" {
		t.Fatalf("started status=%s", started.Status)
	}

	deadline := time.After(5 * time.Second)
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

// heldServer answers every request only after release is closed, then fails it.
func heldServer(t *testing.T) (server *httptest.Server, started chan struct{}, release chan struct{}) {
	t.Helper()
	started = make(chan struct{})
	release = make(chan struct{})
	var once sync.Once
	server = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		once.Do(func() { close(started) })
		select {
		case <-release:
		case <-req.Context().Done():
		}
		http.Error(w, "released after client cancellation", http.StatusGatewayTimeout)
	}))
	t.Cleanup(func() {
		close(release)
		server.Close()
	})
	return server, started, release
}

func TestCloseCancelsActiveAgentBeforeClosingEngine(t *testing.T) {
	configPath := useConfigDir(t)
	server, started, _ := heldServer(t)
	writeTestCatalog(t, configPath, server.URL+"/v1", "test/a")

	ctx := context.Background()
	r := New()
	if _, err := r.OpenWorkspace(ctx, t.TempDir()); err != nil {
		t.Fatal(err)
	}
	session, err := r.CreateSession(ctx, "wait for cancellation")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := r.StartAgent(ctx, session.ID, AgentConfig{Policy: "read-only"}); err != nil {
		t.Fatal(err)
	}

	select {
	case <-started:
	case <-time.After(3 * time.Second):
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
	configPath := useConfigDir(t)
	t.Setenv("LCX_TEST_PROVIDER_KEY", "secret-from-env")
	var gotAuthorization, gotModel string
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		gotAuthorization = req.Header.Get("Authorization")
		var body map[string]any
		if err := json.NewDecoder(req.Body).Decode(&body); err != nil {
			t.Error(err)
		}
		if value, ok := body["model"].(string); ok {
			gotModel = value
		}
		replyText(w, "configured")
	}))
	defer server.Close()

	ctx := context.Background()
	r := New()
	defer r.Close()
	if _, err := r.OpenWorkspace(ctx, t.TempDir()); err != nil {
		t.Fatal(err)
	}
	empty, err := r.ProviderCatalogScope("global")
	if err != nil {
		t.Fatal(err)
	}
	saved, err := r.SaveProviderCatalogScope("global", ProviderCatalogDocument{
		Digest: empty.Digest,
		Catalog: ProviderCatalog{
			Model: "test/coder",
			Providers: map[string]ProviderDefinition{
				"test": {
					Name:    "Test Provider",
					Package: "openai-compatible",
					Settings: ProviderSettings{
						Endpoint: server.URL + "/v1/chat/completions",
						APIKey:   "{env:LCX_TEST_PROVIDER_KEY}",
					},
					Models: map[string]ProviderModel{"coder": {Name: "Coder", ModelID: "real-model-id"}},
				},
			},
		},
	})
	if err != nil {
		t.Fatal(err)
	}
	if saved.Catalog.Model != "test/coder" || saved.Catalog.Providers["test"].Models["coder"].ModelID != "real-model-id" {
		t.Fatalf("unexpected catalog: %#v", saved.Catalog)
	}
	if saved.Path != configPath {
		t.Fatalf("saved to %s, want %s", saved.Path, configPath)
	}

	session, err := r.CreateSession(ctx, "provider catalog")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := r.StartAgent(ctx, session.ID, AgentConfig{ModelRef: "test/coder", Policy: "read-only", MaxSteps: 2}); err != nil {
		t.Fatal(err)
	}

	deadline := time.Now().Add(5 * time.Second)
	for time.Now().Before(deadline) {
		current, err := r.GetSession(ctx, session.ID)
		if err != nil {
			t.Fatal(err)
		}
		if current.Status == "completed" {
			if current.Provider != "test" || current.Model != "real-model-id" || current.ModelRef != "test/coder" {
				t.Fatalf("identity=%s/%s ref=%s", current.Provider, current.Model, current.ModelRef)
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

func TestWorkspaceStateReflectsCoreRunSupervisor(t *testing.T) {
	configPath := useConfigDir(t)
	server, started, _ := heldServer(t)
	writeTestCatalog(t, configPath, server.URL+"/v1", "test/a")

	ctx := context.Background()
	r := New()
	defer r.Close()
	if _, err := r.OpenWorkspace(ctx, t.TempDir()); err != nil {
		t.Fatal(err)
	}
	session, err := r.CreateSession(ctx, "supervisor state")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := r.StartAgent(ctx, session.ID, AgentConfig{Policy: "read-only"}); err != nil {
		t.Fatal(err)
	}

	select {
	case <-started:
	case <-time.After(3 * time.Second):
		t.Fatal("provider request did not start")
	}

	state, err := r.State(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if len(state.ActiveRuns) != 1 || state.ActiveRuns[0].SessionID != session.ID {
		t.Fatalf("active runs=%#v", state.ActiveRuns)
	}

	if !r.CancelAgent(session.ID) {
		t.Fatal("cancel should report active run")
	}

	deadline := time.Now().Add(3 * time.Second)
	for time.Now().Before(deadline) {
		state, err = r.State(ctx)
		if err != nil {
			t.Fatal(err)
		}
		if len(state.ActiveRuns) == 0 {
			current, err := r.GetSession(ctx, session.ID)
			if err != nil {
				t.Fatal(err)
			}
			if current.Status != "interrupted" {
				t.Fatalf("status=%q, want interrupted", current.Status)
			}
			return
		}
		time.Sleep(10 * time.Millisecond)
	}
	t.Fatalf("active run remained after cancellation: %#v", state.ActiveRuns)
}
