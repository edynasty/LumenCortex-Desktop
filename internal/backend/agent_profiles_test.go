package backend

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"testing"
)

func agentProfilesFile(configPath string) string {
	return filepath.Join(filepath.Dir(configPath), agentProfilesFileName)
}

func profileNames(state AgentProfiles) []string {
	out := make([]string, len(state.Profiles))
	for i, profile := range state.Profiles {
		out[i] = profile.ID + ":" + profile.Name
	}
	return out
}

func TestAgentProfilesCRUDAndBuiltins(t *testing.T) {
	useConfigDir(t)
	r := New()
	t.Cleanup(func() { r.Close() })

	state, err := r.ListAgentProfiles()
	if err != nil {
		t.Fatal(err)
	}
	if names := profileNames(state); len(names) != 2 || names[0] != "ask:Ask" || names[1] != "agent:Agent" {
		t.Fatalf("initial profiles = %v", names)
	}
	if state.Warning != "" {
		t.Fatalf("unexpected warning %q", state.Warning)
	}

	created, err := r.SaveAgentProfile(AgentProfile{Name: "Reviewer", Base: AgentBaseAsk, Instructions: "Review only.", Policy: "full"})
	if err != nil {
		t.Fatal(err)
	}
	if len(created.Profiles) != 3 {
		t.Fatalf("profiles = %v", profileNames(created))
	}
	custom := created.Profiles[2]
	if custom.ID == "" || custom.ID == AgentProfileAsk || custom.ID == AgentProfileAgent || custom.Builtin {
		t.Fatalf("custom profile identity = %+v", custom)
	}

	// The catalog survives a new Runtime: it is the file, not process memory.
	reopened := New()
	t.Cleanup(func() { reopened.Close() })
	state, err = reopened.ListAgentProfiles()
	if err != nil || len(state.Profiles) != 3 || state.Profiles[2].Instructions != "Review only." {
		t.Fatalf("reopened = %+v err=%v", state.Profiles, err)
	}

	custom.Name = "Code reviewer"
	if _, err := r.SaveAgentProfile(custom); err != nil {
		t.Fatal(err)
	}
	state, _ = r.ListAgentProfiles()
	if state.Profiles[2].Name != "Code reviewer" {
		t.Fatalf("rename = %+v", state.Profiles[2])
	}

	if _, err := r.SaveAgentProfile(AgentProfile{Name: "code REVIEWER", Base: AgentBaseAgent}); !errors.Is(err, ErrInvalidAgentProfile) {
		t.Fatalf("duplicate name err = %v", err)
	}

	// Built-ins: rename, rebase and delete are refused; instructions and defaults are editable.
	builtin := state.Profiles[0]
	renamed := builtin
	renamed.Name = "Questions"
	if _, err := r.SaveAgentProfile(renamed); !errors.Is(err, ErrBuiltinAgentProfile) {
		t.Fatalf("rename built-in err = %v", err)
	}
	rebased := builtin
	rebased.Base = AgentBaseAgent
	if _, err := r.SaveAgentProfile(rebased); !errors.Is(err, ErrBuiltinAgentProfile) {
		t.Fatalf("rebase built-in err = %v", err)
	}
	if _, err := r.DeleteAgentProfile(AgentProfileAsk); !errors.Is(err, ErrBuiltinAgentProfile) {
		t.Fatalf("delete built-in err = %v", err)
	}
	edited := builtin
	edited.Instructions = "Answer in one paragraph."
	edited.Policy = "workspace"
	if _, err := r.SaveAgentProfile(edited); err != nil {
		t.Fatal(err)
	}
	state, _ = r.ListAgentProfiles()
	if state.Profiles[0].Instructions != "Answer in one paragraph." || state.Profiles[0].Name != "Ask" || state.Profiles[0].Base != AgentBaseAsk {
		t.Fatalf("edited built-in = %+v", state.Profiles[0])
	}
	if state, err = r.ResetAgentProfile(AgentProfileAsk); err != nil {
		t.Fatal(err)
	}
	if state.Profiles[0].Instructions != "" || state.Profiles[0].Policy != "read-only" {
		t.Fatalf("reset built-in = %+v", state.Profiles[0])
	}

	state, err = r.DeleteAgentProfile(custom.ID)
	if err != nil || len(state.Profiles) != 2 {
		t.Fatalf("delete custom = %+v err=%v", state.Profiles, err)
	}
	if _, err := r.DeleteAgentProfile("missing"); !errors.Is(err, ErrUnknownAgentProfile) {
		t.Fatalf("delete missing err = %v", err)
	}
}

func TestAgentProfileValidationAndLimits(t *testing.T) {
	useConfigDir(t)
	r := New()
	t.Cleanup(func() { r.Close() })

	cases := []AgentProfile{
		{Name: "", Base: AgentBaseAsk},
		{Name: strings.Repeat("n", maxAgentProfileNameChars+1), Base: AgentBaseAsk},
		{Name: "bad base", Base: "root"},
		{Name: "long instructions", Base: AgentBaseAsk, Instructions: strings.Repeat("x", maxAgentProfileInstructions+1)},
		{Name: "bad model", Base: AgentBaseAsk, ModelRef: "nope"},
		{Name: "bad effort", Base: AgentBaseAsk, Effort: "extreme"},
		{Name: "bad policy", Base: AgentBaseAsk, Policy: "root"},
	}
	for _, profile := range cases {
		if _, err := r.SaveAgentProfile(profile); !errors.Is(err, ErrInvalidAgentProfile) {
			t.Errorf("Save(%q) err = %v, want ErrInvalidAgentProfile", profile.Name, err)
		}
	}

	for i := 2; i < maxAgentProfiles; i++ {
		if _, err := r.SaveAgentProfile(AgentProfile{Name: "profile " + string(rune('a'+i)), Base: AgentBaseAgent}); err != nil {
			t.Fatalf("create %d: %v", i, err)
		}
	}
	if _, err := r.SaveAgentProfile(AgentProfile{Name: "one too many", Base: AgentBaseAgent}); !errors.Is(err, ErrAgentProfileLimit) {
		t.Fatalf("limit err = %v", err)
	}
}

func TestAgentProfilesWriteAtomicallyAndKeepTheOldFileOnFailure(t *testing.T) {
	configPath := useConfigDir(t)
	r := New()
	t.Cleanup(func() { r.Close() })
	if _, err := r.SaveAgentProfile(AgentProfile{Name: "Kept", Base: AgentBaseAsk, Instructions: "keep"}); err != nil {
		t.Fatal(err)
	}
	path := agentProfilesFile(configPath)
	before, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	info, err := os.Stat(path)
	if err != nil {
		t.Fatal(err)
	}
	if info.Mode().Perm() != 0o600 {
		t.Fatalf("mode = %o, want 600", info.Mode().Perm())
	}
	entries, err := os.ReadDir(filepath.Dir(path))
	if err != nil {
		t.Fatal(err)
	}
	for _, entry := range entries {
		if strings.HasPrefix(entry.Name(), ".agents-") {
			t.Fatalf("temporary file left behind: %s", entry.Name())
		}
	}
	var doc agentProfilesDocument
	if err := json.Unmarshal(before, &doc); err != nil || doc.Version != agentProfilesVersion || len(doc.Profiles) != 3 {
		t.Fatalf("file = %s err=%v", before, err)
	}

	// A write that cannot create its temporary file fails and leaves the previous file intact.
	dir := filepath.Dir(path)
	if err := os.Chmod(dir, 0o500); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = os.Chmod(dir, 0o700) })
	if _, err := r.SaveAgentProfile(AgentProfile{Name: "Nope", Base: AgentBaseAgent}); err == nil {
		t.Fatal("save into a read-only directory succeeded")
	}
	after, err := os.ReadFile(path)
	if err != nil || string(after) != string(before) {
		t.Fatalf("a failed write changed the file: %v", err)
	}
}

func TestAgentProfileCorruptFileFallsBackWithoutOverwriting(t *testing.T) {
	configPath := useConfigDir(t)
	r := New()
	t.Cleanup(func() { r.Close() })
	path := agentProfilesFile(configPath)
	corrupt := []byte("{not a catalog")
	writeFile(t, path, string(corrupt))

	state, err := r.ListAgentProfiles()
	if err != nil {
		t.Fatal(err)
	}
	if len(state.Profiles) != 2 || state.Warning == "" {
		t.Fatalf("fallback = %+v", state)
	}
	unchanged, err := os.ReadFile(path)
	if err != nil || string(unchanged) != string(corrupt) {
		t.Fatalf("a read rewrote the corrupt file: %v", err)
	}

	state, err = r.SaveAgentProfile(AgentProfile{Name: "Recovered", Base: AgentBaseAgent})
	if err != nil || len(state.Profiles) != 3 {
		t.Fatalf("save over corrupt file = %+v err=%v", state, err)
	}
	var doc agentProfilesDocument
	raw, err := os.ReadFile(path)
	if err != nil || json.Unmarshal(raw, &doc) != nil || doc.Version != 1 {
		t.Fatalf("recovered file = %s err=%v", raw, err)
	}
}

type wireRequest struct {
	Messages []struct {
		Role    string `json:"role"`
		Content string `json:"content"`
	} `json:"messages"`
	Tools []struct {
		Function struct {
			Name string `json:"name"`
		} `json:"function"`
	} `json:"tools"`
}

func captureProvider(t *testing.T, requests *[]wireRequest, mu *sync.Mutex, final string) *httptest.Server {
	t.Helper()
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		body, _ := io.ReadAll(req.Body)
		var parsed wireRequest
		if err := json.Unmarshal(body, &parsed); err != nil {
			t.Errorf("request body: %v", err)
		}
		mu.Lock()
		*requests = append(*requests, parsed)
		mu.Unlock()
		replyText(w, final)
	}))
	t.Cleanup(server.Close)
	return server
}

// A profile id resolves to stored instructions and its base caps the run: a request that names an
// Ask-based profile with full policy and isolated delegation still reaches Core read-only, and the
// instructions arrive as the last system message after the default prompt.
func TestStartAgentUsesProfileInstructionsAndBase(t *testing.T) {
	var mu sync.Mutex
	var requests []wireRequest
	server := captureProvider(t, &requests, &mu, "done")
	configPath := useConfigDir(t)
	writeTestCatalog(t, configPath, server.URL+"/v1", "test/a")
	r := openRuntime(t, canonicalDir(t))
	ctx := context.Background()

	instructions := "Answer with a short diff and no prose."
	state, err := r.SaveAgentProfile(AgentProfile{Name: "Quiet reviewer", Base: AgentBaseAsk, Instructions: instructions, Policy: "full"})
	if err != nil {
		t.Fatal(err)
	}
	profileID := state.Profiles[2].ID

	session, err := r.CreateSession(ctx, "review the change")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := r.StartAgent(ctx, session.ID, AgentConfig{
		ProfileID: profileID, Mode: "agent", Policy: "full", Delegation: "isolated", MaxSteps: 2,
	}); err != nil {
		t.Fatal(err)
	}
	waitIdle(t, r, ctx)

	mu.Lock()
	defer mu.Unlock()
	if len(requests) != 1 {
		t.Fatalf("requests=%d", len(requests))
	}
	var systems []string
	for _, message := range requests[0].Messages {
		if message.Role == "system" {
			systems = append(systems, message.Content)
		}
	}
	if len(systems) != 2 || !strings.Contains(systems[0], "Your reply ends this turn, not the task") || systems[1] != instructions {
		t.Fatalf("system messages=%q", systems)
	}
	var tools []string
	for _, tool := range requests[0].Tools {
		tools = append(tools, tool.Function.Name)
	}
	for _, forbidden := range []string{"shell", "write_file"} {
		for _, name := range tools {
			if name == forbidden {
				t.Fatalf("Ask-based profile exposed %s: %v", forbidden, tools)
			}
		}
	}

	// An unknown id is refused before the run starts.
	if _, err := r.StartAgent(ctx, session.ID, AgentConfig{ProfileID: "missing"}); !errors.Is(err, ErrUnknownAgentProfile) {
		t.Fatalf("unknown profile err = %v", err)
	}
}
