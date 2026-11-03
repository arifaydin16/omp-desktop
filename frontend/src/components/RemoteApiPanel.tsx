import React, { useState, useEffect } from 'react';
import { Rune } from './Rune';
import * as AppApi from '../../wailsjs/go/main/App';
import { EventsOn } from '../../wailsjs/runtime/runtime';
import { remoteapi } from '../../wailsjs/go/models';

export const RemoteApiPanel: React.FC = () => {
  const [config, setConfig] = useState<remoteapi.RemoteApiConfig>({
    enabled: false,
    port: 37420,
    host: '0.0.0.0',
    apiKey: '',
    pollingEnabled: false,
    pollingUrl: '',
    pollingInterval: 5,
    pollingApiKey: '',
  });

  const [status, setStatus] = useState<remoteapi.RemoteApiStatus | null>(null);
  const [saving, setSaving] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'endpoints' | 'polling' | 'quickstart' | 'settings'>('polling');

  // Load initial configuration and status
  const loadData = async () => {
    try {
      const cfg = await AppApi.GetRemoteApiConfig();
      if (cfg) {
        setConfig(cfg);
        // If polling is already enabled, default to polling tab
        if (cfg.pollingEnabled) {
          setActiveTab('polling');
        }
      }
      const st = await AppApi.GetRemoteApiStatus();
      if (st) {
        setStatus(st);
      }
    } catch (err) {
      console.error('Failed to load remote API state:', err);
    }
  };

  useEffect(() => {
    loadData();

    // Listen to real-time status updates from backend
    const unsub = EventsOn('remote_api:status', (data: unknown) => {
      if (data && typeof data === 'object') {
        setStatus(data as remoteapi.RemoteApiStatus);
      }
    });

    return () => {
      if (unsub) unsub();
    };
  }, []);

  const handleToggleEnable = async (enable: boolean) => {
    setSaving(true);
    try {
      const updated = { ...config, enabled: enable };
      setConfig(updated);
      await AppApi.SetRemoteApiConfig(updated);
      const st = await AppApi.GetRemoteApiStatus();
      if (st) setStatus(st);
    } catch (err: unknown) {
      console.error('Failed to toggle remote API:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleTogglePolling = async (enable: boolean) => {
    setSaving(true);
    try {
      const updated = { ...config, pollingEnabled: enable };
      setConfig(updated);
      await AppApi.SetRemoteApiConfig(updated);
      const st = await AppApi.GetRemoteApiStatus();
      if (st) setStatus(st);
    } catch (err: unknown) {
      console.error('Failed to toggle polling mode:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveConfig = async () => {
    setSaving(true);
    try {
      await AppApi.SetRemoteApiConfig(config);
      const st = await AppApi.GetRemoteApiStatus();
      if (st) setStatus(st);
    } catch (err: unknown) {
      console.error('Failed to save config:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleRegenerateKey = async () => {
    if (!window.confirm('Yeni bir API Anahtarı üretmek istediğinize emin misiniz? Eski anahtar kullanan tüm istemciler geçersiz olacaktır.')) {
      return;
    }
    try {
      const newKey = await AppApi.GenerateNewApiKey();
      setConfig((prev) => ({ ...prev, apiKey: newKey }));
      const st = await AppApi.GetRemoteApiStatus();
      if (st) setStatus(st);
    } catch (err) {
      console.error('Failed to regenerate key:', err);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(id);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const port = config.port || 37420;
  const baseUrl = `http://${config.host === '0.0.0.0' ? 'localhost' : config.host}:${port}`;
  const promptUrl = `${baseUrl}/api/prompt`;
  const statusUrl = `${baseUrl}/api/status`;

  const isServerRunning = status?.running && config.enabled;
  const isPollingRunning = status?.pollingActive && config.pollingEnabled;

  const curlPromptExample = `curl -X POST ${promptUrl} \\
  -H "Authorization: Bearer ${config.apiKey || 'YOUR_API_KEY'}" \\
  -H "Content-Type: application/json" \\
  -d '{"prompt": "Koddaki hataları düzelt ve build et"}'`;

  const curlStatusExample = `curl -X GET "${statusUrl}" \\
  -H "Authorization: Bearer ${config.apiKey || 'YOUR_API_KEY'}"`;

  return (
    <div className="space-y-6 animate-fadeIn text-omp-text">
      {/* 1. Header & Quick Status Bars */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Polling Mode Summary Pill */}
        <div className="p-3.5 rounded-[3px] bg-omp-bg border border-omp-border shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <Rune name="schedule-refresh-cw" size={15} className={isPollingRunning ? "text-emerald-400 animate-spin" : "text-omp-muted"} />
              <span className="text-xs font-bold uppercase tracking-wide text-zinc-100">
                Polling Modu (Çekme)
              </span>
            </div>
            <div className="text-[11px] font-mono text-omp-muted">
              {isPollingRunning ? (
                <span className="text-emerald-400 font-bold">● Aktif // {config.pollingInterval || 5}s aralıkla</span>
              ) : (
                <span>○ Pasif // Beklemede</span>
              )}
            </div>
          </div>
          <button
            type="button"
            disabled={saving}
            onClick={() => handleTogglePolling(!config.pollingEnabled)}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
              config.pollingEnabled ? 'bg-emerald-600' : 'bg-zinc-800'
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                config.pollingEnabled ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        {/* Inbound HTTP Server Summary Pill */}
        <div className="p-3.5 rounded-[3px] bg-omp-bg border border-omp-border shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <Rune name="code-server" size={15} className={isServerRunning ? "text-omp-accent" : "text-omp-muted"} />
              <span className="text-xs font-bold uppercase tracking-wide text-zinc-100">
                HTTP Sunucu (Gelen İstek)
              </span>
            </div>
            <div className="text-[11px] font-mono text-omp-muted">
              {isServerRunning ? (
                <span className="text-omp-accent font-bold">● Port: {port} Dinleniyor</span>
              ) : (
                <span>○ Sunucu Kapalı</span>
              )}
            </div>
          </div>
          <button
            type="button"
            disabled={saving}
            onClick={() => handleToggleEnable(!config.enabled)}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
              config.enabled ? 'bg-omp-accent' : 'bg-zinc-800'
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                config.enabled ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>
      </div>

      {/* Real-time Execution Banner */}
      {status?.isWorking && (
        <div className="p-3 rounded-[3px] bg-omp-accent/15 border border-omp-accent/40 flex items-center justify-between text-xs animate-pulse">
          <div className="flex items-center space-x-2">
            <span className="w-2.5 h-2.5 rounded-full bg-omp-accent animate-ping"></span>
            <span className="font-bold text-zinc-200">Uzak / Polling Ajanı Şu Anda Çalışıyor...</span>
          </div>
          {status.activeRunId && (
            <span className="font-mono text-[10px] text-omp-accent font-bold">
              ID: {status.activeRunId}
            </span>
          )}
        </div>
      )}

      {/* 2. API Key Management Box */}
      <div className="p-4 rounded-[3px] bg-omp-surface border border-omp-border space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold uppercase tracking-wider text-zinc-300 flex items-center space-x-1.5">
            <Rune name="identity-lock" size={13} className="text-omp-accent" />
            <span>Gizli API Anahtarı (API Key)</span>
          </label>
          <span className="text-[10px] text-omp-muted font-mono">
            Authorization: Bearer &lt;API_KEY&gt;
          </span>
        </div>

        <div className="flex items-center space-x-2">
          <div className="relative flex-1">
            <input
              type={showKey ? 'text' : 'password'}
              readOnly
              value={config.apiKey}
              className="w-full bg-omp-bg border border-omp-border rounded-[2px] px-3 py-1.5 font-mono text-xs text-zinc-200 tracking-wider select-all focus:outline-none"
            />
          </div>

          <button
            type="button"
            onClick={() => setShowKey(!showKey)}
            className="px-2.5 py-1.5 rounded-[2px] bg-omp-bg border border-omp-border hover:bg-omp-surface text-zinc-300 hover:text-white text-xs transition"
            title={showKey ? 'Gizle' : 'Göster'}
          >
            {showKey ? 'Gizle' : 'Göster'}
          </button>

          <button
            type="button"
            onClick={() => copyToClipboard(config.apiKey, 'api-key')}
            className={`px-3 py-1.5 rounded-[2px] border text-xs font-mono font-bold transition flex items-center space-x-1.5 ${
              copiedKey === 'api-key'
                ? 'bg-emerald-600 border-emerald-500 text-white'
                : 'bg-omp-accent text-white border-transparent hover:opacity-90'
            }`}
          >
            <Rune name={copiedKey === 'api-key' ? 'indicators-check' : 'code-copy'} size={12} />
            <span>{copiedKey === 'api-key' ? 'KOPYALANDI' : 'KOPYALA'}</span>
          </button>

          <button
            type="button"
            onClick={handleRegenerateKey}
            className="px-2.5 py-1.5 rounded-[2px] bg-omp-bg border border-omp-border hover:border-amber-500/50 text-zinc-400 hover:text-amber-300 text-xs transition"
            title="Yeni API Anahtarı Oluştur"
          >
            Yeni Üret
          </button>
        </div>
      </div>

      {/* 3. Sub Tabs: Polling / Endpoints / Quickstart / Settings */}
      <div className="space-y-4">
        <div className="flex items-center space-x-1 border-b border-omp-border pb-1 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('polling')}
            className={`px-3 py-1.5 text-xs font-mono uppercase tracking-wider rounded-[2px] transition shrink-0 ${
              activeTab === 'polling'
                ? 'bg-emerald-600 text-white font-bold'
                : 'text-omp-muted hover:text-zinc-200'
            }`}
          >
            01 // Polling Modu (Uzak Görev & Webhook)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('endpoints')}
            className={`px-3 py-1.5 text-xs font-mono uppercase tracking-wider rounded-[2px] transition shrink-0 ${
              activeTab === 'endpoints'
                ? 'bg-omp-accent text-white font-bold'
                : 'text-omp-muted hover:text-zinc-200'
            }`}
          >
            02 // Doğrudan Uç Noktalar (HTTP Push)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('quickstart')}
            className={`px-3 py-1.5 text-xs font-mono uppercase tracking-wider rounded-[2px] transition shrink-0 ${
              activeTab === 'quickstart'
                ? 'bg-omp-accent text-white font-bold'
                : 'text-omp-muted hover:text-zinc-200'
            }`}
          >
            03 // cURL Örnekleri
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('settings')}
            className={`px-3 py-1.5 text-xs font-mono uppercase tracking-wider rounded-[2px] transition shrink-0 ${
              activeTab === 'settings'
                ? 'bg-omp-accent text-white font-bold'
                : 'text-omp-muted hover:text-zinc-200'
            }`}
          >
            04 // Port & Sunucu Ayarları
          </button>
        </div>

        {/* TAB 1: Polling Mode Details */}
        {activeTab === 'polling' && (
          <div className="space-y-4 animate-fadeIn p-4 rounded-[3px] bg-omp-surface border border-omp-border">
            {/* Explanatory Banner */}
            <div className="p-3.5 rounded-[2px] bg-emerald-950/25 border border-emerald-500/30 text-emerald-200 text-xs flex items-start space-x-3">
              <Rune name="glass-shield" size={18} className="text-emerald-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <div className="font-bold text-emerald-300 uppercase tracking-wide text-[11px]">
                  Sıfır Port Yapılandırması & NAT/Güvenlik Duvarı Aşımı (Outbound Pull)
                </div>
                <p className="text-[11px] text-emerald-200/90 leading-relaxed">
                  Sunucunuz uzakta veya bulutta çalışırken, dışarıdan yerel bilgisayarınıza port açmaya veya karmaşık tüneller kurmaya gerek kalmaz. <strong>Polling Modu</strong> aktifken OMP Desktop dışa doğru güvenli HTTPS istekleriyle uzak sunucuyu yoklar; bekleyen bir görev olduğunda anında canlı çalışma dizininde tam yetkiyle çalıştırır ve tamamlanma durumunu sunucuya bildirir.
                </p>
              </div>
            </div>

            {/* Polling Live Status Indicator */}
            <div className="p-3 rounded-[2px] bg-omp-bg border border-omp-border font-mono text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
              <div className="flex items-center space-x-2">
                <span className={`w-2.5 h-2.5 rounded-full ${isPollingRunning ? 'bg-emerald-400 animate-pulse' : 'bg-zinc-600'}`}></span>
                <span className="text-zinc-200 font-bold">
                  {isPollingRunning ? 'YOKLAMA AKTİF // Kuyruk Dinleniyor' : 'YOKLAMA PASİF // Durduruldu'}
                </span>
              </div>
              <div className="text-[11px] text-omp-muted space-x-3">
                {status?.lastPollTime && (
                  <span>Son Kontrol: <strong className="text-zinc-300">{status.lastPollTime}</strong></span>
                )}
                {status?.lastPollStatus && (
                  <span className="text-emerald-300">({status.lastPollStatus})</span>
                )}
              </div>
            </div>

            {/* Polling Configuration Inputs */}
            <div className="space-y-3 pt-2">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-zinc-300 uppercase tracking-wider flex items-center justify-between">
                  <span>Uzak Görev Yoklama Uç Noktası (Polling URL) <span className="text-rose-400">*</span></span>
                  <span className="text-[10px] text-omp-muted font-normal">GET & POST uç noktası</span>
                </label>
                <input
                  type="url"
                  value={config.pollingUrl || ''}
                  onChange={(e) => setConfig({ ...config, pollingUrl: e.target.value })}
                  placeholder="https://api.example.com/tasks/poll"
                  className="w-full bg-omp-bg border border-omp-border rounded-[2px] px-3 py-1.5 font-mono text-xs text-zinc-200 focus:outline-none focus:border-emerald-500"
                />
                <p className="text-[10px] text-omp-muted">
                  Uzak sunucunuzdaki görev yoklama uç noktasını (API veya webhook) girin.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-zinc-300 uppercase tracking-wider">
                    Yoklama Sıklığı (Saniye)
                  </label>
                  <input
                    type="number"
                    min={2}
                    max={60}
                    value={config.pollingInterval || 5}
                    onChange={(e) => setConfig({ ...config, pollingInterval: parseInt(e.target.value) || 5 })}
                    className="w-full bg-omp-bg border border-omp-border rounded-[2px] px-3 py-1.5 font-mono text-xs text-zinc-200 focus:outline-none focus:border-emerald-500"
                  />
                  <p className="text-[10px] text-omp-muted">Önerilen: 5 saniye (2 - 60 arası).</p>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-zinc-300 uppercase tracking-wider flex items-center justify-between">
                    <span>Polling API Anahtarı <span className="text-rose-400">*</span></span>
                    <span className="text-[10px] text-emerald-400 font-normal">Kimlik Doğrulama</span>
                  </label>
                  <input
                    type="text"
                    value={config.pollingApiKey || ''}
                    onChange={(e) => setConfig({ ...config, pollingApiKey: e.target.value })}
                    placeholder="Örn: omp_poll_... (Uzak API anahtarınız)"
                    className="w-full bg-omp-bg border border-omp-border rounded-[2px] px-3 py-1.5 font-mono text-xs text-zinc-200 focus:outline-none focus:border-emerald-500"
                  />
                  <p className="text-[10px] text-omp-muted">
                    Uzak görev sunucusuna güvenli erişim ve kimlik doğrulaması sağlamak için tanımlanan API Key'i buraya girin.
                  </p>
                </div>
              </div>

              <div className="pt-3 border-t border-omp-border flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="pollingActiveCheckbox"
                    checked={config.pollingEnabled || false}
                    onChange={(e) => setConfig({ ...config, pollingEnabled: e.target.checked })}
                    className="rounded-[2px] border-omp-border bg-omp-bg text-emerald-500 focus:ring-0"
                  />
                  <label htmlFor="pollingActiveCheckbox" className="text-xs text-zinc-300 cursor-pointer font-medium">
                    Polling Modunu Aktif Tut
                  </label>
                </div>

                <button
                  type="button"
                  disabled={saving}
                  onClick={handleSaveConfig}
                  className="px-4 py-2 rounded-[2px] bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs uppercase tracking-wide transition shadow-sm"
                >
                  {saving ? 'Kaydediliyor...' : 'Kaydet & Polling Ayarlarını Güncelle'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: Endpoints List */}
        {activeTab === 'endpoints' && (
          <div className="space-y-3 animate-fadeIn">
            <div className="p-3.5 rounded-[3px] bg-omp-surface border border-omp-border space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <span className="px-1.5 py-0.5 rounded-[2px] bg-emerald-600/20 text-emerald-400 border border-emerald-500/40 text-[10px] font-mono font-bold">
                    POST
                  </span>
                  <span className="text-xs font-bold text-zinc-200">Prompt Endpoint URL</span>
                </div>
                <button
                  type="button"
                  onClick={() => copyToClipboard(promptUrl, 'prompt-url')}
                  className="px-2 py-1 rounded-[2px] bg-omp-bg border border-omp-border hover:bg-omp-accent hover:text-white text-zinc-300 text-[11px] font-mono flex items-center space-x-1 transition"
                >
                  <Rune name={copiedKey === 'prompt-url' ? 'indicators-check' : 'code-copy'} size={11} />
                  <span>{copiedKey === 'prompt-url' ? 'KOPYALANDI' : 'KOPYALA'}</span>
                </button>
              </div>

              <div className="font-mono text-xs bg-omp-bg px-2.5 py-1.5 rounded border border-omp-border text-emerald-300 break-all select-all">
                {promptUrl}
              </div>

              <p className="text-[11px] text-omp-muted leading-relaxed">
                JSON body içerisinde <code>prompt</code> ve opsiyonel <code>workspace_path</code> alanını göndererek doğrudan canlı projede yeni bir ajan görevi başlatır. Ajan full-access modunda çalışır ve dosyaları anında günceller.
              </p>
            </div>

            <div className="p-3.5 rounded-[3px] bg-omp-surface border border-omp-border space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <span className="px-1.5 py-0.5 rounded-[2px] bg-sky-600/20 text-sky-400 border border-sky-500/40 text-[10px] font-mono font-bold">
                    GET
                  </span>
                  <span className="text-xs font-bold text-zinc-200">Status Endpoint URL</span>
                </div>
                <button
                  type="button"
                  onClick={() => copyToClipboard(statusUrl, 'status-url')}
                  className="px-2 py-1 rounded-[2px] bg-omp-bg border border-omp-border hover:bg-omp-accent hover:text-white text-zinc-300 text-[11px] font-mono flex items-center space-x-1 transition"
                >
                  <Rune name={copiedKey === 'status-url' ? 'indicators-check' : 'code-copy'} size={11} />
                  <span>{copiedKey === 'status-url' ? 'KOPYALANDI' : 'KOPYALA'}</span>
                </button>
              </div>

              <div className="font-mono text-xs bg-omp-bg px-2.5 py-1.5 rounded border border-omp-border text-sky-300 break-all select-all">
                {statusUrl}
              </div>

              <p className="text-[11px] text-omp-muted leading-relaxed">
                Ajanın o an çalışıp çalışmadığını (<code>isWorking: boolean</code>), aktif görev ID'sini ve son tamamlanan çalıştırma durumunu döndüren HTTP GET uç noktasıdır.
              </p>
            </div>
          </div>
        )}

        {/* TAB 3: Quickstart & cURL Examples */}
        {activeTab === 'quickstart' && (
          <div className="space-y-4 animate-fadeIn">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-zinc-300">1. Doğrudan Komut Çalıştırma (Prompt POST):</span>
                <button
                  type="button"
                  onClick={() => copyToClipboard(curlPromptExample, 'curl-prompt')}
                  className="text-[11px] text-omp-accent hover:underline flex items-center space-x-1"
                >
                  <Rune name={copiedKey === 'curl-prompt' ? 'indicators-check' : 'code-copy'} size={11} />
                  <span>{copiedKey === 'curl-prompt' ? 'Kopyalandı' : 'cURL Kopyala'}</span>
                </button>
              </div>
              <pre className="p-3 bg-omp-bg rounded-[2px] border border-omp-border font-mono text-[11px] text-zinc-300 overflow-x-auto select-all">
                {curlPromptExample}
              </pre>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-zinc-300">2. Durum Kontrolü (Status GET):</span>
                <button
                  type="button"
                  onClick={() => copyToClipboard(curlStatusExample, 'curl-status')}
                  className="text-[11px] text-omp-accent hover:underline flex items-center space-x-1"
                >
                  <Rune name={copiedKey === 'curl-status' ? 'indicators-check' : 'code-copy'} size={11} />
                  <span>{copiedKey === 'curl-status' ? 'Kopyalandı' : 'cURL Kopyala'}</span>
                </button>
              </div>
              <pre className="p-3 bg-omp-bg rounded-[2px] border border-omp-border font-mono text-[11px] text-zinc-300 overflow-x-auto select-all">
                {curlStatusExample}
              </pre>
            </div>
          </div>
        )}

        {/* TAB 4: Configuration & Port */}
        {activeTab === 'settings' && (
          <div className="space-y-4 animate-fadeIn p-4 rounded-[3px] bg-omp-surface border border-omp-border">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-zinc-300 uppercase tracking-wider">
                  Dinleme Portu (Port)
                </label>
                <input
                  type="number"
                  value={config.port}
                  onChange={(e) => setConfig({ ...config, port: parseInt(e.target.value) || 37420 })}
                  className="w-full bg-omp-bg border border-omp-border rounded-[2px] px-3 py-1.5 font-mono text-xs text-zinc-200 focus:outline-none focus:border-omp-accent"
                />
                <p className="text-[10px] text-omp-muted">Varsayılan port 37420'dir.</p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-zinc-300 uppercase tracking-wider">
                  Dinleme Arayüzü (Host)
                </label>
                <select
                  value={config.host}
                  onChange={(e) => setConfig({ ...config, host: e.target.value })}
                  className="w-full bg-omp-bg border border-omp-border rounded-[2px] px-3 py-1.5 font-mono text-xs text-zinc-200 focus:outline-none focus:border-omp-accent"
                >
                  <option value="0.0.0.0">0.0.0.0 (Tüm Ağ Arayüzleri / Yerel Ağ - Önerilen)</option>
                  <option value="127.0.0.1">127.0.0.1 (Yalnızca Yerel Makine)</option>
                </select>
                <p className="text-[10px] text-omp-muted">Dışarıdan veya ağdan erişim için 0.0.0.0 önerilir.</p>
              </div>
            </div>

            <div className="pt-2 border-t border-omp-border flex justify-end">
              <button
                type="button"
                disabled={saving}
                onClick={handleSaveConfig}
                className="px-4 py-1.5 rounded-[2px] bg-omp-accent hover:opacity-90 text-white font-bold text-xs uppercase tracking-wide transition"
              >
                {saving ? 'Kaydediliyor...' : 'Kaydet & Yeniden Başlat'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
