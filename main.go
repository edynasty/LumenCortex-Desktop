package main

import (
	"embed"
	"log"
	"os"
	"runtime"

	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/menu"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
	"github.com/wailsapp/wails/v2/pkg/options/mac"
)

//go:embed all:frontend/dist
var assets embed.FS

func main() {
	// --version and --self-check are answered before Wails starts: they must work on a machine
	// without a window server and must not create a window.
	if handled, code := handleDiagnosticArgs(os.Args[1:], os.Stdout, os.Stderr); handled {
		os.Exit(code)
	}

	app := NewApp()
	// The menu bar is macOS-only; the frontend replaces it with the app language through SetMenuLocale.
	var appMenu *menu.Menu
	if runtime.GOOS == "darwin" {
		appMenu = buildMenu(defaultMenuLocale, app.emitMenuCommand, app.closeWindow)
	}
	if err := wails.Run(&options.App{
		Title:            "LumenCortex",
		Width:            1440,
		Height:           900,
		MinWidth:         560,
		MinHeight:        540,
		AssetServer:      &assetserver.Options{Assets: assets},
		OnStartup:        app.startup,
		OnShutdown:       app.shutdown,
		Bind:             []interface{}{app},
		BackgroundColour: initialWindowGround(),
		Menu:             appMenu,
		// The unified toolbar is web content (frontend shell.css): the title bar is hidden and the
		// native traffic lights sit inset over the toolbar lead, which reserves their space.
		Mac: &mac.Options{
			TitleBar: mac.TitleBarHiddenInset(),
			// Adds About LumenCortex to the App menu. The message names the app, Core and Go
			// versions compiled into this binary (see version.go).
			About: &mac.AboutInfo{Title: "LumenCortex", Message: aboutMessage()},
		},
	}); err != nil {
		log.Fatal(err)
	}
}
