import React, { useRef, useEffect, useCallback } from 'react';

interface BadgePromptInputProps {
  value: string;
  onChange: (value: string) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLDivElement>) => void;
  onPaste: (e: React.ClipboardEvent<HTMLDivElement>) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

const BADGE_PALETTES = [
  { border: 'border-amber-400/70', text: 'text-amber-300', bg: 'bg-amber-400/20' },
  { border: 'border-cyan-400/70', text: 'text-cyan-300', bg: 'bg-cyan-400/20' },
  { border: 'border-emerald-400/70', text: 'text-emerald-300', bg: 'bg-emerald-400/20' },
  { border: 'border-purple-400/70', text: 'text-purple-300', bg: 'bg-purple-400/20' },
  { border: 'border-rose-400/70', text: 'text-rose-300', bg: 'bg-rose-400/20' },
];

// Regex matching image tokens [#N], bracketed commands [/cmd], or leading slash commands
const TOKEN_SPLIT_REGEX = /(\[#\d+\]|\[\/(?:[a-zA-Z0-9_:-]+)\]|^\/(?:skill:[a-zA-Z0-9_-]+|(?:compact|clear|new|model|usage|stats|advisor|resume|skills|settings|devtools|help|changelog|loop|btw)(?::[a-zA-Z0-9_-]+)?)(?:\s|$))/;

/**
 * Extracts plain text from the contentEditable element, serializing
 * atomic image badge elements back to [#N] and command badges back to /command.
 */
function extractSerializedText(container: HTMLElement): string {
  let result = '';
  container.childNodes.forEach((node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      let text = node.textContent || '';
      // Avoid duplicate leading space after a command badge
      if (result.endsWith(' ') && text.startsWith(' ')) {
        text = text.trimStart();
      }
      result += text;
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement;
      if (el.dataset.badge) {
        result += `[${el.dataset.badge}]`;
      } else if (el.dataset.command) {
        if (result && !result.endsWith(' ') && !result.endsWith('\n')) {
          result += ' ';
        }
        result += `${el.dataset.command} `;
      } else if (el.tagName === 'BR') {
        result += '\n';
      } else if (el.tagName === 'DIV' || el.tagName === 'P') {
        result += '\n' + extractSerializedText(el);
      } else {
        result += extractSerializedText(el);
      }
    }
  });
  return result;
}

/**
 * Creates an atomic non-editable badge DOM element for #N image tokens
 */
function createImageBadgeElement(badgeId: string): HTMLSpanElement {
  const span = document.createElement('span');
  span.contentEditable = 'false';
  span.dataset.badge = badgeId; // e.g. "#1"

  const num = parseInt(badgeId.replace(/\D/g, ''), 10) || 1;
  const palette = BADGE_PALETTES[(num - 1) % BADGE_PALETTES.length];

  span.className = `inline-flex items-center space-x-1 px-1.5 py-0.5 rounded-[2px] text-xs font-mono font-bold border ${palette.border} ${palette.bg} ${palette.text} select-none mx-1 align-baseline cursor-default shadow-sm`;
  span.innerHTML = `<span class="opacity-90">📷</span><span>${badgeId}</span>`;
  return span;
}

/**
 * Creates an atomic non-editable command badge element (e.g. /skill:brand-voice)
 */
function createCommandBadgeElement(commandText: string, onRemove?: () => void): HTMLSpanElement {
  const span = document.createElement('span');
  span.contentEditable = 'false';
  const cleanCmd = commandText.replace(/^[\[\s]+|[\]\s]+$/g, '').trim();
  span.dataset.command = cleanCmd; // e.g. "/skill:brand-voice"

  const isSkill = cleanCmd.startsWith('/skill:');
  const palette = isSkill
    ? { border: 'border-cyan-400/60', text: 'text-cyan-300', bg: 'bg-cyan-950/70', glyph: '✦' }
    : cleanCmd.startsWith('/advisor')
    ? { border: 'border-rose-400/60', text: 'text-rose-300', bg: 'bg-rose-950/70', glyph: '👁' }
    : cleanCmd.startsWith('/compact')
    ? { border: 'border-purple-400/60', text: 'text-purple-300', bg: 'bg-purple-950/70', glyph: '⚡' }
    : cleanCmd.startsWith('/model')
    ? { border: 'border-blue-400/60', text: 'text-blue-300', bg: 'bg-blue-950/70', glyph: '⬡' }
    : cleanCmd.startsWith('/usage') || cleanCmd.startsWith('/stats')
    ? { border: 'border-amber-400/60', text: 'text-amber-300', bg: 'bg-amber-950/70', glyph: '⚡' }
    : { border: 'border-omp-accent/60', text: 'text-white', bg: 'bg-omp-accent/20', glyph: '/' };

  span.className = `inline-flex items-center space-x-1 px-2 py-0.5 rounded-[2px] text-xs font-mono font-bold border ${palette.border} ${palette.bg} ${palette.text} select-none mr-1.5 align-baseline cursor-default shadow-sm`;

  const glyphSpan = document.createElement('span');
  glyphSpan.className = 'opacity-80 text-[11px]';
  glyphSpan.textContent = palette.glyph;
  span.appendChild(glyphSpan);

  const textSpan = document.createElement('span');
  textSpan.textContent = cleanCmd;
  span.appendChild(textSpan);

  const removeBtn = document.createElement('span');
  removeBtn.className = 'ml-1 opacity-60 hover:opacity-100 hover:text-red-400 cursor-pointer font-sans text-[11px] leading-none transition';
  removeBtn.title = 'Komutu kaldır';
  removeBtn.textContent = '✕';
  removeBtn.onmousedown = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (onRemove) onRemove();
  };
  span.appendChild(removeBtn);

  return span;
}

/**
 * Sets caret to the very end of the contentEditable element
 */
function setCaretToEnd(el: HTMLElement) {
  const range = document.createRange();
  const sel = window.getSelection();
  range.selectNodeContents(el);
  range.collapse(false);
  if (sel) {
    sel.removeAllRanges();
    sel.addRange(range);
  }
}

export const BadgePromptInput: React.FC<BadgePromptInputProps> = ({
  value,
  onChange,
  onKeyDown,
  onPaste,
  placeholder = 'Mesajınızı yazın veya ekran görüntüsü / dosya yapıştırın (Ctrl+V)...',
  className = '',
  disabled = false,
}) => {
  const editorRef = useRef<HTMLDivElement | null>(null);
  const isInternalChangeRef = useRef(false);

  // Sync external value to DOM only when value changes outside user direct typing
  useEffect(() => {
    const el = editorRef.current;
    if (!el) return;

    if (isInternalChangeRef.current) {
      isInternalChangeRef.current = false;
      return;
    }

    const currentText = extractSerializedText(el).trim();
    if (currentText === value.trim()) {
      return;
    }

    // Reconstruct DOM with text and badge nodes
    el.innerHTML = '';
    if (!value) {
      return;
    }

    // Split value by image tokens [#N] or command tokens
    const parts = value.split(TOKEN_SPLIT_REGEX);
    parts.forEach((part) => {
      if (!part) return;

      const imageMatch = part.match(/^\[(#[0-9]+)\]$/);
      const isCommand = part.match(/^\[?\/(?:skill:[a-zA-Z0-9_-]+|(?:compact|clear|new|model|usage|stats|advisor|resume|skills|settings|devtools|help|changelog|loop|btw)(?::[a-zA-Z0-9_-]+)?)\]?(?:\s|$)/);

      if (imageMatch) {
        const badge = createImageBadgeElement(imageMatch[1]);
        el.appendChild(badge);
        el.appendChild(document.createTextNode('\u00A0'));
      } else if (isCommand) {
        const cleanCmd = part.replace(/^[\[\s]+|[\]\s]+$/g, '').trim();
        const badge = createCommandBadgeElement(cleanCmd, () => {
          // Remove command token from value and update
          const updated = value.replace(part, '').trimStart();
          onChange(updated);
        });
        el.appendChild(badge);
        el.appendChild(document.createTextNode('\u00A0'));
      } else {
        el.appendChild(document.createTextNode(part));
      }
    });

    setCaretToEnd(el);
  }, [value, onChange]);

  const handleInput = useCallback(() => {
    const el = editorRef.current;
    if (!el) return;

    isInternalChangeRef.current = true;
    const serialized = extractSerializedText(el);
    onChange(serialized);
  }, [onChange]);

  const handleKeyDownInternal = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      onKeyDown(e);
    },
    [onKeyDown]
  );

  return (
    <div className="relative w-full">
      <div
        ref={editorRef}
        contentEditable={!disabled}
        suppressContentEditableWarning
        spellCheck={false}
        autoCorrect="off"
        autoCapitalize="off"
        data-gramm="false"
        data-gramm_editor="false"
        data-enable-grammarly="false"
        onInput={handleInput}
        onKeyDown={handleKeyDownInternal}
        onPaste={onPaste}
        data-placeholder={placeholder}
        className={`w-full bg-transparent text-sm text-white focus:outline-none placeholder-omp-muted font-sans min-h-[44px] max-h-[33vh] overflow-y-auto whitespace-pre-wrap break-words empty:before:content-[attr(data-placeholder)] empty:before:text-omp-muted empty:before:pointer-events-none empty:before:block ${className}`}
        style={{ wordBreak: 'break-word' }}
      />
    </div>
  );
};
