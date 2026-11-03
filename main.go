package main

import (
	"embed"
	"os"
	"strings"

	"omp-desktop/backend/memory"

	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
	"github.com/wailsapp/wails/v2/pkg/options/windows"
)

//go:embed all:frontend/dist
var assets embed.FS

func main() {
	// Configure low-memory profiles for Go runtime and WebView2
	memory.ConfigureEnvironment()

	// Create an instance of the app structure
	app := NewApp()

	if isServiceMode(os.Args) {
		if err := app.RunHeadlessService(); err != nil {
			println("Service Error:", err.Error())
		}
		return
	}

	// Create application with options
	err := wails.Run(&options.App{
		Title:     "oh-my-pi Desktop",
		Width:     1280,
		Height:    840,
		MinWidth:  960,
		MinHeight: 640,
		AssetServer: &assetserver.Options{
			Assets: assets,
		},
		BackgroundColour: &options.RGBA{R: 13, G: 17, B: 23, A: 255},
		OnStartup:        app.startup,
		OnShutdown:       app.shutdown,
		Bind: []interface{}{
			app,
		},
		Windows: &windows.Options{
			WebviewIsTransparent: false,
			WindowIsTranslucent:  false,
			BackdropType:         windows.Mica,
			WebviewGpuIsDisabled: true,
		},
	})

	if err != nil {
		println("Error:", err.Error())
	}
}

func isServiceMode(args []string) bool {
	for _, arg := range args[1:] {
		trimmed := strings.ToLower(strings.TrimSpace(arg))
		if trimmed == "--service" || trimmed == "-s" ||
			trimmed == "--headless" ||
			trimmed == "--daemon" || trimmed == "-d" ||
			trimmed == "--server" {
			return true
		}
	}
	return false
}
