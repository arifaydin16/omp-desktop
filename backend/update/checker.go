package update

import (
	"context"
	"fmt"
	"os/exec"
	"regexp"
	"strings"
	"sync"
	"syscall"
	"time"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// prepareCmd configures the command to run with a hidden window on Windows
func prepareCmd(cmd *exec.Cmd) *exec.Cmd {
	cmd.SysProcAttr = &syscall.SysProcAttr{
		HideWindow:    true,
		CreationFlags: 0x08000000, // CREATE_NO_WINDOW
	}
	return cmd
}

// UpdateStatus represents the state of updates
type UpdateStatus struct {
	CurrentVersion string    `json:"currentVersion"`
	LatestVersion  string    `json:"latestVersion"`
	HasUpdate      bool      `json:"hasUpdate"`
	Channel        string    `json:"channel"`
	Message        string    `json:"message"`
	LastChecked    time.Time `json:"lastChecked"`
	Checking       bool      `json:"checking"`
}

// Service manages automatic update checks and installation
type Service struct {
	ctx          context.Context
	ompBin       string
	status       UpdateStatus
	ticker       *time.Ticker
	stopChan     chan struct{}
	mutex        sync.Mutex
	pollInterval time.Duration
}

func NewService(ompBin string) *Service {
	return &Service{
		ompBin:       ompBin,
		pollInterval: 30 * time.Minute,
		stopChan:     make(chan struct{}),
		status: UpdateStatus{
			Channel: "stable",
		},
	}
}

func (s *Service) SetContext(ctx context.Context) {
	s.ctx = ctx
}

// StartAutoChecker starts periodic update check goroutine
func (s *Service) StartAutoChecker() {
	// Run initial check shortly after startup
	go func() {
		time.Sleep(3 * time.Second)
		s.CheckForUpdates()
	}()

	s.ticker = time.NewTicker(s.pollInterval)
	go func() {
		for {
			select {
			case <-s.ticker.C:
				s.CheckForUpdates()
			case <-s.stopChan:
				return
			}
		}
	}()
}

// Stop stops the background checker
func (s *Service) Stop() {
	if s.ticker != nil {
		s.ticker.Stop()
	}
	close(s.stopChan)
}

// GetStatus returns the latest cached update status
func (s *Service) GetStatus() UpdateStatus {
	s.mutex.Lock()
	defer s.mutex.Unlock()
	return s.status
}

// CheckForUpdates runs omp update --check and parses the output
func (s *Service) CheckForUpdates() (*UpdateStatus, error) {
	s.mutex.Lock()
	s.status.Checking = true
	s.mutex.Unlock()

	if s.ctx != nil {
		runtime.EventsEmit(s.ctx, "update:checking", true)
	}

	cmd := prepareCmd(exec.Command(s.ompBin, "update", "--check"))
	out, err := cmd.CombinedOutput()
	outputStr := string(out)

	s.mutex.Lock()
	defer s.mutex.Unlock()

	s.status.Checking = false
	s.status.LastChecked = time.Now()
	s.status.Message = strings.TrimSpace(outputStr)

	// Regex for version numbers e.g. 18.12.3
	currRegex := regexp.MustCompile(`(?:Current version:\s*|omp\s+v?)([\w\.-]+)`)
	matchCurr := currRegex.FindStringSubmatch(outputStr)
	if len(matchCurr) > 1 {
		s.status.CurrentVersion = matchCurr[1]
	}

	// Check if up to date or update available
	if strings.Contains(outputStr, "Already up to date") || strings.Contains(outputStr, "is up to date") {
		s.status.HasUpdate = false
		s.status.LatestVersion = s.status.CurrentVersion
	} else if strings.Contains(outputStr, "Update available") || strings.Contains(outputStr, "New version") {
		s.status.HasUpdate = true
		newRegex := regexp.MustCompile(`(?:Update available:\s*|New version:\s*|->\s*)([\w\.-]+)`)
		matchNew := newRegex.FindStringSubmatch(outputStr)
		if len(matchNew) > 1 {
			s.status.LatestVersion = matchNew[1]
		}
	}

	if s.ctx != nil {
		runtime.EventsEmit(s.ctx, "update:status", s.status)
		if s.status.HasUpdate {
			runtime.EventsEmit(s.ctx, "update:available", s.status)
		}
	}

	if err != nil && outputStr == "" {
		return &s.status, fmt.Errorf("check failed: %w", err)
	}

	return &s.status, nil
}

// InstallUpdate triggers update execution
func (s *Service) InstallUpdate(canary bool, plugins bool, force bool) (string, error) {
	var args []string
	args = append(args, "update")

	if canary {
		args = append(args, "--canary")
	}
	if plugins {
		args = append(args, "--plugins")
	}
	if force {
		args = append(args, "--force")
	}

	if s.ctx != nil {
		runtime.EventsEmit(s.ctx, "update:installing", true)
	}

	cmd := prepareCmd(exec.Command(s.ompBin, args...))
	out, err := cmd.CombinedOutput()
	result := string(out)

	if s.ctx != nil {
		runtime.EventsEmit(s.ctx, "update:installed", map[string]interface{}{
			"output":  result,
			"success": err == nil,
		})
	}

	// Re-check after install
	go func() {
		time.Sleep(2 * time.Second)
		s.CheckForUpdates()
	}()

	if err != nil {
		return result, fmt.Errorf("update failed: %w (output: %s)", err, result)
	}

	return result, nil
}
