//go:build darwin

package backend

// The macOS Keychain store behind {secret:NAME} provider credentials. Items are generic passwords
// under one dedicated service; the account is the secret name, so items are scoped to this store
// and never adopted by another install. Items are accessible only when the keychain is unlocked
// and never leave this device. Every item is created by this process itself, so reading and
// updating it needs no OS prompt.
//
// The Security framework is called directly through cgo; the `security` CLI is deliberately not
// used, because its argv would carry the secret to the process table. The CF dictionary work
// lives in C helpers (opaque CF pointer typedefs reach Go as uintptr, which must not be wrapped
// in unsafe.Pointer). Errors carry only the OSStatus text, never the secret. Wails builds
// require cgo on macOS anyway.

/*
#cgo LDFLAGS: -framework Security -framework CoreFoundation

#include <Security/Security.h>
#include <CoreFoundation/CoreFoundation.h>

// lcx_query builds the generic-password query shared by every call: class, service, account.
static CFMutableDictionaryRef lcx_query(CFStringRef service, CFStringRef account) {
	CFMutableDictionaryRef q = CFDictionaryCreateMutable(kCFAllocatorDefault, 4,
		&kCFTypeDictionaryKeyCallBacks, &kCFTypeDictionaryValueCallBacks);
	CFDictionaryAddValue(q, kSecClass, kSecClassGenericPassword);
	CFDictionaryAddValue(q, kSecAttrService, service);
	CFDictionaryAddValue(q, kSecAttrAccount, account);
	return q;
}

// lcx_query_add_value sets the item value of an add query.
static void lcx_query_add_value(CFMutableDictionaryRef q, CFDataRef v) {
	CFDictionaryAddValue(q, kSecValueData, v);
}

// lcx_query_add_accessible marks the item readable only while the keychain is unlocked and
// never synchronizable off this device.
static void lcx_query_add_accessible(CFMutableDictionaryRef q) {
	CFDictionaryAddValue(q, kSecAttrAccessible, kSecAttrAccessibleWhenUnlockedThisDeviceOnly);
}

// lcx_query_return_data turns a query into a "return the item's data" lookup of one match.
static void lcx_query_return_data(CFMutableDictionaryRef q) {
	CFDictionaryAddValue(q, kSecReturnData, kCFBooleanTrue);
	CFDictionaryAddValue(q, kSecMatchLimit, kSecMatchLimitOne);
}

static OSStatus lcx_item_add(CFDictionaryRef q) { return SecItemAdd(q, NULL); }

// lcx_item_update replaces the value of the item the query matches.
static OSStatus lcx_item_update(CFDictionaryRef q, CFDataRef v) {
	CFMutableDictionaryRef attrs = CFDictionaryCreateMutable(kCFAllocatorDefault, 1,
		&kCFTypeDictionaryKeyCallBacks, &kCFTypeDictionaryValueCallBacks);
	CFDictionaryAddValue(attrs, kSecValueData, v);
	OSStatus status = SecItemUpdate(q, attrs);
	CFRelease(attrs);
	return status;
}

static OSStatus lcx_item_delete(CFDictionaryRef q) { return SecItemDelete(q); }

static OSStatus lcx_item_copy(CFDictionaryRef q, CFTypeRef *out) { return SecItemCopyMatching(q, out); }

static CFIndex lcx_data_length(CFDataRef d) { return CFDataGetLength(d); }
static const UInt8 *lcx_data_bytes(CFDataRef d) { return CFDataGetBytePtr(d); }
*/
import "C"

import (
	"errors"
	"fmt"
	"unsafe"
)

// keychainStore is the credentialStore of the macOS Keychain.
type keychainStore struct {
	service string
}

// newCredentialStore returns the macOS Keychain store.
func newCredentialStore() credentialStore {
	return keychainStore{service: credentialService}
}

// Available reports whether the Keychain can be used. The Keychain exists on every macOS system;
// a locked or otherwise unusable keychain surfaces as an error on the call, not here.
func (keychainStore) Available() bool { return true }

// Set stores secret under name, replacing an existing item.
func (k keychainStore) Set(name, secret string) error {
	if name == "" || secret == "" {
		return errors.New("keychain: a secret name and value are required")
	}
	service, account, value := cfString(k.service), cfString(name), cfData(secret)
	defer C.CFRelease(C.CFTypeRef(service))
	defer C.CFRelease(C.CFTypeRef(account))
	defer C.CFRelease(C.CFTypeRef(value))

	query := C.lcx_query(service, account)
	defer C.CFRelease(C.CFTypeRef(query))
	C.lcx_query_add_value(query, value)
	C.lcx_query_add_accessible(query)
	status := C.lcx_item_add(C.CFDictionaryRef(query))
	if status == C.errSecDuplicateItem {
		status = C.lcx_item_update(C.CFDictionaryRef(query), value)
	}
	if status != C.errSecSuccess {
		return keychainError(status)
	}
	return nil
}

// Get returns the secret stored under name; a missing item is errSecretNotFound.
func (k keychainStore) Get(name string) (string, error) {
	if name == "" {
		return "", fmt.Errorf("%w: (empty name)", errSecretNotFound)
	}
	service, account := cfString(k.service), cfString(name)
	defer C.CFRelease(C.CFTypeRef(service))
	defer C.CFRelease(C.CFTypeRef(account))

	query := C.lcx_query(service, account)
	defer C.CFRelease(C.CFTypeRef(query))
	C.lcx_query_return_data(query)
	var out C.CFTypeRef
	status := C.lcx_item_copy(C.CFDictionaryRef(query), &out)
	if status == C.errSecItemNotFound {
		return "", fmt.Errorf("%w: %s", errSecretNotFound, name)
	}
	if status != C.errSecSuccess {
		return "", keychainError(status)
	}
	defer C.CFRelease(out)
	data := C.CFDataRef(out)
	length := int(C.lcx_data_length(data))
	if length == 0 {
		return "", fmt.Errorf("%w: %s", errSecretNotFound, name)
	}
	return string(C.GoBytes(unsafe.Pointer(C.lcx_data_bytes(data)), C.int(length))), nil
}

// Delete removes the item under name; a missing item is errSecretNotFound.
func (k keychainStore) Delete(name string) error {
	if name == "" {
		return fmt.Errorf("%w: (empty name)", errSecretNotFound)
	}
	service, account := cfString(k.service), cfString(name)
	defer C.CFRelease(C.CFTypeRef(service))
	defer C.CFRelease(C.CFTypeRef(account))

	query := C.lcx_query(service, account)
	defer C.CFRelease(C.CFTypeRef(query))
	status := C.lcx_item_delete(C.CFDictionaryRef(query))
	if status == C.errSecItemNotFound {
		return fmt.Errorf("%w: %s", errSecretNotFound, name)
	}
	if status != C.errSecSuccess {
		return keychainError(status)
	}
	return nil
}

// keychainError maps an OSStatus to a message with the Security framework's own text; the text
// names the status only and never carries the secret.
func keychainError(status C.OSStatus) error {
	message := C.SecCopyErrorMessageString(status, nil)
	defer C.CFRelease(C.CFTypeRef(message))
	length := int(C.CFStringGetLength(message))
	if length > 0 {
		buf := make([]byte, length*4+1)
		used := C.CFStringGetBytes(message, C.CFRange{location: 0, length: C.CFIndex(length)},
			C.kCFStringEncodingUTF8, C.UInt8(0), C.Boolean(0),
			(*C.UInt8)(unsafe.Pointer(&buf[0])), C.CFIndex(len(buf)), nil)
		if used > 0 {
			return fmt.Errorf("keychain: %s (OSStatus %d)", buf[:int(used)], int(status))
		}
	}
	return fmt.Errorf("keychain: OSStatus %d", int(status))
}

// cfString wraps a Go string in a CFStringRef the caller must release.
func cfString(s string) C.CFStringRef {
	if len(s) == 0 {
		return C.CFStringCreateWithBytes(C.kCFAllocatorDefault, nil, 0, C.kCFStringEncodingUTF8, C.Boolean(0))
	}
	return C.CFStringCreateWithBytes(C.kCFAllocatorDefault,
		(*C.UInt8)(unsafe.Pointer(unsafe.StringData(s))), C.CFIndex(len(s)), C.kCFStringEncodingUTF8, C.Boolean(0))
}

// cfData wraps a Go string's bytes in a CFDataRef the caller must release.
func cfData(s string) C.CFDataRef {
	if len(s) == 0 {
		return C.CFDataCreate(C.kCFAllocatorDefault, nil, 0)
	}
	return C.CFDataCreate(C.kCFAllocatorDefault,
		(*C.UInt8)(unsafe.Pointer(unsafe.StringData(s))), C.CFIndex(len(s)))
}
