import React, { useState, useEffect, useMemo } from 'react';
import { Rune } from './Rune';
import { SkillItem } from '../types';
import * as AppApi from '../../wailsjs/go/main/App';

interface SkillsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SkillsDrawer: React.FC<SkillsDrawerProps> = ({
  isOpen,
  onClose,
}) => {
  const [skills, setSkills] = useState<SkillItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'custom' | 'registry'>('all');
  const [selectedSkill, setSelectedSkill] = useState<SkillItem | null>(null);
  const [skillContent, setSkillContent] = useState<string>('');
  const [loadingContent, setLoadingContent] = useState(false);

  // Custom Skill Creator / Editor state
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editContent, setEditContent] = useState('');
  const [editIsGlobal, setEditIsGlobal] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [copied, setCopied] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  const loadSkills = async () => {
    setLoading(true);
    setErrorMessage('');
    try {
      const list = await AppApi.GetSkillsList();
      setSkills(list || []);
      if (selectedSkill) {
        const found = (list || []).find((s) => s.name === selectedSkill.name);
        if (found) {
          setSelectedSkill(found);
        }
      }
    } catch (err: unknown) {
      console.error('Failed to load skills:', err);
      setErrorMessage(err instanceof Error ? err.message : 'Beceriler yüklenirken bir hata oluştu');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadSkills();
      setIsEditing(false);
    }
  }, [isOpen]);

  // Load content when a skill is selected
  useEffect(() => {
    if (selectedSkill && selectedSkill.filePath) {
      setLoadingContent(true);
      setDeleteConfirm(false);
      AppApi.ReadSkillContent(selectedSkill.filePath)
        .then((content: string) => {
          setSkillContent(content || '');
        })
        .catch((err: unknown) => {
          console.error('Failed to load skill content:', err);
          setSkillContent('İçerik yüklenemedi: ' + String(err));
        })
        .finally(() => {
          setLoadingContent(false);
        });
    } else {
      setSkillContent('');
    }
  }, [selectedSkill]);

  const customCount = useMemo(() => skills.filter((s) => s.isCustom).length, [skills]);
  const registryCount = useMemo(() => skills.filter((s) => !s.isCustom).length, [skills]);

  const filteredSkills = useMemo(() => {
    return skills.filter((s) => {
      // Type filter
      if (filterType === 'custom' && !s.isCustom) return false;
      if (filterType === 'registry' && s.isCustom) return false;

      // Text search
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchName = s.name.toLowerCase().includes(q);
        const matchDesc = s.description?.toLowerCase().includes(q);
        return matchName || matchDesc;
      }
      return true;
    });
  }, [skills, filterType, search]);

  const handleStartCreate = () => {
    setEditName('');
    setEditDescription('');
    setEditContent(
      `---\nname: my-new-skill\ndescription: Use when the user asks for...\n---\n\n# My New Skill\n\nInstructions for the agent go here...\n`
    );
    setEditIsGlobal(true);
    setIsEditing(true);
    setErrorMessage('');
    setSaveSuccess(false);
  };

  const handleStartEdit = () => {
    if (!selectedSkill) return;
    setEditName(selectedSkill.name);
    setEditDescription(selectedSkill.description || '');
    setEditContent(skillContent || '');
    setEditIsGlobal(!selectedSkill.filePath.includes('.agents\\skills') && !selectedSkill.filePath.includes('.agents/skills'));
    setIsEditing(true);
    setErrorMessage('');
    setSaveSuccess(false);
  };

  const handleSaveSkill = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = editName.trim().toLowerCase().replace(/[^a-z0-9-_]/g, '-');
    if (!cleanName) {
      setErrorMessage('Beceri adı gereklidir.');
      return;
    }

    setSaving(true);
    setErrorMessage('');
    try {
      await AppApi.SaveCustomSkill(cleanName, editDescription.trim(), editContent, editIsGlobal);
      setSaveSuccess(true);
      await loadSkills();
      setTimeout(() => {
        setIsEditing(false);
        setSaveSuccess(false);
      }, 1000);
    } catch (err: unknown) {
      console.error('Failed to save skill:', err);
      setErrorMessage(err instanceof Error ? err.message : 'Beceri kaydedilirken bir hata oluştu');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteSkill = async () => {
    if (!selectedSkill) return;
    setLoading(true);
    try {
      await AppApi.DeleteSkill(selectedSkill.name, selectedSkill.filePath);
      setSelectedSkill(null);
      setDeleteConfirm(false);
      await loadSkills();
    } catch (err: unknown) {
      console.error('Failed to delete skill:', err);
      setErrorMessage(err instanceof Error ? err.message : 'Beceri silinirken hata oluştu');
    } finally {
      setLoading(false);
    }
  };

  const copyPathOrContent = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div
      className={`fixed inset-0 z-50 flex justify-end transition-all duration-300 ease-out font-mono text-xs ${
        isOpen ? 'pointer-events-auto visible opacity-100' : 'pointer-events-none invisible opacity-0 delay-200'
      }`}
    >
      {/* Backdrop */}
      <div
        onClick={onClose}
        className={`absolute inset-0 bg-black/75 backdrop-blur-xs transition-opacity duration-300 ease-out ${
          isOpen ? 'opacity-100' : 'opacity-0'
        }`}
      />

      {/* Drawer Panel Sliding */}
      <div
        className={`relative w-full max-w-5xl bg-omp-surface border-l border-omp-border shadow-2xl flex flex-col h-full transition-transform duration-300 cubic-bezier(0.16, 1, 0.3, 1) ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drawer Header */}
        <div className="h-12 border-b border-omp-border px-5 flex items-center justify-between bg-omp-surface shrink-0 select-none">
          <div className="flex items-center space-x-3">
            <div className="w-6 h-6 bg-omp-accent flex items-center justify-center font-bold text-white text-xs rounded-[2px]">
              <Rune name="tools-sparkles" size={13} />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-xs font-bold text-white uppercase tracking-wider">
                  03 // SKILLS & AGENT EXTENSIONS
                </h2>
                <span className="text-[10px] px-1.5 py-0.5 rounded-[2px] bg-omp-bg text-omp-muted border border-omp-border tabular-nums">
                  {skills.length}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={handleStartCreate}
              className="px-3 py-1 rounded-[2px] bg-omp-accent hover:bg-omp-accentHover text-white text-xs font-bold uppercase tracking-wider flex items-center space-x-1.5 transition"
            >
              <span>+ YENİ SKILL</span>
            </button>

            <button
              onClick={loadSkills}
              disabled={loading}
              title="Yenile"
              className="p-1 rounded-[2px] hover:bg-omp-bg text-omp-muted hover:text-white transition"
            >
              <Rune name="schedule-refresh-cw" size={14} className={loading ? 'animate-spin' : ''} />
            </button>

            <button
              onClick={onClose}
              title="Kapat"
              className="p-1 rounded-[2px] hover:bg-omp-bg text-omp-muted hover:text-white transition"
            >
              <Rune name="indicators-x" size={14} />
            </button>
          </div>
        </div>

        {/* Toolbar: Search & Filter Tabs */}
        <div className="px-5 py-2.5 border-b border-omp-border bg-omp-bg flex items-center justify-between gap-4 shrink-0 select-none">
          <div className="relative flex-1 max-w-md">
            <Rune name="tools-search" size={13} className="absolute left-2.5 top-2 text-omp-muted" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Beceri adı veya açıklama ile filtrele..."
              className="w-full bg-omp-surface border border-omp-border rounded-[2px] pl-8 pr-3 py-1 text-xs text-white placeholder-omp-muted focus:outline-none focus:border-omp-accent font-mono"
            />
          </div>

          {/* Filter tabs */}
          <div className="flex items-center bg-omp-surface border border-omp-border rounded-[2px] divide-x divide-omp-border text-[11px] font-mono uppercase tracking-wider">
            <button
              onClick={() => setFilterType('all')}
              className={`px-3 py-1 transition ${
                filterType === 'all'
                  ? 'bg-omp-surfaceLight text-white font-bold'
                  : 'text-omp-muted hover:text-white'
              }`}
            >
              TÜMÜ ({skills.length})
            </button>
            <button
              onClick={() => setFilterType('custom')}
              className={`px-3 py-1 transition ${
                filterType === 'custom'
                  ? 'bg-omp-surfaceLight text-omp-accent font-bold'
                  : 'text-omp-muted hover:text-white'
              }`}
            >
              ÖZEL ({customCount})
            </button>
            <button
              onClick={() => setFilterType('registry')}
              className={`px-3 py-1 transition ${
                filterType === 'registry'
                  ? 'bg-omp-surfaceLight text-white font-bold'
                  : 'text-omp-muted hover:text-white'
              }`}
            >
              REGISTRY ({registryCount})
            </button>
          </div>
        </div>

        {/* Error message banner */}
        {errorMessage && (
          <div className="px-5 py-2 bg-omp-error/15 border-b border-omp-error/40 flex items-center justify-between text-xs text-omp-error font-mono">
            <span>{errorMessage}</span>
            <button onClick={() => setErrorMessage('')} className="hover:text-white font-bold">✕</button>
          </div>
        )}

        {/* Main Split Body: Left List / Right Viewer or Editor */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Column: Skills List */}
          <div className="w-80 md:w-96 border-r border-omp-border bg-omp-surface flex flex-col shrink-0">
            <div className="p-2.5 border-b border-omp-border text-[10px] text-omp-muted flex items-center justify-between select-none uppercase tracking-wider">
              <span>LIST // ({filteredSkills.length})</span>
              <span>{filterType.toUpperCase()}</span>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {loading && skills.length === 0 ? (
                <div className="p-8 text-center text-xs text-omp-muted flex flex-col items-center space-y-2">
                  <Rune name="schedule-refresh-cw" size={16} className="animate-spin text-omp-accent" />
                  <span>TARANIYOR...</span>
                </div>
              ) : filteredSkills.length === 0 ? (
                <div className="p-8 text-center text-xs text-omp-muted">
                  {search ? 'ARAMAYA UYGUN BECERİ BULUNAMADI.' : 'HENÜZ BECERİ YOK.'}
                </div>
              ) : (
                filteredSkills.map((sk) => {
                  const isSelected = selectedSkill?.name === sk.name && !isEditing;
                  return (
                    <button
                      key={sk.name}
                      onClick={() => {
                        setSelectedSkill(sk);
                        setIsEditing(false);
                      }}
                      className={`w-full text-left p-2.5 rounded-[2px] border transition-colors flex flex-col space-y-1 ${
                        isSelected
                          ? 'border-omp-accent bg-omp-bg text-white'
                          : 'border-omp-border/60 bg-omp-bg/60 hover:bg-omp-bg hover:border-omp-border text-zinc-300'
                      }`}
                    >
                      <div className="flex items-center justify-between w-full">
                        <span className="font-bold text-xs font-mono tracking-tight text-white">{sk.name}</span>
                        <span
                          className={`text-[9px] px-1.5 py-0.2 rounded-[2px] font-bold uppercase tracking-wider ${
                            sk.isCustom
                              ? 'bg-omp-accent/15 text-omp-accent border border-omp-accent/30'
                              : 'bg-zinc-800 text-zinc-300'
                          }`}
                        >
                          {sk.isCustom ? 'ÖZEL' : 'REG'}
                        </span>
                      </div>
                      <p className="text-[11px] text-omp-muted line-clamp-2 leading-relaxed font-sans">
                        {sk.description || 'Açıklama belirtilmemiş.'}
                      </p>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Right Column: Skill Viewer or Custom Skill Editor */}
          <div className="flex-1 flex flex-col bg-omp-bg overflow-hidden">
            {isEditing ? (
              /* Custom Skill Editor */
              <form onSubmit={handleSaveSkill} className="flex-1 flex flex-col overflow-hidden">
                <div className="p-3.5 border-b border-omp-border bg-omp-surface flex items-center justify-between shrink-0 select-none">
                  <div>
                    <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                      {editName ? `EDIT // ${editName}` : 'CREATE // NEW SKILL'}
                    </h3>
                  </div>

                  <div className="flex items-center space-x-2">
                    <button
                      type="button"
                      onClick={() => setIsEditing(false)}
                      className="px-3 py-1 rounded-[2px] border border-omp-border hover:bg-omp-surfaceLight text-xs text-omp-muted hover:text-white transition uppercase"
                    >
                      İPTAL
                    </button>
                    <button
                      type="submit"
                      disabled={saving}
                      className="px-4 py-1 rounded-[2px] bg-omp-accent hover:bg-omp-accentHover text-white text-xs font-bold uppercase tracking-wider flex items-center space-x-1.5 transition"
                    >
                      {saving ? (
                        <Rune name="schedule-refresh-cw" size={12} className="animate-spin" />
                      ) : saveSuccess ? (
                        <Rune name="indicators-check" size={12} />
                      ) : null}
                      <span>{saving ? 'KAYDEDİLİYOR...' : saveSuccess ? 'KAYDEDİLDİ' : 'KAYDET & AKTİF ET'}</span>
                    </button>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs font-mono">
                  <div>
                    <label className="block text-white font-bold mb-1 uppercase text-[11px]">
                      SKILL ADI (kebab-case): <span className="text-omp-accent">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={editName}
                      onChange={(e) => setEditName(e.target.value.toLowerCase().replace(/[^a-z0-9-_]/g, '-'))}
                      placeholder="code-reviewer, test-generator..."
                      className="w-full bg-omp-surface border border-omp-border rounded-[2px] px-3 py-1.5 text-white font-mono focus:outline-none focus:border-omp-accent"
                    />
                  </div>

                  <div>
                    <label className="block text-white font-bold mb-1 uppercase text-[11px]">
                      TRIGGER RULES / DESCRIPTION:
                    </label>
                    <textarea
                      rows={2}
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                      placeholder="Use when the user asks for code review..."
                      className="w-full bg-omp-surface border border-omp-border rounded-[2px] px-3 py-1.5 text-white focus:outline-none focus:border-omp-accent resize-none font-mono text-xs"
                    />
                  </div>

                  <div className="flex items-center space-x-6 p-2.5 rounded-[2px] border border-omp-border bg-omp-surface">
                    <span className="font-bold text-white uppercase text-[11px]">KONUM:</span>
                    <label className="flex items-center space-x-2 cursor-pointer text-omp-muted hover:text-white">
                      <input
                        type="radio"
                        checked={editIsGlobal}
                        onChange={() => setEditIsGlobal(true)}
                        className="text-omp-accent"
                      />
                      <span>GENEL (~/.agents/skills/)</span>
                    </label>
                    <label className="flex items-center space-x-2 cursor-pointer text-omp-muted hover:text-white">
                      <input
                        type="radio"
                        checked={!editIsGlobal}
                        onChange={() => setEditIsGlobal(false)}
                        className="text-omp-accent"
                      />
                      <span>PROJE (.agents/skills/)</span>
                    </label>
                  </div>

                  <div className="flex-1 flex flex-col min-h-[300px]">
                    <label className="block text-white font-bold mb-1 uppercase text-[11px]">
                      SKILL.MD MARKDOWN YÖNERGESİ:
                    </label>
                    <textarea
                      rows={14}
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      placeholder="# Beceri Başlığı..."
                      className="w-full flex-1 bg-omp-surface border border-omp-border rounded-[2px] p-3 text-white font-mono text-xs focus:outline-none focus:border-omp-accent resize-y leading-relaxed"
                    />
                  </div>
                </div>
              </form>
            ) : selectedSkill ? (
              /* Skill Viewer */
              <div className="flex-1 flex flex-col overflow-hidden">
                <div className="p-3.5 border-b border-omp-border bg-omp-surface flex items-start justify-between shrink-0">
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2.5">
                      <h3 className="text-sm font-bold text-white font-mono uppercase tracking-tight">
                        {selectedSkill.name}
                      </h3>
                      <span
                        className={`text-[9px] px-1.5 py-0.2 rounded-[2px] font-bold uppercase tracking-wider ${
                          selectedSkill.isCustom
                            ? 'bg-omp-accent/15 text-omp-accent border border-omp-accent/40'
                            : 'bg-zinc-800 text-zinc-300'
                        }`}
                      >
                        {selectedSkill.isCustom ? 'ÖZEL SKILL' : 'REGISTRY SKILL'}
                      </span>
                    </div>

                    <div className="flex items-center space-x-2 text-[10px] text-omp-muted font-mono">
                      <span className="truncate max-w-lg">{selectedSkill.filePath}</span>
                      <button
                        onClick={() => copyPathOrContent(selectedSkill.filePath)}
                        title="Yolu Kopyala"
                        className="text-omp-muted hover:text-white"
                      >
                        <Rune name="code-copy" size={11} />
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <button
                      onClick={handleStartEdit}
                      className="px-3 py-1 rounded-[2px] border border-omp-border hover:bg-omp-surfaceLight text-xs text-white uppercase font-bold transition"
                    >
                      DÜZENLE
                    </button>

                    {deleteConfirm ? (
                      <div className="flex items-center space-x-1 bg-omp-error/20 border border-omp-error/50 rounded-[2px] p-1 font-mono">
                        <span className="text-[10px] text-white px-1">SİLİNSİN Mİ?</span>
                        <button
                          onClick={handleDeleteSkill}
                          className="px-2 py-0.5 bg-omp-error text-white text-[10px] rounded-[2px] font-bold"
                        >
                          EVET
                        </button>
                        <button
                          onClick={() => setDeleteConfirm(false)}
                          className="px-1.5 py-0.5 text-zinc-400 hover:text-white text-[10px]"
                        >
                          İPTAL
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setDeleteConfirm(true)}
                        className="p-1 rounded-[2px] border border-omp-border hover:border-omp-error text-omp-muted hover:text-omp-error transition"
                        title="Beceriyi Sil"
                      >
                        <Rune name="tools-trash-2" size={13} />
                      </button>
                    )}
                  </div>
                </div>

                <div className="p-3 bg-omp-surface/50 border-b border-omp-border shrink-0">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-omp-accent mb-1 font-mono">
                    TRIGGER RULES:
                  </div>
                  <p className="text-xs text-zinc-300 font-sans leading-relaxed">
                    {selectedSkill.description || 'Özel tetikleme kuralı tanımlanmamış.'}
                  </p>
                </div>

                <div className="flex-1 flex flex-col overflow-hidden p-3 font-mono">
                  <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-omp-border text-[10px] text-omp-muted select-none uppercase tracking-wider">
                    <span>SKILL.MD // INSTRUCTIONS</span>
                    <button
                      onClick={() => copyPathOrContent(skillContent)}
                      className="hover:text-white flex items-center space-x-1"
                    >
                      <Rune name="code-copy" size={11} />
                      <span>{copied ? 'KOPYALANDI' : 'KOPYALA'}</span>
                    </button>
                  </div>

                  <div className="flex-1 overflow-y-auto bg-omp-surface border border-omp-border rounded-[2px] p-3 text-xs text-zinc-200 leading-relaxed whitespace-pre-wrap select-text">
                    {loadingContent ? (
                      <div className="flex items-center justify-center h-full text-omp-muted space-x-2">
                        <Rune name="schedule-refresh-cw" size={14} className="animate-spin text-omp-accent" />
                        <span>YÜKLENİYOR...</span>
                      </div>
                    ) : (
                      skillContent || 'Dosya boş.'
                    )}
                  </div>
                </div>
              </div>
            ) : (
              /* Empty State */
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center select-none text-omp-muted">
                <div className="w-12 h-12 bg-omp-surface border border-omp-border rounded-[2px] flex items-center justify-center text-omp-accent mb-4">
                  <Rune name="tools-sparkles" size={20} />
                </div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-white mb-1">
                  BİR BECERİ SEÇİN VEYA OLUŞTURUN
                </h4>
                <p className="text-xs max-w-sm mb-6 leading-relaxed font-sans">
                  Ajanın yönergelerini incelemek veya sisteme yeni yetenekler tanımlamak için seçim yapın.
                </p>
                <button
                  onClick={handleStartCreate}
                  className="px-4 py-1.5 rounded-[2px] bg-omp-accent hover:bg-omp-accentHover text-white text-xs font-bold uppercase tracking-wider transition"
                >
                  + YENİ ÖZEL SKILL
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
