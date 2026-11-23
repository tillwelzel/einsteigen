import { useState } from 'react';
import { Check, Share2, Shuffle, TramFront, X } from 'lucide-react';
import type { Translations } from '../i18n';
import type {
  DailyProgress,
  MunichNetwork,
  NetworkMode,
  RoundGrade,
} from '../types';
import { LineBadge } from './LineBadge';

interface DailySummaryModalProps {
  open: boolean;
  onClose: () => void;
  t: Translations;
  network: MunichNetwork;
  progress: DailyProgress;
  networkMode: NetworkMode;
  onPlayFreePlay: () => void;
  onSwitchNetworkMode: (mode: NetworkMode) => void;
}

const GRADE_EMOJI: Record<RoundGrade, string> = {
  optimal: '🟩',
  great: '🟦',
  good: '🟨',
  valid: '⬜',
  skipped: '🟥',
};

function buildShareText(
  progress: DailyProgress,
  networkMode: NetworkMode,
): string {
  const modeTag = networkMode === 'ust' ? 'U+S+Tram' : 'U+S';
  const grid = progress.rounds.map((r) => GRADE_EMOJI[r.grade]).join('');
  const optimalCount = progress.rounds.filter((r) => r.grade === 'optimal').length;
  const lines = [
    `🚇 Einsteigen München · ${progress.dateKey} (${modeTag})`,
    `${grid}  ${optimalCount}/${progress.rounds.length} Optimal`,
  ];
  return lines.join('\n');
}

export function DailySummaryModal({
  open,
  onClose,
  t,
  network,
  progress,
  networkMode,
  onPlayFreePlay,
  onSwitchNetworkMode,
}: DailySummaryModalProps) {
  const [copied, setCopied] = useState(false);

  if (!open) return null;

  const handleShare = async () => {
    const text = buildShareText(progress, networkMode);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-100 dark:border-zinc-800">
          <div>
            <h2 className="font-display font-extrabold text-lg text-zinc-900 dark:text-white">
              {t.dailyTitle(progress.dateKey)}
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              {t.dailySubtitle}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
            aria-label={t.close}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Emoji strip */}
          <div className="flex items-center justify-center gap-2 text-2xl py-1">
            {progress.rounds.map((r, i) => (
              <span key={i} title={t.gradeLabel[r.grade]}>
                {GRADE_EMOJI[r.grade]}
              </span>
            ))}
          </div>

          {/* Per-round breakdown */}
          <div className="space-y-2">
            {progress.rounds.map((r, i) => {
              const fromName = network.stations[r.fromStationId]?.name ?? r.fromStationId;
              const toName = network.stations[r.toStationId]?.name ?? r.toStationId;
              const deltaMin =
                r.deltaSec !== null ? Math.round(r.deltaSec / 60) : null;
              const shownLines = r.playerRoute?.lineIds ?? r.optimalRoute.lineIds;

              return (
                <div
                  key={r.puzzleId}
                  className="flex items-center justify-between gap-2 rounded-xl bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200/80 dark:border-zinc-800 px-3 py-2 text-xs"
                >
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                      {i + 1}. {fromName} → {toName}
                    </div>
                    <div className="flex items-center gap-1 mt-1">
                      {shownLines.map((id, idx) => (
                        <LineBadge
                          key={`${id}-${idx}`}
                          lineId={id}
                          mode={network.lines[id]?.mode}
                          size="xs"
                        />
                      ))}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-bold text-zinc-700 dark:text-zinc-200">
                      {t.gradeLabel[r.grade]}
                    </div>
                    <div className="text-[11px] text-zinc-400">
                      {deltaMin === null
                        ? '—'
                        : deltaMin <= 0
                          ? '±0m'
                          : `+${deltaMin}m`}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Share & Next actions */}
          <div className="space-y-2 pt-1">
            <button
              type="button"
              onClick={handleShare}
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm py-2.5 px-4 transition-colors cursor-pointer"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4" />
                  {t.copied}
                </>
              ) : (
                <>
                  <Share2 className="w-4 h-4" />
                  {t.shareResults}
                </>
              )}
            </button>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onPlayFreePlay();
                }}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 font-semibold text-xs py-2.5 px-3 transition-colors cursor-pointer"
              >
                <Shuffle className="w-3.5 h-3.5" />
                {t.freePlay}
              </button>

              <button
                type="button"
                onClick={() => {
                  onClose();
                  onSwitchNetworkMode(networkMode === 'us' ? 'ust' : 'us');
                }}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 font-semibold text-xs py-2.5 px-3 transition-colors cursor-pointer"
              >
                <TramFront className="w-3.5 h-3.5" />
                {networkMode === 'us' ? t.modeUST : t.modeUS}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
