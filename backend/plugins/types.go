package plugins

// PluginInfo describes a plugin's identity, version, state and user settings
type PluginInfo struct {
	ID          string                 `json:"id"`
	Name        string                 `json:"name"`
	Description string                 `json:"description"`
	Version     string                 `json:"version"`
	Author      string                 `json:"author"`
	Enabled     bool                   `json:"enabled"`
	Settings    map[string]interface{} `json:"settings"`
}

// TaskContext carries task details through plugin lifecycle hooks
type TaskContext struct {
	TaskID      any    `json:"taskId"`
	ReferenceID any    `json:"referenceId,omitempty"`
	TicketID    any    `json:"ticketId,omitempty"`
	Company     string `json:"company"`
	Subject     string `json:"subject"`
	Prompt      string `json:"prompt"`
	Workspace   string `json:"workspace"`
	CallbackURL string `json:"callbackUrl"`
}

// TaskResult contains the output and auto-response details after execution
type TaskResult struct {
	Status       string `json:"status"` // "completed" | "failed"
	Output       string `json:"output"`
	Error        string `json:"error,omitempty"`
	AutoReply    bool   `json:"autoReply"`
	ReplyMessage string `json:"replyMessage"`
}

// Plugin is the standard interface for omp-desktop extensions
type Plugin interface {
	Info() PluginInfo
	IsEnabled() bool
	SetEnabled(enabled bool)
	GetSettings() map[string]interface{}
	UpdateSettings(settings map[string]interface{}) error

	// Hooks
	OnTaskReceived(ctx *TaskContext) (*TaskContext, error)
	OnTaskCompleted(ctx *TaskContext, result *TaskResult) (*TaskResult, error)
	OnTaskFailed(ctx *TaskContext, err error) error
}
