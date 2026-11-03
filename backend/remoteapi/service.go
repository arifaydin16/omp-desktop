package remoteapi

import (
	"bytes"
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"time"

	"omp-desktop/backend/omp"
	"omp-desktop/backend/plugins"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// Service manages the remote HTTP API and outbound polling for direct, full-access omp execution
type Service struct {
	mu             sync.RWMutex
	config         RemoteApiConfig
	configPath     string
	server         *http.Server
	ompService     *omp.Service
	wailsCtx       context.Context
	isWorking      bool
	activeRunID    string
	currentRun     *RunInfo
	lastRun        *RunInfo
	pollStopChan   chan struct{}
	pollActive     bool
	lastPollTime   time.Time
	lastPollStatus string
	pluginManager         *plugins.PluginManager
	activeTasksByInstance map[string]*TicketTask
	lastCallbackTaskID    string
	lastCallbackOutput    string
	lastCallbackTime      time.Time
}

// NewService initializes RemoteApiService with default configuration
func NewService(ompSvc *omp.Service) *Service {
	homeDir, _ := os.UserHomeDir()
	cfgPath := filepath.Join(homeDir, ".omp", "remote_api.json")

	svc := &Service{
		ompService:            ompSvc,
		configPath:            cfgPath,
		activeTasksByInstance: make(map[string]*TicketTask),
		config: RemoteApiConfig{
			Enabled:         false,
			Port:            37420,
			Host:            "0.0.0.0",
			ApiKey:          generateKey(),
			PollingEnabled:  false,
			PollingInterval: 5,
		},
	}

	svc.loadConfig()
	return svc
}

// SetContext sets Wails runtime context for event emissions
func (s *Service) SetContext(ctx context.Context) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.wailsCtx = ctx
}

// SetPluginManager injects the desktop plugin coordinator
func (s *Service) SetPluginManager(pm *plugins.PluginManager) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.pluginManager = pm
}

func generateKey() string {
	b := make([]byte, 16)
	_, _ = rand.Read(b)
	return "omp_sec_" + hex.EncodeToString(b)
}

func (s *Service) loadConfig() {
	data, err := os.ReadFile(s.configPath)
	if err == nil {
		var loaded RemoteApiConfig
		if jsonErr := json.Unmarshal(data, &loaded); jsonErr == nil {
			if loaded.Port == 0 {
				loaded.Port = 37420
			}
			if loaded.Host == "" {
				loaded.Host = "0.0.0.0"
			}
			if loaded.ApiKey == "" {
				loaded.ApiKey = generateKey()
			}
			if loaded.PollingInterval <= 0 {
				loaded.PollingInterval = 5
			}
			s.config = loaded
			return
		}
	}
	s.saveConfigLocked()
}

func (s *Service) saveConfigLocked() {
	_ = os.MkdirAll(filepath.Dir(s.configPath), 0755)
	data, _ := json.MarshalIndent(s.config, "", "  ")
	_ = os.WriteFile(s.configPath, data, 0600)
}

// StartIfEnabled starts the HTTP server and/or Polling worker if configuration says enabled
func (s *Service) StartIfEnabled() {
	s.mu.Lock()
	enabled := s.config.Enabled
	pollEnabled := s.config.PollingEnabled
	s.mu.Unlock()

	if enabled {
		_ = s.Start()
	}
	if pollEnabled {
		s.mu.Lock()
		s.startPollingWorkerLocked()
		s.mu.Unlock()
	}
}

// Start starts the HTTP server
func (s *Service) Start() error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.server != nil {
		return nil
	}

	if s.config.Port == 0 {
		s.config.Port = 37420
	}
	if s.config.Host == "" {
		s.config.Host = "0.0.0.0"
	}
	if s.config.ApiKey == "" {
		s.config.ApiKey = generateKey()
	}

	mux := http.NewServeMux()
	mux.HandleFunc("/api/prompt", s.handlePrompt)
	mux.HandleFunc("/api/status", s.handleStatus)
	mux.HandleFunc("/api/info", s.handleInfo)

	addr := net.JoinHostPort(s.config.Host, strconv.Itoa(s.config.Port))
	server := &http.Server{
		Addr:    addr,
		Handler: s.corsMiddleware(mux),
	}

	ln, err := net.Listen("tcp", addr)
	if err != nil {
		return fmt.Errorf("failed to bind remote API to %s: %w", addr, err)
	}

	s.server = server
	s.config.Enabled = true
	s.saveConfigLocked()

	go func() {
		_ = server.Serve(ln)
	}()

	s.emitStatusLocked()
	return nil
}
// StartPolling starts the background polling loop if configured
func (s *Service) StartPolling() {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.startPollingWorkerLocked()
}

// StopPolling stops the background polling loop
func (s *Service) StopPolling() {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.stopPollingWorkerLocked()
}

// Stop terminates the HTTP server and Polling worker
func (s *Service) Stop() error {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.stopPollingWorkerLocked()

	if s.server == nil {
		return nil
	}

	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()

	err := s.server.Shutdown(ctx)
	s.server = nil
	s.config.Enabled = false
	s.saveConfigLocked()
	s.emitStatusLocked()
	return err
}

// GetConfig returns current config
func (s *Service) GetConfig() RemoteApiConfig {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.config
}

// SetConfig updates configuration and restarts server and/or polling worker if needed
func (s *Service) SetConfig(cfg RemoteApiConfig) error {
	s.mu.Lock()
	if cfg.Port == 0 {
		cfg.Port = 37420
	}
	if cfg.Host == "" {
		cfg.Host = "0.0.0.0"
	}
	if cfg.ApiKey == "" {
		cfg.ApiKey = generateKey()
	}
	if cfg.PollingInterval <= 0 {
		cfg.PollingInterval = 5
	}
	s.config = cfg
	s.saveConfigLocked()

	// Update polling worker
	if cfg.PollingEnabled && strings.TrimSpace(cfg.PollingURL) != "" {
		s.startPollingWorkerLocked()
	} else {
		s.stopPollingWorkerLocked()
	}

	shouldRun := cfg.Enabled
	s.mu.Unlock()

	if shouldRun {
		_ = s.StopServerOnly()
		return s.Start()
	}
	_ = s.StopServerOnly()
	return nil
}

// StopServerOnly shuts down the HTTP server without stopping polling
func (s *Service) StopServerOnly() error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.server == nil {
		return nil
	}

	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()

	err := s.server.Shutdown(ctx)
	s.server = nil
	s.config.Enabled = false
	s.saveConfigLocked()
	s.emitStatusLocked()
	return err
}

// GenerateNewApiKey creates and saves a new random API key
func (s *Service) GenerateNewApiKey() string {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.config.ApiKey = generateKey()
	s.saveConfigLocked()
	s.emitStatusLocked()
	return s.config.ApiKey
}

// GetStatus returns the complete state and endpoint URLs
func (s *Service) GetStatus() RemoteApiStatus {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.getStatusLocked()
}

func (s *Service) getStatusLocked() RemoteApiStatus {
	agentStat := "idle"
	if s.isWorking {
		agentStat = "running"
	}

	endpoints := s.getEndpointsInfoLocked()
	pollTimeStr := ""
	if !s.lastPollTime.IsZero() {
		pollTimeStr = s.lastPollTime.Format("15:04:05")
	}

	return RemoteApiStatus{
		Enabled:         s.config.Enabled,
		Running:         s.server != nil,
		Port:            s.config.Port,
		Host:            s.config.Host,
		ApiKey:          s.config.ApiKey,
		Endpoints:       endpoints,
		Status:          agentStat,
		AgentStatus:     agentStat,
		IsWorking:       s.isWorking,
		IsRunning:       s.isWorking,
		IsIdle:          !s.isWorking,
		TaskID:          s.activeRunID,
		ActiveRunID:     s.activeRunID,
		CurrentRun:      s.currentRun,
		LastRun:         s.lastRun,
		PollingEnabled:  s.config.PollingEnabled,
		PollingActive:   s.pollActive,
		PollingURL:      s.config.PollingURL,
		PollingInterval: s.config.PollingInterval,
		LastPollTime:    pollTimeStr,
		LastPollStatus:  s.lastPollStatus,
	}
}

func (s *Service) getEndpointsInfoLocked() EndpointsInfo {
	host := s.config.Host
	if host == "0.0.0.0" {
		host = "localhost"
	}
	base := fmt.Sprintf("http://%s", net.JoinHostPort(host, strconv.Itoa(s.config.Port)))
	return EndpointsInfo{
		PromptEndpoint: base + "/api/prompt",
		StatusEndpoint: base + "/api/status",
		InfoEndpoint:   base + "/api/info",
	}
}

func (s *Service) emitStatusLocked() {
	if s.wailsCtx != nil {
		runtime.EventsEmit(s.wailsCtx, "remote_api:status", s.getStatusLocked())
	}
}

// corsMiddleware handles CORS headers and preflight requests
func (s *Service) corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-API-Key")

		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusOK)
			return
		}
		next.ServeHTTP(w, r)
	})
}

// authenticate verifies incoming request contains the valid API key
func (s *Service) authenticate(r *http.Request) bool {
	s.mu.RLock()
	expected := s.config.ApiKey
	s.mu.RUnlock()

	if expected == "" {
		return true
	}

	// 1. Authorization: Bearer <key>
	authHeader := r.Header.Get("Authorization")
	if strings.HasPrefix(authHeader, "Bearer ") {
		token := strings.TrimSpace(strings.TrimPrefix(authHeader, "Bearer "))
		if token == expected {
			return true
		}
	}

	// 2. X-API-Key: <key>
	if r.Header.Get("X-API-Key") == expected {
		return true
	}

	// 3. Query param ?api_key=<key>
	if r.URL.Query().Get("api_key") == expected {
		return true
	}

	return false
}

// handleInfo returns non-sensitive metadata and endpoints
func (s *Service) handleInfo(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	s.mu.RLock()
	defer s.mu.RUnlock()

	resp := map[string]interface{}{
		"service":   "oh-my-pi remote api",
		"version":   "1.0.0",
		"mode":      "full-access",
		"running":   s.server != nil,
		"endpoints": s.getEndpointsInfoLocked(),
	}
	_ = json.NewEncoder(w).Encode(resp)
}

// handleStatus returns current agent state and endpoints
func (s *Service) handleStatus(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	if !s.authenticate(r) {
		w.WriteHeader(http.StatusUnauthorized)
		_ = json.NewEncoder(w).Encode(map[string]string{"error": "Unauthorized: Invalid or missing API key"})
		return
	}

	st := s.GetStatus()
	_ = json.NewEncoder(w).Encode(st)
}

// handlePrompt runs an agent turn directly in the live workspace (full-access/yolo)
func (s *Service) handlePrompt(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	if r.Method != http.MethodPost {
		w.WriteHeader(http.StatusMethodNotAllowed)
		_ = json.NewEncoder(w).Encode(map[string]string{"error": "Method not allowed. Use POST."})
		return
	}

	if !s.authenticate(r) {
		w.WriteHeader(http.StatusUnauthorized)
		_ = json.NewEncoder(w).Encode(map[string]string{"error": "Unauthorized: Invalid or missing API key"})
		return
	}

	var req PromptRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		w.WriteHeader(http.StatusBadRequest)
		_ = json.NewEncoder(w).Encode(map[string]string{"error": "Invalid JSON body: " + err.Error()})
		return
	}

	prompt := strings.TrimSpace(req.Prompt)
	if prompt == "" {
		w.WriteHeader(http.StatusBadRequest)
		_ = json.NewEncoder(w).Encode(map[string]string{"error": "Prompt cannot be empty"})
		return
	}

	s.mu.Lock()
	if s.isWorking {
		activeID := s.activeRunID
		s.mu.Unlock()
		w.WriteHeader(http.StatusConflict)
		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"error":       "Agent is currently busy processing another turn",
			"activeRunId": activeID,
		})
		return
	}

	// Determine target CWD - executes directly in the real project directory
	targetCwd := strings.TrimSpace(req.Cwd)
	if targetCwd == "" {
		targetCwd = strings.TrimSpace(req.WorkspacePath)
	}
	if targetCwd == "" {
		binInfo, _ := s.ompService.GetBinaryInfo()
		targetCwd = binInfo["cwd"]
		if targetCwd == "" {
			targetCwd, _ = os.Getwd()
		}
	}

	runID := fmt.Sprintf("api-run-%s", time.Now().Format("20060102_150405"))

	runInfo := &RunInfo{
		RunID:     runID,
		Prompt:    prompt,
		Cwd:       targetCwd,
		Model:     req.Model,
		StartedAt: time.Now(),
		Status:    "running",
	}

	s.isWorking = true
	s.activeRunID = runID
	s.currentRun = runInfo
	endpoints := s.getEndpointsInfoLocked()
	s.emitStatusLocked()
	s.mu.Unlock()

	// Direct execution runner in live environment
	execute := func() (*RunInfo, error) {
		targetInstID := s.ompService.FindAvailableInstanceID()
		if s.wailsCtx != nil {
			runtime.EventsEmit(s.wailsCtx, "remote_api:task_started", map[string]interface{}{
				"instanceId": targetInstID,
				"prompt":     prompt,
				"cwd":        targetCwd,
				"runId":      runID,
			})
		}

		runErr := s.ompService.ExecuteAgent(omp.AgentRunOptions{
			Prompt:        prompt,
			Model:         req.Model,
			ThinkingLevel: req.ThinkingLevel,
			Cwd:           targetCwd,
			InstanceID:    targetInstID,
			ApprovalMode:  "yolo",
			AutoApprove:   true,
			Files:         req.Files,
		})

		s.mu.Lock()
		defer s.mu.Unlock()

		runInfo.CompletedAt = time.Now()
		runInfo.Success = runErr == nil

		if runErr != nil {
			runInfo.Status = "failed"
			runInfo.Error = runErr.Error()
		} else {
			runInfo.Status = "completed"
		}

		s.isWorking = false
		s.activeRunID = ""
		s.currentRun = nil
		s.lastRun = runInfo
		s.emitStatusLocked()

		return runInfo, runErr
	}

	if req.Sync {
		info, runErr := execute()
		if runErr != nil {
			w.WriteHeader(http.StatusInternalServerError)
			_ = json.NewEncoder(w).Encode(info)
			return
		}
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(info)
		return
	}

	// Asynchronous execution: return 202 immediately
	go func() {
		_, _ = execute()
	}()

	w.WriteHeader(http.StatusAccepted)
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"success":   true,
		"status":    "running",
		"runId":     runID,
		"task_id":   runID,
		"job_id":    runID,
		"id":        runID,
		"cwd":       targetCwd,
		"prompt":    prompt,
		"endpoints": endpoints,
		"message":   "Prompt received. Agent is executing directly in live workspace (full-access/yolo).",
	})
}

// startPollingWorkerLocked launches background polling loop
func (s *Service) startPollingWorkerLocked() {
	if s.pollActive {
		s.stopPollingWorkerLocked()
	}
	if !s.config.PollingEnabled || strings.TrimSpace(s.config.PollingURL) == "" {
		return
	}
	s.pollStopChan = make(chan struct{})
	s.pollActive = true
	interval := s.config.PollingInterval
	if interval < 2 {
		interval = 5
	}
	stopCh := s.pollStopChan
	ticker := time.NewTicker(time.Duration(interval) * time.Second)

	s.lastPollStatus = fmt.Sprintf("Yoklama başlatıldı (%ds aralıkla)", interval)
	s.emitStatusLocked()

	go func() {
		defer ticker.Stop()
		// Initial poll immediately
		s.pollOnce()
		for {
			select {
			case <-stopCh:
				return
			case <-ticker.C:
				s.pollOnce()
			}
		}
	}()
}

// stopPollingWorkerLocked halts background polling loop
func (s *Service) stopPollingWorkerLocked() {
	if s.pollActive && s.pollStopChan != nil {
		close(s.pollStopChan)
		s.pollStopChan = nil
		s.pollActive = false
		s.lastPollStatus = "Yoklama durduruldu"
		s.emitStatusLocked()
	}
}

// pollOnce executes a single query to the remote ticket server
func (s *Service) pollOnce() {
	s.mu.Lock()
	if s.isWorking {
		s.mu.Unlock()
		return
	}
	pollURL := strings.TrimSpace(s.config.PollingURL)
	if pollURL == "" || !s.config.PollingEnabled {
		s.mu.Unlock()
		return
	}
	apiKey := strings.TrimSpace(s.config.PollingApiKey)
	if apiKey == "" {
		apiKey = s.config.ApiKey
	}
	s.lastPollTime = time.Now()
	if apiKey == "" {
		s.lastPollStatus = "Polling API Anahtarı eksik (Firma Key gerekli)"
		s.emitStatusLocked()
		s.mu.Unlock()
		return
	}
	s.mu.Unlock()

	client := &http.Client{Timeout: 10 * time.Second}
	req, err := http.NewRequest("GET", pollURL, nil)
	if err != nil {
		s.mu.Lock()
		s.lastPollStatus = "URL hatası: " + err.Error()
		s.emitStatusLocked()
		s.mu.Unlock()
		return
	}
	req.Header.Set("Accept", "application/json")
	if apiKey != "" {
		req.Header.Set("Authorization", "Bearer "+apiKey)
		req.Header.Set("X-API-Key", apiKey)
	}

	resp, err := client.Do(req)
	if err != nil {
		s.mu.Lock()
		s.lastPollStatus = "Bağlantı hatası: " + err.Error()
		s.emitStatusLocked()
		s.mu.Unlock()
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		var errResp map[string]interface{}
		errMsg := ""
		if err := json.NewDecoder(resp.Body).Decode(&errResp); err == nil {
			if e, ok := errResp["error"].(string); ok && e != "" {
				errMsg = e
			}
		}
		s.mu.Lock()
		if errMsg != "" {
			s.lastPollStatus = fmt.Sprintf("HTTP %d: %s", resp.StatusCode, errMsg)
		} else {
			s.lastPollStatus = fmt.Sprintf("HTTP %d hatası", resp.StatusCode)
		}
		s.emitStatusLocked()
		s.mu.Unlock()
		return
	}

	var pResp PollResponse
	if err := json.NewDecoder(resp.Body).Decode(&pResp); err != nil {
		s.mu.Lock()
		s.lastPollStatus = "JSON çözme hatası"
		s.emitStatusLocked()
		s.mu.Unlock()
		return
	}

	s.mu.Lock()
	if !pResp.HasTask || pResp.Task == nil || strings.TrimSpace(pResp.Task.Prompt) == "" {
		if strings.TrimSpace(pResp.Message) != "" {
			s.lastPollStatus = pResp.Message
		} else {
			s.lastPollStatus = "Kuyruk boş (Bekleyen görev yok)"
		}
		s.emitStatusLocked()
		s.mu.Unlock()
		return
	}

	task := pResp.Task
	taskIDStr := fmt.Sprintf("%v", task.TaskID)
	s.lastPollStatus = fmt.Sprintf("Görev alındı: #%s", taskIDStr)
	s.emitStatusLocked()
	s.mu.Unlock()

	// Execute task in live workspace
	go s.executePolledTask(task)
}

// executePolledTask runs omp directly in live workspace and reports completion back to ticket server
func (s *Service) executePolledTask(task *TicketTask) {
	s.mu.Lock()
	taskIDStr := fmt.Sprintf("%v", task.TaskID)
	targetCwd := strings.TrimSpace(task.WorkspacePath)
	if targetCwd == "" {
		binInfo, _ := s.ompService.GetBinaryInfo()
		targetCwd = binInfo["cwd"]
		if targetCwd == "" {
			targetCwd, _ = os.Getwd()
		}
	}
	fmt.Printf("[OMP Service] [%s] Received task #%v (Subject: %s)\n", time.Now().Format("15:04:05"), task.TaskID, task.Subject)
	runInfo := &RunInfo{
		RunID:     "poll-task-" + taskIDStr,
		Cwd:       targetCwd,
		StartedAt: time.Now(),
		Status:    "running",
	}

	s.isWorking = true
	s.activeRunID = runInfo.RunID
	s.currentRun = runInfo
	s.emitStatusLocked()

	callbackURL := strings.TrimSpace(task.CallbackURL)
	if callbackURL == "" {
		callbackURL = s.config.PollingURL
	}
	apiKey := strings.TrimSpace(s.config.PollingApiKey)
	if apiKey == "" {
		apiKey = s.config.ApiKey
	}
	s.mu.Unlock()

	targetInstID := s.ompService.FindAvailableInstanceID()
	refID := task.ReferenceID
	if refID == nil || refID == "" {
		refID = task.TicketID
	}
	if s.wailsCtx != nil {
		runtime.EventsEmit(s.wailsCtx, "remote_api:task_started", map[string]interface{}{
			"instanceId":  targetInstID,
			"prompt":      task.Prompt,
			"cwd":         targetCwd,
			"runId":       runInfo.RunID,
			"taskId":      task.TaskID,
			"referenceId": refID,
			"ticketId":    refID,
			"company":     task.CompanyName,
			"subject":     task.Subject,
		})
	}

	s.mu.Lock()
	if s.activeTasksByInstance == nil {
		s.activeTasksByInstance = make(map[string]*TicketTask)
	}
	s.activeTasksByInstance[targetInstID] = task
	s.mu.Unlock()
	agentOutput, runErr := s.ompService.ExecuteAgentWithOutput(omp.AgentRunOptions{
		Prompt:       task.Prompt,
		Cwd:          targetCwd,
		InstanceID:   targetInstID,
		ApprovalMode: "yolo",
		AutoApprove:  true,
	})

	// If the agent turn errored out or stopped prematurely without output, auto-retry once with "devam et"
	if runErr != nil || strings.TrimSpace(agentOutput) == "" {
		s.mu.Lock()
		s.lastPollStatus = fmt.Sprintf("Ajan durdu (#%s). Otomatik 'devam et' ile devam ettiriliyor...", taskIDStr)
		s.emitStatusLocked()
		s.mu.Unlock()

		time.Sleep(1500 * time.Millisecond)
		activeSessID := s.ompService.GetActiveSessionIDInstance(targetInstID)

		if s.wailsCtx != nil {
			runtime.EventsEmit(s.wailsCtx, "remote_api:task_retry", map[string]interface{}{
				"instanceId": targetInstID,
				"prompt":     "devam et",
				"ticketId":   task.TicketID,
				"reason":     "auto_resume",
			})
		}

		retryOutput, retryErr := s.ompService.ExecuteAgentWithOutput(omp.AgentRunOptions{
			Prompt:       "devam et",
			Cwd:          targetCwd,
			InstanceID:   targetInstID,
			SessionID:    activeSessID,
			ApprovalMode: "yolo",
			AutoApprove:  true,
		})

		if retryErr == nil && strings.TrimSpace(retryOutput) != "" {
			runErr = nil
			agentOutput = retryOutput
		} else {
			if retryErr != nil {
				runErr = retryErr
			} else if runErr == nil {
				runErr = fmt.Errorf("agent turn did not produce output after 'devam et'")
			}
		}
	}
	s.mu.Lock()
	runInfo.CompletedAt = time.Now()
	runInfo.Success = runErr == nil
	finalStatus := "completed"
	if runErr != nil {
		runInfo.Status = "failed"
		runInfo.Error = runErr.Error()
		finalStatus = "failed"
	} else {
		runInfo.Status = "completed"
	}

	s.isWorking = false
	s.activeRunID = ""
	s.currentRun = nil
	s.lastRun = runInfo
	s.lastPollStatus = fmt.Sprintf("Görev tamamlandı (#%s): %s", taskIDStr, finalStatus)
	s.emitStatusLocked()
	s.mu.Unlock()

	// Send completion callback via unified callback helper
	_ = s.SendTaskCompletionCallback(task, agentOutput, runErr, targetCwd)
}

// OnInstanceTurnComplete is invoked whenever an agent turn finishes on any instance (including GUI "devam et")
func (s *Service) OnInstanceTurnComplete(instanceId string, output string, runErr error) {
	s.mu.RLock()
	task, ok := s.activeTasksByInstance[instanceId]
	isPollerActive := s.isWorking
	s.mu.RUnlock()
	if !ok || task == nil {
		return
	}

	// If automated polling (executePolledTask) is currently executing, it manages and sends its own callback.
	// Do not fire a duplicate callback from the agent hook!
	if isPollerActive {
		return
	}

	// If the user entered "devam et" or another prompt in GUI, update the ticket with the latest answer
	targetCwd := strings.TrimSpace(task.WorkspacePath)
	if targetCwd == "" {
		binInfo, _ := s.ompService.GetBinaryInfo()
		targetCwd = binInfo["cwd"]
	}

	_ = s.SendTaskCompletionCallback(task, output, runErr, targetCwd)
}

// SyncTaskReply sends the current assistant output of an instance to its bound remote task
func (s *Service) SyncTaskReply(instanceId string, outputText string) error {
	s.mu.RLock()
	task, ok := s.activeTasksByInstance[instanceId]
	s.mu.RUnlock()
	if !ok || task == nil {
		return fmt.Errorf("bu terminal penceresi için bağlı bir uzak görev bulunamadı")
	}

	targetCwd := strings.TrimSpace(task.WorkspacePath)
	if targetCwd == "" {
		binInfo, _ := s.ompService.GetBinaryInfo()
		targetCwd = binInfo["cwd"]
	}

	return s.SendTaskCompletionCallback(task, outputText, nil, targetCwd)
}

// SyncTicketReply is an alias for SyncTaskReply for backward compatibility
func (s *Service) SyncTicketReply(instanceId string, outputText string) error {
	return s.SyncTaskReply(instanceId, outputText)
}
// SendTaskCompletionCallback formats the result and sends callback to the ticket server
func (s *Service) SendTaskCompletionCallback(task *TicketTask, agentOutput string, runErr error, targetCwd string) error {
	s.mu.Lock()
	// Deduplicate: if the exact same output for this task was already sent within the last 15 seconds, skip!
	taskIDStr := fmt.Sprintf("%v", task.TaskID)
	cleanOut := strings.TrimSpace(agentOutput)
	if taskIDStr != "" && taskIDStr != "<nil>" && taskIDStr == s.lastCallbackTaskID && cleanOut == s.lastCallbackOutput && time.Since(s.lastCallbackTime) < 15*time.Second {
		s.mu.Unlock()
		return nil
	}
	s.lastCallbackTaskID = taskIDStr
	s.lastCallbackOutput = cleanOut
	s.lastCallbackTime = time.Now()

	callbackURL := strings.TrimSpace(task.CallbackURL)
	if callbackURL == "" {
		callbackURL = s.config.PollingURL
	}
	apiKey := strings.TrimSpace(s.config.PollingApiKey)
	if apiKey == "" {
		apiKey = s.config.ApiKey
	}
	pm := s.pluginManager
	s.mu.Unlock()

	if callbackURL == "" {
		return fmt.Errorf("callback URL tanımlanmamış")
	}

	finalStatus := "completed"
	errMsg := ""
	if runErr != nil {
		finalStatus = "failed"
		errMsg = runErr.Error()
	}
	fmt.Printf("[OMP Service] [%s] Task #%v finished with status: %s\n", time.Now().Format("15:04:05"), task.TaskID, finalStatus)
	refID := task.ReferenceID
	if refID == nil || refID == "" {
		refID = task.TicketID
	}
	taskCtx := &plugins.TaskContext{
		TaskID:      task.TaskID,
		ReferenceID: refID,
		TicketID:    refID,
		Company:     task.CompanyName,
		Subject:     task.Subject,
		Prompt:      task.Prompt,
		Workspace:   targetCwd,
		CallbackURL: callbackURL,
	}
	taskRes := &plugins.TaskResult{
		Status: finalStatus,
		Output: agentOutput,
		Error:  errMsg,
	}

	if pm != nil {
		taskRes = pm.DispatchTaskCompleted(taskCtx, taskRes)
	}

	finalOutput := strings.TrimSpace(taskRes.Output)
	if finalOutput == "" && finalStatus == "completed" {
		finalOutput = "OMP Agent görevi başarıyla tamamladı."
	}

	replyToSend := strings.TrimSpace(taskRes.ReplyMessage)
	if replyToSend == "" {
		replyToSend = finalOutput
	}

	callbackPayload := map[string]interface{}{
		"action":        "complete",
		"task_id":       task.TaskID,
		"reference_id":  refID,
		"ticket_id":     refID,
		"status":        finalStatus,
		"error":         errMsg,
		"output":        finalOutput,
		"auto_reply":    taskRes.AutoReply,
		"reply_message": replyToSend,
	}
	jsonBytes, err := json.Marshal(callbackPayload)
	if err != nil {
		return err
	}

	cbReq, err := http.NewRequest("POST", callbackURL, bytes.NewReader(jsonBytes))
	if err != nil {
		return err
	}
	cbReq.Header.Set("Content-Type", "application/json")
	if apiKey != "" {
		cbReq.Header.Set("Authorization", "Bearer "+apiKey)
		cbReq.Header.Set("X-API-Key", apiKey)
	}
	client := &http.Client{Timeout: 15 * time.Second}
	resp, err := client.Do(cbReq)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if s.wailsCtx != nil {
		runtime.EventsEmit(s.wailsCtx, "task:reply_synced", map[string]interface{}{
			"referenceId": refID,
			"ticketId":    refID,
			"taskId":      task.TaskID,
			"status":      finalStatus,
			"message":     replyToSend,
		})
		runtime.EventsEmit(s.wailsCtx, "ticket:reply_synced", map[string]interface{}{
			"referenceId": refID,
			"ticketId":    refID,
			"taskId":      task.TaskID,
			"status":      finalStatus,
			"message":     replyToSend,
		})
	}
	return nil
}
