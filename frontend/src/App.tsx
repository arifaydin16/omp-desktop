import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { HeaderBar } from './components/HeaderBar';
import { AgentStudio } from './components/AgentStudio';
import { SessionsDrawer } from './components/SessionsDrawer';
import { DevToolsDrawer } from './components/DevToolsDrawer';
import { SettingsDialog } from './components/SettingsDialog';
import { SkillsDrawer } from './components/SkillsDrawer';
import { UsageDialog } from './components/UsageDialog';
import { WorkspaceSessionsSidebar } from './components/WorkspaceSessionsSidebar';
import { Rune } from './components/Rune';
import { ChatMessage, AgentRunOptions, SessionSummary, ModelEntry, UpdateStatus, ToolCall, ContentBlock } from './types';
import { splitThinkingAndResponse, parseSessionTranscript } from './utils/textParser';
import * as AppApi from '../wailsjs/go/main/App';
import { EventsOn } from '../wailsjs/runtime/runtime';

export interface InstancePaneState {
  id: string; // Viewport ID: 'main', 'inst-2', etc.
  instanceId: string; // Dynamic Session/Instance ID currently mapped to this pane
  title: string;
  cwd: string;
  messages: ChatMessage[];
  sessionId: string;
  attachedFiles: string[];
  selectedModel: string;
  isWorking: boolean;
  fullSessionMessages?: ChatMessage[];
  displayedMessageCount?: number;
  taskId?: string;
  ticketId?: string;
}

export interface CachedSessionData {
  instanceId: string;
  sessionId: string;
  title: string;
  cwd: string;
  messages: ChatMessage[];
  attachedFiles: string[];
  selectedModel: string;
  isWorking: boolean;
  fullSessionMessages?: ChatMessage[];
  displayedMessageCount?: number;
  taskId?: string;
  ticketId?: string;
}

const DEFAULT_PANES: InstancePaneState[] = [
  { id: 'main', instanceId: 'main', title: 'OMP #1', cwd: '', messages: [], sessionId: '', attachedFiles: [], selectedModel: 'google-antigravity/gemini-3.8-flash', isWorking: false },
  { id: 'inst-2', instanceId: 'inst-2', title: 'OMP #2', cwd: '', messages: [], sessionId: '', attachedFiles: [], selectedModel: 'google-antigravity/gemini-3.8-flash', isWorking: false },
  { id: 'inst-3', instanceId: 'inst-3', title: 'OMP #3', cwd: '', messages: [], sessionId: '', attachedFiles: [], selectedModel: 'google-antigravity/gemini-3.8-flash', isWorking: false },
  { id: 'inst-4', instanceId: 'inst-4', title: 'OMP #4', cwd: '', messages: [], sessionId: '', attachedFiles: [], selectedModel: 'google-antigravity/gemini-3.8-flash', isWorking: false },
  { id: 'inst-5', instanceId: 'inst-5', title: 'OMP #5', cwd: '', messages: [], sessionId: '', attachedFiles: [], selectedModel: 'google-antigravity/gemini-3.8-flash', isWorking: false },
  { id: 'inst-6', instanceId: 'inst-6', title: 'OMP #6', cwd: '', messages: [], sessionId: '', attachedFiles: [], selectedModel: 'google-antigravity/gemini-3.8-flash', isWorking: false },
];

function applyStreamToMessages(msgs: ChatMessage[], streamType: string, content: string): ChatMessage[] {
  const copy = [...msgs];
  if (copy.length === 0 || copy[copy.length - 1].role !== 'assistant') {
    copy.push({
      id: 'asst_stream_' + Date.now(),
      role: 'assistant',
      text: '',
      timestamp: new Date().toISOString(),
      toolCalls: [],
      blocks: [],
      workingStatus: 'Çalışıyor...',
    });
  }
  const last = copy[copy.length - 1];
  const trimmed = content.trim();

  if (
    (streamType === 'stderr' && (trimmed.startsWith('Working') || trimmed.includes('Working...') || trimmed.includes('Still starting'))) ||
    trimmed === 'Working...' || trimmed === 'Working…'
  ) {
    copy[copy.length - 1] = {
      ...last,
      workingStatus: trimmed,
    };
    return copy;
  }

  if (streamType === 'thinking') {
    const currentBlocks = [...(last.blocks || [])];
    const lastBlock = currentBlocks[currentBlocks.length - 1];
    if (lastBlock && lastBlock.type === 'thinking') {
      currentBlocks[currentBlocks.length - 1] = {
        ...lastBlock,
        content: lastBlock.content + content,
      };
    } else {
      currentBlocks.push({
        id: 'blk_th_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
        type: 'thinking',
        content,
        timestamp: Date.now(),
      });
    }

    copy[copy.length - 1] = {
      ...last,
      thinking: (last.thinking || '') + content,
      blocks: currentBlocks,
      workingStatus: undefined,
    };
    return copy;
  }

  if (streamType === 'text') {
    const currentBlocks = [...(last.blocks || [])];
    const lastBlock = currentBlocks[currentBlocks.length - 1];
    if (lastBlock && lastBlock.type === 'text') {
      currentBlocks[currentBlocks.length - 1] = {
        ...lastBlock,
        content: lastBlock.content + content,
      };
    } else {
      currentBlocks.push({
        id: 'blk_tx_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
        type: 'text',
        content,
        timestamp: Date.now(),
      });
    }

    copy[copy.length - 1] = {
      ...last,
      text: (last.text || '') + content,
      blocks: currentBlocks,
      workingStatus: undefined,
    };
    return copy;
  }

  const prevText = last.text || '';
  let newText = prevText;
  let newThinking = last.thinking;
  const currentBlocks = [...(last.blocks || [])];

  if (content.includes('Thinking Process:')) {
    const parts = content.split('Thinking Process:');
    newThinking = (newThinking || '') + parts[1];
    newText = prevText + parts[0];
    if (parts[0]) {
      const lastB = currentBlocks[currentBlocks.length - 1];
      if (lastB && lastB.type === 'text') {
        currentBlocks[currentBlocks.length - 1] = { ...lastB, content: lastB.content + parts[0] };
      } else {
        currentBlocks.push({ id: 'blk_tx_' + Date.now(), type: 'text', content: parts[0], timestamp: Date.now() });
      }
    }
    if (parts[1]) {
      currentBlocks.push({ id: 'blk_th_' + Date.now(), type: 'thinking', content: parts[1], timestamp: Date.now() });
    }
  } else if (newThinking !== undefined && !content.includes('\n\n') && streamType === 'stdout') {
    newThinking += content;
    const lastB = currentBlocks[currentBlocks.length - 1];
    if (lastB && lastB.type === 'thinking') {
      currentBlocks[currentBlocks.length - 1] = { ...lastB, content: lastB.content + content };
    } else {
      currentBlocks.push({ id: 'blk_th_' + Date.now(), type: 'thinking', content, timestamp: Date.now() });
    }
  } else {
    newText = prevText + content;
    const lastB = currentBlocks[currentBlocks.length - 1];
    if (lastB && lastB.type === 'text') {
      currentBlocks[currentBlocks.length - 1] = { ...lastB, content: lastB.content + content };
    } else {
      currentBlocks.push({ id: 'blk_tx_' + Date.now(), type: 'text', content, timestamp: Date.now() });
    }
  }

  copy[copy.length - 1] = {
    ...last,
    text: newText,
    thinking: newThinking,
    blocks: currentBlocks,
    workingStatus: undefined,
  };
  return copy;
}

function applyDoneToMessages(msgs: ChatMessage[], exitCode: number): ChatMessage[] {
  if (msgs.length === 0) return msgs;
  const copy = [...msgs];
  const last = copy[copy.length - 1];
  if (last.role === 'assistant') {
    const split = splitThinkingAndResponse(last.text || '');
    const finalThinking = last.thinking || split.thinking || undefined;
    const finalResponse = split.response || last.text || '';
    copy[copy.length - 1] = {
      ...last,
      text: finalResponse,
      thinking: finalThinking,
      exitCode,
      workingStatus: undefined,
    };
  }
  return copy;
}

function applyToolStartToMessages(msgs: ChatMessage[], obj: Record<string, unknown>): ChatMessage[] {
  const copy = [...msgs];
  if (copy.length === 0 || copy[copy.length - 1].role !== 'assistant') {
    copy.push({
      id: 'asst_tool_' + Date.now(),
      role: 'assistant',
      text: '',
      timestamp: new Date().toISOString(),
      toolCalls: [],
      blocks: [],
      workingStatus: 'Araç çalıştırılıyor...',
    });
  }
  const last = copy[copy.length - 1];
  const callId = String(obj.toolCallId || 'tc_' + Math.random().toString(36).slice(2));
  const toolName = String(obj.toolName || 'tool');
  const intent = typeof obj.intent === 'string' ? obj.intent : undefined;
  const args = (obj.args as Record<string, unknown> | string) || undefined;

  const currentCalls = last.toolCalls || [];
  const existingIdx = currentCalls.findIndex((c) => c.id === callId);
  const now = Date.now();
  let updatedCalls: ToolCall[];
  if (existingIdx >= 0) {
    updatedCalls = [...currentCalls];
    updatedCalls[existingIdx] = {
      ...updatedCalls[existingIdx],
      tool: toolName,
      intent: intent || updatedCalls[existingIdx].intent,
      args: args || updatedCalls[existingIdx].args,
      status: 'running',
      timestamp: updatedCalls[existingIdx].timestamp || now,
    };
  } else {
    updatedCalls = [
      ...currentCalls,
      {
        id: callId,
        tool: toolName,
        intent,
        args,
        status: 'running',
        timestamp: now,
      },
    ];
  }

  const currentBlocks = [...(last.blocks || [])];
  const blockIdx = currentBlocks.findIndex((b) => b.type === 'tool' && b.call.id === callId);
  const activeCall: ToolCall = {
    id: callId,
    tool: toolName,
    intent: intent || (existingIdx >= 0 ? updatedCalls[existingIdx].intent : undefined),
    args: args || (existingIdx >= 0 ? updatedCalls[existingIdx].args : undefined),
    status: 'running',
    timestamp: existingIdx >= 0 && updatedCalls[existingIdx].timestamp ? updatedCalls[existingIdx].timestamp : now,
  };
  if (blockIdx >= 0) {
    const prevB = currentBlocks[blockIdx];
    if (prevB.type === 'tool') {
      currentBlocks[blockIdx] = {
        ...prevB,
        call: activeCall,
      };
    }
  } else {
    currentBlocks.push({
      id: 'blk_tl_' + callId,
      type: 'tool',
      call: activeCall,
      timestamp: now,
    });
  }

  copy[copy.length - 1] = {
    ...last,
    toolCalls: updatedCalls,
    blocks: currentBlocks,
  };
  return copy;
}

function applyToolUpdateToMessages(msgs: ChatMessage[], obj: Record<string, unknown>): ChatMessage[] {
  if (msgs.length === 0) return msgs;
  const callId = String(obj.toolCallId || '');
  if (!callId) return msgs;
  const copy = [...msgs];
  const last = copy[copy.length - 1];
  if (last.role !== 'assistant' || !last.toolCalls) return msgs;

  const partial = obj.partialResult as Record<string, unknown> | undefined;
  let resultText = '';
  if (partial && Array.isArray(partial.content)) {
    for (const item of partial.content) {
      if (item && typeof item === 'object' && 'text' in item) {
        resultText += String(item.text || '');
      }
    }
  }
  const details = (partial?.details as Record<string, unknown>) || (obj.details as Record<string, unknown>) || undefined;

  const updated = last.toolCalls.map((tc) => {
    if (tc.id === callId) {
      return {
        ...tc,
        result: resultText || tc.result,
        details: details || tc.details,
      };
    }
    return tc;
  });
  const currentBlocks = (last.blocks || []).map((b) => {
    if (b.type === 'tool' && b.call.id === callId) {
      return {
        ...b,
        call: {
          ...b.call,
          result: resultText || b.call.result,
          details: details || b.call.details,
        },
      };
    }
    return b;
  });
  copy[copy.length - 1] = {
    ...last,
    toolCalls: updated,
    blocks: currentBlocks,
  };
  return copy;
}

function applyToolEndToMessages(msgs: ChatMessage[], obj: Record<string, unknown>): ChatMessage[] {
  if (msgs.length === 0) return msgs;
  const callId = String(obj.toolCallId || '');
  if (!callId) return msgs;
  const copy = [...msgs];
  const last = copy[copy.length - 1];
  if (last.role !== 'assistant' || !last.toolCalls) return msgs;

  const isError = Boolean(obj.isError);
  const res = obj.result as Record<string, unknown> | undefined;
  let resultText = '';
  if (res && Array.isArray(res.content)) {
    for (const item of res.content) {
      if (item && typeof item === 'object' && 'text' in item) {
        resultText += String(item.text || '');
      }
    }
  }
  const details = (res?.details as Record<string, unknown>) || (obj.details as Record<string, unknown>) || undefined;

  const updated = last.toolCalls.map((tc) => {
    if (tc.id === callId) {
      return {
        ...tc,
        result: resultText || tc.result,
        details: details || tc.details,
        isError,
        status: 'completed' as const,
      };
    }
    return tc;
  });

  const currentBlocks = (last.blocks || []).map((b) => {
    if (b.type === 'tool' && b.call.id === callId) {
      return {
        ...b,
        call: {
          ...b.call,
          result: resultText || b.call.result,
          details: details || b.call.details,
          isError,
          status: 'completed' as const,
        },
      };
    }
    return b;
  });

  copy[copy.length - 1] = {
    ...last,
    toolCalls: updated,
    blocks: currentBlocks,
  };
  return copy;
}

function applyCommandToMessages(msgs: ChatMessage[], cmdStr: string): ChatMessage[] {
  if (msgs.length === 0) return msgs;
  const copy = [...msgs];
  const last = copy[copy.length - 1];
  if (last.role === 'assistant') {
    copy[copy.length - 1] = { ...last, command: cmdStr };
  }
  return copy;
}

export function App() {
  const [binaryVersion, setBinaryVersion] = useState('');
  const [cwd, setCwd] = useState('');
  const [profile, setProfile] = useState('');
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus | null>(null);
  const [availableModels, setAvailableModels] = useState<ModelEntry[]>([]);
  const [selectedModel, setSelectedModel] = useState('google-antigravity/gemini-3.8-flash');
  const [activeDrawer, setActiveDrawer] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [theme, setTheme] = useState<string>(() => localStorage.getItem('omp_theme') || 'cyber-violet');
  const [settingsTab, setSettingsTab] = useState<'general' | 'auth' | 'extra' | 'api' | 'plugins'>('general');

  // Focus Mode & Multi-Instance Panes State
  const [isFocusMode, setIsFocusMode] = useState<boolean>(() => {
    return localStorage.getItem('omp_focus_mode') === 'true';
  });
  const [splitCount, setSplitCount] = useState<number>(() => {
    const saved = localStorage.getItem('omp_split_count');
    const parsed = saved ? parseInt(saved, 10) : 1;
    return [1, 2, 4, 5, 6].includes(parsed) ? parsed : 1;
  });
  const [activePaneId, setActivePaneId] = useState<string>('main');
  const [panes, setPanes] = useState<InstancePaneState[]>(DEFAULT_PANES);
  const [runningInstances, setRunningInstances] = useState<string[]>([]);
  const sessionStore = React.useRef<Map<string, CachedSessionData>>(new Map());

  const updateSessionInStore = useCallback((instanceId: string, updater: (prev: CachedSessionData) => CachedSessionData) => {
    const current = sessionStore.current.get(instanceId);
    if (current) {
      sessionStore.current.set(instanceId, updater(current));
    }
  }, []);

  // Synchronize dynamic theme to document element
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('omp_theme', theme);
  }, [theme]);

  // Persist Focus Mode and Split Count
  useEffect(() => {
    localStorage.setItem('omp_focus_mode', String(isFocusMode));
  }, [isFocusMode]);

  useEffect(() => {
    localStorage.setItem('omp_split_count', String(splitCount));
  }, [splitCount]);
  // Active Memory Optimizer: Trim RAM working sets when window loses focus or is hidden
  useEffect(() => {
    const handleBlurOrHide = () => {
      AppApi.TrimMemory().catch(() => {});
    };
    window.addEventListener('blur', handleBlurOrHide);
    const handleVis = () => {
      if (document.hidden) {
        handleBlurOrHide();
      }
    };
    document.addEventListener('visibilitychange', handleVis);
    return () => {
      window.removeEventListener('blur', handleBlurOrHide);
      document.removeEventListener('visibilitychange', handleVis);
    };
  }, []);

  // Propagate default CWD & Model to initial panes
  useEffect(() => {
    if (cwd) {
      setPanes((prev) =>
        prev.map((p) => (!p.cwd ? { ...p, cwd } : p))
      );
    }
  }, [cwd]);

  useEffect(() => {
    if (selectedModel) {
      setPanes((prev) =>
        prev.map((p) => (!p.selectedModel ? { ...p, selectedModel } : p))
      );
    }
  }, [selectedModel]);

  // Initialize app data and event listeners
  useEffect(() => {
    // 1. Fetch Binary info
    AppApi.GetBinaryInfo()
      .then((info) => {
        if (info && info.version) {
          setBinaryVersion(info.version);
        }
        if (info && info.cwd) {
          setCwd(info.cwd);
          setPanes((prev) =>
            prev.map((p) => (!p.cwd ? { ...p, cwd: info.cwd } : p))
          );
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
            if (def) {
              setSelectedModel(def);
              setPanes((prev) =>
                prev.map((p) => (!p.selectedModel ? { ...p, selectedModel: def } : p))
              );
            }
          }
        } catch {}
      })
      .catch((err: unknown) => console.error('GetCurrentProfile err:', err));

    // 5. Setup Wails Event Listeners (Routed by instanceId)
    const unsubStatus = EventsOn('agent:status', (data: unknown) => {
      if (data && typeof data === 'object') {
        const obj = data as Record<string, unknown>;
        const targetId = (typeof obj.instanceId === 'string' && obj.instanceId) ? obj.instanceId : 'main';
        const running = obj.status === 'running';

        setRunningInstances((prev) => {
          const next = new Set(prev);
          if (running) next.add(targetId);
          else next.delete(targetId);
          return Array.from(next);
        });

        updateSessionInStore(targetId, (s) => ({ ...s, isWorking: running }));

        setPanes((prev) =>
          prev.map((p) =>
            (p.instanceId === targetId || p.id === targetId) ? { ...p, isWorking: running } : p
          )
        );
      }
    });

    const unsubStream = EventsOn('agent:stream', (data: unknown) => {
      if (!data || typeof data !== 'object') return;
      const obj = data as Record<string, unknown>;
      const targetId = (typeof obj.instanceId === 'string' && obj.instanceId) ? obj.instanceId : 'main';
      const streamType = typeof obj.type === 'string' ? obj.type : 'stdout';
      const content = typeof obj.content === 'string' ? obj.content : '';
      if (typeof obj.content !== 'string') return;

      const trimmed = content.trim();
      if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
        return;
      }

      updateSessionInStore(targetId, (s) => ({
        ...s,
        messages: applyStreamToMessages(s.messages, streamType, content),
      }));

      setPanes((prev) =>
        prev.map((pane) => {
          if (pane.instanceId !== targetId && pane.id !== targetId) return pane;
          return {
            ...pane,
            messages: applyStreamToMessages(pane.messages, streamType, content),
          };
        })
      );
    });

    const unsubCommand = EventsOn('agent:command', (data: unknown) => {
      if (data && typeof data === 'object') {
        const obj = data as Record<string, unknown>;
        const targetId = (typeof obj.instanceId === 'string' && obj.instanceId) ? obj.instanceId : 'main';
        const cmdStr = typeof obj.command === 'string' ? obj.command : '';
        updateSessionInStore(targetId, (s) => ({
          ...s,
          messages: applyCommandToMessages(s.messages, cmdStr),
        }));
        setPanes((prev) =>
          prev.map((pane) => {
            if (pane.instanceId !== targetId && pane.id !== targetId) return pane;
            return {
              ...pane,
              messages: applyCommandToMessages(pane.messages, cmdStr),
            };
          })
        );
      }
    });

    const unsubSession = EventsOn('agent:session', (data: unknown) => {
      if (data && typeof data === 'object') {
        const obj = data as Record<string, unknown>;
        const targetId = (typeof obj.instanceId === 'string' && obj.instanceId) ? obj.instanceId : 'main';
        const sessId = typeof obj.sessionId === 'string' ? obj.sessionId : '';
        if (sessId) {
          updateSessionInStore(targetId, (s) => ({ ...s, sessionId: sessId }));
          setPanes((prev) =>
            prev.map((p) =>
              (p.instanceId === targetId || p.id === targetId) ? { ...p, sessionId: sessId } : p
            )
          );
        }
      }
    });

    const unsubToolStart = EventsOn('agent:tool_start', (data: unknown) => {
      if (!data || typeof data !== 'object') return;
      const obj = data as Record<string, unknown>;
      const targetId = (typeof obj.instanceId === 'string' && obj.instanceId) ? obj.instanceId : 'main';
      updateSessionInStore(targetId, (s) => ({
        ...s,
        messages: applyToolStartToMessages(s.messages, obj),
      }));
      setPanes((prev) =>
        prev.map((pane) => {
          if (pane.instanceId !== targetId && pane.id !== targetId) return pane;
          return {
            ...pane,
            messages: applyToolStartToMessages(pane.messages, obj),
          };
        })
      );
    });

    const unsubToolUpdate = EventsOn('agent:tool_update', (data: unknown) => {
      if (!data || typeof data !== 'object') return;
      const obj = data as Record<string, unknown>;
      const targetId = (typeof obj.instanceId === 'string' && obj.instanceId) ? obj.instanceId : 'main';
      updateSessionInStore(targetId, (s) => ({
        ...s,
        messages: applyToolUpdateToMessages(s.messages, obj),
      }));
      setPanes((prev) =>
        prev.map((pane) => {
          if (pane.instanceId !== targetId && pane.id !== targetId) return pane;
          return {
            ...pane,
            messages: applyToolUpdateToMessages(pane.messages, obj),
          };
        })
      );
    });

    const unsubToolEnd = EventsOn('agent:tool_end', (data: unknown) => {
      if (!data || typeof data !== 'object') return;
      const obj = data as Record<string, unknown>;
      const targetId = (typeof obj.instanceId === 'string' && obj.instanceId) ? obj.instanceId : 'main';
      updateSessionInStore(targetId, (s) => ({
        ...s,
        messages: applyToolEndToMessages(s.messages, obj),
      }));
      setPanes((prev) =>
        prev.map((pane) => {
          if (pane.instanceId !== targetId && pane.id !== targetId) return pane;
          return {
            ...pane,
            messages: applyToolEndToMessages(pane.messages, obj),
          };
        })
      );
    });

    const unsubDone = EventsOn('agent:done', (data: unknown) => {
      if (data && typeof data === 'object') {
        const obj = data as Record<string, unknown>;
        const targetId = (typeof obj.instanceId === 'string' && obj.instanceId) ? obj.instanceId : 'main';
        const exitCode = typeof obj.exitCode === 'number' ? obj.exitCode : 0;
        const sessId = typeof obj.sessionId === 'string' ? obj.sessionId : '';

        setRunningInstances((prev) => prev.filter((id) => id !== targetId));

        updateSessionInStore(targetId, (s) => ({
          ...s,
          isWorking: false,
          sessionId: sessId || s.sessionId,
          messages: applyDoneToMessages(s.messages, exitCode),
        }));

        setPanes((prev) =>
          prev.map((pane) => {
            if (pane.instanceId !== targetId && pane.id !== targetId) return pane;
            return {
              ...pane,
              isWorking: false,
              sessionId: sessId || pane.sessionId,
              messages: applyDoneToMessages(pane.messages, exitCode),
            };
          })
        );
      }
    });

    const unsubUpdateStatus = EventsOn('update:status', (data: unknown) => {
      if (data && typeof data === 'object') {
        setUpdateStatus(data as UpdateStatus);
      }
    });
    const unsubTaskStarted = EventsOn('remote_api:task_started', (data: unknown) => {
      if (!data || typeof data !== 'object') return;
      const obj = data as Record<string, unknown>;
      const targetId = (typeof obj.instanceId === 'string' && obj.instanceId) ? obj.instanceId : 'main';
      const promptText = typeof obj.prompt === 'string' ? obj.prompt : '';
      const taskCwd = typeof obj.cwd === 'string' ? obj.cwd : '';
      const rawTaskId = obj.taskId || obj.referenceId || obj.ticketId;
      const taskId = rawTaskId ? String(rawTaskId) : '';
      const ticketId = taskId;
      const company = typeof obj.company === 'string' ? obj.company : '';

      // Automatically switch to the active pane & close any open drawer to show session in chat
      setActivePaneId(targetId);
      setActiveDrawer(null);
      if (taskCwd) {
        setCwd(taskCwd);
      }

      const userMsg: ChatMessage = {
        id: 'usr_remote_' + Date.now(),
        role: 'user',
        text: promptText,
        timestamp: new Date().toISOString(),
      };

      const titlePrefix = taskId ? `Görev #${taskId}` : (company ? `${company}` : 'Uzak Görev');
      const assistantMsg: ChatMessage = {
        id: 'asst_remote_' + Date.now(),
        role: 'assistant',
        text: '',
        timestamp: new Date().toISOString(),
        toolCalls: [],
        blocks: [],
        workingStatus: taskId ? `Görev #${taskId} devralındı, çalışıyor...` : 'Uzak görev devralındı, çalışıyor...',
      };
      setRunningInstances((prev) => {
        const next = new Set(prev);
        next.add(targetId);
        return Array.from(next);
      });

      updateSessionInStore(targetId, (s) => ({
        ...s,
        title: titlePrefix,
        cwd: taskCwd || s.cwd,
        taskId: taskId || s.taskId,
        ticketId: taskId || s.ticketId,
        messages: [...s.messages, userMsg, assistantMsg],
        isWorking: true,
      }));

      setPanes((prev) =>
        prev.map((p) => {
          if (p.id !== targetId && p.instanceId !== targetId) return p;
          return {
            ...p,
            cwd: taskCwd || p.cwd,
            title: titlePrefix,
            taskId: taskId || p.taskId,
            ticketId: taskId || p.ticketId,
            messages: [...p.messages, userMsg, assistantMsg],
            attachedFiles: [],
            isWorking: true,
          };
        })
      );
    });


    return () => {
      unsubStatus();
      unsubStream();
      unsubCommand();
      unsubSession();
      unsubToolStart();
      unsubToolUpdate();
      unsubToolEnd();
      unsubDone();
      unsubUpdateStatus();
      unsubTaskStarted();
    };
  }, []);

  // Global active pane
  const activePane = useMemo(() => {
    return panes.find((p) => p.id === activePaneId) || panes[0];
  }, [panes, activePaneId]);

  const isAnyWorking = useMemo(() => {
    return panes.some((p) => p.isWorking);
  }, [panes]);

  // Layout Grid Class Helper
  const getGridClass = (count: number) => {
    switch (count) {
      case 2:
        return 'grid grid-cols-1 md:grid-cols-2 grid-rows-1';
      case 4:
        return 'grid grid-cols-1 md:grid-cols-2 grid-rows-2';
      case 5:
        return 'grid grid-cols-6 grid-rows-2';
      case 6:
        return 'grid grid-cols-1 md:grid-cols-3 grid-rows-2';
      default:
        return 'grid grid-cols-1 grid-rows-1';
    }
  };

  const getPaneColSpan = (count: number, index: number) => {
    if (count === 5) {
      return index < 2 ? 'col-span-3' : 'col-span-2';
    }
    return '';
  };

  // Directory Selection
  const handleSelectCwd = async () => {
    try {
      const selected = await AppApi.SelectDirectory();
      if (selected) {
        setCwd(selected);
        setPanes((prev) =>
          prev.map((p) => (p.id === activePaneId || !p.cwd ? { ...p, cwd: selected } : p))
        );
      }
    } catch (err: unknown) {
      console.error('SelectDirectory err:', err);
    }
  };

  const handleSelectPaneCwd = async (paneId: string) => {
    try {
      const selected = await AppApi.SelectDirectory();
      if (selected) {
        setPanes((prev) =>
          prev.map((p) => (p.id === paneId ? { ...p, cwd: selected } : p))
        );
        if (paneId === 'main' || paneId === activePaneId) {
          setCwd(selected);
        }
      }
    } catch (err: unknown) {
      console.error('SelectDirectory err:', err);
    }
  };

  // Attachments per pane
  const handleSelectPaneFiles = async (paneId: string) => {
    try {
      const files = await AppApi.SelectFiles();
      if (files && files.length > 0) {
        setPanes((prev) =>
          prev.map((p) =>
            p.id === paneId ? { ...p, attachedFiles: [...p.attachedFiles, ...files] } : p
          )
        );
      }
    } catch (err: unknown) {
      console.error('SelectFiles err:', err);
    }
  };

  const handleRemovePaneFile = (paneId: string, index: number) => {
    setPanes((prev) =>
      prev.map((p) =>
        p.id === paneId
          ? { ...p, attachedFiles: p.attachedFiles.filter((_, i) => i !== index) }
          : p
      )
    );
  };

  const handleAddPaneFile = useCallback((paneId: string, path: string) => {
    setPanes((prev) =>
      prev.map((p) =>
        p.id === paneId
          ? {
              ...p,
              attachedFiles: p.attachedFiles.includes(path)
                ? p.attachedFiles
                : [...p.attachedFiles, path],
            }
          : p
      )
    );
  }, []);

  const handleAddPaneSystemMessage = useCallback((paneId: string, msg: ChatMessage) => {
    setPanes((prev) =>
      prev.map((p) => (p.id === paneId ? { ...p, messages: [...p.messages, msg] } : p))
    );
  }, []);

  // Execution per pane
  const handleSendMessage = async (opts: AgentRunOptions, paneId: string = 'main') => {
    const currentPane = panes.find((p) => p.id === paneId);
    const targetInstId = currentPane?.instanceId || paneId;
    const targetSessionId = opts.sessionId || currentPane?.sessionId || '';
    const targetCwd = opts.cwd || currentPane?.cwd || cwd;

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
      toolCalls: [],
      blocks: [],
    };

    updateSessionInStore(targetInstId, (s) => ({
      ...s,
      messages: [...s.messages, userMsg, assistantMsgPlaceholder],
      attachedFiles: [],
      isWorking: true,
      cwd: targetCwd,
      sessionId: targetSessionId || s.sessionId,
    }));

    setRunningInstances((prev) => {
      const next = new Set(prev);
      next.add(targetInstId);
      return Array.from(next);
    });

    setPanes((prev) =>
      prev.map((p) => {
        if (p.id !== paneId && p.instanceId !== targetInstId) return p;
        return {
          ...p,
          messages: [...p.messages, userMsg, assistantMsgPlaceholder],
          attachedFiles: [],
          isWorking: true,
          cwd: targetCwd,
          sessionId: targetSessionId || p.sessionId,
        };
      })
    );

    try {
      await AppApi.ExecuteAgent({
        ...opts,
        instanceId: targetInstId,
        sessionId: targetSessionId,
        cwd: targetCwd,
      });
    } catch (err: unknown) {
      console.error('ExecuteAgent err:', err);
      const errMsg: ChatMessage = {
        id: 'err_' + Date.now(),
        role: 'system',
        text: 'Hata: ' + String(err),
        timestamp: new Date().toISOString(),
      };
      updateSessionInStore(targetInstId, (s) => ({
        ...s,
        messages: [...s.messages, errMsg],
        isWorking: false,
      }));
      setPanes((prev) =>
        prev.map((p) => {
          if (p.id !== paneId && p.instanceId !== targetInstId) return p;
          return {
            ...p,
            messages: [...p.messages, errMsg],
            isWorking: false,
          };
        })
      );
      setRunningInstances((prev) => prev.filter((id) => id !== targetInstId));
    }
  };

  const handleStopAgent = async (paneId: string = 'main') => {
    const currentPane = panes.find((p) => p.id === paneId);
    const targetInstId = currentPane?.instanceId || paneId;
    try {
      await AppApi.StopAgentInstance(targetInstId);
      updateSessionInStore(targetInstId, (s) => ({ ...s, isWorking: false }));
      setPanes((prev) =>
        prev.map((p) => (p.id === paneId || p.instanceId === targetInstId ? { ...p, isWorking: false } : p))
      );
      setRunningInstances((prev) => prev.filter((id) => id !== targetInstId));
    } catch (err: unknown) {
      console.error('StopAgent err:', err);
    }
  };

  const handleSendStdin = async (input: string, paneId: string = 'main') => {
    const currentPane = panes.find((p) => p.id === paneId);
    const targetInstId = currentPane?.instanceId || paneId;
    try {
      await AppApi.SendStdinInstance(targetInstId, input);
    } catch (err: unknown) {
      console.error('SendStdin err:', err);
    }
  };

  const handleClearPaneConsole = (paneId: string) => {
    const currentPane = panes.find((p) => p.id === paneId);
    const targetInstId = currentPane?.instanceId || paneId;
    updateSessionInStore(targetInstId, (s) => ({ ...s, messages: [], sessionId: '' }));
    setPanes((prev) =>
      prev.map((p) => (p.id === paneId ? { ...p, messages: [], sessionId: '' } : p))
    );
    AppApi.ClearActiveSessionInstance(targetInstId).catch(() => {});
  };

  const handleSelectPaneModel = (paneId: string, model: string) => {
    setPanes((prev) =>
      prev.map((p) => (p.id === paneId ? { ...p, selectedModel: model } : p))
    );
    if (paneId === activePaneId) {
      setSelectedModel(model);
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
    const targetPaneId = activePaneId || 'main';
    const currentPane = panes.find((p) => p.id === targetPaneId);

    const targetInstId = 'sess_' + session.id;

    // If already showing this session in this pane, just update cwd/model if needed and return
    if (currentPane && (currentPane.instanceId === targetInstId || (currentPane.sessionId === session.id && session.id !== ''))) {
      if (session.cwd) setCwd(session.cwd);
      if (session.model) setSelectedModel(session.model);
      return;
    }

    // 1. Save state of current session in this pane before switching away
    if (currentPane) {
      const prevInstId = currentPane.instanceId || currentPane.id;
      sessionStore.current.set(prevInstId, {
        instanceId: prevInstId,
        sessionId: currentPane.sessionId,
        title: currentPane.title,
        cwd: currentPane.cwd,
        messages: currentPane.messages,
        attachedFiles: currentPane.attachedFiles,
        selectedModel: currentPane.selectedModel,
        isWorking: currentPane.isWorking,
        fullSessionMessages: currentPane.fullSessionMessages,
        displayedMessageCount: currentPane.displayedMessageCount,
        taskId: currentPane.taskId,
        ticketId: currentPane.ticketId,
      });

      // If previous session is idle (prompt can be typed), close its backend instance
      if (!currentPane.isWorking) {
        AppApi.StopAgentInstance(prevInstId).catch(() => {});
      }
    }

    if (session.cwd) {
      setCwd(session.cwd);
    }
    if (session.model) {
      setSelectedModel(session.model);
    }

    // 2. Check if target session is already in memory store (e.g. running in background or previously visited)
    const existing = sessionStore.current.get(targetInstId);
    if (existing) {
      setPanes((prev) =>
        prev.map((p) =>
          p.id === targetPaneId
            ? {
                ...p,
                instanceId: existing.instanceId,
                sessionId: existing.sessionId || session.id,
                title: existing.title || session.title || 'Oturum',
                cwd: existing.cwd || session.cwd || cwd,
                messages: existing.messages,
                attachedFiles: existing.attachedFiles || [],
                selectedModel: existing.selectedModel || session.model || selectedModel,
                isWorking: existing.isWorking,
                fullSessionMessages: existing.fullSessionMessages,
                displayedMessageCount: existing.displayedMessageCount,
                taskId: existing.taskId,
                ticketId: existing.ticketId,
              }
            : p
        )
      );
      AppApi.SetActiveSessionIDInstance(targetInstId, session.id).catch(() => {});
      return;
    }

    // 3. Not in memory: load transcript from disk
    let initialMessages: ChatMessage[] = [];
    let parsedMsgs: ChatMessage[] = [];
    let initialCount = 0;

    try {
      const detail = await AppApi.GetSessionDetail(session.path);
      if (detail && detail.messages && detail.messages.length > 0) {
        parsedMsgs = parseSessionTranscript(detail.messages);
        if (parsedMsgs.length > 0) {
          const PAGE_SIZE = 25;
          const total = parsedMsgs.length;
          initialCount = Math.min(PAGE_SIZE, total);
          initialMessages = parsedMsgs.slice(total - initialCount);
        }
      }
    } catch (e) {
      console.warn('Could not load session transcript messages:', e);
    }

    if (initialMessages.length === 0) {
      initialMessages = [
        {
          id: 'sys_' + Date.now(),
          role: 'system',
          text: `Oturum yüklendi: ${session.title || session.id} (${session.id})`,
          timestamp: new Date().toISOString(),
        },
      ];
    }

    const newCachedData: CachedSessionData = {
      instanceId: targetInstId,
      sessionId: session.id,
      title: session.title || 'Oturum',
      cwd: session.cwd || cwd,
      messages: initialMessages,
      attachedFiles: [],
      selectedModel: session.model || selectedModel,
      isWorking: false,
      fullSessionMessages: parsedMsgs,
      displayedMessageCount: initialCount,
    };
    sessionStore.current.set(targetInstId, newCachedData);

    setPanes((prev) =>
      prev.map((p) =>
        p.id === targetPaneId
          ? {
              ...p,
              instanceId: targetInstId,
              sessionId: session.id,
              title: session.title || p.title,
              cwd: session.cwd || p.cwd || cwd,
              messages: initialMessages,
              attachedFiles: [],
              selectedModel: session.model || p.selectedModel || selectedModel,
              isWorking: false,
              fullSessionMessages: parsedMsgs,
              displayedMessageCount: initialCount,
            }
          : p
      )
    );

    AppApi.SetActiveSessionIDInstance(targetInstId, session.id).catch(() => {});
  };

  const handleNewSession = () => {
    const targetPaneId = activePaneId || 'main';
    const currentPane = panes.find((p) => p.id === targetPaneId);

    // Save state of current session before switching away
    if (currentPane) {
      const prevInstId = currentPane.instanceId || currentPane.id;
      sessionStore.current.set(prevInstId, {
        instanceId: prevInstId,
        sessionId: currentPane.sessionId,
        title: currentPane.title,
        cwd: currentPane.cwd,
        messages: currentPane.messages,
        attachedFiles: currentPane.attachedFiles,
        selectedModel: currentPane.selectedModel,
        isWorking: currentPane.isWorking,
        fullSessionMessages: currentPane.fullSessionMessages,
        displayedMessageCount: currentPane.displayedMessageCount,
        taskId: currentPane.taskId,
        ticketId: currentPane.ticketId,
      });

      // Close idle instance if not working
      if (!currentPane.isWorking) {
        AppApi.StopAgentInstance(prevInstId).catch(() => {});
      }
    }

    const newInstId = 'inst_new_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
    const newSessionData: CachedSessionData = {
      instanceId: newInstId,
      sessionId: '',
      title: 'Yeni Oturum',
      cwd: cwd,
      messages: [],
      attachedFiles: [],
      selectedModel: selectedModel,
      isWorking: false,
      fullSessionMessages: [],
      displayedMessageCount: 0,
    };
    sessionStore.current.set(newInstId, newSessionData);

    setPanes((prev) =>
      prev.map((p) =>
        p.id === targetPaneId
          ? {
              ...p,
              instanceId: newInstId,
              title: 'Yeni Oturum',
              messages: [],
              attachedFiles: [],
              sessionId: '',
              fullSessionMessages: [],
              displayedMessageCount: 0,
              isWorking: false,
            }
          : p
      )
    );
    AppApi.ClearActiveSessionInstance(newInstId).catch(() => {});
  };
  const handleLoadOlderMessages = useCallback((paneId: string) => {
    setPanes((prev) =>
      prev.map((p) => {
        if (p.id !== paneId) return p;
        const full = p.fullSessionMessages;
        if (!full || full.length === 0) return p;
        const currentCount = p.displayedMessageCount || p.messages.length;
        if (currentCount >= full.length) return p;

        const PAGE_SIZE = 25;
        const newCount = Math.min(full.length, currentCount + PAGE_SIZE);
        const sliced = full.slice(full.length - newCount);

        return {
          ...p,
          messages: sliced,
          displayedMessageCount: newCount,
        };
      })
    );
  }, []);

  // Handled in handleNewSession above

  const handleToggleDrawer = (drawerName: string) => {
    setActiveDrawer((prev) => (prev === drawerName ? null : drawerName));
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
      console.error(e);
    }
  };

  // Keyboard Shortcuts
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

      // Ctrl + Shift + F: Toggle Focus Mode
      if (isCmdOrCtrl && e.shiftKey && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        setIsFocusMode((prev) => !prev);
        return;
      }

      // Ctrl + N: New Session in active pane
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
  }, [activeDrawer, activePaneId]);

  return (
    <div className={`flex flex-col h-screen w-screen bg-omp-bg text-omp-text overflow-hidden font-sans ${isFocusMode ? 'p-0' : 'p-2 sm:p-2.5 md:p-3'}`}>
      {/* Framed Application Window */}
      <div className={`flex flex-col flex-1 h-full w-full ${isFocusMode ? 'border-0 rounded-none' : 'border border-omp-border rounded-[3px] shadow-2xl'} bg-omp-surface overflow-hidden relative`}>
        {/* Top Bar: Minimal Focus Bar or Full Swiss HeaderBar */}
        {isFocusMode ? (
          <header className="h-10 border-b border-omp-border bg-omp-surface px-3 flex items-center justify-between select-none shrink-0 font-mono text-xs z-10">
            {/* LEFT: Dizin Seçme Butonu */}
            <div className="flex items-center space-x-2.5 truncate">
              <div className="w-6 h-6 bg-omp-accent text-white flex items-center justify-center font-bold text-xs rounded-[2px] shadow-xs shrink-0">
                π
              </div>
              <button
                onClick={handleSelectCwd}
                title={activePane.cwd || cwd || 'Çalışma dizini seç'}
                className="flex items-center space-x-1.5 text-xs px-2.5 py-1 bg-omp-bg hover:bg-omp-surfaceLight border border-omp-border text-omp-text transition-colors truncate max-w-[280px] rounded-[2px] cursor-pointer"
              >
                <Rune name="documents-folder" size={13} className="text-omp-accent shrink-0" />
                <span className="truncate font-mono text-[11px] font-bold text-white">
                  DIR: {(activePane.cwd || cwd) ? (activePane.cwd || cwd).split('\\').pop() || (activePane.cwd || cwd).split('/').pop() || (activePane.cwd || cwd) : 'Dizin Seç'}
                </span>
              </button>
              <span className="text-[10px] text-omp-muted uppercase tracking-wider hidden sm:inline">
                ODAK // {activePane.title}
              </span>
            </div>

            {/* CENTER: Split Grid Switcher (1, 2, 4, 5, 6 Panes) */}
            <div className="flex items-center space-x-1 bg-omp-bg p-0.5 border border-omp-border rounded-[2px]">
              {[1, 2, 4, 5, 6].map((num) => (
                <button
                  key={num}
                  onClick={() => setSplitCount(num)}
                  className={`px-2 py-0.5 text-[10px] font-mono rounded-[2px] transition cursor-pointer ${
                    splitCount === num
                      ? 'bg-omp-accent text-white font-bold shadow-xs'
                      : 'text-omp-muted hover:text-white hover:bg-omp-surfaceLight'
                  }`}
                  title={`${num} Ajan / Instance Split`}
                >
                  {num}P
                </button>
              ))}
            </div>

            {/* RIGHT: Odaktan Çık Butonu */}
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setIsFocusMode(false)}
                title="Odak Modundan Çık (Ctrl+Shift+F)"
                className="flex items-center space-x-1.5 px-2.5 py-1 rounded-[2px] border border-omp-border hover:border-red-500/50 bg-omp-bg hover:bg-red-500/10 text-omp-muted hover:text-red-300 font-mono text-[11px] transition cursor-pointer"
              >
                <Rune name="indicators-x" size={12} />
                <span className="font-bold text-[10px]">ODAKTAN ÇIK</span>
              </button>
            </div>
          </header>
        ) : (
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
            isWorking={isAnyWorking}
            isSidebarOpen={isSidebarOpen}
            onToggleSidebar={() => setIsSidebarOpen((prev) => !prev)}
            theme={theme}
            onSelectTheme={setTheme}
            isFocusMode={isFocusMode}
            onToggleFocusMode={() => setIsFocusMode(true)}
            splitCount={splitCount}
            onSelectSplitCount={setSplitCount}
          />
        )}

        {/* Main Workspace (Workspace Sessions Sidebar + Split Agent Studio Panes) */}
        <div className="flex-1 flex overflow-hidden relative">
          {/* Workspace-based Sessions Sidebar (Only in Normal Mode) */}
          {!isFocusMode && (
            <WorkspaceSessionsSidebar
              isOpen={isSidebarOpen}
              onToggle={() => setIsSidebarOpen(false)}
              currentCwd={cwd}
              onResumeSession={handleResumeSession}
              onNewSession={handleNewSession}
              runningInstances={runningInstances}
            />
          )}

          {/* Panes Grid: Supports 1, 2, 4, 5, 6 OMP Instances */}
          <div className={`flex-1 ${getGridClass(splitCount)} overflow-hidden gap-1 p-1 bg-omp-bg min-h-0 min-w-0`}>
            {panes.slice(0, splitCount).map((pane, idx) => (
              <div
                key={pane.id}
                onClick={() => setActivePaneId(pane.id)}
                className={`flex flex-col h-full min-h-0 min-w-0 border rounded-[2px] overflow-hidden transition-all ${
                  getPaneColSpan(splitCount, idx)
                } ${
                  activePaneId === pane.id
                    ? 'border-omp-accent/80 shadow-md ring-1 ring-pink-400/30'
                    : 'border-omp-border bg-omp-surface'
                }`}
              >
                <AgentStudio
                  instanceId={pane.instanceId || pane.id}
                  title={splitCount > 1 ? `${pane.title} (${(pane.cwd || cwd || '').split('\\').pop() || (pane.cwd || cwd || '').split('/').pop() || 'cwd'})` : 'OH-MY-PI // STUDIO'}
                  isFocusMode={isFocusMode}
                  isActivePane={activePaneId === pane.id}
                  isSplit={splitCount > 1}
                  onFocusPane={() => setActivePaneId(pane.id)}
                  profile={profile}
                  messages={pane.messages}
                  sessionId={pane.sessionId}
                  isWorking={pane.isWorking}
                  onSendMessage={(opts) => handleSendMessage(opts, pane.id)}
                  onStopAgent={() => handleStopAgent(pane.id)}
                  onSendStdin={(input) => handleSendStdin(input, pane.id)}
                  cwd={pane.cwd || cwd}
                  onSelectCwd={() => handleSelectPaneCwd(pane.id)}
                  onSelectFiles={() => handleSelectPaneFiles(pane.id)}
                  attachedFiles={pane.attachedFiles}
                  onRemoveFile={(fileIdx) => handleRemovePaneFile(pane.id, fileIdx)}
                  onAddFile={(path) => handleAddPaneFile(pane.id, path)}
                  availableModels={availableModels}
                  selectedModel={pane.selectedModel || selectedModel}
                  onSelectModel={(m) => handleSelectPaneModel(pane.id, m)}
                  onClearConsole={() => handleClearPaneConsole(pane.id)}
                  onOpenUsage={() => setActiveDrawer('usage')}
                  onOpenSkills={() => setActiveDrawer('skills')}
                  onOpenSessions={() => setActiveDrawer('sessions')}
                  onOpenSettings={(tab) => {
                    if (tab) setSettingsTab(tab);
                    setActiveDrawer('settings');
                  }}
                  onAddSystemMessage={(msg) => handleAddPaneSystemMessage(pane.id, msg)}
                  onOpenDevTools={() => setActiveDrawer('devtools')}
                  taskId={pane.taskId || pane.ticketId}
                  ticketId={pane.ticketId || pane.taskId}
                  totalSessionMessages={pane.fullSessionMessages?.length || pane.messages.length}
                  onLoadOlderMessages={() => handleLoadOlderMessages(pane.id)}
                />
              </div>
            ))}
          </div>

          {/* Collapsible Drawers (Only in Normal Mode) */}
          {!isFocusMode && (
            <>
              <SessionsDrawer
                isOpen={activeDrawer === 'sessions'}
                onClose={() => setActiveDrawer(null)}
                onResumeSession={handleResumeSession}
                runningInstances={runningInstances}
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
                initialTab={settingsTab}
              />
              <SkillsDrawer
                isOpen={activeDrawer === 'skills'}
                onClose={() => setActiveDrawer(null)}
              />
              <UsageDialog
                isOpen={activeDrawer === 'usage'}
                onClose={() => setActiveDrawer(null)}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
