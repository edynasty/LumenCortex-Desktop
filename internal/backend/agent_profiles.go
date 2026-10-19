package backend

import (
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"unicode/utf8"

	"github.com/edynasty/LumenCortex/config"
)

// This file owns the Desktop-side agent profile catalog: a preset of Core AgentOptions plus the
// extra instructions a profile contributes. It is not a second runtime. Core still builds the run,
// enforces the policy and owns the default system prompt; a profile's instructions are appended
// after it and can never replace it or widen what its base allows.
//
// Storage is one versioned JSON file in the global configuration directory (next to
// credentials.json), written atomically through a temporary file and rename. The two built-in
// profiles always exist and cannot be deleted or renamed; only their instructions and defaults can
// change.

// Agent profile file and catalog limits. The name, instruction and profile bounds keep the file
// small and the page bounded; the frontend mirrors them for live counters.
const (
	agentProfilesFileName       = "agents.json"
	agentProfilesVersion        = 1
	maxAgentProfiles            = 16
	maxAgentProfileNameChars    = 40
	maxAgentProfileDescription  = 280
	maxAgentProfileInstructions = 8000
	maxAgentProfilesFileBytes   = 512 << 10
)

// Built-in profile ids. They are stable: composer preferences and the frontend rely on them.
const (
	AgentProfileAsk   = "ask"
	AgentProfileAgent = "agent"
)

// Profile base values: the runtime semantics the profile starts from. A profile can never widen
// beyond its base; Ask keeps Core's read-only, no-delegation conversation.
const (
	AgentBaseAsk   = "ask"
	AgentBaseAgent = "agent"
)

// Refusals the bridge can distinguish.
var (
	ErrUnknownAgentProfile = errors.New("unknown agent profile")
	ErrBuiltinAgentProfile = errors.New("built-in agent profiles cannot be renamed, rebased or deleted")
	ErrAgentProfileLimit   = errors.New("agent profile limit reached")
	ErrInvalidAgentProfile = errors.New("invalid agent profile")
)

// AgentProfile is one Wails-facing profile: a named preset of the composer's choices plus extra
// instructions. ModelRef, Effort and Policy are defaults the composer adopts when the profile is
// chosen; the user can still change them, and the backend clamps them by Base on every Start.
type AgentProfile struct {
	ID           string `json:"id"`
	Name         string `json:"name"`
	Description  string `json:"description,omitempty"`
	Base         string `json:"base"`
	Instructions string `json:"instructions,omitempty"`
	ModelRef     string `json:"modelRef,omitempty"`
	Effort       string `json:"effort,omitempty"`
	Policy       string `json:"policy,omitempty"`
	Builtin      bool   `json:"builtin"`
}

// AgentProfiles is the catalog as the page reads it. Warning is set when the file was unreadable or
// held entries that were skipped; the page shows it, and nothing is written until the user saves.
type AgentProfiles struct {
	Profiles []AgentProfile `json:"profiles"`
	Warning  string         `json:"warning,omitempty"`
}

type agentProfilesDocument struct {
	Version  int            `json:"version"`
	Profiles []AgentProfile `json:"profiles"`
}

// builtinAgentProfiles are the two profiles that always exist. Their names are canonical English
// ids; the page localizes them by id.
func builtinAgentProfiles() []AgentProfile {
	return []AgentProfile{
		{ID: AgentProfileAsk, Name: "Ask", Base: AgentBaseAsk, Policy: "read-only", Builtin: true},
		{ID: AgentProfileAgent, Name: "Agent", Base: AgentBaseAgent, Policy: "workspace", Builtin: true},
	}
}

func isBuiltinAgentProfile(id string) bool {
	return id == AgentProfileAsk || id == AgentProfileAgent
}

// agentProfilesPath resolves the catalog next to the global configuration and credential store.
func agentProfilesPath() (string, error) {
	dir, err := config.GlobalDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(dir, agentProfilesFileName), nil
}

// ListAgentProfiles returns the catalog, with the built-ins first. A corrupt or unreadable file
// falls back to the built-ins with a warning; it is never rewritten here.
func (r *Runtime) ListAgentProfiles() (AgentProfiles, error) {
	r.agentProfilesMu.Lock()
	defer r.agentProfilesMu.Unlock()
	return loadAgentProfiles()
}

// SaveAgentProfile creates a profile (ID empty) or replaces an existing custom profile. A built-in
// id saves only the fields a built-in may change: instructions, description, model, effort and
// policy; name, base and id stay as they are.
func (r *Runtime) SaveAgentProfile(profile AgentProfile) (AgentProfiles, error) {
	r.agentProfilesMu.Lock()
	defer r.agentProfilesMu.Unlock()
	current, err := loadAgentProfiles()
	if err != nil {
		return AgentProfiles{}, err
	}
	next, err := applyAgentProfileSave(current.Profiles, profile)
	if err != nil {
		return AgentProfiles{}, err
	}
	return writeAgentProfiles(next)
}

// DeleteAgentProfile removes a custom profile. A built-in id is refused.
func (r *Runtime) DeleteAgentProfile(id string) (AgentProfiles, error) {
	r.agentProfilesMu.Lock()
	defer r.agentProfilesMu.Unlock()
	current, err := loadAgentProfiles()
	if err != nil {
		return AgentProfiles{}, err
	}
	if isBuiltinAgentProfile(id) {
		return AgentProfiles{}, fmt.Errorf("%w: %s", ErrBuiltinAgentProfile, id)
	}
	next := make([]AgentProfile, 0, len(current.Profiles))
	found := false
	for _, profile := range current.Profiles {
		if profile.ID == id {
			found = true
			continue
		}
		next = append(next, profile)
	}
	if !found {
		return AgentProfiles{}, fmt.Errorf("%w: %s", ErrUnknownAgentProfile, id)
	}
	return writeAgentProfiles(next)
}

// ResetAgentProfile clears the instructions of a profile (a built-in included) and, for a custom
// profile, its default model, effort and policy.
func (r *Runtime) ResetAgentProfile(id string) (AgentProfiles, error) {
	r.agentProfilesMu.Lock()
	defer r.agentProfilesMu.Unlock()
	current, err := loadAgentProfiles()
	if err != nil {
		return AgentProfiles{}, err
	}
	found := false
	next := make([]AgentProfile, len(current.Profiles))
	copy(next, current.Profiles)
	for i := range next {
		if next[i].ID != id {
			continue
		}
		found = true
		next[i].Instructions = ""
		if !next[i].Builtin {
			next[i].ModelRef, next[i].Effort, next[i].Policy = "", "", ""
		} else if next[i].Base == AgentBaseAsk {
			next[i].Policy = "read-only"
		}
	}
	if !found {
		return AgentProfiles{}, fmt.Errorf("%w: %s", ErrUnknownAgentProfile, id)
	}
	return writeAgentProfiles(next)
}

// loadAgentProfiles reads and validates the catalog. Invalid entries are skipped with a warning
// that names the count, never their text.
func loadAgentProfiles() (AgentProfiles, error) {
	path, err := agentProfilesPath()
	if err != nil {
		return AgentProfiles{}, err
	}
	state := AgentProfiles{Profiles: builtinAgentProfiles()}
	info, err := os.Stat(path)
	if errors.Is(err, os.ErrNotExist) {
		return state, nil
	}
	if err != nil {
		state.Warning = "agents.json could not be read; showing the built-in profiles."
		return state, nil
	}
	if info.Size() > maxAgentProfilesFileBytes {
		state.Warning = "agents.json is too large; showing the built-in profiles."
		return state, nil
	}
	raw, err := os.ReadFile(path)
	if err != nil {
		state.Warning = "agents.json could not be read; showing the built-in profiles."
		return state, nil
	}
	var doc agentProfilesDocument
	if err := json.Unmarshal(raw, &doc); err != nil || doc.Version != agentProfilesVersion {
		state.Warning = "agents.json is not a valid profile catalog; showing the built-in profiles."
		return state, nil
	}

	seenID := map[string]bool{AgentProfileAsk: true, AgentProfileAgent: true}
	seenName := map[string]bool{"ask": true, "agent": true}
	skipped := 0
	for _, stored := range doc.Profiles {
		if isBuiltinAgentProfile(stored.ID) {
			index := 0
			if stored.ID == AgentProfileAgent {
				index = 1
			}
			// A built-in's identity is fixed; only what it may change is read back.
			if err := validateAgentProfileFields(stored); err != nil {
				skipped++
				continue
			}
			state.Profiles[index].Instructions = stored.Instructions
			state.Profiles[index].Description = stored.Description
			state.Profiles[index].ModelRef = stored.ModelRef
			state.Profiles[index].Effort = stored.Effort
			if stored.Policy != "" {
				state.Profiles[index].Policy = stored.Policy
			}
			continue
		}
		if stored.ID == "" || seenID[stored.ID] || seenName[strings.ToLower(stored.Name)] {
			skipped++
			continue
		}
		stored.Builtin = false
		if err := validateAgentProfile(stored); err != nil {
			skipped++
			continue
		}
		seenID[stored.ID] = true
		seenName[strings.ToLower(stored.Name)] = true
		state.Profiles = append(state.Profiles, stored)
	}
	if len(state.Profiles) > maxAgentProfiles {
		state.Profiles = state.Profiles[:maxAgentProfiles]
		skipped += len(doc.Profiles) - maxAgentProfiles
	}
	if skipped > 0 {
		state.Warning = fmt.Sprintf("agents.json has %d invalid or duplicate profile(s); they were skipped.", skipped)
	}
	return state, nil
}

// applyAgentProfileSave validates one save against the current catalog and returns the next one.
func applyAgentProfileSave(profiles []AgentProfile, incoming AgentProfile) ([]AgentProfile, error) {
	incoming.ID = strings.TrimSpace(incoming.ID)
	incoming.Name = strings.TrimSpace(incoming.Name)
	incoming.Description = strings.TrimSpace(incoming.Description)
	incoming.ModelRef = strings.TrimSpace(incoming.ModelRef)
	incoming.Effort = strings.TrimSpace(incoming.Effort)
	incoming.Policy = strings.TrimSpace(incoming.Policy)

	next := make([]AgentProfile, len(profiles))
	copy(next, profiles)

	if isBuiltinAgentProfile(incoming.ID) {
		for i := range next {
			if next[i].ID != incoming.ID {
				continue
			}
			if incoming.Base != "" && incoming.Base != next[i].Base {
				return nil, fmt.Errorf("%w: base of %s is %s", ErrBuiltinAgentProfile, incoming.ID, next[i].Base)
			}
			if incoming.Name != "" && incoming.Name != next[i].Name {
				return nil, fmt.Errorf("%w: name of %s is %s", ErrBuiltinAgentProfile, incoming.ID, next[i].Name)
			}
			if err := validateAgentProfileFields(incoming); err != nil {
				return nil, err
			}
			next[i].Instructions = incoming.Instructions
			next[i].Description = incoming.Description
			next[i].ModelRef = incoming.ModelRef
			next[i].Effort = incoming.Effort
			if incoming.Policy != "" {
				next[i].Policy = incoming.Policy
			}
			return next, nil
		}
		return nil, fmt.Errorf("%w: %s", ErrUnknownAgentProfile, incoming.ID)
	}

	if incoming.ID == "" {
		if len(profiles) >= maxAgentProfiles {
			return nil, ErrAgentProfileLimit
		}
		if err := validateAgentProfile(incoming); err != nil {
			return nil, err
		}
		if err := ensureAgentProfileNameFree(profiles, incoming); err != nil {
			return nil, err
		}
		incoming.ID = newAgentProfileID(profiles)
		incoming.Builtin = false
		return append(next, incoming), nil
	}

	for i := range next {
		if next[i].ID != incoming.ID {
			continue
		}
		if next[i].Builtin {
			return nil, fmt.Errorf("%w: %s", ErrBuiltinAgentProfile, incoming.ID)
		}
		if incoming.Base == "" {
			incoming.Base = next[i].Base
		}
		incoming.Builtin = false
		if err := validateAgentProfile(incoming); err != nil {
			return nil, err
		}
		if err := ensureAgentProfileNameFree(next, incoming); err != nil {
			return nil, err
		}
		next[i] = incoming
		return next, nil
	}
	return nil, fmt.Errorf("%w: %s", ErrUnknownAgentProfile, incoming.ID)
}

func newAgentProfileID(profiles []AgentProfile) string {
	used := map[string]bool{}
	for _, profile := range profiles {
		used[profile.ID] = true
	}
	for i := 0; ; i++ {
		id := fmt.Sprintf("profile-%d", i+1)
		if !used[id] {
			return id
		}
	}
}

func ensureAgentProfileNameFree(profiles []AgentProfile, profile AgentProfile) error {
	for _, other := range profiles {
		if other.ID != profile.ID && strings.EqualFold(other.Name, profile.Name) {
			return fmt.Errorf("%w: name %q is already used", ErrInvalidAgentProfile, profile.Name)
		}
	}
	return nil
}

// validateAgentProfile checks a custom profile: base, name, instructions and defaults.
func validateAgentProfile(profile AgentProfile) error {
	if profile.Base != AgentBaseAsk && profile.Base != AgentBaseAgent {
		return fmt.Errorf("%w: base must be ask or agent", ErrInvalidAgentProfile)
	}
	name := strings.TrimSpace(profile.Name)
	if name == "" || utf8.RuneCountInString(name) > maxAgentProfileNameChars {
		return fmt.Errorf("%w: name must be 1-%d characters", ErrInvalidAgentProfile, maxAgentProfileNameChars)
	}
	return validateAgentProfileFields(profile)
}

// validateAgentProfileFields checks what a built-in may change too.
func validateAgentProfileFields(profile AgentProfile) error {
	if utf8.RuneCountInString(profile.Instructions) > maxAgentProfileInstructions {
		return fmt.Errorf("%w: instructions are longer than %d characters", ErrInvalidAgentProfile, maxAgentProfileInstructions)
	}
	if utf8.RuneCountInString(profile.Description) > maxAgentProfileDescription {
		return fmt.Errorf("%w: description is longer than %d characters", ErrInvalidAgentProfile, maxAgentProfileDescription)
	}
	if profile.ModelRef != "" {
		if _, _, ok := config.ModelRef(profile.ModelRef).Split(); !ok {
			return fmt.Errorf("%w: model must be provider/model", ErrInvalidAgentProfile)
		}
	}
	switch profile.Effort {
	case "", "none", "low", "medium", "high", "max", "auto":
	default:
		return fmt.Errorf("%w: unknown effort %q", ErrInvalidAgentProfile, profile.Effort)
	}
	switch profile.Policy {
	case "", "read-only", "workspace", "full":
	default:
		return fmt.Errorf("%w: unknown policy %q", ErrInvalidAgentProfile, profile.Policy)
	}
	return nil
}

// writeAgentProfiles replaces the file atomically: temporary file in the same directory, fsync,
// rename. A failed write leaves the previous file untouched.
func writeAgentProfiles(profiles []AgentProfile) (AgentProfiles, error) {
	path, err := agentProfilesPath()
	if err != nil {
		return AgentProfiles{}, err
	}
	if err := os.MkdirAll(filepath.Dir(path), 0o700); err != nil {
		return AgentProfiles{}, err
	}
	raw, err := json.MarshalIndent(agentProfilesDocument{Version: agentProfilesVersion, Profiles: profiles}, "", "  ")
	if err != nil {
		return AgentProfiles{}, err
	}
	raw = append(raw, '\n')
	if len(raw) > maxAgentProfilesFileBytes {
		return AgentProfiles{}, fmt.Errorf("%w: catalog is too large", ErrInvalidAgentProfile)
	}
	temp, err := os.CreateTemp(filepath.Dir(path), ".agents-*.json")
	if err != nil {
		return AgentProfiles{}, err
	}
	tempPath := temp.Name()
	cleanup := func() {
		_ = temp.Close()
		_ = os.Remove(tempPath)
	}
	if err := temp.Chmod(0o600); err != nil {
		cleanup()
		return AgentProfiles{}, err
	}
	if _, err := temp.Write(raw); err != nil {
		cleanup()
		return AgentProfiles{}, err
	}
	if err := temp.Sync(); err != nil {
		cleanup()
		return AgentProfiles{}, err
	}
	if err := temp.Close(); err != nil {
		_ = os.Remove(tempPath)
		return AgentProfiles{}, err
	}
	if err := os.Rename(tempPath, path); err != nil {
		_ = os.Remove(tempPath)
		return AgentProfiles{}, err
	}
	return AgentProfiles{Profiles: profiles}, nil
}

// findAgentProfile resolves one profile by id from the loaded catalog.
func findAgentProfile(profiles []AgentProfile, id string) (AgentProfile, bool) {
	for _, profile := range profiles {
		if profile.ID == id {
			return profile, true
		}
	}
	return AgentProfile{}, false
}

// profileInstructions resolves the profile a Start names. It returns the instructions the backend
// will append and the base that caps the run, so the frontend cannot forge either.
func profileInstructions(id string) (instructions, base string, err error) {
	state, err := loadAgentProfiles()
	if err != nil {
		return "", "", err
	}
	profile, ok := findAgentProfile(state.Profiles, id)
	if !ok {
		return "", "", fmt.Errorf("%w: %s", ErrUnknownAgentProfile, id)
	}
	return profile.Instructions, profile.Base, nil
}
