import React, { useState, useEffect } from 'react';
import { Rune } from './Rune';
import * as AppApi from '../../wailsjs/go/main/App';
import { plugins } from '../../wailsjs/go/models';

export const PluginsPanel: React.FC = () => {
  const [pluginsList, setPluginsList] = useState<plugins.PluginInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState('');

  const loadPlugins = async () => {
    setLoading(true);
    try {
      const list = await AppApi.GetDesktopPlugins();
      setPluginsList(list || []);
    } catch (err) {
      console.error('Failed to load plugins:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPlugins();
  }, []);

  const handleToggle = async (plugin: plugins.PluginInfo) => {
    const nextState = !plugin.enabled;
    try {
      await AppApi.SetDesktopPluginEnabled(plugin.id, nextState);
      setPluginsList((prev) =>
        prev.map((p) => (p.id === plugin.id ? { ...p, enabled: nextState } : p))
      );
      setStatusMsg(`'${plugin.name}' eklentisi ${nextState ? 'aktif edildi' : 'devre dışı bırakıldı'}.`);
      setTimeout(() => setStatusMsg(''), 3000);
    } catch (err) {
      console.error('Failed to toggle plugin:', err);
    }
  };

  const handleSettingChange = (pluginId: string, settingKey: string, value: unknown) => {
    setPluginsList((prev) =>
      prev.map((p) => {
        if (p.id !== pluginId) return p;
        return {
          ...p,
          settings: {
            ...p.settings,
            [settingKey]: value,
          },
        };
      })
    );
  };

  const handleSaveSettings = async (plugin: plugins.PluginInfo) => {
    setSavingId(plugin.id);
    try {
      await AppApi.UpdateDesktopPluginSettings(plugin.id, plugin.settings || {});
      setStatusMsg(`'${plugin.name}' ayarları başarıyla kaydedildi.`);
      setTimeout(() => setStatusMsg(''), 3000);
    } catch (err) {
      console.error('Failed to update plugin settings:', err);
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-omp-bg overflow-hidden font-mono text-xs">
      {/* Top Bar */}
      <div className="p-4 border-b border-omp-border flex items-center justify-between bg-omp-surface shrink-0">
        <div>
          <h4 className="text-sm font-bold text-white flex items-center space-x-2">
            <span>05 // EKLENTİ YÖNETİCİSİ (DESKTOP PLUGINS)</span>
          </h4>
          <p className="text-[10px] text-omp-muted mt-0.5">
            OMP Desktop için genişletilebilir modüller, webhook'lar ve otomatik yanıtlayıcı servisleri.
          </p>
        </div>

        <button
          onClick={loadPlugins}
          disabled={loading}
          className="flex items-center space-x-1.5 px-3 py-1.5 rounded-[2px] bg-omp-bg hover:bg-omp-surfaceLight border border-omp-border text-zinc-300 hover:text-white transition"
        >
          <Rune name="schedule-refresh-cw" size={12} className={loading ? 'animate-spin' : ''} />
          <span>YENİLE</span>
        </button>
      </div>

      {/* Toast */}
      {statusMsg && (
        <div className="px-4 py-2 bg-emerald-500/15 border-b border-emerald-500/30 text-emerald-400 text-xs flex items-center space-x-2 shrink-0">
          <Rune name="indicators-check" size={13} />
          <span>{statusMsg}</span>
        </div>
      )}

      {/* Plugins List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {pluginsList.length === 0 ? (
          <div className="p-8 text-center text-omp-muted">
            {loading ? 'Eklentiler yükleniyor...' : 'Yüklü eklenti bulunamadı.'}
          </div>
        ) : (
          pluginsList.map((plugin) => {
            const isAutoResponder = plugin.id === 'task-responder' || plugin.id === 'ticket-responder' || plugin.id === 'auto-responder';
            const settings = plugin.settings || {};

            return (
              <div
                key={plugin.id}
                className="border border-omp-border rounded-[2px] bg-omp-surface overflow-hidden shadow-sm"
              >
                {/* Plugin Header */}
                <div className="p-3.5 border-b border-omp-border flex items-center justify-between bg-omp-surfaceLight/40">
                  <div className="flex items-center space-x-3">
                    <div
                      className={`w-8 h-8 rounded-[2px] flex items-center justify-center font-bold text-white ${
                        plugin.enabled ? 'bg-gradient-to-r from-[#E84AC3] to-[#6EADEE]' : 'bg-zinc-700 text-zinc-400'
                      }`}
                    >
                      <Rune name={isAutoResponder ? 'communication-message-square' : 'tools-settings'} size={15} />
                    </div>

                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-white text-xs tracking-wide">{plugin.name}</span>
                        <span className="text-[9px] px-1.5 py-0.2 rounded-[2px] bg-omp-bg text-omp-muted border border-omp-border">
                          v{plugin.version}
                        </span>
                        <span className="text-[9px] text-zinc-500">by {plugin.author}</span>
                      </div>
                      <p className="text-[10px] text-omp-muted mt-0.5">{plugin.description}</p>
                    </div>
                  </div>

                  {/* Toggle Button */}
                  <button
                    onClick={() => handleToggle(plugin)}
                    className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-[2px] border text-xs font-bold transition ${
                      plugin.enabled
                        ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400 hover:bg-emerald-500/30'
                        : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:bg-zinc-700'
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full ${plugin.enabled ? 'bg-emerald-400' : 'bg-zinc-500'}`} />
                    <span>{plugin.enabled ? 'AKTİF' : 'DEVRE DIŞI'}</span>
                  </button>
                </div>

                {/* Settings Body */}
                {plugin.enabled && (
                  <div className="p-4 space-y-4 bg-omp-surface">
                    <div className="text-[10px] uppercase font-bold text-omp-accent tracking-wider flex items-center space-x-1.5">
                      <Rune name="tools-settings" size={11} />
                      <span>EKLENTİ YAPILANDIRMASI</span>
                    </div>

                    {isAutoResponder ? (
                      <div className="space-y-3 text-xs">
                        {/* Auto Reply Toggle */}
                        <label className="flex items-center space-x-2.5 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={settings['auto_reply'] !== false}
                            onChange={(e) => handleSettingChange(plugin.id, 'auto_reply', e.target.checked)}
                            className="rounded-[2px] border-omp-border bg-omp-bg text-emerald-500 focus:ring-0"
                          />
                          <span className="text-zinc-200">
                            <strong>Otomatik Görev Yanıtı (Auto-Reply):</strong> Görev tamamlandığında OMP çıktısını doğrudan uzak sunucuya yanıt/callback olarak gönder.
                          </span>
                        </label>

                        {/* Mark Waiting User */}
                        <label className="flex items-center space-x-2.5 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={settings['mark_waiting_user'] !== false}
                            onChange={(e) => handleSettingChange(plugin.id, 'mark_waiting_user', e.target.checked)}
                            className="rounded-[2px] border-omp-border bg-omp-bg text-emerald-500 focus:ring-0"
                          />
                          <span className="text-zinc-200">
                            <strong>Görev Durumu (Durum Güncelleme):</strong> Cevap iletildikten sonra görevi 'Kullanıcıdan Mesaj Bekleniyor' durumuna al.
                          </span>
                        </label>

                        {/* Reply Prefix */}
                        <div className="space-y-1">
                          <label className="block text-[10px] uppercase text-omp-muted">
                            Yanıt Başlığı / Rozeti (Prefix):
                          </label>
                          <input
                            type="text"
                            value={String(settings['reply_prefix'] || '')}
                            onChange={(e) => handleSettingChange(plugin.id, 'reply_prefix', e.target.value)}
                            className="w-full bg-omp-bg border border-omp-border rounded-[2px] px-3 py-1.5 font-mono text-xs text-white focus:outline-none focus:border-emerald-500"
                            placeholder="🤖 **[OMP Asistanı]**\n\n"
                          />
                          <p className="text-[10px] text-zinc-500">
                            Görev cevabının en başına eklenen etiket veya imza metni.
                          </p>
                        </div>

                        {/* Chatbot Loop Info Box */}
                        <div className="p-3 rounded-[2px] bg-gradient-to-r from-emerald-500/10 to-sky-500/10 border border-emerald-500/30 flex items-start space-x-2.5">
                          <Rune name="indicators-check" size={14} className="text-emerald-400 shrink-0 mt-0.5" />
                          <div className="text-[11px] leading-relaxed text-zinc-300">
                            <strong className="text-white">Etkileşim Döngüsü Aktif:</strong> Uzak sistemde kullanıcı veya müşteri yeni bir mesaj/cevap yazdığında, talep otomatik olarak OMP Desktop kuyruğuna alınır ve OMP Desktop cevabı hazırlayıp göreve iletir.
                          </div>
                        </div>
                        {/* Save Button */}
                        <div className="pt-2 flex justify-end">
                          <button
                            onClick={() => handleSaveSettings(plugin)}
                            disabled={savingId === plugin.id}
                            className="flex items-center space-x-1.5 px-4 py-1.5 rounded-[2px] bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition"
                          >
                            <Rune name="indicators-check" size={12} />
                            <span>{savingId === plugin.id ? 'Kaydediliyor...' : 'Ayarları Kaydet'}</span>
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="text-omp-muted text-[11px]">
                        Bu eklenti için ek yapılandırma seçeneği bulunmamaktadır.
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
