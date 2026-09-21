package backend

import (
	"path/filepath"
	"testing"
)

func TestProviderCatalogMergesGlobalAndWorkspace(t *testing.T) {
	home := t.TempDir()
	t.Setenv("HOME", home)

	global := ProviderCatalog{
		Model: "demo/global",
		Providers: map[string]ProviderDefinition{
			"demo": {
				Name:    "Demo",
				Package: "openai-compatible",
				Settings: ProviderSettings{
					BaseURL: "https://global.example/v1",
					APIKey:  "{env:DEMO_KEY}",
				},
				Models: map[string]ProviderModel{
					"global": {Name: "Global", ModelID: "global-model"},
				},
			},
		},
	}
	if err := saveProviderCatalog("", global); err != nil {
		t.Fatal(err)
	}

	globalPath := filepath.Join(home, ".config", "lumencortex", ProviderConfigFilename)
	if got, err := loadProviderCatalog(""); err != nil {
		t.Fatal(err)
	} else if got.Model != "demo/global" {
		t.Fatalf("global model=%q config=%s", got.Model, globalPath)
	}

	workspace := t.TempDir()
	project := ProviderCatalog{
		Model: "demo/project",
		Providers: map[string]ProviderDefinition{
			"demo": {
				Settings: ProviderSettings{
					BaseURL: "https://project.example/v1",
				},
				Models: map[string]ProviderModel{
					"project": {Name: "Project", ModelID: "project-model"},
				},
			},
		},
	}
	if err := saveProviderCatalog(workspace, project); err != nil {
		t.Fatal(err)
	}

	got, err := loadProviderCatalog(workspace)
	if err != nil {
		t.Fatal(err)
	}
	if got.Model != "demo/project" {
		t.Fatalf("effective model=%q", got.Model)
	}
	provider := got.Providers["demo"]
	if provider.Name != "Demo" {
		t.Fatalf("provider name=%q", provider.Name)
	}
	if provider.Package != "openai-compatible" {
		t.Fatalf("provider package=%q", provider.Package)
	}
	if provider.Settings.BaseURL != "https://project.example/v1" {
		t.Fatalf("baseURL=%q", provider.Settings.BaseURL)
	}
	if provider.Settings.APIKey != "{env:DEMO_KEY}" {
		t.Fatalf("apiKey=%q", provider.Settings.APIKey)
	}
	if provider.Models["global"].ModelID != "global-model" {
		t.Fatalf("missing global model: %#v", provider.Models)
	}
	if provider.Models["project"].ModelID != "project-model" {
		t.Fatalf("missing project model: %#v", provider.Models)
	}
}
