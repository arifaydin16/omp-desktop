import React, { useState, useRef, useEffect, useMemo } from 'react';
import { 
  Send, 
  Square, 
  Paperclip, 
  BrainCircuit, 
  Check, 
  X, 
  Wrench, 
  Sparkles, 
  Sliders,
  Copy,
  CheckCheck,
  RefreshCw,
  Shield,
  Cpu
} from 'lucide-react';
import { ChatMessage, AgentRunOptions, ModelEntry } from '../types';
import { splitThinkingAndResponse } from '../utils/textParser';
import { ParametersDialog } from './ParametersDialog';
import { RoleAssignmentModal } from './RoleAssignmentModal';
import * as AppApi from '../../wailsjs/go/main/App';

interface AgentStudioProps {
  messages: ChatMessage[];
  isWorking: boolean;
  onSendMessage: (opts: AgentRunOptions) => void;
  onStopAgent: () => void;
  onSendStdin: (input: string) => void;
  cwd: string;
  onSelectCwd: () => void;
  onSelectFiles: () => void;
  attachedFiles: string[];
  onRemoveFile: (index: number) => void;
  onAddFile: (path: string) => void;
  availableModels: ModelEntry[];
  selectedModel: string;
  onSelectModel: (m: string) => void;
  onClearConsole?: () => void;
  onOpenRoleWizard?: () => void;
}

export const AgentStudio: React.FC<AgentStudioProps> = ({
  messages,
  isWorking,
  onSendMessage,
  onStopAgent,
  onSendStdin,
  cwd,
  onSelectFiles,
  attachedFiles,
  onRemoveFile,
  onAddFile,
  availableModels,
  selectedModel,
  onSelectModel,
  onClearConsole,
  onOpenRoleWizard,
}) => {
  const [prompt, setPrompt] = useState('');
  const [showParamsDialog, setShowParamsDialog] = useState(false);
  const [showRoleWizard, setShowRoleWizard] = useState(false);
  const [currentRoles, setCurrentRoles] = useState<Record<string, string>>({});

  const loadStudioRoles = async () => {
    try {
      const r = await AppApi.GetModelRoles();
      setCurrentRoles(r || {});
    } catch (err) {
      console.error('Failed to load roles in studio:', err);
    }
  };

  useEffect(() => {
    loadStudioRoles();
  }, []);

  const handleSaveStudioRole = async (role: string, modelWithThinking: string) => {
    try {
      await AppApi.SetModelRole(role, modelWithThinking);
      if (role === 'default') {
        const base = modelWithThinking.split(':')[0];
        if (base) onSelectModel(base);
      }
      loadStudioRoles();
    } catch (err) {
      console.error('Failed to save role from studio:', err);
    }
  };

  const [smolModel, setSmolModel] = useState('');
  const [slowModel, setSlowModel] = useState('');
  const [planModel, setPlanModel] = useState('');
  const [advisorModel, setAdvisorModel] = useState('');
  const [thinkingLevel, setThinkingLevel] = useState('auto');
  const [approvalMode, setApprovalMode] = useState('write');
  const [autoApprove, setAutoApprove] = useState(false);
  const [goalMode, setGoalMode] = useState(false);
  const [planYolo, setPlanYolo] = useState(false);
  const [prewalk, setPrewalk] = useState(false);
  const [advisor, setAdvisor] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  // Slash Command Autocomplete State
  const [skillsList, setSkillsList] = useState<Array<{ name: string; description: string }>>([]);
  const [selectedCmdIndex, setSelectedCmdIndex] = useState(0);

  useEffect(() => {
    AppApi.GetSkillsList()
      .then((res) => {
        if (res) setSkillsList(res);
      })
      .catch(console.error);
  }, []);

  useEffect(() => {
    setSelectedCmdIndex(0);
  }, [prompt]);

  interface CommandItem {
    id: string;
    name: string;
    fullCmd: string;
    glyph: string;
    glyphColor: string;
    description: string;
    onSelect?: () => void;
  }

  const baseCommands: CommandItem[] = useMemo(() => [
    {
      id: 'skill',
      name: 'skill:',
      fullCmd: '/skill:',
      glyph: '✦',
      glyphColor: 'text-cyan-400',
      description: `${skillsList.length || 31} skills`,
    },
    {
      id: 'compact',
      name: 'compact',
      fullCmd: '/compact',
      glyph: 'G',
      glyphColor: 'text-purple-400 font-bold',
      description: 'Compact: context summary',
    },
    {
      id: 'usage',
      name: 'usage',
      fullCmd: '/usage',
      glyph: '⚡',
      glyphColor: 'text-amber-400',
      description: 'Show provider usage and limits',
    },
    {
      id: 'btw',
      name: 'btw',
      fullCmd: '/btw',
      glyph: '?',
      glyphColor: 'text-red-400 font-bold',
      description: "Ask a side question, or browse this session's BTW history",
    },
    {
      id: 'model',
      name: 'model',
      fullCmd: '/model',
      glyph: '⬡',
      glyphColor: 'text-blue-400',
      description: `Model: ${selectedModel.split('/').pop() || 'gemini-3.8-flash'}`,
    },
    {
      id: 'resume',
      name: 'resume',
      fullCmd: '/resume',
      glyph: '🕒',
      glyphColor: 'text-zinc-300',
      description: 'Resume a different session',
    },
    {
      id: 'changelog',
      name: 'changelog',
      fullCmd: '/changelog',
      glyph: '📰',
      glyphColor: 'text-zinc-300',
      description: 'Show changelog entries',
    },
    {
      id: 'advisor',
      name: 'advisor',
      fullCmd: '/advisor',
      glyph: '👁',
      glyphColor: 'text-rose-400',
      description: `Advisor: ${advisor ? 'on' : 'off'} (${selectedModel.split('/').pop() || ''})`,
    },
    {
      id: 'loop',
      name: 'loop',
      fullCmd: '/loop',
      glyph: '↺',
      glyphColor: 'text-emerald-400',
      description: 'Loop: off',
    },
    {
      id: 'new',
      name: 'new',
      fullCmd: '/new',
      glyph: '+',
      glyphColor: 'text-emerald-400 font-bold text-sm',
      description: 'Start a new session',
    },
    {
      id: 'clear',
      name: 'clear',
      fullCmd: '/clear',
      glyph: '🗑',
      glyphColor: 'text-red-400',
      description: 'Clear conversation messages',
    },
    {
      id: 'stats',
      name: 'stats',
      fullCmd: '/stats',
      glyph: '📊',
      glyphColor: 'text-yellow-400',
      description: 'View usage statistics and token costs',
    },
    {
      id: 'help',
      name: 'help',
      fullCmd: '/help',
      glyph: 'ℹ',
      glyphColor: 'text-cyan-400',
      description: 'Show available commands and usage flags',
    },
  ], [skillsList, selectedModel, advisor]);

  const filteredCommands: CommandItem[] = useMemo(() => {
    if (!prompt.startsWith('/')) return [];
    const query = prompt.toLowerCase().trim();

    if (query.startsWith('/skill:')) {
      const skillQuery = query.slice(7);
      return skillsList
        .filter((s) => !skillQuery || s.name.toLowerCase().includes(skillQuery))
        .map((s) => ({
          id: `skill-${s.name}`,
          name: `skill:${s.name}`,
          fullCmd: `/skill:${s.name}`,
          glyph: '✦',
          glyphColor: 'text-cyan-400',
          description: s.description || 'Skill yönergesi',
        }));
    }

    const commandQuery = query.slice(1);
    return baseCommands.filter((cmd) => {
      if (!commandQuery) return true;
      return cmd.name.toLowerCase().includes(commandQuery) || cmd.description.toLowerCase().includes(commandQuery);
    });
  }, [prompt, baseCommands, skillsList]);

  const selectCommand = (cmd: CommandItem) => {
    if (cmd.id === 'clear') {
      if (onClearConsole) onClearConsole();
      setPrompt('');
      return;
    }
    if (cmd.id === 'new') {
      if (onClearConsole) onClearConsole();
      setPrompt('');
      return;
    }
    if (cmd.id === 'model') {
      setShowRoleWizard(true);
      setPrompt('');
      return;
    }
    if (cmd.id === 'advisor') {
      const next = !advisor;
      setAdvisor(next);
      AppApi.SetAdvisorEnabled(next).catch(console.error);
      setPrompt(`/advisor ${next ? 'on' : 'off'}`);
      return;
    }
    if (cmd.name === 'skill:') {
      setPrompt('/skill:');
      textareaRef.current?.focus();
      return;
    }
    if (cmd.onSelect) {
      cmd.onSelect();
    }
    setPrompt(cmd.fullCmd + ' ');
    textareaRef.current?.focus();
  };


  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isWorking]);

  // Handle Clipboard Paste (Print Screen / Screenshot / Files / Paths)
  const handlePaste = async (e: React.ClipboardEvent) => {
    const clipboardData = e.clipboardData;
    if (!clipboardData) return;

    // 1. Check for Image Items (Print Screen, Snipping Tool, Win+Shift+S)
    const items = clipboardData.items;
    let hasImage = false;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) {
          hasImage = true;
          e.preventDefault();

          const reader = new FileReader();
          reader.onload = async () => {
            try {
              const base64Data = (reader.result as string).split(',')[1];
              const ext = file.type.split('/')[1] || 'png';
              const filename = `screenshot_${Date.now()}.${ext}`;
              const savedPath = await AppApi.SaveClipboardImage(base64Data, filename);
              if (savedPath) {
                onAddFile(savedPath);
              }
            } catch (err) {
              console.error('Clipboard image save failed:', err);
            }
          };
          reader.readAsDataURL(file);
        }
      }
    }

    if (hasImage) return;

    // 2. Check for Files in clipboardData.files (e.g. copied from Windows Explorer)
    if (clipboardData.files && clipboardData.files.length > 0) {
      let attachedAny = false;
      for (let i = 0; i < clipboardData.files.length; i++) {
        const file = clipboardData.files[i];
        let filePath: string | undefined;
        const candidate: unknown = file;
        if (candidate && typeof candidate === 'object' && 'path' in candidate) {
          const rawPath = candidate.path;
          if (typeof rawPath === 'string') {
            filePath = rawPath;
          }
        }
        if (filePath) {
          onAddFile(filePath);
          attachedAny = true;
        } else if (file.type.startsWith('image/')) {
          attachedAny = true;
          const reader = new FileReader();
          reader.onload = async () => {
            const base64Data = (reader.result as string).split(',')[1];
            const savedPath = await AppApi.SaveClipboardImage(base64Data, file.name);
            if (savedPath) onAddFile(savedPath);
          };
          reader.readAsDataURL(file);
        }
      }
      if (attachedAny) {
        e.preventDefault();
        return;
      }
    }

    // 3. Check for text that is a valid file path (e.g. "C:\Users\..." copied from Explorer)
    const pastedText = clipboardData.getData('text');
    if (pastedText) {
      const trimmed = pastedText.trim().replace(/^["']|["']$/g, '');
      if (/^[a-zA-Z]:\\[^\n\r]+$/.test(trimmed)) {
        try {
          const exists = await AppApi.CheckPathExists(trimmed);
          if (exists) {
            e.preventDefault();
            onAddFile(trimmed);
            return;
          }
        } catch {
          // Not a file, let it paste as text
        }
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = prompt.trim();
    if (!trimmed && attachedFiles.length === 0) return;

    // Intercept slash commands
    if (trimmed.startsWith('/advisor')) {
      const parts = trimmed.split(/\s+/);
      const action = parts[1]?.toLowerCase();
      if (action === 'on' || action === '1' || action === 'enable') {
        setAdvisor(true);
        AppApi.SetAdvisorEnabled(true).catch(console.error);
        setPrompt('');
        return;
      } else if (action === 'off' || action === '0' || action === 'disable') {
        setAdvisor(false);
        AppApi.SetAdvisorEnabled(false).catch(console.error);
        setPrompt('');
        return;
      } else {
        const next = !advisor;
        setAdvisor(next);
        AppApi.SetAdvisorEnabled(next).catch(console.error);
        setPrompt('');
        return;
      }
    }

    if (trimmed === '/clear') {
      if (onClearConsole) onClearConsole();
      setPrompt('');
      return;
    }

    onSendMessage({
      prompt,
      model: selectedModel,
      smolModel,
      slowModel,
      planModel,
      thinkingLevel,
      approvalMode,
      autoApprove,
      goalMode,
      planYolo,
      prewalk,
      advisor,
      profile: '',
      cwd,
      sessionId: '',
      files: attachedFiles,
    });

    setPrompt('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Intercept navigation when autocomplete is visible
    if (prompt.startsWith('/') && filteredCommands.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedCmdIndex((prev) => (prev + 1) % filteredCommands.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedCmdIndex((prev) => (prev - 1 + filteredCommands.length) % filteredCommands.length);
        return;
      }
      if (e.key === 'Tab' || (e.key === 'Enter' && !e.shiftKey)) {
        e.preventDefault();
        const chosen = filteredCommands[selectedCmdIndex];
        if (chosen) {
          selectCommand(chosen);
        }
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setPrompt('');
        return;
      }
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div 
      className="flex-1 flex flex-col h-full bg-omp-bg overflow-hidden relative font-sans"
      onPaste={handlePaste}
    >
      {/* Studio Header Toolbar */}
      <div className="h-11 border-b border-omp-border/70 bg-omp-surface/50 px-4 flex items-center justify-between select-none shrink-0">
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2 text-xs text-omp-muted">
            <Sparkles size={14} className="text-omp-accent" />
            <span className="font-semibold text-white">oh-my-pi Sohbet Stüdyosu</span>
          </div>

          {cwd && (
            <span className="text-[11px] text-omp-muted hidden sm:inline px-2.5 py-0.5 rounded-full bg-omp-bg border border-omp-border/60 truncate max-w-sm">
              Dizin: {cwd}
            </span>
          )}
        </div>

        <div className="flex items-center space-x-3 text-xs">
          {/* Quick Advisor Toggle Pill in Header */}
          <button
            type="button"
            onClick={() => {
              const next = !advisor;
              setAdvisor(next);
              AppApi.SetAdvisorEnabled(next).catch(console.error);
            }}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium flex items-center space-x-1.5 transition ${
              advisor
                ? 'bg-omp-accent/20 text-omp-accent border border-omp-accent/40 shadow-sm'
                : 'bg-omp-surfaceLight/80 text-omp-muted hover:text-white border border-transparent'
            }`}
            title="Advisor Rolünü Aç / Kapat"
          >
            <Shield size={12} className={advisor ? 'text-omp-accent' : 'text-omp-muted'} />
            <span>Advisor: {advisor ? 'Açık' : 'Kapalı'}</span>
          </button>

          {isWorking && (
            <div className="flex items-center space-x-1.5 text-omp-warning font-mono animate-pulse">
              <RefreshCw size={12} className="animate-spin" />
              <span>omp yanıtlıyor...</span>
            </div>
          )}

          {onClearConsole && (
            <button
              onClick={onClearConsole}
              className="text-omp-muted hover:text-white px-2.5 py-1 rounded-md text-xs hover:bg-omp-surfaceLight transition border border-transparent hover:border-omp-border"
            >
              Sohbeti Temizle
            </button>
          )}
        </div>
      </div>

      {/* Main Messages Area */}
      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-5">
        {messages.length === 0 ? (
          /* Welcome Screen */
          <div className="h-full flex flex-col items-center justify-center text-center p-8 select-none">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-omp-accent/20 to-omp-purple/20 border border-omp-border flex items-center justify-center text-omp-accent mb-4 shadow-lg shadow-omp-accent/5">
              <Sparkles size={32} />
            </div>
            <h2 className="text-xl font-semibold text-white mb-2">oh-my-pi Asistanı</h2>
            <p className="text-sm text-omp-muted max-w-md mb-6 leading-relaxed">
              Yerel <code className="text-omp-accent font-mono">oh-my-pi</code> yapay zeka asistanınız ile kod yazın, mimari kararlar alın ve projelerinizde hata ayıklayın.
            </p>
            <div className="grid grid-cols-2 gap-3 max-w-lg w-full text-left">
              <button
                onClick={() => setPrompt("Bu projenin mimarisini ve dosyalarını incele")}
                className="p-3.5 rounded-xl bg-omp-surface border border-omp-border hover:border-omp-accent transition text-xs text-omp-text hover:bg-omp-surfaceLight/50 group"
              >
                <div className="font-medium text-white group-hover:text-omp-accent transition">🔍 Projeyi İncele</div>
                <p className="text-omp-muted text-[11px] mt-1">Dosya yapısını ve bağımlılıkları haritalandır</p>
              </button>
              <button
                onClick={() => {
                  setGoalMode(true);
                  setPrompt("Koddaki tüm hataları tespit et ve testleri çalıştır");
                }}
                className="p-3.5 rounded-xl bg-omp-surface border border-omp-border hover:border-omp-accent transition text-xs text-omp-text hover:bg-omp-surfaceLight/50 group"
              >
                <div className="font-medium text-white group-hover:text-omp-accent transition">🎯 Hedef Modu (Goal)</div>
                <p className="text-omp-muted text-[11px] mt-1">Hata ayıkla ve testleri başarıyla tamamla</p>
              </button>
            </div>
          </div>
        ) : (
          /* Clean AI Chat View */
          messages.map((msg, idx) => {
            const isLastMessage = idx === messages.length - 1;
            const isCurrentlyRunning = isLastMessage && isWorking && msg.role === 'assistant';

            // Extract display thinking and display response using textParser
            let displayThinking = msg.thinking || '';
            let rawText = (msg.text || '').replace(/^\s*Working(?:\.\.\.|…)?\s*\n?/gi, '').trim();

            if (!displayThinking && rawText) {
              const split = splitThinkingAndResponse(rawText);
              displayThinking = split.thinking;
              rawText = split.response;
            }

            return (
              <div
                key={msg.id || idx}
                className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'} space-y-1.5`}
              >
                {/* Message Header (Sender info) */}
                <div className="flex items-center space-x-2 text-[11px] text-omp-muted px-1 select-none">
                  <span className={`font-semibold ${msg.role === 'user' ? 'text-omp-accent' : 'text-zinc-300'}`}>
                    {msg.role === 'user' ? 'Siz' : 'oh-my-pi'}
                  </span>
                  <span>•</span>
                  <span>{new Date(msg.timestamp).toLocaleTimeString()}</span>
                  {msg.role === 'assistant' && rawText && (
                    <button
                      onClick={() => copyToClipboard(rawText, msg.id)}
                      className="ml-2 hover:text-white transition p-0.5 rounded"
                      title="Cevabı Kopyala"
                    >
                      {copiedId === msg.id ? (
                        <CheckCheck size={12} className="text-omp-success" />
                      ) : (
                        <Copy size={12} />
                      )}
                    </button>
                  )}
                </div>

                {/* Message Bubble */}
                <div
                  className={`rounded-2xl px-5 py-4 max-w-3xl text-sm leading-relaxed shadow-sm ${
                    msg.role === 'user'
                      ? 'bg-omp-accent text-white rounded-tr-sm'
                      : 'bg-omp-surface/90 border border-omp-border/80 text-white rounded-tl-sm w-full'
                  }`}
                >
                  {/* English Thinking Section - distinctly gray and separated */}
                  {displayThinking ? (
                    <div className="mb-3.5 pb-3 border-b border-zinc-700/60 select-text">
                      <div className="flex items-center space-x-1.5 text-zinc-500 font-semibold uppercase text-[10px] tracking-wider mb-1.5 select-none font-mono">
                        <BrainCircuit size={13} className="text-zinc-500 shrink-0" />
                        <span>omp Düşünce Süreci (Thinking)</span>
                      </div>
                      <div className="text-zinc-400 font-mono text-[12px] leading-relaxed bg-black/30 p-3 rounded-xl border border-zinc-800/80 whitespace-pre-wrap">
                        {displayThinking}
                      </div>
                    </div>
                  ) : null}

                  {/* Active working indicator while assistant is generating */}
                  {isCurrentlyRunning && !rawText && (
                    <div className="flex items-center space-x-2 text-omp-warning text-xs font-mono py-1 animate-pulse select-none">
                      <RefreshCw size={12} className="animate-spin text-omp-warning shrink-0" />
                      <span>{msg.workingStatus || 'Düşünüyor ve yanıt hazırlıyor...'}</span>
                    </div>
                  )}

                  {/* Main Response in Bright White (net beyaz) */}
                  {rawText ? (
                    <div className="whitespace-pre-wrap font-sans text-sm text-zinc-100 leading-relaxed select-text">
                      {rawText}
                      {isCurrentlyRunning && (
                        <span className="inline-block w-2 h-4 ml-1.5 bg-omp-accent animate-pulse align-middle" />
                      )}
                    </div>
                  ) : null}

                  {/* Tool Calls if any */}
                  {msg.toolCalls && msg.toolCalls.length > 0 && (
                    <div className="mt-4 space-y-2.5">
                      {msg.toolCalls.map((tc) => (
                        <ToolCallCard
                          key={tc.id}
                          call={tc}
                          onApprove={() => onSendStdin('y')}
                          onReject={() => onSendStdin('n')}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Composer & Toolbar */}
      <div className="border-t border-omp-border bg-omp-surface p-4 space-y-3 shrink-0">
        {/* Attached files bar */}
        {attachedFiles.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] text-omp-muted">Ekler:</span>
            {attachedFiles.map((f, idx) => (
              <span
                key={idx}
                className="text-xs bg-omp-surfaceLight border border-omp-border text-white px-2 py-0.5 rounded-md flex items-center space-x-1.5"
              >
                <Paperclip size={12} className="text-omp-accent" />
                <span className="max-w-[150px] truncate">{f.split('\\').pop() || f}</span>
                <button
                  type="button"
                  onClick={() => onRemoveFile(idx)}
                  className="text-omp-muted hover:text-omp-error ml-1"
                >
                  ✕
                </button>
              </span>
            ))}
          </div>
        )}

        {/* Text Input area */}
        <form onSubmit={handleSubmit} className="relative flex items-end space-x-2">
          <div className="flex-1 bg-omp-bg border border-omp-border rounded-xl focus-within:border-omp-accent transition-colors p-2 shadow-inner relative">
            {/* Slash Command Autocomplete Popover (terminal UI matching Image #2) */}
            {prompt.startsWith('/') && filteredCommands.length > 0 && (
              <div className="absolute bottom-[calc(100%+8px)] left-0 right-0 z-40 bg-[#0d1117] border border-omp-border/90 rounded-xl shadow-2xl p-2 max-h-72 overflow-y-auto font-mono text-xs animate-fadeIn select-none">
                {/* Terminal prompt header line: ╭─ / */}
                <div className="flex items-center space-x-1.5 px-2 py-1 text-omp-accent text-[11px] font-bold border-b border-omp-border/50 mb-1">
                  <span className="text-pink-400">╭─</span>
                  <span className="text-white font-bold text-xs">/</span>
                  <span className="text-omp-muted font-normal text-[10px] ml-auto">
                    ↑↓ seç · Tab/Enter uygula · Esc kapat
                  </span>
                </div>

                <div className="space-y-0.5">
                  {filteredCommands.map((cmd, idx) => {
                    const isSelected = idx === selectedCmdIndex;
                    return (
                      <div
                        key={cmd.id}
                        onClick={() => selectCommand(cmd)}
                        onMouseEnter={() => setSelectedCmdIndex(idx)}
                        className={`px-2.5 py-1.5 rounded-lg flex items-center cursor-pointer transition-colors ${
                          isSelected 
                            ? 'bg-omp-accent/20 text-white font-medium' 
                            : 'hover:bg-omp-surfaceLight/50 text-zinc-300'
                        }`}
                      >
                        {/* Pointer indicator */}
                        <span className={`w-3.5 text-xs font-bold shrink-0 ${isSelected ? 'text-omp-accent' : 'text-transparent'}`}>
                          ›
                        </span>

                        {/* Colored glyph matching terminal */}
                        <span className={`w-5 text-center text-xs shrink-0 mr-1.5 ${cmd.glyphColor}`}>
                          {cmd.glyph}
                        </span>

                        {/* Command Name */}
                        <span className={`font-semibold text-xs tracking-tight shrink-0 mr-4 ${isSelected ? 'text-cyan-300' : 'text-white'}`}>
                          {cmd.name}
                        </span>

                        {/* Description */}
                        <span className="text-[11px] text-omp-muted truncate font-sans">
                          {cmd.description}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            <textarea
              ref={textareaRef}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              placeholder="Mesajınızı yazın veya ekran görüntüsü / dosya yapıştırın (Ctrl+V)..."
              rows={2}
              className="w-full bg-transparent text-sm text-white focus:outline-none resize-none placeholder-omp-muted font-sans"
            />

            {/* Quick action bar inside composer */}
            <div className="flex items-center justify-between pt-2 border-t border-omp-border/50 text-xs">
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={onSelectFiles}
                  title="Dosya ekle"
                  className="flex items-center space-x-1 text-omp-muted hover:text-white px-2 py-1 rounded hover:bg-omp-surfaceLight transition"
                >
                  <Paperclip size={14} />
                  <span>Dosya Ekle</span>
                </button>

                {/* Parameters Dialog Trigger */}
                <button
                  type="button"
                  onClick={() => setShowParamsDialog(true)}
                  className="flex items-center space-x-1 text-omp-muted hover:text-white px-2.5 py-1 rounded hover:bg-omp-surfaceLight transition"
                  title="Çalıştırma Parametreleri (Düşünme ve İzinler)"
                >
                  <Sliders size={14} className="text-omp-accent" />
                  <span>Parametreler</span>
                </button>

                {/* Model Wizard Button right next to Parametreler! */}
                <button
                  type="button"
                  onClick={() => setShowRoleWizard(true)}
                  className="flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-omp-accent/15 hover:bg-omp-accent/25 border border-omp-accent/30 text-white text-xs font-medium transition shadow-sm"
                  title="Model & 3 Aşamalı Rol Atama Sihirbazını Aç"
                >
                  <Cpu size={14} className="text-omp-accent" />
                  <span>Model</span>
                </button>
              </div>

              {/* Model & Thinking status pills */}
              <div className="flex items-center space-x-2 text-[11px]">
                <button
                  type="button"
                  onClick={() => setShowRoleWizard(true)}
                  className="px-2 py-0.5 rounded bg-omp-surfaceLight hover:bg-omp-surfaceLight/80 text-omp-accent font-mono transition"
                  title="Model & Rol Sihirbazını Aç"
                >
                  {selectedModel.split('/').pop() || 'gemini-3.8-flash'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowParamsDialog(true)}
                  className="px-2 py-0.5 rounded bg-omp-surfaceLight hover:bg-omp-surfaceLight/80 text-zinc-400 font-mono transition"
                  title="Düşünme seviyesi değiştir"
                >
                  🧠 {thinkingLevel}
                </button>
              </div>
            </div>
          </div>

          {/* Run or Stop button */}
          {isWorking ? (
            <button
              type="button"
              onClick={onStopAgent}
              className="h-11 px-4 rounded-xl bg-omp-error hover:bg-red-600 text-white font-medium flex items-center space-x-1.5 transition shadow-lg shrink-0"
            >
              <Square size={16} fill="currentColor" />
              <span>Durdur</span>
            </button>
          ) : (
            <button
              type="submit"
              disabled={!prompt.trim() && attachedFiles.length === 0}
              className="h-11 px-4 rounded-xl bg-omp-accent hover:bg-omp-accentHover disabled:opacity-40 disabled:hover:bg-omp-accent text-white font-medium flex items-center space-x-1.5 transition shadow-lg shrink-0"
            >
              <Send size={16} />
              <span>Gönder</span>
            </button>
          )}
        </form>
      </div>

      {/* Modal Dialog for Parameters & Roles */}
      <ParametersDialog
        isOpen={showParamsDialog}
        onClose={() => setShowParamsDialog(false)}
        availableModels={availableModels}
        selectedModel={selectedModel}
        onSelectModel={onSelectModel}
        smolModel={smolModel}
        onSelectSmolModel={setSmolModel}
        slowModel={slowModel}
        onSelectSlowModel={setSlowModel}
        planModel={planModel}
        onSelectPlanModel={setPlanModel}
        advisorModel={advisorModel}
        onSelectAdvisorModel={setAdvisorModel}
        advisorEnabled={advisor}
        onToggleAdvisor={(en) => {
          setAdvisor(en);
          AppApi.SetAdvisorEnabled(en).catch(console.error);
        }}
        thinkingLevel={thinkingLevel}
        onSelectThinkingLevel={setThinkingLevel}
        approvalMode={approvalMode}
        onSelectApprovalMode={setApprovalMode}
        autoApprove={autoApprove}
        onToggleAutoApprove={setAutoApprove}
        goalMode={goalMode}
        onToggleGoalMode={setGoalMode}
        planYolo={planYolo}
        onTogglePlanYolo={setPlanYolo}
        prewalk={prewalk}
        onTogglePrewalk={setPrewalk}
        onOpenRoleWizard={onOpenRoleWizard}
      />

      {/* 3-Step Model & Role Assignment Wizard */}
      <RoleAssignmentModal
        isOpen={showRoleWizard}
        onClose={() => setShowRoleWizard(false)}
        availableModels={availableModels}
        currentRoles={currentRoles}
        onSaveRole={handleSaveStudioRole}
        initialModel={selectedModel}
      />
    </div>
  );
};

// Interactive tool call and approval card
interface ToolCallCardProps {
  call: {
    id: string;
    tool: string;
    args?: Record<string, unknown> | string;
    result?: string;
    status: 'pending' | 'running' | 'completed' | 'denied';
  };
  onApprove: () => void;
  onReject: () => void;
}

const ToolCallCard: React.FC<ToolCallCardProps> = ({ call, onApprove, onReject }) => {
  return (
    <div className="border border-omp-border bg-omp-bg rounded-lg p-3 text-xs space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Wrench size={13} className="text-omp-accent" />
          <span className="font-mono font-medium text-white">{call.tool}</span>
        </div>
        <span
          className={`text-[10px] px-2 py-0.5 rounded uppercase font-semibold ${
            call.status === 'pending'
              ? 'bg-omp-warning/20 text-omp-warning'
              : call.status === 'completed'
              ? 'bg-omp-success/20 text-omp-success'
              : 'bg-omp-error/20 text-omp-error'
          }`}
        >
          {call.status}
        </span>
      </div>

      {call.args && (
        <div className="p-2 rounded bg-omp-surface border border-omp-border font-mono text-[11px] text-omp-text overflow-x-auto max-h-40">
          {typeof call.args === 'string' ? call.args : JSON.stringify(call.args, null, 2)}
        </div>
      )}

      {call.status === 'pending' && (
        <div className="flex items-center justify-end space-x-2 pt-1 border-t border-omp-border/60">
          <button
            onClick={onReject}
            className="flex items-center space-x-1 px-2.5 py-1 rounded bg-omp-error/20 hover:bg-omp-error/30 text-omp-error transition text-xs"
          >
            <X size={12} />
            <span>Reddet</span>
          </button>
          <button
            onClick={onApprove}
            className="flex items-center space-x-1 px-2.5 py-1 rounded bg-omp-success/20 hover:bg-omp-success/30 text-omp-success transition text-xs font-medium"
          >
            <Check size={12} />
            <span>Onayla</span>
          </button>
        </div>
      )}
    </div>
  );
};
