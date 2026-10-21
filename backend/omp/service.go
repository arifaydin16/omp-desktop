package omp

import (
	"bufio"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
	"sync"
	"syscall"
	"time"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// prepareCmd hides the console window on Windows
func prepareCmd(cmd *exec.Cmd) *exec.Cmd {
	cmd.SysProcAttr = &syscall.SysProcAttr{
		HideWindow:    true,
		CreationFlags: 0x08000000, // CREATE_NO_WINDOW
	}
	return cmd
}

// AgentRunOptions represents options to run an omp agent session
type AgentRunOptions struct {
	Prompt        string   `json:"prompt"`
	Model         string   `json:"model"`
	SmolModel     string   `json:"smolModel"`
	SlowModel     string   `json:"slowModel"`
	PlanModel     string   `json:"planModel"`
	ThinkingLevel string   `json:"thinkingLevel"`
	ApprovalMode  string   `json:"approvalMode"`
	AutoApprove   bool     `json:"autoApprove"`
	GoalMode      bool     `json:"goalMode"`
	PlanYolo      bool     `json:"planYolo"`
	Prewalk       bool     `json:"prewalk"`
	Advisor       bool     `json:"advisor"`
	Profile       string   `json:"profile"`
	Cwd           string   `json:"cwd"`
	SessionID     string   `json:"sessionId"`
	Files         []string `json:"files"`
}

// SessionSummary represents a stored session metadata
type SessionSummary struct {
	ID        string    `json:"id"`
	Path      string    `json:"path"`
	Title     string    `json:"title"`
	Project   string    `json:"project"`
	Cwd       string    `json:"cwd"`
	Model     string    `json:"model"`
	UpdatedAt time.Time `json:"updatedAt"`
	MsgCount  int       `json:"msgCount"`
	TotalCost float64   `json:"totalCost"`
}

// SessionDetail represents full session details and messages
type SessionDetail struct {
	Summary  SessionSummary           `json:"summary"`
	Messages []map[string]interface{} `json:"messages"`
}

// ModelCatalog represents available models returned by omp
type ModelCatalog struct {
	Models []ModelEntry `json:"models"`
}

type ModelEntry struct {
	ID            string                 `json:"id"`
	Provider      string                 `json:"provider"`
	Kind          string                 `json:"kind"`
	Selector      string                 `json:"selector"`
	Name          string                 `json:"name"`
	ContextWindow int                    `json:"contextWindow"`
	MaxTokens     int                    `json:"maxTokens"`
	Reasoning     bool                   `json:"reasoning"`
	Thinking      []string               `json:"thinking"`
	Input         []string               `json:"input"`
	Cost          map[string]interface{} `json:"cost"`
}
// SkillItem represents an installed or custom skill
type SkillItem struct {
	Name        string `json:"name"`
	Description string `json:"description"`
	FilePath    string `json:"filePath"`
	BaseDir     string `json:"baseDir"`
	IsCustom    bool   `json:"isCustom"`
}
// WorkspaceFileItem represents a file or directory in workspace
type WorkspaceFileItem struct {
	Name     string `json:"name"`     // e.g. "css/" or "App.tsx"
	RelPath  string `json:"relPath"`  // e.g. "assets/css" or "frontend/src/App.tsx"
	FullPath string `json:"fullPath"` // absolute path on disk
	IsDir    bool   `json:"isDir"`
}

// AuthCredentialItem represents a stored credential in omp
type AuthCredentialItem struct {
	Provider     string `json:"provider"`
	Type         string `json:"type"` // "oauth" | "api_key"
	Key          string `json:"key,omitempty"` // masked key
	Email        string `json:"email,omitempty"`
	Expires      int64  `json:"expires,omitempty"`
	ProjectId    string `json:"projectId,omitempty"`
	AuthorizedAt int64  `json:"authorizedAt,omitempty"`
}

// LoginEvent is emitted during an active login flow
type LoginEvent struct {
	Type      string `json:"type"` // "started" | "url" | "waiting" | "prompt" | "success" | "error" | "cancelled"
	Provider  string `json:"provider"`
	URL       string `json:"url,omitempty"`
	LaunchURL string `json:"launchUrl,omitempty"`
	Message   string `json:"message,omitempty"`
}

// Service is the main bridge for omp CLI, RPC and file management
type Service struct {
	ctx            context.Context
	ompBin         string
	activeCmd      *exec.Cmd
	cmdStdin       io.WriteCloser
	isWorking      bool
	mutex          sync.Mutex
	sessionDir     string
	currentProfile string
	loginCmd       *exec.Cmd
	loginStdin     io.WriteCloser
	loginMutex     sync.Mutex
}

func NewService() *Service {
	bin := findOmpBinary()
	homeDir, _ := os.UserHomeDir()
	sessDir := filepath.Join(homeDir, ".omp", "agent", "sessions")

	return &Service{
		ompBin:     bin,
		sessionDir: sessDir,
	}
}
// SetProfile sets the active profile name and updates the session directory
func (s *Service) SetProfile(profile string) {
	s.mutex.Lock()
	defer s.mutex.Unlock()
	cleaned := strings.TrimSpace(profile)
	if cleaned == "" {
		cleaned = "default"
	}
	s.currentProfile = cleaned

	homeDir, _ := os.UserHomeDir()
	if cleaned != "default" {
		s.sessionDir = filepath.Join(homeDir, ".omp", "profiles", cleaned, "agent", "sessions")
	} else {
		s.sessionDir = filepath.Join(homeDir, ".omp", "agent", "sessions")
	}
}

// GetCurrentProfile returns current active profile name
func (s *Service) GetCurrentProfile() string {
	s.mutex.Lock()
	defer s.mutex.Unlock()
	if s.currentProfile == "" {
		return "default"
	}
	return s.currentProfile
}

// GetProfiles returns all available profile names from ~/.omp/profiles
func (s *Service) GetProfiles() []string {
	profiles := []string{"default"}
	homeDir, err := os.UserHomeDir()
	if err != nil {
		return profiles
	}
	profDir := filepath.Join(homeDir, ".omp", "profiles")
	entries, err := os.ReadDir(profDir)
	if err == nil {
		for _, e := range entries {
			if e.IsDir() && e.Name() != "default" {
				profiles = append(profiles, e.Name())
			}
		}
	}
	return profiles
}

func (s *Service) configArgs(subArgs ...string) []string {
	var args []string
	s.mutex.Lock()
	prof := s.currentProfile
	s.mutex.Unlock()

	if prof != "" && prof != "default" {
		args = append(args, "--profile="+prof)
	}
	args = append(args, "config")
	args = append(args, subArgs...)
	return args
}


func (s *Service) SetContext(ctx context.Context) {
	s.ctx = ctx
}

func findOmpBinary() string {
	// 1. Check local appdata omp.exe
	localAppData := os.Getenv("LOCALAPPDATA")
	if localAppData != "" {
		p := filepath.Join(localAppData, "omp", "omp.exe")
		if _, err := os.Stat(p); err == nil {
			return p
		}
	}
	// 2. Check PATH
	if p, err := exec.LookPath("omp"); err == nil {
		return p
	}
	return "omp"
}

// GetBinaryInfo returns omp path and version
func (s *Service) GetBinaryInfo() (map[string]string, error) {
	cmd := prepareCmd(exec.Command(s.ompBin, "--help"))
	out, err := cmd.CombinedOutput()
	version := "unknown"
	if err == nil {
		lines := strings.Split(string(out), "\n")
		if len(lines) > 0 && strings.HasPrefix(strings.TrimSpace(lines[0]), "omp ") {
			version = strings.TrimSpace(lines[0])
		}
	}
	return map[string]string{
		"path":    s.ompBin,
		"version": version,
	}, nil
}

// ExecuteAgent launches or feeds into an omp run with real-time streaming
func (s *Service) ExecuteAgent(opts AgentRunOptions) error {
	s.mutex.Lock()
	if s.isWorking {
		s.mutex.Unlock()
		return fmt.Errorf("an agent turn is already running")
	}
	s.isWorking = true
	s.mutex.Unlock()

	defer func() {
		s.mutex.Lock()
		s.isWorking = false
		s.activeCmd = nil
		s.cmdStdin = nil
		s.mutex.Unlock()
		if s.ctx != nil {
			runtime.EventsEmit(s.ctx, "agent:status", map[string]interface{}{"status": "idle"})
		}
	}()

	var args []string
	args = append(args, "-p", "--print-thoughts")

	if opts.Model != "" {
		args = append(args, "--model="+opts.Model)
	}
	if opts.SmolModel != "" {
		args = append(args, "--smol="+opts.SmolModel)
	}
	if opts.SlowModel != "" {
		args = append(args, "--slow="+opts.SlowModel)
	}
	if opts.PlanModel != "" {
		args = append(args, "--plan="+opts.PlanModel)
	}
	if opts.ThinkingLevel != "" {
		args = append(args, "--thinking="+opts.ThinkingLevel)
	}
	if opts.ApprovalMode != "" {
		args = append(args, "--approval-mode="+opts.ApprovalMode)
	}
	if opts.AutoApprove {
		args = append(args, "--auto-approve")
	}
	if opts.GoalMode {
		args = append(args, "--goal")
	}
	if opts.PlanYolo {
		args = append(args, "--plan-yolo")
	}
	if opts.Prewalk {
		args = append(args, "--prewalk")
	}
	if opts.Advisor {
		args = append(args, "--advisor")
	}
	prof := opts.Profile
	if prof == "" {
		s.mutex.Lock()
		prof = s.currentProfile
		s.mutex.Unlock()
	}
	if prof != "" && prof != "default" {
		args = append(args, "--profile="+prof)
	}
	if opts.SessionID != "" {
		args = append(args, "--resume="+opts.SessionID)
	}

	// File attachments
	for _, f := range opts.Files {
		if strings.TrimSpace(f) != "" {
			args = append(args, "@"+strings.TrimSpace(f))
		}
	}

	// User prompt & Skill discovery
	prompt := strings.TrimSpace(opts.Prompt)
	if prompt != "" {
		skillRegex := regexp.MustCompile(`(?i)(?:^|\s)\[?(?:/skill:)([a-zA-Z0-9_-]+)\]?`)
		if matches := skillRegex.FindStringSubmatch(prompt); len(matches) > 1 {
			skillName := matches[1]
			args = append(args, "--skills="+skillName)
		}
		args = append(args, prompt)
	}

	cmd := prepareCmd(exec.Command(s.ompBin, args...))
	if opts.Cwd != "" {
		cmd.Dir = opts.Cwd
	}

	// Provide empty stdin with immediate EOF so omp does not hang waiting for piped stdin
	cmd.Stdin = strings.NewReader("")

	stdout, err := cmd.StdoutPipe()
	if err != nil {
		return err
	}
	stderr, err := cmd.StderrPipe()
	if err != nil {
		return err
	}

	s.mutex.Lock()
	s.activeCmd = cmd
	s.mutex.Unlock()

	fullCommand := fmt.Sprintf("omp %s", strings.Join(args, " "))

	if s.ctx != nil {
		runtime.EventsEmit(s.ctx, "agent:status", map[string]interface{}{
			"status":  "running",
			"args":    args,
			"command": fullCommand,
		})
		runtime.EventsEmit(s.ctx, "agent:command", map[string]interface{}{
			"command": fullCommand,
			"cwd":     cmd.Dir,
		})
	}

	if err := cmd.Start(); err != nil {
		return err
	}

	// Read stdout line by line
	go func() {
		scanner := bufio.NewScanner(stdout)
		buf := make([]byte, 64*1024)
		scanner.Buffer(buf, 1024*1024)

		for scanner.Scan() {
			line := scanner.Text()
			trimmed := strings.TrimSpace(line)

			// Completely filter out any JSON telemetry/metadata
			if strings.HasPrefix(trimmed, "{") && strings.HasSuffix(trimmed, "}") {
				continue
			}

			// Route transient status to stderr
			if trimmed == "Working..." || trimmed == "Working…" {
				if s.ctx != nil {
					runtime.EventsEmit(s.ctx, "agent:stream", map[string]interface{}{
						"type":    "stderr",
						"content": trimmed,
					})
				}
				continue
			}

			if s.ctx != nil {
				runtime.EventsEmit(s.ctx, "agent:stream", map[string]interface{}{
					"type":    "stdout",
					"content": line,
				})
			}
		}
	}()

	// Read stderr line by line
	go func() {
		scanner := bufio.NewScanner(stderr)
		for scanner.Scan() {
			line := scanner.Text()
			if s.ctx != nil {
				runtime.EventsEmit(s.ctx, "agent:stream", map[string]interface{}{
					"type":    "stderr",
					"content": line,
				})
			}
		}
	}()

	err = cmd.Wait()
	exitCode := 0
	if cmd.ProcessState != nil {
		exitCode = cmd.ProcessState.ExitCode()
	}

	if s.ctx != nil {
		runtime.EventsEmit(s.ctx, "agent:done", map[string]interface{}{
			"exitCode": exitCode,
			"success":  err == nil,
		})
	}

	return err
}

// StopAgent terminates current running agent process
func (s *Service) StopAgent() error {
	s.mutex.Lock()
	defer s.mutex.Unlock()

	if s.activeCmd != nil && s.activeCmd.Process != nil {
		return s.activeCmd.Process.Kill()
	}
	return nil
}

// SendStdin writes to the agent's stdin (for approvals, interactive prompts)
func (s *Service) SendStdin(input string) error {
	s.mutex.Lock()
	defer s.mutex.Unlock()

	if s.cmdStdin != nil {
		_, err := s.cmdStdin.Write([]byte(input + "\n"))
		return err
	}
	return nil
}

// GetModels returns available models as structured JSON
func (s *Service) GetModels() (*ModelCatalog, error) {
	cmd := prepareCmd(exec.Command(s.ompBin, "models", "--json"))
	out, err := cmd.Output()
	if err != nil {
		return nil, fmt.Errorf("failed to fetch models: %w", err)
	}

	var catalog ModelCatalog
	if err := json.Unmarshal(out, &catalog); err != nil {
		return nil, fmt.Errorf("failed to parse models JSON: %w", err)
	}
	return &catalog, nil
}

// RefreshModels triggers fresh catalog fetch
func (s *Service) RefreshModels() (string, error) {
	cmd := prepareCmd(exec.Command(s.ompBin, "models", "refresh"))
	out, err := cmd.CombinedOutput()
	if err != nil {
		return string(out), err
	}
	return string(out), nil
}

// GetUsage returns provider usage statistics
func (s *Service) GetUsage() (map[string]interface{}, error) {
	cmd := prepareCmd(exec.Command(s.ompBin, "usage", "--json"))
	out, err := cmd.Output()
	if err != nil {
		// Fallback to text if --json fails
		textCmd := prepareCmd(exec.Command(s.ompBin, "usage"))
		textOut, textErr := textCmd.CombinedOutput()
		if textErr == nil {
			return map[string]interface{}{
				"rawText": string(textOut),
			}, nil
		}
		return nil, fmt.Errorf("failed to fetch usage: %w", err)
	}

	var result map[string]interface{}
	if err := json.Unmarshal(out, &result); err != nil {
		return nil, fmt.Errorf("failed to parse usage JSON: %w", err)
	}
	return result, nil
}

// GetConfig returns all configuration settings as JSON
// GetConfig returns all configuration settings as JSON for the active profile
func (s *Service) GetConfig() (map[string]interface{}, error) {
	args := s.configArgs("list", "--json")
	cmd := prepareCmd(exec.Command(s.ompBin, args...))
	out, err := cmd.Output()
	if err != nil {
		return nil, fmt.Errorf("failed to fetch config: %w", err)
	}

	var result map[string]interface{}
	if err := json.Unmarshal(out, &result); err != nil {
		return nil, fmt.Errorf("failed to parse config JSON: %w", err)
	}
	return result, nil
}

// GetConfigKey returns a specific configuration setting for the active profile
func (s *Service) GetConfigKey(key string) (string, error) {
	args := s.configArgs("get", key)
	cmd := prepareCmd(exec.Command(s.ompBin, args...))
	out, err := cmd.Output()
	if err != nil {
		return "", err
	}
	return strings.TrimSpace(string(out)), nil
}

// SetConfigKey updates a setting value for the active profile
func (s *Service) SetConfigKey(key string, value string) error {
	args := s.configArgs("set", key, value)
	cmd := prepareCmd(exec.Command(s.ompBin, args...))
	out, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("failed to set config %s: %s (%w)", key, string(out), err)
	}
	return nil
}

// GetProcesses returns background daemons from omp ps
func (s *Service) GetProcesses() (string, error) {
	cmd := prepareCmd(exec.Command(s.ompBin, "ps", "--all"))
	out, err := cmd.CombinedOutput()
	if err != nil {
		return string(out), err
	}
	return string(out), nil
}

// RunGitStatus returns git status / diff via omp
func (s *Service) RunGitStatus(cwd string) (string, error) {
	cmd := prepareCmd(exec.Command("git", "status", "-s"))
	if cwd != "" {
		cmd.Dir = cwd
	}
	out, err := cmd.CombinedOutput()
	if err != nil {
		return string(out), err
	}
	return string(out), nil
}
// GetGitBranch returns current git branch in cwd if it's a git repository
func (s *Service) GetGitBranch(cwd string) (string, error) {
	cmd := prepareCmd(exec.Command("git", "branch", "--show-current"))
	if cwd != "" {
		cmd.Dir = cwd
	}
	out, err := cmd.Output()
	if err != nil {
		cmd2 := prepareCmd(exec.Command("git", "rev-parse", "--abbrev-ref", "HEAD"))
		if cwd != "" {
			cmd2.Dir = cwd
		}
		out2, err2 := cmd2.Output()
		if err2 != nil {
			return "", nil
		}
		return strings.TrimSpace(string(out2)), nil
	}
	branch := strings.TrimSpace(string(out))
	if branch == "" {
		cmd2 := prepareCmd(exec.Command("git", "rev-parse", "--short", "HEAD"))
		if cwd != "" {
			cmd2.Dir = cwd
		}
		out2, _ := cmd2.Output()
		branch = strings.TrimSpace(string(out2))
	}
	return branch, nil
}


// RunGitDiff returns git diff
func (s *Service) RunGitDiff(cwd string) (string, error) {
	cmd := prepareCmd(exec.Command("git", "diff"))
	if cwd != "" {
		cmd.Dir = cwd
	}
	out, err := cmd.CombinedOutput()
	if err != nil {
		return string(out), err
	}
	return string(out), nil
}

// RunCommit triggers omp commit to generate commit message
func (s *Service) RunCommit(cwd string) (string, error) {
	cmd := prepareCmd(exec.Command(s.ompBin, "commit"))
	if cwd != "" {
		cmd.Dir = cwd
	}
	out, err := cmd.CombinedOutput()
	if err != nil {
		return string(out), err
	}
	return string(out), nil
}

// RunCleanse triggers project diagnostics repair
func (s *Service) RunCleanse(cwd string) (string, error) {
	cmd := prepareCmd(exec.Command(s.ompBin, "cleanse"))
	if cwd != "" {
		cmd.Dir = cwd
	}
	out, err := cmd.CombinedOutput()
	if err != nil {
		return string(out), err
	}
	return string(out), nil
}

// GetPlugins returns installed plugins
func (s *Service) GetPlugins() (string, error) {
	cmd := prepareCmd(exec.Command(s.ompBin, "plugin", "ls"))
	out, err := cmd.CombinedOutput()
	if err != nil {
		return string(out), err
	}
	return string(out), nil
}

// InstallPlugin installs a plugin
func (s *Service) InstallPlugin(pkg string) (string, error) {
	cmd := prepareCmd(exec.Command(s.ompBin, "plugin", "install", pkg))
	out, err := cmd.CombinedOutput()
	if err != nil {
		return string(out), err
	}
	return string(out), nil
}

// GetSkills returns raw output of installed skills
func (s *Service) GetSkills() (string, error) {
	cmd := prepareCmd(exec.Command(s.ompBin, "skill", "list"))
	out, err := cmd.CombinedOutput()
	if err != nil {
		return string(out), err
	}
	return string(out), nil
}

// GetSkillsList returns structured list of installed and custom skills
func (s *Service) GetSkillsList() ([]SkillItem, error) {
	cmd := prepareCmd(exec.Command(s.ompBin, "skill", "list", "--json"))
	out, err := cmd.CombinedOutput()
	var result struct {
		Skills []SkillItem `json:"skills"`
	}
	if err == nil {
		_ = json.Unmarshal(out, &result)
	}

	skillsMap := make(map[string]SkillItem)
	for _, sk := range result.Skills {
		sk.IsCustom = false
		skillsMap[sk.Name] = sk
	}

	homeDir, err := os.UserHomeDir()
	if err == nil {
		agentsDir := filepath.Join(homeDir, ".agents", "skills")
		entries, err := os.ReadDir(agentsDir)
		if err == nil {
			for _, entry := range entries {
				if entry.IsDir() {
					skillName := entry.Name()
					skillMdPath := filepath.Join(agentsDir, skillName, "SKILL.md")
					if _, err := os.Stat(skillMdPath); err == nil {
						item, exists := skillsMap[skillName]
						if !exists {
							desc := extractSkillDescription(skillMdPath)
							item = SkillItem{
								Name:        skillName,
								Description: desc,
								FilePath:    skillMdPath,
								BaseDir:     filepath.Join(agentsDir, skillName),
								IsCustom:    true,
							}
							skillsMap[skillName] = item
						} else {
							item.FilePath = skillMdPath
							item.BaseDir = filepath.Join(agentsDir, skillName)
							skillsMap[skillName] = item
						}
					}
				}
			}
		}

		// Inspect lock file to distinguish custom vs registry
		lockPath := filepath.Join(homeDir, ".agents", ".skill-lock.json")
		lockData, err := os.ReadFile(lockPath)
		registrySkills := make(map[string]bool)
		if err == nil {
			var lockObj struct {
				Skills map[string]interface{} `json:"skills"`
			}
			if json.Unmarshal(lockData, &lockObj) == nil {
				for name := range lockObj.Skills {
					registrySkills[name] = true
				}
			}
		}

		for name, item := range skillsMap {
			if !registrySkills[name] {
				item.IsCustom = true
				skillsMap[name] = item
			}
		}
	}

	var list []SkillItem
	for _, item := range skillsMap {
		list = append(list, item)
	}

	sort.Slice(list, func(i, j int) bool {
		return strings.ToLower(list[i].Name) < strings.ToLower(list[j].Name)
	})

	return list, nil
}

// ReadSkillContent reads the SKILL.md markdown text
func (s *Service) ReadSkillContent(filePath string) (string, error) {
	if filePath == "" {
		return "", fmt.Errorf("file path cannot be empty")
	}
	data, err := os.ReadFile(filePath)
	if err != nil {
		return "", err
	}
	return string(data), nil
}

// SaveCustomSkill creates or updates a custom skill in ~/.agents/skills/<name>/SKILL.md
func (s *Service) SaveCustomSkill(name, description, content string, isGlobal bool) error {
	name = strings.TrimSpace(strings.ToLower(name))
	if name == "" {
		return fmt.Errorf("skill name cannot be empty")
	}
	var safeName strings.Builder
	for _, ch := range name {
		if (ch >= 'a' && ch <= 'z') || (ch >= '0' && ch <= '9') || ch == '-' || ch == '_' {
			safeName.WriteRune(ch)
		} else if ch == ' ' {
			safeName.WriteRune('-')
		}
	}
	cleanName := safeName.String()
	if cleanName == "" {
		return fmt.Errorf("invalid skill name")
	}

	var targetDir string
	if isGlobal {
		homeDir, err := os.UserHomeDir()
		if err != nil {
			return err
		}
		targetDir = filepath.Join(homeDir, ".agents", "skills", cleanName)
	} else {
		targetDir = filepath.Join(".agents", "skills", cleanName)
	}

	if err := os.MkdirAll(targetDir, 0755); err != nil {
		return err
	}

	skillMdPath := filepath.Join(targetDir, "SKILL.md")
	var sb strings.Builder
	sb.WriteString("---\n")
	sb.WriteString(fmt.Sprintf("name: %s\n", cleanName))
	if description != "" {
		cleanDesc := strings.ReplaceAll(description, "\n", " ")
		sb.WriteString(fmt.Sprintf("description: %s\n", cleanDesc))
	}
	sb.WriteString("---\n\n")
	sb.WriteString(content)

	return os.WriteFile(skillMdPath, []byte(sb.String()), 0644)
}

// DeleteSkill deletes a custom skill folder or uninstalls from registry
func (s *Service) DeleteSkill(name, filePath string) error {
	name = strings.TrimSpace(name)
	if filePath != "" {
		dir := filepath.Dir(filePath)
		if strings.HasSuffix(filepath.Base(filePath), ".md") {
			_ = os.RemoveAll(dir)
		}
	}
	if name != "" {
		homeDir, err := os.UserHomeDir()
		if err == nil {
			targetDir := filepath.Join(homeDir, ".agents", "skills", name)
			_ = os.RemoveAll(targetDir)
		}
		cmd := prepareCmd(exec.Command(s.ompBin, "skill", "uninstall", "-g", name))
		_ = cmd.Run()
	}
	return nil
}

// SearchSkills queries skills on registry
func (s *Service) SearchSkills(query string) (string, error) {
	cmd := prepareCmd(exec.Command(s.ompBin, "skill", "search", query, "--json"))
	out, err := cmd.CombinedOutput()
	if err != nil {
		return string(out), err
	}
	return string(out), nil
}

// InstallSkill installs skill by name
func (s *Service) InstallSkill(name string) (string, error) {
	cmd := prepareCmd(exec.Command(s.ompBin, "skill", "install", "-g", "--yes", name))
	out, err := cmd.CombinedOutput()
	if err != nil {
		return string(out), err
	}
	return string(out), nil
}

func extractSkillDescription(skillMdPath string) string {
	f, err := os.Open(skillMdPath)
	if err != nil {
		return ""
	}
	defer f.Close()

	scanner := bufio.NewScanner(f)
	inFrontmatter := false
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "---" {
			if !inFrontmatter {
				inFrontmatter = true
				continue
			} else {
				break
			}
		}
		if inFrontmatter && strings.HasPrefix(line, "description:") {
			return strings.TrimSpace(strings.TrimPrefix(line, "description:"))
		}
	}
	return ""
}
// CountTokens counts tokens using offline tokenizers
func (s *Service) CountTokens(text string) (string, error) {
	cmd := prepareCmd(exec.Command(s.ompBin, "toks"))
	cmd.Stdin = strings.NewReader(text)
	out, err := cmd.CombinedOutput()
	if err != nil {
		return string(out), err
	}
	return string(out), nil
}

// GetSessions lists all saved sessions across project directories
func (s *Service) GetSessions(limit int) ([]SessionSummary, error) {
	var sessions []SessionSummary

	if _, err := os.Stat(s.sessionDir); os.IsNotExist(err) {
		return sessions, nil
	}

	projectDirs, err := os.ReadDir(s.sessionDir)
	if err != nil {
		return nil, err
	}

	for _, pDir := range projectDirs {
		if !pDir.IsDir() {
			continue
		}
		projPath := filepath.Join(s.sessionDir, pDir.Name())
		files, err := os.ReadDir(projPath)
		if err != nil {
			continue
		}

		for _, f := range files {
			if !strings.HasSuffix(f.Name(), ".jsonl") {
				continue
			}

			fullPath := filepath.Join(projPath, f.Name())
			summary := parseSessionSummary(fullPath, pDir.Name())
			if summary.ID != "" {
				sessions = append(sessions, summary)
			}
		}
	}

	// Sort newest first
	sort.Slice(sessions, func(i, j int) bool {
		return sessions[i].UpdatedAt.After(sessions[j].UpdatedAt)
	})

	if limit > 0 && len(sessions) > limit {
		sessions = sessions[:limit]
	}

	return sessions, nil
}

// parseSessionSummary reads headers and metadata from a session .jsonl
func parseSessionSummary(filePath string, projectName string) SessionSummary {
	info, err := os.Stat(filePath)
	if err != nil {
		return SessionSummary{}
	}

	file, err := os.Open(filePath)
	if err != nil {
		return SessionSummary{}
	}
	defer file.Close()

	summary := SessionSummary{
		Path:      filePath,
		Project:   projectName,
		UpdatedAt: info.ModTime(),
	}

	scanner := bufio.NewScanner(file)
	buf := make([]byte, 64*1024)
	scanner.Buffer(buf, 512*1024)

	lineCount := 0
	for scanner.Scan() {
		lineCount++
		text := strings.TrimSpace(scanner.Text())
		if text == "" {
			continue
		}

		var row map[string]interface{}
		if err := json.Unmarshal([]byte(text), &row); err != nil {
			continue
		}

		rowType, _ := row["type"].(string)
		switch rowType {
		case "title":
			if t, ok := row["title"].(string); ok && summary.Title == "" {
				summary.Title = t
			}
		case "session":
			if id, ok := row["id"].(string); ok && summary.ID == "" {
				summary.ID = id
			}
			if cwd, ok := row["cwd"].(string); ok && summary.Cwd == "" {
				summary.Cwd = cwd
			}
		case "model_change":
			if m, ok := row["model"].(string); ok && summary.Model == "" {
				summary.Model = m
			}
		}
		if usage, ok := row["usage"].(map[string]interface{}); ok {
			if costMap, ok := usage["cost"].(map[string]interface{}); ok {
				if tot, ok := costMap["total"].(float64); ok {
					summary.TotalCost += tot
				}
			}
		}
	}

	summary.MsgCount = lineCount
	if summary.Title == "" {
		summary.Title = filepath.Base(filePath)
	}
	if summary.ID == "" {
		summary.ID = strings.TrimSuffix(filepath.Base(filePath), ".jsonl")
	}

	return summary
}

// GetSessionDetail reads all messages for a specific session file or ID
func (s *Service) GetSessionDetail(sessionPath string) (*SessionDetail, error) {
	file, err := os.Open(sessionPath)
	if err != nil {
		return nil, fmt.Errorf("cannot open session: %w", err)
	}
	defer file.Close()

	summary := parseSessionSummary(sessionPath, filepath.Base(filepath.Dir(sessionPath)))
	var messages []map[string]interface{}

	scanner := bufio.NewScanner(file)
	buf := make([]byte, 64*1024)
	scanner.Buffer(buf, 1024*1024)

	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" {
			continue
		}

		var row map[string]interface{}
		if err := json.Unmarshal([]byte(line), &row); err == nil {
			messages = append(messages, row)
		}
	}

	return &SessionDetail{
		Summary:  summary,
		Messages: messages,
	}, nil
}

// ExportSessionHTML exports session as HTML using omp --export
func (s *Service) ExportSessionHTML(sessionPath string) (string, error) {
	cmd := prepareCmd(exec.Command(s.ompBin, "--export="+sessionPath))
	out, err := cmd.CombinedOutput()
	if err != nil {
		return string(out), err
	}
	return string(out), nil
}

// PackSession packages session into a tar/zip archive
func (s *Service) PackSession(sessionPath string, targetArchive string) (string, error) {
	cmd := prepareCmd(exec.Command(s.ompBin, "session", "pack", sessionPath, targetArchive))
	out, err := cmd.CombinedOutput()
	if err != nil {
		return string(out), err
	}
	return string(out), nil
}

// GetWorkspaceFiles scans the workspace directory for files and folders matching query
func (s *Service) GetWorkspaceFiles(cwd string, query string) ([]WorkspaceFileItem, error) {
	if cwd == "" {
		var err error
		cwd, err = os.Getwd()
		if err != nil {
			return nil, err
		}
	}
	cwd = filepath.Clean(cwd)

	// Clean query
	query = strings.TrimPrefix(query, "@")
	query = strings.ReplaceAll(query, "\\", "/")
	queryLower := strings.ToLower(query)

	ignoredDirs := map[string]bool{
		".git":         true,
		"node_modules": true,
		".omp":         true,
		"dist":         true,
		"build":        true,
		"bin":          true,
		".cache":       true,
		".next":        true,
		".nuxt":        true,
		"vendor":       true,
		".idea":        true,
		".vscode":      true,
		"__pycache__":  true,
		".venv":        true,
		"venv":         true,
		"target":       true,
		".obsidian":    true,
	}

	var items []WorkspaceFileItem
	maxItems := 150

	err := filepath.WalkDir(cwd, func(path string, d os.DirEntry, err error) error {
		if err != nil {
			return nil
		}
		if path == cwd {
			return nil
		}

		name := d.Name()
		if d.IsDir() {
			if ignoredDirs[name] {
				return filepath.SkipDir
			}
		}

		rel, err := filepath.Rel(cwd, path)
		if err != nil || rel == "." {
			return nil
		}
		rel = filepath.ToSlash(rel)
		relLower := strings.ToLower(rel)
		nameLower := strings.ToLower(name)

		displayName := name
		if d.IsDir() {
			displayName += "/"
		}

		matches := false
		if queryLower == "" {
			slashCount := strings.Count(rel, "/")
			if slashCount <= 1 {
				matches = true
			}
		} else {
			if strings.HasPrefix(relLower, queryLower) {
				matches = true
			} else if strings.Contains(relLower, queryLower) || strings.Contains(nameLower, queryLower) {
				matches = true
			}
		}

		if matches {
			items = append(items, WorkspaceFileItem{
				Name:     displayName,
				RelPath:  rel,
				FullPath: path,
				IsDir:    d.IsDir(),
			})
			if len(items) >= maxItems {
				return filepath.SkipAll
			}
		}

		return nil
	})

	if err != nil && err != filepath.SkipAll {
		return nil, err
	}

	sort.Slice(items, func(i, j int) bool {
		iPref := strings.HasPrefix(strings.ToLower(items[i].RelPath), queryLower)
		jPref := strings.HasPrefix(strings.ToLower(items[j].RelPath), queryLower)
		if iPref != jPref {
			return iPref
		}

		if items[i].IsDir != items[j].IsDir {
			return items[i].IsDir
		}

		iDepth := strings.Count(items[i].RelPath, "/")
		jDepth := strings.Count(items[j].RelPath, "/")
		if iDepth != jDepth {
			return iDepth < jDepth
		}

		return items[i].RelPath < items[j].RelPath
	})

	return items, nil
}

// GetAuthCredentials returns the list of stored credentials for the active profile
func (s *Service) GetAuthCredentials() ([]AuthCredentialItem, error) {
	var args []string
	s.mutex.Lock()
	prof := s.currentProfile
	s.mutex.Unlock()
	if prof != "" && prof != "default" {
		args = append(args, "--profile="+prof)
	}
	args = append(args, "auth", "export")
	cmd := prepareCmd(exec.Command(s.ompBin, args...))
	out, err := cmd.CombinedOutput()
	if err != nil && len(out) == 0 {
		return nil, fmt.Errorf("auth export failed: %w", err)
	}

	raw := string(out)
	start := strings.Index(raw, "{")
	end := strings.LastIndex(raw, "}")
	if start == -1 || end == -1 || end <= start {
		return []AuthCredentialItem{}, nil
	}

	jsonBlob := raw[start : end+1]
	var data struct {
		Version     int `json:"version"`
		Credentials []struct {
			Provider   string `json:"provider"`
			Credential struct {
				Type         string `json:"type"`
				Key          string `json:"key"`
				Email        string `json:"email"`
				Expires      int64  `json:"expires"`
				ProjectId    string `json:"projectId"`
				AuthorizedAt int64  `json:"authorizedAt"`
			} `json:"credential"`
		} `json:"credentials"`
	}

	if err := json.Unmarshal([]byte(jsonBlob), &data); err != nil {
		return nil, fmt.Errorf("failed to parse auth export json: %w", err)
	}

	var results []AuthCredentialItem
	for _, c := range data.Credentials {
		maskedKey := ""
		if c.Credential.Key != "" {
			k := c.Credential.Key
			if len(k) > 12 {
				maskedKey = k[:6] + "..." + k[len(k)-4:]
			} else {
				maskedKey = "***"
			}
		}

		results = append(results, AuthCredentialItem{
			Provider:     c.Provider,
			Type:         c.Credential.Type,
			Key:          maskedKey,
			Email:        c.Credential.Email,
			Expires:      c.Credential.Expires,
			ProjectId:    c.Credential.ProjectId,
			AuthorizedAt: c.Credential.AuthorizedAt,
		})
	}

	return results, nil
}

// StartLogin begins a login process for a provider or interactive choice
func (s *Service) StartLogin(providerId string, providerIndex int) error {
	s.loginMutex.Lock()
	if s.loginCmd != nil && s.loginCmd.Process != nil {
		_ = s.loginCmd.Process.Kill()
		s.loginCmd = nil
		s.loginStdin = nil
	}
	s.loginMutex.Unlock()

	var args []string
	s.mutex.Lock()
	prof := s.currentProfile
	s.mutex.Unlock()
	if prof != "" && prof != "default" {
		args = append(args, "--profile="+prof)
	}
	args = append(args, "login")
	if strings.TrimSpace(providerId) != "" {
		args = append(args, strings.TrimSpace(providerId))
	}

	cmd := prepareCmd(exec.Command(s.ompBin, args...))
	stdin, err := cmd.StdinPipe()
	if err != nil {
		return fmt.Errorf("failed to create stdin pipe: %w", err)
	}
	stdout, err := cmd.StdoutPipe()
	if err != nil {
		return fmt.Errorf("failed to create stdout pipe: %w", err)
	}
	stderr, err := cmd.StderrPipe()
	if err != nil {
		return fmt.Errorf("failed to create stderr pipe: %w", err)
	}

	if err := cmd.Start(); err != nil {
		return fmt.Errorf("failed to start login process: %w", err)
	}

	s.loginMutex.Lock()
	s.loginCmd = cmd
	s.loginStdin = stdin
	s.loginMutex.Unlock()

	if s.ctx != nil {
		runtime.EventsEmit(s.ctx, "login_event", LoginEvent{
			Type:     "started",
			Provider: providerId,
			Message:  "Giriş işlemi başlatıldı...",
		})
	}

	// If providerIndex was given and providerId was empty, send index after a small delay
	if providerId == "" && providerIndex > 0 {
		go func() {
			time.Sleep(300 * time.Millisecond)
			s.loginMutex.Lock()
			if s.loginStdin != nil {
				_, _ = fmt.Fprintf(s.loginStdin, "%d\n", providerIndex)
			}
			s.loginMutex.Unlock()
		}()
	}

	urlRegex := regexp.MustCompile(`https?://[^\s"'>]+`)

	handleLine := func(line string) {
		line = strings.TrimSpace(line)
		if line == "" {
			return
		}

		if strings.Contains(line, "Open this URL in your browser:") {
			foundUrl := urlRegex.FindString(line)
			if foundUrl != "" && s.ctx != nil {
				runtime.EventsEmit(s.ctx, "login_event", LoginEvent{
					Type:     "url",
					Provider: providerId,
					URL:      foundUrl,
					Message:  "Oturum açma bağlantısı oluşturuldu.",
				})
				runtime.BrowserOpenURL(s.ctx, foundUrl)
			}
			return
		}

		if strings.Contains(line, "Local shortcut (this machine only):") {
			foundLaunch := urlRegex.FindString(line)
			if foundLaunch != "" && s.ctx != nil {
				runtime.EventsEmit(s.ctx, "login_event", LoginEvent{
					Type:      "url",
					Provider:  providerId,
					LaunchURL: foundLaunch,
					Message:   "Yerel yönlendirme hazır.",
				})
			}
			return
		}

		if strings.Contains(line, "Waiting for browser authentication") {
			if s.ctx != nil {
				runtime.EventsEmit(s.ctx, "login_event", LoginEvent{
					Type:     "waiting",
					Provider: providerId,
					Message:  "Tarayıcıda kimlik doğrulama bekleniyor...",
				})
			}
			return
		}

		if strings.Contains(line, "Successfully logged in to") {
			if s.ctx != nil {
				runtime.EventsEmit(s.ctx, "login_event", LoginEvent{
					Type:     "success",
					Provider: providerId,
					Message:  line,
				})
			}
			return
		}

		if strings.Contains(line, "Create or copy your API key") || strings.Contains(line, "Enter API key") {
			if s.ctx != nil {
				runtime.EventsEmit(s.ctx, "login_event", LoginEvent{
					Type:     "prompt",
					Provider: providerId,
					Message:  line,
				})
			}
			return
		}

		if strings.HasPrefix(line, "https://") || strings.HasPrefix(line, "http://") {
			if s.ctx != nil {
				runtime.EventsEmit(s.ctx, "login_event", LoginEvent{
					Type:     "url",
					Provider: providerId,
					URL:      line,
					Message:  "Yetkilendirme bağlantısı",
				})
			}
		}
	}

	go func() {
		scanner := bufio.NewScanner(stdout)
		for scanner.Scan() {
			handleLine(scanner.Text())
		}
	}()

	go func() {
		scanner := bufio.NewScanner(stderr)
		for scanner.Scan() {
			handleLine(scanner.Text())
		}
	}()

	go func() {
		err := cmd.Wait()
		s.loginMutex.Lock()
		s.loginCmd = nil
		s.loginStdin = nil
		s.loginMutex.Unlock()

		if s.ctx != nil {
			if err == nil {
				runtime.EventsEmit(s.ctx, "login_event", LoginEvent{
					Type:     "success",
					Provider: providerId,
					Message:  "Giriş başarıyla tamamlandı!",
				})
			} else {
				errMsg := err.Error()
				if !strings.Contains(errMsg, "killed") && !strings.Contains(errMsg, "interrupt") {
					runtime.EventsEmit(s.ctx, "login_event", LoginEvent{
						Type:     "error",
						Provider: providerId,
						Message:  fmt.Sprintf("Giriş sonlandı: %v", err),
					})
				}
			}
		}
	}()

	return nil
}

// SendLoginInput sends text to the active login process's stdin
func (s *Service) SendLoginInput(input string) error {
	s.loginMutex.Lock()
	defer s.loginMutex.Unlock()
	if s.loginStdin == nil {
		return fmt.Errorf("no active login process waiting for input")
	}
	_, err := fmt.Fprintf(s.loginStdin, "%s\n", strings.TrimSpace(input))
	return err
}

// CancelLogin terminates any active login process
func (s *Service) CancelLogin() error {
	s.loginMutex.Lock()
	defer s.loginMutex.Unlock()
	if s.loginCmd != nil && s.loginCmd.Process != nil {
		err := s.loginCmd.Process.Kill()
		s.loginCmd = nil
		s.loginStdin = nil
		if s.ctx != nil {
			runtime.EventsEmit(s.ctx, "login_event", LoginEvent{
				Type:    "cancelled",
				Message: "Giriş işlemi iptal edildi.",
			})
		}
		return err
	}
	return nil
}

// SaveApiKeyCredential saves an API key directly using omp auth import
func (s *Service) SaveApiKeyCredential(provider string, apiKey string) error {
	provider = strings.TrimSpace(provider)
	apiKey = strings.TrimSpace(apiKey)
	if provider == "" || apiKey == "" {
		return fmt.Errorf("provider and apiKey cannot be empty")
	}

	payload := map[string]interface{}{
		"version": 1,
		"credentials": []map[string]interface{}{
			{
				"provider": provider,
				"credential": map[string]interface{}{
					"type":   "api_key",
					"key":    apiKey,
					"source": "login",
				},
			},
		},
	}

	bytes, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("failed to marshal credential json: %w", err)
	}

	var args []string
	s.mutex.Lock()
	prof := s.currentProfile
	s.mutex.Unlock()
	if prof != "" && prof != "default" {
		args = append(args, "--profile="+prof)
	}
	args = append(args, "auth", "import", "-")

	cmd := prepareCmd(exec.Command(s.ompBin, args...))
	cmd.Stdin = strings.NewReader(string(bytes))
	out, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("failed to import credential: %s (%w)", string(out), err)
	}

	return nil
}

// LogoutProvider removes a provider credential from agent.db
func (s *Service) LogoutProvider(provider string) error {
	provider = strings.TrimSpace(provider)
	if provider == "" {
		return fmt.Errorf("provider cannot be empty")
	}

	homeDir, err := os.UserHomeDir()
	if err != nil {
		return fmt.Errorf("cannot find home dir: %w", err)
	}

	s.mutex.Lock()
	prof := s.currentProfile
	s.mutex.Unlock()

	var dbPath string
	if prof != "" && prof != "default" {
		dbPath = filepath.Join(homeDir, ".omp", "profiles", prof, "agent", "agent.db")
	} else {
		dbPath = filepath.Join(homeDir, ".omp", "agent", "agent.db")
	}

	if _, err := os.Stat(dbPath); os.IsNotExist(err) {
		return fmt.Errorf("agent database not found at %s", dbPath)
	}

	query := fmt.Sprintf("DELETE FROM auth_credentials WHERE provider = '%s';", provider)
	cmd := prepareCmd(exec.Command("sqlite3", dbPath, query))
	out, err := cmd.CombinedOutput()
	if err != nil {
		pyScript := fmt.Sprintf("import sqlite3; conn = sqlite3.connect(r'%s'); conn.execute(\"DELETE FROM auth_credentials WHERE provider = '%s'\"); conn.commit(); conn.close()", dbPath, provider)
		pyCmd := prepareCmd(exec.Command("python", "-c", pyScript))
		pyOut, pyErr := pyCmd.CombinedOutput()
		if pyErr != nil {
			return fmt.Errorf("failed to delete credential: %s (%s)", string(out), string(pyOut))
		}
	}

	return nil
}

// OpenBrowserURL opens a web URL in the user's default browser
func (s *Service) OpenBrowserURL(url string) error {
	if s.ctx != nil && strings.TrimSpace(url) != "" {
		runtime.BrowserOpenURL(s.ctx, strings.TrimSpace(url))
	}
	return nil
}
