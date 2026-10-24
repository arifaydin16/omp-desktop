import React, { useState, useEffect, useRef, useId } from 'react';
import mermaid from 'mermaid';
import { Rune } from './Rune';

interface MarkdownRendererProps {
  content: string;
  msgId: string;
}

// Initialize mermaid once
try {
  mermaid.initialize({
    startOnLoad: false,
    theme: 'dark',
    darkMode: true,
    themeVariables: {
      darkMode: true,
      background: '#09090b',
      primaryColor: '#e11d48',
      primaryTextColor: '#ffffff',
      primaryBorderColor: '#3f3f46',
      lineColor: '#06b6d4',
      secondaryColor: '#18181b',
      tertiaryColor: '#27272a',
    },
  });
} catch (e) {
  console.warn('Mermaid initialization error:', e);
}

interface TimelineItem {
  label: string;
  start: number;
  end: number;
  rangeText: string;
}

/**
 * Parses time range like "0.0 - 4.6s", "4.6 - 9.3s", "10s - 20s", "0:00 - 1:30"
 */
function parseTimeRange(cellText: string): { start: number; end: number; rangeText: string } | null {
  // Format 1: 0.0 - 4.6s or 0 - 5 sec
  const secMatch = cellText.match(/(\d+(?:\.\d+)?)\s*(?:s|sn|sec)?\s*[-–—to]+\s*(\d+(?:\.\d+)?)\s*(?:s|sn|sec)?/i);
  if (secMatch) {
    const start = parseFloat(secMatch[1]);
    const end = parseFloat(secMatch[2]);
    if (!isNaN(start) && !isNaN(end) && end >= start) {
      return { start, end, rangeText: `${start} - ${end}s` };
    }
  }

  // Format 2: mm:ss - mm:ss
  const mmMatch = cellText.match(/(\d+):(\d+)\s*[-–—to]+\s*(\d+):(\d+)/);
  if (mmMatch) {
    const start = parseInt(mmMatch[1], 10) * 60 + parseInt(mmMatch[2], 10);
    const end = parseInt(mmMatch[3], 10) * 60 + parseInt(mmMatch[4], 10);
    if (!isNaN(start) && !isNaN(end) && end >= start) {
      return { start, end, rangeText: `${mmMatch[1]}:${mmMatch[2]} - ${mmMatch[3]}:${mmMatch[4]}` };
    }
  }

  return null;
}

/**
 * Live Mermaid Diagram Component
 */
const MermaidBlock: React.FC<{ code: string; blockKey: string }> = ({ code, blockKey }) => {
  const [svgHtml, setSvgHtml] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'diagram' | 'code'>('diagram');
  const [copied, setCopied] = useState(false);
  const uniqueId = useId().replace(/:/g, '_');

  useEffect(() => {
    let isMounted = true;
    const renderDiagram = async () => {
      try {
        const id = `mermaid_${uniqueId}_${Math.random().toString(36).slice(2, 7)}`;
        const { svg } = await mermaid.render(id, code.trim());
        if (isMounted) {
          setSvgHtml(svg);
          setError(null);
        }
      } catch (err: unknown) {
        if (isMounted) {
          setError(String(err));
        }
      }
    };
    renderDiagram();
    return () => {
      isMounted = false;
    };
  }, [code, uniqueId]);

  return (
    <div className="my-3 rounded-[2px] border border-omp-border bg-[#09090b] overflow-hidden shadow-xl">
      <div className="flex items-center justify-between px-3 py-1.5 bg-omp-surface border-b border-omp-border text-[10px] font-mono select-none">
        <div className="flex items-center space-x-2">
          <span className="font-bold text-cyan-400">MERMAID // DIAGRAM</span>
          {error && <span className="text-rose-400 font-semibold">[HATA]</span>}
        </div>
        <div className="flex items-center space-x-1.5">
          <button
            type="button"
            onClick={() => setViewMode(viewMode === 'diagram' ? 'code' : 'diagram')}
            className="px-2 py-0.5 rounded-[2px] border border-omp-border hover:bg-omp-surfaceLight text-zinc-300 hover:text-white transition"
          >
            {viewMode === 'diagram' ? 'KODU GÖR' : 'DİYAGRAMI GÖR'}
          </button>
          <button
            type="button"
            onClick={() => {
              navigator.clipboard.writeText(code);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            }}
            className="px-2 py-0.5 rounded-[2px] border border-omp-border hover:bg-omp-surfaceLight text-zinc-300 hover:text-white transition flex items-center space-x-1"
          >
            {copied ? (
              <>
                <Rune name="indicators-check" size={11} className="text-omp-success" />
                <span className="text-omp-success font-semibold">KOPYALANDI</span>
              </>
            ) : (
              <>
                <Rune name="code-copy" size={11} />
                <span>KOPYALA</span>
              </>
            )}
          </button>
        </div>
      </div>

      {viewMode === 'diagram' && !error && svgHtml ? (
        <div
          className="p-5 overflow-x-auto flex items-center justify-center bg-[#09090b] [&_svg]:max-w-full [&_svg]:h-auto"
          dangerouslySetInnerHTML={{ __html: svgHtml }}
        />
      ) : (
        <pre className="p-3 text-[12px] font-mono text-zinc-200 overflow-x-auto leading-relaxed whitespace-pre select-text bg-[#09090b]">
          <code>{code}</code>
        </pre>
      )}
    </div>
  );
};

/**
 * Live SVG Renderer Component with visual/code toggle and download
 */
const SvgBlock: React.FC<{ code: string; blockKey: string }> = ({ code }) => {
  const [viewMode, setViewMode] = useState<'visual' | 'code'>('visual');
  const [copied, setCopied] = useState(false);

  const cleanSvg = code.trim();
  const isValidSvg = cleanSvg.startsWith('<svg') && cleanSvg.endsWith('</svg>');

  const downloadSvg = () => {
    const blob = new Blob([cleanSvg], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `omp-graphic-${Date.now()}.svg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="my-3 rounded-[2px] border border-omp-border bg-[#09090b] overflow-hidden shadow-xl">
      <div className="flex items-center justify-between px-3 py-1.5 bg-omp-surface border-b border-omp-border text-[10px] font-mono select-none">
        <div className="flex items-center space-x-2">
          <span className="font-bold text-amber-400 font-mono">SVG // VEKTÖR GRAFİK</span>
        </div>
        <div className="flex items-center space-x-1.5">
          <button
            type="button"
            onClick={() => setViewMode(viewMode === 'visual' ? 'code' : 'visual')}
            className="px-2 py-0.5 rounded-[2px] border border-omp-border hover:bg-omp-surfaceLight text-zinc-300 hover:text-white transition"
          >
            {viewMode === 'visual' ? 'KOD' : 'GÖRSEL'}
          </button>
          <button
            type="button"
            onClick={downloadSvg}
            className="px-2 py-0.5 rounded-[2px] border border-omp-border hover:bg-omp-surfaceLight text-zinc-300 hover:text-white transition flex items-center space-x-1"
            title="SVG Dosyası Olarak İndir"
          >
            <Rune name="file-download" size={11} />
            <span>İNDİR</span>
          </button>
          <button
            type="button"
            onClick={() => {
              navigator.clipboard.writeText(cleanSvg);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            }}
            className="px-2 py-0.5 rounded-[2px] border border-omp-border hover:bg-omp-surfaceLight text-zinc-300 hover:text-white transition flex items-center space-x-1"
          >
            {copied ? (
              <>
                <Rune name="indicators-check" size={11} className="text-omp-success" />
                <span className="text-omp-success font-semibold">KOPYALANDI</span>
              </>
            ) : (
              <>
                <Rune name="code-copy" size={11} />
                <span>KOPYALA</span>
              </>
            )}
          </button>
        </div>
      </div>

      {viewMode === 'visual' && isValidSvg ? (
        <div
          className="p-6 flex items-center justify-center overflow-x-auto bg-[#0a0a0d] border-b border-omp-border/30 [&_svg]:max-w-full [&_svg]:h-auto shadow-inner"
          dangerouslySetInnerHTML={{ __html: cleanSvg }}
        />
      ) : (
        <pre className="p-3 text-[12px] font-mono text-zinc-200 overflow-x-auto leading-relaxed whitespace-pre select-text bg-[#09090b]">
          <code>{cleanSvg}</code>
        </pre>
      )}
    </div>
  );
};

/**
 * Lightbox Modal for enlarged image viewing
 */
const ImageModal: React.FC<{ src: string; alt: string; onClose: () => void }> = ({ src, alt, onClose }) => {
  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 select-none animate-fadeIn cursor-zoom-out"
    >
      <div className="relative max-w-5xl max-h-[90vh] flex flex-col items-center">
        <img
          src={src}
          alt={alt}
          className="max-w-full max-h-[80vh] object-contain rounded-[2px] border border-omp-border shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        />
        {alt && (
          <div className="mt-3 px-3 py-1 bg-omp-surface/90 border border-omp-border rounded-[2px] text-xs font-mono text-zinc-300 max-w-lg text-center truncate">
            {alt}
          </div>
        )}
        <button
          type="button"
          onClick={onClose}
          className="absolute -top-3 -right-3 w-7 h-7 bg-omp-surfaceElevated border border-omp-border rounded-full flex items-center justify-center text-white hover:text-omp-accent shadow-lg transition"
        >
          ✕
        </button>
      </div>
    </div>
  );
};

/**
 * Horizontal Timeline / Gantt Chart rendered underneath schedule tables
 */
const TimelineChart: React.FC<{ items: TimelineItem[] }> = ({ items }) => {
  if (items.length === 0) return null;

  const minTime = Math.min(...items.map((i) => i.start));
  const rawMax = Math.max(...items.map((i) => i.end));
  // Round max time up to next multiple of 5 or 10
  const maxTime = rawMax <= 10 ? Math.ceil(rawMax) : Math.ceil(rawMax / 5) * 5;
  const totalDuration = maxTime - minTime || 1;

  // Generate tick steps (e.g. 0s, 10s, 20s, 30s)
  const step = maxTime <= 10 ? 2 : maxTime <= 30 ? 10 : maxTime <= 60 ? 15 : 20;
  const ticks: number[] = [];
  for (let t = 0; t <= maxTime; t += step) {
    ticks.push(t);
  }
  if (!ticks.includes(maxTime)) {
    ticks.push(maxTime);
  }

  return (
    <div className="mt-3 pt-3 border-t border-omp-border/60 bg-[#060608] p-3 rounded-[2px] font-mono select-none">
      <div className="text-[10px] font-bold text-omp-muted uppercase tracking-wider mb-2.5 flex items-center space-x-1.5">
        <Rune name="schedule-calendar" size={11} className="text-cyan-400" />
        <span className="text-zinc-300">ZAMAN ÇİZELGESİ // AKIŞ DİYAGRAMI</span>
      </div>

      <div className="space-y-2">
        {items.map((item, idx) => {
          const leftPercent = ((item.start - minTime) / totalDuration) * 100;
          const widthPercent = Math.max(((item.end - item.start) / totalDuration) * 100, 4);

          return (
            <div key={idx} className="flex items-center text-xs group">
              {/* Row Label */}
              <div
                className="w-44 shrink-0 text-[11px] text-zinc-300 font-mono truncate pr-2 group-hover:text-white transition"
                title={item.label}
              >
                {item.label}
              </div>

              {/* Bar Track */}
              <div className="flex-1 h-6 relative bg-zinc-950/50 rounded-[2px] border border-zinc-900/80 flex items-center">
                {/* Horizontal Bar */}
                <div
                  style={{
                    left: `${leftPercent}%`,
                    width: `${widthPercent}%`,
                  }}
                  className="absolute h-5 bg-[#00b4d8] hover:bg-[#38bdf8] text-black font-mono font-bold text-[10px] rounded-[2px] flex items-center justify-center px-1.5 shadow-sm transition-all duration-150 overflow-hidden"
                  title={`${item.label}: ${item.rangeText}`}
                >
                  <span className="truncate">{item.rangeText}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* X-Axis Ticks */}
      <div className="flex items-center mt-2.5 pt-1.5 border-t border-zinc-800 text-[9px] text-zinc-500 font-mono pl-44">
        <div className="flex-1 relative h-4">
          {ticks.map((tick) => {
            const pos = ((tick - minTime) / totalDuration) * 100;
            return (
              <span
                key={tick}
                style={{ left: `${pos}%` }}
                className="absolute -translate-x-1/2 flex flex-col items-center"
              >
                <span className="w-0.5 h-1 bg-zinc-700 mb-0.5" />
                <span>{tick}s</span>
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
};

/**
 * Swiss Style Markdown Table with automatic Timeline Chart detection
 */
const TableBlock: React.FC<{ headers: string[]; rows: string[][]; alignments: ('left' | 'center' | 'right')[] }> = ({
  headers,
  rows,
  alignments,
}) => {
  // Check if any column contains time ranges
  let timeColIdx = -1;
  let labelColIdx = -1;
  const timelineItems: TimelineItem[] = [];

  // Check columns for time range pattern
  if (rows.length >= 2) {
    for (let c = 0; c < headers.length; c++) {
      let matches = 0;
      for (const r of rows) {
        if (r[c] && parseTimeRange(r[c])) {
          matches++;
        }
      }
      if (matches >= Math.min(2, rows.length)) {
        timeColIdx = c;
        break;
      }
    }

    if (timeColIdx !== -1) {
      // Find label column (first column that is not timeColIdx)
      labelColIdx = timeColIdx === 0 ? 1 : 0;
      if (labelColIdx >= headers.length) labelColIdx = 0;

      rows.forEach((r) => {
        const timeCell = r[timeColIdx];
        const labelCell = r[labelColIdx] || `Adım ${timelineItems.length + 1}`;
        if (timeCell) {
          const parsed = parseTimeRange(timeCell);
          if (parsed) {
            timelineItems.push({
              label: labelCell.replace(/^[#\*\s]+|[#\*\s]+$/g, '').trim(),
              start: parsed.start,
              end: parsed.end,
              rangeText: parsed.rangeText,
            });
          }
        }
      });
    }
  }

  return (
    <div className="my-4 rounded-[2px] border border-omp-border bg-[#09090b] overflow-hidden shadow-xl font-mono text-xs">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-omp-surface border-b border-omp-border text-white text-[11px] font-bold tracking-wide select-none">
              {headers.map((h, i) => (
                <th
                  key={i}
                  className={`px-3.5 py-2.5 border-r border-omp-border/40 last:border-r-0 ${
                    alignments[i] === 'center' ? 'text-center' : alignments[i] === 'right' ? 'text-right' : 'text-left'
                  }`}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-omp-border/30">
            {rows.map((row, rIdx) => (
              <tr key={rIdx} className="hover:bg-omp-surface/40 transition-colors">
                {row.map((cell, cIdx) => (
                  <td
                    key={cIdx}
                    className={`px-3.5 py-2.5 text-zinc-200 border-r border-omp-border/30 last:border-r-0 select-text leading-relaxed font-sans text-xs ${
                      alignments[cIdx] === 'center'
                        ? 'text-center'
                        : alignments[cIdx] === 'right'
                        ? 'text-right'
                        : 'text-left'
                    } ${cIdx === timeColIdx ? 'font-mono font-semibold text-cyan-300' : ''}`}
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* If time ranges detected, render Timeline / Gantt Chart underneath! */}
      {timelineItems.length >= 2 && <TimelineChart items={timelineItems} />}
    </div>
  );
};

/**
 * Main Markdown Renderer Component
 */
export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content, msgId }) => {
  const [modalImage, setModalImage] = useState<{ src: string; alt: string } | null>(null);

  // Parse text into structured blocks: code blocks, tables, images, and text
  const blocks: React.ReactNode[] = [];

  // Match code blocks: ```lang ... ```
  const codeRegex = /```([a-zA-Z0-9_-]*)\n?([\s\S]*?)```/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = codeRegex.exec(content)) !== null) {
    const textBefore = content.slice(lastIndex, match.index);
    if (textBefore) {
      blocks.push(renderTextAndTables(textBefore, `${msgId}-pre-${lastIndex}`, setModalImage));
    }

    const lang = (match[1] || 'text').toLowerCase();
    const code = match[2];
    const blockKey = `${msgId}-code-${match.index}`;

    if (lang === 'svg' || (lang === '' && code.trim().startsWith('<svg') && code.trim().endsWith('</svg>'))) {
      blocks.push(<SvgBlock key={blockKey} code={code} blockKey={blockKey} />);
    } else if (lang === 'mermaid') {
      blocks.push(<MermaidBlock key={blockKey} code={code} blockKey={blockKey} />);
    } else {
      blocks.push(<DefaultCodeBlock key={blockKey} code={code} lang={lang.toUpperCase()} blockKey={blockKey} />);
    }

    lastIndex = match.index + match[0].length;
  }

  const remaining = content.slice(lastIndex);
  if (remaining) {
    blocks.push(renderTextAndTables(remaining, `${msgId}-post-${lastIndex}`, setModalImage));
  }

  return (
    <>
      <div className="space-y-1 text-zinc-100">{blocks}</div>
      {modalImage && <ImageModal src={modalImage.src} alt={modalImage.alt} onClose={() => setModalImage(null)} />}
    </>
  );
};

/**
 * Default Code Block with Copy Button
 */
const DefaultCodeBlock: React.FC<{ code: string; lang: string; blockKey: string }> = ({ code, lang, blockKey }) => {
  const [copied, setCopied] = useState(false);

  return (
    <div className="my-2.5 rounded-[2px] border border-omp-border bg-[#09090b] overflow-hidden shadow-lg">
      <div className="flex items-center justify-between px-3 py-1 bg-omp-surface border-b border-omp-border text-[10px] font-mono text-omp-muted select-none">
        <span className="font-bold tracking-wider text-zinc-300">{lang}</span>
        <button
          type="button"
          onClick={() => {
            navigator.clipboard.writeText(code);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          }}
          className="flex items-center space-x-1 hover:text-white transition px-1.5 py-0.5 rounded-[2px] hover:bg-omp-surfaceLight font-mono text-[10px]"
          title="Kodu Kopyala"
        >
          {copied ? (
            <>
              <Rune name="indicators-check" size={11} className="text-omp-success" />
              <span className="text-omp-success font-semibold">KOPYALANDI</span>
            </>
          ) : (
            <>
              <Rune name="code-copy" size={11} />
              <span>KOPYALA</span>
            </>
          )}
        </button>
      </div>
      <pre className="p-3 text-[12px] font-mono text-zinc-200 overflow-x-auto leading-relaxed whitespace-pre select-text">
        <code>{code}</code>
      </pre>
    </div>
  );
};

/**
 * Splits plain text into paragraphs, markdown tables, and images
 */
function renderTextAndTables(
  text: string,
  keyPrefix: string,
  onOpenImage: (img: { src: string; alt: string }) => void
): React.ReactNode {
  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];
  let currentTableLines: string[] = [];

  const flushTable = (tKey: string) => {
    if (currentTableLines.length >= 2) {
      const headerLine = currentTableLines[0];
      const sepLine = currentTableLines[1];
      const dataLines = currentTableLines.slice(2);

      const headers = headerLine
        .split('|')
        .slice(1, -1)
        .map((h) => h.trim());
      const sepCells = sepLine
        .split('|')
        .slice(1, -1)
        .map((s) => s.trim());

      const alignments = sepCells.map((s) => {
        if (s.startsWith(':') && s.endsWith(':')) return 'center';
        if (s.endsWith(':')) return 'right';
        return 'left';
      });

      const rows = dataLines
        .filter((l) => l.trim().startsWith('|'))
        .map((line) => {
          const cells = line
            .split('|')
            .slice(1, -1)
            .map((c) => c.trim());
          // Pad row if it has fewer cells than headers
          while (cells.length < headers.length) {
            cells.push('');
          }
          return cells;
        });

      if (headers.length > 0 && rows.length > 0) {
        elements.push(
          <TableBlock
            key={`tbl-${tKey}`}
            headers={headers}
            rows={rows}
            alignments={alignments as ('left' | 'center' | 'right')[]}
          />
        );
      }
    }
    currentTableLines = [];
  };

  let textBuffer: string[] = [];
  const flushText = (txtKey: string) => {
    if (textBuffer.length > 0) {
      const chunk = textBuffer.join('\n');
      elements.push(renderFormattedParagraphs(chunk, `txt-${txtKey}`, onOpenImage));
      textBuffer = [];
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const isTableRow = line.trim().startsWith('|') && line.trim().endsWith('|');

    if (isTableRow) {
      flushText(`${keyPrefix}-pretab-${i}`);
      currentTableLines.push(line);
    } else {
      if (currentTableLines.length > 0) {
        flushTable(`${keyPrefix}-tab-${i}`);
      }
      textBuffer.push(line);
    }
  }

  if (currentTableLines.length > 0) {
    flushTable(`${keyPrefix}-tab-end`);
  }
  flushText(`${keyPrefix}-txt-end`);

  return <React.Fragment key={keyPrefix}>{elements}</React.Fragment>;
}

/**
 * Formats Markdown Headings, Images, Lists, and Inline Styles
 */
function renderFormattedParagraphs(
  rawText: string,
  keyPrefix: string,
  onOpenImage: (img: { src: string; alt: string }) => void
): React.ReactNode {
  const paragraphs = rawText.split(/\n\n+/);

  return (
    <div key={keyPrefix} className="space-y-2">
      {paragraphs.map((p, pIdx) => {
        const trimmed = p.trim();
        if (!trimmed) return null;

        // Check for Image syntax: ![alt](url)
        const imgMatch = trimmed.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
        if (imgMatch) {
          const alt = imgMatch[1];
          const src = imgMatch[2];
          return (
            <div key={`${keyPrefix}-p-${pIdx}`} className="my-3">
              <div
                onClick={() => onOpenImage({ src, alt })}
                className="inline-block max-w-md rounded-[2px] border border-omp-border bg-[#09090b] p-1.5 cursor-zoom-in group shadow-lg transition hover:border-omp-accent"
              >
                <img
                  src={src}
                  alt={alt}
                  className="max-h-80 w-auto rounded-[2px] object-cover group-hover:scale-[1.01] transition-transform"
                />
                {alt && (
                  <div className="mt-1.5 px-1 text-[11px] font-mono text-omp-muted truncate">{alt}</div>
                )}
              </div>
            </div>
          );
        }

        // Headings: ###, ##, #
        if (trimmed.startsWith('### ')) {
          return (
            <h3 key={`${keyPrefix}-p-${pIdx}`} className="text-sm font-bold text-white mt-3 mb-1 font-sans flex items-center space-x-1.5">
              <span>{trimmed.slice(4)}</span>
            </h3>
          );
        }
        if (trimmed.startsWith('## ')) {
          return (
            <h2 key={`${keyPrefix}-p-${pIdx}`} className="text-base font-bold text-white mt-3.5 mb-1.5 font-sans border-b border-omp-border/40 pb-1">
              <span>{trimmed.slice(3)}</span>
            </h2>
          );
        }
        if (trimmed.startsWith('# ')) {
          return (
            <h1 key={`${keyPrefix}-p-${pIdx}`} className="text-lg font-bold text-white mt-4 mb-2 font-sans border-b border-omp-border/60 pb-1.5">
              <span>{trimmed.slice(2)}</span>
            </h1>
          );
        }

        // Standard text paragraph with inline formatting
        return (
          <p key={`${keyPrefix}-p-${pIdx}`} className="whitespace-pre-wrap font-sans text-sm text-zinc-100 leading-relaxed select-text">
            {renderInlineMarkdown(p)}
          </p>
        );
      })}
    </div>
  );
}

/**
 * Parses bold (**text**), inline code (`code`), and links
 */
function renderInlineMarkdown(text: string): React.ReactNode {
  // Regex matching `code`, **bold**, *italic*, or [link](url)
  const inlineRegex = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*|\[[^\]]+\]\([^)]+\))/g;
  const parts: React.ReactNode[] = [];
  let lastIdx = 0;
  let match: RegExpExecArray | null;

  while ((match = inlineRegex.exec(text)) !== null) {
    if (match.index > lastIdx) {
      parts.push(text.slice(lastIdx, match.index));
    }

    const token = match[0];
    if (token.startsWith('`') && token.endsWith('`')) {
      parts.push(
        <code
          key={`inline-${match.index}`}
          className="px-1.5 py-0.5 rounded-[2px] bg-omp-surfaceElevated border border-omp-border/70 text-cyan-300 font-mono text-[11px]"
        >
          {token.slice(1, -1)}
        </code>
      );
    } else if (token.startsWith('**') && token.endsWith('**')) {
      parts.push(
        <strong key={`bold-${match.index}`} className="font-bold text-white">
          {token.slice(2, -2)}
        </strong>
      );
    } else if (token.startsWith('*') && token.endsWith('*')) {
      parts.push(
        <em key={`italic-${match.index}`} className="italic text-zinc-300">
          {token.slice(1, -1)}
        </em>
      );
    } else if (token.startsWith('[') && token.includes('](')) {
      const linkMatch = token.match(/\[([^\]]+)\]\(([^)]+)\)/);
      if (linkMatch) {
        parts.push(
          <a
            key={`link-${match.index}`}
            href={linkMatch[2]}
            target="_blank"
            rel="noopener noreferrer"
            className="text-cyan-400 hover:text-cyan-300 underline underline-offset-2 transition"
          >
            {linkMatch[1]}
          </a>
        );
      }
    }

    lastIdx = match.index + token.length;
  }

  if (lastIdx < text.length) {
    parts.push(text.slice(lastIdx));
  }

  return parts.length > 0 ? parts : text;
}
