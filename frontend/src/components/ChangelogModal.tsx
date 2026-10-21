import React, { useState, useEffect, useMemo } from 'react';
import { Rune } from './Rune';
import * as AppApi from '../../wailsjs/go/main/App';

interface ChangelogModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: 'recent' | 'full';
}

interface ReleaseItem {
  category: 'Added' | 'Fixed' | 'Changed' | 'Security' | 'Other';
  text: string;
}

interface Release {
  version: string;
  date?: string;
  items: ReleaseItem[];
  rawText: string;
}

export const ChangelogModal: React.FC<ChangelogModalProps> = ({
  isOpen,
  onClose,
  initialMode = 'recent',
}) => {
  const [viewMode, setViewMode] = useState<'recent' | 'full'>(initialMode);
  const [rawMarkdown, setRawMarkdown] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const loadChangelog = async (mode: 'recent' | 'full') => {
    setIsLoading(true);
    try {
      const arg = mode === 'full' ? 'full' : 'last 3';
      const content = await (AppApi as any).GetChangelog(arg);
      setRawMarkdown(content || '');
    } catch (err) {
      console.error('Failed to load changelog:', err);
      setRawMarkdown('# Changelog\n\nChangelog yüklenirken hata oluştu.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadChangelog(viewMode);
    }
  }, [isOpen, viewMode]);

  // Parse markdown releases into structured objects
  const parsedReleases = useMemo<Release[]>(() => {
    if (!rawMarkdown) return [];

    const releases: Release[] = [];
    const sections = rawMarkdown.split(/^##\s+\[/m);

    for (let i = 1; i < sections.length; i++) {
      const section = sections[i];
      const headerEndIndex = section.indexOf('\n');
      const header = headerEndIndex !== -1 ? section.slice(0, headerEndIndex) : section;
      const body = headerEndIndex !== -1 ? section.slice(headerEndIndex) : '';

      // header looks like "18.12.5] - 2026-10-21" or "Unreleased]"
      const match = header.match(/^([^\]]+)\](?:\s*-\s*(\d{4}-\d{2}-\d{2}))?/);
      const version = match ? match[1].trim() : 'Bilinmeyen Sürüm';
      const date = match && match[2] ? match[2].trim() : undefined;

      // Parse items by category (### Added, ### Fixed, ### Changed)
      const items: ReleaseItem[] = [];
      const lines = body.split('\n');
      let currentCategory: ReleaseItem['category'] = 'Other';

      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('### Added')) {
          currentCategory = 'Added';
        } else if (trimmed.startsWith('### Fixed')) {
          currentCategory = 'Fixed';
        } else if (trimmed.startsWith('### Changed')) {
          currentCategory = 'Changed';
        } else if (trimmed.startsWith('### Security')) {
          currentCategory = 'Security';
        } else if (trimmed.startsWith('###')) {
          currentCategory = 'Other';
        } else if (trimmed.startsWith('- ')) {
          items.push({
            category: currentCategory,
            text: trimmed.slice(2).trim(),
          });
        }
      }

      releases.push({
        version,
        date,
        items,
        rawText: body,
      });
    }

    return releases;
  }, [rawMarkdown]);

  // Filtered releases based on search query and category
  const filteredReleases = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();

    return parsedReleases.map((rel) => {
      const filteredItems = rel.items.filter((item) => {
        const matchesCategory =
          selectedCategory === 'all' ||
          item.category.toLowerCase() === selectedCategory.toLowerCase();
        const matchesQuery = !q || item.text.toLowerCase().includes(q) || rel.version.toLowerCase().includes(q);
        return matchesCategory && matchesQuery;
      });

      return {
        ...rel,
        items: filteredItems,
      };
    }).filter((rel) => rel.items.length > 0 || (!searchQuery && selectedCategory === 'all'));
  }, [parsedReleases, searchQuery, selectedCategory]);

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 select-none font-mono text-xs transition-all duration-200 ease-out ${
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
        onClick={(e) => e.stopPropagation()}
        className={`relative w-full max-w-3xl bg-omp-surface border border-omp-border rounded-[2px] shadow-2xl flex flex-col max-h-[85vh] overflow-hidden transition-all duration-200 ease-out transform ${
          isOpen ? 'scale-100 opacity-100 translate-y-0' : 'scale-95 opacity-0 translate-y-2'
        }`}
      >
        {/* Header */}
        <div className="px-5 py-3 border-b border-omp-border flex items-center justify-between bg-omp-surface shrink-0">
          <div className="flex items-center space-x-2.5">
            <div className="w-6 h-6 bg-gradient-to-r from-[#E84AC3] to-[#6EADEE] flex items-center justify-center text-white rounded-[2px]">
              <Rune name="documents-document" size={13} />
            </div>
            <div>
              <h3 className="font-bold text-white text-xs uppercase tracking-wider font-mono">
                OH-MY-PI // SÜRÜM NOTLARI (CHANGELOG)
              </h3>
              <p className="text-[10px] text-omp-muted">
                oh-my-pi sürüm geçmişi, yeni yetenekler ve düzeltmeler
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {/* View Mode Toggle */}
            <div className="flex items-center bg-omp-bg border border-omp-border rounded-[2px] p-0.5 text-[10px]">
              <button
                type="button"
                onClick={() => setViewMode('recent')}
                className={`px-2 py-0.5 rounded-[2px] transition ${
                  viewMode === 'recent'
                    ? 'bg-omp-surface border border-omp-border text-white font-bold'
                    : 'text-omp-muted hover:text-white'
                }`}
              >
                SON SÜRÜMLER
              </button>
              <button
                type="button"
                onClick={() => setViewMode('full')}
                className={`px-2 py-0.5 rounded-[2px] transition ${
                  viewMode === 'full'
                    ? 'bg-omp-surface border border-omp-border text-white font-bold'
                    : 'text-omp-muted hover:text-white'
                }`}
              >
                TÜM GEÇMİŞ
              </button>
            </div>

            <button
              onClick={onClose}
              className="p-1 rounded-[2px] hover:bg-omp-bg text-omp-muted hover:text-white"
              title="Kapat"
            >
              <Rune name="indicators-x" size={14} />
            </button>
          </div>
        </div>

        {/* Toolbar: Search & Category filter */}
        <div className="px-5 py-2.5 border-b border-omp-border bg-omp-bg flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div className="relative flex-1 min-w-[200px]">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Sürüm notlarında ara (örn: model, tool, advisor)..."
              className="w-full bg-omp-surface border border-omp-border rounded-[2px] px-2.5 py-1 text-xs text-white placeholder-omp-muted outline-none focus:border-omp-accent font-sans"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1.5 text-omp-muted hover:text-white text-xs"
              >
                ✕
              </button>
            )}
          </div>

          <div className="flex items-center space-x-1 text-[10px]">
            {[
              { id: 'all', label: 'TÜMÜ' },
              { id: 'added', label: 'YENİLİKLER' },
              { id: 'fixed', label: 'DÜZELTMELER' },
              { id: 'changed', label: 'DEĞİŞİKLİKLER' },
            ].map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-2 py-0.5 rounded-[2px] border transition ${
                  selectedCategory === cat.id
                    ? 'bg-gradient-to-r from-[#E84AC3]/20 to-[#6EADEE]/20 border-omp-accent text-white font-bold'
                    : 'bg-omp-surface border-omp-border text-omp-muted hover:text-zinc-200'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content list */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {isLoading ? (
            <div className="py-12 text-center text-omp-muted flex flex-col items-center justify-center space-y-2">
              <Rune name="schedule-refresh-cw" size={20} className="animate-spin text-omp-accent" />
              <span>Sürüm notları alınıyor...</span>
            </div>
          ) : filteredReleases.length === 0 ? (
            <div className="py-12 text-center text-omp-muted">
              Arama kriterinize uygun sürüm notu bulunamadı.
            </div>
          ) : (
            filteredReleases.map((rel, rIdx) => (
              <div
                key={rel.version + rIdx}
                className="bg-omp-bg border border-omp-border rounded-[2px] overflow-hidden"
              >
                {/* Release Header */}
                <div className="px-4 py-2 bg-omp-surface border-b border-omp-border flex items-center justify-between">
                  <div className="flex items-center space-x-2.5">
                    <span className="font-bold text-white text-sm tracking-tight font-mono">
                      v{rel.version}
                    </span>
                    {rIdx === 0 && (
                      <span className="px-1.5 py-0.5 rounded-[2px] bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-bold text-[9px] uppercase tracking-wider">
                        EN YENİ
                      </span>
                    )}
                  </div>
                  {rel.date && (
                    <span className="text-[11px] text-omp-muted font-mono flex items-center space-x-1">
                      <Rune name="schedule-clock" size={11} />
                      <span>{rel.date}</span>
                    </span>
                  )}
                </div>

                {/* Items */}
                <div className="p-4 space-y-2.5">
                  {rel.items.map((item, iIdx) => {
                    const badgeStyles = {
                      Added: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
                      Fixed: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
                      Changed: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
                      Security: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
                      Other: 'bg-zinc-700/20 text-zinc-300 border-zinc-700/40',
                    }[item.category];

                    return (
                      <div
                        key={iIdx}
                        className="flex items-start space-x-2 text-xs leading-relaxed"
                      >
                        <span
                          className={`px-1.5 py-0.2 rounded-[2px] text-[9px] font-mono font-bold border uppercase shrink-0 mt-0.5 ${badgeStyles}`}
                        >
                          {item.category}
                        </span>
                        <span className="text-zinc-200 font-sans select-text">
                          {item.text}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-2.5 border-t border-omp-border bg-omp-surface flex items-center justify-between shrink-0">
          <span className="text-[10px] text-omp-muted">
            Komut ile doğrudan açmak için: <code className="text-omp-accent font-mono font-bold">/changelog [full|last N]</code>
          </span>
          <button
            onClick={onClose}
            className="px-3 py-1 rounded-[2px] bg-omp-surface border border-omp-border hover:border-omp-accent text-white font-bold text-xs uppercase"
          >
            KAPAT
          </button>
        </div>
      </div>
    </div>
  );
};
