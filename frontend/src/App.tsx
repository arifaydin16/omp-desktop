import React, { useState, useEffect, useCallback } from 'react';
import { HeaderBar } from './components/HeaderBar';
import { AgentStudio } from './components/AgentStudio';
import { SessionsDrawer } from './components/SessionsDrawer';
import { DevToolsDrawer } from './components/DevToolsDrawer';
import { SettingsDialog } from './components/SettingsDialog';
import { SkillsDrawer } from './components/SkillsDrawer';
import { UsageDialog } from './components/UsageDialog';
import { WorkspaceSessionsSidebar } from './components/WorkspaceSessionsSidebar';
import { ChatMessage, AgentRunOptions, SessionSummary, ModelEntry, UpdateStatus } from './types';
import { splitThinkingAndResponse } from './utils/textParser';
import * as AppApi from '../wailsjs/go/main/App';
import { EventsOn } from '../wailsjs/runtime/runtime';

export function App() {
  const [binaryVersion, setBinaryVersion] = useState('');
  const [cwd, setCwd] = useState('');
  const [profile, setProfile] = useState('');
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string>('');
  const [attachedFiles, setAttachedFiles] = useState<string[]>([]);
  const [availableModels, setAvailableModels] = useState<ModelEntry[]>([]);
  const [selectedModel, setSelectedModel] = useState('google-antigravity/gemini-3.8-flash');
  const [activeDrawer, setActiveDrawer] = useState<string | null>(null);
  const [isWorking, setIsWorking] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [theme, setTheme] = useState<string>(() => localStorage.getItem('omp_theme') || 'cyber-violet');

  // Synchronize dynamic theme to document element
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('omp_theme', theme);
  }, [theme]);
  // Initialize app data and event listeners
  useEffect(() => {
    // 1. Fetch Binary info
    AppApi.GetBinaryInfo()
      .then((info) => {
        if (info && info.version) {
          setBinaryVersion(info.version);
        }
      })
      .catch((err: unknown) => console.error('GetBinaryInfo err:', err));

    // 2. Fetch Models
    AppApi.GetModels()
      .then((cat) => {
        if (cat && Array.isArray(cat.models)) {
          setAvailableModels(cat.models);
        }
      })
      .catch((err: unknown) => console.error('GetModels err:', err));

    // 3. Fetch Update Status
    AppApi.GetUpdateStatus()
      .then((status) => {
        if (status) {
          setUpdateStatus(status);
        }
      })
      .catch((err: unknown) => console.error('GetUpdateStatus err:', err));
    // 4. Fetch Current Profile
    AppApi.GetCurrentProfile()
      .then(async (p) => {
        if (p) setProfile(p);
        try {
          const roles = await AppApi.GetModelRoles();
          if (roles && roles['default']) {
            const def = roles['default'].split(':')[0];
            if (def) setSelectedModel(def);
          }
        } catch {}
      })
      .catch((err: unknown) => console.error('GetCurrentProfile err:', err));


    // 4. Setup Wails Event Listeners
    const unsubStatus = EventsOn('agent:status', (data: unknown) => {
      if (data && typeof data === 'object') {
        const obj = data as Record<string, unknown>;
        setIsWorking(obj.status === 'running');
      }
    });

    const unsubStream = EventsOn('agent:stream', (data: unknown) => {
      if (!data || typeof data !== 'object') return;
      const obj = data as Record<string, unknown>;
      const streamType = typeof obj.type === 'string' ? obj.type : 'stdout';
      const content = typeof obj.content === 'string' ? obj.content : '';
      if (typeof obj.content !== 'string') return;

      const trimmed = content.trim();

      // Filter out any JSON strings that might leak
      if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
        return;
      }

      if (
        streamType === 'stderr' &&
        (trimmed.startsWith('Working') || trimmed.includes('Working...') || trimmed.includes('Still starting'))
      ) {
        setMessages((prev) => {
          if (prev.length === 0) return prev;
          const last = prev[prev.length - 1];
          if (last.role === 'assistant') {
            return [
              ...prev.slice(0, -1),
              {
                ...last,
                workingStatus: trimmed,
              },
            ];
          }
          return prev;
        });
        return;
      }

      // If content is literally just "Working...", also isolate it into workingStatus
      if (trimmed === 'Working...' || trimmed === 'Working…') {
        setMessages((prev) => {
          if (prev.length === 0) return prev;
          const last = prev[prev.length - 1];
          if (last.role === 'assistant') {
            return [
              ...prev.slice(0, -1),
              {
                ...last,
                workingStatus: trimmed,
              },
            ];
          }
          return prev;
        });
        return;
      }
      // Direct typed thinking delta
      if (streamType === 'thinking') {
        setMessages((prev) => {
          if (prev.length === 0) return prev;
          const last = prev[prev.length - 1];
          if (last.role === 'assistant') {
            return [
              ...prev.slice(0, -1),
              {
                ...last,
                thinking: (last.thinking || '') + content,
                workingStatus: undefined,
              },
            ];
          }
          return prev;
        });
        return;
      }

      // Direct typed text delta
      if (streamType === 'text') {
        setMessages((prev) => {
          if (prev.length === 0) return prev;
          const last = prev[prev.length - 1];
          if (last.role === 'assistant') {
            return [
              ...prev.slice(0, -1),
              {
                ...last,
                text: (last.text || '') + content,
                workingStatus: undefined,
              },
            ];
          }
          return prev;
        });
        return;
      }

      setMessages((prev) => {
        if (prev.length === 0) return prev;
        const last = prev[prev.length - 1];

        // If the last message is from assistant, append stream
        if (last.role === 'assistant') {
          // Check for thinking blocks
          if (content.startsWith("I'm thinking") || content.includes("thinking through")) {
            return [
              ...prev.slice(0, -1),
              {
                ...last,
                thinking: (last.thinking ? last.thinking + '\n' : '') + content,
                workingStatus: undefined,
              },
            ];
          }

          return [
            ...prev.slice(0, -1),
            {
              ...last,
              text: (last.text ? last.text + '\n' : '') + content,
              workingStatus: undefined,
            },
          ];
        }

        // Otherwise create new assistant response
        return [
          ...prev,
          {
            id: 'msg_' + Date.now(),
            role: 'assistant',
            text: content,
            timestamp: new Date().toISOString(),
          },
        ];
      });
    });

    const unsubCommand = EventsOn('agent:command', (data: unknown) => {
      if (data && typeof data === 'object') {
        const obj = data as Record<string, unknown>;
        const cmdStr = typeof obj.command === 'string' ? obj.command : '';
        setMessages((prev) => {
          if (prev.length === 0) return prev;
          const last = prev[prev.length - 1];
          if (last.role === 'assistant') {
            return [
              ...prev.slice(0, -1),
              { ...last, command: cmdStr },
            ];
          }
          return prev;
        });
      }
    });
    const unsubSession = EventsOn('agent:session', (data: unknown) => {
      if (data && typeof data === 'object') {
        const obj = data as Record<string, unknown>;
        if (typeof obj.sessionId === 'string' && obj.sessionId) {
          setCurrentSessionId(obj.sessionId);
        }
      }
    });

    const unsubDone = EventsOn('agent:done', (data: unknown) => {
      setIsWorking(false);
      if (data && typeof data === 'object') {
        const obj = data as Record<string, unknown>;
        const exitCode = typeof obj.exitCode === 'number' ? obj.exitCode : 0;
        if (typeof obj.sessionId === 'string' && obj.sessionId) {
          setCurrentSessionId(obj.sessionId);
        }
        setMessages((prev) => {
          if (prev.length === 0) return prev;
          const last = prev[prev.length - 1];
          if (last.role === 'assistant') {
            const split = splitThinkingAndResponse(last.text || '');
            const finalThinking = last.thinking || split.thinking || undefined;
            const finalResponse = split.response || last.text || '';

            return [
              ...prev.slice(0, -1),
              {
                ...last,
                text: finalResponse,
                thinking: finalThinking,
                exitCode,
                workingStatus: undefined,
              },
            ];
          }
          return prev;
        });
      }
    });

    const unsubUpdateStatus = EventsOn('update:status', (data: unknown) => {
      if (data && typeof data === 'object') {
        setUpdateStatus(data as UpdateStatus);
      }
    });

    return () => {
      unsubStatus();
      unsubStream();
      unsubCommand();
      unsubSession();
      unsubDone();
      unsubUpdateStatus();
    };
  }, []);

  const handleSelectCwd = async () => {
    try {
      const selected = await AppApi.SelectDirectory();
      if (selected) {
        setCwd(selected);
      }
    } catch (err: unknown) {
      console.error('SelectDirectory err:', err);
    }
  };

  const handleSelectFiles = async () => {
    try {
      const files = await AppApi.SelectFiles();
      if (files && files.length > 0) {
        setAttachedFiles((prev) => [...prev, ...files]);
      }
    } catch (err: unknown) {
      console.error('SelectFiles err:', err);
    }
  };

  const handleRemoveFile = (index: number) => {
    setAttachedFiles((prev) => prev.filter((_, i) => i !== index));
  };
  const handleAddFile = useCallback((path: string) => {
    setAttachedFiles((prev) => (prev.includes(path) ? prev : [...prev, path]));
  }, []);


  const handleSendMessage = async (opts: AgentRunOptions) => {
    const userMsg: ChatMessage = {
      id: 'usr_' + Date.now(),
      role: 'user',
      text: opts.prompt,
      timestamp: new Date().toISOString(),
      files: opts.files,
    };

    const assistantMsgPlaceholder: ChatMessage = {
      id: 'asst_' + Date.now(),
      role: 'assistant',
      text: '',
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMsg, assistantMsgPlaceholder]);
    setAttachedFiles([]);
    setIsWorking(true);

    try {
      await AppApi.ExecuteAgent(opts);
    } catch (err: unknown) {
      console.error('ExecuteAgent err:', err);
      setMessages((prev) => [
        ...prev,
        {
          id: 'err_' + Date.now(),
          role: 'system',
          text: 'Hata: ' + String(err),
          timestamp: new Date().toISOString(),
        },
      ]);
      setIsWorking(false);
    }
  };

  const handleStopAgent = async () => {
    try {
      await AppApi.StopAgent();
      setIsWorking(false);
    } catch (err: unknown) {
      console.error('StopAgent err:', err);
    }
  };

  const handleSendStdin = async (input: string) => {
    try {
      await AppApi.SendStdin(input);
    } catch (err: unknown) {
      console.error('SendStdin err:', err);
    }
  };

  const handleCheckUpdates = async () => {
    try {
      const status = await AppApi.CheckForUpdates();
      if (status) {
        setUpdateStatus(status);
      }
    } catch (err: unknown) {
      console.error('CheckForUpdates err:', err);
    }
  };

  const handleInstallUpdate = async (canary: boolean, plugins: boolean) => {
    try {
      await AppApi.InstallUpdate(canary, plugins, false);
    } catch (err: unknown) {
      console.error('InstallUpdate err:', err);
    }
  };

  const handleResumeSession = async (session: SessionSummary) => {
    setCwd(session.cwd || '');
    setCurrentSessionId(session.id || '');
    if (session.id) {
      AppApi.SetActiveSessionID(session.id).catch(() => {});
    }
    if (session.model) {
      setSelectedModel(session.model);
    }
    try {
      const detail = await AppApi.GetSessionDetail(session.path);
      if (detail && detail.messages && detail.messages.length > 0) {
        const parsedMsgs: ChatMessage[] = [];
        for (const row of detail.messages) {
          const rowType = row.type as string;
          if (rowType === 'message') {
            const role = (row.role as 'user' | 'assistant' | 'system') || 'assistant';
            let text = '';
            if (typeof row.content === 'string') {
              text = row.content;
            } else if (Array.isArray(row.content)) {
              for (const part of row.content) {
                if (typeof part === 'string') text += part;
                else if (part && typeof part === 'object' && 'text' in (part as Record<string, unknown>)) {
                  text += String((part as Record<string, unknown>).text || '');
                }
              }
            }
            if (text.trim()) {
              parsedMsgs.push({
                id: String(row.id || 'msg_' + Math.random().toString(36).slice(2)),
                role,
                text,
                timestamp: String(row.timestamp || new Date().toISOString()),
              });
            }
          }
        }
        if (parsedMsgs.length > 0) {
          setMessages(parsedMsgs);
          return;
        }
      }
    } catch (e) {
      console.warn('Could not load session transcript messages:', e);
    }

    // Fallback if empty or parsing failed
    setMessages([
      {
        id: 'sys_' + Date.now(),
        role: 'system',
        text: `Oturum yüklendi: ${session.title} (${session.id})`,
        timestamp: new Date().toISOString(),
      },
    ]);
  };

  const handleNewSession = () => {
    setMessages([]);
    setAttachedFiles([]);
    setCurrentSessionId('');
    AppApi.ClearActiveSession().catch(() => {});
  };
  const handleToggleDrawer = (drawerName: string) => {
    setActiveDrawer((prev) => (prev === drawerName ? null : drawerName));
  };

  const handleRefreshModels = async () => {
    try {
      await AppApi.RefreshModels();
      const cat = await AppApi.GetModels();
      if (cat && Array.isArray(cat.models)) {
        setAvailableModels(cat.models);
      }
    } catch (err: unknown) {
      console.error('RefreshModels err:', err);
    }
  };
  const handleProfileChange = async (newProf: string) => {
    setProfile(newProf);
    try {
      await AppApi.SetProfile(newProf);
      const cat = await AppApi.GetModels();
      if (cat && Array.isArray(cat.models)) {
        setAvailableModels(cat.models);
      }
      const roles = await AppApi.GetModelRoles();
      if (roles && roles['default']) {
        const def = roles['default'].split(':')[0];
        if (def) setSelectedModel(def);
      }
    } catch (e) {
      console.error('Failed to switch profile:', e);
    }
  };
  // Global Keyboard Shortcuts (Ctrl+N, Ctrl+B, Ctrl+,, Ctrl+Shift+U/S/D, Ctrl+K, Escape)
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      const isCmdOrCtrl = e.ctrlKey || e.metaKey;

      // Escape: Close active drawer
      if (e.key === 'Escape') {
        if (activeDrawer) {
          e.preventDefault();
          setActiveDrawer(null);
          return;
        }
      }

      // Ctrl + N: New Session
      if (isCmdOrCtrl && e.key.toLowerCase() === 'n' && !e.shiftKey) {
        e.preventDefault();
        handleNewSession();
        return;
      }

      // Ctrl + B: Toggle Sessions Sidebar
      if (isCmdOrCtrl && e.key.toLowerCase() === 'b' && !e.shiftKey) {
        e.preventDefault();
        setIsSidebarOpen((prev) => !prev);
        return;
      }

      // Ctrl + ,: Toggle Settings
      if (isCmdOrCtrl && e.key === ',') {
        e.preventDefault();
        setActiveDrawer((prev) => (prev === 'settings' ? null : 'settings'));
        return;
      }

      // Ctrl + Shift + U: Toggle Usage Dialog
      if (isCmdOrCtrl && e.shiftKey && e.key.toLowerCase() === 'u') {
        e.preventDefault();
        setActiveDrawer((prev) => (prev === 'usage' ? null : 'usage'));
        return;
      }

      // Ctrl + Shift + S: Toggle Skills Drawer
      if (isCmdOrCtrl && e.shiftKey && e.key.toLowerCase() === 's') {
        e.preventDefault();
        setActiveDrawer((prev) => (prev === 'skills' ? null : 'skills'));
        return;
      }

      // Ctrl + Shift + D: Toggle DevTools Drawer
      if (isCmdOrCtrl && e.shiftKey && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        setActiveDrawer((prev) => (prev === 'devtools' ? null : 'devtools'));
        return;
      }

      // Ctrl + K or Ctrl + /: Focus Prompt Input
      if (isCmdOrCtrl && (e.key.toLowerCase() === 'k' || e.key === '/') && !e.shiftKey) {
        const activeTag = document.activeElement?.tagName.toLowerCase();
        if (activeTag !== 'input' && activeTag !== 'textarea') {
          e.preventDefault();
          const inputEl = document.getElementById('omp-badge-prompt-input');
          if (inputEl) {
            inputEl.focus();
          }
        }
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [activeDrawer]);


  return (
    <div className="flex flex-col h-screen w-screen bg-omp-bg text-omp-text overflow-hidden font-sans p-2 sm:p-2.5 md:p-3">
      {/* Framed Application Window (Padding left & right, high elevation border) */}
      <div className="flex flex-col flex-1 h-full w-full border border-omp-border rounded-[3px] bg-omp-surface overflow-hidden shadow-2xl relative">
        {/* Top Navigation & Auto-Update Bar */}
        <HeaderBar
          binaryVersion={binaryVersion}
          cwd={cwd}
          onSelectCwd={handleSelectCwd}
          profile={profile}
          onChangeProfile={handleProfileChange}
          updateStatus={updateStatus}
          onCheckUpdates={handleCheckUpdates}
          onInstallUpdate={handleInstallUpdate}
          activeDrawer={activeDrawer}
          onToggleDrawer={handleToggleDrawer}
          isWorking={isWorking}
          isSidebarOpen={isSidebarOpen}
          onToggleSidebar={() => setIsSidebarOpen((prev) => !prev)}
          theme={theme}
          onSelectTheme={setTheme}
        />

        {/* Main Workspace (Workspace Sessions Sidebar + Agent Studio + Collapsible Side Panels) */}
        <div className="flex-1 flex overflow-hidden relative">
          {/* Workspace-based Sessions Sidebar (Default Closed) */}
          <WorkspaceSessionsSidebar
            isOpen={isSidebarOpen}
            onToggle={() => setIsSidebarOpen(false)}
            currentCwd={cwd}
            onResumeSession={handleResumeSession}
            onNewSession={handleNewSession}
          />
        <AgentStudio
          profile={profile}
          messages={messages}
          sessionId={currentSessionId}
          isWorking={isWorking}
          onSendMessage={handleSendMessage}
          onStopAgent={handleStopAgent}
          onSendStdin={handleSendStdin}
          cwd={cwd}
          onSelectCwd={handleSelectCwd}
          onSelectFiles={handleSelectFiles}
          attachedFiles={attachedFiles}
          onRemoveFile={handleRemoveFile}
          onAddFile={handleAddFile}
          availableModels={availableModels}
          selectedModel={selectedModel}
          onSelectModel={setSelectedModel}
          onClearConsole={() => {
            setMessages([]);
            setCurrentSessionId('');
            AppApi.ClearActiveSession().catch(() => {});
          }}
          onOpenUsage={() => setActiveDrawer('usage')}
          onOpenSkills={() => setActiveDrawer('skills')}
          onOpenSessions={() => setActiveDrawer('sessions')}
          onOpenSettings={() => setActiveDrawer('settings')}
          onOpenDevTools={() => setActiveDrawer('devtools')}
        />

        {/* Collapsible Drawers */}
        <SessionsDrawer
          isOpen={activeDrawer === 'sessions'}
          onClose={() => setActiveDrawer(null)}
          onResumeSession={handleResumeSession}
        />
        <DevToolsDrawer
          isOpen={activeDrawer === 'devtools'}
          onClose={() => setActiveDrawer(null)}
          cwd={cwd}
        />

        <SettingsDialog
          isOpen={activeDrawer === 'settings'}
          onClose={() => setActiveDrawer(null)}
          profile={profile}
        />

        <SkillsDrawer
          isOpen={activeDrawer === 'skills'}
          onClose={() => setActiveDrawer(null)}
        />
        <UsageDialog
          isOpen={activeDrawer === 'usage'}
          onClose={() => setActiveDrawer(null)}
        />
      </div>
      </div>
    </div>
  );
}

export default App;
