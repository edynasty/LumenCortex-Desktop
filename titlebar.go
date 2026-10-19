package main

import (
	"os/exec"
	"strings"

	wailsruntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

// macOS "double-click a window's title bar" preference values (AppleActionOnDoubleClick
// in the global preference domain): "Maximize" (system default), "Minimize" or "None".
const (
	doubleClickMaximize = "Maximize"
	doubleClickMinimize = "Minimize"
	doubleClickNone     = "None"
)

// TitleBarDoubleClick runs the macOS title-bar double-click action for the main window.
//
// Wails v2.16 has no native handling for this: with mac.TitleBarHiddenInset() the title
// bar is web content, the JS drag runtime deliberately drops the second click of a double
// click (internal/frontend/runtime/desktop/main.js, `e.detail !== 1`), and the native side
// only ever performs a window drag. The frontend therefore reports a double click that
// landed on a `--wails-draggable: drag` region, and this method applies the action the
// user configured in System Settings, like a native title bar would.
func (a *App) TitleBarDoubleClick() {
	ctx := a.ctx
	if ctx == nil || wailsruntime.WindowIsFullscreen(ctx) {
		// A hidden-inset title bar is not a zoom target in fullscreen.
		return
	}
	switch appleActionOnDoubleClick() {
	case doubleClickMinimize:
		wailsruntime.WindowMinimise(ctx)
	case doubleClickNone:
		// The user disabled the double-click action; keep native behavior.
	default:
		// "Maximize" and any unreadable value fall back to the system default.
		wailsruntime.WindowToggleMaximise(ctx)
	}
}

// appleActionOnDoubleClick reads the global AppleActionOnDoubleClick preference.
// The `defaults` CLI is the only way to read NSGlobalDomain without cgo. It runs once
// per double click, so the setting is honored even when changed while the app runs.
func appleActionOnDoubleClick() string {
	out, err := exec.Command("defaults", "read", "-g", "AppleActionOnDoubleClick").Output()
	if err != nil {
		return doubleClickMaximize
	}
	return parseDoubleClickAction(string(out))
}

// parseDoubleClickAction maps raw `defaults read -g` output to one of the three
// recognized actions; anything unknown falls back to the system default "Maximize".
func parseDoubleClickAction(raw string) string {
	value := strings.TrimSpace(raw)
	switch value {
	case doubleClickMaximize, doubleClickMinimize, doubleClickNone:
		return value
	default:
		return doubleClickMaximize
	}
}
