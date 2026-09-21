package main

import (
	"embed"
	"log"

	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
	"github.com/wailsapp/wails/v2/pkg/options/mac"
)

//go:embed all:frontend/dist
var assets embed.FS

func main() {
	app := NewApp()
	if err := wails.Run(&options.App{
		Title:       "LumenCortex",
		Width:       1440,
		Height:      900,
		MinWidth:    1080,
		MinHeight:   680,
		AssetServer: &assetserver.Options{Assets: assets},
		OnStartup:   app.startup,
		OnShutdown:  app.shutdown,
		Bind:         []interface{}{app},
		BackgroundColour: &options.RGBA{R: 247, G: 247, B: 245, A: 255},
		Mac: &mac.Options{
			Appearance: mac.NSAppearanceNameAqua,
			TitleBar:   mac.TitleBarDefault(),
		},
	}); err != nil {
		log.Fatal(err)
	}
}
