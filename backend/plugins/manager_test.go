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
	if list[0].ID != "task-responder" {
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
	// 2a-2. Test preservation of multiple tables separated by markdown dividers
	multiTableInput := "Aşağıda veriler yer almaktadır:\n\n### 1. Tablo: Aktifler\n| ID | Ad |\n|---|---|\n| 1 | CNC |\n\n---\n\n### 2. Tablo: Pasifler\n| ID | Ad |\n|---|---|\n| 2 | Torna |\n\n---\n\n### 3. Tablo: Yedekler\n| Parça | Adet |\n|---|---|\n| Rulman | 5 |"
	multiRes := pm.DispatchTaskCompleted(ctx, &TaskResult{
		Status: "completed",
		Output: multiTableInput,
	})
	if !strings.Contains(multiRes.ReplyMessage, "### 1. Tablo: Aktifler") || !strings.Contains(multiRes.ReplyMessage, "CNC") {
		t.Errorf("First table was lost: %s", multiRes.ReplyMessage)
	}
	if !strings.Contains(multiRes.ReplyMessage, "### 2. Tablo: Pasifler") || !strings.Contains(multiRes.ReplyMessage, "Torna") {
		t.Errorf("Second table was lost: %s", multiRes.ReplyMessage)
	}
	if !strings.Contains(multiRes.ReplyMessage, "### 3. Tablo: Yedekler") || !strings.Contains(multiRes.ReplyMessage, "Rulman") {
		t.Errorf("Third table was lost: %s", multiRes.ReplyMessage)
	}
	// 2a-3. Test stripping of English tool preamble/monologue before Turkish greeting
	preambleInput := "I have the context from previous ticket work. Now let me query the database directly to get the current active tezgah (Üretim status) count and their personnel.Good, I have the DB credentials. Let me query the database for active tezgah info.Encoding issue with Turkish chars. Let me also get a count and fix the encoding.Let me get the proper names via PHP which handles encoding better:Now I have the complete, properly encoded data. Let me also get the total summary for context:Merhaba Arif Bey,\n\nVeritabanından güncel sorgu sonucuna göre şu an 9 adet tezgah aktif (Üretim) durumundadır."
	preambleRes := pm.DispatchTaskCompleted(ctx, &TaskResult{
		Status: "completed",
		Output: preambleInput,
	})
	if strings.Contains(preambleRes.ReplyMessage, "I have the context") || strings.Contains(preambleRes.ReplyMessage, "Encoding issue") || strings.Contains(preambleRes.ReplyMessage, "for context:") {
		t.Errorf("English preamble should have been stripped: %s", preambleRes.ReplyMessage)
	}
	if !strings.Contains(preambleRes.ReplyMessage, "Merhaba Arif Bey") || !strings.Contains(preambleRes.ReplyMessage, "9 adet tezgah aktif") {
		t.Errorf("Expected Turkish greeting and response to be preserved: %s", preambleRes.ReplyMessage)
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
	expectedSub := "İşleminize şu an devam edilemiyor. Lütfen uzaktan bağlantı ile kontrol ediniz."
	if !strings.Contains(dispatchedFail.ReplyMessage, expectedSub) {
		t.Errorf("expected failure message to contain '%s', got '%s'", expectedSub, dispatchedFail.ReplyMessage)
	}

	// 3. Test settings update and persistence
	err = pm.UpdatePluginSettings("task-responder", map[string]interface{}{
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
