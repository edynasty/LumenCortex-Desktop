package backend

import (
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"unicode/utf8"

	"github.com/edynasty/LumenCortex/config"
)

// This file is the Desktop adapter over Core's agent catalog (ADR-0009). Core owns the catalog:
// the four built-ins and the custom agents of lumencortex.json, the merge with the workspace file,
// validation and the digest a save is checked against. Desktop only translates between Core's
// types and the DTO the Agents page edits, and writes the global file through config.Save.
//
// The retired Desktop profile store (agents.json) is imported once into that catalog; see
// importLegacyAgents.

// The legacy profile file and the record of what its import did. Both live next to the global
// lumencortex.json; the legacy file is renamed, never deleted, so nothing the import could not map
// is lost.
const (
	legacyAgentProfilesFileName = "agents.json"
	legacyAgentProfilesImported = "agents.json.imported"
	agentImportRecordFileName   = "agents.import.json"
	maxLegacyProfilesFileBytes  = 512 << 10
	agentIDPattern              = `^[a-z][a-z0-9-]{0,39}$`
	agentIDSuffixAttempts       = 200
)

var agentIDRegexp = regexp.MustCompile(agentIDPattern)

// The retired profile file's `base` values. They decided the run semantics; the import maps them
// onto Core's ceilings and nothing else reads them.
const (
	legacyBaseAsk   = "ask"
	legacyBaseAgent = "agent"
)

// Refusals the bridge can distinguish. Core's own errors (invalid configuration, conflict) travel
// through unchanged so the UI maps them the way it maps every Core refusal.
var (
	ErrBuiltinAgent     = errors.New("built-in agents keep their name, use and ceilings; only instructions, effort and models are editable")
	ErrAgentLimit       = errors.New("agent limit reached")
	ErrInvalidAgent     = errors.New("invalid agent")
	ErrAgentNotFound    = errors.New("agent is not in the catalog")
	ErrWorkspaceAgent   = errors.New("agent is defined by this workspace's configuration; edit the workspace file instead")
	ErrAgentImportOrder = errors.New("migrate the retired subagentModel before importing agent profiles")
)

// AgentModelItem is one candidate of an agent's ordered model list. Effort is that candidate's own
// level; empty falls back to the agent's effort, then effort.default.
type AgentModelItem struct {
	Model  string `json:"model"`
	Effort string `json:"effort,omitempty"`
}

// AgentEntry is one catalog agent as the page reads and edits it. Models nil means the agent
// inherits a list (the default list for conversations, the parent's list for children).
type AgentEntry struct {
	ID              string           `json:"id"`
	Name            string           `json:"name"`
	Description     string           `json:"description,omitempty"`
	Use             string           `json:"use"`
	Policy          string           `json:"policy"`
	Delegation      string           `json:"delegation"`
	Instructions    string           `json:"instructions"`
	Effort          string           `json:"effort,omitempty"`
	Models          []AgentModelItem `json:"models"`
	Builtin         bool             `json:"builtin"`
	Source          string           `json:"source"`
	Digest          string           `json:"digest"`
	ForConversation bool             `json:"forConversation"`
	// Editable is false when the entry comes from the workspace file: the page edits the global
	// file, so a workspace definition is shown but changed where it lives.
	Editable bool `json:"editable"`
	// Origin and OMPRole are set on a preset only: the oh-my-pi agent it derives from and the
	// modelRoles key its model list came from ("" when it has none). A saved agent has neither.
	Origin  string `json:"origin,omitempty"`
	OMPRole string `json:"ompRole,omitempty"`
}

// AgentLimits mirrors Core's catalog bounds so the page can explain a refusal while typing; Core
// validates again on save.
type AgentLimits struct {
	MaxCustom    int    `json:"maxCustom"`
	Name         int    `json:"name"`
	Description  int    `json:"description"`
	Instructions int    `json:"instructions"`
	Models       int    `json:"models"`
	IDPattern    string `json:"idPattern"`
}

func agentLimits() AgentLimits {
	return AgentLimits{
		MaxCustom:    config.MaxCustomAgents,
		Name:         config.MaxAgentNameChars,
		Description:  config.MaxAgentDescriptionSize,
		Instructions: config.MaxAgentInstructions,
		Models:       config.MaxAgentModels,
		IDPattern:    agentIDPattern,
	}
}

// AgentImportResult is what the one-time import of the retired agents.json did (or, on later reads,
// what it did the first time). The Agents page shows it so nothing was dropped silently.
type AgentImportResult struct {
	// Imported reports that this read performed the import; AlreadyImported that it ran earlier.
	Imported         bool     `json:"imported"`
	AlreadyImported  bool     `json:"alreadyImported"`
	RenamedTo        string   `json:"renamedTo,omitempty"`
	Custom           int      `json:"custom"`
	BuiltinOverrides []string `json:"builtinOverrides"`
	Skipped          int      `json:"skipped"`
	Warnings         []string `json:"warnings"`
}

// AgentCatalog is the merged catalog the page reads, with the digest a save must send back.
type AgentCatalog struct {
	Agents       []AgentEntry       `json:"agents"`
	Limits       AgentLimits        `json:"limits"`
	GlobalPath   string             `json:"globalPath"`
	GlobalDigest string             `json:"globalDigest"`
	Warning      string             `json:"warning,omitempty"`
	Import       *AgentImportResult `json:"import,omitempty"`
}

// legacyAgentProfilesDocument is the retired Desktop profile file, v1. Only the import reads it.
type legacyAgentProfilesDocument struct {
	Version  int                  `json:"version"`
	Profiles []legacyAgentProfile `json:"profiles"`
}

type legacyAgentProfile struct {
	ID           string `json:"id"`
	Name         string `json:"name"`
	Description  string `json:"description,omitempty"`
	Base         string `json:"base"`
	Instructions string `json:"instructions"`
	ModelRef     string `json:"modelRef,omitempty"`
	Effort       string `json:"effort,omitempty"`
	Policy       string `json:"policy,omitempty"`
	Builtin      bool   `json:"builtin"`
}

// Agents returns the merged catalog. The retired agents.json is imported the first time it is read;
// the result rides along so the page can report what the import skipped.
func (r *Runtime) Agents() (AgentCatalog, error) {
	r.agentsMu.Lock()
	defer r.agentsMu.Unlock()
	cfg, err := config.Load(r.currentWorkspace())
	if err != nil {
		return AgentCatalog{}, err
	}
	record, err := r.importLegacyAgentsLocked(cfg)
	if err != nil {
		return AgentCatalog{}, err
	}
	if record != nil && record.Imported {
		// The import wrote the global file: read the catalog it produced, not the pre-import one.
		if cfg, err = config.Load(r.currentWorkspace()); err != nil {
			return AgentCatalog{}, err
		}
	}
	return agentCatalogFrom(cfg, record), nil
}

// AgentPresets lists the compiled-in specialists (ADR-0009 A4) for the Agents page. They are not
// catalog entries: the page opens an unsaved draft from one, the user edits it, and SaveAgent writes
// the ordinary entry. Models come from the oh-my-pi model role when that role converts to models of
// this catalog; otherwise Models stays nil and the agent inherits the default list.
func (r *Runtime) AgentPresets() ([]AgentEntry, error) {
	cfg, err := config.Load(r.currentWorkspace())
	if err != nil {
		return nil, err
	}
	eff := cfg.Effective()
	presets, _ := config.ResolveAgentPresets(&eff, config.OMPConfigPath())
	out := make([]AgentEntry, 0, len(presets))
	for _, preset := range presets {
		entry := AgentEntry{
			ID: preset.ID, Name: preset.Agent.Name, Description: preset.Agent.Description,
			Use: string(preset.Agent.Use), Policy: preset.Agent.Policy, Delegation: string(preset.Agent.Delegation),
			Instructions: preset.Agent.Instructions, Effort: string(preset.Agent.Effort),
			Builtin: false, Source: "preset", Editable: true,
			ForConversation: preset.Agent.Use != config.AgentUseDelegation,
			Origin:          preset.Origin, OMPRole: preset.OMPRole,
		}
		if entry.Delegation == "" {
			entry.Delegation = string(config.DelegationNone)
		}
		if preset.Agent.Models != nil {
			entry.Models = make([]AgentModelItem, len(preset.Agent.Models))
			for i, m := range preset.Agent.Models {
				entry.Models[i] = AgentModelItem{Model: string(m.Model), Effort: string(m.Effort)}
			}
		}
		out = append(out, entry)
	}
	return out, nil
}

func agentCatalogFrom(cfg *config.Config, record *AgentImportResult) AgentCatalog {
	eff := cfg.Effective()
	global := cfg.Global()
	catalog := AgentCatalog{
		Agents:       make([]AgentEntry, 0, len(eff.Agents)),
		Limits:       agentLimits(),
		GlobalPath:   global.Path,
		GlobalDigest: global.Digest,
		Import:       record,
	}
	for _, info := range eff.Agents {
		entry := AgentEntry{
			ID: info.ID, Name: info.Name, Description: info.Description, Use: string(info.Use),
			Policy: info.Policy, Delegation: info.Delegation, Instructions: info.Instructions,
			Effort: string(info.Effort), Builtin: info.Builtin, Source: info.Source, Digest: info.Digest,
			ForConversation: info.ForConversation(), Editable: info.Source != "workspace",
		}
		if info.Models != nil {
			entry.Models = make([]AgentModelItem, len(info.Models))
			for i, m := range info.Models {
				entry.Models[i] = AgentModelItem{Model: string(m.Model), Effort: string(m.Effort)}
			}
		}
		catalog.Agents = append(catalog.Agents, entry)
	}
	switch {
	case record == nil:
	case record.Imported || record.AlreadyImported:
		if len(record.Warnings) > 0 {
			catalog.Warning = fmt.Sprintf("agents.json was imported with %d warning(s).", len(record.Warnings))
		}
	default:
		// The import did not run (unreadable or corrupt file): the warning says what happened.
		catalog.Warning = strings.Join(record.Warnings, " ")
	}
	return catalog
}

// SaveAgent creates a custom agent (empty ID) or updates one, in the global file. A built-in keeps
// its name, description, use and ceilings; only its instructions, effort and models are written.
// globalDigest is the GlobalDigest the page last saw: a changed file is config.ErrConflict and
// nothing is written.
func (r *Runtime) SaveAgent(globalDigest string, entry AgentEntry) (AgentCatalog, error) {
	r.agentsMu.Lock()
	defer r.agentsMu.Unlock()
	cfg, err := config.Load(r.currentWorkspace())
	if err != nil {
		return AgentCatalog{}, err
	}
	global := cfg.Global()
	if global.Digest != globalDigest {
		return AgentCatalog{}, fmt.Errorf("%w: %s", config.ErrConflict, global.Path)
	}
	next := global.File
	entry.ID = strings.TrimSpace(entry.ID)
	entry.Name = strings.TrimSpace(entry.Name)
	entry.Description = strings.TrimSpace(entry.Description)
	entry.Instructions = strings.ReplaceAll(entry.Instructions, "\r\n", "\n")
	entry.Effort = strings.TrimSpace(entry.Effort)
	entry.Use = strings.TrimSpace(entry.Use)
	entry.Policy = strings.TrimSpace(entry.Policy)
	entry.Delegation = strings.TrimSpace(entry.Delegation)

	merged, known := cfg.Effective().Agent(entry.ID)
	if entry.ID != "" && known && merged.Source == "workspace" {
		return AgentCatalog{}, fmt.Errorf("%w: %s", ErrWorkspaceAgent, entry.ID)
	}

	agent, id, err := agentForSave(next.Agents, cfg, entry, merged, known)
	if err != nil {
		return AgentCatalog{}, err
	}
	if next.Agents == nil {
		next.Agents = map[string]config.Agent{}
	}
	if agentIsEmpty(agent) && known && merged.Builtin {
		// A built-in with nothing overridden is no entry at all: the catalog already has its defaults.
		delete(next.Agents, id)
	} else {
		next.Agents[id] = agent
	}
	if next.Schema == "" {
		next.Schema = ProviderConfigSchema
	}
	if _, err := config.Save(global.Path, next, globalDigest); err != nil {
		return AgentCatalog{}, err
	}
	return r.agentsAfterSave()
}

// DeleteAgent removes a custom agent from the global file. A built-in cannot be deleted, and a
// workspace definition is not the global file's to remove.
func (r *Runtime) DeleteAgent(globalDigest, id string) (AgentCatalog, error) {
	r.agentsMu.Lock()
	defer r.agentsMu.Unlock()
	id = strings.TrimSpace(id)
	cfg, err := config.Load(r.currentWorkspace())
	if err != nil {
		return AgentCatalog{}, err
	}
	global := cfg.Global()
	if global.Digest != globalDigest {
		return AgentCatalog{}, fmt.Errorf("%w: %s", config.ErrConflict, global.Path)
	}
	if config.IsBuiltinAgent(id) {
		return AgentCatalog{}, fmt.Errorf("%w: %s", ErrBuiltinAgent, id)
	}
	merged, known := cfg.Effective().Agent(id)
	if !known {
		return AgentCatalog{}, fmt.Errorf("%w: %s", ErrAgentNotFound, id)
	}
	if merged.Source == "workspace" {
		return AgentCatalog{}, fmt.Errorf("%w: %s", ErrWorkspaceAgent, id)
	}
	next := global.File
	if _, ok := next.Agents[id]; !ok {
		return AgentCatalog{}, fmt.Errorf("%w: %s", ErrAgentNotFound, id)
	}
	delete(next.Agents, id)
	if len(next.Agents) == 0 {
		next.Agents = nil
	}
	if next.Schema == "" {
		next.Schema = ProviderConfigSchema
	}
	if _, err := config.Save(global.Path, next, globalDigest); err != nil {
		return AgentCatalog{}, err
	}
	return r.agentsAfterSave()
}

// agentsAfterSave reads the catalog a save produced; the import already ran (or has nothing to do),
// so no second import is attempted here.
func (r *Runtime) agentsAfterSave() (AgentCatalog, error) {
	cfg, err := config.Load(r.currentWorkspace())
	if err != nil {
		return AgentCatalog{}, err
	}
	return agentCatalogFrom(cfg, readAgentImportRecord()), nil
}

// agentForSave validates one save and returns the file entry it becomes. Built-ins may only set
// instructions, effort and models; custom agents are written whole.
func agentForSave(agents map[string]config.Agent, cfg *config.Config, entry AgentEntry, merged config.AgentInfo, known bool) (config.Agent, string, error) {
	models, err := agentModels(entry.Models)
	if err != nil {
		return config.Agent{}, "", err
	}
	if entry.Effort != "" && !validEffort(entry.Effort) {
		return config.Agent{}, "", fmt.Errorf("%w: unknown effort %q", ErrInvalidAgent, entry.Effort)
	}
	if len(entry.Instructions) > config.MaxAgentInstructions {
		return config.Agent{}, "", fmt.Errorf("%w: instructions are longer than %d bytes", ErrInvalidAgent, config.MaxAgentInstructions)
	}

	if entry.ID != "" && config.IsBuiltinAgent(entry.ID) {
		if err := builtinFixedFieldsUnchanged(entry, merged); err != nil {
			return config.Agent{}, "", err
		}
		return config.Agent{Instructions: entry.Instructions, Effort: config.Effort(entry.Effort), Models: models}, entry.ID, nil
	}

	if entry.Name == "" {
		return config.Agent{}, "", fmt.Errorf("%w: a name is required", ErrInvalidAgent)
	}
	if utf8.RuneCountInString(entry.Name) > config.MaxAgentNameChars {
		return config.Agent{}, "", fmt.Errorf("%w: name must be 1-%d characters", ErrInvalidAgent, config.MaxAgentNameChars)
	}
	if len(entry.Description) > config.MaxAgentDescriptionSize {
		return config.Agent{}, "", fmt.Errorf("%w: description is longer than %d bytes", ErrInvalidAgent, config.MaxAgentDescriptionSize)
	}
	use := entry.Use
	if use == "" {
		use = string(config.AgentUseConversation)
	}
	switch config.AgentUse(use) {
	case config.AgentUseConversation, config.AgentUseDelegation, config.AgentUseBoth:
	default:
		return config.Agent{}, "", fmt.Errorf("%w: unknown use %q", ErrInvalidAgent, use)
	}
	policy := entry.Policy
	if policy != "" && !validPolicy(policy) {
		return config.Agent{}, "", fmt.Errorf("%w: unknown policy %q", ErrInvalidAgent, policy)
	}
	delegation := entry.Delegation
	switch delegation {
	case "", config.DelegationNone, config.DelegationPropose, config.DelegationIsolated:
	default:
		return config.Agent{}, "", fmt.Errorf("%w: unknown delegation %q", ErrInvalidAgent, delegation)
	}
	if use != string(config.AgentUseConversation) {
		// Core treats every non-conversation use as delegation: the agent never delegates further
		// (the field must be empty) and it caps its policy at read-only or workspace (ADR-0009 §2).
		delegation = ""
		if policy != config.PolicyReadOnly && policy != config.PolicyWorkspace {
			return config.Agent{}, "", fmt.Errorf("%w: an agent used for delegation must cap its policy at read-only or workspace", ErrInvalidAgent)
		}
		if entry.Description == "" {
			return config.Agent{}, "", fmt.Errorf("%w: an agent used for delegation needs a description: the model selects it by that text", ErrInvalidAgent)
		}
	}

	id := entry.ID
	if id == "" {
		custom := 0
		for otherID := range agents {
			if !config.IsBuiltinAgent(otherID) {
				custom++
			}
		}
		if custom >= config.MaxCustomAgents {
			return config.Agent{}, "", ErrAgentLimit
		}
		id = newAgentID(entry.Name, agents)
	}
	return config.Agent{
		Name: entry.Name, Description: entry.Description, Use: config.AgentUse(use),
		Policy: policy, Delegation: delegation, Instructions: entry.Instructions,
		Effort: config.Effort(entry.Effort), Models: models,
	}, id, nil
}

// builtinFixedFieldsUnchanged refuses a built-in edit that touches a field a built-in may not
// change. Empty fields mean "unchanged", which is how a partial editor saves.
func builtinFixedFieldsUnchanged(entry AgentEntry, merged config.AgentInfo) error {
	differs := func(sent, fixed string) bool { return sent != "" && sent != fixed }
	if differs(entry.Name, merged.Name) || differs(entry.Description, merged.Description) ||
		differs(entry.Use, string(merged.Use)) || differs(entry.Policy, merged.Policy) ||
		differs(entry.Delegation, merged.Delegation) {
		return fmt.Errorf("%w: %s", ErrBuiltinAgent, entry.ID)
	}
	return nil
}

func agentModels(items []AgentModelItem) ([]config.AgentModel, error) {
	if len(items) == 0 {
		return nil, nil
	}
	if len(items) > config.MaxAgentModels {
		return nil, fmt.Errorf("%w: at most %d models", ErrInvalidAgent, config.MaxAgentModels)
	}
	out := make([]config.AgentModel, 0, len(items))
	seen := map[string]bool{}
	for _, item := range items {
		ref := strings.TrimSpace(item.Model)
		effort := strings.TrimSpace(item.Effort)
		if ref == "" {
			return nil, fmt.Errorf("%w: a model entry needs a model", ErrInvalidAgent)
		}
		if _, _, ok := config.ModelRef(ref).Split(); !ok {
			return nil, fmt.Errorf("%w: model %q must be provider/model", ErrInvalidAgent, ref)
		}
		if seen[ref] {
			return nil, fmt.Errorf("%w: %s is listed twice", ErrInvalidAgent, ref)
		}
		seen[ref] = true
		if effort != "" && !validEffort(effort) {
			return nil, fmt.Errorf("%w: unknown effort %q", ErrInvalidAgent, effort)
		}
		out = append(out, config.AgentModel{Model: config.ModelRef(ref), Effort: config.Effort(effort)})
	}
	return out, nil
}

func agentIsEmpty(agent config.Agent) bool {
	return agent.Name == "" && agent.Description == "" && agent.Use == "" && agent.Policy == "" &&
		agent.Delegation == "" && agent.Instructions == "" && agent.Effort == "" && len(agent.Models) == 0
}

// newAgentID derives a catalog id from the name: lower-case ASCII, digits and single dashes,
// starting with a letter, at most 40 characters. A taken id gets a numeric suffix.
func newAgentID(name string, agents map[string]config.Agent) string {
	base := slugifyAgentID(name)
	if base == "" {
		base = "agent"
	}
	for i := range agentIDSuffixAttempts {
		candidate := base
		if i > 0 {
			suffix := fmt.Sprintf("-%d", i+1)
			candidate = strings.TrimRight(base[:min(len(base), 40-len(suffix))], "-") + suffix
		}
		if _, taken := agents[candidate]; taken || config.IsBuiltinAgent(candidate) {
			continue
		}
		return candidate
	}
	return base
}

func slugifyAgentID(name string) string {
	var out strings.Builder
	lastDash := false
	for _, r := range strings.ToLower(name) {
		switch {
		case r >= 'a' && r <= 'z', r >= '0' && r <= '9':
			out.WriteRune(r)
			lastDash = false
		default:
			if out.Len() > 0 && !lastDash {
				out.WriteByte('-')
				lastDash = true
			}
		}
	}
	slug := strings.Trim(out.String(), "-")
	if slug == "" {
		return ""
	}
	if slug[0] < 'a' || slug[0] > 'z' {
		slug = "agent-" + slug
	}
	if len(slug) > 40 {
		slug = strings.TrimRight(slug[:40], "-")
	}
	if !agentIDRegexp.MatchString(slug) {
		return ""
	}
	return slug
}

// renameLegacyProfiles renames the imported file; a test replaces it to exercise a failed rename.
var renameLegacyProfiles = renameLegacyAgentProfiles

// importLegacyAgentsLocked imports the retired agents.json once. The write goes through config.Save
// with the digest that was read, so a concurrent change is config.ErrConflict and nothing is
// written; the import record is written before the file is renamed to agents.json.imported, so the
// record alone decides that the import is done.
func (r *Runtime) importLegacyAgentsLocked(cfg *config.Config) (*AgentImportResult, error) {
	if record := readAgentImportRecord(); record != nil {
		// The record is the gate, not the file: an import whose rename failed, or one the process
		// stopped in between, is still done. Without this the same profiles would be imported again
		// as "Name (2)" entries.
		return record, nil
	}
	dir, err := config.GlobalDir()
	if err != nil {
		return nil, nil
	}
	path := filepath.Join(dir, legacyAgentProfilesFileName)
	raw, err := readBoundedFile(path, maxLegacyProfilesFileBytes)
	switch {
	case errors.Is(err, os.ErrNotExist):
		return nil, nil
	case err != nil:
		// Unreadable or oversized: nothing was imported, and the page says why instead of claiming
		// an import that never happened.
		return agentImportNotRun(fmt.Sprintf("%s was not imported: %v", legacyAgentProfilesFileName, err)), nil
	}
	var doc legacyAgentProfilesDocument
	if err := json.Unmarshal(raw, &doc); err != nil || doc.Version != 1 {
		return agentImportNotRun(legacyAgentProfilesFileName + " is not a v1 profile catalog; it was left untouched and nothing was imported."), nil
	}

	global := cfg.Global()
	next := global.File
	if next.Agents == nil {
		next.Agents = map[string]config.Agent{}
	}
	record := importLegacyProfiles(doc.Profiles, next.Agents, cfg)
	if len(next.Agents) == 0 {
		next.Agents = nil
	}
	if next.Schema == "" {
		next.Schema = ProviderConfigSchema
	}
	if _, err := config.Save(global.Path, next, global.Digest); err != nil {
		return nil, err
	}
	// The record is written before the rename, so a rename that fails (or a process that stops in
	// between) leaves the import marked as done; the file itself is only the backup.
	record.Imported = true
	writeAgentImportRecord(record)
	if renamed, err := renameLegacyProfiles(path); err != nil {
		record.Warnings = append(record.Warnings, fmt.Sprintf("the profile file could not be renamed: %v", err))
	} else {
		record.RenamedTo = renamed
	}
	writeAgentImportRecord(record)
	return record, nil
}

// agentImportNotRun is the result for a legacy file the import could not use. It is never reported
// as imported, and its warning reaches the page through AgentCatalog.Warning.
func agentImportNotRun(warning string) *AgentImportResult {
	return &AgentImportResult{Warnings: []string{warning}}
}

// importLegacyProfiles maps the retired profiles onto catalog entries. A built-in profile becomes
// an override of ask/agent; a custom one becomes a custom agent whose id is derived from its name.
// The legacy `policy` default is dropped (ADR-0009 D6): the composer grant is the user's, the
// agent only caps it.
func importLegacyProfiles(profiles []legacyAgentProfile, agents map[string]config.Agent, cfg *config.Config) *AgentImportResult {
	record := &AgentImportResult{Warnings: []string{}}
	catalog := map[string]ModelInfo{}
	for _, info := range cfg.Catalog() {
		catalog[string(info.Ref)] = info
	}
	custom := 0
	for id := range agents {
		if !config.IsBuiltinAgent(id) {
			custom++
		}
	}
	seenNames := map[string]bool{}
	// Every name the merged catalog already has is taken: the built-ins (their names are not in the
	// global file, so the stored names alone miss them), the global agents and the workspace ones.
	// Core refuses a duplicate name at load, so importing one would break every later load.
	for _, info := range cfg.Effective().Agents {
		seenNames[strings.ToLower(info.Name)] = true
	}

	for _, profile := range profiles {
		if config.IsBuiltinAgent(profile.ID) {
			override := agents[profile.ID]
			changed := false
			if instructions := strings.TrimSpace(profile.Instructions); instructions != "" {
				if len(instructions) > config.MaxAgentInstructions {
					record.Warnings = append(record.Warnings, fmt.Sprintf(
						"built-in %s: instructions are longer than %d bytes; the override was not imported (they stay in %s)",
						profile.ID, config.MaxAgentInstructions, legacyAgentProfilesImported))
					record.Skipped++
					continue
				}
				override.Instructions = instructions
				changed = true
			}
			if model, ok := legacyAgentModel(profile, catalog, profile.ID, record); ok {
				override.Models = []config.AgentModel{model}
				changed = true
			}
			if profile.Effort != "" && validEffort(profile.Effort) {
				override.Effort = config.Effort(profile.Effort)
				changed = true
			}
			if changed {
				agents[profile.ID] = override
				record.BuiltinOverrides = append(record.BuiltinOverrides, profile.ID)
			}
			continue
		}
		if custom >= config.MaxCustomAgents {
			record.Skipped++
			record.Warnings = append(record.Warnings, fmt.Sprintf(
				"%s: the catalog already holds %d custom agents; this one was not imported (it stays in %s)",
				profileLabel(profile), config.MaxCustomAgents, legacyAgentProfilesImported))
			continue
		}
		entry, ok := legacyAgentEntry(profile, agents, catalog, seenNames, record)
		if !ok {
			continue
		}
		agents[entry.id] = entry.agent
		seenNames[strings.ToLower(entry.agent.Name)] = true
		custom++
		record.Custom++
	}
	return record
}

type legacyEntry struct {
	id    string
	agent config.Agent
}

// legacyAgentEntry maps one custom profile. base=ask keeps the read-only, no-delegation ceiling;
// base=agent caps nothing, which is Core's default for a conversation agent.
func legacyAgentEntry(profile legacyAgentProfile, agents map[string]config.Agent, catalog map[string]ModelInfo, seenNames map[string]bool, record *AgentImportResult) (legacyEntry, bool) {
	label := profileLabel(profile)
	if len(profile.Instructions) > config.MaxAgentInstructions {
		record.Skipped++
		record.Warnings = append(record.Warnings, fmt.Sprintf(
			"%s: instructions are longer than %d bytes; it was not imported (they stay in %s)",
			label, config.MaxAgentInstructions, legacyAgentProfilesImported))
		return legacyEntry{}, false
	}
	name := strings.TrimSpace(profile.Name)
	if name == "" {
		name = strings.TrimSpace(profile.ID)
	}
	if name == "" {
		record.Skipped++
		record.Warnings = append(record.Warnings, "a profile without a name or id was not imported (it stays in "+legacyAgentProfilesImported+")")
		return legacyEntry{}, false
	}
	if utf8.RuneCountInString(name) > config.MaxAgentNameChars {
		name = strings.TrimSpace(string([]rune(name)[:config.MaxAgentNameChars]))
		record.Warnings = append(record.Warnings, fmt.Sprintf("%s: the name was shortened to %d characters", label, config.MaxAgentNameChars))
	}
	if seenNames[strings.ToLower(name)] {
		name = uniqueAgentName(name, seenNames)
		record.Warnings = append(record.Warnings, fmt.Sprintf("%s: the name was taken; it was imported as %q", label, name))
	}
	agent := config.Agent{
		Name:         name,
		Description:  normalizedAgentDescription(profile.Description, label, record),
		Use:          config.AgentUseConversation,
		Instructions: profile.Instructions,
	}
	if profile.Base == legacyBaseAsk {
		agent.Policy = config.PolicyReadOnly
		agent.Delegation = config.DelegationNone
	}
	if model, ok := legacyAgentModel(profile, catalog, label, record); ok {
		agent.Models = []config.AgentModel{model}
	}
	if profile.Effort != "" && validEffort(profile.Effort) {
		agent.Effort = config.Effort(profile.Effort)
	}
	return legacyEntry{id: newAgentID(name, agents), agent: agent}, true
}

// normalizedAgentDescription clips a legacy description to Core's byte bound on a UTF-8 boundary.
// The retired store counted characters and Core counts bytes, so a long CJK description would
// otherwise fail the save and block every profile of the import.
func normalizedAgentDescription(text, label string, record *AgentImportResult) string {
	description := strings.TrimSpace(text)
	if len(description) <= config.MaxAgentDescriptionSize {
		return description
	}
	record.Warnings = append(record.Warnings, fmt.Sprintf(
		"%s: the description was shortened to %d bytes", label, config.MaxAgentDescriptionSize))
	return strings.TrimSpace(clipUTF8(description, config.MaxAgentDescriptionSize))
}

// clipUTF8 cuts s to at most limit bytes without splitting a rune.
func clipUTF8(s string, limit int) string {
	if len(s) <= limit {
		return s
	}
	cut := limit
	for cut > 0 && !utf8.RuneStart(s[cut]) {
		cut--
	}
	return s[:cut]
}

// legacyAgentModel keeps a profile's model only when the merged catalog has it and it calls tools
// (an agent's first model must); otherwise the entry is dropped with a warning.
func legacyAgentModel(profile legacyAgentProfile, catalog map[string]ModelInfo, label string, record *AgentImportResult) (config.AgentModel, bool) {
	ref := strings.TrimSpace(profile.ModelRef)
	if ref == "" {
		return config.AgentModel{}, false
	}
	info, ok := catalog[ref]
	if !ok {
		record.Warnings = append(record.Warnings, fmt.Sprintf(
			"%s: model %s is not in the catalog; it was dropped and the agent inherits the default list", label, ref))
		return config.AgentModel{}, false
	}
	if !info.ToolCalling {
		record.Warnings = append(record.Warnings, fmt.Sprintf(
			"%s: model %s does not call tools and cannot be an agent's first model; it was dropped", label, ref))
		return config.AgentModel{}, false
	}
	return config.AgentModel{Model: config.ModelRef(ref), Effort: config.Effort(strings.TrimSpace(profile.Effort))}, true
}

func profileLabel(profile legacyAgentProfile) string {
	if name := strings.TrimSpace(profile.Name); name != "" {
		return fmt.Sprintf("profile %q", name)
	}
	if profile.ID != "" {
		return fmt.Sprintf("profile %q", profile.ID)
	}
	return "a profile"
}

// uniqueAgentName appends " (2)", " (3)"… within the name bound until the name is free.
func uniqueAgentName(name string, taken map[string]bool) string {
	base := name
	for offset := range 98 {
		suffix := fmt.Sprintf(" (%d)", offset+2)
		runes := []rune(base)
		if len(runes)+len(suffix) > config.MaxAgentNameChars {
			runes = runes[:config.MaxAgentNameChars-len(suffix)]
		}
		candidate := strings.TrimSpace(string(runes)) + suffix
		if !taken[strings.ToLower(candidate)] {
			return candidate
		}
	}
	return name
}

// renameLegacyAgentProfiles keeps the imported file as a backup; an existing backup is never
// overwritten.
func renameLegacyAgentProfiles(path string) (string, error) {
	target := path + ".imported"
	for i := 2; ; i++ {
		if _, err := os.Stat(target); errors.Is(err, os.ErrNotExist) {
			break
		} else if err != nil {
			return "", err
		}
		target = fmt.Sprintf("%s.imported.%d", path, i)
	}
	if err := os.Rename(path, target); err != nil {
		return "", err
	}
	return target, nil
}

// The import record is a small sidecar so the Agents page can report what the one-time import
// skipped long after the legacy file was renamed. It is a record, never an input to a run.
func agentImportRecordPath() string {
	dir, err := config.GlobalDir()
	if err != nil {
		return ""
	}
	return filepath.Join(dir, agentImportRecordFileName)
}

func writeAgentImportRecord(record *AgentImportResult) {
	path := agentImportRecordPath()
	if path == "" {
		return
	}
	// The record is read on later starts, when the import already happened: it says so.
	stored := *record
	stored.Imported, stored.AlreadyImported = false, true
	raw, err := json.MarshalIndent(stored, "", "  ")
	if err != nil {
		return
	}
	raw = append(raw, '\n')
	if err := os.MkdirAll(filepath.Dir(path), 0o700); err != nil {
		return
	}
	temp, err := os.CreateTemp(filepath.Dir(path), ".agents-import-*.json")
	if err != nil {
		return
	}
	tempPath := temp.Name()
	if _, err := temp.Write(raw); err == nil {
		if temp.Chmod(0o600) == nil && temp.Sync() == nil {
			_ = temp.Close()
			if os.Rename(tempPath, path) == nil {
				return
			}
		}
	}
	_ = temp.Close()
	_ = os.Remove(tempPath)
}

func readAgentImportRecord() *AgentImportResult {
	path := agentImportRecordPath()
	if path == "" {
		return nil
	}
	raw, err := readBoundedFile(path, 64<<10)
	if err != nil {
		return nil
	}
	var record AgentImportResult
	if err := json.Unmarshal(raw, &record); err != nil {
		return nil
	}
	return &record
}

func readBoundedFile(path string, limit int64) ([]byte, error) {
	info, err := os.Stat(path)
	if err != nil {
		return nil, err
	}
	if info.Size() > limit {
		return nil, fmt.Errorf("%s is larger than %d bytes", path, limit)
	}
	return os.ReadFile(path)
}

// MigrateSubagentModel rewrites the retired subagentModel key in the global file and, when a
// workspace is open, in its lumencortex.json. It is the one-click repair behind the load error
// config.ErrSubagentModelRetired; a file without the key is left alone.
func (r *Runtime) MigrateSubagentModel() (SubagentModelMigration, error) {
	r.agentsMu.Lock()
	defer r.agentsMu.Unlock()
	out := SubagentModelMigration{}
	globalPath, err := r.scopePath("global")
	if err != nil {
		return SubagentModelMigration{}, err
	}
	if out.GlobalChanged, err = config.MigrateSubagentModel(globalPath); err != nil {
		return SubagentModelMigration{}, err
	}
	if workspace := r.currentWorkspace(); workspace != "" {
		workspacePath := filepath.Join(workspace, config.FileName)
		if out.WorkspaceChanged, err = config.MigrateSubagentModel(workspacePath); err != nil {
			return SubagentModelMigration{}, err
		}
	}
	return out, nil
}

// SubagentModelMigration reports which files the one-click migration rewrote.
type SubagentModelMigration struct {
	GlobalChanged    bool `json:"globalChanged"`
	WorkspaceChanged bool `json:"workspaceChanged"`
}
