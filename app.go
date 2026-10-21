package main

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"time"

	"omp-desktop/backend/omp"
	"omp-desktop/backend/update"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// App struct
type App struct {
	ctx           context.Context
	ompService    *omp.Service
	updateService *update.Service
}

// NewApp creates a new App application struct
func NewApp() *App {
	ompSvc := omp.NewService()
	binInfo, _ := ompSvc.GetBinaryInfo()
	binPath := binInfo["path"]

	updateSvc := update.NewService(binPath)

	return &App{
		ompService:    ompSvc,
		updateService: updateSvc,
	}
}

// startup is called when the app starts. The context is saved
// so we can call the runtime methods
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
	a.ompService.SetContext(ctx)
	a.updateService.SetContext(ctx)

	// Start background automatic update checker
	a.updateService.StartAutoChecker()
}

// shutdown is called at app termination
func (a *App) shutdown(ctx context.Context) {
	a.updateService.Stop()
}

// GetBinaryInfo returns omp binary path and version
func (a *App) GetBinaryInfo() (map[string]string, error) {
	return a.ompService.GetBinaryInfo()
}

// ExecuteAgent runs an agent prompt with options
func (a *App) ExecuteAgent(opts omp.AgentRunOptions) error {
	return a.ompService.ExecuteAgent(opts)
}

// StopAgent terminates current running agent process
func (a *App) StopAgent() error {
	return a.ompService.StopAgent()
}

// SendStdin writes input to agent stdin
func (a *App) SendStdin(input string) error {
	return a.ompService.SendStdin(input)
}

// GetModels returns available models
func (a *App) GetModels() (*omp.ModelCatalog, error) {
	return a.ompService.GetModels()
}

// RefreshModels refreshes model catalog
func (a *App) RefreshModels() (string, error) {
	return a.ompService.RefreshModels()
}

// GetUsage returns provider usage statistics
func (a *App) GetUsage() (map[string]interface{}, error) {
	return a.ompService.GetUsage()
}

// GetConfig returns omp config
func (a *App) GetConfig() (map[string]interface{}, error) {
	return a.ompService.GetConfig()
}

// SetConfigKey updates a setting value
func (a *App) SetConfigKey(key string, value string) error {
	return a.ompService.SetConfigKey(key, value)
}

// GetSessions lists saved sessions
func (a *App) GetSessions(limit int) ([]omp.SessionSummary, error) {
	return a.ompService.GetSessions(limit)
}

// GetSessionDetail returns full session details and messages
func (a *App) GetSessionDetail(sessionPath string) (*omp.SessionDetail, error) {
	return a.ompService.GetSessionDetail(sessionPath)
}

// ExportSessionHTML exports a session to HTML
func (a *App) ExportSessionHTML(sessionPath string) (string, error) {
	return a.ompService.ExportSessionHTML(sessionPath)
}

// PackSession archives a session
func (a *App) PackSession(sessionPath string, targetArchive string) (string, error) {
	return a.ompService.PackSession(sessionPath, targetArchive)
}

// GetProcesses returns background daemons
func (a *App) GetProcesses() (string, error) {
	return a.ompService.GetProcesses()
}

// RunGitStatus returns git status
func (a *App) RunGitStatus(cwd string) (string, error) {
	return a.ompService.RunGitStatus(cwd)
}

// RunGitDiff returns git diff
func (a *App) RunGitDiff(cwd string) (string, error) {
	return a.ompService.RunGitDiff(cwd)
}

// RunCommit generates git commit message
func (a *App) RunCommit(cwd string) (string, error) {
	return a.ompService.RunCommit(cwd)
}

// RunCleanse triggers project diagnostics repair
func (a *App) RunCleanse(cwd string) (string, error) {
	return a.ompService.RunCleanse(cwd)
}

// GetPlugins returns plugins list
func (a *App) GetPlugins() (string, error) {
	return a.ompService.GetPlugins()
}

// InstallPlugin installs a plugin
func (a *App) InstallPlugin(pkg string) (string, error) {
	return a.ompService.InstallPlugin(pkg)
}

// GetSkills returns skills list (raw text)
func (a *App) GetSkills() (string, error) {
	return a.ompService.GetSkills()
}

// GetSkillsList returns structured list of installed and custom skills
func (a *App) GetSkillsList() ([]omp.SkillItem, error) {
	return a.ompService.GetSkillsList()
}

// ReadSkillContent reads SKILL.md content
func (a *App) ReadSkillContent(filePath string) (string, error) {
	return a.ompService.ReadSkillContent(filePath)
}

// SaveCustomSkill creates or updates a custom skill
func (a *App) SaveCustomSkill(name, description, content string, isGlobal bool) error {
	return a.ompService.SaveCustomSkill(name, description, content, isGlobal)
}

// DeleteSkill deletes a custom or installed skill
func (a *App) DeleteSkill(name, filePath string) error {
	return a.ompService.DeleteSkill(name, filePath)
}

// SearchSkills finds skills
func (a *App) SearchSkills(query string) (string, error) {
	return a.ompService.SearchSkills(query)
}

// InstallSkill installs skill
func (a *App) InstallSkill(name string) (string, error) {
	return a.ompService.InstallSkill(name)
}

// CountTokens counts tokens
func (a *App) CountTokens(text string) (string, error) {
	return a.ompService.CountTokens(text)
}

// CheckForUpdates checks for omp updates
func (a *App) CheckForUpdates() (*update.UpdateStatus, error) {
	return a.updateService.CheckForUpdates()
}

// GetUpdateStatus returns current update status
func (a *App) GetUpdateStatus() update.UpdateStatus {
	return a.updateService.GetStatus()
}

// InstallUpdate installs updates
func (a *App) InstallUpdate(canary bool, plugins bool, force bool) (string, error) {
	return a.updateService.InstallUpdate(canary, plugins, force)
}

// SelectDirectory opens native directory picker
func (a *App) SelectDirectory() (string, error) {
	return runtime.OpenDirectoryDialog(a.ctx, runtime.OpenDialogOptions{
		Title: "Select Working Directory",
	})
}

// SelectFiles opens native file picker
func (a *App) SelectFiles() ([]string, error) {
	return runtime.OpenMultipleFilesDialog(a.ctx, runtime.OpenDialogOptions{
		Title: "Select Files to Attach",
	})
}

// SaveClipboardImage saves a base64 encoded image to a temporary file and returns its path
func (a *App) SaveClipboardImage(base64Data string, filename string) (string, error) {
	data, err := base64.StdEncoding.DecodeString(base64Data)
	if err != nil {
		return "", err
	}
	if filename == "" {
		filename = "clipboard.png"
	}
	tempDir := filepath.Join(os.TempDir(), "omp-desktop")
	_ = os.MkdirAll(tempDir, 0755)
	ext := filepath.Ext(filename)
	if ext == "" {
		ext = ".png"
	}
	filePath := filepath.Join(tempDir, fmt.Sprintf("clip_%d%s", time.Now().UnixNano(), ext))
	if err := os.WriteFile(filePath, data, 0644); err != nil {
		return "", err
	}
	return filePath, nil
}

// CheckPathExists verifies if a given path exists on the filesystem
func (a *App) CheckPathExists(path string) bool {
	_, err := os.Stat(path)
	return err == nil
}
// GetWorkspaceFiles returns files and folders in workspace matching query
func (a *App) GetWorkspaceFiles(cwd string, query string) ([]omp.WorkspaceFileItem, error) {
	return a.ompService.GetWorkspaceFiles(cwd, query)
}
// GetGitBranch returns current git branch name in cwd if available
func (a *App) GetGitBranch(cwd string) (string, error) {
	return a.ompService.GetGitBranch(cwd)
}
// GetProfiles returns list of available profile names
func (a *App) GetProfiles() []string {
	return a.ompService.GetProfiles()
}

// SetProfile sets the active profile in the backend service
func (a *App) SetProfile(profile string) {
	a.ompService.SetProfile(profile)
}

// GetCurrentProfile returns the current active profile name
func (a *App) GetCurrentProfile() string {
	return a.ompService.GetCurrentProfile()
}
// GetConfigKey returns a specific configuration setting for the active profile
func (a *App) GetConfigKey(key string) (string, error) {
	return a.ompService.GetConfigKey(key)
}





// GetModelRoles returns current role mapping from omp config
func (a *App) GetModelRoles() (map[string]string, error) {
	out, err := a.ompService.GetConfigKey("modelRoles")
	if err != nil {
		return nil, err
	}
	var roles map[string]string
	if err := json.Unmarshal([]byte(out), &roles); err != nil {
		return nil, err
	}
	return roles, nil
}

// SetModelRole updates a specific role in modelRoles configuration
func (a *App) SetModelRole(role string, model string) error {
	roles, err := a.GetModelRoles()
	if err != nil {
		roles = make(map[string]string)
	}
	roles[role] = model
	bytes, err := json.Marshal(roles)
	if err != nil {
		return err
	}
	err = a.ompService.SetConfigKey("modelRoles", string(bytes))
	return err
}

// DeleteModelRole removes a role from modelRoles configuration
func (a *App) DeleteModelRole(role string) error {
	roles, err := a.GetModelRoles()
	if err != nil {
		return err
	}
	delete(roles, role)
	bytes, err := json.Marshal(roles)
	if err != nil {
		return err
	}
	return a.ompService.SetConfigKey("modelRoles", string(bytes))
}

// SetAdvisorEnabled toggles advisor.enabled in omp config
func (a *App) SetAdvisorEnabled(enabled bool) error {
	val := "false"
	if enabled {
		val = "true"
	}
	err := a.ompService.SetConfigKey("advisor.enabled", val)
	return err
}

// GetAuthCredentials returns list of stored credentials
func (a *App) GetAuthCredentials() ([]omp.AuthCredentialItem, error) {
	return a.ompService.GetAuthCredentials()
}

// StartLogin initiates provider or interactive login
func (a *App) StartLogin(providerId string, providerIndex int) error {
	return a.ompService.StartLogin(providerId, providerIndex)
}

// SendLoginInput sends manual text to active login process
func (a *App) SendLoginInput(input string) error {
	return a.ompService.SendLoginInput(input)
}

// CancelLogin terminates active login process
func (a *App) CancelLogin() error {
	return a.ompService.CancelLogin()
}

// SaveApiKeyCredential saves an API key credential
func (a *App) SaveApiKeyCredential(provider string, apiKey string) error {
	return a.ompService.SaveApiKeyCredential(provider, apiKey)
}

// LogoutProvider removes a provider credential
func (a *App) LogoutProvider(provider string) error {
	return a.ompService.LogoutProvider(provider)
}

// OpenBrowserURL opens a URL in default browser
func (a *App) OpenBrowserURL(url string) error {
	return a.ompService.OpenBrowserURL(url)
}

// GetChangelog reads and returns changelog entries
func (a *App) GetChangelog(args string) (string, error) {
	return a.ompService.GetChangelog(args)
}
