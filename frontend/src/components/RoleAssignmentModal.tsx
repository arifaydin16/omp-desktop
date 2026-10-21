import React, { useState, useEffect, useMemo } from 'react';
import { Rune } from './Rune';
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
  { id: 'default', label: 'default', icon: 'tools-sparkles', desc: 'Varsayılan birincil sohbet ve kodlama modeli' },
  { id: 'smol', label: 'smol', icon: 'other-zap', desc: 'Hızlı ve ekonomik yardımcı model' },
  { id: 'slow', label: 'slow', icon: 'tools-sparkles', desc: 'Ağır mantık ve derin muhakeme modeli' },
  { id: 'vision', label: 'vision', icon: 'senses-eye', desc: 'Görsel ve ekran görüntüsü analiz modeli' },
  { id: 'plan', label: 'plan', icon: 'layouts-layers-2', desc: 'Mimari planlama ve yol haritası modeli' },
  { id: 'commit', label: 'commit', icon: 'code-git-commit-horizontal', desc: 'Git commit mesajı oluşturucu model' },
  { id: 'tiny', label: 'tiny', icon: 'code-server', desc: 'Ultra hafif yerel veya bulut model' },
  { id: 'memory', label: 'memory', icon: 'documents-file-text', desc: 'Oturum hafızası ve özetleme modeli' },
  { id: 'task', label: 'task', icon: 'code-terminal', desc: 'Paralel subagent ve görev yöneticisi' },
  { id: 'advisor', label: 'advisor', icon: 'identity-shield-check', desc: 'Pasif güvenlik ve mimari denetim modeli' },
  { id: 'widget', label: 'widget', icon: 'metrics-sliders-horizontal', desc: 'Arayüz ve widget etkileşim modeli' },
  { id: 'web', label: 'web', icon: 'indicators-square-arrow-out-up-right', desc: 'İnternet araması ve sayfa okuma modeli' },
  { id: 'judge', label: 'judge', icon: 'metrics-sliders-horizontal', desc: 'Değerlendirme ve sınıflandırma modeli' },
];

const THINKING_LEVELS = [
  { id: 'inherit', label: 'inherit', symbol: '⊡', desc: 'Modelin veya sistemin varsayılanını miras al' },
  { id: 'off', label: 'off', symbol: '⊘', desc: 'Düşünme kapalı, doğrudan yanıt' },
  { id: 'auto', label: 'auto', symbol: '↻', desc: 'Model karmaşıklığa göre belirler (Önerilen)' },
  { id: 'minimal', label: 'minimal', symbol: '1', desc: 'Minimum akıl yürütme adımı' },
  { id: 'low', label: 'low', symbol: '2', desc: 'Düşük efor ve hızlı düşünme' },
  { id: 'medium', label: 'medium', symbol: '3', desc: 'Orta seviye dengeli akıl yürütme' },
  { id: 'high', label: 'high', symbol: '4', desc: 'Derin ve kapsamlı akıl yürütme' },
  { id: 'max', label: 'max', symbol: '5', desc: 'Maksimum genişletilmiş düşünme bütçesi' },
];

export const RoleAssignmentModal: React.FC<RoleAssignmentModalProps> = ({
  isOpen,
  onClose,
  availableModels,
  currentRoles,
  onSaveRole,
  initialModel,
  initialRole,
}) => {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [selectedModel, setSelectedModel] = useState<string>(initialModel || '');
  const [selectedRole, setSelectedRole] = useState<string>(initialRole || 'default');
  const [selectedThinking, setSelectedThinking] = useState<string>('inherit');
  const [modelSearch, setModelSearch] = useState('');
  const [selectedProvider, setSelectedProvider] = useState<string>('all');
  const [customRoleInput, setCustomRoleInput] = useState('');
  const [isCreatingCustom, setIsCreatingCustom] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (initialModel) {
      setSelectedModel(initialModel);
    }
    if (initialRole) {
      setSelectedRole(initialRole);
    }
  }, [initialModel, initialRole]);

  useEffect(() => {
    if (isOpen) {
      setStep(1);
      setModelSearch('');
      setSelectedProvider('all');
      setIsCreatingCustom(false);
      setCustomRoleInput('');
    }
  }, [isOpen]);

  const allRoles = useMemo(() => {
    const list = [...BUILT_IN_ROLES];
    Object.keys(currentRoles || {}).forEach((r) => {
      if (!list.some((b) => b.id === r)) {
        list.push({
          id: r,
          label: r,
          icon: 'tools-settings',
          desc: 'Kullanıcı tanımlı özel model rolü',
        });
      }
    });
    return list;
  }, [currentRoles]);

  const providersWithCounts = useMemo(() => {
    const map: Record<string, number> = {};
    availableModels.forEach((m) => {
      const p = m.provider || 'other';
      map[p] = (map[p] || 0) + 1;
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [availableModels]);

  const filteredModels = useMemo(() => {
    return availableModels.filter((m) => {
      if (selectedProvider !== 'all' && m.provider !== selectedProvider) {
        return false;
      }
      if (modelSearch.trim()) {
        const q = modelSearch.toLowerCase();
        const matchId = (m.id || '').toLowerCase().includes(q);
        const matchName = (m.name || '').toLowerCase().includes(q);
        const matchProv = (m.provider || '').toLowerCase().includes(q);
        return matchId || matchName || matchProv;
      }
      return true;
    });
  }, [availableModels, selectedProvider, modelSearch]);

  const modelSpecificThinkingLevels = useMemo(() => {
    const m = (selectedModel || '').toLowerCase();
    if (m.includes('gemini')) {
      return THINKING_LEVELS.filter((l) => ['inherit', 'auto', 'off', 'low', 'high'].includes(l.id));
    }
    if (m.includes('claude')) {
      return THINKING_LEVELS.filter((l) => ['inherit', 'auto', 'off', 'low', 'medium', 'high', 'max'].includes(l.id));
    }
    if (m.includes('o1') || m.includes('o3') || m.includes('gpt-5')) {
      return THINKING_LEVELS.filter((l) => ['inherit', 'auto', 'low', 'medium', 'high'].includes(l.id));
    }
    return THINKING_LEVELS;
  }, [selectedModel]);

  if (!isOpen) return null;

  const handleComplete = async (thinkingOverride?: string) => {
    if (!selectedModel || !selectedRole) return;
    const finalThinking = thinkingOverride !== undefined ? thinkingOverride : selectedThinking;
    const modelWithThinking = finalThinking && finalThinking !== 'inherit'
      ? `${selectedModel}:${finalThinking}`
      : selectedModel;

    setIsSaving(true);
    try {
      await onSaveRole(selectedRole, modelWithThinking);
      onClose();
    } catch (e) {
      console.error('Failed to assign role:', e);
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddCustomRole = () => {
    const trimmed = customRoleInput.trim().toLowerCase().replace(/[^a-z0-9-_]/g, '-');
    if (!trimmed) return;
    const finalRoleId = trimmed.startsWith('custom-') ? trimmed : `custom-${trimmed}`;
    setSelectedRole(finalRoleId);
    setCustomRoleInput('');
    setIsCreatingCustom(false);
    setStep(3);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-fadeIn select-none font-mono text-xs">
      <div 
        className="w-full max-w-4xl bg-omp-surface border border-omp-border rounded-[2px] shadow-2xl overflow-hidden flex flex-col h-[82vh] animate-scaleIn"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-3 border-b border-omp-border flex items-center justify-between bg-omp-surface shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-6 h-6 bg-omp-accent text-white flex items-center justify-center font-bold rounded-[2px]">
              <Rune name="code-server" size={13} />
            </div>
            <div>
              <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center space-x-2">
                <span>06 // ROLE ASSIGNMENT WIZARD</span>
                <span className="text-[10px] text-omp-accent font-normal">
                  (STEP {step} / 3)
                </span>
              </h3>
            </div>
          </div>

          {/* Stepper pills */}
          <div className="flex items-center space-x-2 text-[11px] font-mono">
            <button
              onClick={() => setStep(1)}
              className={`px-2.5 py-1 rounded-[2px] border transition ${
                step === 1
                  ? 'bg-omp-accent text-white font-bold border-omp-accent'
                  : selectedModel
                  ? 'bg-omp-bg border-omp-border text-omp-accent'
                  : 'bg-transparent border-transparent text-omp-muted'
              }`}
            >
              01 // MODEL: {selectedModel ? selectedModel.split('/').pop() : 'YOK'}
            </button>

            <span className="text-omp-muted">›</span>

            <button
              onClick={() => selectedModel && setStep(2)}
              disabled={!selectedModel}
              className={`px-2.5 py-1 rounded-[2px] border transition disabled:opacity-30 ${
                step === 2
                  ? 'bg-omp-accent text-white font-bold border-omp-accent'
                  : selectedRole
                  ? 'bg-omp-bg border-omp-border text-omp-accent'
                  : 'bg-transparent border-transparent text-omp-muted'
              }`}
            >
              02 // ROLE: {selectedRole || 'YOK'}
            </button>

            <span className="text-omp-muted">›</span>

            <button
              onClick={() => selectedModel && selectedRole && setStep(3)}
              disabled={!selectedModel || !selectedRole}
              className={`px-2.5 py-1 rounded-[2px] border transition disabled:opacity-30 ${
                step === 3
                  ? 'bg-omp-accent text-white font-bold border-omp-accent'
                  : 'bg-transparent border-transparent text-omp-muted'
              }`}
            >
              03 // THINK: {selectedThinking}
            </button>

            <button
              onClick={onClose}
              className="ml-3 p-1 rounded-[2px] text-omp-muted hover:text-white hover:bg-omp-bg transition"
            >
              <Rune name="indicators-x" size={14} />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-hidden flex bg-omp-surface">
          {/* STEP 1: MODEL SELECTION */}
          {step === 1 && (
            <div className="flex-1 flex overflow-hidden">
              {/* Left sidebar: Providers filter */}
              <div className="w-52 border-r border-omp-border bg-omp-surface flex flex-col shrink-0 select-none">
                <div className="p-2.5 border-b border-omp-border text-[10px] font-bold text-omp-muted uppercase tracking-wider">
                  PROVIDERS ({providersWithCounts.length})
                </div>
                <div className="flex-1 overflow-y-auto p-1.5 space-y-0.5 text-xs font-mono">
                  <button
                    onClick={() => setSelectedProvider('all')}
                    className={`w-full px-2 py-1 rounded-[2px] flex items-center justify-between text-left transition ${
                      selectedProvider === 'all'
                        ? 'bg-omp-accent text-white font-bold'
                        : 'text-omp-muted hover:text-white hover:bg-omp-bg'
                    }`}
                  >
                    <span>TÜMÜ (ALL)</span>
                    <span className="text-[10px] tabular-nums">{availableModels.length}</span>
                  </button>

                  {providersWithCounts.map(([prov, cnt]) => (
                    <button
                      key={prov}
                      onClick={() => setSelectedProvider(prov)}
                      className={`w-full px-2 py-1 rounded-[2px] flex items-center justify-between text-left transition ${
                        selectedProvider === prov
                          ? 'bg-omp-accent text-white font-bold'
                          : 'text-omp-muted hover:text-white hover:bg-omp-bg'
                      }`}
                    >
                      <span className="truncate uppercase">{prov}</span>
                      <span className="text-[10px] tabular-nums">{cnt}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Right: Model Search & Grid */}
              <div className="flex-1 flex flex-col bg-omp-bg overflow-hidden">
                <div className="p-3 border-b border-omp-border bg-omp-surface">
                  <div className="relative">
                    <Rune name="tools-search" size={13} className="absolute left-2.5 top-2.5 text-omp-muted" />
                    <input
                      type="text"
                      value={modelSearch}
                      onChange={(e) => setModelSearch(e.target.value)}
                      placeholder="Model ara (örn: claude, gemini, o3, deepseek)..."
                      className="w-full bg-omp-bg border border-omp-border rounded-[2px] pl-8 pr-3 py-1.5 text-xs text-white placeholder-omp-muted focus:outline-none focus:border-omp-accent font-mono"
                    />
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-3 grid grid-cols-1 md:grid-cols-2 gap-2">
                  {filteredModels.map((m) => {
                    const isSelected = selectedModel === m.id;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => {
                          setSelectedModel(m.id);
                          setStep(2);
                        }}
                        className={`p-3 rounded-[2px] border text-left transition flex flex-col justify-between ${
                          isSelected
                            ? 'border-omp-accent bg-omp-surface text-white'
                            : 'border-omp-border/60 bg-omp-surface/60 hover:bg-omp-surface hover:border-omp-border text-zinc-300'
                        }`}
                      >
                        <div className="flex items-center justify-between w-full mb-1">
                          <span className="font-bold text-xs font-mono text-white truncate">{m.name || m.id}</span>
                          {isSelected && <Rune name="indicators-check" size={12} className="text-omp-accent" />}
                        </div>
                        <div className="text-[10px] text-omp-muted font-mono flex items-center justify-between w-full mt-2 pt-1 border-t border-omp-border/40">
                          <span className="uppercase">{m.provider}</span>
                          <span className="tabular-nums">{m.contextWindow ? `${(m.contextWindow / 1000).toFixed(0)}k ctx` : ''}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: ROLE SELECTION */}
          {step === 2 && (
            <div className="flex-1 p-5 overflow-y-auto space-y-4 bg-omp-bg">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider">ROL SEÇİN VEYA OLUŞTURUN</h4>
                  <p className="text-[11px] text-omp-muted font-mono">
                    MODEL: <span className="text-omp-accent font-bold">{selectedModel}</span>
                  </p>
                </div>

                <button
                  onClick={() => setIsCreatingCustom(!isCreatingCustom)}
                  className="px-3 py-1 rounded-[2px] bg-omp-surface border border-omp-border hover:border-omp-accent text-white text-xs font-bold uppercase tracking-wider transition"
                >
                  <span>+ YENİ CUSTOM ROL</span>
                </button>
              </div>

              {isCreatingCustom && (
                <div className="p-3 rounded-[2px] border border-omp-accent/50 bg-omp-surface space-y-2">
                  <div className="flex items-center space-x-2">
                    <span className="text-omp-muted font-mono text-xs">custom-</span>
                    <input
                      type="text"
                      value={customRoleInput}
                      onChange={(e) => setCustomRoleInput(e.target.value)}
                      placeholder="rol-adi (ornek: coder, tester)..."
                      className="flex-1 bg-omp-bg border border-omp-border rounded-[2px] px-3 py-1 text-xs text-white font-mono focus:outline-none focus:border-omp-accent"
                    />
                    <button
                      onClick={handleAddCustomRole}
                      disabled={!customRoleInput.trim()}
                      className="px-4 py-1 rounded-[2px] bg-omp-accent hover:bg-omp-accentHover text-white text-xs font-bold uppercase tracking-wider"
                    >
                      EKLE & SEÇ
                    </button>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5">
                {allRoles.map((r) => {
                  const isSelected = selectedRole === r.id;
                  const currentAssigned = currentRoles[r.id];

                  return (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => {
                        setSelectedRole(r.id);
                        setStep(3);
                      }}
                      className={`p-3 rounded-[2px] border text-left transition flex flex-col justify-between ${
                        isSelected
                          ? 'border-omp-accent bg-omp-surface text-white'
                          : 'border-omp-border/60 bg-omp-surface/60 hover:bg-omp-surface hover:border-omp-border text-zinc-300'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center space-x-2">
                            <Rune name={r.icon} size={13} className={isSelected ? 'text-omp-accent' : 'text-omp-muted'} />
                            <span className="font-mono text-xs font-bold text-white uppercase">{r.label}</span>
                          </div>
                          {isSelected && <Rune name="indicators-check" size={12} className="text-omp-accent" />}
                        </div>
                        <p className="text-[11px] text-omp-muted font-sans leading-relaxed line-clamp-2">
                          {r.desc}
                        </p>
                      </div>

                      <div className="mt-3 pt-1.5 border-t border-omp-border/40 text-[10px] font-mono truncate">
                        {currentAssigned ? (
                          <span className="text-zinc-400">
                            ATALAN: <span className="text-omp-accent">{currentAssigned.split('/').pop()}</span>
                          </span>
                        ) : (
                          <span className="text-zinc-600">ATANMADI</span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* STEP 3: THINKING LEVEL */}
          {step === 3 && (
            <div className="flex-1 p-5 overflow-y-auto space-y-4 bg-omp-bg">
              <div>
                <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                  DÜŞÜNME SEVİYESİ (THINKING LEVEL) SEÇİN
                </h4>
                <p className="text-[11px] text-omp-muted font-mono">
                  {selectedRole} = "{selectedModel}"
                </p>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
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
                      className={`p-3 rounded-[2px] border text-left transition flex flex-col justify-between ${
                        isSelected
                          ? 'border-omp-accent bg-omp-surface text-white'
                          : 'border-omp-border/60 bg-omp-surface/60 hover:bg-omp-surface hover:border-omp-border text-zinc-300'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-mono text-omp-accent">{lvl.symbol}</span>
                          {isSelected && <Rune name="indicators-check" size={12} className="text-omp-accent" />}
                        </div>
                        <div className="font-mono text-xs font-bold text-white uppercase mb-1">
                          {lvl.label}
                        </div>
                        <p className="text-[11px] text-omp-muted font-sans leading-relaxed">
                          {lvl.desc}
                        </p>
                      </div>

                      <div className="mt-3 pt-1.5 border-t border-omp-border/40 text-[10px] font-mono text-omp-accent uppercase">
                        SEÇ & KAYDET ›
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Summary & Manual Save */}
              <div className="p-3.5 rounded-[2px] border border-omp-border bg-omp-surface flex items-center justify-between">
                <div>
                  <div className="text-[10px] text-omp-muted uppercase">CONFIG FORMAT:</div>
                  <div className="text-xs font-mono text-white font-bold mt-0.5">
                    {selectedRole} = "{selectedModel}{selectedThinking !== 'inherit' ? `:${selectedThinking}` : ''}"
                  </div>
                </div>

                <button
                  type="button"
                  disabled={isSaving}
                  onClick={() => handleComplete()}
                  className="px-4 py-1.5 rounded-[2px] bg-omp-accent hover:bg-omp-accentHover text-white font-bold font-mono text-xs uppercase tracking-wider transition"
                >
                  {isSaving ? 'KAYDEDİLİYOR...' : 'ROLÜ KAYDET'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
