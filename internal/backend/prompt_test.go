package backend

import (
	"context"
	"errors"
	"path/filepath"
	"strings"
	"testing"
)

// effectiveLayer finds the layer of a kind in a result, failing when it is absent: every assembled
// prompt carries one layer per kind, included or not.
func effectiveLayer(t *testing.T, result EffectivePrompt, kind string) PromptLayer {
	t.Helper()
	for _, layer := range result.Layers {
		if layer.Kind == kind {
			return layer
		}
	}
	t.Fatalf("no %q layer in %+v", kind, result.Layers)
	return PromptLayer{}
}

func TestEffectivePromptNeedsAnOpenWorkspace(t *testing.T) {
	useConfigDir(t)
	_, err := New().EffectivePrompt(context.Background(), EffectivePromptRequest{Agent: "agent"})
	if !errors.Is(err, ErrNoWorkspace) {
		t.Fatalf("err=%v, want ErrNoWorkspace", err)
	}
}

// A project's AGENTS.md is found but not loaded while the workspace is untrusted, and loaded once
// the user trusts it (ADR-0013). Core decides; the page only shows the layer.
func TestEffectivePromptReportsProjectInstructionsByTrust(t *testing.T) {
	configPath := useConfigDir(t)
	workspace := canonicalDir(t)
	writeFile(t, configPath, `{"model": "test/a", "providers": {"test": {"settings": {"baseURL": "http://127.0.0.1:1/v1"}, "models": {"a": {}}}}}`)
	writeFile(t, filepath.Join(workspace, "AGENTS.md"), "Prefer small diffs.\n")

	r := openRuntime(t, workspace)

	untrusted, err := r.EffectivePrompt(context.Background(), EffectivePromptRequest{Agent: "agent", Policy: "workspace", Interactive: true})
	if err != nil {
		t.Fatal(err)
	}
	if untrusted.Trusted {
		t.Fatal("a fresh workspace reported as trusted")
	}
	if untrusted.Workspace != workspace {
		t.Fatalf("workspace=%q, want %q", untrusted.Workspace, workspace)
	}
	project := effectiveLayer(t, untrusted, "project-instructions")
	if project.Included || project.Bytes != 0 || project.Text != "" {
		t.Fatalf("untrusted project layer=%+v, want it withheld", project)
	}
	if project.Reason != "untrusted workspace" {
		t.Fatalf("reason=%q, want %q", project.Reason, "untrusted workspace")
	}
	if project.Scope != "project" {
		t.Fatalf("scope=%q, want project", project.Scope)
	}
	// The built-in layer is the base prompt: it is included even when nothing else is.
	if base := effectiveLayer(t, untrusted, "builtin"); !base.Included || base.Bytes == 0 {
		t.Fatalf("builtin layer=%+v, want it included", base)
	}

	state, err := r.ConfigState()
	if err != nil {
		t.Fatal(err)
	}
	if _, err := r.TrustWorkspace(state.GlobalDigest); err != nil {
		t.Fatal(err)
	}

	trusted, err := r.EffectivePrompt(context.Background(), EffectivePromptRequest{Agent: "agent", Policy: "workspace", Interactive: true})
	if err != nil {
		t.Fatal(err)
	}
	if !trusted.Trusted {
		t.Fatal("the trusted workspace reported as untrusted")
	}
	project = effectiveLayer(t, trusted, "project-instructions")
	if !project.Included || project.Bytes == 0 {
		t.Fatalf("trusted project layer=%+v, want it included", project)
	}
	if project.Reason != "" {
		t.Fatalf("included layer carries reason %q", project.Reason)
	}
	if !strings.Contains(project.Text, "Prefer small diffs.") || !strings.Contains(project.Text, "AGENTS.md") {
		t.Fatalf("project text=%q, want the file content and its path", project.Text)
	}
	if project.Bytes != len(project.Text) {
		t.Fatalf("bytes=%d, want len(text)=%d", project.Bytes, len(project.Text))
	}
}

// The tool list is Core's: every offered tool names its source, and the withheld ones say which
// filter removed them. Desktop groups the list by source without inventing entries.
func TestEffectivePromptReportsToolsWithSourceAndReason(t *testing.T) {
	configPath := useConfigDir(t)
	writeFile(t, configPath, `{"model": "test/a", "providers": {"test": {"settings": {"baseURL": "http://127.0.0.1:1/v1"}, "models": {"a": {}}}}}`)
	r := openRuntime(t, canonicalDir(t))

	result, err := r.EffectivePrompt(context.Background(), EffectivePromptRequest{
		Agent: "agent", Policy: "read-only", Interactive: true,
	})
	if err != nil {
		t.Fatal(err)
	}
	if result.Agent != "agent" || result.Policy != "read-only" {
		t.Fatalf("agent=%q policy=%q", result.Agent, result.Policy)
	}
	var withheld, offered *PromptTool
	for i := range result.Tools {
		switch result.Tools[i].Name {
		case "write_file":
			withheld = &result.Tools[i]
		case "read_file":
			offered = &result.Tools[i]
		}
	}
	// A read-only run offers the read tools and withholds the write ones, naming the filter.
	if withheld == nil || withheld.Included || withheld.Reason != "policy" {
		t.Fatalf("write_file=%+v, want it withheld by the policy", withheld)
	}
	if offered == nil || !offered.Included || offered.Source != "builtin" || offered.Permission != "read" {
		t.Fatalf("read_file=%+v, want it offered by the builtin source", offered)
	}
}

// The description follows the run the page describes: a conversation turn and a task run carry
// different base prompts, and an unknown agent is refused instead of being shown as something else.
func TestEffectivePromptRefusesUnknownAgent(t *testing.T) {
	configPath := useConfigDir(t)
	writeFile(t, configPath, `{"model": "test/a", "providers": {"test": {"settings": {"baseURL": "http://127.0.0.1:1/v1"}, "models": {"a": {}}}}}`)
	r := openRuntime(t, canonicalDir(t))

	_, err := r.EffectivePrompt(context.Background(), EffectivePromptRequest{Agent: "nope", Policy: "workspace"})
	if err == nil || !strings.Contains(err.Error(), "nope") {
		t.Fatalf("err=%v, want a refusal naming the agent", err)
	}
}
