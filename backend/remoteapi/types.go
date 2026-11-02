package remoteapi

import "time"

// RemoteApiConfig holds user-configurable settings for the remote HTTP API and Polling
type RemoteApiConfig struct {
	Enabled         bool   `json:"enabled"`
	Port            int    `json:"port"`
	Host            string `json:"host"`
	ApiKey          string `json:"apiKey"`
	// Polling mode settings
	PollingEnabled  bool   `json:"pollingEnabled"`
	PollingURL      string `json:"pollingUrl"`
	PollingInterval int    `json:"pollingInterval"` // in seconds, default 5
	PollingApiKey   string `json:"pollingApiKey"`   // optional custom key, defaults to ApiKey
}

// EndpointsInfo provides full URLs for available endpoints
type EndpointsInfo struct {
	PromptEndpoint string `json:"promptEndpoint"`
	StatusEndpoint string `json:"statusEndpoint"`
	InfoEndpoint   string `json:"infoEndpoint"`
}

// RunInfo represents an active or completed remote execution directly in live workspace
type RunInfo struct {
	RunID       string    `json:"runId"`
	Prompt      string    `json:"prompt"`
	Cwd         string    `json:"cwd"`
	Model       string    `json:"model,omitempty"`
	StartedAt   time.Time `json:"startedAt"`
	CompletedAt time.Time `json:"completedAt,omitempty"`
	Status      string    `json:"status"` // "running" | "completed" | "failed"
	Success     bool      `json:"success"`
	Error       string    `json:"error,omitempty"`
}

// RemoteApiStatus provides real-time state to frontend and GET /api/status
type RemoteApiStatus struct {
	Enabled         bool          `json:"enabled"`
	Running         bool          `json:"running"`
	Port            int           `json:"port"`
	Host            string        `json:"host"`
	ApiKey          string        `json:"apiKey"`
	Endpoints       EndpointsInfo `json:"endpoints"`
	Status          string        `json:"status"` // "idle" | "running"
	AgentStatus     string        `json:"agentStatus"` // "idle" | "running"
	IsWorking       bool          `json:"isWorking"`
	IsRunning       bool          `json:"is_running"`
	IsIdle          bool          `json:"is_idle"`
	TaskID          string        `json:"task_id,omitempty"`
	ActiveRunID     string        `json:"activeRunId,omitempty"`
	CurrentRun      *RunInfo      `json:"currentRun,omitempty"`
	LastRun         *RunInfo      `json:"lastRun,omitempty"`
	// Polling runtime status
	PollingEnabled  bool          `json:"pollingEnabled"`
	PollingActive   bool          `json:"pollingActive"`
	PollingURL      string        `json:"pollingUrl"`
	PollingInterval int           `json:"pollingInterval"`
	LastPollTime    string        `json:"lastPollTime,omitempty"`
	LastPollStatus  string        `json:"lastPollStatus,omitempty"`
}

// PromptRequest defines payload for POST /api/prompt
type PromptRequest struct {
	Prompt        string   `json:"prompt"`
	Model         string   `json:"model,omitempty"`
	ThinkingLevel string   `json:"thinkingLevel,omitempty"`
	Cwd           string   `json:"cwd,omitempty"`
	WorkspacePath string   `json:"workspace_path,omitempty"`
	TicketID      any      `json:"ticket_id,omitempty"`
	Files         []string `json:"files,omitempty"`
	Sync          bool     `json:"sync,omitempty"` // if true, blocks until run completes
}

// PollResponse represents response received from ticket server when polling
type PollResponse struct {
	Success bool        `json:"success"`
	HasTask bool        `json:"has_task"`
	Message string      `json:"message,omitempty"`
	Task    *TicketTask `json:"task,omitempty"`
}

// TicketTask represents the task payload returned by ticket server
type TicketTask struct {
	TaskID         any    `json:"task_id"`
	TicketID       any    `json:"ticket_id"`
	CompanyID      any    `json:"company_id,omitempty"`
	CompanyName    string `json:"company_name,omitempty"`
	Subject        string `json:"subject,omitempty"`
	Prompt         string `json:"prompt"`
	WorkspacePath  string `json:"workspace_path,omitempty"`
	ReportFilename string `json:"report_filename,omitempty"`
	CallbackURL    string `json:"callback_url,omitempty"`
}
