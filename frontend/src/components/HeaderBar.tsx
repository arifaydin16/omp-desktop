import React, { useState, useEffect, useRef } from 'react';
import { Rune } from './Rune';
import { UpdateStatus } from '../types';
import * as AppApi from '../../wailsjs/go/main/App';
import logoUniversal from '../assets/images/logo-universal.png';

interface HeaderBarProps {
  binaryVersion: string;
  cwd: string;
  onSelectCwd: () => void;
  profile: string;
  onChangeProfile: (p: string) => void;
  updateStatus: UpdateStatus | null;
  onCheckUpdates: () => void;
  onInstallUpdate: (canary: boolean, plugins: boolean) => void;
  activeDrawer: string | null;
  onToggleDrawer: (drawer: string) => void;
  isWorking: boolean;
  isSidebarOpen?: boolean;
  onToggleSidebar?: () => void;
  theme?: string;
  onSelectTheme?: (t: string) => void;
}

const THEMES = [
  {
    id: 'cyber-violet',
    name: 'Pi Gradient (Varsayılan)',
    desc: 'Mat siyah zemin & #E84AC3 / #6EADEE neon gradient',
    accent: '#E84AC3',
    bg: '#09090b',
    dot: 'bg-gradient-to-r from-[#E84AC3] to-[#6EADEE] shadow-sm ring-1 ring-pink-300',
  },
  {
    id: 'swiss-dark',
    name: 'Swiss Dark',
    desc: 'Mat siyah zemin & İsviçre Kırmızısı akcent',
    accent: '#e30613',
    bg: '#09090b',
    dot: 'bg-red-600 ring-1 ring-red-400',
  },
  {
    id: 'swiss-light',
    name: 'Swiss Light',
    desc: 'Beyaz / Aydınlık Tema (Temiz Beyaz & Kraliyet Moru)',
    accent: '#7c3aed',
    bg: '#ffffff',
    dot: 'bg-zinc-200 border border-zinc-400 ring-1 ring-zinc-300',
  },
];

export const HeaderBar: React.FC<HeaderBarProps> = ({
  binaryVersion,
  cwd,
  onSelectCwd,
  profile,
  onChangeProfile,
  updateStatus,
  onCheckUpdates,
  onInstallUpdate,
  activeDrawer,
  onToggleDrawer,
  isWorking,
  isSidebarOpen = false,
  onToggleSidebar,
  theme = 'cyber-violet',
  onSelectTheme,
}) => {
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [useCanary, setUseCanary] = useState(false);
  const [updatePlugins, setUpdatePlugins] = useState(true);
  const [profiles, setProfiles] = useState<string[]>(['default']);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [newProfileInput, setNewProfileInput] = useState('');
  const [showAddProfile, setShowAddProfile] = useState(false);
  const [isThemeOpen, setIsThemeOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement | null>(null);
  const themeRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleThemeClickOutside = (e: MouseEvent) => {
      if (themeRef.current && !themeRef.current.contains(e.target as Node)) {
        setIsThemeOpen(false);
      }
    };
    if (isThemeOpen) {
      document.addEventListener('mousedown', handleThemeClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleThemeClickOutside);
  }, [isThemeOpen]);

  useEffect(() => {
    AppApi.GetProfiles()
      .then((profs) => {
        if (profs && profs.length > 0) {
          setProfiles(profs);
        }
      })
      .catch(console.error);
  }, [profile]);

  // Click outside to close profile dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setIsProfileOpen(false);
        setShowAddProfile(false);
      }
    };
    if (isProfileOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isProfileOpen]);

  return (
    <header className="h-12 border-b border-omp-border bg-omp-surface px-3 flex items-center justify-between select-none tracking-normal">
      {/* LEFT: Sidebar Toggle, Universal Logo & Operational State */}
      <div className="flex items-center space-x-2.5">
        {onToggleSidebar && (
          <button
            onClick={onToggleSidebar}
            className={`px-2 py-1 rounded-[2px] border transition flex items-center space-x-1.5 text-xs font-mono ${
              isSidebarOpen
                ? 'bg-gradient-to-r from-[#E84AC3]/20 to-[#6EADEE]/20 border-[#E84AC3] text-white font-bold shadow-xs'
                : 'bg-omp-bg border-omp-border text-omp-muted hover:text-white hover:border-omp-borderLight'
            }`}
            title={isSidebarOpen ? 'Geçmiş Oturumlar Sidebarını Kapat' : 'Geçmiş Oturumlar (Workspaces) Sidebarını Aç'}
          >
            <Rune name="folder" size={13} className={isSidebarOpen ? 'text-omp-accent' : ''} />
            <span className="hidden md:inline text-[10px] uppercase tracking-wider font-bold">
              OTURUMLAR
            </span>
          </button>
        )}

        {/* Brand Mark with Universal Logo */}
        <div className="flex items-center space-x-2">
          <img
            src={logoUniversal}
            alt="oh-my-pi logo"
            className="w-6 h-6 object-contain rounded-[4px] shadow-sm select-none shrink-0"
          />
          <div className="flex items-baseline space-x-1.5">
            <span className="font-bold text-white tracking-tight text-xs uppercase font-mono">
              oh-my-pi
            </span>
            <span className="text-[10px] px-1.5 py-0.5 bg-omp-bg border border-omp-border text-omp-muted font-mono rounded-[2px]">
              {binaryVersion || 'v18.12.3'}
            </span>
          </div>
        </div>
        {/* Status Indicator Cell */}
        <div className="flex items-center space-x-1.5 text-[11px] font-mono text-omp-muted border-l border-omp-border pl-3">
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              isWorking ? 'bg-omp-warning animate-pulse' : 'bg-omp-success'
            }`}
          />
          <span className="uppercase tracking-wider text-[10px] font-semibold text-zinc-300">
            {isWorking ? 'BUSY' : 'READY'}
          </span>
        </div>
      </div>

      {/* CENTER: Workspace Directory & Profile Selector */}
      <div className="flex items-center space-x-2 max-w-md">
        {/* Working Directory Cell */}
        <button
          onClick={onSelectCwd}
          title={cwd || 'Çalışma dizini seç'}
          className="flex items-center space-x-1.5 text-xs px-2.5 py-1 bg-omp-bg hover:bg-omp-surfaceLight border border-omp-border text-omp-text transition-colors truncate max-w-[240px] rounded-[2px]"
        >
          <Rune name="documents-folder" size={13} className="text-zinc-400 shrink-0" />
          <span className="truncate font-mono text-[11px]">
            {cwd ? cwd.split('\\').pop() || cwd.split('/').pop() || cwd : 'Dizin Seç'}
          </span>
        </button>

        {/* Profile Switcher */}
        <div className="relative" ref={profileRef}>
          <button
            type="button"
            onClick={() => setIsProfileOpen(!isProfileOpen)}
            className="flex items-center space-x-1.5 text-xs px-2.5 py-1 bg-omp-bg hover:bg-omp-surfaceLight border border-omp-border text-zinc-200 transition-colors rounded-[2px]"
            title="Aktif profili değiştir veya yeni profil oluştur"
          >
            <span className="text-[10px] font-mono uppercase tracking-wider text-omp-muted">PROF:</span>
            <span className="font-semibold text-white font-mono text-[11px]">
              {profile || 'default'}
            </span>
            <Rune name="arrows-chevron-down" size={11} className="text-omp-muted" />
          </button>

          {isProfileOpen && (
            <div className="absolute top-full left-0 mt-1 w-56 bg-omp-surfaceElevated border border-omp-border rounded-[2px] shadow-2xl z-50 p-1.5 space-y-1 animate-fadeIn text-xs">
              <div className="px-2 py-1 text-[10px] font-mono uppercase tracking-wider text-omp-muted border-b border-omp-border/60">
                PROFILES // ENV
              </div>

              <div className="max-h-48 overflow-y-auto space-y-0.5">
                {profiles.map((p) => {
                  const isActive = (profile || 'default') === p;
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => {
                        onChangeProfile(p);
                        setIsProfileOpen(false);
                      }}
                      className={`w-full text-left px-2 py-1.5 rounded-[2px] flex items-center justify-between text-xs transition-colors ${
                        isActive
                          ? 'bg-omp-accent text-white font-semibold'
                          : 'text-zinc-300 hover:bg-omp-surfaceLight hover:text-white'
                      }`}
                    >
                      <span className="font-mono">{p}</span>
                      {isActive && <Rune name="indicators-check" size={12} className="text-white" />}
                    </button>
                  );
                })}
              </div>

              {/* Add Profile Section */}
              <div className="pt-1 border-t border-omp-border/60">
                {showAddProfile ? (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      const trimmed = newProfileInput.trim().toLowerCase();
                      if (trimmed && !profiles.includes(trimmed)) {
                        AppApi.SetProfile(trimmed).then(() => {
                          onChangeProfile(trimmed);
                          setProfiles([...profiles, trimmed]);
                          setNewProfileInput('');
                          setShowAddProfile(false);
                          setIsProfileOpen(false);
                        });
                      }
                    }}
                    className="space-y-1 p-1"
                  >
                    <input
                      type="text"
                      autoFocus
                      placeholder="profil-adi..."
                      value={newProfileInput}
                      onChange={(e) => setNewProfileInput(e.target.value)}
                      className="w-full bg-omp-bg border border-omp-border rounded-[2px] px-2 py-1 text-xs text-white font-mono focus:outline-none focus:border-omp-accent"
                    />
                    <div className="flex space-x-1 justify-end">
                      <button
                        type="button"
                        onClick={() => setShowAddProfile(false)}
                        className="px-2 py-0.5 text-[10px] rounded-[2px] text-omp-muted hover:text-white"
                      >
                        İptal
                      </button>
                      <button
                        type="submit"
                        className="px-2 py-0.5 text-[10px] rounded-[2px] bg-omp-accent text-white font-medium"
                      >
                        Oluştur
                      </button>
                    </div>
                  </form>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowAddProfile(true)}
                    className="w-full text-left px-2 py-1 text-[11px] text-zinc-400 hover:text-white flex items-center space-x-1.5 hover:bg-omp-surfaceLight rounded-[2px]"
                  >
                    <span>+ Yeni Profil Ekle</span>
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* RIGHT: Update notification & Swiss Toolbar */}
      <div className="flex items-center space-x-2">
        {/* Update Trigger */}
        <div className="relative">
          <button
            onClick={() => setShowUpdateModal(true)}
            className={`flex items-center space-x-1.5 text-xs px-2 py-1 rounded-[2px] border transition-colors font-mono ${
              updateStatus?.hasUpdate
                ? 'bg-omp-accent/15 border-omp-accent text-white font-semibold'
                : 'bg-omp-bg border-omp-border text-omp-muted hover:text-white'
            }`}
          >
            {updateStatus?.checking ? (
              <Rune name="schedule-refresh-cw" size={11} className="animate-spin text-omp-accent" />
            ) : updateStatus?.hasUpdate ? (
              <span className="w-1.5 h-1.5 bg-omp-accent rounded-full animate-ping" />
            ) : (
              <Rune name="indicators-check" size={11} className="text-omp-success" />
            )}
            <span className="text-[10px] uppercase tracking-wider">
              {updateStatus?.checking
                ? 'CHECK...'
                : updateStatus?.hasUpdate
                ? `UPD: ${updateStatus.latestVersion}`
                : 'UP-TO-DATE'}
            </span>
          </button>

          {/* Update Modal */}
          <div
            className={`fixed inset-0 z-50 flex items-center justify-center p-4 transition-all duration-200 ease-out ${
              showUpdateModal ? 'pointer-events-auto visible opacity-100' : 'pointer-events-none invisible opacity-0'
            }`}
          >
            <div
              onClick={() => setShowUpdateModal(false)}
              className={`absolute inset-0 bg-black/75 backdrop-blur-xs transition-opacity duration-200 ease-out ${
                showUpdateModal ? 'opacity-100' : 'opacity-0'
              }`}
            />
            <div
              onClick={(e) => e.stopPropagation()}
              className={`relative bg-omp-surface border border-omp-border rounded-[2px] w-full max-w-md p-5 shadow-2xl transition-all duration-200 ease-out transform ${
                showUpdateModal ? 'scale-100 opacity-100 translate-y-0' : 'scale-95 opacity-0 translate-y-2'
              }`}
            >
                <div className="flex items-center justify-between pb-3 border-b border-omp-border">
                  <div className="flex items-center space-x-2">
                    <Rune name="schedule-refresh-cw" size={16} className="text-omp-accent" />
                    <h3 className="font-bold text-white text-xs uppercase tracking-wider font-mono">
                      OH-MY-PI // UPDATE MANAGER
                    </h3>
                  </div>
                  <button
                    onClick={() => setShowUpdateModal(false)}
                    className="text-omp-muted hover:text-white text-xs px-2 py-1"
                  >
                    <Rune name="indicators-x" size={14} />
                  </button>
                </div>

                <div className="py-4 space-y-3 font-mono text-xs">
                  <div className="p-3 bg-omp-bg border border-omp-border rounded-[2px] space-y-1.5">
                    <div className="flex justify-between">
                      <span className="text-omp-muted">CURRENT:</span>
                      <span className="text-white font-bold">{updateStatus?.currentVersion || binaryVersion || '18.12.3'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-omp-muted">LATEST:</span>
                      <span className="text-omp-accent font-bold">{updateStatus?.latestVersion || 'Checking...'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-omp-muted">STATUS:</span>
                      <span className={updateStatus?.hasUpdate ? 'text-omp-accent font-bold' : 'text-omp-success'}>
                        {updateStatus?.hasUpdate ? 'NEW RELEASE AVAILABLE' : 'SYSTEM FULLY SYNCED'}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2 text-xs">
                    <label className="flex items-center space-x-2 cursor-pointer text-omp-text">
                      <input
                        type="checkbox"
                        checked={updatePlugins}
                        onChange={(e) => setUpdatePlugins(e.target.checked)}
                        className="rounded-[2px] bg-omp-bg border-omp-border"
                      />
                      <span>Eklentileri de güncelle (--plugins)</span>
                    </label>

                    <label className="flex items-center space-x-2 cursor-pointer text-omp-text">
                      <input
                        type="checkbox"
                        checked={useCanary}
                        onChange={(e) => setUseCanary(e.target.checked)}
                        className="rounded-[2px] bg-omp-bg border-omp-border"
                      />
                      <span>Canary kanalına geç (--canary)</span>
                    </label>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-omp-border">
                  <button
                    onClick={() => onCheckUpdates()}
                    disabled={updateStatus?.checking}
                    className="flex items-center space-x-1.5 px-3 py-1.5 rounded-[2px] bg-omp-bg hover:bg-omp-surfaceLight border border-omp-border text-xs text-white font-mono"
                  >
                    <Rune name="schedule-refresh-cw" size={12} className={updateStatus?.checking ? 'animate-spin' : ''} />
                    <span>ŞİMDİ DENETLE</span>
                  </button>

                  <div className="flex space-x-2">
                    <button
                      onClick={() => setShowUpdateModal(false)}
                      className="px-3 py-1.5 rounded-[2px] hover:bg-omp-surfaceLight text-xs text-omp-muted font-mono"
                    >
                      KAPAT
                    </button>
                    <button
                      onClick={() => {
                        onInstallUpdate(useCanary, updatePlugins);
                        setShowUpdateModal(false);
                      }}
                      className="px-3 py-1.5 rounded-[2px] bg-omp-accent hover:bg-omp-accentHover text-xs text-white font-bold font-mono tracking-wider"
                    >
                      GÜNCELLE
                    </button>
                  </div>
                </div>
            </div>
          </div>
        </div>

        {/* Theme Selector Popover */}
        <div className="relative" ref={themeRef}>
          <button
            type="button"
            onClick={() => setIsThemeOpen(!isThemeOpen)}
            className="flex items-center space-x-1.5 text-xs px-2 py-1 rounded-[2px] bg-omp-bg hover:bg-omp-surfaceLight border border-omp-border text-omp-muted hover:text-white transition font-mono"
            title="Arayüz Temasını Değiştir"
          >
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                theme === 'cyber-violet' || theme === 'pi-gradient'
                  ? 'bg-gradient-to-r from-[#E84AC3] to-[#6EADEE] ring-1 ring-pink-300'
                  : theme === 'swiss-dark'
                  ? 'bg-red-600 ring-1 ring-red-400'
                  : 'bg-zinc-200 border border-zinc-400 ring-1 ring-zinc-300'
              }`}
            />
            <span className="text-[10px] uppercase font-bold hidden sm:inline">
              {theme === 'cyber-violet' || theme === 'pi-gradient' ? 'GRADIENT' : theme === 'swiss-dark' ? 'SWISS' : 'LIGHT'}
            </span>
            <Rune name="chevron-down" size={10} />
          </button>

          {isThemeOpen && (
            <div className="absolute top-full right-0 mt-1 w-64 bg-omp-surfaceElevated border border-omp-border rounded-[2px] shadow-2xl z-50 p-1.5 space-y-1 animate-fadeIn text-xs font-mono">
              <div className="px-2 py-1 text-[10px] uppercase tracking-wider text-omp-muted border-b border-omp-border/60">
                TEMA SEÇİMİ // APPEARANCE
              </div>
              {THEMES.map((th) => {
                const isSelected = theme === th.id;
                return (
                  <button
                    key={th.id}
                    type="button"
                    onClick={() => {
                      if (onSelectTheme) onSelectTheme(th.id);
                      setIsThemeOpen(false);
                    }}
                    className={`w-full p-2 text-left rounded-[2px] border transition flex items-center justify-between ${
                      isSelected
                        ? 'border-omp-accent bg-omp-surfaceLight text-white font-bold'
                        : 'border-transparent hover:border-omp-border hover:bg-omp-bg text-omp-muted hover:text-white'
                    }`}
                  >
                    <div className="flex items-center space-x-2">
                      <span className={`w-3 h-3 rounded-full ${th.dot} shrink-0`} />
                      <div>
                        <div className="text-xs">{th.name}</div>
                        <div className="text-[10px] text-omp-muted font-sans font-normal">{th.desc}</div>
                      </div>
                    </div>
                    {isSelected && <Rune name="check" size={12} className="text-omp-accent shrink-0" />}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Swiss Grid Toolbar for Drawers */}
        <div className="flex items-center bg-omp-bg border border-omp-border rounded-[2px] divide-x divide-omp-border">
          <button
            onClick={() => onToggleDrawer('sessions')}
            title="Oturumlar (Sessions)"
            className={`px-2.5 py-1.5 transition-colors ${
              activeDrawer === 'sessions' ? 'bg-omp-surfaceLight text-white' : 'text-omp-muted hover:text-white'
            }`}
          >
            <Rune name="schedule-clock" size={14} />
          </button>

          <button
            onClick={() => onToggleDrawer('devtools')}
            title="Geliştirici Araçları (Git, Ps, Cleanse)"
            className={`px-2.5 py-1.5 transition-colors ${
              activeDrawer === 'devtools' ? 'bg-omp-surfaceLight text-white' : 'text-omp-muted hover:text-white'
            }`}
          >
            <Rune name="code-terminal" size={14} />
          </button>

          <button
            onClick={() => onToggleDrawer('skills')}
            title="Beceriler ve Özel Skill Yöneticisi"
            className={`px-2.5 py-1.5 transition-colors ${
              activeDrawer === 'skills' ? 'bg-omp-surfaceLight text-white' : 'text-omp-muted hover:text-white'
            }`}
          >
            <Rune name="tools-sparkles" size={14} className={activeDrawer === 'skills' ? 'text-omp-accent' : ''} />
          </button>

          <button
            onClick={() => onToggleDrawer('usage')}
            title="Sağlayıcı ve Kota Kullanımı (/usage)"
            className={`px-2.5 py-1.5 transition-colors ${
              activeDrawer === 'usage' ? 'bg-amber-400/10 text-amber-400' : 'text-omp-muted hover:text-amber-400'
            }`}
          >
            <Rune name="other-zap" size={14} />
          </button>

          <button
            onClick={() => onToggleDrawer('settings')}
            title="Yapılandırma & Ayarlar"
            className={`px-2.5 py-1.5 transition-colors ${
              activeDrawer === 'settings' ? 'bg-omp-surfaceLight text-white' : 'text-omp-muted hover:text-white'
            }`}
          >
            <Rune name="tools-settings" size={14} />
          </button>
        </div>
      </div>
    </header>
  );
};
