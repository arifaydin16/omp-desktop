import React, { useState, useEffect, useMemo } from 'react';
import { Rune } from './Rune';
import * as AppApi from '../../wailsjs/go/main/App';
import { EventsOn } from '../../wailsjs/runtime/runtime';
import { AuthCredentialItem, LoginEvent, LoginProviderDef } from '../types';
import { LOGIN_PROVIDERS } from './authProviders';

export interface AuthenticationPanelProps {
  profile?: string;
  configMap: Record<string, unknown>;
  onToggle: (key: string) => void | Promise<void>;
  onTextChange: (key: string, val: string) => void | Promise<void>;
  savingKey: string | null;
}

export { LOGIN_PROVIDERS };

export const AuthenticationPanel: React.FC<AuthenticationPanelProps> = ({
  profile,
  configMap,
  onToggle,
  onTextChange,
  savingKey,
}) => {
  const [credentials, setCredentials] = useState<AuthCredentialItem[]>([]);
  const [loadingCreds, setLoadingCreds] = useState<boolean>(false);
  const [activeProvider, setActiveProvider] = useState<LoginProviderDef | null>(null);
  const [loginStatus, setLoginStatus] = useState<LoginEvent | null>(null);
  const [isStartingLogin, setIsStartingLogin] = useState<boolean>(false);
  const [manualInput, setManualInput] = useState<string>('');
  const [showManualBox, setShowManualBox] = useState<boolean>(false);
  const [apiKeyInput, setApiKeyInput] = useState<string>('');
  const [showApiKey, setShowApiKey] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [showAdvanced, setShowAdvanced] = useState<boolean>(false);
  const [confirmLogout, setConfirmLogout] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [showBrokerToken, setShowBrokerToken] = useState<boolean>(false);

  // Load active credentials
  const refreshCredentials = async () => {
    setLoadingCreds(true);
    try {
      const res = await AppApi.GetAuthCredentials();
      if (Array.isArray(res)) {
        setCredentials(res);
      }
    } catch (err) {
      console.error('Failed to get auth credentials:', err);
    } finally {
      setLoadingCreds(false);
    }
  };

  useEffect(() => {
    refreshCredentials();

    // Listen to live login events from backend
    const unsub = EventsOn('login_event', (event: LoginEvent) => {
      setLoginStatus(event);
      setIsStartingLogin(false);

      if (event.type === 'success') {
        refreshCredentials();
        setTimeout(() => {
          setActiveProvider(null);
          setLoginStatus(null);
          setManualInput('');
          setApiKeyInput('');
        }, 2200);
      }
    });

    return () => {
      unsub();
    };
  }, [profile]);

  // Copy helper
  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(id);
    setTimeout(() => setCopiedKey(null), 1500);
  };

  // Start OAuth Login
  const handleStartOAuthLogin = async (prov: LoginProviderDef) => {
    setIsStartingLogin(true);
    setLoginStatus({
      type: 'started',
      provider: prov.id,
      message: `${prov.name} için web oturum açma bağlantısı hazırlanıyor...`,
    });

    try {
      await AppApi.StartLogin(prov.id, prov.index);
    } catch (err: unknown) {
      setIsStartingLogin(false);
      setLoginStatus({
        type: 'error',
        provider: prov.id,
        message: err instanceof Error ? err.message : String(err),
      });
    }
  };

  // Submit manual redirect code/URL
  const handleSubmitManual = async () => {
    if (!manualInput.trim()) return;
    try {
      await AppApi.SendLoginInput(manualInput.trim());
      setManualInput('');
    } catch (err) {
      console.error('Failed to send manual input:', err);
    }
  };

  // Cancel active login
  const handleCancelLogin = async () => {
    try {
      await AppApi.CancelLogin();
    } catch (err) {
      console.error('Failed to cancel login:', err);
    } finally {
      setActiveProvider(null);
      setLoginStatus(null);
      setIsStartingLogin(false);
    }
  };

  // Save API Key
  const handleSaveApiKey = async (prov: LoginProviderDef) => {
    if (!apiKeyInput.trim()) return;
    setIsStartingLogin(true);
    setLoginStatus({
      type: 'waiting',
      provider: prov.id,
      message: `${prov.name} API anahtarı sisteme işleniyor...`,
    });

    try {
      await AppApi.SaveApiKeyCredential(prov.id, apiKeyInput.trim());
      setLoginStatus({
        type: 'success',
        provider: prov.id,
        message: `${prov.name} kimlik bilgisi başarıyla kaydedildi!`,
      });
      refreshCredentials();
      setTimeout(() => {
        setActiveProvider(null);
        setLoginStatus(null);
        setApiKeyInput('');
      }, 1800);
    } catch (err: unknown) {
      setLoginStatus({
        type: 'error',
        provider: prov.id,
        message: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setIsStartingLogin(false);
    }
  };

  // Logout provider
  const handleLogout = async (providerId: string) => {
    try {
      await AppApi.LogoutProvider(providerId);
      setConfirmLogout(null);
      refreshCredentials();
    } catch (err) {
      console.error('Failed to logout provider:', err);
    }
  };

  // Filter providers
  const filteredProviders = useMemo(() => {
    return LOGIN_PROVIDERS.filter((prov) => {
      // Category filter
      if (selectedCategory === 'Popular' && prov.category !== 'Popular') return false;
      if (selectedCategory === 'OAuth' && prov.type !== 'oauth') return false;
      if (selectedCategory === 'API Key' && prov.type !== 'api_key') return false;
      if (selectedCategory === 'Local' && prov.type !== 'local') return false;

      // Text search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchId = prov.id.toLowerCase().includes(q);
        const matchName = prov.name.toLowerCase().includes(q);
        const matchDesc = prov.description?.toLowerCase().includes(q) || false;
        return matchId || matchName || matchDesc;
      }
      return true;
    });
  }, [selectedCategory, searchQuery]);

  const connectedSet = useMemo(() => {
    return new Set(credentials.map((c) => c.provider.toLowerCase()));
  }, [credentials]);

  return (
    <div className="space-y-5 animate-fadeIn font-mono text-xs">
      {/* 1. Header Banner */}
      <div className="p-3.5 rounded-[2px] bg-omp-surface border border-omp-border flex items-start justify-between gap-4">
        <div className="flex items-start space-x-3">
          <div className="w-7 h-7 rounded-[2px] bg-omp-accent flex items-center justify-center text-white shrink-0 mt-0.5">
            <Rune name="identity-lock" size={14} />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-bold text-white text-xs uppercase tracking-wider">
                PROVIDER AUTHENTICATION // LOGIN
              </span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-[2px] bg-omp-bg text-omp-accent border border-omp-border font-mono">
                OMP /LOGIN
              </span>
            </div>
            <p className="text-[11px] text-omp-muted mt-1 font-sans leading-relaxed">
              Model sağlayıcılarına OAuth 2.0 veya API anahtarıyla oturum açın. Giriş bilgileri seçili profile (
              <span className="text-white font-mono font-bold">{profile || 'default'}</span>) izole olarak kaydedilir.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={refreshCredentials}
          disabled={loadingCreds}
          title="Kimlik listesini yenile"
          className="p-1 rounded-[2px] border border-omp-border hover:bg-omp-bg text-omp-muted hover:text-white transition shrink-0"
        >
          <Rune name="schedule-refresh-cw" size={13} className={loadingCreds ? 'animate-spin text-omp-accent' : ''} />
        </button>
      </div>

      {/* 2. Connected Credentials Section */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between border-b border-omp-border pb-1.5">
          <div className="flex items-center space-x-2 text-white font-bold text-xs select-none uppercase tracking-wider">
            <Rune name="identity-shield-check" size={13} className="text-omp-success" />
            <span>CONNECTED PROVIDERS ({credentials.length})</span>
          </div>
          <span className="text-[10px] text-omp-muted font-mono">
            PROF: {profile || 'default'}
          </span>
        </div>

        {credentials.length === 0 ? (
          <div className="p-4 rounded-[2px] bg-omp-bg border border-omp-border text-center py-6">
            <Rune name="identity-lock" size={20} className="text-omp-muted mx-auto mb-2 opacity-40" />
            <div className="text-xs text-white font-bold mb-1 uppercase tracking-wider">BAĞLI HESAP BULUNMUYOR</div>
            <p className="text-[11px] text-omp-muted max-w-sm mx-auto font-sans">
              Aşağıdaki katalogdan sağlayıcı seçerek web üzerinden veya API anahtarıyla doğrudan giriş yapabilirsiniz.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            {credentials.map((cred) => {
              const provDef = LOGIN_PROVIDERS.find((p) => p.id === cred.provider);
              const displayName = provDef ? provDef.name : cred.provider;
              const isOAuth = cred.type === 'oauth';

              return (
                <div
                  key={cred.provider}
                  className="p-3 rounded-[2px] bg-omp-bg border border-omp-border hover:border-omp-accent transition flex flex-col justify-between space-y-2.5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start space-x-2 min-w-0">
                      <div className="w-6 h-6 rounded-[2px] bg-omp-surface border border-omp-border flex items-center justify-center shrink-0 mt-0.5">
                        {isOAuth ? (
                          <Rune name="indicators-square-arrow-out-up-right" size={12} className="text-cyan-400" />
                        ) : (
                          <Rune name="identity-lock" size={12} className="text-omp-success" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-white truncate uppercase tracking-tight" title={displayName}>
                          {displayName}
                        </div>
                        <div className="flex items-center space-x-2 mt-0.5">
                          <span
                            className={`text-[9px] px-1.5 py-0.2 rounded-[2px] font-mono uppercase font-bold tracking-wider ${
                              isOAuth
                                ? 'bg-cyan-950/80 text-cyan-300 border border-cyan-800/60'
                                : 'bg-emerald-950/80 text-emerald-300 border border-emerald-800/60'
                            }`}
                          >
                            {isOAuth ? 'OAuth 2.0' : 'API Key'}
                          </span>
                          <span className="text-[10px] text-omp-success flex items-center space-x-1 font-mono uppercase">
                            <span>ONLINE</span>
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center space-x-1">
                      {confirmLogout === cred.provider ? (
                        <div className="flex items-center space-x-1 bg-omp-error/20 p-1 rounded-[2px] border border-omp-error/50">
                          <button
                            type="button"
                            onClick={() => handleLogout(cred.provider)}
                            className="px-2 py-0.5 rounded-[2px] bg-omp-error text-white text-[10px] font-bold uppercase transition"
                          >
                            ÇIKIŞ
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmLogout(null)}
                            className="px-1.5 py-0.5 rounded-[2px] text-zinc-300 hover:text-white text-[10px]"
                          >
                            İPTAL
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmLogout(cred.provider)}
                          title="Oturumu kapat / kaldır"
                          className="p-1 rounded-[2px] border border-omp-border hover:bg-omp-error/20 text-omp-muted hover:text-omp-error transition"
                        >
                          <Rune name="identity-log-out" size={13} />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Account Details / Token */}
                  <div className="p-2 rounded-[2px] bg-omp-surface border border-omp-border text-[10px] font-mono space-y-1">
                    {cred.email && (
                      <div className="flex items-center justify-between text-zinc-300">
                        <span className="text-omp-muted">ACCOUNT:</span>
                        <span className="text-white font-bold truncate max-w-[180px]" title={cred.email}>
                          {cred.email}
                        </span>
                      </div>
                    )}
                    {cred.key && (
                      <div className="flex items-center justify-between text-zinc-300">
                        <span className="text-omp-muted">KEY:</span>
                        <span className="text-omp-success font-bold">{cred.key}</span>
                      </div>
                    )}
                    {cred.projectId && (
                      <div className="flex items-center justify-between text-zinc-400">
                        <span className="text-omp-muted">PROJECT:</span>
                        <span className="truncate max-w-[160px]">{cred.projectId}</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 3. Interactive Login Flow Overlay */}
      {activeProvider && (
        <div className="p-4 rounded-[2px] bg-omp-surface border-2 border-omp-accent shadow-2xl space-y-3 font-mono">
          <div className="flex items-start justify-between border-b border-omp-border pb-2.5">
            <div className="flex items-center space-x-2.5">
              <div className="w-6 h-6 rounded-[2px] bg-omp-bg border border-omp-border flex items-center justify-center shrink-0">
                {activeProvider.type === 'oauth' ? (
                  <Rune name="indicators-square-arrow-out-up-right" size={14} className="text-cyan-400" />
                ) : activeProvider.type === 'local' ? (
                  <Rune name="code-server" size={14} className="text-amber-400" />
                ) : (
                  <Rune name="identity-lock" size={14} className="text-omp-success" />
                )}
              </div>
              <div>
                <div className="text-xs font-bold text-white uppercase tracking-wider">{activeProvider.name}</div>
                <div className="text-[10px] text-omp-muted">
                  MOD: <span className="uppercase text-omp-accent font-bold">{activeProvider.type}</span>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={handleCancelLogin}
              className="p-1 rounded-[2px] text-omp-muted hover:text-white"
            >
              <Rune name="indicators-x" size={14} />
            </button>
          </div>

          {activeProvider.type === 'oauth' ? (
            <div className="space-y-3">
              {loginStatus?.type === 'url' && loginStatus.url && (
                <div className="p-3 rounded-[2px] bg-omp-bg border border-omp-border space-y-2">
                  <div className="text-[10px] text-omp-muted uppercase tracking-wider">AUTH URL:</div>
                  <div className="flex items-center space-x-2">
                    <button
                      type="button"
                      onClick={() => AppApi.OpenBrowserURL(loginStatus.url!)}
                      className="px-3 py-1 rounded-[2px] bg-omp-accent hover:bg-omp-accentHover text-white font-bold text-xs uppercase flex items-center space-x-1.5 transition"
                    >
                      <Rune name="indicators-square-arrow-out-up-right" size={12} />
                      <span>TARAYICIDA AÇ</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(loginStatus.url!, 'oauth_url')}
                      className="px-3 py-1 rounded-[2px] bg-omp-surface hover:bg-omp-surfaceLight border border-omp-border text-white text-xs font-bold uppercase flex items-center space-x-1.5 transition"
                    >
                      <Rune name="code-copy" size={12} />
                      <span>{copiedKey === 'oauth_url' ? 'KOPYALANDI' : 'KOPYALA'}</span>
                    </button>
                  </div>

                  <div className="text-[10px] text-cyan-300 flex items-center space-x-2 pt-1">
                    <Rune name="schedule-refresh-cw" size={11} className="animate-spin text-cyan-400 shrink-0" />
                    <span>SİSTEM GERİ DÖNÜŞÜ (CALLBACK) BEKLİYOR...</span>
                  </div>
                </div>
              )}

              {loginStatus?.type === 'waiting' && (
                <div className="p-2.5 rounded-[2px] bg-omp-bg border border-omp-border flex items-center space-x-2 text-xs text-zinc-200">
                  <Rune name="schedule-refresh-cw" size={12} className="animate-spin text-omp-accent shrink-0" />
                  <span>{loginStatus.message || 'Tarayıcıda yetkilendirme bekleniyor...'}</span>
                </div>
              )}

              {loginStatus?.type === 'success' && (
                <div className="p-2.5 rounded-[2px] bg-omp-success/15 border border-omp-success/40 text-omp-success flex items-center space-x-2 text-xs font-bold">
                  <Rune name="indicators-circle-check" size={13} className="shrink-0" />
                  <span>{loginStatus.message || 'GİRİŞ BAŞARILI!'}</span>
                </div>
              )}

              {loginStatus?.type === 'error' && (
                <div className="p-2.5 rounded-[2px] bg-omp-error/15 border border-omp-error/40 text-omp-error flex items-center space-x-2 text-xs">
                  <Rune name="glass-exclamation-triangle-1" size={13} className="shrink-0" />
                  <span>{loginStatus.message || 'Giriş başarısız oldu.'}</span>
                </div>
              )}

              <div className="flex items-center justify-between pt-1">
                <button
                  type="button"
                  onClick={() => setShowManualBox(!showManualBox)}
                  className="text-[10px] text-omp-muted hover:text-white transition flex items-center space-x-1 uppercase"
                >
                  <span>MANUEL KOD / URL</span>
                  <Rune name={showManualBox ? 'arrows-chevron-up' : 'arrows-chevron-down'} size={10} />
                </button>

                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={handleCancelLogin}
                    className="px-3 py-1 rounded-[2px] border border-omp-border hover:bg-omp-surfaceLight text-zinc-300 text-xs uppercase"
                  >
                    İPTAL
                  </button>
                  <button
                    type="button"
                    disabled={isStartingLogin}
                    onClick={() => handleStartOAuthLogin(activeProvider)}
                    className="px-4 py-1 rounded-[2px] bg-omp-accent hover:bg-omp-accentHover text-white font-bold text-xs uppercase tracking-wider flex items-center space-x-1.5 transition"
                  >
                    {isStartingLogin ? (
                      <>
                        <Rune name="schedule-refresh-cw" size={12} className="animate-spin" />
                        <span>BAŞLATILIYOR...</span>
                      </>
                    ) : (
                      <>
                        <Rune name="indicators-square-arrow-out-up-right" size={12} />
                        <span>WEB İLE GİRİŞ BAŞLAT</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {showManualBox && (
                <div className="p-2.5 rounded-[2px] bg-omp-bg border border-omp-border space-y-1.5">
                  <div className="flex items-center space-x-2">
                    <input
                      type="text"
                      value={manualInput}
                      onChange={(e) => setManualInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSubmitManual()}
                      placeholder="http://localhost:54545/callback?code=... veya yetkilendirme kodu"
                      className="flex-1 bg-omp-surface border border-omp-border rounded-[2px] px-2.5 py-1 text-xs text-white font-mono focus:outline-none focus:border-omp-accent"
                    />
                    <button
                      type="button"
                      onClick={handleSubmitManual}
                      className="px-3 py-1 rounded-[2px] bg-omp-accent text-white text-xs font-bold uppercase"
                    >
                      GÖNDER
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-omp-muted">
                <span>Resmi konsoldan anahtar temin edin:</span>
                {activeProvider.dashboardUrl && (
                  <button
                    type="button"
                    onClick={() => AppApi.OpenBrowserURL(activeProvider.dashboardUrl!)}
                    className="text-omp-accent hover:underline flex items-center space-x-1 uppercase text-[10px] font-bold"
                  >
                    <Rune name="indicators-square-arrow-out-up-right" size={11} />
                    <span>KONSOLA GİT</span>
                  </button>
                )}
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between text-[11px] font-bold text-white uppercase">
                  <span>API ANAHTARI</span>
                  <button
                    type="button"
                    onClick={() => setShowApiKey(!showApiKey)}
                    className="text-[10px] text-omp-muted hover:text-white flex items-center space-x-1"
                  >
                    <Rune name={showApiKey ? 'senses-eye-closed' : 'senses-eye'} size={11} />
                    <span>{showApiKey ? 'GİZLE' : 'GÖSTER'}</span>
                  </button>
                </div>
                <input
                  type={showApiKey ? 'text' : 'password'}
                  value={apiKeyInput}
                  onChange={(e) => setApiKeyInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSaveApiKey(activeProvider)}
                  placeholder="sk-..."
                  className="w-full bg-omp-bg border border-omp-border rounded-[2px] px-3 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-omp-accent"
                />
              </div>

              {loginStatus?.type === 'success' && (
                <div className="p-2.5 rounded-[2px] bg-omp-success/15 border border-omp-success/40 text-omp-success flex items-center space-x-2 text-xs font-bold">
                  <Rune name="indicators-circle-check" size={13} className="shrink-0" />
                  <span>{loginStatus.message}</span>
                </div>
              )}

              {loginStatus?.type === 'error' && (
                <div className="p-2.5 rounded-[2px] bg-omp-error/15 border border-omp-error/40 text-omp-error flex items-center space-x-2 text-xs">
                  <Rune name="glass-exclamation-triangle-1" size={13} className="shrink-0" />
                  <span>{loginStatus.message}</span>
                </div>
              )}

              <div className="flex items-center justify-end space-x-2 pt-1">
                <button
                  type="button"
                  onClick={handleCancelLogin}
                  className="px-3 py-1 rounded-[2px] border border-omp-border hover:bg-omp-surfaceLight text-zinc-300 text-xs uppercase"
                >
                  İPTAL
                </button>
                <button
                  type="button"
                  disabled={!apiKeyInput.trim() || isStartingLogin}
                  onClick={() => handleSaveApiKey(activeProvider)}
                  className="px-4 py-1 rounded-[2px] bg-omp-accent hover:bg-omp-accentHover text-white font-bold text-xs uppercase tracking-wider flex items-center space-x-1.5 disabled:opacity-30"
                >
                  {isStartingLogin ? (
                    <>
                      <Rune name="schedule-refresh-cw" size={12} className="animate-spin" />
                      <span>KAYDEDİLİYOR...</span>
                    </>
                  ) : (
                    <>
                      <Rune name="identity-lock" size={12} />
                      <span>KAYDET & GİRİŞ YAP</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 4. Provider Catalog & Search */}
      <div className="space-y-3">
        <div className="flex items-center justify-between border-b border-omp-border pb-1.5">
          <div className="flex items-center space-x-2 text-white font-bold text-xs select-none uppercase tracking-wider">
            <Rune name="tools-sparkles" size={13} className="text-omp-accent" />
            <span>PROVIDER CATALOG ({filteredProviders.length})</span>
          </div>

          <div className="flex items-center bg-omp-surface border border-omp-border rounded-[2px] divide-x divide-omp-border text-[10px] font-mono uppercase tracking-wider">
            {['All', 'Popular', 'OAuth', 'API Key', 'Local'].map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`px-2 py-0.5 transition ${
                  selectedCategory === cat
                    ? 'bg-omp-surfaceLight text-white font-bold'
                    : 'text-omp-muted hover:text-white'
                }`}
              >
                {cat === 'All'
                  ? 'TÜMÜ'
                  : cat === 'Popular'
                  ? 'POPÜLER'
                  : cat === 'OAuth'
                  ? 'OAUTH'
                  : cat === 'API Key'
                  ? 'API KEY'
                  : 'YEREL'}
              </button>
            ))}
          </div>
        </div>

        {/* Search bar */}
        <div className="relative">
          <Rune name="tools-search" size={13} className="absolute left-2.5 top-2.5 text-omp-muted" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Sağlayıcı ara... (anthropic, openai, gemini, deepseek, groq)..."
            className="w-full bg-omp-bg border border-omp-border rounded-[2px] pl-8 pr-8 py-1.5 text-xs text-white placeholder-omp-muted focus:outline-none focus:border-omp-accent font-mono"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-2.5 text-omp-muted hover:text-white"
            >
              <Rune name="indicators-x" size={12} />
            </button>
          )}
        </div>

        {/* Provider Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-[380px] overflow-y-auto pr-1 font-mono">
          {filteredProviders.map((prov) => {
            const isConnected = connectedSet.has(prov.id.toLowerCase());
            const isOAuth = prov.type === 'oauth';
            const isLocal = prov.type === 'local';

            return (
              <div
                key={prov.id}
                className={`p-2.5 rounded-[2px] border transition flex items-center justify-between gap-2.5 ${
                  isConnected
                    ? 'bg-omp-surface border-omp-accent/50'
                    : 'bg-omp-bg border-omp-border hover:border-omp-borderLight'
                }`}
              >
                <div className="flex items-start space-x-2 min-w-0">
                  <div className="w-6 h-6 rounded-[2px] bg-omp-surface border border-omp-border flex items-center justify-center shrink-0 mt-0.5">
                    {isOAuth ? (
                      <Rune name="indicators-square-arrow-out-up-right" size={11} className="text-cyan-400" />
                    ) : isLocal ? (
                      <Rune name="code-server" size={11} className="text-amber-400" />
                    ) : (
                      <Rune name="identity-lock" size={11} className="text-omp-success" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center space-x-1.5">
                      <span className="text-xs font-bold text-white truncate uppercase" title={prov.name}>
                        {prov.name}
                      </span>
                      {isConnected && (
                        <span className="text-[9px] px-1 py-0.2 rounded-[2px] bg-omp-success/15 text-omp-success border border-omp-success/30 font-bold shrink-0">
                          ✓ BAĞLI
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-omp-muted truncate font-sans" title={prov.description}>
                      {prov.description}
                    </div>
                  </div>
                </div>

                <div className="shrink-0 flex items-center space-x-1">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveProvider(prov);
                      setLoginStatus(null);
                      setManualInput('');
                      setApiKeyInput('');
                    }}
                    className={`px-3 py-1 rounded-[2px] text-xs font-bold uppercase tracking-wider transition ${
                      isConnected
                        ? 'border border-omp-border hover:bg-omp-surface text-zinc-300'
                        : 'bg-omp-accent hover:bg-omp-accentHover text-white'
                    }`}
                  >
                    {isConnected ? 'YENİLE' : 'GİRİŞ'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 5. Collapsible Advanced Broker & Privacy Settings */}
      <div className="border border-omp-border rounded-[2px] bg-omp-surface overflow-hidden font-mono">
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="w-full px-3.5 py-2.5 bg-omp-surface hover:bg-omp-surfaceLight flex items-center justify-between text-xs select-none transition"
        >
          <div className="flex items-center space-x-2">
            <Rune name="identity-lock" size={13} className="text-omp-accent" />
            <span className="font-bold text-white uppercase tracking-wider text-[11px]">ADVANCED BROKER & PRIVACY CONFIG</span>
          </div>
          <div className="flex items-center space-x-1 text-omp-muted text-[10px] uppercase">
            <span>{showAdvanced ? 'GİZLE' : 'GÖSTER'}</span>
            <Rune name={showAdvanced ? 'arrows-chevron-up' : 'arrows-chevron-down'} size={11} />
          </div>
        </button>

        {showAdvanced && (
          <div className="p-3.5 border-t border-omp-border space-y-3 animate-fadeIn text-xs">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              {/* secrets.enabled */}
              <div className="p-3 rounded-[2px] bg-omp-bg border border-omp-border flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-bold text-white mb-0.5 uppercase">SECRETS MASKING</div>
                  <div className="text-[10px] text-zinc-500 font-mono mb-1">secrets.enabled</div>
                  <p className="text-[11px] text-omp-muted leading-relaxed font-sans">
                    İstekler sağlayıcıya iletilmeden önce ortam değişkenleri ve API şablonlarını maskeler.
                  </p>
                </div>
                <button
                  type="button"
                  disabled={savingKey === 'secrets.enabled'}
                  onClick={() => onToggle('secrets.enabled')}
                  className={`px-3 py-1 rounded-[2px] text-xs font-mono font-bold uppercase tracking-wider border transition ${
                    Boolean(configMap['secrets.enabled'])
                      ? 'bg-omp-accent text-white border-omp-accent'
                      : 'bg-omp-surface text-omp-muted border-omp-border'
                  }`}
                >
                  {Boolean(configMap['secrets.enabled']) ? 'ON' : 'OFF'}
                </button>
              </div>

              {/* share.redactSecrets */}
              <div className="p-3 rounded-[2px] bg-omp-bg border border-omp-border flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-bold text-white mb-0.5 uppercase">SHARE REDACTION</div>
                  <div className="text-[10px] text-zinc-500 font-mono mb-1">share.redactSecrets</div>
                  <p className="text-[11px] text-omp-muted leading-relaxed font-sans">
                    /share anlık görüntülerinde şifre ve anahtarları otomatik gizler.
                  </p>
                </div>
                <button
                  type="button"
                  disabled={savingKey === 'share.redactSecrets'}
                  onClick={() => onToggle('share.redactSecrets')}
                  className={`px-3 py-1 rounded-[2px] text-xs font-mono font-bold uppercase tracking-wider border transition ${
                    Boolean(configMap['share.redactSecrets'])
                      ? 'bg-omp-accent text-white border-omp-accent'
                      : 'bg-omp-surface text-omp-muted border-omp-border'
                  }`}
                >
                  {Boolean(configMap['share.redactSecrets']) ? 'ON' : 'OFF'}
                </button>
              </div>
            </div>

            {/* auth.broker.url */}
            <div className="p-3 rounded-[2px] bg-omp-bg border border-omp-border space-y-1">
              <div className="text-xs font-bold text-white uppercase">AUTH BROKER URL</div>
              <div className="text-[10px] text-zinc-500 font-mono">auth.broker.url</div>
              <input
                type="text"
                defaultValue={String(configMap['auth.broker.url'] || '')}
                onBlur={(e) => onTextChange('auth.broker.url', e.target.value)}
                placeholder="https://auth.example.com veya boş..."
                className="w-full bg-omp-surface border border-omp-border rounded-[2px] px-3 py-1 text-xs text-white font-mono focus:outline-none focus:border-omp-accent"
              />
            </div>

            {/* auth.broker.token */}
            <div className="p-3 rounded-[2px] bg-omp-bg border border-omp-border space-y-1">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-white uppercase">AUTH BROKER BEARER TOKEN</div>
                  <div className="text-[10px] text-zinc-500 font-mono">auth.broker.token</div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowBrokerToken(!showBrokerToken)}
                  className="text-[10px] text-omp-muted hover:text-white flex items-center space-x-1"
                >
                  <Rune name={showBrokerToken ? 'senses-eye-closed' : 'senses-eye'} size={11} />
                  <span>{showBrokerToken ? 'GİZLE' : 'GÖSTER'}</span>
                </button>
              </div>
              <input
                type={showBrokerToken ? 'text' : 'password'}
                defaultValue={String(configMap['auth.broker.token'] || '')}
                onBlur={(e) => onTextChange('auth.broker.token', e.target.value)}
                placeholder="Bearer token..."
                className="w-full bg-omp-surface border border-omp-border rounded-[2px] px-3 py-1 text-xs text-white font-mono focus:outline-none focus:border-omp-accent"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
