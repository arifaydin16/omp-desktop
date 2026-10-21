import React from 'react';
import { getIconById, IconType } from 'runeicons-react';

export interface RuneProps {
  name: string;
  size?: number;
  className?: string;
  type?: IconType;
  style?: React.CSSProperties;
}

// Convenient aliases mapping common action/domain names to official Rune Icon IDs (https://www.runeicons.com/icons)
const RUNE_ALIAS_MAP: Record<string, string> = {
  // Navigation & Controls
  'chevron-down': 'arrows-chevron-down',
  'chevron-up': 'arrows-chevron-up',
  'chevron-left': 'arrows-chevron-left',
  'chevron-right': 'arrows-chevron-right',
  'arrow-down': 'arrows-arrow-down',
  'arrow-up': 'arrows-arrow-up',
  'arrow-left': 'arrows-arrow-left',
  'arrow-right': 'arrows-arrow-right',
  'external-link': 'indicators-square-arrow-out-up-right',
  'link': 'code-link',
  'close': 'indicators-x',
  'x': 'indicators-x',
  'check': 'indicators-check',
  'check-circle': 'indicators-circle-check',
  'alert': 'glass-exclamation-triangle-1',
  'alert-circle': 'glass-exclamation-triangle-1',
  'refresh': 'schedule-refresh-cw',
  'refresh-cw': 'schedule-refresh-cw',
  'copy': 'code-copy',
  'trash': 'tools-trash-2',
  'search': 'tools-search',
  'filter': 'tools-list-filter',

  // System & Developer Tools
  'terminal': 'code-terminal',
  'cli': 'code-terminal',
  'code': 'code-code',
  'branch': 'code-git-branch',
  'git-branch': 'code-git-branch',
  'git-commit': 'code-git-commit-horizontal',
  'server': 'code-server',
  'settings': 'tools-settings',
  'sliders': 'metrics-sliders-horizontal',
  'layers': 'layouts-layers-2',
  'grid': 'layouts-layout-grid',

  // Documents & Media
  'folder': 'documents-folder',
  'folder-open': 'documents-folder-open',
  'file': 'documents-file',
  'file-text': 'documents-file-text',
  'paperclip': 'documents-paperclip',
  'image': 'playback-image',
  'play': 'playback-play',
  'pause': 'playback-pause',
  'stop': 'indicators-square-stop',

  // Communication & Intelligence
  'send': 'messaging-send',
  'message': 'messaging-message-square',
  'message-square': 'messaging-message-square',
  'sparkles': 'tools-sparkles',
  'zap': 'other-zap',
  'clock': 'schedule-clock',
  'history': 'schedule-clock',
  'brain': 'tools-sparkles',
  'cpu': 'code-server',

  // Identity & Security
  'key': 'identity-lock',
  'lock': 'identity-lock',
  'lock-open': 'identity-lock-open',
  'shield': 'identity-shield-check',
  'shield-check': 'identity-shield-check',
  'eye': 'senses-eye',
  'eye-off': 'senses-eye-closed',
  'user': 'identity-user-cog',
  'users': 'identity-users',
  'login': 'identity-log-in',
  'logout': 'identity-log-out',
};

export const Rune: React.FC<RuneProps> = ({
  name,
  size = 16,
  className = '',
  type = 'normal',
  style,
}) => {
  const resolvedId = RUNE_ALIAS_MAP[name] || name;
  const icon = getIconById(resolvedId);
  const variant = icon?.variants[type] || icon?.variants['normal'];

  if (!variant) {
    // Graceful fallback for any missing identifier
    return (
      <span
        style={{ width: size, height: size, ...style }}
        className={`inline-flex items-center justify-center font-mono text-[10px] border border-zinc-700 rounded-[2px] leading-none shrink-0 ${className}`}
      >
        ·
      </span>
    );
  }

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox={variant.viewBox}
      className={`inline-block shrink-0 fill-current ${className}`}
      style={style}
      dangerouslySetInnerHTML={{ __html: variant.markup }}
    />
  );
};
