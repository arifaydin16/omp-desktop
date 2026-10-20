import React, { useState, useEffect, useMemo } from 'react';
import { 
  Settings, 
  Search, 
  RefreshCw, 
  Save, 
  Check, 
  X, 
  AlertCircle,
  Copy,
  ChevronDown,
  ChevronUp,
  Sliders,
  Terminal,
  Monitor,
  Cpu,
  ShieldCheck,
  Sparkles
} from 'lucide-react';
import * as AppApi from '../../wailsjs/go/main/App';

export interface SettingsDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ConfigItem {
  key: string;
  value: unknown;
  type: string;
  description: string;
}

// Keys that are already controlled elsewhere in the application
const isExcludedKey = (key: string): boolean => {
  // Managed in Advisor / Chat quick-commands
  if (key.startsWith('advisor.') || key === 'advisor') return true;
  
  // Managed in Model & Role Assignment Wizard
  if ([
    'modelRoles', 
    'modelRoleStorage', 
    'modelPresets', 
    'modelTags', 
    'cycleOrder', 
    'modelProviderOrder'
  ].includes(key)) return true;
  
  // Managed in Parameters / Thinking Level
  if ([
    'thinking', 
    'defaultThinkingLevel', 
    'proseOnlyThinking', 
    'omitThinking', 
    'externalThinking', 
    'hideThinkingBlock', 
    'expandThinkingBlocks'
  ].includes(key)) return true;
  
  // Managed in Parameters Dialog (Flags & Approvals)
  if (key.startsWith('prewalk.') || key === 'prewalk') return true;
  if (key.startsWith('plan.') || key === 'plan') return true;
  if (key.startsWith('goal.') || key === 'goal') return true;
  if (['approval.mode', 'approvalMode', 'autoApprove'].includes(key)) return true;
  
  // Managed in HeaderBar / Auto-Update Service
  if (key.startsWith('update.') || key === 'startup.checkUpdate' || key === 'marketplace.autoUpdate') return true;

  return false;
};

interface PrimarySettingDef {
  key: string;
  category: 'system' | 'display' | 'dev';
  label: string;
  description: string;
  type: 'boolean' | 'string' | 'number' | 'enum';
  options?: string[];
}

const PRIMARY_SETTINGS: PrimarySettingDef[] = [
  // Sistem & Ajan Deneyimi
  {
    key: 'autoResume',
    category: 'system',
    label: 'Son Oturumu Otomatik Sürdür (Auto-Resume)',
    description: 'Uygulama açıldığında çalışılan dizindeki en son oturumu otomatik devam ettirir.',
    type: 'boolean'
  },
  {
    key: 'git.enabled',
    category: 'system',
    label: 'Git Entegrasyonu & Dal Takibi',
    description: 'Git durumu, aktif dal ve PR bilgilerini otomatik izler.',
    type: 'boolean'
  },
  {
    key: 'bash.enabled',
    category: 'system',
    label: 'Terminal & Shell Komut Yürütme (bash)',
    description: 'Ajanın sistem üzerinde terminal komutları çalıştırmasına izin verir.',
    type: 'boolean'
  },
  {
    key: 'bash.autoBackground.enabled',
    category: 'system',
    label: 'Uzun Süren Komutları Arka Plana Al',
    description: '60 saniyeden uzun süren terminal işlerini dondurmadan arka planda tamamlar.',
    type: 'boolean'
  },
  {
    key: 'browser.enabled',
    category: 'system',
    label: 'Tarayıcı Otomasyonu (Puppeteer)',
    description: 'Ajanın web sitelerini incelemesini ve etkileşime girmesini sağlar.',
    type: 'boolean'
  },
  {
    key: 'browser.headless',
    category: 'system',
    label: 'Başsız (Headless) Tarayıcı',
    description: 'Açıkken tarayıcı penceresi ekranda görünmez, arka planda sessiz çalışır.',
    type: 'boolean'
  },
  {
    key: 'skills.enabled',
    category: 'system',
    label: 'Beceriler (Skills) Sistemi',
    description: 'Kurulu becerilerin ve özel sistem talimatlarının ajana sunulmasını sağlar.',
    type: 'boolean'
  },
  {
    key: 'mcp.enableProjectConfig',
    category: 'system',
    label: 'Proje MCP Yapılandırması (.mcp.json)',
    description: 'Proje kökündeki MCP sunucu tanımlarını otomatik algılar ve bağlar.',
    type: 'boolean'
  },
  {
    key: 'secrets.enabled',
    category: 'system',
    label: 'Gizli Bilgileri Maskele (Secrets Redaction)',
    description: 'Parola ve API anahtarı gibi hassas verileri modele göndermeden önce maskeler.',
    type: 'boolean'
  },
  {
    key: 'images.autoResize',
    category: 'system',
    label: 'Büyük Görselleri Otomatik Boyutlandır',
    description: 'Token tasarrufu ve model uyumluluğu için büyük resimleri 2000x2000 max piksele küçültür.',
    type: 'boolean'
  },

  // Görünüm & Arayüz
  {
    key: 'display.smoothStreaming',
    category: 'display',
    label: 'Akıcı Metin Akışı (Smooth Streaming)',
    description: 'Model yanıtlarının ve kod parçalarının ekrana yumuşak akmasını sağlar.',
    type: 'boolean'
  },
  {
    key: 'tui.renderMermaid',
    category: 'display',
    label: 'Mermaid Şemalarını Çiz',
    description: 'Akış ve mimari diyagramlarını metin formatında şematize eder.',
    type: 'boolean'
  },
  {
    key: 'tui.renderSvg',
    category: 'display',
    label: 'SVG Grafikleri Çiz',
    description: 'Ajanın çizdiği SVG vektör grafikleri görsel olarak ekranda render eder.',
    type: 'boolean'
  },
  {
    key: 'display.showTokenUsage',
    category: 'display',
    label: 'Token Kullanımını Göster',
    description: 'Her mesaj altında tüketilen token miktarını detaylandırır.',
    type: 'boolean'
  },
  {
    key: 'display.showTurnTime',
    category: 'display',
    label: 'Çalışma Süresini Göster',
    description: 'Modelin her turdaki düşünme ve araç çalıştırma süresini gösterir.',
    type: 'boolean'
  },
  {
    key: 'emojiAutocomplete',
    category: 'display',
    label: 'Emoji Otomatik Tamamlama',
    description: ':smile: veya :-) gibi ifadeleri otomatik emojiye dönüştürür.',
    type: 'boolean'
  },

  // Geliştirici & Sistem Yürütme
  {
    key: 'shellPath',
    category: 'dev',
    label: 'Varsayılan Shell Yolu',
    description: 'Terminal komutlarının yürütüleceği kabuk (örn: C:\\Program Files\\Git\\bin\\bash.exe)',
    type: 'string'
  },
  {
    key: 'task.maxConcurrency',
    category: 'dev',
    label: 'Maksimum Eşzamanlı Alt Ajan (Concurrency)',
    description: 'Aynı anda paralel çalışabilecek alt ajan sayısı (varsayılan: 32).',
    type: 'number'
  },
  {
    key: 'task.maxRecursionDepth',
    category: 'dev',
    label: 'Maksimum Ajan Derinliği (Recursion Depth)',
    description: 'Alt ajanların yeni alt ajan başlatabilme derinliği (varsayılan: 2).',
    type: 'number'
  },
  {
    key: 'recap.enabled',
    category: 'dev',
    label: 'Boşta Kalındığında Otomatik Özet (Recap)',
    description: 'Terminal bir süre boş kaldığında oturumun kısa bir durum özetini çıkarır.',
    type: 'boolean'
  }
];

export const SettingsDialog: React.FC<SettingsDialogProps> = ({
  isOpen,
  onClose,
}) => {
  const [configMap, setConfigMap] = useState<Record<string, unknown>>({});
  const [allConfigItems, setAllConfigItems] = useState<ConfigItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<string>('');
  
  // Extra options state
  const [showExtra, setShowExtra] = useState(false);
  const [extraSearch, setExtraSearch] = useState('');
  const [editingExtraKey, setEditingExtraKey] = useState<string | null>(null);
  const [editExtraValue, setEditExtraValue] = useState<string>('');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const loadConfig = async () => {
    setLoading(true);
    try {
      const raw = await AppApi.GetConfig();
      if (raw && typeof raw === 'object') {
        const cMap: Record<string, unknown> = {};
        const items: ConfigItem[] = [];
        
        for (const [k, v] of Object.entries(raw)) {
          if (v && typeof v === 'object') {
            const row = v as Record<string, unknown>;
            cMap[k] = row.value;
            items.push({
              key: k,
              value: row.value,
              type: String(row.type || 'string'),
              description: String(row.description || ''),
            });
          }
        }
        setConfigMap(cMap);
        setAllConfigItems(items.sort((a, b) => a.key.localeCompare(b.key)));
      }
    } catch (err: unknown) {
      console.error('Failed to load config:', err);
      setSaveStatus('Konfigürasyon yüklenemedi: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadConfig();
      setEditingExtraKey(null);
      setSaveStatus('');
    }
  }, [isOpen]);

  // Update a single config setting
  const updateSetting = async (key: string, value: string) => {
    setSavingKey(key);
    try {
      await AppApi.SetConfigKey(key, value);
      setSaveStatus(`'${key}' güncellendi.`);
      // Optimistically update map
      let parsed: unknown = value;
      if (value === 'true') parsed = true;
      else if (value === 'false') parsed = false;
      else if (!isNaN(Number(value)) && value.trim() !== '') parsed = Number(value);
      setConfigMap((prev) => ({ ...prev, [key]: parsed }));
      setTimeout(() => setSaveStatus(''), 2500);
    } catch (err: unknown) {
      setSaveStatus('Kayıt hatası: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setSavingKey(null);
    }
  };

  const handleToggle = (key: string) => {
    const currentVal = Boolean(configMap[key]);
    const nextVal = !currentVal;
    updateSetting(key, String(nextVal));
  };

  const handleTextChange = (key: string, val: string) => {
    updateSetting(key, val);
  };

  // Extra options: all items that are NOT excluded and NOT in primary list
  const primaryKeySet = useMemo(() => new Set(PRIMARY_SETTINGS.map((s) => s.key)), []);
  
  const extraConfigItems = useMemo(() => {
    return allConfigItems.filter((item) => {
      if (isExcludedKey(item.key)) return false;
      if (primaryKeySet.has(item.key)) return false;
      if (extraSearch.trim()) {
        const q = extraSearch.toLowerCase();
        return (
          item.key.toLowerCase().includes(q) ||
          item.description.toLowerCase().includes(q) ||
          String(item.value).toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [allConfigItems, primaryKeySet, extraSearch]);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(id);
    setTimeout(() => setCopiedKey(null), 1500);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
      <div 
        className="w-full max-w-4xl bg-omp-surface border border-omp-border rounded-2xl shadow-2xl flex flex-col max-h-[88vh] overflow-hidden font-sans animate-scaleIn"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-omp-border flex items-center justify-between bg-omp-surfaceLight/40 select-none shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-lg bg-omp-accent/15 border border-omp-accent/30 flex items-center justify-center text-omp-accent">
              <Settings size={18} />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-base font-semibold text-white">Yapılandırma & Ayarlar</h3>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-omp-bg text-omp-accent border border-omp-border font-mono">
                  omp config
                </span>
              </div>
              <p className="text-xs text-omp-muted">
                oh-my-pi sistem, görsel çıktı ve geliştirici parametrelerini yapılandırın
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={loadConfig}
              disabled={loading}
              className="p-1.5 rounded-lg hover:bg-omp-border text-omp-muted hover:text-white transition"
              title="Yenile"
            >
              <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-omp-border text-omp-muted hover:text-white transition"
              title="Kapat"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Status Toast Banner */}
        {saveStatus && (
          <div className="px-6 py-2 bg-omp-accent/15 border-b border-omp-accent/30 text-xs text-omp-accent flex justify-between items-center shrink-0">
            <div className="flex items-center space-x-2">
              <Check size={14} />
              <span>{saveStatus}</span>
            </div>
            <button onClick={() => setSaveStatus('')} className="text-omp-muted hover:text-white font-bold">
              <X size={12} />
            </button>
          </div>
        )}

        {/* Main Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* SECTION 1: Sistem & Ajan Deneyimi */}
          <div className="space-y-3">
            <div className="flex items-center space-x-2 text-white font-medium text-xs select-none border-b border-omp-border/60 pb-2">
              <ShieldCheck size={15} className="text-omp-accent" />
              <span>Sistem ve Ajan Deneyimi</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {PRIMARY_SETTINGS.filter((s) => s.category === 'system').map((item) => {
                const currentVal = Boolean(configMap[item.key]);
                const isSaving = savingKey === item.key;

                return (
                  <div
                    key={item.key}
                    className="p-3 rounded-xl bg-omp-bg border border-omp-border/70 hover:border-omp-muted/70 transition flex items-start justify-between gap-3"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium text-white mb-0.5">
                        {item.label}
                      </div>
                      <p className="text-[11px] text-omp-muted leading-relaxed">
                        {item.description}
                      </p>
                    </div>

                    <button
                      type="button"
                      disabled={isSaving}
                      onClick={() => handleToggle(item.key)}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        currentVal ? 'bg-omp-accent' : 'bg-omp-surfaceLight'
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                          currentVal ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* SECTION 2: Görünüm & Arayüz */}
          <div className="space-y-3">
            <div className="flex items-center space-x-2 text-white font-medium text-xs select-none border-b border-omp-border/60 pb-2">
              <Monitor size={15} className="text-omp-accent" />
              <span>Arayüz ve Görünüm Tercihleri</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {PRIMARY_SETTINGS.filter((s) => s.category === 'display').map((item) => {
                const currentVal = Boolean(configMap[item.key]);
                const isSaving = savingKey === item.key;

                return (
                  <div
                    key={item.key}
                    className="p-3 rounded-xl bg-omp-bg border border-omp-border/70 hover:border-omp-muted/70 transition flex items-start justify-between gap-3"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium text-white mb-0.5">
                        {item.label}
                      </div>
                      <p className="text-[11px] text-omp-muted leading-relaxed">
                        {item.description}
                      </p>
                    </div>

                    <button
                      type="button"
                      disabled={isSaving}
                      onClick={() => handleToggle(item.key)}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        currentVal ? 'bg-omp-accent' : 'bg-omp-surfaceLight'
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                          currentVal ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* SECTION 3: Geliştirici & Yürütme Parametreleri */}
          <div className="space-y-3">
            <div className="flex items-center space-x-2 text-white font-medium text-xs select-none border-b border-omp-border/60 pb-2">
              <Terminal size={15} className="text-omp-accent" />
              <span>Geliştirici ve Alt Ajan Parametreleri</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {PRIMARY_SETTINGS.filter((s) => s.category === 'dev').map((item) => {
                const rawVal = configMap[item.key];
                const isSaving = savingKey === item.key;

                if (item.type === 'boolean') {
                  const currentVal = Boolean(rawVal);
                  return (
                    <div
                      key={item.key}
                      className="p-3 rounded-xl bg-omp-bg border border-omp-border/70 hover:border-omp-muted/70 transition flex items-start justify-between gap-3"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium text-white mb-0.5">{item.label}</div>
                        <p className="text-[11px] text-omp-muted leading-relaxed">{item.description}</p>
                      </div>
                      <button
                        type="button"
                        disabled={isSaving}
                        onClick={() => handleToggle(item.key)}
                        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                          currentVal ? 'bg-omp-accent' : 'bg-omp-surfaceLight'
                        }`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                            currentVal ? 'translate-x-5' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>
                  );
                }

                return (
                  <div
                    key={item.key}
                    className="p-3 rounded-xl bg-omp-bg border border-omp-border/70 hover:border-omp-muted/70 transition flex flex-col justify-between space-y-2"
                  >
                    <div>
                      <div className="text-xs font-medium text-white mb-0.5">{item.label}</div>
                      <p className="text-[11px] text-omp-muted leading-relaxed">{item.description}</p>
                    </div>
                    <div className="pt-1">
                      <input
                        type={item.type === 'number' ? 'number' : 'text'}
                        defaultValue={rawVal !== undefined ? String(rawVal) : ''}
                        onBlur={(e) => {
                          if (e.target.value !== String(rawVal ?? '')) {
                            handleTextChange(item.key, e.target.value);
                          }
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.currentTarget.blur();
                          }
                        }}
                        placeholder="Değer girin..."
                        className="w-full bg-omp-surface border border-omp-border rounded-lg px-3 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-omp-accent transition"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* SECTION 4: Ek Seçenekler (Gelişmiş Yapılandırma) */}
          <div className="border border-omp-border rounded-xl bg-omp-bg/80 overflow-hidden">
            <button
              type="button"
              onClick={() => setShowExtra(!showExtra)}
              className="w-full px-4 py-3 bg-omp-surfaceLight/30 hover:bg-omp-surfaceLight/50 flex items-center justify-between text-xs select-none transition"
            >
              <div className="flex items-center space-x-2">
                <Sliders size={15} className="text-omp-accent" />
                <span className="font-semibold text-white">Ek Seçenekler (Gelişmiş Yapılandırma)</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-omp-surface text-omp-muted border border-omp-border font-mono">
                  {extraConfigItems.length} ek ayar
                </span>
              </div>
              <div className="flex items-center space-x-1.5 text-omp-muted">
                <span className="text-[11px]">{showExtra ? 'Gizle' : 'Genişlet & İncele'}</span>
                {showExtra ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
              </div>
            </button>

            {showExtra && (
              <div className="p-4 border-t border-omp-border space-y-3 bg-[#0a0d12]">
                {/* Search in Extra Options */}
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-2.5 text-omp-muted" />
                  <input
                    type="text"
                    value={extraSearch}
                    onChange={(e) => setExtraSearch(e.target.value)}
                    placeholder="Ek seçeneklerde anahtar veya açıklama ara..."
                    className="w-full bg-omp-surface border border-omp-border rounded-xl pl-9 pr-8 py-1.5 text-xs text-white placeholder-omp-muted focus:outline-none focus:border-omp-accent font-mono transition"
                  />
                  {extraSearch && (
                    <button 
                      onClick={() => setExtraSearch('')}
                      className="absolute right-2.5 top-2.5 text-omp-muted hover:text-white"
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>

                {/* Extra Options List */}
                <div className="space-y-2 max-h-72 overflow-y-auto divide-y divide-omp-border/30">
                  {extraConfigItems.length === 0 ? (
                    <div className="p-6 text-center text-xs text-omp-muted">
                      {extraSearch ? 'Aramaya uygun ek seçenek bulunamadı.' : 'Ek ayar bulunamadı.'}
                    </div>
                  ) : (
                    extraConfigItems.map((item) => (
                      <div
                        key={item.key}
                        className="pt-2.5 first:pt-0 p-3 rounded-xl bg-omp-surface/40 border border-omp-border/50 hover:border-omp-muted/60 transition space-y-1.5"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center space-x-2 min-w-0">
                            <span className="font-mono font-semibold text-white text-xs select-all truncate">
                              {item.key}
                            </span>
                            <button
                              onClick={() => copyToClipboard(item.key, item.key)}
                              title="Anahtarı Kopyala"
                              className="text-omp-muted hover:text-white transition"
                            >
                              {copiedKey === item.key ? (
                                <Check size={11} className="text-emerald-400" />
                              ) : (
                                <Copy size={11} />
                              )}
                            </button>
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-omp-surfaceLight text-omp-muted font-mono">
                              {item.type}
                            </span>
                          </div>

                          {editingExtraKey !== item.key && (
                            <button
                              onClick={() => {
                                setEditingExtraKey(item.key);
                                setEditExtraValue(
                                  typeof item.value === 'object'
                                    ? JSON.stringify(item.value)
                                    : String(item.value ?? '')
                                );
                              }}
                              className="text-xs text-omp-accent hover:underline font-medium shrink-0"
                            >
                              Düzenle
                            </button>
                          )}
                        </div>

                        {item.description && (
                          <p className="text-[11px] text-omp-muted leading-relaxed">
                            {item.description}
                          </p>
                        )}

                        {editingExtraKey === item.key ? (
                          <div className="flex items-center space-x-2 pt-1">
                            <input
                              type="text"
                              value={editExtraValue}
                              onChange={(e) => setEditExtraValue(e.target.value)}
                              className="flex-1 bg-omp-bg border border-omp-border rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none focus:border-omp-accent font-mono transition"
                              autoFocus
                            />
                            <button
                              onClick={async () => {
                                await updateSetting(item.key, editExtraValue);
                                setEditingExtraKey(null);
                                loadConfig();
                              }}
                              className="flex items-center space-x-1 px-3 py-1 rounded-lg bg-omp-accent hover:bg-omp-accentHover text-xs text-white font-medium shadow transition"
                            >
                              <Save size={12} />
                              <span>Kaydet</span>
                            </button>
                            <button
                              onClick={() => setEditingExtraKey(null)}
                              className="px-2 py-1 rounded-lg border border-omp-border hover:bg-omp-border text-xs text-omp-muted hover:text-white transition"
                            >
                              İptal
                            </button>
                          </div>
                        ) : (
                          <div className="pt-0.5">
                            <span className="font-mono text-xs text-omp-accent bg-omp-bg/80 px-2 py-0.5 rounded border border-omp-border/60 select-all inline-block max-w-full truncate">
                              {typeof item.value === 'object'
                                ? JSON.stringify(item.value)
                                : String(item.value ?? 'boş')}
                            </span>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-omp-border bg-omp-surfaceLight/30 flex items-center justify-between text-xs text-omp-muted select-none shrink-0">
          <span>Değişiklikler anında uygulanır ve <code className="text-omp-accent font-mono">~/.omp/config.json</code> dosyasına kaydedilir.</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg border border-omp-border hover:bg-omp-border text-white transition text-xs font-medium"
          >
            Kapat
          </button>
        </div>
      </div>
    </div>
  );
};
