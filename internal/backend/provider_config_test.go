package backend

import (
	"errors"
	"net/http"
	"net/http/httptest"
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


func TestProviderCatalogScopeReadsAndWritesRawSources(t *testing.T) {
	home := t.TempDir()
	t.Setenv("HOME", home)
	workspace := t.TempDir()

	global := ProviderCatalog{
		Model: "global/g",
		Providers: map[string]ProviderDefinition{
			"global": {
				Package: "openai-compatible",
				Models: map[string]ProviderModel{
					"g": {ModelID: "global-model"},
				},
			},
		},
	}
	if err := saveProviderCatalogScope(workspace, "global", global); err != nil {
		t.Fatal(err)
	}

	project := ProviderCatalog{
		Model: "project/p",
		Providers: map[string]ProviderDefinition{
			"project": {
				Package: "openai-compatible",
				Models: map[string]ProviderModel{
					"p": {ModelID: "project-model"},
				},
			},
		},
	}
	if err := saveProviderCatalogScope(workspace, "workspace", project); err != nil {
		t.Fatal(err)
	}

	gotGlobal, err := loadProviderCatalogScope(workspace, "global")
	if err != nil {
		t.Fatal(err)
	}
	if gotGlobal.Model != "global/g" || gotGlobal.Providers["project"].Models != nil {
		t.Fatalf("unexpected raw global config: %#v", gotGlobal)
	}

	gotProject, err := loadProviderCatalogScope(workspace, "workspace")
	if err != nil {
		t.Fatal(err)
	}
	if gotProject.Model != "project/p" || gotProject.Providers["global"].Models != nil {
		t.Fatalf("unexpected raw project config: %#v", gotProject)
	}

	effective, err := loadProviderCatalog(workspace)
	if err != nil {
		t.Fatal(err)
	}
	if effective.Model != "project/p" {
		t.Fatalf("effective model=%q", effective.Model)
	}
	if _, ok := effective.Providers["global"].Models["g"]; !ok {
		t.Fatalf("global provider missing from effective catalog: %#v", effective)
	}
	if _, ok := effective.Providers["project"].Models["p"]; !ok {
		t.Fatalf("project provider missing from effective catalog: %#v", effective)
	}
}


func TestProviderCatalogRejectsLiteralAPIKeyOnSave(t *testing.T) {
	t.Setenv("HOME", t.TempDir())
	catalog := ProviderCatalog{
		Providers: map[string]ProviderDefinition{
			"demo": {
				Package: "openai-compatible",
				Settings: ProviderSettings{APIKey: "sk-literal-secret"},
			},
		},
	}
	err := saveProviderCatalog("", catalog)
	if !errors.Is(err, ErrLiteralProviderSecret) {
		t.Fatalf("err=%v, want ErrLiteralProviderSecret", err)
	}
}

func TestProviderCatalogAllowsEnvironmentSecretReference(t *testing.T) {
	t.Setenv("HOME", t.TempDir())
	catalog := ProviderCatalog{
		Providers: map[string]ProviderDefinition{
			"demo": {
				Package: "openai-compatible",
				Settings: ProviderSettings{APIKey: "{env:DEMO_API_KEY}"},
			},
		},
	}
	if err := saveProviderCatalog("", catalog); err != nil {
		t.Fatal(err)
	}
}


func TestProviderSecretStatusesDoNotExposeValues(t *testing.T) {
	t.Setenv("AVAILABLE_PROVIDER_KEY", "secret-value")
	catalog := ProviderCatalog{
		Providers: map[string]ProviderDefinition{
			"ready": {
				Settings: ProviderSettings{APIKey: "{env:AVAILABLE_PROVIDER_KEY}"},
			},
			"missing": {
				Settings: ProviderSettings{APIKey: "{env:MISSING_PROVIDER_KEY}"},
			},
			"anonymous": {},
		},
	}

	statuses := providerSecretStatuses(catalog)
	if got := statuses["ready"]; !got.Configured || !got.Available {
		t.Fatalf("ready=%#v", got)
	}
	if got := statuses["missing"]; !got.Configured || got.Available {
		t.Fatalf("missing=%#v", got)
	}
	if got := statuses["anonymous"]; got.Configured || !got.Available {
		t.Fatalf("anonymous=%#v", got)
	}
}

func TestDiscoverProviderModelsUsesEnvSecretAndBoundsCatalog(t *testing.T) {
	t.Setenv("DEMO_DISCOVERY_KEY", "secret")
	var authorization string
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		authorization = req.Header.Get("Authorization")
		if req.URL.Path != "/v1/models" {
			t.Fatalf("path=%s", req.URL.Path)
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"data":[{"id":"model-a"},{"id":"org/model-b"},{"id":"model-a"}]}`))
	}))
	defer server.Close()

	catalog := ProviderCatalog{
		Providers: map[string]ProviderDefinition{
			"demo": {
				Package: "openai-compatible",
				Settings: ProviderSettings{
					BaseURL: server.URL + "/v1",
					APIKey: "{env:DEMO_DISCOVERY_KEY}",
				},
			},
		},
	}
	models, err := discoverProviderModels(catalog, "demo")
	if err != nil {
		t.Fatal(err)
	}
	if authorization != "Bearer secret" {
		t.Fatalf("authorization=%q", authorization)
	}
	if len(models) != 2 || models[0].ID != "model-a" || models[1].ID != "org/model-b" {
		t.Fatalf("models=%#v", models)
	}
}
