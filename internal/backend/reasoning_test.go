package backend

import (
	"errors"
	"strings"
	"testing"

	"github.com/edynasty/LumenCortex/config"
)

func TestReasoningFormatsFollowThePackage(t *testing.T) {
	anthropic := ReasoningFormats("anthropic-messages")
	if len(anthropic) != 2 || anthropic[0] != "" || anthropic[1] != "adaptive" {
		t.Fatalf("anthropic-messages=%v, want [\"\" adaptive]", anthropic)
	}
	openai := ReasoningFormats("openai-compatible")
	if len(openai) != 5 || openai[0] != "" || openai[1] != "none" {
		t.Fatalf("openai-compatible=%v", openai)
	}
	// "" and the legacy ids select openai-compatible, as Core's NormalizePackage documents.
	if got := ReasoningFormats(""); len(got) != len(openai) {
		t.Fatalf("empty package=%v, want the openai-compatible list", got)
	}
	if got := ReasoningFormats("no-such-package"); len(got) != 0 {
		t.Fatalf("unknown package=%v, want no values", got)
	}
	// The caller owns the slice: editing it must not corrupt the next call.
	openai[1] = "tampered"
	if ReasoningFormats("openai-compatible")[1] != "none" {
		t.Fatal("ReasoningFormats leaked its slice")
	}
}

// The panel's levels and the per-format restrictions come from Core: adaptive thinking accepts
// neither none nor minimal, every other anthropic-messages format the whole ladder.
func TestReasoningEffortsFollowTheFormat(t *testing.T) {
	got := ReasoningEfforts("anthropic-messages")
	ladder := strings.Join(got.Levels, ",")
	if ladder != "none,minimal,low,medium,high,xhigh,max" {
		t.Fatalf("levels=%s", ladder)
	}
	if adaptive := strings.Join(got.Accepted["adaptive"], ","); adaptive != "low,medium,high,xhigh,max" {
		t.Fatalf("adaptive accepts %s", adaptive)
	}
	if budget := strings.Join(got.Accepted[""], ","); budget != ladder {
		t.Fatalf("package default accepts %s", budget)
	}
	if len(got.Accepted) != 2 {
		t.Fatalf("accepted=%v, want one entry per anthropic-messages format", got.Accepted)
	}
	if unknown := ReasoningEfforts("no-such-package"); len(unknown.Accepted) != 0 {
		t.Fatalf("unknown package accepted=%v", unknown.Accepted)
	}
}

// A saved reasoning object is what Core reloads: adaptive for an anthropic-messages model survives
// the round trip, and its unedited echo stays in the file.
func TestSaveProviderCatalogScopeRoundTripsReasoning(t *testing.T) {
	configPath := useConfigDir(t)
	writeFile(t, configPath, `{"providers": {"local-anthropic": {
  "package": "anthropic-messages",
  "settings": {"baseURL": "http://127.0.0.1:1"},
  "models": {"opus": {"modelID": "claude-opus", "reasoning": {"echo": "none"}}}}}}`)

	r := New()
	doc, err := r.ProviderCatalogScope("global")
	if err != nil {
		t.Fatal(err)
	}
	provider := doc.Catalog.Providers["local-anthropic"]
	model := provider.Models["opus"]
	model.Reasoning = &ModelReasoning{Format: "adaptive", Efforts: []string{"low", "medium", "high"}}
	provider.Models["opus"] = model
	doc.Catalog.Providers["local-anthropic"] = provider

	saved, err := r.SaveProviderCatalogScope("global", doc)
	if err != nil {
		t.Fatal(err)
	}
	got := saved.Catalog.Providers["local-anthropic"].Models["opus"].Reasoning
	if got == nil || got.Format != "adaptive" || strings.Join(got.Efforts, ",") != "low,medium,high" {
		t.Fatalf("saved reasoning=%+v", got)
	}

	// Core's own reader sees the format, and its resolver reports it for the model.
	reloaded, err := config.Load("")
	if err != nil {
		t.Fatal(err)
	}
	resolved, err := reloaded.Resolve("local-anthropic/opus")
	if err != nil {
		t.Fatal(err)
	}
	if resolved.ReasoningFormat != "adaptive" {
		t.Fatalf("Core resolved reasoningFormat=%q, want adaptive", resolved.ReasoningFormat)
	}
	if len(resolved.Efforts) != 3 || resolved.Efforts[0] != "low" {
		t.Fatalf("Core resolved efforts=%v", resolved.Efforts)
	}
	// echo is outside the DTO and must survive the save untouched.
	if !strings.Contains(readFile(t, configPath), `"echo": "none"`) {
		t.Fatalf("save dropped reasoning.echo:\n%s", readFile(t, configPath))
	}
}

// Core refuses adaptive with none or minimal at load time; the save refuses it first, so the file on disk
// stays loadable and the panel can show the reason.
func TestSaveProviderCatalogScopeRefusesReasoningCoreWouldReject(t *testing.T) {
	cases := map[string]struct {
		pkg     string
		format  string
		efforts []string
		want    string
	}{
		"adaptive with none":        {"anthropic-messages", "adaptive", []string{"low", "none"}, "reasoning.efforts"},
		"adaptive with minimal":     {"anthropic-messages", "adaptive", []string{"minimal", "high"}, "reasoning.efforts[0]"},
		"format of another package": {"anthropic-messages", "deepseek", nil, "reasoning.format"},
	}
	for name, tc := range cases {
		t.Run(name, func(t *testing.T) {
			configPath := useConfigDir(t)
			writeFile(t, configPath, `{"providers": {"p": {
  "package": "`+tc.pkg+`",
  "settings": {"baseURL": "http://127.0.0.1:1"},
  "models": {"m": {"modelID": "upstream"}}}}}`)
			before := readFile(t, configPath)

			r := New()
			doc, err := r.ProviderCatalogScope("global")
			if err != nil {
				t.Fatal(err)
			}
			provider := doc.Catalog.Providers["p"]
			model := provider.Models["m"]
			model.Reasoning = &ModelReasoning{Format: tc.format, Efforts: tc.efforts}
			provider.Models["m"] = model
			doc.Catalog.Providers["p"] = provider

			_, err = r.SaveProviderCatalogScope("global", doc)
			if !errors.Is(err, config.ErrInvalidConfig) {
				t.Fatalf("err=%v, want config.ErrInvalidConfig", err)
			}
			if !strings.Contains(err.Error(), "providers.p.models.m."+tc.want) {
				t.Fatalf("err=%v, want it to name %s", err, tc.want)
			}
			if readFile(t, configPath) != before {
				t.Fatal("a refused save changed the file")
			}
		})
	}
}

// A model that declares no reasoning is written without a reasoning object, and an echo-only
// object keeps its echo instead of gaining an empty format.
func TestSaveProviderCatalogScopeLeavesEmptyReasoningOut(t *testing.T) {
	configPath := useConfigDir(t)
	writeFile(t, configPath, `{"providers": {"p": {
  "settings": {"baseURL": "http://127.0.0.1:1"},
  "models": {"m": {}, "e": {"reasoning": {"echo": "none"}}}}}}`)
	r := New()
	doc, err := r.ProviderCatalogScope("global")
	if err != nil {
		t.Fatal(err)
	}
	saved, err := r.SaveProviderCatalogScope("global", doc)
	if err != nil {
		t.Fatal(err)
	}
	if saved.Catalog.Providers["p"].Models["m"].Reasoning != nil {
		t.Fatalf("reasoning=%+v, want none", saved.Catalog.Providers["p"].Models["m"].Reasoning)
	}
	raw := readFile(t, configPath)
	if strings.Count(raw, `"reasoning"`) != 1 || !strings.Contains(raw, `"echo": "none"`) {
		t.Fatalf("saved file:\n%s", raw)
	}
}
