//go:build windows

package update

import (
	"os/exec"
	"syscall"
)

// prepareCmd configures the command to run with a hidden window on Windows
func prepareCmd(cmd *exec.Cmd) *exec.Cmd {
	cmd.SysProcAttr = &syscall.SysProcAttr{
		HideWindow:    true,
		CreationFlags: 0x08000000, // CREATE_NO_WINDOW
	}
	return cmd
}
