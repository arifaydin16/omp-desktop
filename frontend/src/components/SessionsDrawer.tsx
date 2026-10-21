import React, { useState, useEffect } from 'react';
import { Rune } from './Rune';
import { SessionSummary, SessionDetail } from '../types';
import * as AppApi from '../../wailsjs/go/main/App';

interface SessionsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onResumeSession: (session: SessionSummary) => void;
}

export const SessionsDrawer: React.FC<SessionsDrawerProps> = ({
  isOpen,
  onClose,
  onResumeSession,
}) => {
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedSession, setSelectedSession] = useState<SessionDetail | null>(null);
  const [statusMsg, setStatusMsg] = useState('');

  const loadSessions = async () => {
    setLoading(true);
    try {
      const list = await AppApi.GetSessions(50);
      setSessions(list || []);
    } catch (err: unknown) {
      console.error('Failed to load sessions:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadSessions();
    }
  }, [isOpen]);

  const handleExportHTML = async (path: string) => {
    try {
      const out = await AppApi.ExportSessionHTML(path);
      setStatusMsg('Oturum başarıyla HTML olarak dışa aktarıldı: ' + out);
    } catch (err: unknown) {
      setStatusMsg('Dışa aktarma hatası: ' + String(err));
    }
  };

  const handleViewDetail = async (path: string) => {
    try {
      const detail = await AppApi.GetSessionDetail(path);
      setSelectedSession(detail);
    } catch (err: unknown) {
      console.error('Failed to load session detail:', err);
    }
  };
  const filteredSessions = sessions.filter(
    (s) =>
      s.title?.toLowerCase().includes(search.toLowerCase()) ||
      s.project?.toLowerCase().includes(search.toLowerCase()) ||
      s.id?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div
      className={`fixed inset-0 z-50 transition-all duration-300 ease-out ${
        isOpen ? 'pointer-events-auto visible opacity-100' : 'pointer-events-none invisible opacity-0 delay-200'
      }`}
    >
      {/* Backdrop */}
      <div
        onClick={onClose}
        className={`absolute inset-0 bg-black/60 backdrop-blur-xs transition-opacity duration-300 ease-out ${
          isOpen ? 'opacity-100' : 'opacity-0'
        }`}
      />

      {/* Sliding Drawer Panel */}
      <div
        onClick={(e) => e.stopPropagation()}
        className={`absolute inset-y-0 right-0 w-[480px] max-w-full bg-omp-surface border-l border-omp-border shadow-2xl flex flex-col font-mono text-xs transition-transform duration-300 cubic-bezier(0.16, 1, 0.3, 1) ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
      <div className="h-12 border-b border-omp-border px-4 flex items-center justify-between select-none bg-omp-surface">
        <div className="flex items-center space-x-2">
          <Rune name="schedule-clock" size={15} className="text-omp-accent" />
          <h3 className="font-bold text-white text-xs uppercase tracking-wider">
            01 // SESSIONS & HISTORY
          </h3>
          <span className="text-[10px] px-1.5 py-0.5 rounded-[2px] bg-omp-bg border border-omp-border text-omp-muted tabular-nums">
            {sessions.length}
          </span>
        </div>
        <div className="flex items-center space-x-1">
          <button
            onClick={loadSessions}
            className="p-1 rounded-[2px] hover:bg-omp-bg text-omp-muted hover:text-white transition"
            title="Yenile"
          >
            <Rune name="schedule-refresh-cw" size={13} className={loading ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={onClose}
            className="p-1 rounded-[2px] hover:bg-omp-bg text-omp-muted hover:text-white transition"
            title="Kapat"
          >
            <Rune name="indicators-x" size={14} />
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="p-3 border-b border-omp-border bg-omp-bg">
        <div className="relative">
          <Rune name="tools-search" size={13} className="absolute left-2.5 top-2.5 text-omp-muted" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Oturum veya proje filtrele..."
            className="w-full bg-omp-surface border border-omp-border rounded-[2px] pl-8 pr-3 py-1.5 text-xs text-white placeholder-omp-muted focus:outline-none focus:border-omp-accent font-mono"
          />
        </div>
      </div>

      {statusMsg && (
        <div className="px-3 py-2 bg-omp-accent/15 border-b border-omp-accent/30 text-xs text-white flex justify-between items-center font-mono">
          <span className="truncate">{statusMsg}</span>
          <button onClick={() => setStatusMsg('')} className="ml-2 font-bold hover:text-white">✕</button>
        </div>
      )}

      {/* Session Details Modal / Split view */}
      {selectedSession ? (
        <div className="flex-1 flex flex-col overflow-hidden bg-omp-bg">
          <div className="p-4 border-b border-omp-border bg-omp-surface flex justify-between items-start">
            <div>
              <h4 className="font-bold text-white text-xs uppercase tracking-wider">{selectedSession.summary.title}</h4>
              <p className="text-[10px] text-omp-muted mt-0.5 font-mono">{selectedSession.summary.id}</p>
            </div>
            <button
              onClick={() => setSelectedSession(null)}
              className="text-[11px] font-mono text-zinc-300 hover:text-white px-2 py-1 bg-omp-bg border border-omp-border rounded-[2px]"
            >
              ← LİSTEYE DÖN
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3 text-xs">
            {selectedSession.messages.map((m, idx) => {
              const role = typeof m.role === 'string' ? m.role : m.type;
              return (
                <div key={idx} className="p-3 rounded-[2px] bg-omp-surface border border-omp-border space-y-1">
                  <div className="flex justify-between text-[10px] text-omp-muted font-mono uppercase">
                    <span className="font-bold text-omp-accent">{String(role)}</span>
                    <span className="tabular-nums">{m.timestamp ? new Date(String(m.timestamp)).toLocaleTimeString() : ''}</span>
                  </div>
                  <div className="text-zinc-200 whitespace-pre-wrap font-sans text-xs leading-relaxed">
                    {typeof m.text === 'string' ? m.text : JSON.stringify(m.message || m, null, 2)}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="p-3 border-t border-omp-border bg-omp-surface flex justify-end space-x-2">
            <button
              onClick={() => handleExportHTML(selectedSession.summary.path)}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-[2px] bg-omp-bg hover:bg-omp-surfaceLight border border-omp-border text-xs text-white font-mono uppercase tracking-wider"
            >
              <Rune name="documents-file-text" size={13} />
              <span>HTML AKTAR</span>
            </button>
            <button
              onClick={() => {
                onResumeSession(selectedSession.summary);
                onClose();
              }}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-[2px] bg-omp-accent hover:bg-omp-accentHover text-xs text-white font-bold font-mono uppercase tracking-wider shadow-sm"
            >
              <Rune name="playback-play" size={12} />
              <span>DEVAM ET</span>
            </button>
          </div>
        </div>
      ) : (
        /* Sessions List */
        <div className="flex-1 overflow-y-auto divide-y divide-omp-border bg-omp-surface">
          {filteredSessions.length === 0 ? (
            <div className="p-8 text-center text-xs text-omp-muted font-mono">
              {loading ? 'OTURUMLAR YÜKLENİYOR...' : 'KAYITLI OTURUM BULUNAMADI.'}
            </div>
          ) : (
            filteredSessions.map((s) => (
              <div
                key={s.id}
                className="p-3.5 hover:bg-omp-surfaceLight transition-colors space-y-2 group"
              >
                <div className="flex items-start justify-between">
                  <button
                    onClick={() => handleViewDetail(s.path)}
                    className="text-left font-bold text-white text-xs hover:text-omp-accent transition line-clamp-1 uppercase tracking-tight"
                  >
                    {s.title}
                  </button>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-[2px] bg-omp-bg border border-omp-border text-omp-muted font-mono">
                    {s.model || 'gemini-3.8-flash'}
                  </span>
                </div>

                <div className="flex items-center space-x-3 text-[11px] text-omp-muted font-mono">
                  <div className="flex items-center space-x-1">
                    <Rune name="layouts-layers-2" size={12} />
                    <span className="truncate max-w-[120px]">{s.project}</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <Rune name="messaging-message-square" size={12} />
                    <span className="tabular-nums">{s.msgCount} msj</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <Rune name="schedule-clock" size={12} />
                    <span className="tabular-nums">{new Date(s.updatedAt).toLocaleDateString()}</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-end space-x-2 pt-1">
                  <button
                    onClick={() => handleExportHTML(s.path)}
                    title="HTML Dışa Aktar"
                    className="p-1 px-2 rounded-[2px] bg-omp-bg border border-omp-border hover:bg-omp-surfaceLight text-omp-muted hover:text-white text-[11px] flex items-center space-x-1 font-mono"
                  >
                    <Rune name="documents-file-text" size={12} />
                    <span>HTML</span>
                  </button>
                  <button
                    onClick={() => {
                      onResumeSession(s);
                      onClose();
                    }}
                    title="Bu oturumu yükle ve devam et"
                    className="flex items-center space-x-1 px-3 py-1 rounded-[2px] bg-omp-accent hover:bg-omp-accentHover text-white transition text-xs font-bold font-mono uppercase tracking-wider"
                  >
                    <Rune name="playback-play" size={11} />
                    <span>DEVAM</span>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}
      </div>
    </div>
  );
};
