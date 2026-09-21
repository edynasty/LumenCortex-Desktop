package main

import (
	"embed"
	"log"

	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
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
		BackgroundColour: &options.RGBA{R: 10, G: 13, B: 20, A: 255},
	}); err != nil {
		log.Fatal(err)
	}
}
