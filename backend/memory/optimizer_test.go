package memory

import (
	"os"
	"strings"
	"testing"
)

func TestConfigureEnvironment(t *testing.T) {
	ConfigureEnvironment()

	val := os.Getenv("WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS")
	if !strings.Contains(val, "--js-flags=--max-old-space-size=128") {
		t.Fatalf("expected --max-old-space-size=128 in env, got: %s", val)
	}
	if !strings.Contains(val, "--renderer-process-limit=1") {
		t.Fatalf("expected --renderer-process-limit=1 in env, got: %s", val)
	}
}

func TestTrimMemory(t *testing.T) {
	// Should not panic or error
	TrimMemory()
}
