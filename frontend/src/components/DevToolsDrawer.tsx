import React, { useState } from 'react';
import { 
  Terminal, 
  GitCommit, 
  GitBranch, 
  Activity, 
  Sparkles, 
  Wrench, 
  Search, 
  Download, 
  Calculator, 
  X, 
  RefreshCw,
  Play
} from 'lucide-react';
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
      setOutput(res || 'Çalışan daemon süreci yok.');
    } catch (err: unknown) {
      setOutput('Süreç hatası: ' + String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleRunCleanse = async () => {
    setLoading(true);
    setStatusText('omp cleanse çalıştırılıyor (proje tanılaması)...');
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

  const handleInstallSkill = async (name: string) => {
    setLoading(true);
    setStatusText(`'${name}' becerisi kuruluyor...`);
    try {
      await AppApi.InstallSkill(name);
      setOutput(`'${name}' becerisi başarıyla kuruldu.`);
    } catch (err: unknown) {
      setOutput('Kurulum hatası: ' + String(err));
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
    <div className="fixed inset-y-0 right-0 z-40 w-[540px] bg-omp-surface border-l border-omp-border shadow-2xl flex flex-col">
      {/* Header */}
      <div className="h-14 border-b border-omp-border px-5 flex items-center justify-between select-none">
        <div className="flex items-center space-x-2">
          <Terminal size={18} className="text-omp-accent" />
          <h3 className="font-semibold text-white text-sm">Geliştirici Araç Kiti (DevTools)</h3>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-md hover:bg-omp-surfaceLight text-omp-muted hover:text-white"
          title="Kapat"
        >
          <X size={18} />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-omp-border bg-omp-bg px-2 select-none overflow-x-auto text-xs">
        <button
          onClick={() => {
            setActiveTab('git');
            setOutput('');
          }}
          className={`py-2.5 px-3 font-medium border-b-2 transition whitespace-nowrap flex items-center space-x-1.5 ${
            activeTab === 'git'
              ? 'border-omp-accent text-white'
              : 'border-transparent text-omp-muted hover:text-white'
          }`}
        >
          <GitBranch size={13} />
          <span>Git & Commit</span>
        </button>

        <button
          onClick={() => {
            setActiveTab('processes');
            handleLoadProcesses();
          }}
          className={`py-2.5 px-3 font-medium border-b-2 transition whitespace-nowrap flex items-center space-x-1.5 ${
            activeTab === 'processes'
              ? 'border-omp-accent text-white'
              : 'border-transparent text-omp-muted hover:text-white'
          }`}
        >
          <Activity size={13} />
          <span>Süreçler (ps)</span>
        </button>

        <button
          onClick={() => {
            setActiveTab('cleanse');
            setOutput('');
          }}
          className={`py-2.5 px-3 font-medium border-b-2 transition whitespace-nowrap flex items-center space-x-1.5 ${
            activeTab === 'cleanse'
              ? 'border-omp-accent text-white'
              : 'border-transparent text-omp-muted hover:text-white'
          }`}
        >
          <Wrench size={13} />
          <span>Cleanse Onarım</span>
        </button>

        <button
          onClick={() => {
            setActiveTab('skills');
            setOutput('');
          }}
          className={`py-2.5 px-3 font-medium border-b-2 transition whitespace-nowrap flex items-center space-x-1.5 ${
            activeTab === 'skills'
              ? 'border-omp-accent text-white'
              : 'border-transparent text-omp-muted hover:text-white'
          }`}
        >
          <Sparkles size={13} />
          <span>Beceriler & Eklentiler</span>
        </button>

        <button
          onClick={() => {
            setActiveTab('tokens');
            setOutput('');
          }}
          className={`py-2.5 px-3 font-medium border-b-2 transition whitespace-nowrap flex items-center space-x-1.5 ${
            activeTab === 'tokens'
              ? 'border-omp-accent text-white'
              : 'border-transparent text-omp-muted hover:text-white'
          }`}
        >
          <Calculator size={13} />
          <span>Token Sayacı</span>
        </button>
      </div>

      {/* Main Content Body */}
      <div className="flex-1 flex flex-col p-4 space-y-4 overflow-hidden">
        {/* Tab Controls */}
        {activeTab === 'git' && (
          <div className="flex items-center space-x-2">
            <button
              onClick={handleRunGitStatus}
              disabled={loading}
              className="flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-omp-surfaceLight hover:bg-omp-border text-xs text-white"
            >
              <GitBranch size={13} />
              <span>Durum (Status)</span>
            </button>
            <button
              onClick={handleRunGitDiff}
              disabled={loading}
              className="flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-omp-surfaceLight hover:bg-omp-border text-xs text-white"
            >
              <RefreshCw size={13} />
              <span>Farklar (Diff)</span>
            </button>
            <button
              onClick={handleRunCommit}
              disabled={loading}
              className="flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-omp-accent hover:bg-omp-accentHover text-xs text-white font-medium shadow"
            >
              <GitCommit size={13} />
              <span>Yapay Zeka Commit Mesajı (omp commit)</span>
            </button>
          </div>
        )}

        {activeTab === 'processes' && (
          <div className="flex items-center justify-between">
            <span className="text-xs text-omp-muted">Arka planda çalışan omp daemonları</span>
            <button
              onClick={handleLoadProcesses}
              disabled={loading}
              className="flex items-center space-x-1 px-2.5 py-1 rounded bg-omp-surfaceLight hover:bg-omp-border text-xs text-white"
            >
              <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
              <span>Yenile</span>
            </button>
          </div>
        )}

        {activeTab === 'cleanse' && (
          <div className="p-3 bg-omp-bg border border-omp-border rounded-xl space-y-2 text-xs">
            <p className="text-omp-text">
              <strong className="text-white">omp cleanse</strong>: Projedeki derleme, tip ve linter hatalarını ağırlıklı paralel subagentlar ile otomatik tespit edip onarır.
            </p>
            <button
              onClick={handleRunCleanse}
              disabled={loading}
              className="flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-omp-accent hover:bg-omp-accentHover text-xs text-white font-medium"
            >
              <Play size={12} fill="currentColor" />
              <span>Cleanse Onarımını Başlat</span>
            </button>
          </div>
        )}

        {activeTab === 'skills' && (
          <div className="space-y-3">
            <div className="flex space-x-2">
              <div className="relative flex-1">
                <Search size={14} className="absolute left-3 top-2.5 text-omp-muted" />
                <input
                  type="text"
                  value={skillQuery}
                  onChange={(e) => setSkillQuery(e.target.value)}
                  placeholder="skills.omp.sh üzerinden beceri ara (örn: git, docker)..."
                  className="w-full bg-omp-bg border border-omp-border rounded-lg pl-9 pr-3 py-1.5 text-xs text-white placeholder-omp-muted focus:outline-none focus:border-omp-accent"
                />
              </div>
              <button
                onClick={handleSearchSkills}
                disabled={loading || !skillQuery.trim()}
                className="px-3 py-1.5 rounded-lg bg-omp-accent hover:bg-omp-accentHover text-xs text-white font-medium"
              >
                Ara
              </button>
            </div>
          </div>
        )}

        {activeTab === 'tokens' && (
          <div className="space-y-2">
            <textarea
              value={tokenInput}
              onChange={(e) => setTokenInput(e.target.value)}
              placeholder="Token sayısını hesaplamak istediğiniz metni veya kodu buraya yapıştırın..."
              rows={3}
              className="w-full bg-omp-bg border border-omp-border rounded-lg p-2.5 text-xs text-white placeholder-omp-muted focus:outline-none focus:border-omp-accent resize-none font-mono"
            />
            <div className="flex justify-end">
              <button
                onClick={handleCountTokens}
                disabled={loading || !tokenInput.trim()}
                className="flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-omp-accent hover:bg-omp-accentHover text-xs text-white font-medium"
              >
                <Calculator size={13} />
                <span>Tokenları Say (omp toks)</span>
              </button>
            </div>
          </div>
        )}

        {/* Status notice */}
        {loading && (
          <div className="flex items-center space-x-2 text-xs text-omp-accent animate-pulse">
            <RefreshCw size={13} className="animate-spin" />
            <span>{statusText || 'İşleniyor...'}</span>
          </div>
        )}

        {/* Output Console View */}
        <div className="flex-1 flex flex-col bg-omp-bg border border-omp-border rounded-xl overflow-hidden">
          <div className="h-8 bg-omp-surface border-b border-omp-border px-3 flex items-center justify-between text-[11px] text-omp-muted font-mono select-none">
            <span>Çıktı Konsolu</span>
            {output && (
              <button
                onClick={() => setOutput('')}
                className="hover:text-white"
              >
                Temizle
              </button>
            )}
          </div>
          <pre className="flex-1 p-3 font-mono text-xs text-omp-text overflow-y-auto whitespace-pre-wrap leading-relaxed select-text">
            {output || 'Komut çalıştırmak için yukarıdaki butonları kullanın.'}
          </pre>
        </div>
      </div>
    </div>
  );
};
