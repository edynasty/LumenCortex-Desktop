package backend

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"path/filepath"
	"slices"
	"strings"
	"time"

	"github.com/edynasty/LumenCortex/config"
	coredocs "github.com/edynasty/LumenCortex/docs"
)

// This file is the Desktop adapter over Core's config package. Core is the one reader, merger and
// writer of lumencortex.json; nothing here parses, merges or validates configuration on its own
// beyond translating between Core's File and the v1-shaped editing DTO the provider panel uses.

// ProviderConfigFilename is the name of the global and the workspace configuration file.
const ProviderConfigFilename = config.FileName

// ProviderConfigSchema is the $id of Core's canonical schema (docs/lumencortex.schema.json), the
// value a new file carries in $schema.
var ProviderConfigSchema = schemaID()

func schemaID() string {
	var doc struct {
		ID string `json:"$id"`
	}
	_ = json.Unmarshal(coredocs.ConfigSchema, &doc)
	return doc.ID
}

// ModelInfo is Core's picker row: it carries no credential and no header.
type ModelInfo = config.ModelInfo

// ConfigWarning is Core's structured configuration warning.
type ConfigWarning = config.Warning

// ConfigState is what the UI needs to pick a model and to explain what Core ignored.
type ConfigState struct {
	Workspace     string          `json:"workspace"`
	Trusted       bool            `json:"trusted"`
	Model         string          `json:"model"`
	SubagentModel string          `json:"subagentModel,omitempty"`
	Failover      []string        `json:"failover"`
	Models        []ModelInfo     `json:"models"`
	Warnings      []ConfigWarning `json:"warnings"`
	GlobalPath    string          `json:"globalPath"`
	GlobalDigest  string          `json:"globalDigest"`
}

// ProviderCatalogDocument is one configuration file as the provider panel edits it. Digest is the
// identity the file had when it was read; saving sends it back so a concurrent change is a conflict.
type ProviderCatalogDocument struct {
	Scope   string          `json:"scope"`
	Path    string          `json:"path"`
	Digest  string          `json:"digest"`
	Catalog ProviderCatalog `json:"catalog"`
}

// ProviderCatalog is the editable subset of a configuration file. Fields outside it (failover,
// subagentModel, effort, checks, trustedWorkspaces, headers, timeouts, reasoning, toolCalling,
// modalities) are never part of the DTO and survive every save.
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

// ProviderSettings holds the editable connection fields. APIKey is an {env:NAME} reference, never a key.
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
	OK      bool   `json:"ok"`
	Models  int    `json:"models"`
	Message string `json:"message"`
}

// ConfigState loads the effective configuration of the open workspace ("" when none is open).
func (r *Runtime) ConfigState() (ConfigState, error) {
	cfg, err := config.Load(r.currentWorkspace())
	if err != nil {
		return ConfigState{}, err
	}
	return configState(cfg), nil
}

func configState(cfg *config.Config) ConfigState {
	eff := cfg.Effective()
	global := cfg.Global()
	state := ConfigState{
		Workspace:     eff.Workspace,
		Trusted:       eff.Trusted,
		Model:         string(eff.Model),
		SubagentModel: string(eff.SubagentModel),
		Failover:      make([]string, 0, len(eff.Failover)),
		Models:        cfg.Catalog(),
		Warnings:      append([]ConfigWarning{}, eff.Warnings...),
		GlobalPath:    global.Path,
		GlobalDigest:  global.Digest,
	}
	for _, ref := range eff.Failover {
		state.Failover = append(state.Failover, string(ref))
	}
	if state.Models == nil {
		state.Models = []ModelInfo{}
	}
	// default_limit is reported per resolved model, not on the merged view.
	for _, info := range state.Models {
		if resolved, err := cfg.Resolve(info.Ref); err == nil {
			state.Warnings = append(state.Warnings, resolved.Warnings...)
		}
	}
	return state
}

// TrustWorkspace lists the open workspace in the global trustedWorkspaces. globalDigest is the
// GlobalDigest the UI last saw; a changed file is config.ErrConflict and nothing is written.
func (r *Runtime) TrustWorkspace(globalDigest string) (ConfigState, error) {
	workspace := r.currentWorkspace()
	if workspace == "" {
		return ConfigState{}, ErrNoWorkspace
	}
	cfg, err := config.Load(workspace)
	if err != nil {
		return ConfigState{}, err
	}
	eff := cfg.Effective()
	global := cfg.Global()
	if global.Digest != globalDigest {
		return ConfigState{}, fmt.Errorf("%w: %s", config.ErrConflict, global.Path)
	}
	if !eff.Trusted {
		file := global.File
		file.TrustedWorkspaces = append(slices.Clone(file.TrustedWorkspaces), eff.Workspace)
		if file.Schema == "" {
			file.Schema = ProviderConfigSchema
		}
		if _, err := config.Save(global.Path, file, globalDigest); err != nil {
			return ConfigState{}, err
		}
	}
	return r.ConfigState()
}

func (r *Runtime) currentWorkspace() string {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return r.workspace
}

func (r *Runtime) scopePath(scope string) (string, error) {
	switch strings.TrimSpace(scope) {
	case "", "global":
		dir, err := config.GlobalDir()
		if err != nil {
			return "", err
		}
		return filepath.Join(dir, config.FileName), nil
	case "workspace":
		workspace := r.currentWorkspace()
		if workspace == "" {
			return "", ErrNoWorkspace
		}
		return filepath.Join(workspace, config.FileName), nil
	default:
		return "", fmt.Errorf("invalid provider config scope %q", scope)
	}
}

// ProviderCatalogScope reads one file raw, without the merge, for editing.
func (r *Runtime) ProviderCatalogScope(scope string) (ProviderCatalogDocument, error) {
	path, err := r.scopePath(scope)
	if err != nil {
		return ProviderCatalogDocument{}, err
	}
	return readCatalogDocument(normalizedScope(scope), path)
}

func normalizedScope(scope string) string {
	if strings.TrimSpace(scope) == "workspace" {
		return "workspace"
	}
	return "global"
}

func readCatalogDocument(scope, path string) (ProviderCatalogDocument, error) {
	doc, err := config.ReadDocument(path)
	if err != nil {
		return ProviderCatalogDocument{}, err
	}
	return ProviderCatalogDocument{Scope: scope, Path: doc.Path, Digest: doc.Digest, Catalog: catalogFromFile(doc.File)}, nil
}

// SaveProviderCatalogScope applies the DTO to the file it was read from and saves it through Core.
// Providers and models absent from the DTO are deleted; every other field is kept. A file that
// changed since doc.Digest was read is config.ErrConflict and stays as it is.
func (r *Runtime) SaveProviderCatalogScope(scope string, doc ProviderCatalogDocument) (ProviderCatalogDocument, error) {
	path, err := r.scopePath(scope)
	if err != nil {
		return ProviderCatalogDocument{}, err
	}
	current, err := config.ReadDocument(path)
	if err != nil {
		return ProviderCatalogDocument{}, err
	}
	if current.Digest != doc.Digest {
		return ProviderCatalogDocument{}, fmt.Errorf("%w: %s", config.ErrConflict, path)
	}
	next := applyCatalog(current.File, doc.Catalog)
	other, err := r.otherScopeFile(scope)
	if err != nil {
		return ProviderCatalogDocument{}, err
	}
	if err := checkReferences(next, other); err != nil {
		return ProviderCatalogDocument{}, err
	}
	if _, err := config.Save(path, next, doc.Digest); err != nil {
		return ProviderCatalogDocument{}, err
	}
	return readCatalogDocument(normalizedScope(scope), path)
}

// otherScopeFile reads the file of the scope that is not being saved, so a deletion cannot orphan
// a model reference that file holds.
func (r *Runtime) otherScopeFile(scope string) (config.File, error) {
	other := "workspace"
	if normalizedScope(scope) == "workspace" {
		other = "global"
	}
	path, err := r.scopePath(other)
	if errors.Is(err, ErrNoWorkspace) {
		return config.File{}, nil
	}
	if err != nil {
		return config.File{}, err
	}
	doc, err := config.ReadDocument(path)
	if err != nil {
		return config.File{}, err
	}
	return doc.File, nil
}

func catalogFromFile(f config.File) ProviderCatalog {
	catalog := ProviderCatalog{Schema: f.Schema, Model: string(f.Model), Providers: map[string]ProviderDefinition{}}
	if catalog.Schema == "" {
		catalog.Schema = ProviderConfigSchema
	}
	for id, p := range f.Providers {
		def := ProviderDefinition{Name: p.Name, Package: p.Package}
		if p.Settings != nil {
			def.Settings = ProviderSettings{BaseURL: p.Settings.BaseURL, Endpoint: p.Settings.Endpoint, APIKey: p.Settings.APIKey}
		}
		if len(p.Models) > 0 {
			def.Models = make(map[string]ProviderModel, len(p.Models))
		}
		for key, m := range p.Models {
			model := ProviderModel{Name: m.Name, ModelID: m.ModelID}
			if m.Limit != nil && (m.Limit.Context > 0 || m.Limit.Output > 0) {
				model.Limit = &ModelLimit{Context: m.Limit.Context, Output: m.Limit.Output}
			}
			def.Models[key] = model
		}
		catalog.Providers[id] = def
	}
	return catalog
}

// applyCatalog overlays the DTO on the file it was read from. Only the DTO's fields change: the
// model, each provider's name, package, baseURL, endpoint and apiKey, and each model's name,
// modelID and limit. Providers and models the DTO omits are removed.
func applyCatalog(existing config.File, dto ProviderCatalog) config.File {
	out := existing
	out.Model = config.ModelRef(strings.TrimSpace(dto.Model))
	if out.Schema == "" {
		out.Schema = ProviderConfigSchema
	}
	var providers map[string]config.Provider
	if len(dto.Providers) > 0 {
		providers = make(map[string]config.Provider, len(dto.Providers))
	}
	for id, def := range dto.Providers {
		next := existing.Providers[id]
		next.Name = def.Name
		next.Package = def.Package
		next.Settings = overlaySettings(next.Settings, def.Settings)
		var models map[string]config.Model
		if len(def.Models) > 0 {
			models = make(map[string]config.Model, len(def.Models))
		}
		for key, dm := range def.Models {
			model := next.Models[key]
			model.Name = dm.Name
			model.ModelID = dm.ModelID
			model.Limit = nil
			if dm.Limit != nil && (dm.Limit.Context > 0 || dm.Limit.Output > 0) {
				model.Limit = &config.Limit{Context: dm.Limit.Context, Output: dm.Limit.Output}
			}
			models[key] = model
		}
		next.Models = models
		providers[id] = next
	}
	out.Providers = providers
	return out
}

func overlaySettings(existing *config.ProviderSettings, dto ProviderSettings) *config.ProviderSettings {
	var s config.ProviderSettings
	if existing != nil {
		s = *existing
	}
	if existing == nil && dto == (ProviderSettings{}) {
		return nil
	}
	s.BaseURL, s.Endpoint, s.APIKey = dto.BaseURL, dto.Endpoint, dto.APIKey
	return &s
}

// checkReferences refuses a save that would leave a model reference, in either file, pointing at a
// model no file defines any more: Core would then refuse to load the configuration at all.
func checkReferences(edited, other config.File) error {
	defined := map[config.ModelRef]bool{}
	for _, f := range []config.File{edited, other} {
		for id, p := range f.Providers {
			for key := range p.Models {
				defined[config.ModelRef(id+"/"+key)] = true
			}
		}
	}
	for _, f := range []config.File{edited, other} {
		refs := append([]config.ModelRef{f.Model, f.SubagentModel}, f.Failover...)
		for _, ref := range refs {
			if ref != "" && !defined[ref] {
				return fmt.Errorf("%w: model %s is still used as the default, subagent or failover model", config.ErrInvalidConfig, ref)
			}
		}
	}
	return nil
}

func (r *Runtime) DiscoverProviderModels(providerID string) ([]DiscoveredModel, error) {
	cfg, err := config.Load(r.currentWorkspace())
	if err != nil {
		return nil, err
	}
	provider, err := cfg.Provider(providerID)
	if err != nil {
		return nil, err
	}
	return discoverProviderModels(provider)
}

func (r *Runtime) TestProviderConnection(providerID string) (ProviderConnectionResult, error) {
	models, err := r.DiscoverProviderModels(providerID)
	if err != nil {
		return ProviderConnectionResult{}, err
	}
	return ProviderConnectionResult{
		OK:      true,
		Models:  len(models),
		Message: fmt.Sprintf("provider reachable; discovered %d models", len(models)),
	}, nil
}

func providerModelsURL(provider config.ResolvedProvider) (string, error) {
	base := strings.TrimSpace(provider.BaseURL)
	if base == "" {
		if endpoint := strings.TrimSpace(provider.Endpoint); endpoint != "" {
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

const discoveryTimeout = 12 * time.Second

// discoverProviderModels lists the provider's models with the settings Core resolved: the
// provider's own headers plus its Authorization. Redirects are refused, because Go would forward
// custom credential headers to the redirect target.
func discoverProviderModels(provider config.ResolvedProvider) ([]DiscoveredModel, error) {
	modelsURL, err := providerModelsURL(provider)
	if err != nil {
		return nil, err
	}
	key, err := provider.ResolveAPIKey()
	if err != nil {
		return nil, err
	}
	ctx, cancel := context.WithTimeout(context.Background(), discoveryTimeout)
	defer cancel()
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, modelsURL, nil)
	if err != nil {
		return nil, err
	}
	for name, value := range provider.Headers {
		req.Header.Set(name, value)
	}
	req.Header.Set("Accept", "application/json")
	if key != "" {
		req.Header.Set("Authorization", "Bearer "+key)
	}

	client := &http.Client{
		Timeout:       discoveryTimeout,
		CheckRedirect: func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse },
	}
	resp, err := client.Do(req)
	if err != nil {
		return nil, redactTransportError(err)
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(io.LimitReader(resp.Body, 2<<20))
	if err != nil {
		return nil, err
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("provider models request failed: status=%d", resp.StatusCode)
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

// redactTransportError keeps the failure reason of a request error but not the request URL, which
// a provider may have configured with a token in its query.
func redactTransportError(err error) error {
	var urlErr *url.Error
	if errors.As(err, &urlErr) {
		return fmt.Errorf("provider request failed: %w", urlErr.Err)
	}
	return err
}
