package plugins

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestPluginLifecycleAndPersistence(t *testing.T) {
	tmpDir, err := os.MkdirTemp("", "plugins-test-*")
	if err != nil {
		t.Fatalf("failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tmpDir)

	pm := NewPluginManager(tmpDir)
	ticketPlugin := NewTicketChatbotPlugin()
	pm.Register(ticketPlugin)

	// 1. Verify registered plugin
	list := pm.GetPlugins()
	if len(list) != 1 {
		t.Fatalf("expected 1 plugin, got %d", len(list))
	}
	if list[0].ID != "ticket-responder" {
		t.Errorf("unexpected plugin ID: %s", list[0].ID)
	}
	if !list[0].Enabled {
		t.Errorf("expected plugin to be enabled by default")
	}

	// 2. Test completion hook formatting
	ctx := &TaskContext{
		TaskID:   int64(999),
		TicketID: int64(123),
		Company:  "Test Firma",
		Subject:  "Test Konu",
	}
	res := &TaskResult{
		Status: "completed",
		Output: "Veritabanı optimizasyonu başarıyla yapıldı.",
	}

	dispatched := pm.DispatchTaskCompleted(ctx, res)
	if !dispatched.AutoReply {
		t.Errorf("expected AutoReply to be true")
	}
	if dispatched.ReplyMessage == "" {
		t.Errorf("expected ReplyMessage to be populated")
	}

	// 2a. Test filtering of internal agent scratchpad/monologue
	rawScratchpad := "Salt okunur bir sorgu talebi — önce veritabanını tespit ediyorum.\nLet me find the relevant table.\n---\n## 📊 Tezgah Durumu Özeti\n| Metrik | Değer |\n|---|---|\n| Aktif | 37 |"
	cleanedRes := pm.DispatchTaskCompleted(ctx, &TaskResult{
		Status: "completed",
		Output: rawScratchpad,
	})
	if strings.Contains(cleanedRes.ReplyMessage, "Let me find") {
		t.Errorf("scratchpad monologue should have been filtered out: %s", cleanedRes.ReplyMessage)
	}
	if !strings.Contains(cleanedRes.ReplyMessage, "## 📊 Tezgah Durumu Özeti") {
		t.Errorf("expected clean table heading in output: %s", cleanedRes.ReplyMessage)
	}
	// 2b. Test failure RDP warning hook formatting
	resFail := &TaskResult{
		Status: "failed",
		Error:  "critical tool error",
	}
	dispatchedFail := pm.DispatchTaskCompleted(ctx, resFail)
	if !dispatchedFail.AutoReply {
		t.Errorf("expected AutoReply to be true on failure")
	}
	expectedSub := "İşleminize şuan devam edilemiyor. Lütfen RDP üzerinden kontrol ediniz."
	if !strings.Contains(dispatchedFail.ReplyMessage, expectedSub) {
		t.Errorf("expected failure message to contain '%s', got '%s'", expectedSub, dispatchedFail.ReplyMessage)
	}

	// 3. Test settings update and persistence
	err = pm.UpdatePluginSettings("ticket-responder", map[string]interface{}{
		"reply_prefix": "[CUSTOM PREFIX] ",
		"auto_reply":   true,
	})
	if err != nil {
		t.Fatalf("UpdatePluginSettings failed: %v", err)
	}

	cfgPath := filepath.Join(tmpDir, "desktop_plugins.json")
	if _, err := os.Stat(cfgPath); os.IsNotExist(err) {
		t.Errorf("config file was not created: %s", cfgPath)
	}

	// 4. Test reloading into fresh manager
	pm2 := NewPluginManager(tmpDir)
	ticketPlugin2 := NewTicketChatbotPlugin()
	pm2.Register(ticketPlugin2)

	list2 := pm2.GetPlugins()
	if len(list2) != 1 {
		t.Fatalf("expected 1 plugin in reloaded manager, got %d", len(list2))
	}
	prefixVal, _ := list2[0].Settings["reply_prefix"].(string)
	if prefixVal != "[CUSTOM PREFIX] " {
		t.Errorf("expected reloaded prefix '[CUSTOM PREFIX] ', got '%s'", prefixVal)
	}
}
