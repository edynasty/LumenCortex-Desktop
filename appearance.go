package main

import (
	"os/exec"
	"strings"

	"github.com/wailsapp/wails/v2/pkg/options"
)

// The native window shows its background colour wherever the webview has not painted: at launch,
// during a live resize and in overscroll. The frontend sets it to the resolved theme's ground once
// it runs (lib/theme.ts); these are the same --bg-window values for the first frame.
var (
	windowGroundLight = &options.RGBA{R: 0xee, G: 0xf2, B: 0xf8, A: 255}
	windowGroundDark  = &options.RGBA{R: 0x0b, G: 0x11, B: 0x1c, A: 255}
)

// initialWindowGround picks the launch background from the system appearance, which is what the
// theme preference "system" (the default) resolves to. A stored explicit theme is corrected by
// the frontend as soon as it loads.
func initialWindowGround() *options.RGBA {
	// `defaults read -g AppleInterfaceStyle` prints "Dark" in dark mode and fails in light mode.
	out, err := exec.Command("defaults", "read", "-g", "AppleInterfaceStyle").Output()
	return windowGroundFor(string(out), err == nil)
}

// windowGroundFor maps the raw AppleInterfaceStyle output (and whether the read succeeded) to a colour.
func windowGroundFor(raw string, ok bool) *options.RGBA {
	if ok && strings.EqualFold(strings.TrimSpace(raw), "dark") {
		return windowGroundDark
	}
	return windowGroundLight
}
