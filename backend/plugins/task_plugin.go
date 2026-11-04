package plugins

import (
	"archive/zip"
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"sync"
	"time"
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

	// 1. Scan workspace for newly taken backups
	backups := scanWorkspaceBackups(ctx.Workspace, ctx.TicketID)

	// 2. Outbound Polling Sync: Asynchronously notify callbackURL (ticket.oemsoft.net/api/agent_poll.php)
	if len(backups) > 0 && strings.TrimSpace(ctx.CallbackURL) != "" {
		go func(cbURL string, bList []BackupCatalogItem, tID any, ws string) {
			payload := map[string]interface{}{
				"action":    "sync_backups",
				"ticket_id": tID,
				"workspace": filepath.ToSlash(ws),
				"backups":   bList,
			}
			jsonBytes, err := json.Marshal(payload)
			if err != nil {
				return
			}
			client := &http.Client{Timeout: 8 * time.Second}
			req, err := http.NewRequest("POST", cbURL, bytes.NewReader(jsonBytes))
			if err != nil {
				return
			}
			req.Header.Set("Content-Type", "application/json")
			resp, err := client.Do(req)
			if err == nil && resp != nil {
				_ = resp.Body.Close()
			}
		}(ctx.CallbackURL, backups, ctx.TicketID, ctx.Workspace)
	}

	// 3. Embed structured backup metadata for ticket system parsing
	if len(backups) > 0 {
		metaJSON, _ := json.Marshal(backups)
		result.Output = result.Output + fmt.Sprintf("\n<!-- TICKET_BACKUP_METADATA: %s -->\n", string(metaJSON))
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

		if len(backups) > 0 {
			latest := backups[0]
			szMB := float64(latest.ZipSize) / (1024 * 1024)
			sb.WriteString(fmt.Sprintf("\n\n🛡️ **Yedekleme Güvencesi:** Proje yedeği (`%s`, %.2f MB) güvenle doğrulandı.", latest.ZipFilename, szMB))
			if latest.HasSql {
				sb.WriteString(" Veritabanı (.sql) dökümü arşivde yer almaktadır.")
			}
			sb.WriteString(" Ticket sisteminden tek tıkla geri dönülebilir.")
		}

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

// BackupCatalogItem represents a discovered backup archive on the local filesystem
type BackupCatalogItem struct {
	TicketID    int    `json:"ticket_id"`
	BackupName  string `json:"backup_name"`
	ZipFilename string `json:"zip_filename"`
	ZipPath     string `json:"zip_path"`
	ZipSize     int64  `json:"zip_size"`
	SqlFilename string `json:"sql_filename,omitempty"`
	SqlPath     string `json:"sql_path,omitempty"`
	SqlSize     int64  `json:"sql_size,omitempty"`
	HasSql      bool   `json:"has_sql"`
	Workspace   string `json:"workspace"`
	Status      string `json:"status"`
}

// scanWorkspaceBackups discovers _backup_*.zip and _backup_*.sql archives in workspace
func scanWorkspaceBackups(workspace string, ticketID any) []BackupCatalogItem {
	if strings.TrimSpace(workspace) == "" {
		return nil
	}
	cleanWorkspace := filepath.Clean(workspace)
	if _, err := os.Stat(cleanWorkspace); os.IsNotExist(err) {
		return nil
	}

	targetTicketInt := 0
	switch v := ticketID.(type) {
	case int:
		targetTicketInt = v
	case int64:
		targetTicketInt = int(v)
	case float64:
		targetTicketInt = int(v)
	case string:
		targetTicketInt, _ = strconv.Atoi(strings.TrimSpace(v))
	}

	var items []BackupCatalogItem
	seen := make(map[string]bool)

	dirsToScan := []string{cleanWorkspace}
	subBackups := filepath.Join(cleanWorkspace, "backups")
	if fi, err := os.Stat(subBackups); err == nil && fi.IsDir() {
		dirsToScan = append(dirsToScan, subBackups)
	}

	backupNameRe := regexp.MustCompile(`(?i)(_backup(?:_ticket_([0-9]+))?_[0-9]{8}_[0-9]{6})`)

	for _, dir := range dirsToScan {
		entries, err := os.ReadDir(dir)
		if err != nil {
			continue
		}

		for _, entry := range entries {
			if entry.IsDir() {
				continue
			}
			name := entry.Name()
			ext := strings.ToLower(filepath.Ext(name))
			if ext != ".zip" && ext != ".sql" {
				continue
			}

			if !strings.HasPrefix(strings.ToLower(name), "_backup") && !strings.HasPrefix(strings.ToLower(name), "backup") {
				continue
			}

			baseName := strings.TrimSuffix(name, filepath.Ext(name))
			if seen[baseName] {
				continue
			}

			var tID = targetTicketInt
			m := backupNameRe.FindStringSubmatch(baseName)
			if len(m) > 2 && m[2] != "" {
				parsedTID, _ := strconv.Atoi(m[2])
				if parsedTID > 0 {
					tID = parsedTID
				}
			}

			if targetTicketInt > 0 && tID > 0 && tID != targetTicketInt {
				continue
			}

			zipPath := filepath.Join(dir, baseName+".zip")
			sqlPath := filepath.Join(dir, baseName+".sql")

			var zipSize int64
			var hasZip bool
			hasSql := false
			var sqlSize int64

			if zfi, err := os.Stat(zipPath); err == nil && !zfi.IsDir() {
				hasZip = true
				zipSize = zfi.Size()
				if zr, err := zip.OpenReader(zipPath); err == nil {
					for _, f := range zr.File {
						if strings.HasSuffix(strings.ToLower(f.Name), ".sql") {
							hasSql = true
							break
						}
					}
					_ = zr.Close()
				}
			}

			if sfi, err := os.Stat(sqlPath); err == nil && !sfi.IsDir() {
				hasSql = true
				sqlSize = sfi.Size()
			}

			if !hasZip && !hasSql {
				continue
			}

			seen[baseName] = true
			normalizedZipPath := filepath.ToSlash(zipPath)
			normalizedSqlPath := filepath.ToSlash(sqlPath)
			normalizedWorkspace := filepath.ToSlash(cleanWorkspace)

			item := BackupCatalogItem{
				TicketID:    tID,
				BackupName:  baseName,
				ZipFilename: baseName + ".zip",
				ZipPath:     normalizedZipPath,
				ZipSize:     zipSize,
				HasSql:      hasSql,
				Workspace:   normalizedWorkspace,
				Status:      "available",
			}
			if hasSql {
				item.SqlFilename = baseName + ".sql"
				item.SqlPath = normalizedSqlPath
				item.SqlSize = sqlSize
			}
			items = append(items, item)
		}
	}

	return items
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
