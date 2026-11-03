//go:build windows

package main

import (
	"os"
	"syscall"
)

// attachConsole attaches standard streams to the parent console if invoked from cmd/powershell
func attachConsole() {
	mod := syscall.NewLazyDLL("kernel32.dll")
	proc := mod.NewProc("AttachConsole")
	// ATTACH_PARENT_PROCESS is 0xFFFFFFFF
	r, _, _ := proc.Call(uintptr(0xFFFFFFFF))
	if r != 0 {
		hout, err := syscall.GetStdHandle(syscall.STD_OUTPUT_HANDLE)
		if err == nil && hout != syscall.InvalidHandle {
			os.Stdout = os.NewFile(uintptr(hout), "/dev/stdout")
		}
		herr, err := syscall.GetStdHandle(syscall.STD_ERROR_HANDLE)
		if err == nil && herr != syscall.InvalidHandle {
			os.Stderr = os.NewFile(uintptr(herr), "/dev/stderr")
		}
		hin, err := syscall.GetStdHandle(syscall.STD_INPUT_HANDLE)
		if err == nil && hin != syscall.InvalidHandle {
			os.Stdin = os.NewFile(uintptr(hin), "/dev/stdin")
		}
	}
}
