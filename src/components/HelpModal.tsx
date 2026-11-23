import { X } from 'lucide-react';
import type { Translations } from '../i18n';
import { LineBadge } from './LineBadge';

interface HelpModalProps {
  open: boolean;
  onClose: () => void;
  t: Translations;
  feedVersion: string;
}

export function HelpModal({ open, onClose, t, feedVersion }: HelpModalProps) {
  if (!open) return null;

  return (
    <div
      className="animate-backdrop-in fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-xs p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="animate-modal-in w-full sm:max-w-md max-h-[88dvh] sm:max-h-[85dvh] flex flex-col rounded-t-3xl sm:rounded-2xl bg-white dark:bg-zinc-900 border-t border-x sm:border border-zinc-200 dark:border-zinc-800 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3.5 sm:px-5 sm:py-4 border-b border-zinc-100 dark:border-zinc-800">
          <h2 className="font-display font-extrabold text-lg text-zinc-900 dark:text-white">
            {t.helpTitle}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
            aria-label={t.close}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="overflow-y-auto p-4 safe-bottom sm:p-5 space-y-3.5 sm:space-y-4 text-sm text-zinc-600 dark:text-zinc-300">
          <p className="font-medium text-zinc-800 dark:text-zinc-100">
            {t.helpIntro}
          </p>

          <ol className="space-y-2 list-decimal list-inside text-xs leading-relaxed">
            {t.helpRules.map((rule, i) => (
              <li key={i}>{rule}</li>
            ))}
          </ol>

          <div className="flex items-center gap-2 py-1">
            <LineBadge lineId="U3" mode="ubahn" size="sm" />
            <span className="text-zinc-400">→</span>
            <LineBadge lineId="S8" mode="sbahn" size="sm" />
            <span className="text-zinc-400">→</span>
            <LineBadge lineId="19" mode="tram" size="sm" />
          </div>

          <div className="space-y-1">
            <h3 className="font-display font-bold text-xs uppercase tracking-wider text-zinc-900 dark:text-white">
              {t.helpModesTitle}
            </h3>
            <p className="text-xs leading-relaxed">{t.helpModesBody}</p>
          </div>

          <div className="space-y-1">
            <h3 className="font-display font-bold text-xs uppercase tracking-wider text-zinc-900 dark:text-white">
              {t.helpScoringTitle}
            </h3>
            <p className="text-xs leading-relaxed">{t.helpScoringBody}</p>
          </div>

          <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800 text-[11px] text-zinc-400 leading-relaxed">
            {t.helpAttribution} (Feed {feedVersion})
          </div>
        </div>
      </div>
    </div>
  );
}
