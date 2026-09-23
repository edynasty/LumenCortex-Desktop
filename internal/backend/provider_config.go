package backend

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"time"
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
	ErrLiteralProviderSecret = errors.New("literal provider API keys cannot be persisted; use {env:VAR_NAME}")
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

type DiscoveredModel struct {
	ID string `json:"id"`
}

type ProviderConnectionResult struct {
	OK     bool   `json:"ok"`
	Models int    `json:"models"`
	Message string `json:"message"`
}

type ProviderSecretStatus struct {
	Configured bool `json:"configured"`
	Available  bool `json:"available"`
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

func globalProviderConfigPath() (string, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(home, ".config", "lumencortex", ProviderConfigFilename), nil
}

func loadProviderCatalog(workspace string) (ProviderCatalog, error) {
	globalPath, err := globalProviderConfigPath()
	if err != nil {
		return ProviderCatalog{}, err
	}
	global, err := loadProviderCatalogFile(globalPath)
	if err != nil {
		return ProviderCatalog{}, err
	}

	if strings.TrimSpace(workspace) == "" {
		return global, nil
	}

	project, err := loadProviderCatalogFile(providerConfigPath(workspace))
	if err != nil {
		return ProviderCatalog{}, err
	}
	return mergeProviderCatalogs(global, project), nil
}

func loadProviderCatalogFile(path string) (ProviderCatalog, error) {
	data, err := os.ReadFile(path)
	if errors.Is(err, os.ErrNotExist) {
		return defaultProviderCatalog(), nil
	}
	if err != nil {
		return ProviderCatalog{}, err
	}

	var catalog ProviderCatalog
	if err := json.Unmarshal(data, &catalog); err != nil {
		return ProviderCatalog{}, fmt.Errorf("parse %s: %w", path, err)
	}
	if catalog.Schema == "" {
		catalog.Schema = ProviderConfigSchema
	}
	if catalog.Providers == nil {
		catalog.Providers = map[string]ProviderDefinition{}
	}
	if err := validateProviderCatalog(catalog); err != nil {
		return ProviderCatalog{}, fmt.Errorf("%s: %w", path, err)
	}
	return catalog, nil
}

func mergeProviderCatalogs(base, override ProviderCatalog) ProviderCatalog {
	merged := cloneProviderCatalog(base)
	if override.Schema != "" {
		merged.Schema = override.Schema
	}
	if override.Model != "" {
		merged.Model = override.Model
	}
	for providerID, provider := range override.Providers {
		if existing, ok := merged.Providers[providerID]; ok {
			merged.Providers[providerID] = mergeProviderDefinition(existing, provider)
		} else {
			merged.Providers[providerID] = cloneProviderDefinition(provider)
		}
	}
	return merged
}

func mergeProviderDefinition(base, override ProviderDefinition) ProviderDefinition {
	merged := cloneProviderDefinition(base)
	if override.Name != "" {
		merged.Name = override.Name
	}
	if override.Package != "" {
		merged.Package = override.Package
	}
	if override.Settings.BaseURL != "" {
		merged.Settings.BaseURL = override.Settings.BaseURL
	}
	if override.Settings.Endpoint != "" {
		merged.Settings.Endpoint = override.Settings.Endpoint
	}
	if override.Settings.APIKey != "" {
		merged.Settings.APIKey = override.Settings.APIKey
	}
	if merged.Models == nil {
		merged.Models = map[string]ProviderModel{}
	}
	for modelID, model := range override.Models {
		merged.Models[modelID] = model
	}
	return merged
}

func cloneProviderCatalog(catalog ProviderCatalog) ProviderCatalog {
	cloned := ProviderCatalog{
		Schema:    catalog.Schema,
		Model:     catalog.Model,
		Providers: map[string]ProviderDefinition{},
	}
	if cloned.Schema == "" {
		cloned.Schema = ProviderConfigSchema
	}
	for providerID, provider := range catalog.Providers {
		cloned.Providers[providerID] = cloneProviderDefinition(provider)
	}
	return cloned
}

func cloneProviderDefinition(provider ProviderDefinition) ProviderDefinition {
	cloned := provider
	cloned.Models = map[string]ProviderModel{}
	for modelID, model := range provider.Models {
		cloned.Models[modelID] = model
	}
	return cloned
}

func saveProviderCatalog(workspace string, catalog ProviderCatalog) error {
	var path string
	if strings.TrimSpace(workspace) == "" {
		globalPath, err := globalProviderConfigPath()
		if err != nil {
			return err
		}
		path = globalPath
	} else {
		path = providerConfigPath(workspace)
	}
	return saveProviderCatalogFile(path, catalog)
}

func saveProviderCatalogFile(path string, catalog ProviderCatalog) error {
	if catalog.Schema == "" {
		catalog.Schema = ProviderConfigSchema
	}
	if catalog.Providers == nil {
		catalog.Providers = map[string]ProviderDefinition{}
	}
	if err := validateProviderCatalogForSave(catalog); err != nil {
		return err
	}

	data, err := json.MarshalIndent(catalog, "", "  ")
	if err != nil {
		return err
	}
	data = append(data, '\n')

	dir := filepath.Dir(path)
	if err := os.MkdirAll(dir, 0o700); err != nil {
		return err
	}
	tmp, err := os.CreateTemp(dir, ".lumencortex-config-*.json")
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
	return os.Rename(tmpName, path)
}

func loadProviderCatalogScope(workspace, scope string) (ProviderCatalog, error) {
	switch strings.TrimSpace(scope) {
	case "", "global":
		path, err := globalProviderConfigPath()
		if err != nil {
			return ProviderCatalog{}, err
		}
		return loadProviderCatalogFile(path)
	case "workspace":
		if strings.TrimSpace(workspace) == "" {
			return ProviderCatalog{}, ErrNoWorkspace
		}
		return loadProviderCatalogFile(providerConfigPath(workspace))
	default:
		return ProviderCatalog{}, fmt.Errorf("invalid provider config scope %q", scope)
	}
}

func saveProviderCatalogScope(workspace, scope string, catalog ProviderCatalog) error {
	switch strings.TrimSpace(scope) {
	case "", "global":
		path, err := globalProviderConfigPath()
		if err != nil {
			return err
		}
		return saveProviderCatalogFile(path, catalog)
	case "workspace":
		if strings.TrimSpace(workspace) == "" {
			return ErrNoWorkspace
		}
		return saveProviderCatalogFile(providerConfigPath(workspace), catalog)
	default:
		return fmt.Errorf("invalid provider config scope %q", scope)
	}
}

func validateProviderCatalogForSave(catalog ProviderCatalog) error {
	if err := validateProviderCatalog(catalog); err != nil {
		return err
	}
	for providerID, provider := range catalog.Providers {
		value := strings.TrimSpace(provider.Settings.APIKey)
		if value == "" {
			continue
		}
		if !strings.HasPrefix(value, "{env:") || !strings.HasSuffix(value, "}") {
			return fmt.Errorf("%s: %w", providerID, ErrLiteralProviderSecret)
		}
		name := strings.TrimSpace(strings.TrimSuffix(strings.TrimPrefix(value, "{env:"), "}"))
		if name == "" {
			return fmt.Errorf("%s: %w", providerID, ErrLiteralProviderSecret)
		}
	}
	return nil
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

func providerSecretStatuses(catalog ProviderCatalog) map[string]ProviderSecretStatus {
	statuses := make(map[string]ProviderSecretStatus, len(catalog.Providers))
	for providerID, provider := range catalog.Providers {
		value := strings.TrimSpace(provider.Settings.APIKey)
		statuses[providerID] = ProviderSecretStatus{
			Configured: value != "",
			Available:  value == "" || resolveEnvReference(value) != "",
		}
	}
	return statuses
}


func providerModelsURL(provider ProviderDefinition) (string, error) {
	base := strings.TrimSpace(provider.Settings.BaseURL)
	if base == "" {
		endpoint := strings.TrimSpace(provider.Settings.Endpoint)
		if endpoint != "" {
			base = strings.TrimSuffix(endpoint, "/chat/completions")
		}
	}
	if base == "" {
		return "", errors.New("provider baseURL is required for model discovery")
	}
	parsed, err := url.Parse(base)
	if err != nil || parsed.Scheme == "" || parsed.Host == "" {
		return "", errors.New("provider baseURL is invalid")
	}
	parsed.Path = strings.TrimRight(parsed.Path, "/") + "/models"
	parsed.RawQuery = ""
	parsed.Fragment = ""
	return parsed.String(), nil
}

func discoverProviderModels(catalog ProviderCatalog, providerID string) ([]DiscoveredModel, error) {
	provider, ok := catalog.Providers[providerID]
	if !ok {
		return nil, fmt.Errorf("%s: %w", providerID, ErrProviderNotFound)
	}
	if !supportedProviderPackage(provider.Package) {
		return nil, fmt.Errorf("%s: %w", providerID, ErrProviderUnsupported)
	}
	modelsURL, err := providerModelsURL(provider)
	if err != nil {
		return nil, err
	}
	req, err := http.NewRequest(http.MethodGet, modelsURL, nil)
	if err != nil {
		return nil, err
	}
	if key := resolveEnvReference(provider.Settings.APIKey); key != "" {
		req.Header.Set("Authorization", "Bearer "+key)
	}
	req.Header.Set("Accept", "application/json")

	client := &http.Client{Timeout: 12 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(io.LimitReader(resp.Body, 2<<20))
	if err != nil {
		return nil, err
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("provider models request failed: status=%d body=%s", resp.StatusCode, strings.TrimSpace(string(body)))
	}
	var payload struct {
		Data []struct {
			ID string `json:"id"`
		} `json:"data"`
	}
	if err := json.Unmarshal(body, &payload); err != nil {
		return nil, fmt.Errorf("parse provider models response: %w", err)
	}
	out := make([]DiscoveredModel, 0, len(payload.Data))
	seen := map[string]bool{}
	for _, item := range payload.Data {
		id := strings.TrimSpace(item.ID)
		if id == "" || seen[id] {
			continue
		}
		seen[id] = true
		out = append(out, DiscoveredModel{ID: id})
		if len(out) >= 500 {
			break
		}
	}
	return out, nil
}
