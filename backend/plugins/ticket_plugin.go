package plugins

import (
	"strings"
	"sync"
)

// TicketChatbotPlugin implements automated ticket replies and chatbot looping
type TicketChatbotPlugin struct {
	mu       sync.RWMutex
	enabled  bool
	settings map[string]interface{}
}

// NewTicketChatbotPlugin initializes the default ticket auto-responder & chatbot plugin
func NewTicketChatbotPlugin() *TicketChatbotPlugin {
	return &TicketChatbotPlugin{
		enabled: true,
		settings: map[string]interface{}{
			"auto_reply":        true,
			"reply_prefix":      "🤖 **[OMP AI Destek Asistanı]**\n\n",
			"mark_waiting_user": true,
			"include_ticket_id": true,
		},
	}
}

func (p *TicketChatbotPlugin) Info() PluginInfo {
	p.mu.RLock()
	defer p.mu.RUnlock()

	settingsCopy := make(map[string]interface{})
	for k, v := range p.settings {
		settingsCopy[k] = v
	}

	return PluginInfo{
		ID:          "ticket-responder",
		Name:        "Ticket Sistemi Otomatik Yanıtlayıcı & Chatbot",
		Description: "Ticket sisteminden gelen görevler tamamlandığında otomatik olarak bilete yanıt (reply) ekler ve kullanıcı cevap verdiğinde chatbot döngüsünü sürdürür.",
		Version:     "1.0.0",
		Author:      "OMP Desktop Core",
		Enabled:     p.enabled,
		Settings:    settingsCopy,
	}
}

func (p *TicketChatbotPlugin) IsEnabled() bool {
	p.mu.RLock()
	defer p.mu.RUnlock()
	return p.enabled
}

func (p *TicketChatbotPlugin) SetEnabled(enabled bool) {
	p.mu.Lock()
	defer p.mu.Unlock()
	p.enabled = enabled
}

func (p *TicketChatbotPlugin) GetSettings() map[string]interface{} {
	p.mu.RLock()
	defer p.mu.RUnlock()

	copy := make(map[string]interface{})
	for k, v := range p.settings {
		copy[k] = v
	}
	return copy
}

func (p *TicketChatbotPlugin) UpdateSettings(newSettings map[string]interface{}) error {
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
func (p *TicketChatbotPlugin) OnTaskReceived(ctx *TaskContext) (*TaskContext, error) {
	// Hook point: can inject context or log task intake
	return ctx, nil
}

// OnTaskCompleted formats the assistant's answer and enables automatic ticket response
func (p *TicketChatbotPlugin) OnTaskCompleted(ctx *TaskContext, result *TaskResult) (*TaskResult, error) {
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
			prefix = "🤖 **[OMP AI Destek Asistanı]**\n\n"
		}

		cleanOutput := cleanTicketAgentOutput(result.Output)
		var sb strings.Builder
		sb.WriteString(prefix)
		sb.WriteString(cleanOutput)

		result.ReplyMessage = sb.String()
	} else if result.Status == "failed" {
		result.AutoReply = true
		prefix, _ := p.settings["reply_prefix"].(string)
		if prefix == "" {
			prefix = "🤖 **[OMP AI Destek Asistanı]**\n\n"
		}
		result.ReplyMessage = prefix + "İşleminize şuan devam edilemiyor. Lütfen RDP üzerinden kontrol ediniz."
	}

	return result, nil
}

// OnTaskFailed logs or notifies ticket failure
func (p *TicketChatbotPlugin) OnTaskFailed(ctx *TaskContext, err error) error {
	return nil
}

// cleanTicketAgentOutput removes internal agent monologue and initial debug scratchpad
// while strictly preserving all tables, dividers, and user-facing content verbatim.
func cleanTicketAgentOutput(raw string) string {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return ""
	}

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
			if skippedMonologueLines && (t == "---" || t == "***" || t == "--- " || t == "*** ") {
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

	result := strings.TrimSpace(strings.Join(cleanLines, "\n"))
	if result != "" {
		return result
	}
	return trimmed
}
