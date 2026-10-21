import React, { useState, useEffect, useMemo } from 'react';
import { Rune } from './Rune';
import { SessionSummary } from '../types';
import * as AppApi from '../../wailsjs/go/main/App';

interface WorkspaceSessionsSidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  currentCwd: string;
  onResumeSession: (session: SessionSummary) => void;
  onNewSession: () => void;
}

interface WorkspaceGroup {
  id: string;
  name: string;
  path: string;
  isActive: boolean;
  sessions: SessionSummary[];
}

export const WorkspaceSessionsSidebar: React.FC<WorkspaceSessionsSidebarProps> = ({
  isOpen,
  onToggle,
  currentCwd,
  onResumeSession,
  onNewSession,
}) => {
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [expandedWorkspaces, setExpandedWorkspaces] = useState<Record<string, boolean>>({});

  const loadSessions = async () => {
    setLoading(true);
    try {
      const list = await AppApi.GetSessions(200);
      setSessions(list || []);
    } catch (err) {
      console.error('Failed to load workspace sessions:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSessions();
  }, [isOpen, currentCwd]);

  // Clean workspace name from path or project identifier
  const formatWorkspaceName = (rawPath: string, rawProject: string): string => {
    if (rawPath) {
      const normalized = rawPath.replace(/\\/g, '/').replace(/\/+$/, '');
      const parts = normalized.split('/');
      return parts[parts.length - 1] || rawPath;
    }
    if (rawProject) {
      // Remove leading hyphens or common path prefixes
      return rawProject.replace(/^[-\\/]+/, '').split(/[-\\/]/).pop() || rawProject;
    }
    return 'Default Workspace';
  };

  // Group sessions by workspace
  const workspaceGroups: WorkspaceGroup[] = useMemo(() => {
    const map = new Map<string, WorkspaceGroup>();
    const normalizedCurrentCwd = (currentCwd || '').toLowerCase().replace(/\\/g, '/').replace(/\/+$/, '');

    sessions.forEach((s) => {
      const wsPath = s.cwd || s.project || 'default';
      const wsKey = wsPath.toLowerCase().replace(/\\/g, '/').replace(/\/+$/, '');
      const isActive = normalizedCurrentCwd !== '' && (wsKey === normalizedCurrentCwd || wsKey.endsWith(normalizedCurrentCwd));

      if (!map.has(wsKey)) {
        map.set(wsKey, {
          id: wsKey,
          name: formatWorkspaceName(s.cwd, s.project),
          path: s.cwd || s.project,
          isActive,
          sessions: [],
        });
      }

      map.get(wsKey)!.sessions.push(s);
    });

    // Ensure current active cwd has an entry even if 0 saved sessions yet
    if (normalizedCurrentCwd && !map.has(normalizedCurrentCwd)) {
      map.set(normalizedCurrentCwd, {
        id: normalizedCurrentCwd,
        name: formatWorkspaceName(currentCwd, ''),
        path: currentCwd,
        isActive: true,
        sessions: [],
      });
    }

    // Sort: Active workspace first, then by latest session date
    return Array.from(map.values()).sort((a, b) => {
      if (a.isActive) return -1;
      if (b.isActive) return 1;
      const dateA = a.sessions[0]?.updatedAt ? new Date(a.sessions[0].updatedAt).getTime() : 0;
      const dateB = b.sessions[0]?.updatedAt ? new Date(b.sessions[0].updatedAt).getTime() : 0;
      return dateB - dateA;
    });
  }, [sessions, currentCwd]);

  // Auto-expand active workspace by default
  useEffect(() => {
    if (workspaceGroups.length > 0) {
      setExpandedWorkspaces((prev) => {
        const next = { ...prev };
        workspaceGroups.forEach((g) => {
          if (next[g.id] === undefined) {
            next[g.id] = g.isActive || workspaceGroups.length <= 2;
          }
        });
        return next;
      });
    }
  }, [workspaceGroups]);

  // Filter groups & sessions based on search
  const filteredGroups = useMemo(() => {
    if (!search.trim()) return workspaceGroups;
    const q = search.toLowerCase();
    return workspaceGroups
      .map((g) => {
        const matchesWsName = g.name.toLowerCase().includes(q) || g.path.toLowerCase().includes(q);
        const matchingSessions = g.sessions.filter(
          (s) =>
            s.title?.toLowerCase().includes(q) ||
            s.id?.toLowerCase().includes(q) ||
            s.model?.toLowerCase().includes(q)
        );
        if (matchesWsName) return g;
        if (matchingSessions.length > 0) {
          return { ...g, sessions: matchingSessions };
        }
        return null;
      })
      .filter(Boolean) as WorkspaceGroup[];
  }, [workspaceGroups, search]);

  const toggleWorkspace = (id: string) => {
    setExpandedWorkspaces((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const formatSessionTime = (isoString?: string): string => {
    if (!isoString) return '';
    try {
      const d = new Date(isoString);
      const now = new Date();
      const diffMs = now.getTime() - d.getTime();
      const diffMinutes = Math.floor(diffMs / (1000 * 60));
      const diffHours = Math.floor(diffMinutes / 60);
      const diffDays = Math.floor(diffHours / 24);

      if (diffMinutes < 1) return 'Az önce';
      if (diffMinutes < 60) return `${diffMinutes} dk önce`;
      if (diffHours < 24) return `${diffHours} sa önce`;
      if (diffDays === 1) return 'Dün';
      if (diffDays < 7) return `${diffDays} gün önce`;
      return d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
    } catch {
      return '';
    }
  };

  if (!isOpen) {
    return null;
  }

  return (
    <aside className="w-72 sm:w-80 h-full border-r border-omp-border bg-omp-surface flex flex-col select-none shrink-0 z-30 font-sans transition-all duration-200">
      {/* Top Header */}
      <div className="h-11 px-3 border-b border-omp-border flex items-center justify-between bg-omp-surface shrink-0">
        <div className="flex items-center space-x-2">
          <div className="w-5 h-5 bg-omp-accent/20 border border-omp-accent/40 rounded-[2px] flex items-center justify-center text-omp-accent">
            <Rune name="folder" size={12} />
          </div>
          <span className="font-bold text-white text-xs uppercase tracking-wider font-mono">
            WORKSPACES // SESSIONS
          </span>
        </div>
        <div className="flex items-center space-x-1">
          <button
            onClick={loadSessions}
            disabled={loading}
            className="p-1 rounded-[2px] hover:bg-omp-bg border border-transparent hover:border-omp-border text-omp-muted hover:text-white transition"
            title="Oturumları Yenile"
          >
            <Rune name="refresh" size={12} className={loading ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={onToggle}
            className="p-1 rounded-[2px] hover:bg-omp-bg border border-transparent hover:border-omp-border text-omp-muted hover:text-white transition"
            title="Kenar Çubuğunu Kapat"
          >
            <Rune name="chevron-left" size={13} />
          </button>
        </div>
      </div>

      {/* Action Bar: New Session & Search */}
      <div className="p-2.5 border-b border-omp-border/60 bg-omp-surfaceLight/30 space-y-2 shrink-0">
        <button
          onClick={onNewSession}
          className="w-full flex items-center justify-center space-x-2 py-1.5 px-3 rounded-[2px] bg-gradient-to-r from-[#E84AC3] to-[#6EADEE] hover:opacity-95 text-white font-mono font-bold text-xs uppercase tracking-wider shadow-sm transition"
        >
          <span className="text-sm leading-none font-bold">+</span>
          <span>YENİ OTURUM BAŞLAT</span>
        </button>

        <div className="relative">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Workspace veya oturum ara..."
            className="w-full pl-7 pr-6 py-1 bg-omp-bg border border-omp-border rounded-[2px] text-xs text-white placeholder-omp-muted focus:outline-none focus:border-omp-accent font-mono transition"
          />
          <div className="absolute left-2 top-1.5 text-omp-muted pointer-events-none">
            <Rune name="search" size={11} />
          </div>
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-2 top-1.5 text-omp-muted hover:text-white"
            >
              <Rune name="close" size={10} />
            </button>
          )}
        </div>
      </div>

      {/* Workspaces & Sessions Tree View */}
      <div className="flex-1 overflow-y-auto p-1.5 space-y-1">
        {filteredGroups.length === 0 ? (
          <div className="p-6 text-center text-xs text-omp-muted font-mono">
            {search ? 'Aramaya uygun oturum bulunamadı.' : 'Henüz kaydedilmiş oturum yok.'}
          </div>
        ) : (
          filteredGroups.map((group) => {
            const isExpanded = expandedWorkspaces[group.id] ?? false;
            return (
              <div
                key={group.id}
                className={`border rounded-[2px] transition ${
                  group.isActive
                    ? 'border-omp-accent/50 bg-omp-surfaceLight/40'
                    : 'border-omp-border/60 bg-omp-bg/40'
                }`}
              >
                {/* Workspace Header Accordion */}
                <button
                  type="button"
                  onClick={() => toggleWorkspace(group.id)}
                  className="w-full px-2.5 py-1.5 flex items-center justify-between text-left hover:bg-omp-surfaceLight transition select-none group"
                  title={group.path}
                >
                  <div className="flex items-center space-x-2 min-w-0">
                    <span className="text-omp-muted group-hover:text-white transition">
                      <Rune name={isExpanded ? 'folder-open' : 'folder'} size={13} />
                    </span>
                    <span className="font-bold text-white text-xs truncate font-mono">
                      {group.name}
                    </span>
                    {group.isActive && (
                      <span className="text-[9px] px-1.5 py-0.2 rounded-[2px] bg-gradient-to-r from-[#E84AC3] to-[#6EADEE] text-white font-mono font-bold uppercase shrink-0">
                        AKTİF
                      </span>
                    )}
                  </div>
                  <div className="flex items-center space-x-1.5 shrink-0 text-omp-muted">
                    <span className="text-[10px] font-mono tabular-nums px-1.5 py-0.2 rounded-[2px] bg-omp-surface border border-omp-border">
                      {group.sessions.length}
                    </span>
                    <Rune
                      name={isExpanded ? 'chevron-down' : 'chevron-right'}
                      size={11}
                      className="transition-transform"
                    />
                  </div>
                </button>

                {/* Sessions List */}
                {isExpanded && (
                  <div className="border-t border-omp-border/40 divide-y divide-omp-border/30 bg-omp-surface/40">
                    {group.sessions.length === 0 ? (
                      <div className="px-3 py-2 text-[11px] text-omp-muted italic font-mono">
                        Bu workspace altında oturum yok.
                      </div>
                    ) : (
                      group.sessions.map((session) => (
                        <div
                          key={session.id}
                          onClick={() => onResumeSession(session)}
                          className="px-2.5 py-2 hover:bg-omp-surfaceLight/80 cursor-pointer transition group/item"
                        >
                          <div className="flex items-start justify-between gap-1.5 mb-1">
                            <span className="font-medium text-xs text-white line-clamp-2 leading-snug group-hover/item:text-omp-accent transition">
                              {session.title || 'Başlıksız Oturum'}
                            </span>
                          </div>

                          <div className="flex items-center justify-between text-[10px] text-omp-muted font-mono">
                            <div className="flex items-center space-x-2">
                              <span>{formatSessionTime(session.updatedAt)}</span>
                              <span>·</span>
                              <span>{session.msgCount || 0} msg</span>
                            </div>
                            {session.model && (
                              <span className="text-[9px] px-1 py-0.2 bg-omp-bg border border-omp-border rounded-[2px] text-omp-muted truncate max-w-[90px]">
                                {session.model.split('/').pop()}
                              </span>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Footer info */}
      <div className="p-2 border-t border-omp-border bg-omp-surface text-[10px] text-omp-muted font-mono flex items-center justify-between shrink-0">
        <span>{sessions.length} Toplam Oturum</span>
        <span className="text-omp-accent">~/.omp/agent</span>
      </div>
    </aside>
  );
};
