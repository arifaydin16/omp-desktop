package omp

import (
	"os"
	"path/filepath"
	"testing"
)

func TestParseInitialWorkingDir(t *testing.T) {
	tmpDir, err := os.MkdirTemp("", "omp-path-test-*")
	if err != nil {
		t.Fatalf("failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tmpDir)

	testFile := filepath.Join(tmpDir, "sample.txt")
	_ = os.WriteFile(testFile, []byte("hello"), 0644)

	tests := []struct {
		name     string
		args     []string
		expected string
	}{
		{
			name:     "no args",
			args:     []string{"omp-desktop.exe"},
			expected: "",
		},
		{
			name:     "--path flag with space",
			args:     []string{"omp-desktop.exe", "--path", tmpDir},
			expected: tmpDir,
		},
		{
			name:     "--path flag with equal sign",
			args:     []string{"omp-desktop.exe", "--path=" + tmpDir},
			expected: tmpDir,
		},
		{
			name:     "-p flag with space",
			args:     []string{"omp-desktop.exe", "-p", tmpDir},
			expected: tmpDir,
		},
		{
			name:     "-p flag with equal sign",
			args:     []string{"omp-desktop.exe", "-p=" + tmpDir},
			expected: tmpDir,
		},
		{
			name:     "--cwd flag with space",
			args:     []string{"omp-desktop.exe", "--cwd", tmpDir},
			expected: tmpDir,
		},
		{
			name:     "--cwd flag with equal sign",
			args:     []string{"omp-desktop.exe", "--cwd=" + tmpDir},
			expected: tmpDir,
		},
		{
			name:     "positional existing directory (e.g. %V in Windows context menu)",
			args:     []string{"omp-desktop.exe", tmpDir},
			expected: tmpDir,
		},
		{
			name:     "positional existing file (resolves to parent dir)",
			args:     []string{"omp-desktop.exe", testFile},
			expected: tmpDir,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			res := parseInitialWorkingDir(tc.args)
			if res != tc.expected {
				t.Errorf("expected %q, got %q", tc.expected, res)
			}
		})
	}
}

func TestResolveValidWorkingDirWithFile(t *testing.T) {
	tmpDir, err := os.MkdirTemp("", "omp-res-test-*")
	if err != nil {
		t.Fatalf("failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tmpDir)

	subFile := filepath.Join(tmpDir, "main.go")
	_ = os.WriteFile(subFile, []byte("package main"), 0644)

	resolved := resolveValidWorkingDir(subFile)
	if resolved != tmpDir {
		t.Errorf("expected %q, got %q", tmpDir, resolved)
	}
}
