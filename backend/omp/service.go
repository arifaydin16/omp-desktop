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


// Service is the main bridge for omp CLI, RPC and file management
type Service struct {
	ctx        context.Context
	ompBin     string
	activeCmd  *exec.Cmd
	cmdStdin   io.WriteCloser
	isWorking  bool
	mutex      sync.Mutex
	sessionDir string
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
	if opts.Profile != "" {
		args = append(args, "--profile="+opts.Profile)
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

	// User prompt
	if strings.TrimSpace(opts.Prompt) != "" {
		args = append(args, opts.Prompt)
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
func (s *Service) GetConfig() (map[string]interface{}, error) {
	cmd := prepareCmd(exec.Command(s.ompBin, "config", "list", "--json"))
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

// GetConfigKey returns a specific configuration setting
func (s *Service) GetConfigKey(key string) (string, error) {
	cmd := prepareCmd(exec.Command(s.ompBin, "config", "get", key))
	out, err := cmd.Output()
	if err != nil {
		return "", err
	}
	return strings.TrimSpace(string(out)), nil
}

// SetConfigKey updates a setting value
func (s *Service) SetConfigKey(key string, value string) error {
	cmd := prepareCmd(exec.Command(s.ompBin, "config", "set", key, value))
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
