import React, { useState, useEffect, useMemo } from 'react';
import { 
  Sparkles, 
  Plus, 
  Search, 
  RefreshCw, 
  Trash2, 
  Edit3, 
  Save, 
  FileText, 
  Check, 
  X, 
  Copy, 
  Folder, 
  BookOpen, 
  AlertCircle,
  Code
} from 'lucide-react';
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
      // If a skill was selected, update its reference
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
        .then((content) => {
          setSkillContent(content || '');
        })
        .catch((err: unknown) => {
          console.error('Failed to read skill content:', err);
          setSkillContent('# İçerik okunamadı\n' + (err instanceof Error ? err.message : String(err)));
        })
        .finally(() => setLoadingContent(false));
    } else {
      setSkillContent('');
    }
  }, [selectedSkill]);

  const filteredSkills = useMemo(() => {
    return skills.filter((item) => {
      if (filterType === 'custom' && !item.isCustom) return false;
      if (filterType === 'registry' && item.isCustom) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const n = (item.name || '').toLowerCase();
        const d = (item.description || '').toLowerCase();
        return n.includes(q) || d.includes(q);
      }
      return true;
    });
  }, [skills, filterType, search]);

  const customCount = useMemo(() => skills.filter((s) => s.isCustom).length, [skills]);
  const registryCount = useMemo(() => skills.filter((s) => !s.isCustom).length, [skills]);

  // Start new custom skill creation
  const handleStartCreate = () => {
    setSelectedSkill(null);
    setEditName('');
    setEditDescription('');
    setEditContent(
`# Yeni Beceri Yönergesi

Bu beceri ajan tarafından çağrıldığında aşağıdaki talimatları uygular:

## Amac ve Kapsam
- [Becerinin ne yapacağını buraya yazın]

## Kurallar ve Adımlar
1. Kullanıcıdan gerekli girdileri kontrol et.
2. İşlemi güvenli ve test edilmiş biçimde yürüt.
3. Sonucu net ve anlaşılır formatta özetle.
`
    );
    setEditIsGlobal(true);
    setIsEditing(true);
    setErrorMessage('');
    setSaveSuccess(false);
  };

  // Start editing existing skill
  const handleStartEdit = () => {
    if (!selectedSkill) return;
    setEditName(selectedSkill.name);
    setEditDescription(selectedSkill.description || '');
    
    // Strip frontmatter from content for clean editing if desired, or keep as body
    let body = skillContent;
    if (body.startsWith('---')) {
      const parts = body.split('---');
      if (parts.length >= 3) {
        body = parts.slice(2).join('---').trim();
      }
    }
    setEditContent(body);
    setEditIsGlobal(true);
    setIsEditing(true);
    setErrorMessage('');
    setSaveSuccess(false);
  };

  // Save skill
  const handleSaveSkill = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editName.trim()) {
      setErrorMessage('Lütfen beceri adı girin (örn: code-optimizer)');
      return;
    }
    setSaving(true);
    setErrorMessage('');
    try {
      await AppApi.SaveCustomSkill(editName, editDescription, editContent, editIsGlobal);
      setSaveSuccess(true);
      await loadSkills();
      setTimeout(() => {
        setIsEditing(false);
        setSaveSuccess(false);
        // Select the newly saved skill
        const target = skills.find((s) => s.name === editName.trim().toLowerCase());
        if (target) setSelectedSkill(target);
      }, 600);
    } catch (err: unknown) {
      console.error('Failed to save skill:', err);
      setErrorMessage(err instanceof Error ? err.message : 'Beceri kaydedilirken hata oluştu');
    } finally {
      setSaving(false);
    }
  };

  // Delete skill
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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div 
        className="w-full max-w-5xl bg-omp-surface border-l border-omp-border shadow-2xl flex flex-col h-full font-sans animate-slideLeft"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drawer Header */}
        <div className="h-14 border-b border-omp-border px-6 flex items-center justify-between bg-omp-surfaceLight/40 shrink-0 select-none">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-lg bg-omp-accent/15 border border-omp-accent/30 flex items-center justify-center text-omp-accent">
              <Sparkles size={18} />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-base font-semibold text-white">Beceriler (Skills) Yöneticisi</h2>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-omp-bg text-omp-accent border border-omp-border font-mono">
                  {skills.length} Beceri
                </span>
              </div>
              <p className="text-xs text-omp-muted">
                Ajanın yetenek setleri, sistem yönergeleri ve kullanıcıya özel oluşturulan beceriler
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2.5">
            <button
              onClick={handleStartCreate}
              className="px-3 py-1.5 rounded-lg bg-omp-accent hover:bg-omp-accentHover text-white text-xs font-medium flex items-center space-x-1.5 transition shadow"
            >
              <Plus size={14} />
              <span>Yeni Skill Oluştur</span>
            </button>

            <button
              onClick={loadSkills}
              disabled={loading}
              title="Yenile"
              className="p-1.5 rounded-lg hover:bg-omp-border text-omp-muted hover:text-white transition"
            >
              <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            </button>

            <button
              onClick={onClose}
              title="Kapat"
              className="p-1.5 rounded-lg hover:bg-omp-border text-omp-muted hover:text-white transition"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Toolbar: Search & Filter Tabs */}
        <div className="px-6 py-3 border-b border-omp-border bg-omp-bg/60 flex items-center justify-between gap-4 shrink-0 select-none">
          <div className="relative flex-1 max-w-md">
            <Search size={14} className="absolute left-3 top-2.5 text-omp-muted" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Beceri adı veya açıklama ile ara..."
              className="w-full bg-omp-surface border border-omp-border rounded-xl pl-9 pr-4 py-1.5 text-xs text-white placeholder-omp-muted focus:outline-none focus:border-omp-accent transition font-mono"
            />
            {search && (
              <button 
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-2.5 text-omp-muted hover:text-white"
              >
                <X size={12} />
              </button>
            )}
          </div>

          {/* Filter tabs */}
          <div className="flex items-center space-x-1 bg-omp-surface border border-omp-border rounded-lg p-1 text-xs">
            <button
              onClick={() => setFilterType('all')}
              className={`px-3 py-1 rounded-md transition font-medium ${
                filterType === 'all'
                  ? 'bg-omp-border text-white shadow-sm'
                  : 'text-omp-muted hover:text-white'
              }`}
            >
              Tümü ({skills.length})
            </button>
            <button
              onClick={() => setFilterType('custom')}
              className={`px-3 py-1 rounded-md transition font-medium flex items-center space-x-1 ${
                filterType === 'custom'
                  ? 'bg-omp-accent/20 text-omp-accent border border-omp-accent/30 font-semibold'
                  : 'text-omp-muted hover:text-white'
              }`}
            >
              <span>Özel / Yerel</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-omp-bg">
                {customCount}
              </span>
            </button>
            <button
              onClick={() => setFilterType('registry')}
              className={`px-3 py-1 rounded-md transition font-medium flex items-center space-x-1 ${
                filterType === 'registry'
                  ? 'bg-omp-border text-white shadow-sm'
                  : 'text-omp-muted hover:text-white'
              }`}
            >
              <span>Registry</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-omp-bg">
                {registryCount}
              </span>
            </button>
          </div>
        </div>

        {/* Error message banner */}
        {errorMessage && (
          <div className="px-6 py-2 bg-red-950/40 border-b border-red-800/50 flex items-center justify-between text-xs text-red-200">
            <div className="flex items-center space-x-2">
              <AlertCircle size={14} className="text-red-400" />
              <span>{errorMessage}</span>
            </div>
            <button onClick={() => setErrorMessage('')} className="text-red-400 hover:text-white">
              <X size={12} />
            </button>
          </div>
        )}

        {/* Main Split Body: Left List / Right Viewer or Editor */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Column: Skills List */}
          <div className="w-80 md:w-96 border-r border-omp-border bg-[#0a0d12] flex flex-col shrink-0">
            <div className="p-3 border-b border-omp-border/60 text-[11px] text-omp-muted flex items-center justify-between select-none">
              <span>Mevcut Beceriler ({filteredSkills.length})</span>
              <span>{filterType === 'custom' ? 'Özel' : filterType === 'registry' ? 'Registry' : 'Tümü'}</span>
            </div>

            <div className="flex-1 overflow-y-auto p-2.5 space-y-1.5">
              {loading && skills.length === 0 ? (
                <div className="p-8 text-center text-xs text-omp-muted flex flex-col items-center space-y-2">
                  <RefreshCw size={20} className="animate-spin text-omp-accent" />
                  <span>Beceriler taranıyor...</span>
                </div>
              ) : filteredSkills.length === 0 ? (
                <div className="p-8 text-center text-xs text-omp-muted">
                  {search ? 'Aramaya uygun beceri bulunamadı.' : 'Henüz bu kategoride beceri yok.'}
                </div>
              ) : (
                filteredSkills.map((sk) => {
                  const isSelected = selectedSkill?.name === sk.name && !isEditing;
                  return (
                    <div
                      key={sk.name}
                      onClick={() => {
                        setSelectedSkill(sk);
                        setIsEditing(false);
                      }}
                      className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${
                        isSelected
                          ? 'bg-omp-accent/15 border-omp-accent text-white shadow-md'
                          : 'bg-omp-surface/50 border-omp-border/70 hover:border-omp-muted hover:bg-omp-surfaceLight/30 text-zinc-300'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <div className="flex items-center space-x-1.5 min-w-0">
                          <BookOpen size={14} className={isSelected ? 'text-omp-accent' : 'text-omp-muted shrink-0'} />
                          <span className="font-mono text-xs font-semibold text-white truncate">
                            {sk.name}
                          </span>
                        </div>
                        <span
                          className={`text-[9px] px-1.5 py-0.5 rounded font-medium shrink-0 uppercase tracking-wider ${
                            sk.isCustom
                              ? 'bg-emerald-950/70 text-emerald-300 border border-emerald-800/50'
                              : 'bg-blue-950/60 text-blue-300 border border-blue-800/40'
                          }`}
                        >
                          {sk.isCustom ? 'Özel' : 'Registry'}
                        </span>
                      </div>

                      <p className="text-[11px] text-omp-muted line-clamp-2 leading-relaxed">
                        {sk.description || 'Açıklama belirtilmemiş.'}
                      </p>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Right Column: Skill Viewer or Custom Skill Editor */}
          <div className="flex-1 flex flex-col bg-omp-bg overflow-hidden">
            {isEditing ? (
              /* ================= CUSTOM SKILL EDITOR ================= */
              <form onSubmit={handleSaveSkill} className="flex-1 flex flex-col overflow-hidden">
                <div className="p-4 border-b border-omp-border bg-omp-surfaceLight/30 flex items-center justify-between shrink-0 select-none">
                  <div className="flex items-center space-x-2">
                    <Edit3 size={16} className="text-omp-accent" />
                    <div>
                      <h3 className="text-sm font-semibold text-white">
                        {editName ? `Beceriyi Düzenle: ${editName}` : 'Yeni Özel Beceri (Skill) Oluştur'}
                      </h3>
                      <p className="text-[11px] text-omp-muted">
                        Standart YAML frontmatter ve Markdown yönergeleri ile oluşturulur (~/.agents/skills/)
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <button
                      type="button"
                      onClick={() => setIsEditing(false)}
                      className="px-3 py-1.5 rounded-lg border border-omp-border hover:bg-omp-border text-xs text-omp-muted hover:text-white transition"
                    >
                      İptal
                    </button>
                    <button
                      type="submit"
                      disabled={saving}
                      className="px-4 py-1.5 rounded-lg bg-omp-accent hover:bg-omp-accentHover text-white text-xs font-medium flex items-center space-x-1.5 transition shadow"
                    >
                      {saving ? (
                        <RefreshCw size={13} className="animate-spin" />
                      ) : saveSuccess ? (
                        <Check size={13} className="text-emerald-300" />
                      ) : (
                        <Save size={13} />
                      )}
                      <span>{saving ? 'Kaydediliyor...' : saveSuccess ? 'Kaydedildi!' : 'Kaydet & Aktif Et'}</span>
                    </button>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-5 text-xs">
                  {/* Skill Name */}
                  <div>
                    <label className="block text-white font-medium mb-1.5">
                      Beceri Adı (kebab-case): <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={editName}
                      onChange={(e) => setEditName(e.target.value.toLowerCase().replace(/[^a-z0-9-_]/g, '-'))}
                      placeholder="Örn: code-reviewer, test-generator, security-guard"
                      className="w-full bg-omp-surface border border-omp-border rounded-xl px-3.5 py-2 text-white font-mono focus:outline-none focus:border-omp-accent transition"
                    />
                    <p className="text-[10px] text-omp-muted mt-1">
                      Ajanın bu beceriyi tanıyacağı benzersiz kod (otomatik kebab-case yapılır).
                    </p>
                  </div>

                  {/* Trigger Description */}
                  <div>
                    <label className="block text-white font-medium mb-1.5">
                      Tetikleme Açıklaması (Description / Trigger Rules):
                    </label>
                    <textarea
                      rows={2}
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                      placeholder='Örn: Use when the user asks for code review, refactoring advice, or bug inspections...'
                      className="w-full bg-omp-surface border border-omp-border rounded-xl px-3.5 py-2 text-white focus:outline-none focus:border-omp-accent transition resize-none leading-relaxed"
                    />
                    <p className="text-[10px] text-omp-muted mt-1">
                      Ajan bu açıklamayı okuyarak kullanıcının hangi komutlarında bu beceriyi devreye alacağını belirler.
                    </p>
                  </div>

                  {/* Scope */}
                  <div className="flex items-center space-x-6 p-3 rounded-xl border border-omp-border bg-omp-surface/40">
                    <span className="font-medium text-white">Kayıt Konumu:</span>
                    <label className="flex items-center space-x-2 cursor-pointer text-omp-muted hover:text-white">
                      <input
                        type="radio"
                        checked={editIsGlobal}
                        onChange={() => setEditIsGlobal(true)}
                        className="text-omp-accent focus:ring-0"
                      />
                      <span>Genel Kullanıcı (~/.agents/skills/)</span>
                    </label>
                    <label className="flex items-center space-x-2 cursor-pointer text-omp-muted hover:text-white">
                      <input
                        type="radio"
                        checked={!editIsGlobal}
                        onChange={() => setEditIsGlobal(false)}
                        className="text-omp-accent focus:ring-0"
                      />
                      <span>Yalnızca Bu Proje (.agents/skills/)</span>
                    </label>
                  </div>

                  {/* Skill Markdown Body */}
                  <div className="flex-1 flex flex-col min-h-[300px]">
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-white font-medium flex items-center space-x-1.5">
                        <Code size={14} className="text-omp-accent" />
                        <span>Beceri Yönergesi (SKILL.md Markdown İçeriği):</span>
                      </label>
                      <span className="text-[10px] text-omp-muted font-mono">Markdown Formatı Desteklenir</span>
                    </div>
                    <textarea
                      rows={14}
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      placeholder="# Beceri Başlığı&#10;&#10;Ajan talimatları buraya yazılır..."
                      className="w-full flex-1 bg-omp-surface border border-omp-border rounded-xl p-3.5 text-white font-mono text-xs focus:outline-none focus:border-omp-accent transition resize-y leading-relaxed"
                    />
                  </div>
                </div>
              </form>
            ) : selectedSkill ? (
              /* ================= SKILL VIEWER ================= */
              <div className="flex-1 flex flex-col overflow-hidden">
                {/* Header */}
                <div className="p-4 border-b border-omp-border bg-omp-surfaceLight/30 flex items-start justify-between shrink-0">
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2.5">
                      <h3 className="text-base font-bold text-white font-mono">
                        {selectedSkill.name}
                      </h3>
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded font-semibold uppercase tracking-wider ${
                          selectedSkill.isCustom
                            ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-700/60'
                            : 'bg-blue-950/70 text-blue-300 border border-blue-700/50'
                        }`}
                      >
                        {selectedSkill.isCustom ? 'Özel / Yerel Beceri' : 'Skillshare Registry Becerisi'}
                      </span>
                    </div>

                    <div className="flex items-center space-x-2 text-[11px] text-omp-muted font-mono">
                      <Folder size={12} className="shrink-0" />
                      <span className="truncate max-w-lg">{selectedSkill.filePath}</span>
                      <button
                        onClick={() => copyPathOrContent(selectedSkill.filePath)}
                        title="Yolu Kopyala"
                        className="text-omp-muted hover:text-white transition"
                      >
                        {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <button
                      onClick={handleStartEdit}
                      className="px-3 py-1.5 rounded-lg border border-omp-border hover:bg-omp-border text-xs text-white flex items-center space-x-1.5 transition"
                    >
                      <Edit3 size={13} className="text-omp-accent" />
                      <span>Düzenle</span>
                    </button>

                    {deleteConfirm ? (
                      <div className="flex items-center space-x-1 bg-red-950/80 border border-red-700/80 rounded-lg p-1">
                        <span className="text-[10px] text-red-200 px-1">Emin misiniz?</span>
                        <button
                          onClick={handleDeleteSkill}
                          className="px-2 py-0.5 bg-red-600 hover:bg-red-700 text-white text-[10px] rounded font-medium"
                        >
                          Evet, Sil
                        </button>
                        <button
                          onClick={() => setDeleteConfirm(false)}
                          className="px-1.5 py-0.5 text-zinc-400 hover:text-white text-[10px]"
                        >
                          Vazgeç
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setDeleteConfirm(true)}
                        className="p-1.5 rounded-lg border border-omp-border hover:border-red-800 hover:bg-red-950/40 text-omp-muted hover:text-red-300 transition"
                        title="Beceriyi Sil"
                      >
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>
                </div>

                {/* Description Callout */}
                <div className="p-4 bg-omp-surface/60 border-b border-omp-border shrink-0">
                  <div className="text-[11px] font-semibold text-omp-accent mb-1 select-none">
                    Tetikleme ve Kullanım Koşulları:
                  </div>
                  <p className="text-xs text-zinc-300 leading-relaxed font-sans">
                    {selectedSkill.description || 'Bu beceri için özel tetikleme kuralı yazılmamış.'}
                  </p>
                </div>

                {/* Content Body */}
                <div className="flex-1 flex flex-col overflow-hidden p-4">
                  <div className="flex items-center justify-between pb-2 mb-2 border-b border-omp-border/60 text-[11px] text-omp-muted select-none">
                    <span className="flex items-center space-x-1.5">
                      <FileText size={13} className="text-omp-accent" />
                      <span>SKILL.md Yönerge İçeriği</span>
                    </span>
                    <button
                      onClick={() => copyPathOrContent(skillContent)}
                      className="flex items-center space-x-1 hover:text-white transition"
                    >
                      {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                      <span>{copied ? 'Kopyalandı' : 'İçeriği Kopyala'}</span>
                    </button>
                  </div>

                  <div className="flex-1 overflow-y-auto bg-[#0a0d12] border border-omp-border rounded-xl p-4 font-mono text-xs text-zinc-300 leading-relaxed whitespace-pre-wrap select-text">
                    {loadingContent ? (
                      <div className="flex items-center justify-center h-full text-omp-muted space-x-2">
                        <RefreshCw size={16} className="animate-spin text-omp-accent" />
                        <span>SKILL.md yükleniyor...</span>
                      </div>
                    ) : (
                      skillContent || 'Bu dosya henüz boş.'
                    )}
                  </div>
                </div>
              </div>
            ) : (
              /* ================= EMPTY STATE ================= */
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center select-none text-omp-muted">
                <div className="w-16 h-16 rounded-2xl bg-omp-surface border border-omp-border flex items-center justify-center text-omp-accent mb-4 shadow-lg">
                  <Sparkles size={28} />
                </div>
                <h4 className="text-base font-semibold text-white mb-1">Bir Beceri Seçin veya Yenisini Oluşturun</h4>
                <p className="text-xs max-w-sm mb-6 leading-relaxed">
                  Sol taraftaki listeden mevcut bir becerinin kurallarını inceleyebilir veya kendi özel becerinizi ekleyebilirsiniz.
                </p>
                <button
                  onClick={handleStartCreate}
                  className="px-4 py-2 rounded-xl bg-omp-accent hover:bg-omp-accentHover text-white text-xs font-semibold flex items-center space-x-2 transition shadow-lg"
                >
                  <Plus size={15} />
                  <span>Yeni Özel Skill Oluştur</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
