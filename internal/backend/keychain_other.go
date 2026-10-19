//go:build !darwin

package backend

import (
	"errors"
	"fmt"
)

// unavailableStore is the credentialStore of every non-macOS build: the Desktop stores provider
// keys only in the macOS Keychain. Available() is false, every operation names the limitation,
// and {env:NAME} references keep working exactly as before.
type unavailableStore struct{}

// newCredentialStore returns the platform store; off macOS that is the unavailable stub.
func newCredentialStore() credentialStore { return unavailableStore{} }

// Available reports that no platform secret store exists here.
func (unavailableStore) Available() bool { return false }

// Set refuses the write with the platform limitation.
func (unavailableStore) Set(name, secret string) error {
	return errors.New("provider key storage is not available on this platform (macOS Keychain only)")
}

// Get reports the secret as missing.
func (unavailableStore) Get(name string) (string, error) {
	return "", fmt.Errorf("%w: %s", errSecretNotFound, name)
}

// Delete reports the secret as missing.
func (unavailableStore) Delete(name string) error {
	return fmt.Errorf("%w: %s", errSecretNotFound, name)
}
