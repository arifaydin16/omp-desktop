import React, { useState, useEffect, useMemo } from 'react';
import { Rune } from './Rune';
import * as AppApi from '../../wailsjs/go/main/App';
import { AuthenticationPanel } from './AuthenticationPanel';

export interface SettingsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  profile?: string;
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
interface AuthSettingDef {
  key: string;
  label: string;
  description: string;
  type: 'string' | 'boolean' | 'secret' | 'array';
  section: string;
}

const AUTH_SETTINGS: AuthSettingDef[] = [
  {
    key: 'auth.broker.url',
    label: 'Auth Broker URL',
    description: 'Kurumsal veya merkezi kimlik doğrulama broker sunucusu adresi.',
    type: 'string',
    section: 'Broker & Hesap Yönetimi',
  },
  {
    key: 'auth.broker.token',
    label: 'Auth Broker Token',
    description: 'Broker sunucusu ile kimlik doğrulama için kullanılan token anahtarı.',
    type: 'secret',
    section: 'Broker & Hesap Yönetimi',
  },
  {
    key: 'auth.accountPolicies',
    label: 'Hesap Dağıtım Politikaları (Account Policies)',
    description: 'Hesaplar arası yük dağıtımı ve kota önceliklendirme kuralları (JSON array).',
    type: 'array',
    section: 'Broker & Hesap Yönetimi',
  },
  {
    key: 'secrets.enabled',
    label: 'Gizli Bilgileri Maskele (Secrets Obfuscation)',
    description: 'Sağlayıcıya giden mesajlardaki şifre, API anahtarı ve hassas token kalıplarını sansürler.',
    type: 'boolean',
    section: 'Güvenlik & Gizlilik',
  },
  {
    key: 'share.redactSecrets',
    label: 'Paylaşımlarda Gizli Bilgileri Maskele',
    description: 'Oturum linki paylaşıldığında hassas kimlik verilerini otomatik temizler.',
    type: 'boolean',
    section: 'Güvenlik & Gizlilik',
  },
  {
    key: 'enabledProviders',
    label: 'İzin Verilen Sağlayıcılar (Enabled Providers)',
    description: 'Aktif olarak kullanılabilecek LLM sağlayıcı listesi (boş = tümü).',
    type: 'array',
    section: 'Sağlayıcı İzinleri',
  },
  {
    key: 'disabledProviders',
    label: 'Engellenen Sağlayıcılar (Disabled Providers)',
    description: 'Kullanımı kısıtlanan veya devre dışı bırakılan LLM sağlayıcı listesi.',
    type: 'array',
    section: 'Sağlayıcı İzinleri',
  },
  {
    key: 'provider.appendOnlyContext',
    label: 'Sağlayıcı Prefix Önbellek Koruması',
    description: 'DeepSeek, Anthropic gibi önbellekli sağlayıcılarda hit oranını korumak için mesaj günlüğünü append-only tutar.',
    type: 'boolean',
    section: 'Sağlayıcı İzinleri',
  },
];


export const SettingsDialog: React.FC<SettingsDialogProps> = ({
  isOpen,
  onClose,
  profile,
}) => {
  const [configMap, setConfigMap] = useState<Record<string, unknown>>({});
  const [allConfigItems, setAllConfigItems] = useState<ConfigItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<string>('');
  
  // Tab navigation state: 'general' | 'auth' | 'extra'
  const [activeTab, setActiveTab] = useState<'general' | 'auth' | 'extra'>('general');
  const [showBrokerToken, setShowBrokerToken] = useState(false);

  // Extra options state
  const [extraSearch, setExtraSearch] = useState('');
  const [editingExtraKey, setEditingExtraKey] = useState<string | null>(null);
  const [editExtraValue, setEditExtraValue] = useState<string>('');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [currentThemeState, setCurrentThemeState] = useState(() => localStorage.getItem('omp_theme') || 'cyber-violet');

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
  }, [isOpen, profile]);

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

  // Extra options: all items that are NOT excluded and NOT in primary/auth lists
  const knownKeySet = useMemo(() => {
    const set = new Set<string>();
    PRIMARY_SETTINGS.forEach((s) => set.add(s.key));
    AUTH_SETTINGS.forEach((s) => set.add(s.key));
    return set;
  }, []);
  
  const extraConfigItems = useMemo(() => {
    return allConfigItems.filter((item) => {
      if (isExcludedKey(item.key)) return false;
      if (knownKeySet.has(item.key)) return false;
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
  }, [allConfigItems, knownKeySet, extraSearch]);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(id);
    setTimeout(() => setCopiedKey(null), 1500);
  };

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 transition-all duration-200 ease-out ${
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
        className={`relative w-full max-w-5xl bg-omp-surface border border-omp-border rounded-[2px] shadow-2xl flex flex-col h-[85vh] overflow-hidden font-mono text-xs transition-all duration-200 ease-out transform ${
          isOpen ? 'scale-100 opacity-100 translate-y-0' : 'scale-95 opacity-0 translate-y-2'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-3 border-b border-omp-border flex items-center justify-between bg-omp-surface select-none shrink-0 font-mono">
          <div className="flex items-center space-x-3">
            <div className="w-6 h-6 bg-omp-accent text-white flex items-center justify-center font-bold rounded-[2px]">
              <Rune name="tools-settings" size={13} />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                  07 // CONFIGURATION & SYSTEM PREFERENCES
                </h3>
                <span className="text-[10px] px-1.5 py-0.2 rounded-[2px] bg-omp-bg text-omp-accent border border-omp-border font-mono">
                  {profile || 'default'}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-1.5">
            <button
              onClick={loadConfig}
              disabled={loading}
              className="p-1 rounded-[2px] bg-omp-bg hover:bg-omp-surfaceLight border border-omp-border text-zinc-300 hover:text-white transition"
              title="Yenile"
            >
              <Rune name="schedule-refresh-cw" size={13} className={loading ? 'animate-spin' : ''} />
            </button>
            <button
              onClick={onClose}
              className="p-1 rounded-[2px] bg-omp-bg hover:bg-omp-error/20 border border-omp-border text-zinc-400 hover:text-omp-error transition"
              title="Kapat"
            >
              <Rune name="indicators-x" size={14} />
            </button>
          </div>
        </div>

        {/* Status Toast Banner */}
        {saveStatus && (
          <div className="px-5 py-2 bg-omp-accent/15 border-b border-omp-accent/30 text-xs text-white font-mono flex justify-between items-center shrink-0">
            <div className="flex items-center space-x-2">
              <Rune name="indicators-check" size={12} className="text-omp-success" />
              <span>{saveStatus}</span>
            </div>
            <button onClick={() => setSaveStatus('')} className="text-zinc-400 hover:text-white font-bold">
              ✕
            </button>
          </div>
        )}

        {/* Main Body: Left Sidebar + Right Content View */}
        <div className="flex-1 flex overflow-hidden font-mono text-xs">
          {/* Left Sidebar */}
          <div className="w-56 shrink-0 bg-omp-surface border-r border-omp-border flex flex-col justify-between p-3 select-none">
            <div className="space-y-1">
              <div className="px-2 py-1 text-[10px] uppercase font-mono font-bold text-omp-muted tracking-wider">
                NAVIGATION //
              </div>
              <button
                type="button"
                onClick={() => setActiveTab('general')}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-[2px] text-xs transition text-left ${
                  activeTab === 'general'
                    ? 'bg-omp-accent text-white font-bold'
                    : 'text-zinc-300 hover:bg-omp-bg hover:text-white'
                }`}
              >
                <div className="flex items-center space-x-2">
                  <Rune name="metrics-sliders-horizontal" size={13} className={activeTab === 'general' ? 'text-white' : 'text-omp-accent'} />
                  <span>01 // GENEL</span>
                </div>
                <span className={`text-[10px] px-1 py-0.2 rounded-[2px] font-mono tabular-nums ${
                  activeTab === 'general' ? 'bg-white/20 text-white' : 'bg-omp-bg text-omp-muted'
                }`}>
                  {PRIMARY_SETTINGS.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('auth')}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-[2px] text-xs transition text-left ${
                  activeTab === 'auth'
                    ? 'bg-omp-accent text-white font-bold'
                    : 'text-zinc-300 hover:bg-omp-bg hover:text-white'
                }`}
              >
                <div className="flex items-center space-x-2">
                  <Rune name="identity-lock" size={13} className={activeTab === 'auth' ? 'text-white' : 'text-omp-accent'} />
                  <span>02 // AUTH</span>
                </div>
                <span className={`text-[10px] px-1 py-0.2 rounded-[2px] font-mono ${
                  activeTab === 'auth' ? 'bg-white/20 text-white' : 'bg-omp-bg text-omp-muted'
                }`}>
                  /login
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('extra')}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-[2px] text-xs transition text-left ${
                  activeTab === 'extra'
                    ? 'bg-omp-accent text-white font-bold'
                    : 'text-zinc-300 hover:bg-omp-bg hover:text-white'
                }`}
              >
                <div className="flex items-center space-x-2">
                  <Rune name="code-terminal" size={13} className={activeTab === 'extra' ? 'text-white' : 'text-omp-accent'} />
                  <span>03 // ADVANCED</span>
                </div>
                <span className={`text-[10px] px-1 py-0.2 rounded-[2px] font-mono tabular-nums ${
                  activeTab === 'extra' ? 'bg-white/20 text-white' : 'bg-omp-bg text-omp-muted'
                }`}>
                  {extraConfigItems.length}
                </span>
              </button>
            </div>

            {/* Bottom active profile info */}
            <div className="p-2.5 rounded-[2px] bg-omp-bg border border-omp-border text-[10px] font-mono space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-omp-muted">PROFIL:</span>
                <span className="text-omp-accent font-bold">{profile || 'default'}</span>
              </div>
              <div className="flex items-center justify-between text-zinc-400">
                <span>AYARLAR:</span>
                <span className="tabular-nums">{allConfigItems.length} param</span>
              </div>
            </div>
          </div>

          {/* Right Content Body */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* TAB 1: Genel Ayarlar */}
            {activeTab === 'general' && (
              <div className="space-y-6 animate-fadeIn">
                {/* SECTION 1: Sistem & Ajan Deneyimi */}
                <div className="space-y-3">
                  <div className="flex items-center space-x-2 text-white font-bold text-xs select-none border-b border-omp-border pb-1.5 uppercase tracking-wider font-mono">
                    <Rune name="identity-shield-check" size={13} className="text-omp-accent" />
                    <span>01 // SİSTEM & AJAN DENEYİMİ</span>
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
                  <div className="flex items-center space-x-2 text-white font-bold text-xs select-none border-b border-omp-border pb-1.5 uppercase tracking-wider font-mono">
                    <Rune name="code-terminal" size={13} className="text-omp-accent" />
                    <span>02 // ARAYÜZ VE GÖRÜNÜM TERCİHLERİ</span>
                  </div>
                  {/* Theme Switcher Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    {[
                      {
                        id: 'cyber-violet',
                        name: 'Pi Gradient (Varsayılan)',
                        badge: 'VARSAYILAN',
                        desc: 'Mat siyah zemin & #E84AC3 / #6EADEE neon gradient',
                        accent: '#E84AC3',
                        bg: '#09090b',
                        gradient: 'linear-gradient(135deg, #E84AC3, #6EADEE)',
                      },
                      {
                        id: 'swiss-dark',
                        name: 'Swiss Dark',
                        badge: 'KLASİK',
                        desc: 'Mat teknik siyah & İsviçre kırmızısı akcent',
                        accent: '#e30613',
                        bg: '#09090b',
                        gradient: '#e30613',
                      },
                      {
                        id: 'swiss-light',
                        name: 'Swiss Light',
                        badge: 'AYDINLIK',
                        desc: 'Temiz beyaz canvas & Kraliyet moru akcent',
                        accent: '#7c3aed',
                        bg: '#ffffff',
                        gradient: '#7c3aed',
                      },
                    ].map((th) => {
                      const isSelected = currentThemeState === th.id;
                      return (
                        <button
                          key={th.id}
                          type="button"
                          onClick={() => {
                            document.documentElement.setAttribute('data-theme', th.id);
                            localStorage.setItem('omp_theme', th.id);
                            setCurrentThemeState(th.id);
                          }}
                          className={`p-3 rounded-[2px] border text-left transition flex flex-col justify-between space-y-2 ${
                            isSelected
                              ? 'border-omp-accent bg-omp-surfaceLight/80 shadow-sm ring-1 ring-omp-accent'
                              : 'border-omp-border bg-omp-bg hover:bg-omp-surfaceLight hover:border-omp-borderLight'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-xs text-white font-mono">{th.name}</span>
                            <span className="text-[9px] px-1 py-0.2 rounded-[2px] bg-omp-bg border border-omp-border text-omp-muted font-mono font-bold">
                              {th.badge}
                            </span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <div
                              className="w-5 h-5 rounded-[2px] border border-omp-border flex items-center justify-center shrink-0"
                              style={{ backgroundColor: th.bg }}
                            >
                              <div className="w-2.5 h-2.5 rounded-full" style={{ background: th.gradient || th.accent }} />
                            </div>
                            <span className="text-[10px] text-omp-muted font-sans leading-tight">
                              {th.desc}
                            </span>
                          </div>
                        </button>
                      );
                    })}
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
                  <div className="flex items-center space-x-2 text-white font-bold text-xs select-none border-b border-omp-border pb-1.5 uppercase tracking-wider font-mono">
                    <Rune name="code-server" size={13} className="text-omp-accent" />
                    <span>03 // GELİŞTİRİCİ VE ALT AJAN PARAMETRELERİ</span>
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
              </div>
            )}

            {/* TAB 2: Authentication */}
            {/* TAB 2: Authentication (/login & Model Sağlayıcıları) */}
            {activeTab === 'auth' && (
              <AuthenticationPanel
                profile={profile}
                configMap={configMap}
                onToggle={handleToggle}
                onTextChange={handleTextChange}
                savingKey={savingKey}
              />
            )}

            {/* TAB 3: Ek Ayarlar (Tüm Gelişmiş Parametreler) */}
            {activeTab === 'extra' && (
              <div className="space-y-4 animate-fadeIn">
                {/* Search in Extra Options */}
                <div className="relative">
                  <Rune name="tools-search" size={13} className="absolute left-2.5 top-2.5 text-omp-muted" />
                  <input
                    type="text"
                    value={extraSearch}
                    onChange={(e) => setExtraSearch(e.target.value)}
                    placeholder="Tüm ek seçeneklerde anahtar veya açıklama ara (örn: tui, timeout, git, bash)..."
                    className="w-full bg-omp-surface border border-omp-border rounded-xl pl-9 pr-8 py-2 text-xs text-white placeholder-omp-muted focus:outline-none focus:border-omp-accent font-mono transition"
                    autoFocus
                  />
                  {extraSearch && (
                    <button 
                      onClick={() => setExtraSearch('')}
                      className="absolute right-2.5 top-2.5 text-omp-muted hover:text-white"
                    >
                      <Rune name="indicators-x" size={12} />
                    </button>
                  )}
                </div>

                <div className="flex items-center justify-between text-xs text-omp-muted px-1 select-none">
                  <span>Listelenen Ayarlar: <strong className="text-white font-mono">{extraConfigItems.length}</strong></span>
                  {extraSearch && <span>Filtre uygulandı</span>}
                </div>

                {/* Extra Options List */}
                <div className="space-y-2.5">
                  {extraConfigItems.length === 0 ? (
                    <div className="p-8 text-center text-xs text-omp-muted bg-omp-bg/50 rounded-xl border border-omp-border/60">
                      {extraSearch ? 'Aramaya uygun ek seçenek bulunamadı.' : 'Ek ayar bulunamadı.'}
                    </div>
                  ) : (
                    extraConfigItems.map((item) => (
                      <div
                        key={item.key}
                        className="p-3.5 rounded-xl bg-omp-bg border border-omp-border/70 hover:border-omp-muted/70 transition space-y-2"
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
                                <Rune name="indicators-check" size={11} className="text-omp-success" />
                              ) : (
                                <Rune name="code-copy" size={11} />
                              )}
                            </button>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-omp-surfaceLight text-omp-muted font-mono">
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
                              className="flex-1 bg-omp-surface border border-omp-border rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none focus:border-omp-accent font-mono transition"
                              autoFocus
                            />
                            <button
                              onClick={async () => {
                                await updateSetting(item.key, editExtraValue);
                                setEditingExtraKey(null);
                                loadConfig();
                              }}
                              className="flex items-center space-x-1 px-3 py-1 rounded-[2px] bg-omp-accent hover:bg-omp-accentHover text-xs text-white font-bold uppercase transition"
                            >
                              <Rune name="indicators-check" size={12} />
                              <span>KAYDET</span>
                            </button>
                            <button
                              className="px-2 py-1 rounded-lg border border-omp-border hover:bg-omp-border text-xs text-omp-muted hover:text-white transition"
                            >
                              İptal
                            </button>
                          </div>
                        ) : (
                          <div className="pt-0.5">
                            <span className="font-mono text-xs text-omp-accent bg-omp-surfaceLight/60 px-2 py-0.5 rounded border border-omp-border/60 select-all inline-block max-w-full truncate">
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
