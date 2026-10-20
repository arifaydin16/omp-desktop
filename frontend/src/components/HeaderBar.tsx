import React, { useState } from 'react';
import { 
  Folder, 
  RefreshCw, 
  Download, 
  Settings, 
  History,
  Terminal,
  CheckCircle2, 
  AlertCircle,
  ExternalLink,
  Sparkles
} from 'lucide-react';
import { UpdateStatus } from '../types';
import * as AppApi from '../../wailsjs/go/main/App';

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
}

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
}) => {
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [useCanary, setUseCanary] = useState(false);
  const [updatePlugins, setUpdatePlugins] = useState(true);

  return (
    <header className="h-14 border-b border-omp-border bg-omp-surface px-4 flex items-center justify-between select-none">
      {/* Brand & Status */}
      <div className="flex items-center space-x-3">
        <div className="flex items-center space-x-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-omp-accent to-omp-purple flex items-center justify-center font-bold text-white shadow-sm">
            π
          </div>
          <span className="font-semibold text-white tracking-wide text-sm">
            oh-my-pi
          </span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-omp-surfaceLight border border-omp-border text-omp-muted font-mono">
            {binaryVersion || 'v18.12.3'}
          </span>
        </div>

        {/* Status indicator */}
        <div className="flex items-center space-x-1.5 text-xs text-omp-muted border-l border-omp-border pl-3">
          <span className={`w-2 h-2 rounded-full ${isWorking ? 'bg-omp-warning animate-pulse' : 'bg-omp-success'}`} />
          <span>{isWorking ? 'Çalışıyor...' : 'Hazır'}</span>
        </div>
      </div>

      {/* Center: Cwd & Profile */}
      <div className="flex items-center space-x-2 max-w-md">
        {/* Working Directory button */}
        <button
          onClick={onSelectCwd}
          title={cwd || 'Çalışma dizini seç'}
          className="flex items-center space-x-1.5 text-xs px-2.5 py-1.5 rounded-md bg-omp-surfaceLight hover:bg-omp-border border border-omp-border text-omp-text transition-colors truncate max-w-[260px]"
        >
          <Folder size={14} className="text-omp-accent shrink-0" />
          <span className="truncate">{cwd ? cwd.split('\\').pop() || cwd.split('/').pop() || cwd : 'Dizin Seç'}</span>
        </button>

        {/* Profile */}
        <div className="flex items-center space-x-1 bg-omp-surfaceLight border border-omp-border rounded-md px-2 py-1">
          <span className="text-[11px] text-omp-muted">Profil:</span>
          <input
            type="text"
            value={profile}
            onChange={(e) => onChangeProfile(e.target.value)}
            placeholder="default"
            className="w-16 bg-transparent text-xs text-white focus:outline-none placeholder-omp-muted"
          />
        </div>
      </div>

      {/* Right: Update notification & Drawer controls */}
      <div className="flex items-center space-x-2">
        {/* Auto-Update Badge & Trigger */}
        <div className="relative">
          <button
            onClick={() => setShowUpdateModal(true)}
            className={`flex items-center space-x-1.5 text-xs px-2.5 py-1 rounded-full border transition-colors ${
              updateStatus?.hasUpdate
                ? 'bg-omp-warning/10 border-omp-warning text-omp-warning font-medium hover:bg-omp-warning/20'
                : 'bg-omp-surfaceLight border-omp-border text-omp-muted hover:text-white'
            }`}
          >
            {updateStatus?.checking ? (
              <RefreshCw size={12} className="animate-spin text-omp-accent" />
            ) : updateStatus?.hasUpdate ? (
              <Download size={12} className="text-omp-warning animate-bounce" />
            ) : (
              <CheckCircle2 size={12} className="text-omp-success" />
            )}
            <span>
              {updateStatus?.checking
                ? 'Kontrol...'
                : updateStatus?.hasUpdate
                ? `Güncelleme: ${updateStatus.latestVersion}`
                : 'Güncel'}
            </span>
          </button>

          {/* Update Modal Popup */}
          {showUpdateModal && (
            <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-omp-surface border border-omp-border rounded-xl w-full max-w-md p-5 shadow-2xl">
                <div className="flex items-center justify-between pb-3 border-b border-omp-border">
                  <div className="flex items-center space-x-2">
                    <Download size={18} className="text-omp-accent" />
                    <h3 className="font-medium text-white text-sm">oh-my-pi Güncelleme Yöneticisi</h3>
                  </div>
                  <button
                    onClick={() => setShowUpdateModal(false)}
                    className="text-omp-muted hover:text-white text-xs px-2 py-1"
                  >
                    ✕
                  </button>
                </div>

                <div className="py-4 space-y-3">
                  <div className="p-3 bg-omp-bg border border-omp-border rounded-lg text-xs space-y-1.5">
                    <div className="flex justify-between">
                      <span className="text-omp-muted">Mevcut Sürüm:</span>
                      <span className="font-mono text-white">{updateStatus?.currentVersion || binaryVersion || '18.12.3'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-omp-muted">En Son Sürüm:</span>
                      <span className="font-mono text-omp-accent">{updateStatus?.latestVersion || 'Kontrol ediliyor...'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-omp-muted">Durum:</span>
                      <span className={updateStatus?.hasUpdate ? 'text-omp-warning' : 'text-omp-success'}>
                        {updateStatus?.hasUpdate ? 'Yeni sürüm mevcut!' : 'En güncel sürüm yüklü.'}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2 text-xs">
                    <label className="flex items-center space-x-2 cursor-pointer text-omp-text">
                      <input
                        type="checkbox"
                        checked={updatePlugins}
                        onChange={(e) => setUpdatePlugins(e.target.checked)}
                        className="rounded bg-omp-surfaceLight border-omp-border"
                      />
                      <span>Eklentileri de güncelle (--plugins)</span>
                    </label>

                    <label className="flex items-center space-x-2 cursor-pointer text-omp-text">
                      <input
                        type="checkbox"
                        checked={useCanary}
                        onChange={(e) => setUseCanary(e.target.checked)}
                        className="rounded bg-omp-surfaceLight border-omp-border"
                      />
                      <span>Canary kanalına geç (--canary)</span>
                    </label>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-omp-border">
                  <button
                    onClick={() => onCheckUpdates()}
                    disabled={updateStatus?.checking}
                    className="flex items-center space-x-1.5 px-3 py-1.5 rounded-md bg-omp-surfaceLight hover:bg-omp-border text-xs text-white"
                  >
                    <RefreshCw size={12} className={updateStatus?.checking ? 'animate-spin' : ''} />
                    <span>Şimdi Denetle</span>
                  </button>

                  <div className="flex space-x-2">
                    <button
                      onClick={() => setShowUpdateModal(false)}
                      className="px-3 py-1.5 rounded-md hover:bg-omp-surfaceLight text-xs text-omp-muted"
                    >
                      Kapat
                    </button>
                    <button
                      onClick={() => {
                        onInstallUpdate(useCanary, updatePlugins);
                        setShowUpdateModal(false);
                      }}
                      className="px-3 py-1.5 rounded-md bg-omp-accent hover:bg-omp-accentHover text-xs text-white font-medium shadow"
                    >
                      Güncellemeyi Kur
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Drawer Toggles */}
        <div className="flex items-center bg-omp-surfaceLight border border-omp-border rounded-lg p-0.5 space-x-0.5">
          <button
            onClick={() => onToggleDrawer('sessions')}
            title="Oturumlar"
            className={`p-1.5 rounded-md transition-colors ${
              activeDrawer === 'sessions' ? 'bg-omp-border text-white' : 'text-omp-muted hover:text-white'
            }`}
          >
            <History size={16} />
          </button>
          <button
            onClick={() => onToggleDrawer('devtools')}
            title="Geliştirici Araçları (Git, Ps, Cleanse, Skills)"
            className={`p-1.5 rounded-md transition-colors ${
              activeDrawer === 'devtools' ? 'bg-omp-border text-white' : 'text-omp-muted hover:text-white'
            }`}
          >
            <Terminal size={16} />
          </button>
          {/* Skills Hub Button */}
          <button
            onClick={() => onToggleDrawer('skills')}
            title="Beceriler ve Özel Skill Yöneticisi (Skills)"
            className={`p-1.5 rounded-md transition-colors ${
              activeDrawer === 'skills' ? 'bg-omp-border text-white' : 'text-omp-muted hover:text-white'
            }`}
          >
            <Sparkles size={16} className={activeDrawer === 'skills' ? 'text-omp-accent' : ''} />
          </button>

          <button
            onClick={() => onToggleDrawer('settings')}
            title="Yapılandırma & Ayarlar"
            className={`p-1.5 rounded-md transition-colors ${
              activeDrawer === 'settings' ? 'bg-omp-border text-white' : 'text-omp-muted hover:text-white'
            }`}
          >
            <Settings size={16} />
          </button>
        </div>
      </div>
    </header>
  );
};
