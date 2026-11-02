package plugins

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sync"
)

type pluginStoredState struct {
	Enabled  bool                   `json:"enabled"`
	Settings map[string]interface{} `json:"settings"`
}

// PluginManager coordinates plugins, persistence and lifecycle hooks
type PluginManager struct {
	mu         sync.RWMutex
	plugins    map[string]Plugin
	configFile string
}

// NewPluginManager creates a manager saving config to desktop_plugins.json in ~/.omp
func NewPluginManager(configDir string) *PluginManager {
	if configDir == "" {
		homeDir, _ := os.UserHomeDir()
		configDir = filepath.Join(homeDir, ".omp")
	}
	cfgFile := filepath.Join(configDir, "desktop_plugins.json")

	pm := &PluginManager{
		plugins:    make(map[string]Plugin),
		configFile: cfgFile,
	}

	return pm
}

// Register registers a plugin and loads its persisted state if available
func (pm *PluginManager) Register(p Plugin) {
	pm.mu.Lock()
	defer pm.mu.Unlock()

	info := p.Info()
	pm.plugins[info.ID] = p

	pm.loadPluginState(p)
}

// GetPlugins returns metadata and settings for all registered plugins
func (pm *PluginManager) GetPlugins() []PluginInfo {
	pm.mu.RLock()
	defer pm.mu.RUnlock()

	var list []PluginInfo
	for _, p := range pm.plugins {
		list = append(list, p.Info())
	}
	return list
}

// SetPluginEnabled toggles a plugin
func (pm *PluginManager) SetPluginEnabled(id string, enabled bool) error {
	pm.mu.Lock()
	defer pm.mu.Unlock()

	p, ok := pm.plugins[id]
	if !ok {
		return fmt.Errorf("plugin %s not found", id)
	}

	p.SetEnabled(enabled)
	pm.saveStateLocked()
	return nil
}

// UpdatePluginSettings updates a plugin's custom configuration map
func (pm *PluginManager) UpdatePluginSettings(id string, settings map[string]interface{}) error {
	pm.mu.Lock()
	defer pm.mu.Unlock()

	p, ok := pm.plugins[id]
	if !ok {
		return fmt.Errorf("plugin %s not found", id)
	}

	if err := p.UpdateSettings(settings); err != nil {
		return err
	}

	pm.saveStateLocked()
	return nil
}

// DispatchTaskReceived executes OnTaskReceived on all active plugins
func (pm *PluginManager) DispatchTaskReceived(ctx *TaskContext) *TaskContext {
	pm.mu.RLock()
	defer pm.mu.RUnlock()

	current := ctx
	for _, p := range pm.plugins {
		if p.IsEnabled() {
			if updated, err := p.OnTaskReceived(current); err == nil && updated != nil {
				current = updated
			}
		}
	}
	return current
}

// DispatchTaskCompleted executes OnTaskCompleted on all active plugins
func (pm *PluginManager) DispatchTaskCompleted(ctx *TaskContext, res *TaskResult) *TaskResult {
	pm.mu.RLock()
	defer pm.mu.RUnlock()

	current := res
	for _, p := range pm.plugins {
		if p.IsEnabled() {
			if updated, err := p.OnTaskCompleted(ctx, current); err == nil && updated != nil {
				current = updated
			}
		}
	}
	return current
}

// DispatchTaskFailed executes OnTaskFailed on all active plugins
func (pm *PluginManager) DispatchTaskFailed(ctx *TaskContext, err error) {
	pm.mu.RLock()
	defer pm.mu.RUnlock()

	for _, p := range pm.plugins {
		if p.IsEnabled() {
			_ = p.OnTaskFailed(ctx, err)
		}
	}
}

func (pm *PluginManager) loadPluginState(p Plugin) {
	if _, err := os.Stat(pm.configFile); os.IsNotExist(err) {
		return
	}

	data, err := os.ReadFile(pm.configFile)
	if err != nil {
		return
	}

	var stateMap map[string]pluginStoredState
	if err := json.Unmarshal(data, &stateMap); err != nil {
		return
	}

	info := p.Info()
	if st, ok := stateMap[info.ID]; ok {
		p.SetEnabled(st.Enabled)
		if st.Settings != nil {
			_ = p.UpdateSettings(st.Settings)
		}
	}
}

func (pm *PluginManager) saveStateLocked() {
	stateMap := make(map[string]pluginStoredState)
	for id, p := range pm.plugins {
		stateMap[id] = pluginStoredState{
			Enabled:  p.IsEnabled(),
			Settings: p.GetSettings(),
		}
	}

	data, err := json.MarshalIndent(stateMap, "", "  ")
	if err != nil {
		return
	}

	_ = os.MkdirAll(filepath.Dir(pm.configFile), 0755)
	_ = os.WriteFile(pm.configFile, data, 0644)
}
