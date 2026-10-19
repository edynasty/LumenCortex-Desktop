package main

import "testing"

// TitleBarDoubleClick must honor the macOS AppleActionOnDoubleClick preference. Only the
// value mapping is unit-testable here; the end-to-end double click is verified against the
// real app bundle (docs/reports/ux-provider-completion-platform-2026-10-19.md).
func TestParseDoubleClickAction(t *testing.T) {
	cases := map[string]string{
		"Maximize\n":     doubleClickMaximize,
		"Minimize\n":     doubleClickMinimize,
		"None\n":         doubleClickNone,
		"":               doubleClickMaximize, // unreadable/missing preference falls back
		"garbage\n":      doubleClickMaximize,
		"  Maximize  \n": doubleClickMaximize, // whitespace is trimmed
	}
	for raw, want := range cases {
		if got := parseDoubleClickAction(raw); got != want {
			t.Errorf("parseDoubleClickAction(%q) = %q, want %q", raw, got, want)
		}
	}
}
