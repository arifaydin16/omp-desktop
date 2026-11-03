package omp

import (
	"strings"
	"testing"
)

func TestInstanceSessionIDIsolation(t *testing.T) {
	svc := NewService()

	// 1. Set session IDs for isolated instances
	svc.SetActiveSessionIDInstance("sess_alpha", "2026-11-03-alpha-uuid")
	svc.SetActiveSessionIDInstance("sess_beta", "2026-11-03-beta-uuid")

	alphaSess := svc.GetActiveSessionIDInstance("sess_alpha")
	if alphaSess != "2026-11-03-alpha-uuid" {
		t.Errorf("expected alpha session ID, got: %s", alphaSess)
	}

	betaSess := svc.GetActiveSessionIDInstance("sess_beta")
	if betaSess != "2026-11-03-beta-uuid" {
		t.Errorf("expected beta session ID, got: %s", betaSess)
	}

	// 2. Clear alpha, beta must remain unaffected
	svc.ClearActiveSessionInstance("sess_alpha")
	if svc.GetActiveSessionIDInstance("sess_alpha") != "" {
		t.Errorf("expected alpha session ID to be cleared")
	}
	if svc.GetActiveSessionIDInstance("sess_beta") != "2026-11-03-beta-uuid" {
		t.Errorf("expected beta session ID to remain intact")
	}

	// 3. Test running instance status
	if svc.IsInstanceRunning("sess_beta") {
		t.Errorf("expected sess_beta not to be running before execution")
	}

	running := svc.GetRunningInstances()
	if len(running) != 0 {
		t.Errorf("expected 0 running instances, got: %v", running)
	}

	// 4. Test StopAgentInstance on idle/non-existent instance returns nil without panic
	if err := svc.StopAgentInstance("sess_beta"); err != nil {
		t.Errorf("expected StopAgentInstance on idle instance to return nil, got: %v", err)
	}
}

func TestSessionIDExtractionFromInstanceID(t *testing.T) {
	instID := "sess_2026-11-03-my-test-session"
	if !strings.HasPrefix(instID, "sess_") {
		t.Fatalf("expected prefix sess_")
	}
	extracted := strings.TrimPrefix(instID, "sess_")
	if extracted != "2026-11-03-my-test-session" {
		t.Errorf("expected extracted session id '2026-11-03-my-test-session', got '%s'", extracted)
	}
}
