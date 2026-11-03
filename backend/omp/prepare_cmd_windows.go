//go:build windows

package omp

import (
	"os/exec"
	"syscall"
)

// prepareCmd hides the console window on Windows
func prepareCmd(cmd *exec.Cmd) *exec.Cmd {
	cmd.SysProcAttr = &syscall.SysProcAttr{
		HideWindow:    true,
		CreationFlags: 0x08000000, // CREATE_NO_WINDOW
	}
	return cmd
}
