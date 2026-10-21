import React, { useState } from 'react';
import { Rune } from './Rune';
import { ModelEntry } from '../types';

export interface ThinkingLevelOption {
  value: string;
  label: string;
  description: string;
}

export function getAvailableThinkingLevels(modelId: string): ThinkingLevelOption[] {
  const m = (modelId || '').toLowerCase();

  if (m.includes('gemini')) {
    return [
      { value: 'auto', label: 'auto (Varsayılan)', description: 'Model karmaşıklığa göre düşünme miktarını otomatik belirler' },
      { value: 'off', label: 'off (Kapalı)', description: 'Düşünme adımları devre dışı bırakılır, doğrudan yanıt üretir' },
      { value: 'low', label: 'low (Düşük)', description: 'Hızlı ve temel düzeyde akıl yürütme bütçesi' },
      { value: 'high', label: 'high (Yüksek)', description: 'En kapsamlı ve detaylı akıl yürütme analizi' },
    ];
  }

  if (m.includes('claude')) {
    return [
      { value: 'auto', label: 'auto (Otomatik)', description: 'Uyarlanabilir düşünme bütçesi' },
      { value: 'off', label: 'off (Kapalı)', description: 'Düşünme bütçesi ayrılmaz' },
      { value: 'low', label: 'low (Düşük)', description: '2k-4k token düşünme' },
      { value: 'medium', label: 'medium (Orta)', description: '8k-16k token düşünme' },
      { value: 'high', label: 'high (Yüksek)', description: '32k token düşünme' },
      { value: 'max', label: 'max (Maksimum)', description: 'Maksimum genişletilmiş düşünme (64k)' },
    ];
  }

  if (m.includes('o1') || m.includes('o3') || m.includes('gpt-5')) {
    return [
      { value: 'auto', label: 'auto (Otomatik)', description: 'Standart akıl yürütme eforu' },
      { value: 'low', label: 'low (Düşük)', description: 'Düşük efor (hızlı yanıt)' },
      { value: 'medium', label: 'medium (Orta)', description: 'Dengeli akıl yürütme' },
      { value: 'high', label: 'high (Yüksek)', description: 'Derin akıl yürütme' },
    ];
  }

  return [
    { value: 'auto', label: 'auto (Otomatik)', description: 'Modelin varsayılan akıl yürütme seviyesi' },
    { value: 'off', label: 'off (Kapalı)', description: 'Düşünme adımları olmadan doğrudan yanıt' },
    { value: 'low', label: 'low (Düşük)', description: 'Hafif düşünme adımları' },
    { value: 'high', label: 'high (Yüksek)', description: 'Maksimum akıl yürütme ve planlama' },
  ];
}

interface ParametersDialogProps {
  isOpen: boolean;
  onClose: () => void;
  availableModels: ModelEntry[];
  selectedModel: string;
  onSelectModel: (m: string) => void;
  smolModel: string;
  onSelectSmolModel: (m: string) => void;
  slowModel: string;
  onSelectSlowModel: (m: string) => void;
  planModel: string;
  onSelectPlanModel: (m: string) => void;
  advisorModel?: string;
  onSelectAdvisorModel?: (m: string) => void;
  advisorEnabled?: boolean;
  thinkingLevel: string;
  onSelectThinkingLevel: (level: string) => void;
  approvalMode: string;
  onSelectApprovalMode: (mode: string) => void;
  autoApprove: boolean;
  onToggleAutoApprove: (v: boolean) => void;
  goalMode: boolean;
  onToggleGoalMode: (v: boolean) => void;
  planYolo: boolean;
  onTogglePlanYolo: (v: boolean) => void;
  prewalk: boolean;
  onTogglePrewalk: (v: boolean) => void;
  advisor?: boolean;
  onToggleAdvisor: (v: boolean) => void;
  onOpenRoleWizard?: () => void;
}

export const ParametersDialog: React.FC<ParametersDialogProps> = ({
  isOpen,
  onClose,
  selectedModel,
  onSelectModel,
  onSelectSmolModel,
  onSelectSlowModel,
  onSelectPlanModel,
  onSelectAdvisorModel,
  thinkingLevel,
  onSelectThinkingLevel,
  approvalMode,
  onSelectApprovalMode,
  autoApprove,
  onToggleAutoApprove,
  goalMode,
  onToggleGoalMode,
  planYolo,
  onTogglePlanYolo,
  prewalk,
  onTogglePrewalk,
  onToggleAdvisor,
}) => {
  const [activeTab, setActiveTab] = useState<'thinking' | 'flags'>('thinking');
  const validThinkingLevels = getAvailableThinkingLevels(selectedModel);


  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 select-none font-mono text-xs transition-all duration-200 ease-out ${
        isOpen ? 'pointer-events-auto visible opacity-100' : 'pointer-events-none invisible opacity-0'
      }`}
    >
      {/* Backdrop */}
      <div
        onClick={onClose}
        className={`absolute inset-0 bg-black/75 backdrop-blur-xs transition-opacity duration-200 ease-out ${
          isOpen ? 'opacity-100' : 'opacity-0'
        }`}
      />

      {/* Modal Dialog */}
      <div
        className={`relative w-full max-w-2xl bg-omp-surface border border-omp-border rounded-[2px] shadow-2xl overflow-hidden flex flex-col max-h-[85vh] transition-all duration-200 ease-out transform ${
          isOpen ? 'scale-100 opacity-100 translate-y-0' : 'scale-95 opacity-0 translate-y-2'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-5 py-3 border-b border-omp-border flex items-center justify-between bg-omp-surface">
          <div className="flex items-center space-x-3">
            <div className="w-6 h-6 bg-omp-accent text-white flex items-center justify-center font-bold rounded-[2px]">
              <Rune name="metrics-sliders-horizontal" size={13} />
            </div>
            <div>
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                05 // EXECUTION PARAMETERS & REASONING
              </h3>
              <p className="text-[11px] text-omp-muted">Düşünme düzeyi, araç izinleri ve omp çalışma bayrakları</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1 rounded-[2px] hover:bg-omp-bg text-omp-muted hover:text-white transition"
          >
            <Rune name="indicators-x" size={14} />
          </button>
        </div>

        {/* Modal Tabs */}
        <div className="flex border-b border-omp-border bg-omp-bg px-4 text-xs divide-x divide-omp-border/60">
          <button
            onClick={() => setActiveTab('thinking')}
            className={`py-2 px-3 font-mono text-[11px] uppercase tracking-wider transition flex items-center space-x-1.5 ${
              activeTab === 'thinking'
                ? 'bg-omp-surface text-white font-bold border-b-2 border-b-omp-accent'
                : 'text-omp-muted hover:text-white'
            }`}
          >
            <Rune name="tools-sparkles" size={12} className={activeTab === 'thinking' ? 'text-omp-accent' : ''} />
            <span>01 // DÜŞÜNME & İZİNLER</span>
          </button>
          <button
            onClick={() => setActiveTab('flags')}
            className={`py-2 px-3 font-mono text-[11px] uppercase tracking-wider transition flex items-center space-x-1.5 ${
              activeTab === 'flags'
                ? 'bg-omp-surface text-white font-bold border-b-2 border-b-omp-accent'
                : 'text-omp-muted hover:text-white'
            }`}
          >
            <Rune name="other-zap" size={12} className={activeTab === 'flags' ? 'text-omp-accent' : ''} />
            <span>02 // AJAN BAYRAKLARI</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-5 flex-1 text-xs bg-omp-surface">
          {activeTab === 'thinking' && (
            <div className="space-y-4">
              {/* Model-specific Thinking Levels */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-white font-bold uppercase text-[11px] flex items-center space-x-1.5">
                    <Rune name="tools-sparkles" size={13} className="text-omp-accent" />
                    <span>DÜŞÜNME SEVİYESİ (--THINKING):</span>
                  </label>
                  <span className="text-[10px] px-1.5 py-0.2 rounded-[2px] bg-omp-bg text-omp-muted border border-omp-border">
                    {selectedModel.includes('gemini') ? 'Gemini 3.8 Flash' : 'Model Levels'}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  {validThinkingLevels.map((lvl) => (
                    <button
                      key={lvl.value}
                      type="button"
                      onClick={() => onSelectThinkingLevel(lvl.value)}
                      className={`p-3 rounded-[2px] border text-left transition font-mono ${
                        thinkingLevel === lvl.value
                          ? 'border-omp-accent bg-omp-bg text-white'
                          : 'border-omp-border bg-omp-bg/60 text-zinc-300 hover:border-zinc-700'
                      }`}
                    >
                      <div className="flex items-center justify-between font-bold text-xs mb-1">
                        <span className="uppercase">{lvl.label}</span>
                        {thinkingLevel === lvl.value && <Rune name="indicators-check" size={13} className="text-omp-accent" />}
                      </div>
                      <p className="text-[11px] text-omp-muted font-sans leading-relaxed">{lvl.description}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Tool Approval Mode */}
              <div className="pt-3 border-t border-omp-border">
                <label className="block text-white font-bold uppercase text-[11px] mb-2">ARAÇ ONAY MODU (--APPROVAL-MODE):</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'write', label: 'WRITE', desc: 'Yazma ve komut işlemlerinde onay sorar (Önerilen)' },
                    { id: 'always-ask', label: 'ALWAYS-ASK', desc: 'Her araç çağrısında kullanıcı onayı bekler' },
                    { id: 'yolo', label: 'YOLO', desc: 'Tüm araçları sormadan doğrudan çalıştırır' },
                  ].map((mode) => (
                    <button
                      key={mode.id}
                      type="button"
                      onClick={() => onSelectApprovalMode(mode.id)}
                      className={`p-2.5 rounded-[2px] border text-left transition font-mono ${
                        approvalMode === mode.id
                          ? 'border-omp-accent bg-omp-bg text-white'
                          : 'border-omp-border bg-omp-bg/60 text-zinc-300 hover:border-zinc-700'
                      }`}
                    >
                      <div className="font-bold text-xs mb-1">{mode.label}</div>
                      <p className="text-[10px] text-omp-muted font-sans leading-relaxed">{mode.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Auto Approve Checkbox */}
              <div className="pt-2">
                <label className="flex items-center space-x-2.5 cursor-pointer text-white">
                  <input
                    type="checkbox"
                    checked={autoApprove}
                    onChange={(e) => onToggleAutoApprove(e.target.checked)}
                    className="w-4 h-4 rounded-[2px] bg-omp-bg border-omp-border text-omp-accent focus:ring-0"
                  />
                  <div>
                    <span className="font-bold uppercase text-[11px]">OTOMATİK ONAY (--AUTO-APPROVE)</span>
                    <p className="text-[10px] text-omp-muted font-sans">Tüm araç onay isteklerini otomatik kabul eder</p>
                  </div>
                </label>
              </div>
            </div>
          )}

          {activeTab === 'flags' && (
            <div className="space-y-3 font-mono">
              <label className="flex items-start space-x-3 p-3 rounded-[2px] border border-omp-border bg-omp-bg hover:border-omp-accent cursor-pointer transition">
                <input
                  type="checkbox"
                  checked={goalMode}
                  onChange={(e) => onToggleGoalMode(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded-[2px] bg-omp-surface border-omp-border text-omp-accent focus:ring-0"
                />
                <div>
                  <div className="font-bold text-white uppercase text-xs">
                    HEDEF MODU (--GOAL)
                  </div>
                  <p className="text-[11px] text-omp-muted mt-0.5 font-sans leading-relaxed">
                    Ajanı taze bir oturumda hedef odaklı başlatır, testler geçene kadar otonom döngü kurar.
                  </p>
                </div>
              </label>

              <label className="flex items-start space-x-3 p-3 rounded-[2px] border border-omp-border bg-omp-bg hover:border-omp-accent cursor-pointer transition">
                <input
                  type="checkbox"
                  checked={planYolo}
                  onChange={(e) => onTogglePlanYolo(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded-[2px] bg-omp-surface border-omp-border text-omp-accent focus:ring-0"
                />
                <div>
                  <div className="font-bold text-white uppercase text-xs">
                    PLAN YOLO (--PLAN-YOLO)
                  </div>
                  <p className="text-[11px] text-omp-muted mt-0.5 font-sans leading-relaxed">
                    Başlangıçta mimari planı oluşturur, ilk çözümde planı otomatik onaylayıp doğrudan uygulamaya geçer.
                  </p>
                </div>
              </label>

              <label className="flex items-start space-x-3 p-3 rounded-[2px] border border-omp-border bg-omp-bg hover:border-omp-accent cursor-pointer transition">
                <input
                  type="checkbox"
                  checked={prewalk}
                  onChange={(e) => onTogglePrewalk(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded-[2px] bg-omp-surface border-omp-border text-omp-accent focus:ring-0"
                />
                <div>
                  <div className="font-bold text-white uppercase text-xs">
                    PREWALK (--PREWALK)
                  </div>
                  <p className="text-[11px] text-omp-muted mt-0.5 font-sans leading-relaxed">
                    Plan oluşturulduktan sonra ilk kod yazımında otomatik olarak hafif modele geçiş yapar.
                  </p>
                </div>
              </label>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-2.5 border-t border-omp-border bg-omp-surface flex items-center justify-between select-none">
          <button
            type="button"
            onClick={() => {
              onSelectModel('google-antigravity/gemini-3.8-flash');
              onSelectThinkingLevel('auto');
              onSelectApprovalMode('write');
              onToggleAutoApprove(false);
              onToggleAdvisor(false);
              onToggleGoalMode(false);
              onTogglePlanYolo(false);
              onTogglePrewalk(false);
            }}
            className="text-[11px] text-omp-muted hover:text-white transition uppercase font-mono"
          >
            VARSAYILANLARA SIFIRLA
          </button>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1 rounded-[2px] bg-omp-accent hover:bg-omp-accentHover text-white font-bold font-mono text-xs uppercase tracking-wider transition"
          >
            UYGULA & KAPAT
          </button>
        </div>
      </div>
    </div>
  );
};
