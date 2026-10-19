package backend

import (
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"os"
	"regexp"
	"strings"
	"time"

	"github.com/edynasty/LumenCortex/config"
)

// This file owns the Desktop side of {secret:NAME} provider credentials: Core's file-backed
// credential store (config.FileCredentialStore, one 0600 credentials.json in the global
// configuration directory, shared with the CLI), the resolver the Desktop builds on top of it,
// and the three Wails-facing lifecycle APIs. The secret value crosses this boundary exactly
// once, as SaveProviderCredential's argument; it is never returned, logged, exported or written
// into lumencortex.json, which stores only the {secret:NAME} reference (the same rule AGENTS.md
// states for {env:NAME}). The store is not a secrets manager — it is not encrypted at rest; it is
// protected by file permissions and the user account, the trust level of an environment variable.

// credentialStore is the subset of config.FileCredentialStore the Desktop uses; tests install
// their own fake through the same seam. No method may put a secret's value into an error.
type credentialStore interface {
	// Set stores secret under name, replacing an existing item.
	Set(name, secret string) error
	// Get returns the secret stored under name; a missing item is an error wrapping
	// config.ErrCredentialNotFound.
	Get(name string) (string, error)
	// Delete removes the item; removing an absent name is not an error.
	Delete(name string) error
}

// credentialStoreTimeout bounds every store call made from a UI callback or a run: the store's
// cross-process advisory lock can stall behind another writer, and no Wails callback may block
// indefinitely. The underlying call is not cancellable; it finishes on its own goroutine and its
// result is dropped.
const credentialStoreTimeout = 5 * time.Second

// credentialResolver adapts the store to Core's config.CredentialResolver: missing secrets are
// config.ErrCredentialNotFound and no error text carries a value.
type credentialResolver struct {
	store credentialStore
}

// Resolve reads one secret through the store, bounded by credentialStoreTimeout.
func (c credentialResolver) Resolve(name string) (string, error) {
	type result struct {
		value string
		err   error
	}
	ch := make(chan result, 1)
	go func() {
		v, err := c.store.Get(name)
		ch <- result{v, err}
	}()
	select {
	case res := <-ch:
		if res.err != nil {
			if errors.Is(res.err, config.ErrCredentialNotFound) {
				return "", fmt.Errorf("%w: %s", config.ErrCredentialNotFound, name)
			}
			return "", res.err
		}
		if res.value == "" {
			return "", fmt.Errorf("%w: %s", config.ErrCredentialNotFound, name)
		}
		return res.value, nil
	case <-time.After(credentialStoreTimeout):
		return "", fmt.Errorf("reading secret %q timed out after %s", name, credentialStoreTimeout)
	}
}

// set stores a secret, bounded by credentialStoreTimeout.
func (c credentialResolver) set(name, secret string) error {
	return c.call("storing the provider key", func() error { return c.store.Set(name, secret) })
}

// delete removes a secret, bounded by credentialStoreTimeout.
func (c credentialResolver) delete(name string) error {
	return c.call("deleting the provider key", func() error { return c.store.Delete(name) })
}

// read reads a secret through Resolve, for callers that need the rollback value.
func (c credentialResolver) read(name string) (string, error) {
	return c.Resolve(name)
}

func (c credentialResolver) call(label string, fn func() error) error {
	ch := make(chan error, 1)
	go func() { ch <- fn() }()
	select {
	case err := <-ch:
		return err
	case <-time.After(credentialStoreTimeout):
		return fmt.Errorf("%s timed out after %s", label, credentialStoreTimeout)
	}
}

// CredentialStatus is the Wails-facing answer of the three credential APIs: it names the
// configured reference and whether a value is resolvable, never the value itself.
type CredentialStatus struct {
	ProviderID string `json:"providerId"`
	Scope      string `json:"scope"`
	Source     string `json:"source"` // "none" | "env" | "stored"
	// Ref is the configured reference ({env:X} / {secret:Y}); never a value.
	Ref string `json:"ref,omitempty"`
	// Set reports whether a value is resolvable right now.
	Set bool `json:"set"`
}

// Credential source values of CredentialStatus.Source.
const (
	credentialSourceNone   = "none"
	credentialSourceEnv    = "env"
	credentialSourceStored = "stored"
	credentialRefPrefix    = "{secret:"
)

// credentialName derives the store's secret name of one provider in one scope. It is
// deterministic (the scope and provider id are the identity), collision-free for any provider id
// the schema allows (the sanitized id carries the readable part, the hash suffix separates ids
// that sanitize alike), and matches Core's NAME pattern ^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$.
func credentialName(scope, providerID string) string {
	scope = normalizedScope(scope)
	sum := sha256.Sum256([]byte(scope + "\x00" + providerID))
	id := sanitizeSecretNamePart(providerID)
	// "provider." + scope + "." + id + "." + 8 hex must stay within the NAME pattern's 128 bytes.
	const fixed = len("provider.") + len("workspace") + len(".") + len(".") + 8
	if max := 128 - fixed; len(id) > max {
		id = id[:max]
	}
	return "provider." + scope + "." + id + "." + hex.EncodeToString(sum[:4])
}

// sanitizeSecretNamePart maps a provider id onto the secret-name alphabet: allowed characters
// stay, every other byte becomes '-'.
func sanitizeSecretNamePart(id string) string {
	var b strings.Builder
	for i := range len(id) {
		c := id[i]
		switch {
		case c >= 'a' && c <= 'z', c >= 'A' && c <= 'Z', c >= '0' && c <= '9', c == '.', c == '_', c == '-':
			b.WriteByte(c)
		default:
			b.WriteByte('-')
		}
	}
	if b.Len() == 0 {
		return "x"
	}
	return b.String()
}

// defaultCredentialStore returns Core's file-backed store at its default path, the one the CLI
// resolves through as well, so both hosts see the same secrets.
func defaultCredentialStore() (credentialStore, error) {
	path, err := config.DefaultCredentialStorePath()
	if err != nil {
		return nil, err
	}
	return config.NewFileCredentialStore(path), nil
}

func (r *Runtime) GetProviderCredentialStatus(scope, providerID string) (CredentialStatus, error) {
	resolver := r.credentialResolver()
	provider, err := r.scopeProvider(scope, providerID)
	if err != nil {
		return CredentialStatus{}, err
	}
	status := CredentialStatus{
		ProviderID: providerID,
		Scope:      normalizedScope(scope),
	}
	ref := ""
	if provider.Settings != nil {
		ref = provider.Settings.APIKey
	}
	if ref == "" {
		status.Source = credentialSourceNone
		return status, nil
	}
	if name, ok := config.EnvName(ref); ok {
		status.Source, status.Ref = credentialSourceEnv, ref
		status.Set = os.Getenv(name) != ""
		return status, nil
	}
	if name, ok := config.SecretName(ref); ok {
		status.Source, status.Ref = credentialSourceStored, ref
		_, err := resolver.Resolve(name)
		status.Set = err == nil
		return status, nil
	}
	return CredentialStatus{}, fmt.Errorf("apiKey of provider %s is not an {env:NAME} or {secret:NAME} reference", providerID)
}

// SaveProviderCredential stores what the user typed into the single API key field, classified
// first: a ${NAME} or {env:NAME} environment placeholder becomes the provider's {env:NAME}
// reference (nothing is stored, and any stored key of the provider is deleted after the
// configuration write); anything else is a literal key, stored in the credential store with the
// provider pointing at its {secret:NAME} reference. Both paths save through the same config.Save
// as the provider panel (digest conflict included) and roll their first write back when the
// second one fails, so the file and the store never disagree. A value that starts like a
// placeholder or a {secret:..} reference but is not a valid one is refused. The key value itself
// is never returned, logged or written to the config file.
func (r *Runtime) SaveProviderCredential(scope, providerID, apiKey string) (CredentialStatus, error) {
	value := strings.TrimSpace(apiKey)
	if value == "" {
		return CredentialStatus{}, fmt.Errorf("the API key of provider %s is empty", providerID)
	}
	envName, isEnv, err := classifyCredentialValue(value)
	if err != nil {
		return CredentialStatus{}, fmt.Errorf("the API key of provider %s is not accepted: %w", providerID, err)
	}
	if isEnv {
		return r.saveProviderEnvReference(scope, providerID, envName)
	}
	return r.saveProviderStoredKey(scope, providerID, value)
}

// dollarEnv matches a Spring-style ${NAME} placeholder; the NAME alphabet is Core's env
// reference alphabet.
var dollarEnv = regexp.MustCompile(`^\$\{([A-Za-z_][A-Za-z0-9_]*)\}$`)

// classifyCredentialValue sorts one typed API key value into an environment placeholder name or
// a literal key. A value that starts like a placeholder or a {secret:..} reference but is not a
// valid one is refused with an error that names only the shape, never the typed text:
// Spring-style defaults (${NAME:default}) are unsupported because a default would be a literal
// secret in the configuration, and {secret:..} references are created only by storing a key,
// never typed. A key that merely contains '$' or '{' elsewhere stays a literal key.
func classifyCredentialValue(value string) (envName string, isEnv bool, err error) {
	if m := dollarEnv.FindStringSubmatch(value); m != nil {
		return m[1], true, nil
	}
	if strings.HasPrefix(value, "${") {
		return "", false, errors.New("not a valid ${NAME} environment placeholder (defaults such as ${NAME:value} are not supported)")
	}
	if name, ok := config.EnvName(value); ok {
		return name, true, nil
	}
	if strings.HasPrefix(value, "{env:") {
		return "", false, errors.New("not a valid {env:NAME} reference")
	}
	if strings.HasPrefix(value, "{secret:") {
		return "", false, errors.New("a {secret:NAME} reference cannot be typed; paste the key itself or use ${NAME}")
	}
	return "", false, nil
}

// saveProviderEnvReference switches the provider to an {env:NAME} reference. The configuration
// write happens first; any stored key of the provider (the derived item and the one the previous
// reference named) is deleted afterwards, and a delete failure rolls the configuration back, so
// the switch is all-or-nothing and no stale secret stays reachable-or-stored.
func (r *Runtime) saveProviderEnvReference(scope, providerID, name string) (CredentialStatus, error) {
	resolver := r.credentialResolver()
	path, doc, err := r.scopeDocument(scope)
	if err != nil {
		return CredentialStatus{}, err
	}
	provider, ok := doc.File.Providers[providerID]
	if !ok {
		return CredentialStatus{}, fmt.Errorf("provider %q is not defined in the %s configuration", providerID, normalizedScope(scope))
	}
	hadSettings := provider.Settings != nil
	previous := ""
	if hadSettings {
		previous = provider.Settings.APIKey
	}

	settings := provider.Settings
	if settings == nil {
		settings = &config.ProviderSettings{}
	}
	settings.APIKey = "{env:" + name + "}"
	provider.Settings = settings
	doc.File.Providers[providerID] = provider
	newDigest, err := config.Save(path, doc.File, doc.Digest)
	if err != nil {
		return CredentialStatus{}, err
	}

	// No stored key may outlive the switch: drop the derived item and whatever the previous
	// reference named. A failure rolls the configuration back to the previous reference.
	stale := map[string]bool{credentialName(scope, providerID): true}
	if previousName, ok := config.SecretName(previous); ok {
		stale[previousName] = true
	}
	for item := range stale {
		if err := resolver.delete(item); err != nil {
			restored := doc.File
			entry := restored.Providers[providerID]
			if hadSettings {
				settings := *entry.Settings
				settings.APIKey = previous
				entry.Settings = &settings
			} else {
				entry.Settings = nil
			}
			restored.Providers[providerID] = entry
			if _, rollbackErr := config.Save(path, restored, newDigest); rollbackErr != nil {
				return CredentialStatus{}, fmt.Errorf("deleting the stored key of provider %s failed (%v) and rolling the configuration back failed too (%v); a stored key may remain in the credential store", providerID, err, rollbackErr)
			}
			return CredentialStatus{}, fmt.Errorf("deleting the stored key of provider %s failed: %w", providerID, err)
		}
	}
	return r.GetProviderCredentialStatus(scope, providerID)
}

// saveProviderStoredKey stores a literal key in the credential store and points the provider at
// its {secret:NAME} reference. The store write is rolled back when the config save fails.
func (r *Runtime) saveProviderStoredKey(scope, providerID, key string) (CredentialStatus, error) {
	resolver := r.credentialResolver()
	path, doc, err := r.scopeDocument(scope)
	if err != nil {
		return CredentialStatus{}, err
	}
	provider, ok := doc.File.Providers[providerID]
	if !ok {
		return CredentialStatus{}, fmt.Errorf("provider %q is not defined in the %s configuration", providerID, normalizedScope(scope))
	}
	name := credentialName(scope, providerID)

	// Remember the previous item so a failed config save restores the store exactly.
	previous, previousErr := resolver.read(name)
	hadPrevious := previousErr == nil

	if err := resolver.set(name, key); err != nil {
		return CredentialStatus{}, fmt.Errorf("storing the key of provider %s failed: %w", providerID, err)
	}
	settings := provider.Settings
	if settings == nil {
		settings = &config.ProviderSettings{}
	}
	settings.APIKey = credentialRefPrefix + name + "}"
	provider.Settings = settings
	doc.File.Providers[providerID] = provider
	if _, err := config.Save(path, doc.File, doc.Digest); err != nil {
		// Roll the store back to what it held before this call.
		if hadPrevious {
			_ = resolver.set(name, previous)
		} else {
			_ = resolver.delete(name)
		}
		return CredentialStatus{}, err
	}
	return r.GetProviderCredentialStatus(scope, providerID)
}

// RemoveProviderCredential deletes the stored item and clears the provider's apiKey reference in
// the scope's file, but only when the reference is a {secret:NAME} one: an {env:NAME} reference
// is the user's own configuration and is left alone.
func (r *Runtime) RemoveProviderCredential(scope, providerID string) (CredentialStatus, error) {
	resolver := r.credentialResolver()
	path, doc, err := r.scopeDocument(scope)
	if err != nil {
		return CredentialStatus{}, err
	}
	provider, ok := doc.File.Providers[providerID]
	if !ok {
		return CredentialStatus{}, fmt.Errorf("provider %q is not defined in the %s configuration", providerID, normalizedScope(scope))
	}
	ref := ""
	if provider.Settings != nil {
		ref = provider.Settings.APIKey
	}
	name, isSecret := config.SecretName(ref)
	if !isSecret {
		// Nothing of ours to remove: report the unchanged state.
		return r.GetProviderCredentialStatus(scope, providerID)
	}
	if err := resolver.delete(name); err != nil {
		return CredentialStatus{}, fmt.Errorf("deleting the key of provider %s failed: %w", providerID, err)
	}
	if provider.Settings != nil {
		settings := *provider.Settings
		settings.APIKey = ""
		provider.Settings = &settings
		doc.File.Providers[providerID] = provider
	}
	if _, err := config.Save(path, doc.File, doc.Digest); err != nil {
		return CredentialStatus{}, err
	}
	return r.GetProviderCredentialStatus(scope, providerID)
}

// scopeDocument reads one scope's configuration file raw, with its digest for the save.
func (r *Runtime) scopeDocument(scope string) (string, config.Document, error) {
	path, err := r.scopePath(scope)
	if err != nil {
		return "", config.Document{}, err
	}
	doc, err := config.ReadDocument(path)
	if err != nil {
		return "", config.Document{}, err
	}
	return path, doc, nil
}

// scopeProvider returns one provider entry of one scope's raw file.
func (r *Runtime) scopeProvider(scope, providerID string) (config.Provider, error) {
	_, doc, err := r.scopeDocument(scope)
	if err != nil {
		return config.Provider{}, err
	}
	provider, ok := doc.File.Providers[providerID]
	if !ok {
		return config.Provider{}, fmt.Errorf("provider %q is not defined in the %s configuration", providerID, normalizedScope(scope))
	}
	return provider, nil
}
