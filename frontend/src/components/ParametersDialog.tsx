import React, { useState } from 'react';
import { 
  X, 
  Sliders, 
  Shield, 
  Cpu, 
  BrainCircuit, 
  Check, 
  Zap, 
  Clock, 
  Layers,
  Sparkles
} from 'lucide-react';
import { ModelEntry } from '../types';

export interface ThinkingLevelOption {
  value: string;
  label: string;
  description: string;
}

export function getAvailableThinkingLevels(modelId: string): ThinkingLevelOption[] {
  const m = (modelId || '').toLowerCase();

  // Google Gemini modelleri için resmi ve geçerli düşünme seviyeleri
  if (m.includes('gemini')) {
    return [
      { value: 'auto', label: 'auto (Varsayılan)', description: 'Model karmaşıklığa göre düşünme miktarını otomatik belirler' },
      { value: 'off', label: 'off (Kapalı)', description: 'Düşünme adımları devre dışı bırakılır, doğrudan yanıt üretir' },
      { value: 'low', label: 'low (Düşük)', description: 'Hızlı ve temel düzeyde akıl yürütme bütçesi' },
      { value: 'high', label: 'high (Yüksek)', description: 'En kapsamlı ve detaylı akıl yürütme analizi' },
    ];
  }

  // Anthropic Claude modelleri için seviyeler
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

  // OpenAI reasoning modelleri için seviyeler
  if (m.includes('o1') || m.includes('o3') || m.includes('gpt-5')) {
    return [
      { value: 'auto', label: 'auto (Otomatik)', description: 'Standart akıl yürütme eforu' },
      { value: 'low', label: 'low (Düşük)', description: 'Düşük efor (hızlı yanıt)' },
      { value: 'medium', label: 'medium (Orta)', description: 'Dengeli akıl yürütme' },
      { value: 'high', label: 'high (Yüksek)', description: 'Derin akıl yürütme' },
    ];
  }

  // Genel modeller için
  return [
    { value: 'auto', label: 'auto (Otomatik)', description: 'Varsayılan model davranışı' },
    { value: 'off', label: 'off (Kapalı)', description: 'Düşünme kapalı' },
    { value: 'low', label: 'low (Düşük)', description: 'Kısa akıl yürütme' },
    { value: 'medium', label: 'medium (Orta)', description: 'Orta seviye akıl yürütme' },
    { value: 'high', label: 'high (Yüksek)', description: 'Yüksek akıl yürütme' },
  ];
}

interface ParametersDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenRoleWizard?: () => void;
  // Models & Roles
  availableModels: ModelEntry[];
  selectedModel: string;
  onSelectModel: (m: string) => void;
  smolModel: string;
  onSelectSmolModel: (m: string) => void;
  slowModel: string;
  onSelectSlowModel: (m: string) => void;
  planModel: string;
  onSelectPlanModel: (m: string) => void;
  advisorModel: string;
  onSelectAdvisorModel: (m: string) => void;
  advisorEnabled: boolean;
  onToggleAdvisor: (enabled: boolean) => void;
  // Thinking & Approvals
  thinkingLevel: string;
  onSelectThinkingLevel: (tl: string) => void;
  approvalMode: string;
  onSelectApprovalMode: (mode: string) => void;
  autoApprove: boolean;
  onToggleAutoApprove: (v: boolean) => void;
  // Flags
  goalMode: boolean;
  onToggleGoalMode: (v: boolean) => void;
  planYolo: boolean;
  onTogglePlanYolo: (v: boolean) => void;
  prewalk: boolean;
  onTogglePrewalk: (v: boolean) => void;
}

export const ParametersDialog: React.FC<ParametersDialogProps> = ({
  isOpen,
  onClose,
  availableModels,
  selectedModel,
  onSelectModel,
  smolModel,
  onSelectSmolModel,
  slowModel,
  onSelectSlowModel,
  planModel,
  onSelectPlanModel,
  advisorModel,
  onSelectAdvisorModel,
  advisorEnabled,
  onToggleAdvisor,
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
  onOpenRoleWizard,
}) => {
  const [activeTab, setActiveTab] = useState<'thinking' | 'flags'>('thinking');

  if (!isOpen) return null;

  const validThinkingLevels = getAvailableThinkingLevels(selectedModel);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
      <div 
        className="w-full max-w-2xl bg-omp-surface border border-omp-border rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] font-sans"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-omp-border flex items-center justify-between bg-omp-surfaceLight/40 select-none">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-omp-accent/15 border border-omp-accent/30 flex items-center justify-center text-omp-accent">
              <Sliders size={18} />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">Çalıştırma Parametreleri</h3>
              <p className="text-xs text-omp-muted">Düşünme düzeyi, araç izinleri ve omp çalışma bayrakları</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg text-omp-muted hover:text-white hover:bg-omp-surfaceLight flex items-center justify-center transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Tabs */}
        <div className="flex border-b border-omp-border bg-omp-bg/50 px-6 text-xs select-none">
          <button
            onClick={() => setActiveTab('thinking')}
            className={`py-3 px-4 font-medium border-b-2 transition flex items-center space-x-2 ${
              activeTab === 'thinking'
                ? 'border-omp-accent text-white'
                : 'border-transparent text-omp-muted hover:text-white'
            }`}
          >
            <BrainCircuit size={14} />
            <span>Düşünme & İzinler</span>
          </button>
          <button
            onClick={() => setActiveTab('flags')}
            className={`py-3 px-4 font-medium border-b-2 transition flex items-center space-x-2 ${
              activeTab === 'flags'
                ? 'border-omp-accent text-white'
                : 'border-transparent text-omp-muted hover:text-white'
            }`}
          >
            <Zap size={14} />
            <span>Ajan Bayrakları</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">
          {activeTab === 'thinking' && (
            <div className="space-y-5">
              {/* Model-specific Thinking Levels */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-white font-medium flex items-center space-x-1.5">
                    <BrainCircuit size={15} className="text-omp-purple" />
                    <span>Düşünme Seviyesi (--thinking):</span>
                  </label>
                  <span className="text-[11px] px-2 py-0.5 rounded bg-omp-bg text-omp-accent border border-omp-border font-mono">
                    {selectedModel.includes('gemini') ? 'Gemini 3.8 Flash Uyumlu' : 'Model Seviyeleri'}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  {validThinkingLevels.map((lvl) => (
                    <button
                      key={lvl.value}
                      type="button"
                      onClick={() => onSelectThinkingLevel(lvl.value)}
                      className={`p-3 rounded-xl border text-left transition ${
                        thinkingLevel === lvl.value
                          ? 'border-omp-accent bg-omp-accent/15 text-white'
                          : 'border-omp-border bg-omp-bg text-omp-text hover:border-omp-border/80'
                      }`}
                    >
                      <div className="flex items-center justify-between font-semibold font-mono text-xs mb-1">
                        <span>{lvl.label}</span>
                        {thinkingLevel === lvl.value && <Check size={14} className="text-omp-accent" />}
                      </div>
                      <p className="text-[11px] text-omp-muted leading-relaxed">{lvl.description}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Tool Approval Mode */}
              <div className="pt-4 border-t border-omp-border/60">
                <label className="block text-white font-medium mb-2">Araç Onay Modu (--approval-mode):</label>
                <div className="grid grid-cols-3 gap-2.5">
                  {[
                    { id: 'write', label: 'write', desc: 'Yazma ve komut işlemlerinde onay sorar (Önerilen)' },
                    { id: 'always-ask', label: 'always-ask', desc: 'Her araç çağrısında mutlaka kullanıcı onayı bekler' },
                    { id: 'yolo', label: 'yolo', desc: 'Tüm araçları sormadan doğrudan çalıştırır' },
                  ].map((mode) => (
                    <button
                      key={mode.id}
                      type="button"
                      onClick={() => onSelectApprovalMode(mode.id)}
                      className={`p-3 rounded-xl border text-left transition ${
                        approvalMode === mode.id
                          ? 'border-omp-accent bg-omp-accent/15 text-white'
                          : 'border-omp-border bg-omp-bg text-omp-text hover:border-omp-border/80'
                      }`}
                    >
                      <div className="font-semibold font-mono text-xs mb-1">{mode.label}</div>
                      <p className="text-[11px] text-omp-muted leading-relaxed">{mode.desc}</p>
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
                    className="w-4 h-4 rounded bg-omp-bg border-omp-border text-omp-accent focus:ring-0"
                  />
                  <div>
                    <span className="font-medium">Otomatik Onay (--auto-approve)</span>
                    <p className="text-[11px] text-omp-muted">Tüm araç onay isteklerini otomatik kabul eder</p>
                  </div>
                </label>
              </div>
            </div>
          )}

          {activeTab === 'flags' && (
            <div className="space-y-4">
              <label className="flex items-start space-x-3 p-3.5 rounded-xl border border-omp-border bg-omp-bg hover:border-omp-accent/50 cursor-pointer transition">
                <input
                  type="checkbox"
                  checked={goalMode}
                  onChange={(e) => onToggleGoalMode(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded bg-omp-surface border-omp-border text-omp-accent focus:ring-0"
                />
                <div>
                  <div className="font-medium text-white flex items-center space-x-1.5">
                    <span>🎯 Hedef Modu (--goal)</span>
                  </div>
                  <p className="text-[11px] text-omp-muted mt-0.5 leading-relaxed">
                    Ajanı taze bir oturumda hedef odaklı başlatır, testler geçene kadar otonom döngü kurar.
                  </p>
                </div>
              </label>

              <label className="flex items-start space-x-3 p-3.5 rounded-xl border border-omp-border bg-omp-bg hover:border-omp-accent/50 cursor-pointer transition">
                <input
                  type="checkbox"
                  checked={planYolo}
                  onChange={(e) => onTogglePlanYolo(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded bg-omp-surface border-omp-border text-omp-accent focus:ring-0"
                />
                <div>
                  <div className="font-medium text-white flex items-center space-x-1.5">
                    <span>📋 Plan YOLO (--plan-yolo)</span>
                  </div>
                  <p className="text-[11px] text-omp-muted mt-0.5 leading-relaxed">
                    Başlangıçta mimari planı oluşturur, ilk çözümde planı otomatik onaylayıp doğrudan uygulamaya geçer.
                  </p>
                </div>
              </label>

              <label className="flex items-start space-x-3 p-3.5 rounded-xl border border-omp-border bg-omp-bg hover:border-omp-accent/50 cursor-pointer transition">
                <input
                  type="checkbox"
                  checked={prewalk}
                  onChange={(e) => onTogglePrewalk(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded bg-omp-surface border-omp-border text-omp-accent focus:ring-0"
                />
                <div>
                  <div className="font-medium text-white flex items-center space-x-1.5">
                    <span>⚡ Prewalk (--prewalk)</span>
                  </div>
                  <p className="text-[11px] text-omp-muted mt-0.5 leading-relaxed">
                    Plan oluşturulduktan sonra ilk kod yazımında otomatik olarak hafif ve ekonomik (smol) modele geçiş yapar.
                  </p>
                </div>
              </label>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 border-t border-omp-border bg-omp-surfaceLight/40 flex items-center justify-between select-none">
          <button
            type="button"
            onClick={() => {
              onSelectModel('google-antigravity/gemini-3.8-flash');
              onSelectThinkingLevel('auto');
              onSelectApprovalMode('write');
              onToggleAutoApprove(false);
              onToggleAdvisor(false);
              onSelectSmolModel('');
              onSelectSlowModel('');
              onSelectPlanModel('');
              onSelectAdvisorModel('');
              onToggleGoalMode(false);
              onTogglePlanYolo(false);
              onTogglePrewalk(false);
            }}
            className="text-xs text-omp-muted hover:text-white transition"
          >
            Varsayılanlara Sıfırla
          </button>

          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-omp-accent hover:bg-omp-accentHover text-white font-medium text-xs shadow-lg transition"
          >
            Uygula & Kapat
          </button>
        </div>
      </div>
    </div>
  );
};
