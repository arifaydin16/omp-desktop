import React, { useState } from 'react';
import { Rune } from './Rune';
import * as AppApi from '../../wailsjs/go/main/App';

interface DevToolsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  cwd: string;
}

export const DevToolsDrawer: React.FC<DevToolsDrawerProps> = ({
  isOpen,
  onClose,
  cwd,
}) => {
  const [activeTab, setActiveTab] = useState<'git' | 'processes' | 'cleanse' | 'skills' | 'tokens'>('git');
  const [loading, setLoading] = useState(false);
  const [output, setOutput] = useState('');
  const [statusText, setStatusText] = useState('');

  // Skills search
  const [skillQuery, setSkillQuery] = useState('');
  const [tokenInput, setTokenInput] = useState('');

  if (!isOpen) return null;

  const handleRunGitStatus = async () => {
    setLoading(true);
    setStatusText('Git durumu alınıyor...');
    try {
      const res = await AppApi.RunGitStatus(cwd);
      setOutput(res || 'Temiz çalışma ağacı (değişiklik yok).');
    } catch (err: unknown) {
      setOutput('Git status hatası: ' + String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleRunGitDiff = async () => {
    setLoading(true);
    setStatusText('Git diff alınıyor...');
    try {
      const res = await AppApi.RunGitDiff(cwd);
      setOutput(res || 'Farklılık bulunamadı.');
    } catch (err: unknown) {
      setOutput('Git diff hatası: ' + String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleRunCommit = async () => {
    setLoading(true);
    setStatusText('oh-my-pi akıllı commit mesajı üretiyor...');
    try {
      const res = await AppApi.RunCommit(cwd);
      setOutput(res || 'Commit mesajı oluşturuldu.');
    } catch (err: unknown) {
      setOutput('Commit hatası: ' + String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleLoadProcesses = async () => {
    setLoading(true);
    setStatusText('Arka plan süreçleri taranıyor...');
    try {
      const res = await AppApi.GetProcesses();
      setOutput(res || 'Aktif çalışan omp daemon süreci bulunmuyor.');
    } catch (err: unknown) {
      setOutput('Süreç listesi hatası: ' + String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleRunCleanse = async () => {
    setLoading(true);
    setStatusText('omp cleanse başlatılıyor...');
    try {
      const res = await AppApi.RunCleanse(cwd);
      setOutput(res || 'Cleanse tamamlandı.');
    } catch (err: unknown) {
      setOutput('Cleanse hatası: ' + String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSkills = async () => {
    if (!skillQuery.trim()) return;
    setLoading(true);
    setStatusText(`'${skillQuery}' becerileri aranıyor...`);
    try {
      const res = await AppApi.SearchSkills(skillQuery);
      setOutput(res || 'Sonuç bulunamadı.');
    } catch (err: unknown) {
      setOutput('Beceri arama hatası: ' + String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleCountTokens = async () => {
    if (!tokenInput.trim()) return;
    setLoading(true);
    setStatusText('Tokenlar çevrimdışı tokenizerlar ile hesaplanıyor...');
    try {
      const res = await AppApi.CountTokens(tokenInput);
      setOutput(res);
    } catch (err: unknown) {
      setOutput('Token sayma hatası: ' + String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-y-0 right-0 z-40 w-[540px] bg-omp-surface border-l border-omp-border shadow-2xl flex flex-col font-mono text-xs">
      {/* Header */}
      <div className="h-12 border-b border-omp-border px-4 flex items-center justify-between select-none bg-omp-surface">
        <div className="flex items-center space-x-2">
          <Rune name="code-terminal" size={15} className="text-omp-accent" />
          <h3 className="font-bold text-white text-xs uppercase tracking-wider">
            02 // DEVTOOLS & SYSTEM RUNTIME
          </h3>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-[2px] hover:bg-omp-bg text-omp-muted hover:text-white transition"
          title="Kapat"
        >
          <Rune name="indicators-x" size={14} />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-omp-border bg-omp-bg px-2 select-none overflow-x-auto text-xs divide-x divide-omp-border/60">
        <button
          onClick={() => {
            setActiveTab('git');
            setOutput('');
          }}
          className={`py-2 px-3 font-mono text-[11px] uppercase tracking-wider transition whitespace-nowrap flex items-center space-x-1.5 ${
            activeTab === 'git'
              ? 'bg-omp-surface text-white font-bold border-b-2 border-b-omp-accent'
              : 'text-omp-muted hover:text-white'
          }`}
        >
          <Rune name="code-git-branch" size={12} className={activeTab === 'git' ? 'text-omp-accent' : ''} />
          <span>GIT & COMMIT</span>
        </button>

        <button
          onClick={() => {
            setActiveTab('processes');
            handleLoadProcesses();
          }}
          className={`py-2 px-3 font-mono text-[11px] uppercase tracking-wider transition whitespace-nowrap flex items-center space-x-1.5 ${
            activeTab === 'processes'
              ? 'bg-omp-surface text-white font-bold border-b-2 border-b-omp-accent'
              : 'text-omp-muted hover:text-white'
          }`}
        >
          <Rune name="code-server" size={12} className={activeTab === 'processes' ? 'text-omp-accent' : ''} />
          <span>PROCESSES</span>
        </button>

        <button
          onClick={() => {
            setActiveTab('cleanse');
            setOutput('');
          }}
          className={`py-2 px-3 font-mono text-[11px] uppercase tracking-wider transition whitespace-nowrap flex items-center space-x-1.5 ${
            activeTab === 'cleanse'
              ? 'bg-omp-surface text-white font-bold border-b-2 border-b-omp-accent'
              : 'text-omp-muted hover:text-white'
          }`}
        >
          <Rune name="tools-settings" size={12} className={activeTab === 'cleanse' ? 'text-omp-accent' : ''} />
          <span>CLEANSE</span>
        </button>

        <button
          onClick={() => {
            setActiveTab('skills');
            setOutput('');
          }}
          className={`py-2 px-3 font-mono text-[11px] uppercase tracking-wider transition whitespace-nowrap flex items-center space-x-1.5 ${
            activeTab === 'skills'
              ? 'bg-omp-surface text-white font-bold border-b-2 border-b-omp-accent'
              : 'text-omp-muted hover:text-white'
          }`}
        >
          <Rune name="tools-sparkles" size={12} className={activeTab === 'skills' ? 'text-omp-accent' : ''} />
          <span>SKILLS</span>
        </button>

        <button
          onClick={() => {
            setActiveTab('tokens');
            setOutput('');
          }}
          className={`py-2 px-3 font-mono text-[11px] uppercase tracking-wider transition whitespace-nowrap flex items-center space-x-1.5 ${
            activeTab === 'tokens'
              ? 'bg-omp-surface text-white font-bold border-b-2 border-b-omp-accent'
              : 'text-omp-muted hover:text-white'
          }`}
        >
          <Rune name="other-zap" size={12} className={activeTab === 'tokens' ? 'text-omp-accent' : ''} />
          <span>TOKENS</span>
        </button>
      </div>

      {/* Main Content Body */}
      <div className="flex-1 flex flex-col p-4 space-y-4 overflow-hidden bg-omp-surface">
        {/* Tab Controls */}
        {activeTab === 'git' && (
          <div className="flex items-center space-x-2">
            <button
              onClick={handleRunGitStatus}
              disabled={loading}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-[2px] bg-omp-bg hover:bg-omp-surfaceLight border border-omp-border text-xs text-white uppercase tracking-wider font-bold transition"
            >
              <Rune name="code-git-branch" size={13} />
              <span>STATUS</span>
            </button>
            <button
              onClick={handleRunGitDiff}
              disabled={loading}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-[2px] bg-omp-bg hover:bg-omp-surfaceLight border border-omp-border text-xs text-white uppercase tracking-wider font-bold transition"
            >
              <Rune name="schedule-refresh-cw" size={13} />
              <span>DIFF</span>
            </button>
            <button
              onClick={handleRunCommit}
              disabled={loading}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-[2px] bg-omp-accent hover:bg-omp-accentHover text-xs text-white font-bold uppercase tracking-wider transition"
            >
              <Rune name="code-git-commit-horizontal" size={13} />
              <span>OMP COMMIT</span>
            </button>
          </div>
        )}

        {activeTab === 'processes' && (
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-omp-muted uppercase tracking-wider">OMP BACKGROUND DAEMONS</span>
            <button
              onClick={handleLoadProcesses}
              disabled={loading}
              className="flex items-center space-x-1.5 px-3 py-1 rounded-[2px] bg-omp-bg hover:bg-omp-surfaceLight border border-omp-border text-xs text-white uppercase tracking-wider"
            >
              <Rune name="schedule-refresh-cw" size={12} className={loading ? 'animate-spin' : ''} />
              <span>YENİLE</span>
            </button>
          </div>
        )}

        {activeTab === 'cleanse' && (
          <div className="p-3 bg-omp-bg border border-omp-border rounded-[2px] space-y-2 text-xs">
            <p className="text-zinc-300 font-sans">
              <strong className="text-white font-mono">omp cleanse</strong>: Projedeki derleme, tip ve linter hatalarını paralel subagentlar ile otomatik tespit edip onarır.
            </p>
            <button
              onClick={handleRunCleanse}
              disabled={loading}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-[2px] bg-omp-accent hover:bg-omp-accentHover text-xs text-white font-bold uppercase tracking-wider"
            >
              <Rune name="playback-play" size={12} />
              <span>CLEANSE BAŞLAT</span>
            </button>
          </div>
        )}

        {activeTab === 'skills' && (
          <div className="space-y-3">
            <div className="flex space-x-2">
              <div className="relative flex-1">
                <Rune name="tools-search" size={13} className="absolute left-2.5 top-2.5 text-omp-muted" />
                <input
                  type="text"
                  value={skillQuery}
                  onChange={(e) => setSkillQuery(e.target.value)}
                  placeholder="skills.omp.sh üzerinden beceri ara..."
                  className="w-full bg-omp-bg border border-omp-border rounded-[2px] pl-8 pr-3 py-1.5 text-xs text-white placeholder-omp-muted focus:outline-none focus:border-omp-accent font-mono"
                />
              </div>
              <button
                onClick={handleSearchSkills}
                disabled={loading || !skillQuery.trim()}
                className="px-4 py-1.5 rounded-[2px] bg-omp-accent hover:bg-omp-accentHover text-xs text-white font-bold uppercase tracking-wider"
              >
                ARA
              </button>
            </div>
          </div>
        )}

        {activeTab === 'tokens' && (
          <div className="space-y-2">
            <textarea
              value={tokenInput}
              onChange={(e) => setTokenInput(e.target.value)}
              placeholder="Token sayısını hesaplamak istediğiniz metni buraya yapıştırın..."
              rows={3}
              className="w-full bg-omp-bg border border-omp-border rounded-[2px] p-2.5 text-xs text-white placeholder-omp-muted focus:outline-none focus:border-omp-accent resize-none font-mono"
            />
            <div className="flex justify-end">
              <button
                onClick={handleCountTokens}
                disabled={loading || !tokenInput.trim()}
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-[2px] bg-omp-accent hover:bg-omp-accentHover text-xs text-white font-bold uppercase tracking-wider"
              >
                <Rune name="other-zap" size={13} />
                <span>HESAPLA (OMP TOKS)</span>
              </button>
            </div>
          </div>
        )}

        {/* Status notice */}
        {loading && (
          <div className="flex items-center space-x-2 text-xs text-omp-accent animate-pulse font-mono">
            <Rune name="schedule-refresh-cw" size={13} className="animate-spin" />
            <span>{statusText || 'İşleniyor...'}</span>
          </div>
        )}

        {/* Output Console View */}
        <div className="flex-1 flex flex-col bg-omp-bg border border-omp-border rounded-[2px] overflow-hidden">
          <div className="h-8 bg-omp-surface border-b border-omp-border px-3 flex items-center justify-between text-[10px] text-omp-muted font-mono select-none uppercase tracking-wider">
            <span>TERMINAL OUTPUT // LOG</span>
            {output && (
              <button
                onClick={() => setOutput('')}
                className="hover:text-white"
              >
                TEMİZLE
              </button>
            )}
          </div>
          <pre className="flex-1 p-3 font-mono text-xs text-zinc-200 overflow-y-auto whitespace-pre-wrap leading-relaxed select-text">
            {output || 'Komut çalıştırmak için yukarıdaki butonları kullanın.'}
          </pre>
        </div>
      </div>
    </div>
  );
};
