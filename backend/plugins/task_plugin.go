package plugins

import (
	"regexp"
	"strings"
	"sync"
)

// TaskChatbotPlugin implements automated task auto-reply and interactive looping
type TaskChatbotPlugin struct {
	mu       sync.RWMutex
	enabled  bool
	settings map[string]interface{}
}

// NewTaskChatbotPlugin initializes the default task auto-responder & chatbot plugin
func NewTaskChatbotPlugin() *TaskChatbotPlugin {
	return &TaskChatbotPlugin{
		enabled: true,
		settings: map[string]interface{}{
			"auto_reply":        true,
			"reply_prefix":      "🤖 **[OMP Asistanı]**\n\n",
			"mark_waiting_user": true,
			"include_task_id":   true,
		},
	}
}

// NewTicketChatbotPlugin is an alias for backward compatibility
func NewTicketChatbotPlugin() *TaskChatbotPlugin {
	return NewTaskChatbotPlugin()
}

// TicketChatbotPlugin alias for backward compatibility
type TicketChatbotPlugin = TaskChatbotPlugin

func (p *TaskChatbotPlugin) Info() PluginInfo {
	p.mu.RLock()
	defer p.mu.RUnlock()

	settingsCopy := make(map[string]interface{})
	for k, v := range p.settings {
		settingsCopy[k] = v
	}

	return PluginInfo{
		ID:          "task-responder",
		Name:        "Otomatik Görev Yanıtlayıcı & Chatbot",
		Description: "Uzak sistemden gelen görevler tamamlandığında otomatik olarak geri bildirim/yanıt iletir ve kullanıcı cevap verdiğinde etkileşim döngüsünü sürdürür.",
		Version:     "1.0.0",
		Author:      "OMP Desktop Core",
		Enabled:     p.enabled,
		Settings:    settingsCopy,
	}
}

func (p *TaskChatbotPlugin) IsEnabled() bool {
	p.mu.RLock()
	defer p.mu.RUnlock()
	return p.enabled
}

func (p *TaskChatbotPlugin) SetEnabled(enabled bool) {
	p.mu.Lock()
	defer p.mu.Unlock()
	p.enabled = enabled
}

func (p *TaskChatbotPlugin) GetSettings() map[string]interface{} {
	p.mu.RLock()
	defer p.mu.RUnlock()

	copy := make(map[string]interface{})
	for k, v := range p.settings {
		copy[k] = v
	}
	return copy
}

func (p *TaskChatbotPlugin) UpdateSettings(newSettings map[string]interface{}) error {
	p.mu.Lock()
	defer p.mu.Unlock()

	if p.settings == nil {
		p.settings = make(map[string]interface{})
	}
	for k, v := range newSettings {
		p.settings[k] = v
	}
	return nil
}

// OnTaskReceived can inspect or enrich the task before OMP executes it
func (p *TaskChatbotPlugin) OnTaskReceived(ctx *TaskContext) (*TaskContext, error) {
	// Hook point: can inject context or log task intake
	return ctx, nil
}

// OnTaskCompleted formats the assistant's answer and enables automatic task response
func (p *TaskChatbotPlugin) OnTaskCompleted(ctx *TaskContext, result *TaskResult) (*TaskResult, error) {
	p.mu.RLock()
	defer p.mu.RUnlock()

	if !p.enabled {
		return result, nil
	}

	autoReply, _ := p.settings["auto_reply"].(bool)
	if !autoReply {
		return result, nil
	}

	if result.Status == "completed" && strings.TrimSpace(result.Output) != "" {
		result.AutoReply = true

		prefix, _ := p.settings["reply_prefix"].(string)
		if prefix == "" {
			prefix = "🤖 **[OMP Asistanı]**\n\n"
		}

		cleanOutput := cleanAgentTaskOutput(result.Output)
		var sb strings.Builder
		sb.WriteString(prefix)
		sb.WriteString(cleanOutput)

		result.ReplyMessage = sb.String()
	} else if result.Status == "failed" {
		result.AutoReply = true
		prefix, _ := p.settings["reply_prefix"].(string)
		if prefix == "" {
			prefix = "🤖 **[OMP Asistanı]**\n\n"
		}
		result.ReplyMessage = prefix + "İşleminize şu an devam edilemiyor. Lütfen uzaktan bağlantı ile kontrol ediniz."
	}

	return result, nil
}

// OnTaskFailed logs or notifies task failure
func (p *TaskChatbotPlugin) OnTaskFailed(ctx *TaskContext, err error) error {
	return nil
}

// cleanAgentTaskOutput removes internal agent monologue and initial debug scratchpad
// while strictly preserving all tables, dividers, and user-facing content verbatim.
func cleanAgentTaskOutput(raw string) string {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return ""
	}

	// 1. Strip XML-style thinking tags: <think>...</think> or <thinking>...</thinking>
	thinkRe := regexp.MustCompile(`(?is)^\s*<think(?:ing)?>.*?</think(?:ing)>\s*`)
	trimmed = thinkRe.ReplaceAllString(trimmed, "")

	// 2. Strip explicit thinking block: "\n\nThinking Process:\n...\n\nExplicit Response/Answer/Final Answer:\n\n"
	explicitRe := regexp.MustCompile(`(?is)^\s*(?:Thinking Process|Thought Process|Reasoning Process|Thinking):\s*\n.*?\n\s*(?:Response|Answer|Final Answer):\s*\n+`)
	trimmed = explicitRe.ReplaceAllString(trimmed, "")

	// 3. Strip English tool preamble / monologue before Turkish greeting or Markdown heading/table
	lowerTrimmed := strings.ToLower(trimmed)
	if strings.HasPrefix(lowerTrimmed, "i have") ||
		strings.HasPrefix(lowerTrimmed, "now let me") ||
		strings.HasPrefix(lowerTrimmed, "let me") ||
		strings.HasPrefix(lowerTrimmed, "good,") ||
		strings.HasPrefix(lowerTrimmed, "encoding issue") ||
		strings.HasPrefix(lowerTrimmed, "looking at") ||
		strings.HasPrefix(lowerTrimmed, "based on") ||
		strings.HasPrefix(lowerTrimmed, "we have") ||
		strings.HasPrefix(lowerTrimmed, "here is the plan") {

		turkishMarkers := []string{
			"merhaba", "selamlar", "sayın", "iyi günler", "değerli",
			"günaydın", "görev", "talep", "bilet", "sorgu sonucuna", "veritabanından",
			"yapılan incelemede", "kontroller sağlandığında",
		}
		earliestIdx := -1
		for _, m := range turkishMarkers {
			idx := strings.Index(lowerTrimmed, m)
			if idx != -1 {
				if earliestIdx == -1 || idx < earliestIdx {
					earliestIdx = idx
				}
			}
		}

		headingIdx := strings.Index(trimmed, "\n#")
		if headingIdx != -1 && (earliestIdx == -1 || headingIdx+1 < earliestIdx) {
			earliestIdx = headingIdx + 1
		}

		tableIdx := strings.Index(trimmed, "\n|")
		if tableIdx != -1 && (earliestIdx == -1 || tableIdx+1 < earliestIdx) {
			earliestIdx = tableIdx + 1
		}

		if earliestIdx > 0 {
			trimmed = strings.TrimSpace(trimmed[earliestIdx:])
		}
	}

	// 4. Line-by-line filter for internal monologue before the actual content begins
	lines := strings.Split(trimmed, "\n")
	var cleanLines []string
	skippingScratchpad := true
	skippedMonologueLines := false

	for _, line := range lines {
		t := strings.TrimSpace(line)
		if skippingScratchpad {
			lower := strings.ToLower(t)
			if strings.HasPrefix(lower, "salt okunur bir sorgu") ||
				strings.HasPrefix(lower, "let me find") ||
				strings.HasPrefix(lower, "password requires") ||
				strings.HasPrefix(lower, "the `--password") ||
				strings.HasPrefix(lower, "found the relevant") ||
				strings.HasPrefix(lower, "i have all the data") ||
				strings.HasPrefix(lower, "let me clean up") ||
				strings.HasPrefix(lower, "db: `") ||
				strings.HasPrefix(lower, "let me use a php") {
				skippedMonologueLines = true
				continue
			}

			// If we skipped monologue lines and immediately encounter an initial divider, skip that divider too
			if skippedMonologueLines && (t == "---" || t == "***") {
				continue
			}

			if t == "" {
				continue
			}

			// First real content line reached (heading, table, list, text)
			skippingScratchpad = false
		}
		cleanLines = append(cleanLines, line)
	}

	trimmed = strings.TrimSpace(strings.Join(cleanLines, "\n"))
	return trimmed
}

// cleanTicketAgentOutput is an alias for backward compatibility
func cleanTicketAgentOutput(raw string) string {
	return cleanAgentTaskOutput(raw)
}
