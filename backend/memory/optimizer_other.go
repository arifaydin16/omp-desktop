//go:build !windows

package memory

func trimPlatformMemory() {
	// No-op on non-Windows platforms
}
