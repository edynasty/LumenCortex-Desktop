package main

import (
	"runtime"

	"github.com/wailsapp/wails/v2/pkg/menu"
	"github.com/wailsapp/wails/v2/pkg/menu/keys"
	wailsruntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

// The native menu bar owns the app's window-level commands on macOS. Each custom item emits one
// "menu:command" event carrying the command name; the frontend handles it through
// lib/native-menu.ts, and its own key handlers for these keys stand down once SetMenuLocale
// reports that this menu is installed, so every command fires exactly once.
const (
	menuCommandEvent = "menu:command"

	menuCommandNewThread     = "new-thread"
	menuCommandSettings      = "settings"
	menuCommandPalette       = "palette"
	menuCommandToggleSidebar = "toggle-sidebar"

	defaultMenuLocale = "zh-CN"
)

// menuLabels are the localized titles of the custom items. Wails v2.16 builds the App, Edit and
// Window menus natively with fixed English titles, so only the File and View menus follow the
// app language.
type menuLabels struct {
	file, newThread, settings, hideWindow string
	view, palette, toggleSidebar          string
}

func menuLabelsFor(locale string) menuLabels {
	if locale == "en" {
		return menuLabels{
			file: "File", newThread: "New Thread", settings: "Settings…", hideWindow: "Hide Window",
			view: "View", palette: "Command Palette", toggleSidebar: "Toggle Sidebar",
		}
	}
	return menuLabels{
		file: "文件", newThread: "新建会话", settings: "设置…", hideWindow: "隐藏窗口",
		view: "视图", palette: "命令面板", toggleSidebar: "切换侧栏",
	}
}

// buildMenu returns the application menu: App (About, Hide, Quit), File, Edit, View and Window.
// emit receives a command name when a custom item is chosen; hideWindow runs for Hide Window.
func buildMenu(locale string, emit func(command string), hideWindow func()) *menu.Menu {
	l := menuLabelsFor(locale)
	command := func(name string) menu.Callback {
		return func(*menu.CallbackData) { emit(name) }
	}

	file := menu.NewMenu()
	file.AddText(l.newThread, keys.CmdOrCtrl("n"), command(menuCommandNewThread))
	file.AddText(l.settings, keys.CmdOrCtrl(","), command(menuCommandSettings))
	file.AddSeparator()
	file.AddText(l.hideWindow, keys.CmdOrCtrl("w"), func(*menu.CallbackData) { hideWindow() })

	view := menu.NewMenu()
	view.AddText(l.palette, keys.CmdOrCtrl("k"), command(menuCommandPalette))
	view.AddText(l.toggleSidebar, keys.CmdOrCtrl("b"), command(menuCommandToggleSidebar))

	return menu.NewMenuFromItems(
		menu.AppMenu(),
		menu.SubMenu(l.file, file),
		menu.EditMenu(),
		menu.SubMenu(l.view, view),
		menu.WindowMenu(),
	)
}

// emitMenuCommand forwards a chosen menu item to the frontend.
func (a *App) emitMenuCommand(command string) {
	if a.ctx == nil {
		return
	}
	wailsruntime.EventsEmit(a.ctx, menuCommandEvent, command)
}

// hideWindow hides the app, the way ⌘H does: the window disappears and a Dock click brings it
// back. Quitting is ⌘Q's job alone, so ⌘W can never drop a run by accident.
//
// Wails v2.16 offers two primitives here. WindowHide orders the window out, but its macOS
// AppDelegate implements neither applicationShouldHandleReopen nor window restoration, so a
// window hidden that way cannot be brought back from the Dock. runtime.Hide hides the
// application ([NSApp hide:]), which AppKit reverses on a Dock click; that is the same
// user-visible result and the only one that leaves the app reachable.
func (a *App) hideWindow() {
	if a.ctx == nil {
		return
	}
	wailsruntime.Hide(a.ctx)
}

// SetMenuLocale rebuilds the native menu bar in the app language ("zh-CN" or "en") and reports
// whether a native menu is installed. It is false off macOS and before startup; the frontend then
// keeps handling those keys itself.
func (a *App) SetMenuLocale(locale string) bool {
	if runtime.GOOS != "darwin" || a.ctx == nil {
		return false
	}
	a.menuMu.Lock()
	defer a.menuMu.Unlock()
	if a.menuLocale != locale {
		wailsruntime.MenuSetApplicationMenu(a.ctx, buildMenu(locale, a.emitMenuCommand, a.hideWindow))
		a.menuLocale = locale
	}
	return true
}
