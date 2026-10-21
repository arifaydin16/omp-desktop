import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Rune } from './Rune';
import { ChatMessage, AgentRunOptions, ModelEntry, WorkspaceFileItem } from '../types';
import { splitThinkingAndResponse } from '../utils/textParser';
import { ParametersDialog } from './ParametersDialog';
import { RoleAssignmentModal } from './RoleAssignmentModal';
import { BadgePromptInput } from './BadgePromptInput';
import * as AppApi from '../../wailsjs/go/main/App';

interface AgentStudioProps {
  profile?: string;
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
  onOpenUsage?: () => void;
  onOpenSkills?: () => void;
  onOpenSessions?: () => void;
  onOpenSettings?: () => void;
  onOpenDevTools?: () => void;
}

export const AgentStudio: React.FC<AgentStudioProps> = ({
  profile,
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
  onOpenUsage,
  onOpenSkills,
  onOpenSessions,
  onOpenSettings,
  onOpenDevTools,
}) => {
  const [prompt, setPrompt] = useState('');
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [showParamsDialog, setShowParamsDialog] = useState(false);
  const [showRoleWizard, setShowRoleWizard] = useState(false);
  const [currentRoles, setCurrentRoles] = useState<Record<string, string>>({});

  const loadStudioRoles = async () => {
    try {
      const r = await AppApi.GetModelRoles();
      setCurrentRoles(r || {});

      // Sync default model and thinking level from active profile
      if (r && r['default']) {
        const parts = r['default'].split(':');
        const m = parts[0];
        const th = parts[1];
        if (m) onSelectModel(m);
        if (th) {
          setThinkingLevel(th);
        } else {
          try {
            const defTh = await AppApi.GetConfigKey('defaultThinkingLevel');
            if (defTh) setThinkingLevel(defTh);
          } catch {}
        }
      } else {
        try {
          const defTh = await AppApi.GetConfigKey('defaultThinkingLevel');
          if (defTh) setThinkingLevel(defTh);
        } catch {}
      }

      // Sync subagent roles
      setSmolModel(r && r['smol'] ? r['smol'].split(':')[0] : '');
      setSlowModel(r && r['slow'] ? r['slow'].split(':')[0] : '');
      setPlanModel(r && r['plan'] ? r['plan'].split(':')[0] : '');
      setAdvisorModel(r && r['advisor'] ? r['advisor'].split(':')[0] : '');
    } catch (err) {
      console.error('Failed to load roles in studio:', err);
    }
  };

  useEffect(() => {
    loadStudioRoles();
  }, [profile]);

  const handleSaveStudioRole = async (role: string, modelWithThinking: string) => {
    try {
      await AppApi.SetModelRole(role, modelWithThinking);
      if (role === 'default') {
        const parts = modelWithThinking.split(':');
        const base = parts[0];
        const th = parts[1];
        if (base) onSelectModel(base);
        if (th) setThinkingLevel(th);
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
  const commandListRef = useRef<HTMLDivElement | null>(null);

  // Workspace File Autocomplete State (@...)
  const [workspaceFiles, setWorkspaceFiles] = useState<WorkspaceFileItem[]>([]);
  const [selectedFileIndex, setSelectedFileIndex] = useState(0);
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  const fileListRef = useRef<HTMLDivElement | null>(null);
  // Image Attachments Meta & Numbering (#1, #2, ...)
  interface ImageMeta {
    path: string;
    dataUrl?: string;
    width?: number;
    height?: number;
    num: number;
  }
  const [imageMetaMap, setImageMetaMap] = useState<Record<string, ImageMeta>>({});
  // Git Branch Detection
  const [gitBranch, setGitBranch] = useState<string>('');
  useEffect(() => {
    AppApi.GetGitBranch(cwd || '')
      .then((b) => setGitBranch(b || ''))
      .catch(() => setGitBranch(''));
  }, [cwd]);

  // Context Size Calculation
  const modelLimit = useMemo(() => {
    const m = availableModels.find((mod) => mod.id === selectedModel);
    return m?.contextWindow || 1000000;
  }, [availableModels, selectedModel]);

  const usedTokens = useMemo(() => {
    let totalChars = 0;
    messages.forEach((m) => {
      totalChars += (m.text?.length || 0) + (m.thinking?.length || 0);
      if (m.toolCalls) {
        m.toolCalls.forEach((tc) => {
          totalChars += (typeof tc.args === 'string' ? tc.args.length : JSON.stringify(tc.args || '').length);
          totalChars += (tc.result?.length || 0);
        });
      }
    });
    return Math.round(totalChars / 3.8);
  }, [messages]);

  const contextPercent = useMemo(() => {
    if (modelLimit <= 0) return 0;
    return Math.min(100, (usedTokens / modelLimit) * 100);
  }, [usedTokens, modelLimit]);

  const formatTokens = (n: number): string => {
    if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
    if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
    return n.toString();
  };
  // Session Usage Cost Calculation (exact omp statusLine: $12.76 + 👁2.65)
  const { mainCost, advisorCost } = useMemo(() => {
    let mainTotal = 0;
    let advTotal = 0;

    const activeModel = availableModels.find((m) => m.id === selectedModel);
    const inPrice = (activeModel?.cost?.input as number) || 1.5;
    const outPrice = (activeModel?.cost?.output as number) || 6.0;

    messages.forEach((m) => {
      if (m.cost !== undefined && m.cost > 0) {
        if (m.isAdvisor) {
          advTotal += m.cost;
        } else {
          mainTotal += m.cost;
        }
        return;
      }

      if (m.role === 'assistant') {
        const outChars = (m.text?.length || 0) + (m.thinking?.length || 0);
        const outToks = Math.round(outChars / 3.8);
        const inToks = Math.max(150, Math.round(usedTokens * 0.7));
        const turnCost = (inToks / 1000000) * inPrice + (outToks / 1000000) * outPrice;

        if (m.isAdvisor) {
          advTotal += turnCost;
        } else {
          mainTotal += turnCost;
        }
      }
    });

    if (advisor && messages.some((m) => m.role === 'assistant') && advTotal === 0) {
      const turns = messages.filter((m) => m.role === 'assistant').length;
      advTotal = turns * 0.005;
    }

    return {
      mainCost: mainTotal,
      advisorCost: advTotal,
    };
  }, [messages, availableModels, selectedModel, usedTokens, advisor]);


  // Auto-expand textarea up to 1/3 of viewport height
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    const maxHeight = Math.floor(window.innerHeight / 3);
    const newHeight = Math.min(el.scrollHeight, maxHeight);
    el.style.height = `${Math.max(newHeight, 46)}px`;
    el.style.overflowY = el.scrollHeight > maxHeight ? 'auto' : 'hidden';
  }, [prompt]);

  const handleRemoveAttachment = (idx: number, path: string) => {
    const meta = imageMetaMap[path];
    if (meta) {
      const regex = new RegExp(`\\[#${meta.num}\\]\\s*|\\[Image\\s+#${meta.num}[^\\]]*\\]\\s*|📷\\s*#${meta.num}\\s*|#${meta.num}\\b\\s*`, 'gi');
      setPrompt((prev) => prev.replace(regex, ''));
      setImageMetaMap((prev) => {
        const next = { ...prev };
        delete next[path];
        return next;
      });
    }
    onRemoveFile(idx);
  };

  const handlePromptChange = (newVal: string) => {
    setPrompt(newVal);

    // If any attached image reference (#1, #2 etc.) was removed from the input, delete the image from attachments
    const pathsToRemove: string[] = [];
    Object.values(imageMetaMap).forEach((meta) => {
      const hasRef = new RegExp(`(\\[#${meta.num}\\]|\\[Image\\s+#${meta.num}\\b|📷\\s*#${meta.num}\\b|#${meta.num}\\b)`, 'i').test(newVal);
      if (!hasRef) {
        pathsToRemove.push(meta.path);
      }
    });

    if (pathsToRemove.length > 0) {
      pathsToRemove.forEach((p) => {
        const idx = attachedFiles.indexOf(p);
        if (idx !== -1) {
          onRemoveFile(idx);
        }
      });
      setImageMetaMap((prev) => {
        const next = { ...prev };
        pathsToRemove.forEach((p) => {
          delete next[p];
        });
        return next;
      });
    }
  };

  // Compute active @ token in prompt
  const atIndex = prompt.lastIndexOf('@');
  const isValidAt = atIndex !== -1 && (atIndex === 0 || /\s/.test(prompt[atIndex - 1]));
  const atQuery = isValidAt ? prompt.slice(atIndex + 1) : null;
  const isAtActive = isValidAt && atQuery !== null && !atQuery.includes(' ') && !prompt.startsWith('/');

  // Auto-scroll slash command active item into view
  useEffect(() => {
    if (commandListRef.current) {
      const activeEl = commandListRef.current.querySelector('[data-selected="true"]');
      if (activeEl) {
        activeEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }
  }, [selectedCmdIndex]);

  // Auto-scroll workspace file active item into view
  useEffect(() => {
    if (fileListRef.current) {
      const activeEl = fileListRef.current.querySelector('[data-selected="true"]');
      if (activeEl) {
        activeEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }
  }, [selectedFileIndex]);

  // Fetch workspace files when @ is active
  useEffect(() => {
    if (!isAtActive || atQuery === null) {
      setWorkspaceFiles([]);
      return;
    }

    let isMounted = true;
    setIsLoadingFiles(true);
    AppApi.GetWorkspaceFiles(cwd || '', atQuery)
      .then((files) => {
        if (isMounted) {
          setWorkspaceFiles(files || []);
          setSelectedFileIndex(0);
          setIsLoadingFiles(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          console.error('Failed to get workspace files:', err);
          setIsLoadingFiles(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [isAtActive, atQuery, cwd]);

  const selectWorkspaceItem = (item: WorkspaceFileItem) => {
    if (atIndex === -1) return;
    const beforeAt = prompt.slice(0, atIndex);

    if (item.isDir) {
      const newPrompt = beforeAt + '@' + item.relPath + '/';
      setPrompt(newPrompt);
      textareaRef.current?.focus();
    } else {
      const newPrompt = beforeAt + '@' + item.relPath + ' ';
      setPrompt(newPrompt);
      if (item.fullPath) {
        onAddFile(item.fullPath);
      }
      textareaRef.current?.focus();
    }
  };

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
      glyph: '⚡',
      glyphColor: 'text-amber-400',
      description: 'View usage statistics and quota telemetry',
    },
    {
      id: 'skills',
      name: 'skills',
      fullCmd: '/skills',
      glyph: '✦',
      glyphColor: 'text-cyan-400',
      description: 'Open skills inventory and custom skill editor',
    },
    {
      id: 'settings',
      name: 'settings',
      fullCmd: '/settings',
      glyph: '⚙',
      glyphColor: 'text-zinc-300',
      description: 'Open system settings and provider login (/login)',
    },
    {
      id: 'devtools',
      name: 'devtools',
      fullCmd: '/devtools',
      glyph: '⌘',
      glyphColor: 'text-zinc-300',
      description: 'Open developer tools (Git, Ps, Cleanse)',
    },
    {
      id: 'help',
      name: 'help',
      fullCmd: '/help',
      glyph: 'ℹ',
      glyphColor: 'text-cyan-400',
      description: 'Show available commands and usage guide',
    },
  ], [skillsList, selectedModel, advisor, goalMode]);

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
    if (cmd.id === 'clear' || cmd.id === 'new') {
      if (onClearConsole) onClearConsole();
      setPrompt('');
      return;
    }
    if (cmd.id === 'model') {
      setShowRoleWizard(true);
      setPrompt('');
      return;
    }
    if (cmd.id === 'usage' || cmd.id === 'stats') {
      if (onOpenUsage) onOpenUsage();
      setPrompt('');
      return;
    }
    if (cmd.id === 'skills') {
      if (onOpenSkills) onOpenSkills();
      setPrompt('');
      return;
    }
    if (cmd.id === 'settings') {
      if (onOpenSettings) onOpenSettings();
      setPrompt('');
      return;
    }
    if (cmd.id === 'devtools') {
      if (onOpenDevTools) onOpenDevTools();
      setPrompt('');
      return;
    }
    if (cmd.id === 'resume') {
      if (onOpenSessions) onOpenSessions();
      setPrompt('');
      return;
    }
    if (cmd.id === 'compact') {
      handleCompact();
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
    if (cmd.id === 'loop') {
      setGoalMode(!goalMode);
      setPrompt('');
      return;
    }
    if (cmd.id === 'help' || cmd.id === 'changelog') {
      setShowHelpModal(true);
      setPrompt('');
      return;
    }
    if (cmd.name === 'skill:') {
      setPrompt('/skill:');
      return;
    }
    if (cmd.onSelect) {
      cmd.onSelect();
    }
    setPrompt(cmd.fullCmd + ' ');
  };


  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const lastPasteTimeRef = useRef(0);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isWorking]);

  // Handle Clipboard Paste (Print Screen / Screenshot / Files / Paths)
  const handlePaste = async (e: React.ClipboardEvent) => {
    e.stopPropagation();
    const now = Date.now();
    if (now - lastPasteTimeRef.current < 300) {
      e.preventDefault();
      return;
    }
    lastPasteTimeRef.current = now;

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
              const dataUrl = reader.result as string;
              const ext = file.type.split('/')[1] || 'png';
              const filename = `screenshot_${Date.now()}.${ext}`;
              const savedPath = await AppApi.SaveClipboardImage(base64Data, filename);
              if (savedPath) {
                const img = new Image();
                img.onload = () => {
                  const width = img.naturalWidth || img.width;
                  const height = img.naturalHeight || img.height;
                  const currentImageCount = Object.keys(imageMetaMap).length;
                  const imgNum = currentImageCount + 1;
                  const imageTag = `[#${imgNum}]`;

                  setImageMetaMap((prev) => ({
                    ...prev,
                    [savedPath]: {
                      path: savedPath,
                      dataUrl,
                      width,
                      height,
                      num: imgNum,
                    },
                  }));

                  setPrompt((prev) => {
                    const trimmed = prev.trimEnd();
                    return trimmed ? `${trimmed} ${imageTag} ` : `${imageTag} `;
                  });

                  onAddFile(savedPath);
                };
                img.src = dataUrl;
              }
            } catch (err) {
              console.error('Clipboard image save failed:', err);
            }
          };
          reader.readAsDataURL(file);
          break;
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

    // Intercept all slash commands
    // 1. /clear & /new
    if (trimmed === '/clear' || trimmed === '/new') {
      if (onClearConsole) onClearConsole();
      setPrompt('');
      return;
    }

    // 2. /usage & /stats
    if (trimmed === '/usage' || trimmed === '/stats') {
      if (onOpenUsage) onOpenUsage();
      setPrompt('');
      return;
    }

    // 3. /skills
    if (trimmed === '/skills') {
      if (onOpenSkills) onOpenSkills();
      setPrompt('');
      return;
    }

    // 4. /settings
    if (trimmed === '/settings') {
      if (onOpenSettings) onOpenSettings();
      setPrompt('');
      return;
    }

    // 5. /devtools
    if (trimmed === '/devtools') {
      if (onOpenDevTools) onOpenDevTools();
      setPrompt('');
      return;
    }

    // 6. /resume
    if (trimmed === '/resume') {
      if (onOpenSessions) onOpenSessions();
      setPrompt('');
      return;
    }

    // 7. /help & /changelog
    if (trimmed === '/help' || trimmed === '/changelog') {
      setShowHelpModal(true);
      setPrompt('');
      return;
    }

    // 8. /loop
    if (trimmed.startsWith('/loop')) {
      const parts = trimmed.split(/\s+/);
      const action = parts[1]?.toLowerCase();
      if (action === 'on' || action === '1' || action === 'enable') {
        setGoalMode(true);
      } else if (action === 'off' || action === '0' || action === 'disable') {
        setGoalMode(false);
      } else {
        setGoalMode(!goalMode);
      }
      setPrompt('');
      return;
    }

    // 9. /model
    if (trimmed === '/model') {
      setShowRoleWizard(true);
      setPrompt('');
      return;
    }
    if (trimmed.startsWith('/model ')) {
      const target = trimmed.slice(7).trim().toLowerCase();
      const found = availableModels.find(
        (m) => m.id.toLowerCase().includes(target) || m.name.toLowerCase().includes(target)
      );
      if (found) {
        onSelectModel(found.id);
      }
      setPrompt('');
      return;
    }

    // 10. /advisor
    if (trimmed.startsWith('/advisor')) {
      const parts = trimmed.split(/\s+/);
      const action = parts[1]?.toLowerCase();
      if (action === 'on' || action === '1' || action === 'enable') {
        setAdvisor(true);
        AppApi.SetAdvisorEnabled(true).catch(console.error);
      } else if (action === 'off' || action === '0' || action === 'disable') {
        setAdvisor(false);
        AppApi.SetAdvisorEnabled(false).catch(console.error);
      } else {
        const next = !advisor;
        setAdvisor(next);
        AppApi.SetAdvisorEnabled(next).catch(console.error);
      }
      setPrompt('');
      return;
    }

    // 11. /compact
    if (trimmed.startsWith('/compact')) {
      const focus = trimmed.replace(/^\/compact\s*/, '').trim();
      handleCompact(focus);
      setPrompt('');
      return;
    }

    // 12. If someone entered only "/skill:name" with no query
    if (trimmed.match(/^\/skill:[a-zA-Z0-9_-]+$/)) {
      setPrompt(trimmed + ' ');
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
  const handleCompact = (focus?: string) => {
    if (messages.length === 0) {
      return;
    }

    const compactionInstruction = focus
      ? `[KOMUT: /compact - BAĞLAM SIKIŞTIRMA]\nOdak: ${focus}\nLütfen şu ana kadarki tüm konuşma geçmişini, kullanıcı taleplerini, teknik seçimleri, üzerinde çalışılan dosyaları ve gelinen durumu özetleyerek bağlamı sıkıştır. Yanıtını devam etmeye hazır net bir 'Bağlam Özeti' olarak sun.`
      : `[KOMUT: /compact - BAĞLAM SIKIŞTIRMA]\nLütfen şu ana kadarki tüm konuşma geçmişini, kullanıcı taleplerini, mimari kararları, değiştirilen dosyaları ve gelinen son durumu özetleyerek bağlamı sıkıştır. Yanıtını devam etmeye hazır net bir 'Bağlam Özeti' olarak sun.`;

    onSendMessage({
      prompt: compactionInstruction,
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
      files: [],
    });
  };


  const handleKeyDown = (e: React.KeyboardEvent<HTMLElement>) => {
    // 1. Slash Command Autocomplete Active
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

    // 2. Workspace File Autocomplete Active (@...)
    if (isAtActive && workspaceFiles.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedFileIndex((prev) => (prev + 1) % workspaceFiles.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedFileIndex((prev) => (prev - 1 + workspaceFiles.length) % workspaceFiles.length);
        return;
      }
      if (e.key === 'Tab' || (e.key === 'Enter' && !e.shiftKey)) {
        e.preventDefault();
        const chosen = workspaceFiles[selectedFileIndex];
        if (chosen) {
          selectWorkspaceItem(chosen);
        }
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        if (atIndex !== -1) {
          setPrompt(prompt.slice(0, atIndex));
        }
        return;
      }
    }
    // 3. Atomic Badge Deletion (Backspace & Delete removes entire [#1] token in one keystroke)
    if (textareaRef.current && (e.key === 'Backspace' || e.key === 'Delete')) {
      const { selectionStart, selectionEnd } = textareaRef.current;
      if (selectionStart === selectionEnd) {
        const tokenRegex = /(\[#\d+\]|📷\s*#\d+|\[Image\s+#\d+[^\]]*\])/g;
        let match: RegExpExecArray | null;

        while ((match = tokenRegex.exec(prompt)) !== null) {
          const start = match.index;
          const end = start + match[0].length;

          // Case A: Backspace when cursor is at the end of the badge or immediately after trailing space
          if (e.key === 'Backspace') {
            if (selectionStart === end || (selectionStart === end + 1 && prompt[end] === ' ')) {
              e.preventDefault();
              const deleteStart = start;
              const deleteEnd = selectionStart === end + 1 ? end + 1 : end;
              const newPrompt = prompt.slice(0, deleteStart) + prompt.slice(deleteEnd);
              handlePromptChange(newPrompt);
              setTimeout(() => {
                if (textareaRef.current) {
                  textareaRef.current.selectionStart = textareaRef.current.selectionEnd = deleteStart;
                }
              }, 0);
              return;
            }
            // If cursor is inside the badge
            if (selectionStart > start && selectionStart < end) {
              e.preventDefault();
              const newPrompt = prompt.slice(0, start) + prompt.slice(end);
              handlePromptChange(newPrompt);
              setTimeout(() => {
                if (textareaRef.current) {
                  textareaRef.current.selectionStart = textareaRef.current.selectionEnd = start;
                }
              }, 0);
              return;
            }
          }

          // Case B: Delete when cursor is at start of badge
          if (e.key === 'Delete') {
            if (selectionStart === start) {
              e.preventDefault();
              const deleteEnd = (end < prompt.length && prompt[end] === ' ') ? end + 1 : end;
              const newPrompt = prompt.slice(0, start) + prompt.slice(deleteEnd);
              handlePromptChange(newPrompt);
              setTimeout(() => {
                if (textareaRef.current) {
                  textareaRef.current.selectionStart = textareaRef.current.selectionEnd = start;
                }
              }, 0);
              return;
            }
            // If cursor is inside badge
            if (selectionStart > start && selectionStart < end) {
              e.preventDefault();
              const newPrompt = prompt.slice(0, start) + prompt.slice(end);
              handlePromptChange(newPrompt);
              setTimeout(() => {
                if (textareaRef.current) {
                  textareaRef.current.selectionStart = textareaRef.current.selectionEnd = start;
                }
              }, 0);
              return;
            }
          }
        }
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
    >
      {/* Studio Header Toolbar */}
      <div className="h-10 border-b border-omp-border bg-omp-surface px-3 flex items-center justify-between select-none shrink-0 font-mono text-xs">
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-1.5 text-xs text-omp-muted">
            <Rune name="tools-sparkles" size={13} className="text-omp-accent" />
            <span className="font-bold text-white uppercase tracking-wider text-[11px]">OH-MY-PI // STUDIO</span>
          </div>

          {cwd && (
            <span className="text-[10px] text-omp-muted hidden sm:inline px-2 py-0.5 rounded-[2px] bg-omp-bg border border-omp-border truncate max-w-sm">
              DIR: {cwd}
            </span>
          )}
        </div>

        <div className="flex items-center space-x-2 text-xs">
          {/* Quick Advisor Toggle Pill in Header */}
          <button
            type="button"
            onClick={() => {
              const next = !advisor;
              setAdvisor(next);
              AppApi.SetAdvisorEnabled(next).catch(console.error);
            }}
            className={`px-2 py-0.5 rounded-[2px] text-[11px] font-mono flex items-center space-x-1.5 transition border ${
              advisor
                ? 'bg-omp-accent/15 text-white border-omp-accent/50'
                : 'bg-omp-bg text-omp-muted hover:text-white border-omp-border'
            }`}
            title="Advisor Rolünü Aç / Kapat"
          >
            <Rune name="identity-shield-check" size={12} className={advisor ? 'text-omp-accent' : 'text-omp-muted'} />
            <span>ADVISOR: {advisor ? 'ON' : 'OFF'}</span>
          </button>

          {isWorking && (
            <div className="flex items-center space-x-1.5 text-omp-warning font-mono animate-pulse text-[11px]">
              <Rune name="schedule-refresh-cw" size={12} className="animate-spin" />
              <span>EXECUTING...</span>
            </div>
          )}

          {onClearConsole && (
            <button
              onClick={onClearConsole}
              className="text-omp-muted hover:text-white px-2 py-0.5 rounded-[2px] text-[11px] font-mono hover:bg-omp-bg transition border border-omp-border"
            >
              TEMİZLE
            </button>
          )}
        </div>
      </div>

      {/* Main Messages Area */}
      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-4">
        {messages.length === 0 ? (
          /* Swiss Poster Welcome Screen */
          <div className="h-full flex flex-col items-center justify-center text-center p-8 select-none">
            <div className="w-12 h-12 bg-omp-accent text-white flex items-center justify-center font-mono font-bold text-xl mb-4 shadow-sm rounded-[2px]">
              π
            </div>
            <div className="text-[10px] font-mono uppercase tracking-widest text-omp-accent font-bold mb-1">
              SYSTEM // ARCHITECTURE
            </div>
            <h2 className="text-xl font-bold tracking-tight text-white mb-2 uppercase">
              OH-MY-PI AGENT RUNTIME
            </h2>
            <p className="text-xs text-omp-muted max-w-md mb-8 leading-relaxed font-sans">
              Yerel <code className="text-white font-mono bg-omp-surface px-1.5 py-0.5 border border-omp-border rounded-[2px]">oh-my-pi</code> asistanı ile kod yazın, mimari kararlar alın ve sistemleri otonom olarak yönetin.
            </p>
            <div className="grid grid-cols-2 gap-3 max-w-lg w-full text-left font-mono">
              <button
                onClick={() => setPrompt("Bu projenin mimarisini ve dosyalarını incele")}
                className="p-3.5 rounded-[2px] bg-omp-surface border border-omp-border hover:border-omp-accent transition text-xs group"
              >
                <div className="flex items-center space-x-1.5 font-bold text-white group-hover:text-omp-accent transition text-[11px] uppercase tracking-wider">
                  <Rune name="tools-search" size={13} className="text-omp-accent" />
                  <span>01 // MİMARİYİ İNCELE</span>
                </div>
                <p className="text-omp-muted text-[11px] mt-1.5 font-sans leading-normal">Dosya yapısını ve bağımlılıkları haritalandır</p>
              </button>
              <button
                onClick={() => {
                  setGoalMode(true);
                  setPrompt("Koddaki tüm hataları tespit et ve testleri çalıştır");
                }}
                className="p-3.5 rounded-[2px] bg-omp-surface border border-omp-border hover:border-omp-accent transition text-xs group"
              >
                <div className="flex items-center space-x-1.5 font-bold text-white group-hover:text-omp-accent transition text-[11px] uppercase tracking-wider">
                  <Rune name="indicators-check" size={13} className="text-omp-success" />
                  <span>02 // HEDEF MODU (GOAL)</span>
                </div>
                <p className="text-omp-muted text-[11px] mt-1.5 font-sans leading-normal">Hata ayıkla ve testleri başarıyla tamamla</p>
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
                <div className="flex items-center space-x-2 text-[10px] font-mono uppercase text-omp-muted px-1 select-none">
                  <span className={`font-bold tracking-wider ${msg.role === 'user' ? 'text-omp-accent' : 'text-white'}`}>
                    {msg.role === 'user' ? 'USER // PROMPT' : 'OH-MY-PI // ASSISTANT'}
                  </span>
                  <span>•</span>
                  <span className="tabular-nums">{new Date(msg.timestamp).toLocaleTimeString()}</span>
                  {msg.role === 'assistant' && rawText && (
                    <button
                      onClick={() => copyToClipboard(rawText, msg.id)}
                      className="ml-2 hover:text-white transition p-0.5 rounded-[2px]"
                      title="Cevabı Kopyala"
                    >
                      {copiedId === msg.id ? (
                        <Rune name="indicators-check" size={12} className="text-omp-success" />
                      ) : (
                        <Rune name="code-copy" size={12} />
                      )}
                    </button>
                  )}
                </div>

                {/* Message Card */}
                <div
                  className={`px-5 py-4 text-sm leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-omp-surface border border-omp-border text-white rounded-[2px] max-w-3xl'
                      : 'bg-omp-bg border-l-2 border-l-omp-accent border-y border-r border-omp-border text-white rounded-[2px] w-full'
                  }`}
                >
                  {msg.role === 'user' && msg.text.startsWith('[KOMUT: /compact') ? (
                    <div className="flex items-center space-x-2 font-mono text-xs font-semibold text-amber-400">
                      <span>⚡</span>
                      <span>/compact — Bağlam sıkıştırma talebi</span>
                    </div>
                  ) : null}

                  {/* Thinking Section */}
                  {displayThinking ? (
                    <div className="mb-3.5 pb-3 border-b border-omp-border/80 select-text">
                      <div className="flex items-center space-x-1.5 text-zinc-400 font-bold uppercase text-[10px] tracking-wider mb-1.5 select-none font-mono">
                        <Rune name="tools-sparkles" size={12} className="text-omp-accent shrink-0" />
                        <span>REASONING STREAM // THINKING</span>
                      </div>
                      <div className="text-zinc-300 font-mono text-[11px] leading-relaxed bg-omp-surface/80 p-3 rounded-[2px] border border-omp-border whitespace-pre-wrap">
                        {displayThinking}
                      </div>
                    </div>
                  ) : null}

                  {/* Active working indicator while assistant is generating */}
                  {isCurrentlyRunning && !rawText && (
                    <div className="flex items-center space-x-2 text-omp-warning text-xs font-mono py-1 animate-pulse select-none">
                      <Rune name="schedule-refresh-cw" size={12} className="animate-spin text-omp-warning shrink-0" />
                      <span>{msg.workingStatus || 'Düşünüyor ve yanıt hazırlıyor...'}</span>
                    </div>
                  )}

                  {/* Main Response in Bright White */}
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
        {/* Context Size Progress Bar & Git Branch Info Bar right above the input */}
        <div className="flex items-center justify-between px-1 text-xs select-none font-mono">
          {/* Left: Git Branch (if available) */}
          <div className="flex items-center space-x-2">
            {gitBranch ? (
              <div 
                className="flex items-center space-x-1.5 px-2 py-0.5 rounded-[2px] bg-omp-bg border border-omp-border text-zinc-300 text-[11px] font-mono"
                title={`Aktif Git Dalı: ${gitBranch}`}
              >
                <Rune name="code-git-branch" size={12} className="text-omp-accent" />
                <span className="font-bold text-white uppercase">{gitBranch}</span>
              </div>
            ) : null}
          </div>

          {/* Right: Cost & Context Size Progress Bar */}
          <div className="flex items-center space-x-2.5">
            {/* omp Session Cost Readout */}
            <div 
              className="flex items-center space-x-1 px-2 py-0.5 rounded-[2px] bg-omp-bg border border-omp-border text-[11px] font-mono"
              title={`Kullanım Tutarı (Cost): Ana Model $${mainCost.toFixed(2)}${advisorCost > 0 ? ` + Advisor $${advisorCost.toFixed(2)}` : ''}`}
            >
              <span className="font-bold text-[#e5c07b]">
                ${mainCost.toFixed(2)}
              </span>
              {advisorCost > 0 && (
                <span className="flex items-center space-x-0.5 text-zinc-300 text-[10px]">
                  <span className="text-zinc-500">+</span>
                  <span className="text-[#e5c07b]">👁{advisorCost.toFixed(2)}</span>
                </span>
              )}
            </div>

            <span className="text-[11px] text-omp-muted">
              CTX: <span className="text-zinc-200 font-bold tabular-nums">{formatTokens(usedTokens)}</span> / {formatTokens(modelLimit)}
            </span>
            <div className="w-24 sm:w-32 bg-omp-bg rounded-[2px] h-2 overflow-hidden border border-omp-border">
              <div
                className={`h-full transition-all duration-300 ${
                  contextPercent >= 90
                    ? 'bg-omp-error'
                    : contextPercent >= 70
                    ? 'bg-omp-warning'
                    : 'bg-omp-accent'
                }`}
                style={{ width: `${Math.min(100, Math.max(contextPercent > 0 ? 2 : 0, contextPercent))}%` }}
              />
            </div>
            <span className={`text-[10px] font-bold font-mono tabular-nums ${
              contextPercent >= 90 ? 'text-omp-error' : contextPercent >= 70 ? 'text-omp-warning' : 'text-omp-accent'
            }`}>
              %{contextPercent.toFixed(1)}
            </span>
          </div>
        </div>

        {/* Attached files bar */}
        {/* Attached files & image previews bar (terminal UI matching Image #1) */}
        {attachedFiles.length > 0 && (
          <div className="flex flex-wrap items-center gap-3 pb-1">
            {attachedFiles.map((f, idx) => {
              const meta = imageMetaMap[f];
              const isImage = !!meta || /\.(png|jpe?g|webp|gif|bmp)$/i.test(f);

              if (isImage) {
                const imgNum = meta?.num || (idx + 1);
                const paletteIndex = (imgNum - 1) % 5;
                const palette = [
                  { border: 'border-amber-400', text: 'text-amber-400' },
                  { border: 'border-cyan-400', text: 'text-cyan-400' },
                  { border: 'border-emerald-400', text: 'text-emerald-400' },
                  { border: 'border-purple-400', text: 'text-purple-400' },
                  { border: 'border-rose-400', text: 'text-rose-400' },
                ][paletteIndex];

                return (
                  <div
                    key={f + idx}
                    className={`relative w-28 h-28 rounded-xl border-2 ${palette.border} bg-[#0d1117] p-2 flex flex-col justify-between items-center group shadow-md transition-transform hover:scale-[1.02] select-none`}
                  >
                    {/* Top Row: Camera icon + #Num + Close button */}
                    <div className="w-full flex items-center justify-between">
                      <span className={`font-mono text-xs font-bold flex items-center space-x-1 ${palette.text}`}>
                        <span>📷</span>
                        <span>#{imgNum}</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveAttachment(idx, f)}
                        className="text-zinc-500 hover:text-red-400 transition text-xs font-bold leading-none p-0.5"
                        title="Eki kaldır"
                      >
                        ✕
                      </button>
                    </div>

                    {/* Middle: Preview Thumbnail */}
                    <div className="flex-1 flex items-center justify-center p-1 w-full overflow-hidden">
                      {meta?.dataUrl ? (
                        <img
                          src={meta.dataUrl}
                          alt={`#${imgNum}`}
                          className="max-h-12 max-w-full object-contain rounded"
                        />
                      ) : (
                        <Rune name="playback-image" size={20} className={palette.text} />
                      )}
                    </div>

                    {/* Bottom: Dimensions */}
                    <div className={`font-mono text-[11px] font-semibold ${palette.text}`}>
                      {meta?.width && meta?.height ? `${meta.width}x${meta.height}` : 'Image'}
                    </div>
                  </div>
                );
              }

              return (
                <span
                  key={f + idx}
                  className="text-xs bg-omp-bg border border-omp-border text-white px-2.5 py-1 rounded-[2px] flex items-center space-x-1.5 font-mono"
                >
                  <Rune name="documents-paperclip" size={12} className="text-omp-accent" />
                  <button
                    type="button"
                    onClick={() => handleRemoveAttachment(idx, f)}
                    className="text-omp-muted hover:text-omp-error ml-1 font-bold"
                  >
                    ✕
                  </button>
                </span>
              );
            })}
          </div>
        )}

        {/* Text Input area */}
        <form onSubmit={handleSubmit} className="relative flex items-end space-x-2">
          <div className="flex-1 bg-omp-bg border border-omp-border rounded-[2px] focus-within:border-omp-accent transition-colors p-2.5 relative">
            {/* Slash Command Autocomplete Popover */}
            {prompt.startsWith('/') && filteredCommands.length > 0 && (
              <div 
                ref={commandListRef}
                className="absolute bottom-[calc(100%+8px)] left-0 right-0 z-40 bg-omp-surfaceElevated border border-omp-border rounded-[2px] shadow-2xl p-2 max-h-72 overflow-y-auto font-mono text-xs animate-fadeIn select-none"
              >
                {/* Header */}
                <div className="flex items-center space-x-1.5 px-2 py-1 text-omp-accent text-[11px] font-bold border-b border-omp-border/60 mb-1">
                  <span className="text-white font-bold text-xs">COMMANDS //</span>
                  <span className="text-omp-muted font-normal text-[10px] ml-auto">
                    ↑↓ SEÇ · ENTER UYGULA · ESC ÇIK
                  </span>
                </div>

                <div className="space-y-0.5">
                  {filteredCommands.map((cmd, idx) => {
                    const isSelected = idx === selectedCmdIndex;
                    return (
                      <div
                        key={cmd.id}
                        data-selected={isSelected}
                        onClick={() => selectCommand(cmd)}
                        onMouseEnter={() => setSelectedCmdIndex(idx)}
                        className={`px-2.5 py-1.5 rounded-[2px] flex items-center cursor-pointer transition-colors ${
                          isSelected 
                            ? 'bg-omp-accent text-white font-semibold' 
                            : 'hover:bg-omp-surfaceLight text-zinc-300'
                        }`}
                      >
                        <span className={`w-3.5 text-xs font-bold shrink-0 ${isSelected ? 'text-white' : 'text-transparent'}`}>
                          ›
                        </span>
                        <span className={`w-5 text-center text-xs shrink-0 mr-1.5 ${isSelected ? 'text-white' : cmd.glyphColor}`}>
                          {cmd.glyph}
                        </span>
                        <span className="font-mono font-bold text-xs tracking-tight shrink-0 mr-4">
                          {cmd.name}
                        </span>
                        <span className={`text-[11px] truncate font-sans ${isSelected ? 'text-white/80' : 'text-omp-muted'}`}>
                          {cmd.description}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Workspace File Autocomplete Popover (@...) */}
            {isAtActive && (
              <div 
                ref={fileListRef}
                className="absolute bottom-[calc(100%+8px)] left-0 right-0 z-40 bg-omp-surfaceElevated border border-omp-border rounded-[2px] shadow-2xl p-2 max-h-72 overflow-y-auto font-mono text-xs animate-fadeIn select-none"
              >
                <div className="flex items-center space-x-1.5 px-2 py-1 text-omp-accent text-[11px] font-bold border-b border-omp-border/60 mb-1">
                  <span className="text-white font-bold text-xs">FILES // @{atQuery}</span>
                  <span className="text-omp-muted font-normal text-[10px] ml-auto">
                    ↑↓ SEÇ · TAB/ENTER EKLE · ESC ÇIK
                  </span>
                </div>

                {isLoadingFiles ? (
                  <div className="py-3 px-3 text-center text-omp-muted text-[11px] animate-pulse">
                    Dosyalar taranıyor...
                  </div>
                ) : workspaceFiles.length === 0 ? (
                  <div className="py-3 px-3 text-center text-omp-muted text-[11px]">
                    Eşleşen dosya veya klasör bulunamadı
                  </div>
                ) : (
                  <div className="space-y-0.5">
                    {workspaceFiles.map((item, idx) => {
                      const isSelected = idx === selectedFileIndex;
                      return (
                        <div
                          key={item.relPath + (item.isDir ? '/' : '')}
                          data-selected={isSelected}
                          onClick={() => selectWorkspaceItem(item)}
                          onMouseEnter={() => setSelectedFileIndex(idx)}
                          className={`px-2.5 py-1.5 rounded-[2px] flex items-center justify-between cursor-pointer transition-colors ${
                            isSelected 
                              ? 'bg-omp-accent text-white font-semibold' 
                              : 'hover:bg-omp-surfaceLight text-zinc-300'
                          }`}
                        >
                          <div className="flex items-center space-x-1.5 min-w-0 pr-3">
                            <span className={`w-3.5 text-xs font-bold shrink-0 ${isSelected ? 'text-white' : 'text-transparent'}`}>
                              ›
                            </span>
                            {item.isDir ? (
                              <Rune name="documents-folder" size={13} className={isSelected ? 'text-white' : 'text-zinc-400'} />
                            ) : (
                              <Rune name="documents-file-text" size={13} className={isSelected ? 'text-white' : 'text-zinc-400'} />
                            )}
                            <span className="font-mono text-xs tracking-tight truncate">
                              {item.name}
                            </span>
                          </div>
                          <div className={`font-mono text-[11px] shrink-0 ml-auto pl-2 ${isSelected ? 'text-white/80' : 'text-omp-muted'}`}>
                            {item.relPath}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Inline Badges Row inside composer box */}
            {Object.keys(imageMetaMap).length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 px-1 pt-1 pb-1.5 border-b border-omp-border/30 mb-1 select-none">
                {Object.values(imageMetaMap).map((meta) => {
                  const palette = [
                    { border: 'border-amber-400/60', text: 'text-amber-400', bg: 'bg-amber-400/15' },
                    { border: 'border-cyan-400/60', text: 'text-cyan-400', bg: 'bg-cyan-400/15' },
                    { border: 'border-emerald-400/60', text: 'text-emerald-400', bg: 'bg-emerald-400/15' },
                    { border: 'border-purple-400/60', text: 'text-purple-400', bg: 'bg-purple-400/15' },
                    { border: 'border-rose-400/60', text: 'text-rose-400', bg: 'bg-rose-400/15' },
                  ][(meta.num - 1) % 5];

                  return (
                    <span
                      key={meta.path}
                      className={`inline-flex items-center space-x-1.5 px-2 py-0.5 rounded-[2px] text-xs font-mono font-bold border ${palette.border} ${palette.bg} ${palette.text} shadow-sm transition hover:brightness-110`}
                    >
                      <span>📷</span>
                      <span>#{meta.num}</span>
                      {meta.width && meta.height && (
                        <span className="text-[10px] opacity-75 font-normal ml-0.5">
                          ({meta.width}x{meta.height})
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => handleRemoveAttachment(attachedFiles.indexOf(meta.path), meta.path)}
                        className="hover:text-red-400 text-xs ml-1 opacity-70 hover:opacity-100 transition font-bold"
                        title="Rozeti ve görseli kaldır"
                      >
                        ✕
                      </button>
                    </span>
                  );
                })}
              </div>
            )}

            <BadgePromptInput
              value={prompt}
              onChange={handlePromptChange}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              placeholder="Mesajınızı yazın veya ekran görüntüsü / dosya yapıştırın (Ctrl+V)..."
            />

            {/* Quick action bar inside composer */}
            <div className="flex items-center justify-between pt-2 border-t border-omp-border text-xs select-none">
              <div className="flex items-center space-x-1.5">
                <button
                  type="button"
                  onClick={onSelectFiles}
                  title="Dosya ekle"
                  className="flex items-center space-x-1 text-omp-muted hover:text-white px-2 py-1 rounded-[2px] hover:bg-omp-surface font-mono text-[11px] transition"
                >
                  <Rune name="documents-paperclip" size={13} />
                  <span>DOSYA</span>
                </button>

                {/* Parameters Dialog Trigger */}
                <button
                  type="button"
                  onClick={() => setShowParamsDialog(true)}
                  className="flex items-center space-x-1 text-omp-muted hover:text-white px-2 py-1 rounded-[2px] hover:bg-omp-surface font-mono text-[11px] transition"
                  title="Çalıştırma Parametreleri (Düşünme ve İzinler)"
                >
                  <Rune name="metrics-sliders-horizontal" size={13} className="text-omp-accent" />
                  <span>PARAM</span>
                </button>

                {/* Model Wizard Button */}
                <button
                  type="button"
                  onClick={() => setShowRoleWizard(true)}
                  className="flex items-center space-x-1 px-2.5 py-1 rounded-[2px] bg-omp-surface hover:bg-omp-surfaceLight border border-omp-border text-white text-[11px] font-mono transition"
                  title="Model & 3 Aşamalı Rol Atama Sihirbazını Aç"
                >
                  <Rune name="code-server" size={13} className="text-omp-accent" />
                  <span>MODEL</span>
                </button>
              </div>

              {/* Model & Thinking status pills */}
              <div className="flex items-center space-x-1.5 text-[11px] font-mono">
                {advisor && (
                  <button
                    type="button"
                    onClick={() => setShowParamsDialog(true)}
                    className="flex items-center space-x-1 px-2 py-0.5 rounded-[2px] bg-rose-500/15 border border-rose-500/30 text-rose-300 font-mono hover:bg-rose-500/25 transition"
                    title={`Advisor Aktif: ${advisorModel || currentRoles['advisor'] || 'advisor'}`}
                  >
                    <Rune name="senses-eye" size={12} className="text-rose-400" />
                    <span>{(advisorModel || currentRoles['advisor'] || 'advisor').split('/').pop()?.split(':')[0]}</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setShowRoleWizard(true)}
                  className="px-2 py-0.5 rounded-[2px] bg-omp-surface border border-omp-border text-white font-mono hover:border-omp-accent transition"
                  title="Model & Rol Sihirbazını Aç"
                >
                  {selectedModel.split('/').pop() || 'gemini-3.8-flash'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowParamsDialog(true)}
                  className="px-2 py-0.5 rounded-[2px] bg-omp-surface border border-omp-border text-zinc-300 font-mono hover:border-omp-accent transition"
                  title="Düşünme seviyesi değiştir"
                >
                  THINK: {thinkingLevel.toUpperCase()}
                </button>
              </div>
            </div>
          </div>

          {/* Run or Stop button */}
          {isWorking ? (
            <button
              type="button"
              onClick={onStopAgent}
              className="h-10 px-4 rounded-[2px] bg-omp-error hover:bg-red-700 text-white font-mono font-bold text-xs uppercase tracking-wider flex items-center space-x-1.5 transition shadow-sm shrink-0"
            >
              <Rune name="indicators-square-stop" size={14} />
              <span>DURDUR</span>
            </button>
          ) : (
            <button
              type="submit"
              disabled={!prompt.trim() && attachedFiles.length === 0}
              className="h-10 px-5 rounded-[2px] bg-gradient-to-r from-[#E84AC3] to-[#6EADEE] hover:opacity-95 disabled:opacity-30 disabled:from-zinc-800 disabled:to-zinc-800 text-white font-mono font-bold text-xs uppercase tracking-wider flex items-center space-x-1.5 transition shadow-sm shrink-0"
            >
              <Rune name="messaging-send" size={14} />
              <span>GÖNDER</span>
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

      {/* Swiss Command Help Modal (/help) */}
      <div
        className={`fixed inset-0 z-50 flex items-center justify-center p-4 select-none font-mono text-xs transition-all duration-200 ease-out ${
          showHelpModal ? 'pointer-events-auto visible opacity-100' : 'pointer-events-none invisible opacity-0'
        }`}
      >
        <div
          onClick={() => setShowHelpModal(false)}
          className={`absolute inset-0 bg-black/75 backdrop-blur-xs transition-opacity duration-200 ease-out ${
            showHelpModal ? 'opacity-100' : 'opacity-0'
          }`}
        />
        <div
          onClick={(e) => e.stopPropagation()}
          className={`relative w-full max-w-2xl bg-omp-surface border border-omp-border rounded-[2px] shadow-2xl flex flex-col max-h-[85vh] overflow-hidden transition-all duration-200 ease-out transform ${
            showHelpModal ? 'scale-100 opacity-100 translate-y-0' : 'scale-95 opacity-0 translate-y-2'
          }`}
        >
          <div className="px-5 py-3 border-b border-omp-border flex items-center justify-between bg-omp-surface">
            <div className="flex items-center space-x-2.5">
                <div className="w-6 h-6 bg-omp-accent flex items-center justify-center font-bold text-white rounded-[2px]">
                  <Rune name="code-terminal" size={13} />
                </div>
                <h3 className="font-bold text-white text-xs uppercase tracking-wider">
                  COMMANDS & SHORTCUTS GUIDE (/HELP)
                </h3>
              </div>
              <button
                onClick={() => setShowHelpModal(false)}
                className="p-1 rounded-[2px] hover:bg-omp-bg text-omp-muted hover:text-white"
              >
                <Rune name="indicators-x" size={14} />
              </button>
            </div>

            <div className="p-4 overflow-y-auto space-y-2">
              <div className="border border-omp-border rounded-[2px] overflow-hidden divide-y divide-omp-border bg-omp-bg">
                {[
                  { cmd: '/skill:<name> [prompt]', desc: 'Seçili becerinin yönergelerini bağlama yükler ve çalıştırır (örn: /skill:brand-voice)', glyph: '✦', col: 'text-cyan-400' },
                  { cmd: '/clear, /new', desc: 'Mevcut sohbet mesajlarını temizler ve oturumu sıfırlar', glyph: '🗑', col: 'text-red-400' },
                  { cmd: '/model [isim]', desc: 'Model & Rol sihirbazını açar veya yazılan modeli seçer', glyph: '⬡', col: 'text-blue-400' },
                  { cmd: '/usage, /stats', desc: 'Canlı sağlayıcı kotalarını ve hız sınırlarını görüntüler', glyph: '⚡', col: 'text-amber-400' },
                  { cmd: '/compact [odak]', desc: 'Konuşma geçmişini analiz edip bağlamı sıkıştırır', glyph: 'G', col: 'text-purple-400' },
                  { cmd: '/advisor [on|off]', desc: 'Pasif güvenlik ve mimari danışmanını açar / kapatır', glyph: '👁', col: 'text-rose-400' },
                  { cmd: '/skills', desc: 'Beceri kütüphanesini ve özel skill editörünü açar', glyph: '✦', col: 'text-cyan-400' },
                  { cmd: '/settings', desc: 'Konfigürasyon ve model sağlayıcı girişini (/login) açar', glyph: '⚙', col: 'text-zinc-300' },
                  { cmd: '/devtools', desc: 'Geliştirici araçlarını (Git, Ps, Cleanse) açar', glyph: '⌘', col: 'text-zinc-300' },
                  { cmd: '/resume', desc: 'Kayıtlı oturumlar çekmecesini açar', glyph: '🕒', col: 'text-zinc-300' },
                  { cmd: '/loop [on|off]', desc: 'Hedef (Goal) döngü modunu etkinleştirir / kapatır', glyph: '↺', col: 'text-emerald-400' },
                  { cmd: '/btw [soru]', desc: 'Ana bağlamı kirletmeden yan soru sorar', glyph: '?', col: 'text-red-400' },
                  { cmd: '/help', desc: 'Bu komut yardım ve kısayollar kılavuzunu görüntüler', glyph: 'ℹ', col: 'text-cyan-400' },
                ].map((item) => (
                  <div key={item.cmd} className="p-2.5 flex items-start justify-between gap-3 text-xs hover:bg-omp-surface transition">
                    <div className="flex items-center space-x-2">
                      <span className={`w-4 text-center font-bold ${item.col}`}>{item.glyph}</span>
                      <span className="font-bold text-white font-mono">{item.cmd}</span>
                    </div>
                    <div className="text-[11px] text-omp-muted font-sans text-right max-w-sm">
                      {item.desc}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="px-5 py-2.5 border-t border-omp-border bg-omp-surface flex items-center justify-between">
              <span className="text-[10px] text-omp-muted uppercase">İpucu: Mesaj alanında &apos;/&apos; tuşuna basarak anında tamamlayabilirsiniz.</span>
              <button
                onClick={() => setShowHelpModal(false)}
                className="px-3 py-1 rounded-[2px] bg-omp-accent hover:bg-omp-accentHover text-white font-bold text-xs uppercase"
              >
                KAPAT
              </button>
            </div>
          </div>
        </div>
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
    <div className="border border-omp-border bg-omp-surface rounded-[2px] p-3 text-xs space-y-2 font-mono">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Rune name="tools-settings" size={13} className="text-omp-accent" />
          <span className="font-bold text-white uppercase text-[11px] tracking-wider">
            OP // {call.tool}
          </span>
        </div>
        <span
          className={`text-[10px] px-2 py-0.5 rounded-[2px] uppercase font-bold tracking-wider ${
            call.status === 'pending'
              ? 'bg-omp-warning/20 text-omp-warning border border-omp-warning/40'
              : call.status === 'completed'
              ? 'bg-omp-success/20 text-omp-success border border-omp-success/40'
              : 'bg-omp-error/20 text-omp-error border border-omp-error/40'
          }`}
        >
          {call.status}
        </span>
      </div>

      {call.args && (
        <div className="p-2.5 rounded-[2px] bg-omp-bg border border-omp-border font-mono text-[11px] text-zinc-300 overflow-x-auto max-h-48 whitespace-pre-wrap">
          {typeof call.args === 'string' ? call.args : JSON.stringify(call.args, null, 2)}
        </div>
      )}

      {call.status === 'pending' && (
        <div className="flex items-center justify-end space-x-2 pt-2 border-t border-omp-border/60">
          <button
            onClick={onReject}
            className="flex items-center space-x-1.5 px-3 py-1 rounded-[2px] border border-omp-error/40 bg-omp-error/10 hover:bg-omp-error/20 text-omp-error font-mono font-bold text-xs uppercase tracking-wider transition"
          >
            <Rune name="indicators-x" size={11} />
            <span>REDDET</span>
          </button>
          <button
            onClick={onApprove}
            className="flex items-center space-x-1.5 px-3 py-1 rounded-[2px] border border-omp-success/40 bg-omp-success/15 hover:bg-omp-success/25 text-omp-success font-mono font-bold text-xs uppercase tracking-wider transition"
          >
            <Rune name="indicators-check" size={11} />
            <span>ONAYLA</span>
          </button>
        </div>
      )}
    </div>
  );
};
