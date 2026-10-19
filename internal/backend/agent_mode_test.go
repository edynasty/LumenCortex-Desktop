package backend

import (
	"strings"
	"testing"
)

// The Ask-mode guard: a mode=ask request must reach Core read-only with no delegation, whatever
// policy and grant the request carries. The frontend maps the same rule; this is the boundary that
// actually hands options to Core.
func TestAskModeForcesReadOnlyAndNoDelegation(t *testing.T) {
	cases := []struct {
		name       string
		cfg        AgentConfig
		wantPolicy string
		wantDel    string
	}{
		{"ask with full policy and isolated grant", AgentConfig{Mode: "ask", Policy: "full", Delegation: "isolated"}, "read-only", ""},
		{"ask with workspace policy and propose grant", AgentConfig{Mode: "ask", Policy: "workspace", Delegation: "propose"}, "read-only", ""},
		{"agent keeps the user's policy and grant", AgentConfig{Mode: "agent", Policy: "workspace", Delegation: "propose"}, "workspace", "propose"},
		{"empty mode keeps the user's policy and grant", AgentConfig{Policy: "full", Delegation: "isolated"}, "full", "isolated"},
		{"empty policy still defaults to read-only", AgentConfig{}, "read-only", ""},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			opts := agentOptionsFor(tc.cfg, nil, "")
			if opts.Policy != tc.wantPolicy {
				t.Fatalf("policy = %q, want %q", opts.Policy, tc.wantPolicy)
			}
			if opts.Delegation != tc.wantDel {
				t.Fatalf("delegation = %q, want %q", opts.Delegation, tc.wantDel)
			}
			if !opts.Interactive {
				t.Fatal("a Desktop turn is always interactive (ADR-0006 D3)")
			}
		})
	}
}

func TestValidModeRejectsUnknownValues(t *testing.T) {
	for _, mode := range []string{"", "ask", "agent", " ask "} {
		if !validMode(mode) {
			t.Fatalf("validMode(%q) = false, want true", mode)
		}
	}
	for _, mode := range []string{"root", "ASK", "auto"} {
		if validMode(mode) {
			t.Fatalf("validMode(%q) = true, want false", mode)
		}
	}
}

// The refusal must surface before anything reaches Core, and leave the session untouched.
func TestStartAgentRejectsInvalidMode(t *testing.T) {
	configPath := useConfigDir(t)
	writeFile(t, configPath, `{"model": "test/a", "providers": {"test": {"settings": {"baseURL": "http://127.0.0.1:1/v1"}, "models": {"a": {"modelID": "a", "limit": {"context": 65536, "output": 8192}}}}}}`)
	r := openRuntime(t, canonicalDir(t))
	session, err := r.CreateSession(t.Context(), "invalid mode")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := r.StartAgent(t.Context(), session.ID, AgentConfig{Mode: strings.Repeat("x", 3)}); err != ErrInvalidMode {
		t.Fatalf("err = %v, want ErrInvalidMode", err)
	}
	current, err := r.GetSession(t.Context(), session.ID)
	if err != nil {
		t.Fatal(err)
	}
	if current.Status == "running" {
		t.Fatal("a rejected Start changed the session state")
	}
}
