package backend

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"reflect"
	"strings"
	"sync"
	"testing"

	"github.com/edynasty/LumenCortex/config"
	lcx "github.com/edynasty/LumenCortex/runtime"
)

// requestModels records the upstream "model" of every chat request a test server receives.
type requestModels struct {
	mu     sync.Mutex
	models []string
}

func (r *requestModels) handler(t *testing.T) http.HandlerFunc {
	return func(w http.ResponseWriter, req *http.Request) {
		var body struct {
			Model string `json:"model"`
		}
		if err := json.NewDecoder(req.Body).Decode(&body); err != nil {
			t.Errorf("decode request: %v", err)
		}
		r.mu.Lock()
		r.models = append(r.models, body.Model)
		r.mu.Unlock()
		replyText(w, "ok")
	}
}

func (r *requestModels) last() string {
	r.mu.Lock()
	defer r.mu.Unlock()
	if len(r.models) == 0 {
		return ""
	}
	return r.models[len(r.models)-1]
}

func (r *requestModels) count() int {
	r.mu.Lock()
	defer r.mu.Unlock()
	return len(r.models)
}

// setDefaultModel changes the global default through the same path the provider panel uses.
func setDefaultModel(t *testing.T, r *Runtime, ref string) {
	t.Helper()
	doc, err := r.ProviderCatalogScope("global")
	if err != nil {
		t.Fatal(err)
	}
	doc.Catalog.Model = ref
	if _, err := r.SaveProviderCatalogScope("global", doc); err != nil {
		t.Fatal(err)
	}
}

// The M2.4 integration contract against the pinned Core and its real OpenAI-compatible adapter:
// the picker's choice reaches the wire as the model's upstream id and is pinned on the session; a
// later default change does not move the session; only an explicit selection re-pins it.
func TestSessionModelPinningAcrossConfigurationChanges(t *testing.T) {
	configPath := useConfigDir(t)
	var seen requestModels
	server := httptest.NewServer(seen.handler(t))
	defer server.Close()
	writeTestCatalog(t, configPath, server.URL+"/v1", "test/b")

	ctx := context.Background()
	r := openRuntime(t, canonicalDir(t))
	state, err := r.ConfigState()
	if err != nil {
		t.Fatal(err)
	}
	if state.Model != "test/b" {
		t.Fatalf("a new session's picker starts at Effective.Model, got %q", state.Model)
	}

	// 1-3. A new session runs on test/b, sends b's modelID, and is pinned to test/b.
	session, err := r.CreateSession(ctx, "pinning")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := r.StartAgent(ctx, session.ID, AgentConfig{MaxSteps: 2}); err != nil {
		t.Fatal(err)
	}
	pinned := waitStatus(t, r, session.ID, "completed")
	if seen.last() != "upstream-b" || pinned.ModelRef != "test/b" || pinned.Provider != "test" || pinned.Model != "upstream-b" {
		t.Fatalf("request model=%q pin=%q identity=%s/%s", seen.last(), pinned.ModelRef, pinned.Provider, pinned.Model)
	}

	// 4. The configured default moves to test/a; Continue without a ModelRef stays on b.
	setDefaultModel(t, r, "test/a")
	if _, err := r.ContinueAgent(ctx, session.ID, "second turn", AgentConfig{MaxSteps: 2}); err != nil {
		t.Fatal(err)
	}
	waitIdle(t, r, ctx)
	continued, err := r.GetSession(ctx, session.ID)
	if err != nil {
		t.Fatal(err)
	}
	if seen.count() != 2 || seen.last() != "upstream-b" || continued.ModelRef != "test/b" {
		t.Fatalf("Continue moved the session: requests=%d last=%q pin=%q", seen.count(), seen.last(), continued.ModelRef)
	}

	// Sending the pinned ref again is not a change either.
	if _, err := r.ContinueAgent(ctx, session.ID, "third turn", AgentConfig{ModelRef: "test/b", MaxSteps: 2}); err != nil {
		t.Fatal(err)
	}
	waitIdle(t, r, ctx)
	if seen.last() != "upstream-b" {
		t.Fatalf("last=%q", seen.last())
	}

	// 5. An explicit selection of test/a re-pins the session.
	if _, err := r.ContinueAgent(ctx, session.ID, "switch", AgentConfig{ModelRef: "test/a", MaxSteps: 2}); err != nil {
		t.Fatal(err)
	}
	waitIdle(t, r, ctx)
	repinned, err := r.GetSession(ctx, session.ID)
	if err != nil {
		t.Fatal(err)
	}
	if seen.last() != "upstream-a" || repinned.ModelRef != "test/a" || repinned.Model != "upstream-a" {
		t.Fatalf("explicit selection: request=%q pin=%q model=%q", seen.last(), repinned.ModelRef, repinned.Model)
	}

	// The new pin survives the next default change too, and the listing carries it.
	setDefaultModel(t, r, "test/b")
	if _, err := r.ContinueAgent(ctx, session.ID, "after the re-pin", AgentConfig{MaxSteps: 2}); err != nil {
		t.Fatal(err)
	}
	waitIdle(t, r, ctx)
	listed, err := r.ListSessions(ctx, 10, 0)
	if err != nil {
		t.Fatal(err)
	}
	if seen.last() != "upstream-a" || len(listed) != 1 || listed[0].ModelRef != "test/a" {
		t.Fatalf("request=%q listed=%#v", seen.last(), listed)
	}
}

func TestRejectedStartsReportCoreSentinelsAndLeaveTheSessionUnpinned(t *testing.T) {
	configPath := useConfigDir(t)
	t.Setenv("LCX_REJECT_UNSET", "")
	var seen requestModels
	server := httptest.NewServer(seen.handler(t))
	defer server.Close()
	writeFile(t, configPath, `{"model": "test/a", "providers": {
  "test": {"settings": {"baseURL": "`+server.URL+`/v1"}, "models": {
    "a": {"modelID": "upstream-a", "limit": {"context": 65536, "output": 8192}},
    "notools": {"toolCalling": false, "limit": {"context": 65536, "output": 8192}}}},
  "nokey": {"settings": {"baseURL": "`+server.URL+`/v1", "apiKey": "{env:LCX_REJECT_UNSET}"}, "models": {"m": {}}}}}`)
	ctx := context.Background()
	r := openRuntime(t, canonicalDir(t))
	session, err := r.CreateSession(ctx, "rejections")
	if err != nil {
		t.Fatal(err)
	}
	cases := []struct {
		name string
		cfg  AgentConfig
		is   error
		text string
	}{
		{"unknown model", AgentConfig{ModelRef: "test/zzz"}, lcx.ErrUnknownModel, ""},
		{"malformed model", AgentConfig{ModelRef: "nonsense"}, lcx.ErrUnknownModel, ""},
		{"no tool calling", AgentConfig{ModelRef: "test/notools"}, lcx.ErrModelWithoutToolCalling, ""},
		{"invalid effort", AgentConfig{Effort: "turbo"}, lcx.ErrInvalidEffort, ""},
		{"missing key variable", AgentConfig{ModelRef: "nokey/m"}, nil, "LCX_REJECT_UNSET"},
		{"invalid policy", AgentConfig{Policy: "root"}, ErrInvalidPolicy, ""},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			_, err := r.StartAgent(ctx, session.ID, tc.cfg)
			if err == nil {
				t.Fatal("the Start was accepted")
			}
			if tc.is != nil && !errors.Is(err, tc.is) {
				t.Fatalf("err=%v, want %v", err, tc.is)
			}
			if tc.text != "" && !strings.Contains(err.Error(), tc.text) {
				t.Fatalf("err=%v, want text %q", err, tc.text)
			}
			current, err := r.GetSession(ctx, session.ID)
			if err != nil {
				t.Fatal(err)
			}
			if current.ModelRef != "" || current.Status == "running" || seen.count() != 0 {
				t.Fatalf("a rejected Start changed state: %#v requests=%d", current, seen.count())
			}
		})
	}
	// With the configured default available the same session then starts.
	if _, err := r.StartAgent(ctx, session.ID, AgentConfig{MaxSteps: 2}); err != nil {
		t.Fatal(err)
	}
	waitStatus(t, r, session.ID, "completed")
}

func TestStartWithoutConfiguredModelIsUnknownModel(t *testing.T) {
	useConfigDir(t)
	ctx := context.Background()
	r := openRuntime(t, canonicalDir(t))
	session, err := r.CreateSession(ctx, "no config")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := r.StartAgent(ctx, session.ID, AgentConfig{}); !errors.Is(err, lcx.ErrUnknownModel) {
		t.Fatalf("err=%v, want ErrUnknownModel", err)
	}
}

// Core's error texts are what Wails delivers to the UI as strings; the UI matches substrings of
// them. frontend/src/lib/core-errors.json is the list the UI matches, and this test keeps it equal
// to the sentinels the pinned Core ships.
func TestFrontendCoreErrorMarkersMatchCoreSentinels(t *testing.T) {
	raw := readFile(t, "../../frontend/src/lib/core-errors.json")
	var markers map[string]string
	if err := json.Unmarshal([]byte(raw), &markers); err != nil {
		t.Fatal(err)
	}
	want := map[string]error{
		"databaseInUse":         lcx.ErrDatabaseInUse,
		"schemaTooNew":          lcx.ErrSchemaTooNew,
		"legacyNodeDatabase":    lcx.ErrLegacyNodeDatabase,
		"unknownModel":          config.ErrUnknownModel,
		"modelWithoutToolCalls": lcx.ErrModelWithoutToolCalling,
		"invalidEffort":         lcx.ErrInvalidEffort,
		"conflict":              config.ErrConflict,
		"invalidConfig":         config.ErrInvalidConfig,
		"runHeld":               lcx.ErrRunHeld,
		"worktreeBusy":          lcx.ErrWorktreeBusy,
		"noFingerprint":         lcx.ErrNoFingerprint,
		"unknownCheck":          lcx.ErrUnknownCheck,
		"taskProposalNotFound":  lcx.ErrTaskProposalNotFound,
		"taskProposalStarted":   lcx.ErrTaskProposalStarted,
		"taskNeedsCommit":       lcx.ErrExecutionTaskNeedsCommit,
		"childLimit":            lcx.ErrSubagentLimitExceeded,
	}
	got := map[string]string{}
	for key, err := range want {
		got[key] = err.Error()
	}
	if !reflect.DeepEqual(markers, got) {
		t.Fatalf("frontend/src/lib/core-errors.json is out of date\nwant %v\n got %v", got, markers)
	}
}
