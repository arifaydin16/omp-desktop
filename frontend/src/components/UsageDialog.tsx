import React, { useState, useEffect, useCallback } from 'react';
import { Rune } from './Rune';
import * as AppApi from '../../wailsjs/go/main/App';
import { UsageData, UsageReport } from '../types';

interface UsageDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

function formatCountdown(targetMs: number): string {
  const diff = targetMs - Date.now();
  if (diff <= 0) return 'şimdi sıfırlandı';
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;

  if (days > 0) {
    return `${days}g ${remainingHours}s`;
  }
  if (hours > 0) {
    return `${hours}s ${minutes}dk`;
  }
  return `${minutes}dk`;
}

export const UsageDialog: React.FC<UsageDialogProps> = ({ isOpen, onClose }) => {
  const [data, setData] = useState<UsageData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showRaw, setShowRaw] = useState(false);

  const fetchUsage = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await AppApi.GetUsage();
      setData(res as unknown as UsageData);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      fetchUsage();
    }
  }, [isOpen, fetchUsage]);

  if (!isOpen) return null;

  const reports: UsageReport[] = data?.reports || [];
  const capacity = data?.capacity || {};

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-fadeIn select-none font-mono text-xs">
      <div 
        className="w-full max-w-2xl bg-omp-surface border border-omp-border rounded-[2px] shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-scaleIn"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-3 border-b border-omp-border flex items-center justify-between bg-omp-surface">
          <div className="flex items-center space-x-3">
            <div className="w-6 h-6 rounded-[2px] bg-omp-accent flex items-center justify-center text-white font-bold">
              <Rune name="other-zap" size={14} />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-xs font-bold text-white uppercase tracking-wider">
                  04 // USAGE TELEMETRY & QUOTAS
                </h2>
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-[2px] bg-omp-bg text-omp-accent border border-omp-border">
                  OMP USAGE
                </span>
              </div>
              <p className="text-[11px] text-omp-muted">
                {reports[0]?.metadata?.email ? (
                  <span>ACCOUNT: {reports[0].metadata.email}</span>
                ) : (
                  'Hesap kotaları ve anlık hız limitleri'
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-1.5">
            <button
              type="button"
              onClick={fetchUsage}
              disabled={loading}
              title="Kotaları yenile"
              className="p-1 rounded-[2px] bg-omp-bg hover:bg-omp-surfaceLight border border-omp-border text-zinc-300 hover:text-white transition"
            >
              <Rune name="schedule-refresh-cw" size={13} className={loading ? 'animate-spin text-omp-accent' : ''} />
            </button>
            <button
              type="button"
              onClick={onClose}
              title="Kapat"
              className="p-1 rounded-[2px] bg-omp-bg hover:bg-omp-error/20 border border-omp-border text-zinc-400 hover:text-omp-error transition"
            >
              <Rune name="indicators-x" size={14} />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto space-y-5 flex-1 bg-omp-surface">
          {error && (
            <div className="p-3 rounded-[2px] bg-omp-error/15 border border-omp-error/40 text-omp-error text-xs flex items-center space-x-2">
              <Rune name="glass-exclamation-triangle-1" size={14} className="shrink-0" />
              <span>Kota bilgileri alınamadı: {error}</span>
            </div>
          )}

          {loading && !data ? (
            <div className="py-12 flex flex-col items-center justify-center space-y-2 text-omp-muted text-xs">
              <Rune name="schedule-refresh-cw" size={20} className="animate-spin text-omp-accent" />
              <span>KOTALAR ÇEKİLİYOR (OMP USAGE)...</span>
            </div>
          ) : (
            <>
              {/* Capacity Overview */}
              {Object.keys(capacity).length > 0 && (
                <div>
                  <h3 className="text-[10px] font-bold text-omp-muted uppercase tracking-wider mb-2 flex items-center space-x-1.5">
                    <Rune name="layouts-layers-2" size={12} className="text-omp-accent" />
                    <span>CAPACITY OVERVIEW</span>
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {Object.entries(capacity).map(([prov, windows]) => (
                      <React.Fragment key={prov}>
                        {windows.map((win) => {
                          const usedPercent = Math.min(100, Math.round(win.usedAccounts * 100));
                          const isWarning = usedPercent >= 90;
                          return (
                            <div 
                              key={win.window} 
                              className={`p-3 rounded-[2px] border ${isWarning ? 'border-omp-accent bg-omp-accent/5' : 'border-omp-border bg-omp-bg'} flex flex-col justify-between`}
                            >
                              <div className="flex items-center justify-between text-xs mb-2">
                                <span className="font-bold text-white uppercase text-[11px]">
                                  {win.window === '5h' ? '5 SAATLİK KAPASİTE' : 'HAFTALIK (7 GÜN)'}
                                </span>
                                <span className={`font-mono text-xs font-bold tabular-nums ${isWarning ? 'text-omp-accent' : 'text-zinc-200'}`}>
                                  %{usedPercent}
                                </span>
                              </div>
                              <div className="w-full bg-zinc-900 rounded-[2px] h-2 overflow-hidden mb-2 border border-omp-border">
                                <div 
                                  className={`h-full transition-all duration-500 ${isWarning ? 'bg-omp-accent' : 'bg-zinc-200'}`}
                                  style={{ width: `${usedPercent}%` }}
                                />
                              </div>
                              <div className="text-[10px] text-omp-muted flex justify-between font-mono">
                                <span>HESAP: {win.usedAccounts.toFixed(2)} / {win.accounts}</span>
                                <span>KALAN: {(win.remainingAccounts).toFixed(2)}x</span>
                              </div>
                            </div>
                          );
                        })}
                      </React.Fragment>
                    ))}
                  </div>
                </div>
              )}

              {/* Detailed Provider Limits */}
              {reports.map((report) => (
                <div key={report.provider} className="space-y-2.5">
                  <div className="flex items-center justify-between border-b border-omp-border pb-1.5">
                    <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center space-x-1.5">
                      <Rune name="identity-shield-check" size={13} className="text-omp-accent" />
                      <span>{report.provider.replace('-', ' ')}</span>
                    </h3>
                    {report.fetchedAt && (
                      <span className="text-[10px] font-mono text-omp-muted">
                        SENK: {new Date(report.fetchedAt).toLocaleTimeString()}
                      </span>
                    )}
                  </div>

                  <div className="space-y-2">
                    {report.limits.map((limit) => {
                      const used = limit.amount.used;
                      const isHigh = used >= 90;
                      const isMid = used >= 70 && used < 90;
                      const colorClass = isHigh ? 'text-omp-error' : isMid ? 'text-omp-warning' : 'text-omp-success';
                      const barClass = isHigh ? 'bg-omp-error' : isMid ? 'bg-omp-warning' : 'bg-omp-success';

                      return (
                        <div 
                          key={limit.id} 
                          className="p-3 rounded-[2px] bg-omp-bg border border-omp-border hover:border-omp-accent transition space-y-2"
                        >
                          <div className="flex items-center justify-between text-xs">
                            <div className="flex items-center space-x-2">
                              <span className="font-bold text-white uppercase text-[11px]">{limit.label}</span>
                              <span className="text-[9px] font-mono px-1 py-0.2 rounded-[2px] bg-omp-surface border border-omp-border text-zinc-400">
                                {limit.window.label}
                              </span>
                            </div>
                            <div className="flex items-center space-x-2">
                              <span className={`font-mono font-bold text-xs tabular-nums ${colorClass}`}>
                                %{used.toFixed(1)} KULLANILDI
                              </span>
                              {isHigh ? (
                                <Rune name="glass-exclamation-triangle-1" size={12} className="text-omp-error" />
                              ) : (
                                <Rune name="indicators-check" size={12} className="text-omp-success" />
                              )}
                            </div>
                          </div>

                          {/* Progress bar */}
                          <div className="w-full bg-zinc-900 rounded-[2px] h-2 overflow-hidden border border-omp-border">
                            <div 
                              className={`h-full transition-all duration-500 ${barClass}`}
                              style={{ width: `${Math.min(100, used)}%` }}
                            />
                          </div>

                          {/* Reset timer and info */}
                          <div className="flex items-center justify-between text-[10px] text-omp-muted font-mono">
                            <span className="flex items-center space-x-1">
                              <Rune name="schedule-clock" size={10} className="text-zinc-500" />
                              <span>RESET: {formatCountdown(limit.window.resetsAt)}</span>
                            </span>
                            <span>LIMIT: {limit.amount.limit}%</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}

              {/* Raw CLI fallback view */}
              {data?.rawText && (
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => setShowRaw(!showRaw)}
                    className="text-xs text-omp-muted hover:text-white flex items-center space-x-1 font-mono transition uppercase"
                  >
                    <Rune name="code-terminal" size={12} />
                    <span>{showRaw ? 'HAM ÇIKTIYI GİZLE' : 'HAM CLI ÇIKTISINI GÖSTER'}</span>
                  </button>
                  {showRaw && (
                    <pre className="mt-2 p-3 rounded-[2px] bg-black border border-omp-border text-xs font-mono text-zinc-300 overflow-x-auto whitespace-pre leading-relaxed select-text">
                      {data.rawText}
                    </pre>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-2.5 border-t border-omp-border bg-omp-surface flex items-center justify-between text-[11px] text-omp-muted font-mono">
          <span>KOTALAR OMP CLİ ÜZERİNDEN CANLI SORGULANIR.</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1 rounded-[2px] bg-omp-bg hover:bg-omp-surfaceLight border border-omp-border text-white text-xs font-bold uppercase tracking-wider transition"
          >
            KAPAT
          </button>
        </div>
      </div>
    </div>
  );
};
