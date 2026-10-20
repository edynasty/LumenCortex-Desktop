package backend

import (
	"context"
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/edynasty/LumenCortex/config"
	lcx "github.com/edynasty/LumenCortex/runtime"
)

// useCatalogDir gives the test its own global configuration directory holding a two-model catalog,
// and returns the path of its lumencortex.json.
func useCatalogDir(t *testing.T) string {
	t.Helper()
	path := useConfigDir(t)
	writeTestCatalog(t, path, "http://127.0.0.1:1/v1", "test/a")
	return path
}

func agentIDs(catalog AgentCatalog) []string {
	out := make([]string, len(catalog.Agents))
	for i, agent := range catalog.Agents {
		out[i] = agent.ID
	}
	return out
}

func findAgent(t *testing.T, catalog AgentCatalog, id string) AgentEntry {
	t.Helper()
	for _, agent := range catalog.Agents {
		if agent.ID == id {
			return agent
		}
	}
	t.Fatalf("agent %q not in %v", id, agentIDs(catalog))
	return AgentEntry{}
}

// The page reads Core's merged catalog: four built-ins first, each with its fixed ceilings, its
// eligibility for a conversation and the digest that identifies its definition.
func TestAgentsListsTheCoreCatalog(t *testing.T) {
	useCatalogDir(t)
	r := New()
	t.Cleanup(func() { r.Close() })

	catalog, err := r.Agents()
	if err != nil {
		t.Fatal(err)
	}
	if got := agentIDs(catalog); len(got) != 4 || got[0] != "ask" || got[1] != "agent" || got[2] != "explore" || got[3] != "worker" {
		t.Fatalf("catalog = %v", got)
	}
	ask := findAgent(t, catalog, "ask")
	if !ask.Builtin || ask.Source != "builtin" || ask.Policy != "read-only" || ask.Delegation != "none" ||
		!ask.ForConversation || ask.Digest == "" || !ask.Editable {
		t.Fatalf("ask = %+v", ask)
	}
	explore := findAgent(t, catalog, "explore")
	if explore.ForConversation || explore.Policy != "read-only" || explore.Models != nil {
		t.Fatalf("explore = %+v", explore)
	}
	if catalog.Limits.MaxCustom != 16 || catalog.Limits.Instructions != 16<<10 || catalog.Limits.Models != 8 {
		t.Fatalf("limits = %+v", catalog.Limits)
	}
	if catalog.GlobalDigest == "" || catalog.GlobalPath == "" {
		t.Fatalf("digest/path = %q %q", catalog.GlobalDigest, catalog.GlobalPath)
	}
}

// A custom agent is written whole; a built-in accepts only instructions, effort and models.
func TestSaveAgentCreatesAndUpdates(t *testing.T) {
	configPath := useCatalogDir(t)
	r := New()
	t.Cleanup(func() { r.Close() })

	catalog, err := r.Agents()
	if err != nil {
		t.Fatal(err)
	}
	created, err := r.SaveAgent(catalog.GlobalDigest, AgentEntry{
		Name: "Code reviewer", Description: "Reads diffs.", Use: "conversation",
		Policy: "read-only", Delegation: "none", Instructions: "Lead with the risk.",
		Effort: "high", Models: []AgentModelItem{{Model: "test/a", Effort: "low"}, {Model: "test/b"}},
	})
	if err != nil {
		t.Fatal(err)
	}
	if len(created.Agents) != 5 {
		t.Fatalf("catalog = %v", agentIDs(created))
	}
	custom := findAgent(t, created, "code-reviewer")
	if custom.Builtin || custom.Source != "global" || custom.Name != "Code reviewer" || custom.Effort != "high" ||
		len(custom.Models) != 2 || custom.Models[0].Model != "test/a" || custom.Models[0].Effort != "low" {
		t.Fatalf("custom = %+v", custom)
	}

	// The catalog is the file: a second Runtime sees it.
	reopened := New()
	t.Cleanup(func() { reopened.Close() })
	other, err := reopened.Agents()
	if err != nil || len(other.Agents) != 5 || findAgent(t, other, "code-reviewer").Instructions != "Lead with the risk." {
		t.Fatalf("reopened = %v err=%v", agentIDs(other), err)
	}

	custom.Name = "Diff reviewer"
	updated, err := r.SaveAgent(created.GlobalDigest, custom)
	if err != nil {
		t.Fatal(err)
	}
	if got := findAgent(t, updated, "code-reviewer"); got.Name != "Diff reviewer" || got.ID != "code-reviewer" {
		t.Fatalf("updated = %+v", got)
	}

	// A built-in keeps its identity; instructions, effort and models are written.
	ask := findAgent(t, updated, "ask")
	ask.Instructions = "Answer in one paragraph."
	ask.Models = []AgentModelItem{{Model: "test/b"}}
	edited, err := r.SaveAgent(updated.GlobalDigest, ask)
	if err != nil {
		t.Fatal(err)
	}
	got := findAgent(t, edited, "ask")
	if got.Instructions != "Answer in one paragraph." || len(got.Models) != 1 || got.Policy != "read-only" || got.Name != "Ask" {
		t.Fatalf("edited built-in = %+v", got)
	}
	saved, err := config.ReadDocument(configPath)
	if err != nil {
		t.Fatal(err)
	}
	if entry := saved.File.Agents["ask"]; entry.Policy != "" || entry.Name != "" || len(entry.Models) != 1 {
		t.Fatalf("file entry for ask = %+v", entry)
	}
}

func TestSaveAgentRefusesBuiltinFixedFields(t *testing.T) {
	useCatalogDir(t)
	r := New()
	t.Cleanup(func() { r.Close() })
	catalog, err := r.Agents()
	if err != nil {
		t.Fatal(err)
	}
	cases := map[string]AgentEntry{
		"name":        {ID: "ask", Name: "Questions"},
		"description": {ID: "ask", Description: "Something else"},
		"use":         {ID: "ask", Use: "delegation"},
		"policy":      {ID: "ask", Policy: "full"},
		"delegation":  {ID: "ask", Delegation: "isolated"},
	}
	for field, entry := range cases {
		t.Run(field, func(t *testing.T) {
			if _, err := r.SaveAgent(catalog.GlobalDigest, entry); !errors.Is(err, ErrBuiltinAgent) {
				t.Fatalf("err = %v, want ErrBuiltinAgent", err)
			}
		})
	}
	if _, err := r.DeleteAgent(catalog.GlobalDigest, "ask"); !errors.Is(err, ErrBuiltinAgent) {
		t.Fatalf("delete built-in err = %v", err)
	}
}

// Nothing is written on a stale digest or an invalid agent: the file keeps its exact bytes.
func TestSaveAgentWritesNothingOnStaleDigestOrInvalidAgent(t *testing.T) {
	configPath := useCatalogDir(t)
	r := New()
	t.Cleanup(func() { r.Close() })
	catalog, err := r.Agents()
	if err != nil {
		t.Fatal(err)
	}
	before := readFile(t, configPath)

	if _, err := r.SaveAgent("sha256:stale", AgentEntry{Name: "Nope"}); !errors.Is(err, config.ErrConflict) {
		t.Fatalf("stale digest err = %v, want ErrConflict", err)
	}
	if _, err := r.DeleteAgent("sha256:stale", "ask"); !errors.Is(err, config.ErrConflict) {
		t.Fatalf("delete stale digest err = %v, want ErrConflict", err)
	}

	invalid := []AgentEntry{
		{Name: ""},
		{Name: strings.Repeat("n", config.MaxAgentNameChars+1)},
		{Name: "Long instructions", Instructions: strings.Repeat("x", config.MaxAgentInstructions+1)},
		{Name: "Bad model", Models: []AgentModelItem{{Model: "nope"}}},
		{Name: "Bad effort", Effort: "extreme"},
		{Name: "Bad policy", Policy: "root"},
		{Name: "Bad delegation", Delegation: "always"},
		{Name: "Delegation without description", Use: "delegation", Policy: "read-only"},
		{Name: "Delegation without a ceiling", Use: "delegation", Description: "Reads."},
		{Name: "Duplicate models", Models: []AgentModelItem{{Model: "test/a"}, {Model: "test/a"}}},
	}
	for _, entry := range invalid {
		if _, err := r.SaveAgent(catalog.GlobalDigest, entry); err == nil {
			t.Errorf("Save(%q) succeeded", entry.Name)
		}
	}
	if after := readFile(t, configPath); after != before {
		t.Fatalf("a refused save changed the file:\n%s", after)
	}
}

// Core refuses a model the merged catalog does not have, so a save naming one is refused too.
func TestSaveAgentRefusesUnknownCatalogModel(t *testing.T) {
	useCatalogDir(t)
	r := New()
	t.Cleanup(func() { r.Close() })
	catalog, err := r.Agents()
	if err != nil {
		t.Fatal(err)
	}
	_, err = r.SaveAgent(catalog.GlobalDigest, AgentEntry{Name: "Ghost", Models: []AgentModelItem{{Model: "ghost/model"}}})
	if !errors.Is(err, config.ErrInvalidConfig) {
		t.Fatalf("err = %v, want ErrInvalidConfig", err)
	}
}

func TestSaveAgentEnforcesTheCustomLimit(t *testing.T) {
	useCatalogDir(t)
	r := New()
	t.Cleanup(func() { r.Close() })
	catalog, err := r.Agents()
	if err != nil {
		t.Fatal(err)
	}
	for i := range config.MaxCustomAgents {
		catalog, err = r.SaveAgent(catalog.GlobalDigest, AgentEntry{Name: "Agent " + string(rune('a'+i))})
		if err != nil {
			t.Fatalf("create %d: %v", i, err)
		}
	}
	if _, err := r.SaveAgent(catalog.GlobalDigest, AgentEntry{Name: "One too many"}); !errors.Is(err, ErrAgentLimit) {
		t.Fatalf("limit err = %v", err)
	}
}

func TestDeleteAgentRemovesOnlyCustomAgents(t *testing.T) {
	useCatalogDir(t)
	r := New()
	t.Cleanup(func() { r.Close() })
	catalog, err := r.Agents()
	if err != nil {
		t.Fatal(err)
	}
	catalog, err = r.SaveAgent(catalog.GlobalDigest, AgentEntry{Name: "Temporary"})
	if err != nil {
		t.Fatal(err)
	}
	next, err := r.DeleteAgent(catalog.GlobalDigest, "temporary")
	if err != nil {
		t.Fatal(err)
	}
	if len(next.Agents) != 4 {
		t.Fatalf("catalog = %v", agentIDs(next))
	}
	if _, err := r.DeleteAgent(next.GlobalDigest, "temporary"); !errors.Is(err, ErrAgentNotFound) {
		t.Fatalf("second delete err = %v", err)
	}
}

// A workspace definition is not the global file's to change; the page shows it read-only.
func TestAgentsMarksWorkspaceDefinitionsReadOnly(t *testing.T) {
	useCatalogDir(t)
	workspace := canonicalDir(t)
	writeFile(t, filepath.Join(workspace, config.FileName), `{"agents": {"local-helper": {"name": "Local helper", "instructions": "Read only."}}}`)
	r := openRuntime(t, workspace)
	catalog, err := r.Agents()
	if err != nil {
		t.Fatal(err)
	}
	// The workspace is not trusted, so Core dropped the entry with a warning instead of merging it.
	if _, ok := findAgentOpt(catalog, "local-helper"); ok {
		t.Fatalf("an untrusted workspace agent was merged: %v", agentIDs(catalog))
	}
}

func findAgentOpt(catalog AgentCatalog, id string) (AgentEntry, bool) {
	for _, agent := range catalog.Agents {
		if agent.ID == id {
			return agent, true
		}
	}
	return AgentEntry{}, false
}

// The one-time import of the retired agents.json: custom profiles become custom agents, built-in
// profiles become overrides, a model outside the catalog is dropped with a warning, and the file is
// renamed rather than deleted. A second run is a no-op.
func TestLegacyAgentProfilesImport(t *testing.T) {
	configPath := useCatalogDir(t)
	r := New()
	t.Cleanup(func() { r.Close() })
	legacyPath := filepath.Join(filepath.Dir(configPath), legacyAgentProfilesFileName)
	writeFile(t, legacyPath, `{
  "version": 1,
  "profiles": [
    {"id": "ask", "name": "Ask", "base": "ask", "instructions": "Answer briefly.", "modelRef": "test/b", "effort": "low", "policy": "read-only", "builtin": true},
    {"id": "agent", "name": "Agent", "base": "agent", "instructions": "Act carefully.", "policy": "full", "builtin": true},
    {"id": "profile-1", "name": "Code reviewer", "description": "Reads diffs.", "base": "ask", "instructions": "Lead with the risk.", "modelRef": "test/a", "effort": "high", "policy": "full"},
    {"id": "profile-2", "name": "Planner", "base": "agent", "instructions": "Plan first.", "modelRef": "gone/model", "policy": "workspace"}
  ]
}`)

	catalog, err := r.Agents()
	if err != nil {
		t.Fatal(err)
	}
	if catalog.Import == nil || !catalog.Import.Imported || catalog.Import.Custom != 2 {
		t.Fatalf("import = %+v", catalog.Import)
	}
	if len(catalog.Import.BuiltinOverrides) != 2 || catalog.Import.RenamedTo != legacyPath+".imported" {
		t.Fatalf("import = %+v", catalog.Import)
	}
	if !strings.Contains(strings.Join(catalog.Import.Warnings, "\n"), "gone/model") {
		t.Fatalf("warnings = %v", catalog.Import.Warnings)
	}

	reviewer := findAgent(t, catalog, "code-reviewer")
	if reviewer.Builtin || reviewer.Policy != "read-only" || reviewer.Delegation != "none" ||
		reviewer.Instructions != "Lead with the risk." || reviewer.Effort != "high" ||
		len(reviewer.Models) != 1 || reviewer.Models[0].Model != "test/a" || reviewer.Models[0].Effort != "high" {
		t.Fatalf("reviewer = %+v", reviewer)
	}
	// base=agent caps nothing, and the unknown model is dropped: the agent inherits the default list.
	planner := findAgent(t, catalog, "planner")
	if planner.Policy != "full" || planner.Delegation != "isolated" || planner.Models != nil {
		t.Fatalf("planner = %+v", planner)
	}
	// The legacy `policy` default is dropped (D6); the built-in overrides keep instructions only.
	ask := findAgent(t, catalog, "ask")
	if ask.Instructions != "Answer briefly." || ask.Policy != "read-only" || len(ask.Models) != 1 || ask.Effort != "low" {
		t.Fatalf("ask = %+v", ask)
	}

	// The file is renamed, never deleted, and the catalog was written once.
	if _, err := os.Stat(legacyPath); !errors.Is(err, os.ErrNotExist) {
		t.Fatalf("agents.json still exists: %v", err)
	}
	if _, err := os.Stat(legacyPath + ".imported"); err != nil {
		t.Fatalf("backup missing: %v", err)
	}
	saved, err := config.ReadDocument(configPath)
	if err != nil {
		t.Fatal(err)
	}
	if len(saved.File.Agents) != 4 {
		t.Fatalf("written agents = %+v", saved.File.Agents)
	}

	// A second read imports nothing and reports the recorded outcome.
	again, err := r.Agents()
	if err != nil {
		t.Fatal(err)
	}
	if again.Import == nil || again.Import.Imported || !again.Import.AlreadyImported || len(again.Agents) != len(catalog.Agents) {
		t.Fatalf("second import = %+v", again.Import)
	}
	if again.Warning == "" {
		t.Fatal("the recorded import warnings are not surfaced")
	}
}

// Colliding names get a suffix instead of being dropped, and entries beyond Core's limit are
// reported rather than lost.
func TestLegacyAgentProfilesImportSuffixesNamesAndReportsTheOverLimit(t *testing.T) {
	configPath := useCatalogDir(t)
	r := New()
	t.Cleanup(func() { r.Close() })
	profiles := []map[string]any{
		{"id": "profile-1", "name": "Reviewer", "base": "agent"},
		{"id": "profile-2", "name": "reviewer", "base": "agent"},
	}
	for i := 3; i <= 20; i++ {
		profiles = append(profiles, map[string]any{"id": "profile-" + string(rune('a'+i)), "name": "Filler " + string(rune('a'+i)), "base": "agent"})
	}
	raw, err := json.Marshal(map[string]any{"version": 1, "profiles": profiles})
	if err != nil {
		t.Fatal(err)
	}
	writeFile(t, filepath.Join(filepath.Dir(configPath), legacyAgentProfilesFileName), string(raw))

	catalog, err := r.Agents()
	if err != nil {
		t.Fatal(err)
	}
	if catalog.Import.Skipped == 0 || !strings.Contains(strings.Join(catalog.Import.Warnings, "\n"), "not imported") {
		t.Fatalf("over-limit entries were not reported: %+v", catalog.Import)
	}
	if catalog.Import.Custom != config.MaxCustomAgents {
		t.Fatalf("custom = %d, want %d", catalog.Import.Custom, config.MaxCustomAgents)
	}
	names := map[string]bool{}
	for _, agent := range catalog.Agents {
		if agent.Builtin {
			continue
		}
		if names[strings.ToLower(agent.Name)] {
			t.Fatalf("duplicate name %q in %v", agent.Name, agentIDs(catalog))
		}
		names[strings.ToLower(agent.Name)] = true
	}
	if !names["reviewer"] || !names["reviewer (2)"] {
		t.Fatalf("colliding names were not suffixed: %v", names)
	}
}

// A corrupt legacy file is left exactly as it was, and the catalog still loads.
func TestLegacyAgentProfilesCorruptFileIsLeftAlone(t *testing.T) {
	configPath := useCatalogDir(t)
	r := New()
	t.Cleanup(func() { r.Close() })
	legacyPath := filepath.Join(filepath.Dir(configPath), legacyAgentProfilesFileName)
	writeFile(t, legacyPath, "{not a catalog")

	catalog, err := r.Agents()
	if err != nil {
		t.Fatal(err)
	}
	if len(catalog.Agents) != 4 || catalog.Import == nil || len(catalog.Import.Warnings) == 0 {
		t.Fatalf("catalog = %v import = %+v", agentIDs(catalog), catalog.Import)
	}
	if got := readFile(t, legacyPath); got != "{not a catalog" {
		t.Fatalf("the corrupt file was rewritten: %s", got)
	}
}

// The one-click repair behind config.ErrSubagentModelRetired rewrites the global and the workspace
// file, then the configuration loads again.
func TestMigrateSubagentModelRepairsBothFiles(t *testing.T) {
	configPath := useCatalogDir(t)
	workspace := canonicalDir(t)
	globalRaw := readFile(t, configPath)
	writeFile(t, configPath, strings.Replace(globalRaw, `"model": "test/a",`, `"model": "test/a", "subagentModel": "test/b",`, 1))
	writeFile(t, filepath.Join(workspace, config.FileName), `{"subagentModel": "test/b"}`)

	r := openRuntime(t, workspace)
	if _, err := r.ConfigState(); !errors.Is(err, config.ErrSubagentModelRetired) {
		t.Fatalf("load err = %v, want ErrSubagentModelRetired", err)
	}
	migration, err := r.MigrateSubagentModel()
	if err != nil {
		t.Fatal(err)
	}
	if !migration.GlobalChanged || !migration.WorkspaceChanged {
		t.Fatalf("migration = %+v", migration)
	}
	state, err := r.ConfigState()
	if err != nil {
		t.Fatalf("load after migration: %v", err)
	}
	if state.Model != "test/a" {
		t.Fatalf("state = %+v", state)
	}
	saved, err := config.ReadDocument(configPath)
	if err != nil {
		t.Fatal(err)
	}
	for _, id := range []string{config.AgentExplore, config.AgentWorker} {
		if models := saved.File.Agents[id].Models; len(models) != 1 || models[0].Model != "test/b" {
			t.Fatalf("agents.%s.models = %+v", id, models)
		}
	}
	// A second click changes nothing.
	again, err := r.MigrateSubagentModel()
	if err != nil || again.GlobalChanged || again.WorkspaceChanged {
		t.Fatalf("second migration = %+v err=%v", again, err)
	}
}

// The bridge names the agent and sends the user's grant; it never caps on its own, and it never
// sends instructions or a mode (ADR-0009).
func TestAgentOptionsForNamesTheAgentAndKeepsTheGrant(t *testing.T) {
	cases := []struct {
		name       string
		cfg        AgentConfig
		wantPolicy string
		wantDel    string
	}{
		{"the user's grant is passed unchanged", AgentConfig{Agent: "ask", Policy: "full", Delegation: "isolated"}, "full", "isolated"},
		{"an empty policy still defaults to read-only", AgentConfig{Agent: "agent"}, "read-only", ""},
		{"a propose grant survives", AgentConfig{Agent: "code-reviewer", Policy: "workspace", Delegation: "propose"}, "workspace", "propose"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			opts := agentOptionsFor(tc.cfg, nil, "")
			if opts.Agent != strings.TrimSpace(tc.cfg.Agent) {
				t.Fatalf("agent = %q, want %q", opts.Agent, tc.cfg.Agent)
			}
			if opts.Policy != tc.wantPolicy || opts.Delegation != tc.wantDel {
				t.Fatalf("policy/delegation = %q/%q, want %q/%q", opts.Policy, opts.Delegation, tc.wantPolicy, tc.wantDel)
			}
			if !opts.Interactive {
				t.Fatal("a Desktop turn is always interactive (ADR-0006 D3)")
			}
		})
	}
}

// Core refuses an unknown agent and a delegation-only agent before anything is written; the UI
// maps both sentinels and asks the user to pick another agent.
func TestStartAgentRefusesUnknownAndDelegationOnlyAgents(t *testing.T) {
	configPath := useCatalogDir(t)
	r := openRuntime(t, canonicalDir(t))
	session, err := r.CreateSession(context.Background(), "pick an agent")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := r.StartAgent(context.Background(), session.ID, AgentConfig{Agent: "missing"}); !errors.Is(err, lcx.ErrUnknownAgent) {
		t.Fatalf("unknown agent err = %v, want ErrUnknownAgent", err)
	}
	if _, err := r.StartAgent(context.Background(), session.ID, AgentConfig{Agent: "explore"}); !errors.Is(err, lcx.ErrAgentNotForConversation) {
		t.Fatalf("delegation-only err = %v, want ErrAgentNotForConversation", err)
	}
	current, err := r.GetSession(context.Background(), session.ID)
	if err != nil {
		t.Fatal(err)
	}
	if current.Status == "running" {
		t.Fatal("a rejected Start changed the session state")
	}
	_ = configPath
}

// A saved custom agent is what a run pins: the thread reports it back in SessionInfo.Agent.
func TestStartAgentPinsTheCatalogAgent(t *testing.T) {
	configPath := useCatalogDir(t)
	r := openRuntime(t, canonicalDir(t))
	catalog, err := r.Agents()
	if err != nil {
		t.Fatal(err)
	}
	catalog, err = r.SaveAgent(catalog.GlobalDigest, AgentEntry{
		Name: "Reader", Policy: "read-only", Delegation: "none", Instructions: "Read only.",
		Models: []AgentModelItem{{Model: "test/a"}},
	})
	if err != nil {
		t.Fatal(err)
	}
	reader := findAgent(t, catalog, "reader")
	session, err := r.CreateSession(context.Background(), "read something")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := r.StartAgent(context.Background(), session.ID, AgentConfig{Agent: reader.ID, Policy: "read-only", MaxSteps: 1}); err != nil {
		t.Fatal(err)
	}
	current, err := r.GetSession(context.Background(), session.ID)
	if err != nil {
		t.Fatal(err)
	}
	if current.Agent != "reader" {
		t.Fatalf("session agent = %q, want reader", current.Agent)
	}
	if current.ModelRef != "test/a" {
		t.Fatalf("session model = %q, want the agent's first model", current.ModelRef)
	}
	_ = configPath
}
