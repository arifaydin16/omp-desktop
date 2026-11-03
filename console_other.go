//go:build !windows

package main

// attachConsole is a no-op on non-Windows platforms
func attachConsole() {}
