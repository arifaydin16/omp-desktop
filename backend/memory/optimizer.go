package memory

import (
	"os"
	"path/filepath"
	"runtime"
	"runtime/debug"
	"strings"
	"time"
)

// ConfigureEnvironment sets low-memory limits for Go runtime and WebView2/Chromium
func ConfigureEnvironment() {
	// 1. Soft memory limit for Go runtime (128 MB)
	debug.SetMemoryLimit(128 * 1024 * 1024)

	// 2. More aggressive Go GC target (GC starts when heap grows by 50% rather than 100%)
	debug.SetGCPercent(50)

	// 3. Low-memory flags for WebView2 Chromium processes
	flags := []string{
		"--js-flags=--max-old-space-size=128",
		"--renderer-process-limit=1",
		"--disable-features=SpareRendererForSitePerProcess,OptimizationHints,MediaRouter,CalculateNativeWinOcclusion",
		"--enable-low-end-device-mode",
		"--disable-gpu-shader-disk-cache",
		"--disable-background-networking",
		"--disable-component-update",
		"--disable-domain-reliability",
	}

	existing := os.Getenv("WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS")
	var combined []string
	if existing != "" {
		combined = append(combined, existing)
	}
	for _, f := range flags {
		flagPrefix := strings.Split(f, "=")[0]
		if !strings.Contains(existing, flagPrefix) {
			combined = append(combined, f)
		}
	}
	_ = os.Setenv("WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS", strings.Join(combined, " "))
}

// TrimMemory forces Go GC, releases OS virtual memory, and trims platform working sets
func TrimMemory() {
	// Go runtime memory release
	runtime.GC()
	debug.FreeOSMemory()

	// Platform-specific process working set trimming (e.g. Windows)
	trimPlatformMemory()
}

// StartPeriodicOptimization starts a background loop trimming memory periodically
func StartPeriodicOptimization(interval time.Duration) {
	if interval <= 0 {
		interval = 45 * time.Second
	}
	go func() {
		ticker := time.NewTicker(interval)
		defer ticker.Stop()
		for range ticker.C {
			TrimMemory()
		}
	}()
}

func init() {
	// Ensure executable path or environment is prepped
	_ = filepath.Clean
}
