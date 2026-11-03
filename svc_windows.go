//go:build windows

package main

import (
	"strings"

	"golang.org/x/sys/windows"
	"golang.org/x/sys/windows/svc"
)

type ompWindowsService struct {
	app *App
}

// isWindowsService checks if the process was launched by Windows Service Control Manager (SCM)
func isWindowsService() bool {
	inService, err := svc.IsWindowsService()
	if err != nil {
		return false
	}
	return inService
}

// Execute is called by SCM when the Windows service starts
func (m *ompWindowsService) Execute(args []string, r <-chan svc.ChangeRequest, changes chan<- svc.Status) (ssec bool, errno uint32) {
	const cmdsAccepted = svc.AcceptStop | svc.AcceptShutdown
	changes <- svc.Status{State: svc.StartPending}

	// Parse command line from process creation (SCM binPath)
	rawCmdLine := windows.UTF16PtrToString(windows.GetCommandLine())
	parsedArgs := splitCommandLine(rawCmdLine)
	applyCliOverrides(m.app, parsedArgs)

	// Start background workers (Remote API, Poller, Memory optimizer)
	m.app.startServiceWorkers()

	changes <- svc.Status{State: svc.Running, Accepts: cmdsAccepted}

loop:
	for req := range r {
		switch req.Cmd {
		case svc.Interrogate:
			changes <- req.CurrentStatus
		case svc.Stop, svc.Shutdown:
			changes <- svc.Status{State: svc.StopPending}
			m.app.stopServiceWorkers()
			break loop
		default:
		}
	}

	changes <- svc.Status{State: svc.Stopped}
	return false, 0
}

func runWindowsService(app *App) error {
	return svc.Run("OmpService", &ompWindowsService{app: app})
}

// splitCommandLine tokenizes a raw command line string respecting quotes
func splitCommandLine(cmd string) []string {
	var args []string
	var current strings.Builder
	inQuotes := false

	for i := range len(cmd) {
		c := cmd[i]
		if c == '"' {
			inQuotes = !inQuotes
		} else if (c == ' ' || c == '\t') && !inQuotes {
			if current.Len() > 0 {
				args = append(args, current.String())
				current.Reset()
			}
		} else {
			current.WriteByte(c)
		}
	}
	if current.Len() > 0 {
		args = append(args, current.String())
	}
	return args
}
