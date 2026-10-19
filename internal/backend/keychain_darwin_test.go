//go:build darwin

package backend

import (
	"errors"
	"fmt"
	"strings"
	"testing"
	"time"
)

// The real macOS Keychain lifecycle, under a service name unique to this test run so it can never
// collide with another item or another install's store. It skips with a message when the Keychain
func TestRealKeychainLifecycle(t *testing.T) {
	// The store resolves the login keychain through HOME; TestMain points the package at a private
	// HOME, so this one test restores the user's real one, exactly as the app runs.
	t.Setenv("HOME", originalHome)
	store := keychainStore{service: fmt.Sprintf("com.lumencortex.desktop.test.credentials.%d", time.Now().UnixNano())}
	account := "provider.global.test-account"

	// Probe availability: a store that cannot even hold a probe item cannot be tested here.
	if err := store.Set(account+"-probe", "probe"); err != nil {
		t.Skipf("Keychain unavailable: %v", err)
	}
	if err := store.Delete(account + "-probe"); err != nil {
		t.Skipf("Keychain probe cleanup failed: %v", err)
	}
	t.Cleanup(func() { _ = store.Delete(account) })

	if !store.Available() {
		t.Fatal("Available() must be true when the probe succeeded")
	}

	// Set and get.
	if err := store.Set(account, secretA); err != nil {
		t.Fatalf("set: %v", err)
	}
	if got, err := store.Get(account); err != nil || got != secretA {
		t.Fatalf("get after set: %q %v", got, err)
	}

	// Replace and get: SecItemUpdate on the existing item.
	if err := store.Set(account, secretB); err != nil {
		t.Fatalf("replace: %v", err)
	}
	if got, err := store.Get(account); err != nil || got != secretB {
		t.Fatalf("get after replace: %q %v", got, err)
	}

	// Delete and get-not-found.
	if err := store.Delete(account); err != nil {
		t.Fatalf("delete: %v", err)
	}
	if _, err := store.Get(account); !errors.Is(err, errSecretNotFound) {
		t.Fatalf("get after delete: %v, want errSecretNotFound", err)
	}
	if err := store.Delete(account); !errors.Is(err, errSecretNotFound) {
		t.Fatalf("delete after delete: %v, want errSecretNotFound", err)
	}

	// No store error text carries the value, even when the item exists.
	if err := store.Set(account, secretA); err != nil {
		t.Fatal(err)
	}
	if _, err := store.Get(account + "-absent"); err == nil || strings.Contains(err.Error(), secretA) || strings.Contains(err.Error(), secretB) {
		t.Fatalf("not-found error must name the item only: %v", err)
	}
	if err := store.Set("", secretA); err == nil || strings.Contains(err.Error(), secretA) {
		t.Fatalf("empty-name error must not carry the value: %v", err)
	}
}
