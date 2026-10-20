import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, 
  Search, 
  Sparkles, 
  Cpu, 
  BrainCircuit, 
  Check, 
  Plus, 
  ChevronRight, 
  Layers,
  Zap,
  Shield,
  Eye,
  GitCommit,
  Bot,
  Scale,
  Globe,
  SlidersHorizontal,
  Bookmark
} from 'lucide-react';
import { ModelEntry } from '../types';

export interface RoleAssignmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  availableModels: ModelEntry[];
  currentRoles: Record<string, string>;
  onSaveRole: (role: string, modelWithThinking: string) => Promise<void>;
  initialModel?: string;
  initialRole?: string;
}

const BUILT_IN_ROLES = [
  { id: 'default', label: 'default', icon: Sparkles, desc: 'Varsayılan birincil sohbet ve kodlama modeli' },
  { id: 'smol', label: 'smol', icon: Zap, desc: 'Hızlı ve ekonomik yardımcı model' },
  { id: 'slow', label: 'slow', icon: BrainCircuit, desc: 'Ağır mantık ve derin muhakeme modeli' },
  { id: 'vision', label: 'vision', icon: Eye, desc: 'Görsel ve ekran görüntüsü analiz modeli' },
  { id: 'plan', label: 'plan', icon: Layers, desc: 'Mimari planlama ve yol haritası modeli' },
  { id: 'commit', label: 'commit', icon: GitCommit, desc: 'Git commit mesajı oluşturucu model' },
  { id: 'tiny', label: 'tiny', icon: Cpu, desc: 'Ultra hafif yerel veya bulut model' },
  { id: 'memory', label: 'memory', icon: Bookmark, desc: 'Oturum hafızası ve özetleme modeli' },
  { id: 'task', label: 'task', icon: Bot, desc: 'Paralel subagent ve görev yöneticisi' },
  { id: 'advisor', label: 'advisor', icon: Shield, desc: 'Pasif güvenlik ve mimari denetim modeli' },
  { id: 'widget', label: 'widget', icon: SlidersHorizontal, desc: 'Arayüz ve widget etkileşim modeli' },
  { id: 'web', label: 'web', icon: Globe, desc: 'İnternet araması ve sayfa okuma modeli' },
  { id: 'judge', label: 'judge', icon: Scale, desc: 'Değerlendirme ve sınıflandırma modeli' },
];

const THINKING_LEVELS = [
  { id: 'inherit', label: 'inherit', symbol: '⊡', desc: 'Modelin veya sistemin varsayılanını miras al' },
  { id: 'off', label: 'off', symbol: '⊘', desc: 'Düşünme kapalı, doğrudan yanıt' },
  { id: 'auto', label: 'auto', symbol: '↻', desc: 'Model karmaşıklığa göre belirler (Önerilen)' },
  { id: 'min', label: 'min', symbol: '◌', desc: 'Minimum düşünme bütçesi' },
  { id: 'low', label: 'low', symbol: '◔', desc: 'Düşük düşünme bütçesi' },
  { id: 'medium', label: 'medium', symbol: '◑', desc: 'Orta seviye düşünme bütçesi' },
  { id: 'high', label: 'high', symbol: '◕', desc: 'Yüksek ve detaylı düşünme bütçesi' },
  { id: 'max', label: 'max', symbol: '●', desc: 'Maksimum genişletilmiş düşünme (64k)' },
];

export const RoleAssignmentModal: React.FC<RoleAssignmentModalProps> = ({
  isOpen,
  onClose,
  availableModels,
  currentRoles,
  onSaveRole,
  initialModel = '',
  initialRole = '',
}) => {
  // Step 1: Model Selection
  const [selectedModel, setSelectedModel] = useState<string>(initialModel);
  // Step 2: Role Selection
  const [selectedRole, setSelectedRole] = useState<string>(initialRole);
  const [customRoleInput, setCustomRoleInput] = useState<string>('');
  const [isCreatingCustom, setIsCreatingCustom] = useState<boolean>(false);
  // Step 3: Thinking Level Selection
  const [selectedThinking, setSelectedThinking] = useState<string>('auto');

  // Filter states for Step 1
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedKind, setSelectedKind] = useState<string>('all');
  const [selectedProvider, setSelectedProvider] = useState<string>('all');
  const [isSaving, setIsSaving] = useState(false);

  // Active step (1: Model, 2: Role, 3: Thinking Level) - Alway starts at 1 when opened
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Reset to Step 1 whenever modal opens
  useEffect(() => {
    if (isOpen) {
      setStep(1);
      setSelectedModel(initialModel || '');
      setSelectedRole(initialRole || '');
      setSelectedThinking('inherit');
      setCustomRoleInput('');
      setIsCreatingCustom(false);
      setSearchQuery('');
    }
  }, [isOpen]);
  // Extract providers and kinds
  const providersWithCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const m of availableModels) {
      const p = m.provider || 'other';
      counts[p] = (counts[p] || 0) + 1;
    }
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [availableModels]);

  const kinds = useMemo(() => {
    const s = new Set<string>();
    s.add('all');
    for (const m of availableModels) {
      if (m.kind) s.add(m.kind);
    }
    return Array.from(s);
  }, [availableModels]);

  // Filtered models for Step 1
  const filteredModels = useMemo(() => {
    return availableModels.filter((m) => {
      if (selectedKind !== 'all' && m.kind !== selectedKind) return false;
      if (selectedProvider !== 'all' && m.provider !== selectedProvider) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const id = (m.id || '').toLowerCase();
        const sel = (m.selector || '').toLowerCase();
        const name = (m.name || '').toLowerCase();
        const prov = (m.provider || '').toLowerCase();
        return id.includes(q) || sel.includes(q) || name.includes(q) || prov.includes(q);
      }
      return true;
    });
  }, [availableModels, selectedKind, selectedProvider, searchQuery]);

  // Combined roles list: built-in + currently active custom roles
  const allRoles = useMemo(() => {
    const list = [...BUILT_IN_ROLES];
    const builtInIds = new Set(BUILT_IN_ROLES.map((r) => r.id));

    for (const roleKey of Object.keys(currentRoles)) {
      if (!builtInIds.has(roleKey)) {
        list.push({
          id: roleKey,
          label: roleKey,
          icon: Sparkles,
          desc: 'Kullanıcı tanımlı özel rol',
        });
      }
    }
    return list;
  }, [currentRoles]);
  // Dynamically filter thinking levels based on selected model's capabilities
  const modelSpecificThinkingLevels = useMemo(() => {
    const m = (selectedModel || '').toLowerCase();
    const modelObj = availableModels.find(
      (mod) => (mod.selector || mod.id).toLowerCase() === m
    );

    const catalogThinking = modelObj?.thinking;

    return THINKING_LEVELS.filter((lvl) => {
      // inherit, off, auto are universal
      if (lvl.id === 'inherit' || lvl.id === 'off' || lvl.id === 'auto') return true;

      // If model JSON catalog has explicit thinking array
      if (Array.isArray(catalogThinking) && catalogThinking.length > 0) {
        return catalogThinking.includes(lvl.id);
      }

      // Gemini: low, high, min are valid; medium and max are not
      if (m.includes('gemini')) {
        return lvl.id === 'low' || lvl.id === 'high' || lvl.id === 'min';
      }

      // Claude: low, medium, high, max
      if (m.includes('claude')) {
        return lvl.id === 'low' || lvl.id === 'medium' || lvl.id === 'high' || lvl.id === 'max';
      }

      // OpenAI reasoning models
      if (m.includes('o1') || m.includes('o3') || m.includes('gpt-5')) {
        return lvl.id === 'low' || lvl.id === 'medium' || lvl.id === 'high';
      }

      return lvl.id !== 'max';
    });
  }, [selectedModel, availableModels]);


  if (!isOpen) return null;

  // Complete and save the assignment
  const handleComplete = async (thinking = selectedThinking) => {
    if (!selectedModel || !selectedRole) return;

    setIsSaving(true);
    try {
      const formattedValue =
        thinking && thinking !== 'inherit'
          ? `${selectedModel}:${thinking}`
          : selectedModel;

      await onSaveRole(selectedRole, formattedValue);
      onClose();
    } catch (err) {
      console.error('Failed to save role:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddCustomRole = () => {
    const cleaned = customRoleInput.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
    if (!cleaned) return;
    const roleId = cleaned.startsWith('custom-') ? cleaned : `custom-${cleaned}`;
    setSelectedRole(roleId);
    setCustomRoleInput('');
    setIsCreatingCustom(false);
    setStep(3);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn font-sans">
      <div 
        className="w-full max-w-5xl h-[88vh] bg-[#0d1117] border border-omp-border rounded-2xl shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Wizard Header Bar */}
        <div className="px-6 py-4 border-b border-omp-border/80 bg-omp-surface/80 flex items-center justify-between select-none shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-lg bg-omp-accent/15 border border-omp-accent/30 flex items-center justify-center text-omp-accent">
              <Cpu size={18} />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white flex items-center space-x-2">
                <span>Model Rol Atama Sihirbazı</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-omp-surface border border-omp-border font-mono text-omp-accent">
                  Adım {step} / 3
                </span>
              </h3>
              <p className="text-[11px] text-omp-muted">
                {step === 1 && '1. Adım: Bir model seçin veya aratın'}
                {step === 2 && '2. Adım: Modelin atanacağı rolü belirleyin veya yeni bir custom rol oluşturun'}
                {step === 3 && '3. Adım: Role özgü düşünme seviyesini (Thinking Level) seçin'}
              </p>
            </div>
          </div>

          {/* Stepper pills */}
          <div className="flex items-center space-x-2 text-xs">
            <button
              onClick={() => setStep(1)}
              className={`px-3 py-1.5 rounded-lg border transition font-mono ${
                step === 1
                  ? 'bg-omp-accent/20 border-omp-accent text-white font-semibold'
                  : selectedModel
                  ? 'bg-omp-surface border-omp-border text-omp-accent'
                  : 'bg-transparent border-transparent text-omp-muted'
              }`}
            >
              1. Model: {selectedModel ? selectedModel.split('/').pop() : 'Seçilmedi'}
            </button>

            <ChevronRight size={14} className="text-omp-muted" />

            <button
              onClick={() => selectedModel && setStep(2)}
              disabled={!selectedModel}
              className={`px-3 py-1.5 rounded-lg border transition font-mono disabled:opacity-40 ${
                step === 2
                  ? 'bg-omp-accent/20 border-omp-accent text-white font-semibold'
                  : selectedRole
                  ? 'bg-omp-surface border-omp-border text-omp-accent'
                  : 'bg-transparent border-transparent text-omp-muted'
              }`}
            >
              2. Rol: {selectedRole || 'Seçilmedi'}
            </button>

            <ChevronRight size={14} className="text-omp-muted" />

            <button
              onClick={() => selectedModel && selectedRole && setStep(3)}
              disabled={!selectedModel || !selectedRole}
              className={`px-3 py-1.5 rounded-lg border transition font-mono disabled:opacity-40 ${
                step === 3
                  ? 'bg-omp-accent/20 border-omp-accent text-white font-semibold'
                  : 'bg-transparent border-transparent text-omp-muted'
              }`}
            >
              3. Thinking: {selectedThinking}
            </button>

            <button
              onClick={onClose}
              className="ml-4 w-8 h-8 rounded-lg text-omp-muted hover:text-white hover:bg-omp-surfaceLight flex items-center justify-center transition"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Dynamic Context Breadcrumb Bar (matches omp Image #2 & #3) */}
        <div className="h-10 px-6 border-b border-omp-border/60 bg-[#070a0e] flex items-center space-x-2 text-xs font-mono select-none shrink-0 overflow-x-auto">
          {selectedModel && (
            <span className="text-omp-accent font-semibold truncate max-w-xs">
              {selectedModel.split('/').pop() || selectedModel}
            </span>
          )}

          {step >= 2 && selectedModel && (
            <>
              <span className="text-omp-muted">→</span>
              <span className="px-2 py-0.5 rounded bg-omp-accent/20 text-omp-accent font-semibold">
                [ • {selectedRole || 'rol seçin'} ]
              </span>
            </>
          )}

          {step === 3 && (
            <>
              <span className="text-omp-muted">→</span>
              <span className="px-2 py-0.5 rounded bg-omp-purple/20 text-omp-purple font-semibold">
                [ 🧠 {selectedThinking} ]
              </span>
            </>
          )}
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-hidden flex">
          {/* ================= STEP 1: MODEL SELECTION ================= */}
          {step === 1 && (
            <div className="flex-1 flex overflow-hidden">
              {/* Left sidebar: Providers filter */}
              <div className="w-56 border-r border-omp-border/70 bg-[#0a0d12] flex flex-col shrink-0 select-none">
                <div className="p-3 border-b border-omp-border/60 text-[11px] font-semibold text-omp-muted uppercase tracking-wider">
                  Sağlayıcılar ({providersWithCounts.length})
                </div>
                <div className="flex-1 overflow-y-auto p-2 space-y-0.5 text-xs font-mono">
                  <button
                    onClick={() => setSelectedProvider('all')}
                    className={`w-full px-2.5 py-1.5 rounded-lg flex items-center justify-between text-left transition ${
                      selectedProvider === 'all'
                        ? 'bg-omp-accent text-white font-semibold'
                        : 'text-omp-muted hover:text-white hover:bg-omp-surfaceLight/50'
                    }`}
                  >
                    <span>Tümü (All)</span>
                    <span className="text-[10px] opacity-70">{availableModels.length}</span>
                  </button>

                  {providersWithCounts.map(([prov, count]) => (
                    <button
                      key={prov}
                      onClick={() => setSelectedProvider(prov)}
                      className={`w-full px-2.5 py-1.5 rounded-lg flex items-center justify-between text-left transition ${
                        selectedProvider === prov
                          ? 'bg-omp-accent text-white font-semibold'
                          : 'text-omp-muted hover:text-white hover:bg-omp-surfaceLight/50'
                      }`}
                    >
                      <span className="truncate pr-2">• {prov}</span>
                      <span className="text-[10px] opacity-70 shrink-0">{count}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Right main area: Kind filters, Search & Model List */}
              <div className="flex-1 flex flex-col overflow-hidden bg-[#0d1117]">
                {/* Search & Kind Bar */}
                <div className="p-4 border-b border-omp-border/70 space-y-3 bg-omp-surface/30 shrink-0">
                  <div className="flex items-center space-x-2">
                    <div className="flex-1 relative">
                      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-omp-muted" />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Model ara... (örn: gemini-3.8-flash, claude-opus, deepseek, 1m ctx)"
                        className="w-full bg-[#0a0d12] border border-omp-border rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-omp-muted font-mono focus:outline-none focus:border-omp-accent"
                      />
                    </div>
                  </div>

                  {/* Kind filter pills (all, chat, tiny, image, etc. matching Image #1) */}
                  <div className="flex items-center space-x-1.5 overflow-x-auto text-[11px] font-mono select-none">
                    <span className="text-omp-muted mr-1">Kind:</span>
                    {kinds.map((k) => (
                      <button
                        key={k}
                        onClick={() => setSelectedKind(k)}
                        className={`px-2.5 py-1 rounded-md transition ${
                          selectedKind === k
                            ? 'bg-omp-accent text-white font-semibold shadow-sm'
                            : 'bg-omp-surface text-omp-muted hover:text-white border border-omp-border/60'
                        }`}
                      >
                        {k}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Model cards table/list */}
                <div className="flex-1 overflow-y-auto p-4 space-y-2">
                  {filteredModels.length === 0 ? (
                    <div className="text-center py-16 text-xs text-omp-muted">
                      Aradığınız kriterlere uygun model bulunamadı.
                    </div>
                  ) : (
                    filteredModels.map((m) => {
                      const modelSelector = m.selector || m.id;
                      const isSelected = selectedModel === modelSelector;

                      return (
                        <div
                          key={modelSelector}
                          onClick={() => {
                            setSelectedModel(modelSelector);
                            setStep(2);
                          }}
                          className={`p-3 rounded-xl border cursor-pointer transition flex items-center justify-between group ${
                            isSelected
                              ? 'border-omp-accent bg-omp-accent/15'
                              : 'border-omp-border/60 bg-[#0a0d12] hover:border-omp-border hover:bg-omp-surface/40'
                          }`}
                        >
                          <div className="space-y-1 min-w-0 pr-4">
                            <div className="flex items-center space-x-2">
                              <span className="font-mono text-xs font-semibold text-white group-hover:text-omp-accent transition truncate">
                                {modelSelector}
                              </span>
                              {m.kind && (
                                <span className="px-1.5 py-0.5 rounded text-[10px] bg-omp-surface border border-omp-border text-omp-muted uppercase font-mono">
                                  {m.kind}
                                </span>
                              )}
                              {m.reasoning && (
                                <span className="flex items-center space-x-1 text-[10px] px-1.5 py-0.5 rounded bg-pink-500/20 text-pink-400 font-mono">
                                  <span>🧠</span>
                                  <span>reasoning</span>
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-omp-muted truncate font-sans">
                              {m.name || modelSelector}
                            </div>
                          </div>

                          <div className="flex items-center space-x-4 shrink-0 font-mono text-[11px] select-none">
                            {m.contextWindow && (
                              <span className="text-zinc-400">
                                {m.contextWindow >= 1000000
                                  ? `${(m.contextWindow / 1000000).toFixed(0)}m ctx`
                                  : `${(m.contextWindow / 1000).toFixed(0)}k ctx`}
                              </span>
                            )}
                            {m.cost && typeof m.cost.input === 'number' && (
                              <span className="text-zinc-500">
                                {`$${m.cost.input}/${m.cost.output}`}
                              </span>
                            )}
                            <button
                              type="button"
                              className={`px-3 py-1.5 rounded-lg text-xs font-sans transition flex items-center space-x-1 ${
                                isSelected
                                  ? 'bg-omp-accent text-white font-medium'
                                  : 'bg-omp-surface border border-omp-border text-white group-hover:bg-omp-accent group-hover:border-omp-accent'
                              }`}
                            >
                              <span>Seç</span>
                              <ChevronRight size={13} />
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ================= STEP 2: ROLE SELECTION & CREATION ================= */}
          {step === 2 && (
            <div className="flex-1 p-6 overflow-y-auto space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-semibold text-white">Rol Seçin veya Yeni Özel Rol Oluşturun</h4>
                  <p className="text-xs text-omp-muted">
                    Seçili model: <span className="text-omp-accent font-mono font-medium">{selectedModel}</span>
                  </p>
                </div>

                <button
                  onClick={() => setIsCreatingCustom(!isCreatingCustom)}
                  className="px-3.5 py-1.5 rounded-xl bg-omp-surface border border-omp-border hover:border-omp-accent text-white text-xs flex items-center space-x-1.5 transition"
                >
                  <Plus size={14} className="text-omp-accent" />
                  <span>+ Yeni Custom Rol Oluştur</span>
                </button>
              </div>

              {/* Custom Role Creation Input Box */}
              {isCreatingCustom && (
                <div className="p-4 rounded-xl border border-omp-accent/40 bg-omp-accent/10 space-y-3">
                  <div className="text-xs text-white font-medium">Yeni Özel Rol Tanımla</div>
                  <div className="flex items-center space-x-2">
                    <div className="flex-1 relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-omp-muted font-mono text-xs">
                        custom-
                      </span>
                      <input
                        type="text"
                        value={customRoleInput}
                        onChange={(e) => setCustomRoleInput(e.target.value)}
                        placeholder="ornek-rol (örn: review, coder, translator)"
                        className="w-full bg-[#0a0d12] border border-omp-border rounded-xl pl-16 pr-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-omp-accent"
                      />
                    </div>
                    <button
                      onClick={handleAddCustomRole}
                      disabled={!customRoleInput.trim()}
                      className="px-4 py-2 rounded-xl bg-omp-accent hover:bg-omp-accentHover disabled:opacity-40 text-white text-xs font-medium transition"
                    >
                      Ekle & Seç
                    </button>
                  </div>
                  <p className="text-[11px] text-omp-muted">
                    Özel roller <code className="text-omp-accent font-mono">custom-[isim]</code> şeklinde kaydedilir ve omp ortamında doğrudan kullanılabilir.
                  </p>
                </div>
              )}

              {/* Roles Grid (built-in + custom) */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {allRoles.map((r) => {
                  const isSelected = selectedRole === r.id;
                  const currentAssigned = currentRoles[r.id];
                  const Icon = r.icon;

                  return (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => {
                        setSelectedRole(r.id);
                        setStep(3);
                      }}
                      className={`p-3.5 rounded-xl border text-left transition flex flex-col justify-between group ${
                        isSelected
                          ? 'border-omp-accent bg-omp-accent/15 ring-1 ring-omp-accent'
                          : 'border-omp-border/70 bg-[#0a0d12] hover:border-omp-border hover:bg-omp-surface/40'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center space-x-2">
                            <Icon size={15} className={isSelected ? 'text-omp-accent' : 'text-omp-muted group-hover:text-white'} />
                            <span className="font-mono text-xs font-semibold text-white">
                              {r.label}
                            </span>
                          </div>
                          {isSelected && <Check size={14} className="text-omp-accent" />}
                        </div>
                        <p className="text-[11px] text-omp-muted leading-relaxed line-clamp-2">
                          {r.desc}
                        </p>
                      </div>

                      {/* Current assignment pill */}
                      <div className="mt-3 pt-2 border-t border-omp-border/40 text-[10px] font-mono truncate">
                        {currentAssigned ? (
                          <span className="text-zinc-400">
                            Atalı: <span className="text-omp-accent">{currentAssigned.split('/').pop()}</span>
                          </span>
                        ) : (
                          <span className="text-zinc-600">Henüz atanmadı</span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* ================= STEP 3: THINKING LEVEL SELECTION ================= */}
          {step === 3 && (
            <div className="flex-1 p-6 overflow-y-auto space-y-6">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <h4 className="text-sm font-semibold text-white">Düşünme Seviyesi (Thinking Level) Seçin</h4>
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-omp-bg text-omp-accent border border-omp-border">
                    {selectedModel.includes('gemini') ? 'Gemini 3.8 Flash Uyumlu' : 'Modele Özgü Seviyeler'}
                  </span>
                </div>
                <p className="text-xs text-omp-muted">
                  Atama Özeti: <span className="text-white font-mono font-medium">{selectedRole}</span> rolüne{' '}
                  <span className="text-omp-accent font-mono font-medium">{selectedModel}</span> modeli atanıyor.
                </p>
              </div>

              {/* Dynamically filtered Thinking Level Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {modelSpecificThinkingLevels.map((lvl) => {
                  const isSelected = selectedThinking === lvl.id;

                  return (
                    <button
                      key={lvl.id}
                      type="button"
                      onClick={() => {
                        setSelectedThinking(lvl.id);
                        handleComplete(lvl.id);
                      }}
                      className={`p-4 rounded-xl border text-left transition flex flex-col justify-between group ${
                        isSelected
                          ? 'border-omp-accent bg-omp-accent/15 ring-1 ring-omp-accent'
                          : 'border-omp-border/70 bg-[#0a0d12] hover:border-omp-border hover:bg-omp-surface/40'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-base text-omp-accent font-mono">{lvl.symbol}</span>
                          {isSelected && <Check size={14} className="text-omp-accent" />}
                        </div>
                        <div className="font-mono text-xs font-semibold text-white mb-1">
                          {lvl.label}
                        </div>
                        <p className="text-[11px] text-omp-muted leading-relaxed">
                          {lvl.desc}
                        </p>
                      </div>

                      <div className="mt-4 pt-2 border-t border-omp-border/40 text-[10px] font-sans text-omp-accent flex items-center justify-between">
                        <span>Seç ve Kaydet</span>
                        <ChevronRight size={12} />
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Summary & Manual Save */}
              <div className="p-4 rounded-xl border border-omp-border bg-[#0a0d12] flex items-center justify-between">
                <div>
                  <div className="text-xs text-white font-medium">Yapılandırma Biçimi (omp config formatı):</div>
                  <div className="text-xs font-mono text-omp-accent mt-0.5">
                    {selectedRole} = "{selectedModel}{selectedThinking !== 'inherit' ? `:${selectedThinking}` : ''}"
                  </div>
                </div>

                <button
                  type="button"
                  disabled={isSaving}
                  onClick={() => handleComplete()}
                  className="px-5 py-2 rounded-xl bg-omp-accent hover:bg-omp-accentHover disabled:opacity-50 text-white font-medium text-xs shadow-lg transition flex items-center space-x-1.5"
                >
                  <Check size={14} />
                  <span>{isSaving ? 'Kaydediliyor...' : 'Rolü Kaydet'}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
