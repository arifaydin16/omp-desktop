package omp

import (
	"testing"
	"time"
)

func TestGetSessionsPerformance(t *testing.T) {
	svc := NewService()
	
	// Cold run
	t0 := time.Now()
	sessions, err := svc.GetSessions(50)
	coldDur := time.Since(t0)
	if err != nil {
		t.Fatalf("GetSessions cold failed: %v", err)
	}
	t.Logf("Cold GetSessions(50): found %d sessions in %v", len(sessions), coldDur)

	// Warm run (cached)
	t1 := time.Now()
	cachedSessions, err := svc.GetSessions(50)
	warmDur := time.Since(t1)
	if err != nil {
		t.Fatalf("GetSessions warm failed: %v", err)
	}
	t.Logf("Warm GetSessions(50): found %d sessions in %v", len(cachedSessions), warmDur)

	if len(cachedSessions) != len(sessions) {
		t.Errorf("expected %d sessions, got %d", len(sessions), len(cachedSessions))
	}

	if warmDur > 100*time.Millisecond {
		t.Errorf("warm GetSessions took too long: %v (expected < 100ms)", warmDur)
	}
}
