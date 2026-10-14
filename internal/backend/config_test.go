package backend

import (
	"bytes"
	"context"
	"encoding/binary"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"reflect"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"github.com/edynasty/LumenCortex/config"
	coredocs "github.com/edynasty/LumenCortex/docs"
	lcx "github.com/edynasty/LumenCortex/runtime"
)

func openRuntime(t *testing.T, workspace string) *Runtime {
	t.Helper()
	r := New()
	t.Cleanup(func() { _ = r.Close() })
	if _, err := r.OpenWorkspace(context.Background(), workspace); err != nil {
		t.Fatal(err)
	}
	return r
}

func canonicalDir(t *testing.T) string {
	t.Helper()
	dir, err := filepath.EvalSymlinks(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	return dir
}

func waitStatus(t *testing.T, r *Runtime, sessionID, want string) Session {
	t.Helper()
	deadline := time.Now().Add(8 * time.Second)
	for time.Now().Before(deadline) {
		current, err := r.GetSession(context.Background(), sessionID)
		if err != nil {
			t.Fatal(err)
		}
		if current.Status == want {
			return current
		}
		time.Sleep(15 * time.Millisecond)
	}
	current, _ := r.GetSession(context.Background(), sessionID)
	t.Fatalf("session %s status=%q, want %q", sessionID, current.Status, want)
	return Session{}
}

func TestSchemaIdentityWithCore(t *testing.T) {
	desktop, err := os.ReadFile(filepath.Join("..", "..", "docs", "lumencortex.schema.json"))
	if err != nil {
		t.Fatal(err)
	}
	if !bytes.Equal(desktop, coredocs.ConfigSchema) {
		t.Fatal("docs/lumencortex.schema.json differs from Core's canonical schema (docs.ConfigSchema); copy Core's bytes")
	}
	if want := "https://raw.githubusercontent.com/edynasty/LumenCortex/main/docs/lumencortex.schema.json"; ProviderConfigSchema != want {
		t.Fatalf("ProviderConfigSchema=%q, want Core's $id %q", ProviderConfigSchema, want)
	}
}

func TestConfigStateReportsCoreCatalogWithoutCredentials(t *testing.T) {
	configPath := useConfigDir(t)
	t.Setenv("LCX_STATE_KEY", "SENTINEL_KEY_VALUE")
	writeFile(t, configPath, `{
  "model": "test/b",
  "failover": [],
  "providers": {
    "test": {
      "settings": {"baseURL": "http://127.0.0.1:1/v1", "apiKey": "{env:LCX_STATE_KEY}", "headers": {"X-Token": "SENTINEL_HEADER_VALUE"}},
      "models": {
        "a": {"modelID": "upstream-a", "limit": {"context": 1000, "output": 100}},
        "b": {"modelID": "upstream-b", "limit": {"context": 2000, "output": 200}, "reasoning": {"format": "reasoning-effort", "efforts": ["low", "high"]}},
        "plain": {"toolCalling": false, "limit": {"context": 1000, "output": 100}}
      }
    },
    "nokey": {"settings": {"baseURL": "http://127.0.0.1:2/v1", "apiKey": "{env:LCX_STATE_MISSING}"}, "models": {"m": {}}}
  }
}`)
	r := openRuntime(t, canonicalDir(t))
	state, err := r.ConfigState()
	if err != nil {
		t.Fatal(err)
	}
	if state.Model != "test/b" || state.Trusted {
		t.Fatalf("model=%q trusted=%v", state.Model, state.Trusted)
	}
	if state.Failover == nil || state.Warnings == nil || state.Models == nil {
		t.Fatalf("collections must never be nil: %#v", state)
	}
	byRef := map[string]ModelInfo{}
	for _, m := range state.Models {
		byRef[string(m.Ref)] = m
	}
	if len(byRef) != 4 {
		t.Fatalf("catalog=%v", byRef)
	}
	if b := byRef["test/b"]; b.ModelID != "upstream-b" || b.Context != 2000 || b.Output != 200 || !b.ToolCalling ||
		b.APIKeyEnv != "LCX_STATE_KEY" || !b.APIKeySet || !reflect.DeepEqual(b.Efforts, []config.Effort{"low", "high"}) {
		t.Fatalf("test/b=%#v", b)
	}
	if byRef["test/plain"].ToolCalling {
		t.Fatal("toolCalling:false must be reported so the picker can exclude it")
	}
	if m := byRef["nokey/m"]; m.APIKeyEnv != "LCX_STATE_MISSING" || m.APIKeySet {
		t.Fatalf("nokey/m=%#v", m)
	}
	codes := map[string]int{}
	for _, w := range state.Warnings {
		codes[w.Code]++
	}
	if codes[config.WarnDefaultLimit] == 0 {
		t.Fatalf("a model without limits must produce default_limit warnings: %v", state.Warnings)
	}
	if state.GlobalPath != configPath || !strings.HasPrefix(state.GlobalDigest, "sha256:") {
		t.Fatalf("global path/digest=%q %q", state.GlobalPath, state.GlobalDigest)
	}
	raw, _ := json.Marshal(state)
	for _, secret := range []string{"SENTINEL_KEY_VALUE", "SENTINEL_HEADER_VALUE"} {
		if strings.Contains(string(raw), secret) {
			t.Fatalf("ConfigState JSON contains %s: %s", secret, raw)
		}
	}
}

func TestConfigStateWithoutWorkspaceUsesGlobalConfigOnly(t *testing.T) {
	configPath := useConfigDir(t)
	writeTestCatalog(t, configPath, "http://127.0.0.1:1/v1", "test/a")
	state, err := New().ConfigState()
	if err != nil {
		t.Fatal(err)
	}
	if state.Workspace != "" || state.Trusted || state.Model != "test/a" || len(state.Models) != 2 {
		t.Fatalf("state=%#v", state)
	}
}

// A global file with every field outside the editing DTO. A DTO save must change only the DTO's fields.
const unmanagedFileFmt = `{
  "$schema": "https://example.invalid/custom-schema.json",
  "model": "test/a",
  "failover": %s,
  "subagentModel": "test/b",
  "effort": {"default": "medium", "escalation": {"sameFailure": 2, "noProgressSteps": 3, "max": "high"}},
  "checks": {"go-test": {"kind": "test", "command": "go test ./...", "timeoutSeconds": 60, "required": true}},
  "trustedWorkspaces": ["/trusted/one"],
  "providers": {
    "test": {
      "name": "Test",
      "package": "openai-compatible",
      "settings": {
        "baseURL": "http://127.0.0.1:1/v1",
        "apiKey": "{env:LCX_KEEP_KEY}",
        "headers": %s,
        "timeoutSeconds": 90,
        "idleTimeoutSeconds": 30
      },
      "models": {
        "a": {"name": "A", "modelID": "ua", "limit": {"context": 1000, "output": 100},
              "reasoning": {"format": "reasoning-effort", "efforts": ["low", "high"], "echo": "none"},
              "toolCalling": true, "modalities": {"input": ["text", "image"]}},
        "b": {"modelID": "ub", "toolCalling": false}
      }
    }
  }
}`

func TestSaveProviderCatalogScopePreservesUnmanagedFields(t *testing.T) {
	cases := map[string]struct{ failover, headers string }{
		"populated":      {`["test/b"]`, `{"X-Title": "keep"}`},
		"explicit empty": {`[]`, `{}`},
	}
	for name, tc := range cases {
		t.Run(name, func(t *testing.T) {
			configPath := useConfigDir(t)
			writeFile(t, configPath, fmt.Sprintf(unmanagedFileFmt, tc.failover, tc.headers))
			var before map[string]any
			if err := json.Unmarshal([]byte(readFile(t, configPath)), &before); err != nil {
				t.Fatal(err)
			}
			r := New()
			doc, err := r.ProviderCatalogScope("global")
			if err != nil {
				t.Fatal(err)
			}
			if doc.Scope != "global" || doc.Path != configPath || doc.Catalog.Schema != "https://example.invalid/custom-schema.json" {
				t.Fatalf("doc=%#v", doc)
			}
			provider := doc.Catalog.Providers["test"]
			provider.Name = "Renamed"
			a := provider.Models["a"]
			a.Name = "A2"
			a.Limit = &ModelLimit{Context: 2000, Output: 100}
			provider.Models["a"] = a
			doc.Catalog.Providers["test"] = provider

			saved, err := r.SaveProviderCatalogScope("global", doc)
			if err != nil {
				t.Fatal(err)
			}
			if saved.Digest == doc.Digest || saved.Catalog.Providers["test"].Name != "Renamed" {
				t.Fatalf("saved=%#v", saved)
			}

			var after map[string]any
			if err := json.Unmarshal([]byte(readFile(t, configPath)), &after); err != nil {
				t.Fatal(err)
			}
			want := before
			test := want["providers"].(map[string]any)["test"].(map[string]any)
			test["name"] = "Renamed"
			modelA := test["models"].(map[string]any)["a"].(map[string]any)
			modelA["name"] = "A2"
			modelA["limit"].(map[string]any)["context"] = float64(2000)
			if !reflect.DeepEqual(after, want) {
				t.Fatalf("a DTO save changed fields outside the DTO\nwant %#v\n got %#v", want, after)
			}
		})
	}
}

func TestSaveProviderCatalogScopeDeletesOmittedProvidersAndModels(t *testing.T) {
	configPath := useConfigDir(t)
	writeFile(t, configPath, `{"model": "test/a", "providers": {
  "test": {"settings": {"baseURL": "http://127.0.0.1:1/v1"}, "models": {"a": {}, "b": {}}},
  "gone": {"settings": {"baseURL": "http://127.0.0.1:2/v1"}, "models": {"x": {}}}}}`)
	r := New()
	doc, err := r.ProviderCatalogScope("global")
	if err != nil {
		t.Fatal(err)
	}
	delete(doc.Catalog.Providers, "gone")
	delete(doc.Catalog.Providers["test"].Models, "b")
	saved, err := r.SaveProviderCatalogScope("global", doc)
	if err != nil {
		t.Fatal(err)
	}
	if _, ok := saved.Catalog.Providers["gone"]; ok || len(saved.Catalog.Providers["test"].Models) != 1 {
		t.Fatalf("saved=%#v", saved.Catalog)
	}
}

func TestSaveProviderCatalogScopeConflictLeavesFileUnchanged(t *testing.T) {
	configPath := useConfigDir(t)
	writeTestCatalog(t, configPath, "http://127.0.0.1:1/v1", "test/a")
	r := New()
	doc, err := r.ProviderCatalogScope("global")
	if err != nil {
		t.Fatal(err)
	}
	// Another writer (the CLI, an editor) changes the file after the UI read it.
	writeTestCatalog(t, configPath, "http://127.0.0.1:1/v1", "test/b")
	before := readFile(t, configPath)

	doc.Catalog.Model = "test/a"
	_, err = r.SaveProviderCatalogScope("global", doc)
	if !errors.Is(err, config.ErrConflict) {
		t.Fatalf("err=%v, want ErrConflict", err)
	}
	if readFile(t, configPath) != before {
		t.Fatal("a conflicting save modified the file")
	}
}

func TestSaveProviderCatalogScopeCreatesMissingFile(t *testing.T) {
	configPath := useConfigDir(t)
	r := New()
	doc, err := r.ProviderCatalogScope("global")
	if err != nil {
		t.Fatal(err)
	}
	if doc.Digest != "" || len(doc.Catalog.Providers) != 0 {
		t.Fatalf("missing file must read as an empty document with an empty digest: %#v", doc)
	}
	doc.Catalog.Providers = map[string]ProviderDefinition{"p": {Settings: ProviderSettings{BaseURL: "http://127.0.0.1:1/v1"}, Models: map[string]ProviderModel{"m": {}}}}
	doc.Catalog.Model = "p/m"
	saved, err := r.SaveProviderCatalogScope("global", doc)
	if err != nil {
		t.Fatal(err)
	}
	if saved.Digest == "" || !strings.Contains(readFile(t, configPath), `"$schema": "`+ProviderConfigSchema+`"`) {
		t.Fatalf("saved=%#v\n%s", saved, readFile(t, configPath))
	}
	// A second creation from the same stale empty digest is a conflict.
	if _, err := r.SaveProviderCatalogScope("global", doc); !errors.Is(err, config.ErrConflict) {
		t.Fatalf("err=%v, want ErrConflict", err)
	}
}

func TestSaveRejectsLiteralKeyWithoutEchoingIt(t *testing.T) {
	configPath := useConfigDir(t)
	writeTestCatalog(t, configPath, "http://127.0.0.1:1/v1", "test/a")
	before := readFile(t, configPath)
	r := New()
	doc, err := r.ProviderCatalogScope("global")
	if err != nil {
		t.Fatal(err)
	}
	provider := doc.Catalog.Providers["test"]
	provider.Settings.APIKey = "sk-SENTINEL_LITERAL_KEY"
	doc.Catalog.Providers["test"] = provider
	_, err = r.SaveProviderCatalogScope("global", doc)
	if !errors.Is(err, config.ErrInvalidConfig) {
		t.Fatalf("err=%v, want ErrInvalidConfig", err)
	}
	if strings.Contains(err.Error(), "SENTINEL_LITERAL_KEY") {
		t.Fatalf("the error echoes the literal key: %v", err)
	}
	if readFile(t, configPath) != before {
		t.Fatal("a rejected save modified the file")
	}
}

func TestSaveRefusesToOrphanModelReferences(t *testing.T) {
	configPath := useConfigDir(t)
	writeFile(t, configPath, `{"model": "test/a", "failover": ["test/b"], "providers": {
  "test": {"settings": {"baseURL": "http://127.0.0.1:1/v1"}, "models": {"a": {}, "b": {}}}}}`)
	before := readFile(t, configPath)
	r := New()
	doc, err := r.ProviderCatalogScope("global")
	if err != nil {
		t.Fatal(err)
	}
	delete(doc.Catalog.Providers["test"].Models, "b")
	if _, err := r.SaveProviderCatalogScope("global", doc); !errors.Is(err, config.ErrInvalidConfig) {
		t.Fatalf("err=%v, want ErrInvalidConfig for the orphaned failover model", err)
	}
	if readFile(t, configPath) != before {
		t.Fatal("a refused save modified the file")
	}
	// The saved file would otherwise make every later Load fail.
	if _, err := config.Load(""); err != nil {
		t.Fatal(err)
	}
}

func TestWorkspaceScopeIsSeparateFromGlobal(t *testing.T) {
	configPath := useConfigDir(t)
	writeTestCatalog(t, configPath, "http://127.0.0.1:1/v1", "test/a")
	workspace := canonicalDir(t)
	r := openRuntime(t, workspace)

	doc, err := r.ProviderCatalogScope("workspace")
	if err != nil {
		t.Fatal(err)
	}
	if doc.Path != filepath.Join(workspace, "lumencortex.json") || doc.Digest != "" {
		t.Fatalf("doc=%#v", doc)
	}
	doc.Catalog.Model = "test/b"
	if _, err := r.SaveProviderCatalogScope("workspace", doc); err != nil {
		t.Fatal(err)
	}
	state, err := r.ConfigState()
	if err != nil {
		t.Fatal(err)
	}
	if state.Model != "test/b" {
		t.Fatalf("an untrusted workspace may still choose among global models: model=%q warnings=%v", state.Model, state.Warnings)
	}
	if got := readFile(t, configPath); !strings.Contains(got, `"model": "test/a"`) {
		t.Fatalf("workspace save touched the global file: %s", got)
	}
	if _, err := New().ProviderCatalogScope("workspace"); !errors.Is(err, ErrNoWorkspace) {
		t.Fatalf("err=%v, want ErrNoWorkspace", err)
	}
}

func TestTrustWorkspaceWritesCanonicalEntryAndEnablesWorkspaceProvider(t *testing.T) {
	configPath := useConfigDir(t)
	t.Setenv("LCX_WS_KEY", "ws-secret")
	global := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) { replyText(w, "global") }))
	defer global.Close()
	var wsRequests atomic.Int32
	var wsAuth, wsModel atomic.Value
	ws := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		wsRequests.Add(1)
		wsAuth.Store(req.Header.Get("Authorization"))
		var body struct {
			Model string `json:"model"`
		}
		_ = json.NewDecoder(req.Body).Decode(&body)
		wsModel.Store(body.Model)
		replyText(w, "workspace")
	}))
	defer ws.Close()
	writeFile(t, configPath, fmt.Sprintf(`{
  "model": "test/a",
  "failover": [],
  "providers": {"test": {"settings": {"baseURL": %q}, "models": {"a": {"modelID": "upstream-a"}}}}
}`, global.URL+"/v1"))

	workspace := canonicalDir(t)
	writeFile(t, filepath.Join(workspace, "lumencortex.json"), fmt.Sprintf(`{
  "model": "ws/m",
  "providers": {"ws": {"settings": {"baseURL": %q, "apiKey": "{env:LCX_WS_KEY}"}, "models": {"m": {"modelID": "ws-upstream"}}}}
}`, ws.URL+"/v1"))
	r := openRuntime(t, workspace)

	state, err := r.ConfigState()
	if err != nil {
		t.Fatal(err)
	}
	if state.Trusted || state.Model != "test/a" {
		t.Fatalf("trusted=%v model=%q", state.Trusted, state.Model)
	}
	for _, m := range state.Models {
		if m.Ref == "ws/m" {
			t.Fatal("an untrusted workspace provider is in the catalog")
		}
	}
	var dropped []string
	for _, w := range state.Warnings {
		if w.Code == config.WarnUntrustedOverride {
			dropped = append(dropped, w.Key)
			if w.TrustEntry != workspace || w.TrustFile != configPath {
				t.Fatalf("trust target=%q file=%q, want %q %q", w.TrustEntry, w.TrustFile, workspace, configPath)
			}
		}
	}
	if !reflect.DeepEqual(dropped, []string{"providers.ws", "model"}) {
		t.Fatalf("dropped=%v", dropped)
	}

	session, err := r.CreateSession(context.Background(), "untrusted provider")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := r.StartAgent(context.Background(), session.ID, AgentConfig{ModelRef: "ws/m", MaxSteps: 2}); !errors.Is(err, lcx.ErrUnknownModel) {
		t.Fatalf("Start of an untrusted workspace model: %v, want ErrUnknownModel", err)
	}
	if wsRequests.Load() != 0 {
		t.Fatal("an untrusted workspace provider received a request")
	}
	if current, _ := r.GetSession(context.Background(), session.ID); current.Status == "running" || current.ModelRef != "" {
		t.Fatalf("a refused Start changed the session: %#v", current)
	}

	globalBefore := readFile(t, configPath)
	if _, err := r.TrustWorkspace("sha256:stale"); !errors.Is(err, config.ErrConflict) {
		t.Fatalf("stale digest: %v, want ErrConflict", err)
	}
	if readFile(t, configPath) != globalBefore {
		t.Fatal("a conflicting trust changed the global file")
	}

	trusted, err := r.TrustWorkspace(state.GlobalDigest)
	if err != nil {
		t.Fatal(err)
	}
	if !trusted.Trusted || trusted.Model != "ws/m" || trusted.GlobalDigest == state.GlobalDigest {
		t.Fatalf("trusted=%v model=%q digest=%q", trusted.Trusted, trusted.Model, trusted.GlobalDigest)
	}
	var file map[string]any
	if err := json.Unmarshal([]byte(readFile(t, configPath)), &file); err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(file["trustedWorkspaces"], []any{workspace}) {
		t.Fatalf("trustedWorkspaces=%v, want [%s]", file["trustedWorkspaces"], workspace)
	}
	if _, ok := file["failover"]; !ok || file["providers"] == nil {
		t.Fatalf("trust dropped unrelated fields: %v", file)
	}

	if _, err := r.StartAgent(context.Background(), session.ID, AgentConfig{ModelRef: "ws/m", MaxSteps: 2}); err != nil {
		t.Fatal(err)
	}
	done := waitStatus(t, r, session.ID, "completed")
	if done.ModelRef != "ws/m" || wsAuth.Load() != "Bearer ws-secret" || wsModel.Load() != "ws-upstream" || wsRequests.Load() == 0 {
		t.Fatalf("modelRef=%q auth=%v model=%v requests=%d", done.ModelRef, wsAuth.Load(), wsModel.Load(), wsRequests.Load())
	}

	again, err := r.TrustWorkspace(trusted.GlobalDigest)
	if err != nil {
		t.Fatal(err)
	}
	if !again.Trusted || again.GlobalDigest != trusted.GlobalDigest {
		t.Fatalf("trusting a trusted workspace rewrote the file: %q vs %q", again.GlobalDigest, trusted.GlobalDigest)
	}
	if _, err := New().TrustWorkspace(""); !errors.Is(err, ErrNoWorkspace) {
		t.Fatalf("err=%v, want ErrNoWorkspace", err)
	}
}

func TestTrustWorkspaceCreatesGlobalFileWhenMissing(t *testing.T) {
	configPath := useConfigDir(t)
	workspace := canonicalDir(t)
	r := openRuntime(t, workspace)
	state, err := r.ConfigState()
	if err != nil {
		t.Fatal(err)
	}
	if state.GlobalDigest != "" {
		t.Fatalf("digest=%q, a missing file has an empty digest", state.GlobalDigest)
	}
	trusted, err := r.TrustWorkspace(state.GlobalDigest)
	if err != nil {
		t.Fatal(err)
	}
	if !trusted.Trusted || !strings.Contains(readFile(t, configPath), workspace) {
		t.Fatalf("trusted=%v file=%s", trusted.Trusted, readFile(t, configPath))
	}
}

func TestDiscoveryUsesResolvedProviderHeadersAndKey(t *testing.T) {
	configPath := useConfigDir(t)
	t.Setenv("LCX_DISCOVER_KEY", "SENTINEL_KEY_VALUE")
	var gotAuth, gotTitle, gotPath string
	var other atomic.Int32
	elsewhere := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) { other.Add(1) }))
	defer elsewhere.Close()
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		gotAuth, gotTitle, gotPath = req.Header.Get("Authorization"), req.Header.Get("X-Title"), req.URL.Path
		if req.URL.Path == "/redirect/models" {
			http.Redirect(w, req, elsewhere.URL+"/models", http.StatusFound)
			return
		}
		if req.URL.Path == "/denied/models" {
			http.Error(w, "echo SENTINEL_KEY_VALUE", http.StatusUnauthorized)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"data":[{"id":"model-a"},{"id":"org/model-b"},{"id":"model-a"}]}`))
	}))
	defer server.Close()
	writeFile(t, configPath, fmt.Sprintf(`{"providers": {
  "ok": {"settings": {"baseURL": %q, "apiKey": "{env:LCX_DISCOVER_KEY}", "headers": {"X-Title": "SENTINEL_HEADER_VALUE"}}},
  "viaendpoint": {"settings": {"endpoint": %q}},
  "redirect": {"settings": {"baseURL": %q, "apiKey": "{env:LCX_DISCOVER_KEY}", "headers": {"X-Title": "SENTINEL_HEADER_VALUE"}}},
  "denied": {"settings": {"baseURL": %q, "apiKey": "{env:LCX_DISCOVER_KEY}"}},
  "nokey": {"settings": {"baseURL": %q, "apiKey": "{env:LCX_DISCOVER_UNSET}"}},
  "nodest": {}
}}`, server.URL+"/v1", server.URL+"/v1/chat/completions", server.URL+"/redirect", server.URL+"/denied", server.URL+"/v1"))
	r := New()

	models, err := r.DiscoverProviderModels("ok")
	if err != nil {
		t.Fatal(err)
	}
	if len(models) != 2 || models[0].ID != "model-a" || models[1].ID != "org/model-b" {
		t.Fatalf("models=%#v", models)
	}
	if gotAuth != "Bearer SENTINEL_KEY_VALUE" || gotTitle != "SENTINEL_HEADER_VALUE" || gotPath != "/v1/models" {
		t.Fatalf("auth=%q title=%q path=%q: discovery must send the resolved provider's key and headers", gotAuth, gotTitle, gotPath)
	}
	if result, err := r.TestProviderConnection("viaendpoint"); err != nil || !result.OK || result.Models != 2 || gotPath != "/v1/models" {
		t.Fatalf("result=%#v err=%v path=%q", result, err, gotPath)
	}

	for name, want := range map[string]string{
		"redirect": "status=302",
		"denied":   "status=401",
		"nokey":    "LCX_DISCOVER_UNSET",
		"nodest":   "baseURL is required",
	} {
		_, err := r.DiscoverProviderModels(name)
		if err == nil || !strings.Contains(err.Error(), want) {
			t.Fatalf("%s: err=%v, want %q", name, err, want)
		}
		for _, secret := range []string{"SENTINEL_KEY_VALUE", "SENTINEL_HEADER_VALUE"} {
			if strings.Contains(err.Error(), secret) {
				t.Fatalf("%s: error leaks %s: %v", name, secret, err)
			}
		}
	}
	if other.Load() != 0 {
		t.Fatal("discovery followed a redirect and forwarded credentials to another origin")
	}
	if _, err := r.DiscoverProviderModels("missing"); !errors.Is(err, config.ErrUnknownProvider) {
		t.Fatalf("err=%v, want ErrUnknownProvider", err)
	}
}

func TestOpenWorkspaceRefusesNewerSchemaWithCoreSentinel(t *testing.T) {
	useConfigDir(t)
	workspace := canonicalDir(t)
	first := New()
	if _, err := first.OpenWorkspace(context.Background(), workspace); err != nil {
		t.Fatal(err)
	}
	if err := first.Close(); err != nil {
		t.Fatal(err)
	}
	// PRAGMA user_version lives at byte 60 of the SQLite header.
	db, err := os.OpenFile(filepath.Join(workspace, ".lumencortex", "lumencortex.db"), os.O_RDWR, 0)
	if err != nil {
		t.Fatal(err)
	}
	version := make([]byte, 4)
	binary.BigEndian.PutUint32(version, 99)
	if _, err := db.WriteAt(version, 60); err != nil {
		t.Fatal(err)
	}
	if err := db.Close(); err != nil {
		t.Fatal(err)
	}
	second := New()
	_, err = second.OpenWorkspace(context.Background(), workspace)
	if !errors.Is(err, lcx.ErrSchemaTooNew) || !strings.Contains(err.Error(), lcx.ErrSchemaTooNew.Error()) {
		t.Fatalf("err=%v, want ErrSchemaTooNew", err)
	}
}

func TestBridgeResultsCarryNoCredentialsAcrossARun(t *testing.T) {
	configPath := useConfigDir(t)
	t.Setenv("LCX_RUN_KEY", "SENTINEL_KEY_VALUE")
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		if req.Header.Get("Authorization") != "Bearer SENTINEL_KEY_VALUE" || req.Header.Get("X-Title") != "SENTINEL_HEADER_VALUE" {
			t.Errorf("the run request lacks the provider's key or header")
		}
		replyText(w, "done")
	}))
	defer server.Close()
	writeFile(t, configPath, fmt.Sprintf(`{"model": "test/a", "providers": {"test": {
  "settings": {"baseURL": %q, "apiKey": "{env:LCX_RUN_KEY}", "headers": {"X-Title": "SENTINEL_HEADER_VALUE"}},
  "models": {"a": {"limit": {"context": 4000, "output": 500}}}}}}`, server.URL+"/v1"))
	r := openRuntime(t, canonicalDir(t))
	ctx := context.Background()
	session, err := r.CreateSession(ctx, "credential isolation")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := r.StartAgent(ctx, session.ID, AgentConfig{MaxSteps: 2}); err != nil {
		t.Fatal(err)
	}
	waitStatus(t, r, session.ID, "completed")

	state, _ := r.ConfigState()
	doc, _ := r.ProviderCatalogScope("global")
	saved, _ := r.SaveProviderCatalogScope("global", doc)
	models, _ := r.DiscoverProviderModels("test")
	current, _ := r.GetSession(ctx, session.ID)
	messages, _ := r.RecentMessages(ctx, session.ID, 50)
	workspaceState, _ := r.State(ctx)
	for name, value := range map[string]any{
		"ConfigState": state, "ProviderCatalogDocument": doc, "saved": saved,
		"discovery": models, "Session": current, "Messages": messages, "WorkspaceState": workspaceState,
	} {
		raw, err := json.Marshal(value)
		if err != nil {
			t.Fatal(err)
		}
		for _, secret := range []string{"SENTINEL_KEY_VALUE", "SENTINEL_HEADER_VALUE"} {
			if strings.Contains(string(raw), secret) {
				t.Fatalf("%s JSON contains %s", name, secret)
			}
		}
	}
}
