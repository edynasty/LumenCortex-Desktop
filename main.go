package main

import (
	"embed"
	"log"
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
			// Adds About LumenCortex to the App menu.
			About: &mac.AboutInfo{Title: "LumenCortex", Message: "LumenCortex Desktop\n本地优先的编码智能体工作区 · Local-first coding-agent workspace"},
		},
	}); err != nil {
		log.Fatal(err)
	}
}
