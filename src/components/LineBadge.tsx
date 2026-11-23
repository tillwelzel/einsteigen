import { getLineVisual } from '../data/mvg-colors';
import type { TransitMode } from '../types';

interface LineBadgeProps {
  lineId: string;
  mode?: TransitMode;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  interactive?: boolean;
  selected?: boolean;
  onClick?: () => void;
  title?: string;
  className?: string;
}

function inferMode(lineId: string): TransitMode {
  if (lineId.startsWith('U')) return 'ubahn';
  if (lineId.startsWith('S')) return 'sbahn';
  return 'tram';
}

export function LineBadge({
  lineId,
  mode,
  size = 'md',
  interactive = false,
  selected = false,
  onClick,
  title,
  className = '',
}: LineBadgeProps) {
  const resolvedMode = mode ?? inferMode(lineId);
  const { color, textColor } = getLineVisual(lineId, resolvedMode);

  const shapeClass =
    resolvedMode === 'sbahn'
      ? 'rounded-full'
      : resolvedMode === 'ubahn'
        ? 'rounded-md'
        : 'rounded-sm border border-black/15 dark:border-white/15';

  const sizeClass =
    size === 'xs'
      ? 'h-5 min-w-7 px-1.5 text-[11px]'
      : size === 'sm'
        ? 'h-6 min-w-9 px-2 text-xs'
        : size === 'lg'
          ? 'h-9 min-w-12 px-3 text-sm'
          : 'h-8 min-w-11 px-2.5 text-xs';

  const baseClass = [
    'inline-flex items-center justify-center font-bold tracking-tight select-none shrink-0 shadow-xs transition-all duration-150',
    shapeClass,
    sizeClass,
    interactive
      ? 'cursor-pointer hover:brightness-110 active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500'
      : '',
    selected
      ? 'ring-2 ring-zinc-900 dark:ring-white ring-offset-2 ring-offset-white dark:ring-offset-zinc-900'
      : '',
    className,
  ].join(' ');

  if (interactive) {
    return (
      <button
        type="button"
        onClick={onClick}
        title={title}
        style={{ backgroundColor: color, color: textColor }}
        className={baseClass}
      >
        {lineId}
      </button>
    );
  }

  return (
    <span
      title={title}
      style={{ backgroundColor: color, color: textColor }}
      className={baseClass}
    >
      {lineId}
    </span>
  );
}
