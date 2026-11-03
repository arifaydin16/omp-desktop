//go:build !windows

package omp

import "os/exec"

// prepareCmd is a no-op on non-Windows platforms
func prepareCmd(cmd *exec.Cmd) *exec.Cmd {
	return cmd
}
