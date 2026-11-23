import { Flame, Sparkles, Trophy, X } from 'lucide-react';
import type { Translations } from '../i18n';
import type { PlayerStats } from '../types';

interface StatsModalProps {
  open: boolean;
  onClose: () => void;
  t: Translations;
  stats: PlayerStats;
}

export function StatsModal({ open, onClose, t, stats }: StatsModalProps) {
  if (!open) return null;

  const optimalPct =
    stats.totalRoundsPlayed > 0
      ? Math.round((stats.optimalRounds / stats.totalRoundsPlayed) * 100)
      : 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-100 dark:border-zinc-800">
          <h2 className="font-display font-extrabold text-lg text-zinc-900 dark:text-white">
            {t.statsTitle}
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

        <div className="p-5 grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200/80 dark:border-zinc-800 p-3.5 text-center">
            <Trophy className="w-4 h-4 text-amber-500 mx-auto mb-1" />
            <div className="font-display font-extrabold text-2xl text-zinc-900 dark:text-white">
              {stats.dailyCompleted}
            </div>
            <div className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
              {t.dailyCompleted}
            </div>
          </div>

          <div className="rounded-xl bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200/80 dark:border-zinc-800 p-3.5 text-center">
            <Flame className="w-4 h-4 text-orange-500 mx-auto mb-1" />
            <div className="font-display font-extrabold text-2xl text-zinc-900 dark:text-white">
              {stats.currentStreak}
            </div>
            <div className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
              {t.currentStreak}
            </div>
          </div>

          <div className="rounded-xl bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200/80 dark:border-zinc-800 p-3.5 text-center">
            <div className="font-display font-extrabold text-2xl text-zinc-900 dark:text-white">
              {stats.bestStreak}
            </div>
            <div className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
              {t.bestStreak}
            </div>
          </div>

          <div className="rounded-xl bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200/80 dark:border-zinc-800 p-3.5 text-center">
            <Sparkles className="w-4 h-4 text-emerald-500 mx-auto mb-1" />
            <div className="font-display font-extrabold text-2xl text-zinc-900 dark:text-white">
              {optimalPct}%
            </div>
            <div className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
              {t.optimalRate}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
