import React, { useState, useEffect } from 'react';
import { 
  History, 
  Search, 
  Play, 
  Download, 
  Archive, 
  Calendar, 
  MessageSquare, 
  Layers, 
  X,
  RefreshCw
} from 'lucide-react';
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

  if (!isOpen) return null;

  const filteredSessions = sessions.filter(
    (s) =>
      s.title?.toLowerCase().includes(search.toLowerCase()) ||
      s.project?.toLowerCase().includes(search.toLowerCase()) ||
      s.id?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="fixed inset-y-0 right-0 z-40 w-[480px] bg-omp-surface border-l border-omp-border shadow-2xl flex flex-col">
      {/* Drawer Header */}
      <div className="h-14 border-b border-omp-border px-5 flex items-center justify-between select-none">
        <div className="flex items-center space-x-2">
          <History size={18} className="text-omp-accent" />
          <h3 className="font-semibold text-white text-sm">Kayıtlı Oturumlar</h3>
          <span className="text-xs px-2 py-0.5 rounded-full bg-omp-surfaceLight text-omp-muted">
            {sessions.length}
          </span>
        </div>
        <div className="flex items-center space-x-1">
          <button
            onClick={loadSessions}
            className="p-1.5 rounded-md hover:bg-omp-surfaceLight text-omp-muted hover:text-white"
            title="Yenile"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md hover:bg-omp-surfaceLight text-omp-muted hover:text-white"
            title="Kapat"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="p-3 border-b border-omp-border bg-omp-bg">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-2.5 text-omp-muted" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Oturum veya proje ara..."
            className="w-full bg-omp-surface border border-omp-border rounded-lg pl-9 pr-3 py-1.5 text-xs text-white placeholder-omp-muted focus:outline-none focus:border-omp-accent"
          />
        </div>
      </div>

      {statusMsg && (
        <div className="px-4 py-2 bg-omp-accent/10 border-b border-omp-accent/30 text-xs text-omp-accent flex justify-between items-center">
          <span className="truncate">{statusMsg}</span>
          <button onClick={() => setStatusMsg('')} className="ml-2 font-bold">✕</button>
        </div>
      )}

      {/* Session Details Modal / Split view */}
      {selectedSession ? (
        <div className="flex-1 flex flex-col overflow-hidden bg-omp-bg">
          <div className="p-4 border-b border-omp-border bg-omp-surface flex justify-between items-start">
            <div>
              <h4 className="font-medium text-white text-sm">{selectedSession.summary.title}</h4>
              <p className="text-[11px] text-omp-muted mt-0.5 font-mono">{selectedSession.summary.id}</p>
            </div>
            <button
              onClick={() => setSelectedSession(null)}
              className="text-xs text-omp-muted hover:text-white px-2 py-1 bg-omp-surfaceLight rounded"
            >
              ← Listeye Dön
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3 text-xs">
            {selectedSession.messages.map((m, idx) => {
              const role = typeof m.role === 'string' ? m.role : m.type;
              return (
                <div key={idx} className="p-3 rounded-lg bg-omp-surface border border-omp-border space-y-1">
                  <div className="flex justify-between text-[11px] text-omp-muted font-mono">
                    <span className="uppercase text-omp-accent font-semibold">{String(role)}</span>
                    <span>{m.timestamp ? new Date(String(m.timestamp)).toLocaleTimeString() : ''}</span>
                  </div>
                  <div className="text-omp-text whitespace-pre-wrap font-sans">
                    {typeof m.text === 'string' ? m.text : JSON.stringify(m.message || m, null, 2)}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="p-3 border-t border-omp-border bg-omp-surface flex justify-end space-x-2">
            <button
              onClick={() => handleExportHTML(selectedSession.summary.path)}
              className="flex items-center space-x-1 px-3 py-1.5 rounded bg-omp-surfaceLight hover:bg-omp-border text-xs text-white"
            >
              <Download size={13} />
              <span>HTML Olarak Aktar</span>
            </button>
            <button
              onClick={() => {
                onResumeSession(selectedSession.summary);
                onClose();
              }}
              className="flex items-center space-x-1 px-3 py-1.5 rounded bg-omp-accent hover:bg-omp-accentHover text-xs text-white font-medium shadow"
            >
              <Play size={13} />
              <span>Oturumu Devam Ettir</span>
            </button>
          </div>
        </div>
      ) : (
        /* Sessions List */
        <div className="flex-1 overflow-y-auto divide-y divide-omp-border">
          {filteredSessions.length === 0 ? (
            <div className="p-8 text-center text-xs text-omp-muted">
              {loading ? 'Oturumlar yükleniyor...' : 'Kayıtlı oturum bulunamadı.'}
            </div>
          ) : (
            filteredSessions.map((s) => (
              <div
                key={s.id}
                className="p-4 hover:bg-omp-surfaceLight/50 transition-colors space-y-2 group"
              >
                <div className="flex items-start justify-between">
                  <button
                    onClick={() => handleViewDetail(s.path)}
                    className="text-left font-medium text-white text-xs hover:text-omp-accent transition line-clamp-1"
                  >
                    {s.title}
                  </button>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-omp-surfaceLight text-omp-muted font-mono">
                    {s.model || 'gemini-3.8-flash'}
                  </span>
                </div>

                <div className="flex items-center space-x-3 text-[11px] text-omp-muted">
                  <div className="flex items-center space-x-1">
                    <Layers size={12} />
                    <span className="truncate max-w-[120px]">{s.project}</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <MessageSquare size={12} />
                    <span>{s.msgCount} msj</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <Calendar size={12} />
                    <span>{new Date(s.updatedAt).toLocaleDateString()}</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-end space-x-2 pt-1 opacity-80 group-hover:opacity-100 transition">
                  <button
                    onClick={() => handleExportHTML(s.path)}
                    title="HTML Dışa Aktar"
                    className="p-1 rounded hover:bg-omp-border text-omp-muted hover:text-white text-[11px] flex items-center space-x-1"
                  >
                    <Download size={13} />
                    <span>HTML</span>
                  </button>
                  <button
                    onClick={() => {
                      onResumeSession(s);
                      onClose();
                    }}
                    title="Bu oturumu yükle ve devam et"
                    className="flex items-center space-x-1 px-2.5 py-1 rounded bg-omp-accent/20 hover:bg-omp-accent text-omp-accent hover:text-white transition text-xs font-medium"
                  >
                    <Play size={12} />
                    <span>Devam Et</span>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};
