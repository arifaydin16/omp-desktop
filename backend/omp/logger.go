package omp

import (
	"fmt"
	"os"
	"path/filepath"
	"sync"
	"time"
)

var (
	logMu sync.Mutex
)

// LogService writes a timestamped log entry to both stdout (if attached)
// and appends to ~/.omp/service.log for background Windows services and daemon debugging.
func LogService(format string, a ...interface{}) {
	msg := fmt.Sprintf(format, a...)
	timestamp := time.Now().Format("2006-01-02 15:04:05")
	entry := fmt.Sprintf("[%s] %s\n", timestamp, msg)

	// 1. Print to console / stdout
	fmt.Print(entry)

	// 2. Append to ~/.omp/service.log
	logMu.Lock()
	defer logMu.Unlock()

	homeDir := ResolveEffectiveHomeDir()
	logFile := filepath.Join(homeDir, ".omp", "service.log")
	_ = os.MkdirAll(filepath.Dir(logFile), 0755)

	f, err := os.OpenFile(logFile, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0644)
	if err == nil {
		defer f.Close()
		_, _ = f.WriteString(entry)
	}
}
