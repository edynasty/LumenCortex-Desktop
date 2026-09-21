package backend

import (
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

const (
	ProviderConfigFilename = "lumencortex.json"
	ProviderConfigSchema   = "https://raw.githubusercontent.com/edynasty/LumenCortex-Desktop/main/docs/lumencortex.schema.json"
)

var (
	ErrInvalidModelRef      = errors.New("invalid model reference; expected provider/model")
	ErrProviderNotFound     = errors.New("provider not found")
	ErrProviderModelMissing = errors.New("provider model not found")
	ErrProviderUnsupported  = errors.New("provider package is not supported")
)

type ProviderCatalog struct {
	Schema    string                        `json:"$schema,omitempty"`
	Model     string                        `json:"model,omitempty"`
	Providers map[string]ProviderDefinition `json:"providers,omitempty"`
}

type ProviderDefinition struct {
	Name     string                   `json:"name,omitempty"`
	Package  string                   `json:"package,omitempty"`
	Settings ProviderSettings         `json:"settings,omitempty"`
	Models   map[string]ProviderModel `json:"models,omitempty"`
}

type ProviderSettings struct {
	BaseURL  string `json:"baseURL,omitempty"`
	Endpoint string `json:"endpoint,omitempty"`
	APIKey   string `json:"apiKey,omitempty"`
}

type ProviderModel struct {
	Name    string      `json:"name,omitempty"`
	ModelID string      `json:"modelID,omitempty"`
	Limit   *ModelLimit `json:"limit,omitempty"`
}

type ModelLimit struct {
	Context int `json:"context,omitempty"`
	Output  int `json:"output,omitempty"`
}

func defaultProviderCatalog() ProviderCatalog {
	return ProviderCatalog{
		Schema:    ProviderConfigSchema,
		Providers: map[string]ProviderDefinition{},
	}
}

func providerConfigPath(workspace string) string {
	return filepath.Join(workspace, ProviderConfigFilename)
}

func loadProviderCatalog(workspace string) (ProviderCatalog, error) {
	if strings.TrimSpace(workspace) == "" {
		return ProviderCatalog{}, ErrNoWorkspace
	}
	path := providerConfigPath(workspace)
	data, err := os.ReadFile(path)
	if errors.Is(err, os.ErrNotExist) {
		return defaultProviderCatalog(), nil
	}
	if err != nil {
		return ProviderCatalog{}, err
	}

	var catalog ProviderCatalog
	if err := json.Unmarshal(data, &catalog); err != nil {
		return ProviderCatalog{}, fmt.Errorf("parse %s: %w", ProviderConfigFilename, err)
	}
	if catalog.Schema == "" {
		catalog.Schema = ProviderConfigSchema
	}
	if catalog.Providers == nil {
		catalog.Providers = map[string]ProviderDefinition{}
	}
	if err := validateProviderCatalog(catalog); err != nil {
		return ProviderCatalog{}, err
	}
	return catalog, nil
}

func saveProviderCatalog(workspace string, catalog ProviderCatalog) error {
	if strings.TrimSpace(workspace) == "" {
		return ErrNoWorkspace
	}
	if catalog.Schema == "" {
		catalog.Schema = ProviderConfigSchema
	}
	if catalog.Providers == nil {
		catalog.Providers = map[string]ProviderDefinition{}
	}
	if err := validateProviderCatalog(catalog); err != nil {
		return err
	}

	data, err := json.MarshalIndent(catalog, "", "  ")
	if err != nil {
		return err
	}
	data = append(data, '\n')

	tmp, err := os.CreateTemp(workspace, ".lumencortex-config-*.json")
	if err != nil {
		return err
	}
	tmpName := tmp.Name()
	defer os.Remove(tmpName)

	if err := tmp.Chmod(0o600); err != nil {
		_ = tmp.Close()
		return err
	}
	if _, err := tmp.Write(data); err != nil {
		_ = tmp.Close()
		return err
	}
	if err := tmp.Sync(); err != nil {
		_ = tmp.Close()
		return err
	}
	if err := tmp.Close(); err != nil {
		return err
	}
	return os.Rename(tmpName, providerConfigPath(workspace))
}

func validateProviderCatalog(catalog ProviderCatalog) error {
	if catalog.Model != "" {
		if _, _, err := splitModelRef(catalog.Model); err != nil {
			return fmt.Errorf("default model %q: %w", catalog.Model, err)
		}
	}
	for providerID, provider := range catalog.Providers {
		if strings.TrimSpace(providerID) == "" || strings.Contains(providerID, "/") {
			return fmt.Errorf("invalid provider id %q", providerID)
		}
		if !supportedProviderPackage(provider.Package) {
			return fmt.Errorf("%s: %w: %s", providerID, ErrProviderUnsupported, provider.Package)
		}
		for modelID := range provider.Models {
			if strings.TrimSpace(modelID) == "" || strings.Contains(modelID, "/") {
				return fmt.Errorf("invalid model id %q for provider %q", modelID, providerID)
			}
		}
	}
	return nil
}

func supportedProviderPackage(value string) bool {
	switch strings.TrimSpace(value) {
	case "", "openai-compatible", "@opencode/ai/providers/openai-compatible", "@ai-sdk/openai-compatible":
		return true
	default:
		return false
	}
}

func splitModelRef(ref string) (string, string, error) {
	ref = strings.TrimSpace(ref)
	providerID, modelID, ok := strings.Cut(ref, "/")
	if !ok || strings.TrimSpace(providerID) == "" || strings.TrimSpace(modelID) == "" {
		return "", "", ErrInvalidModelRef
	}
	return strings.TrimSpace(providerID), strings.TrimSpace(modelID), nil
}

func resolveCatalogProvider(catalog ProviderCatalog, ref string) (ProviderConfig, string, error) {
	if strings.TrimSpace(ref) == "" {
		ref = catalog.Model
	}
	providerID, modelKey, err := splitModelRef(ref)
	if err != nil {
		return ProviderConfig{}, "", err
	}

	provider, ok := catalog.Providers[providerID]
	if !ok {
		return ProviderConfig{}, "", fmt.Errorf("%s: %w", providerID, ErrProviderNotFound)
	}
	if !supportedProviderPackage(provider.Package) {
		return ProviderConfig{}, "", fmt.Errorf("%s: %w", providerID, ErrProviderUnsupported)
	}
	model, ok := provider.Models[modelKey]
	if !ok {
		return ProviderConfig{}, "", fmt.Errorf("%s: %w", ref, ErrProviderModelMissing)
	}

	modelID := strings.TrimSpace(model.ModelID)
	if modelID == "" {
		modelID = modelKey
	}
	return ProviderConfig{
		BaseURL:  provider.Settings.BaseURL,
		Endpoint: provider.Settings.Endpoint,
		APIKey:   resolveEnvReference(provider.Settings.APIKey),
		Model:    modelID,
	}, providerID, nil
}

func resolveEnvReference(value string) string {
	value = strings.TrimSpace(value)
	if strings.HasPrefix(value, "{env:") && strings.HasSuffix(value, "}") {
		name := strings.TrimSpace(strings.TrimSuffix(strings.TrimPrefix(value, "{env:"), "}"))
		if name == "" {
			return ""
		}
		return os.Getenv(name)
	}
	return value
}
