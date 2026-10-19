package backend

import (
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"os"
	"strings"
	"time"

	"github.com/edynasty/LumenCortex/config"
)

// This file owns the Desktop side of {secret:NAME} provider credentials: the platform store
// (macOS Keychain in keychain_darwin.go, an explicit unavailable stub elsewhere), Core's
// CredentialResolver on top of it, and the three Wails-facing lifecycle APIs. The secret value
// crosses this boundary exactly once, as SaveProviderCredential's argument; it is never returned,
// logged, exported or written into lumencortex.json, which stores only the {secret:NAME}
// reference (the same rule AGENTS.md states for {env:NAME}).

// errSecretNotFound is the store-level "no such item" error; credentialResolver maps it to
// Core's config.ErrCredentialNotFound.
var errSecretNotFound = errors.New("secret not found")

// credentialStore is the platform secret store behind {secret:NAME} references. Names are the
// NAME of the reference; no method may put the secret's value into an error.
type credentialStore interface {
	// Set stores secret under name, replacing an existing item.
	Set(name, secret string) error
	// Get returns the secret stored under name; a missing item is an error wrapping
	// errSecretNotFound.
	Get(name string) (string, error)
	// Delete removes the item; a missing item is an error wrapping errSecretNotFound.
	Delete(name string) error
	// Available reports whether the store can be used at all (false off macOS).
	Available() bool
}

// credentialService is the Keychain service all provider credentials live under; the account is
// the secret name, so items are scoped to this store and never adopted by another install.
const credentialService = "com.lumencortex.desktop.provider-credentials"

// credentialStoreTimeout bounds every store call made from a UI callback or a run: a Keychain
// that stalls (for example behind an OS prompt) fails fast instead of blocking the caller
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
			if errors.Is(res.err, errSecretNotFound) {
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
	ProviderID        string `json:"providerId"`
	Scope             string `json:"scope"`
	Source            string `json:"source"`            // "none" | "env" | "keychain"
	Ref               string `json:"ref,omitempty"`     // the configured reference; never a value
	Set               bool   `json:"set"`               // a value is resolvable right now
	KeychainAvailable bool   `json:"keychainAvailable"` // false off macOS or when Keychain cannot be used
}

// Credential source values of CredentialStatus.Source.
const (
	credentialSourceNone      = "none"
	credentialSourceEnv       = "env"
	credentialSourceKeychain  = "keychain"
	credentialRefPrefixSecret = "{secret:"
)

// credentialName derives the Keychain secret name of one provider in one scope. It is
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

// GetProviderCredentialStatus reports the credential state of one provider in one scope's
// lumencortex.json: which reference is configured, where it resolves, and whether a value is
// available right now.
func (r *Runtime) GetProviderCredentialStatus(scope, providerID string) (CredentialStatus, error) {
	resolver := r.credentialResolver()
	provider, err := r.scopeProvider(scope, providerID)
	if err != nil {
		return CredentialStatus{}, err
	}
	status := CredentialStatus{
		ProviderID:        providerID,
		Scope:             normalizedScope(scope),
		KeychainAvailable: resolver.store.Available(),
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
		status.Source, status.Ref = credentialSourceKeychain, ref
		_, err := resolver.Resolve(name)
		status.Set = err == nil
		return status, nil
	}
	return CredentialStatus{}, fmt.Errorf("apiKey of provider %s is not an {env:NAME} or {secret:NAME} reference", providerID)
}

// SaveProviderCredential stores the key in the platform store and points the provider's
// settings.apiKey at it ({secret:NAME}) in the scope's lumencortex.json, through the same save
// path as the provider panel (digest conflict included). The Keychain write is rolled back when
// the config save fails, so the file and the store never disagree. The key value itself is
// never returned, logged or written to the file.
func (r *Runtime) SaveProviderCredential(scope, providerID, apiKey string) (CredentialStatus, error) {
	if strings.TrimSpace(apiKey) == "" {
		return CredentialStatus{}, fmt.Errorf("the API key of provider %s is empty", providerID)
	}
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

	if err := resolver.set(name, apiKey); err != nil {
		return CredentialStatus{}, fmt.Errorf("storing the key of provider %s failed: %w", providerID, err)
	}
	settings := provider.Settings
	if settings == nil {
		settings = &config.ProviderSettings{}
	}
	settings.APIKey = credentialRefPrefixSecret + name + "}"
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

// RemoveProviderCredential deletes the Keychain item and clears the provider's apiKey reference
// in the scope's file, but only when the reference is a {secret:NAME} one: an {env:NAME}
// reference is the user's own configuration and is left alone.
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
	if err := resolver.delete(name); err != nil && !errors.Is(err, errSecretNotFound) {
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
