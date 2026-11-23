import { useRef, useState } from 'react';
import {
  ArrowRight,
  Check,
  ChevronDown,
  MapPin,
  Share2,
  Shuffle,
  TramFront,
  X,
} from 'lucide-react';
import type { Translations } from '../i18n';
import type {
  CompletedRound,
  ComputedRoute,
  DailyProgress,
  MunichNetwork,
  NetworkMode,
  PlayerStats,
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
  stats: PlayerStats;
  onInspectRound: (roundIndex: number) => void;
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

function formatMin(sec: number): number {
  return Math.max(1, Math.round(sec / 60));
}

function isSameLineSequence(a: ComputedRoute, b: ComputedRoute): boolean {
  return a.lineIds.join('|') === b.lineIds.join('|');
}

function gradeColor(grade: RoundGrade): string {
  switch (grade) {
    case 'optimal':
      return 'bg-emerald-500';
    case 'great':
      return 'bg-sky-500';
    case 'good':
      return 'bg-amber-500';
    case 'valid':
      return 'bg-zinc-400 dark:bg-zinc-500';
    case 'skipped':
      return 'bg-rose-500';
  }
}

function computeSummaryStats(rounds: CompletedRound[]) {
  const totalRounds = rounds.length;
  const solvedRounds = rounds.filter((r) => r.playerRoute !== null);
  const solvedCount = solvedRounds.length;
  const optimalCount = rounds.filter((r) => r.grade === 'optimal').length;
  const totalDeltaSec = solvedRounds.reduce(
    (sum, r) => sum + Math.max(0, r.deltaSec ?? 0),
    0,
  );
  const totalDeltaMin = Math.round(totalDeltaSec / 60);

  return { totalRounds, solvedCount, optimalCount, totalDeltaMin };
}

function buildShareText(
  progress: DailyProgress,
  networkMode: NetworkMode,
): string {
  const { totalRounds, solvedCount, optimalCount, totalDeltaMin } =
    computeSummaryStats(progress.rounds);
  const modeTag = networkMode === 'ust' ? 'U+S+Tram' : 'U+S';
  const grid = progress.rounds.map((r) => GRADE_EMOJI[r.grade]).join('');
  const deltaPart =
    solvedCount > 0
      ? totalDeltaMin <= 0
        ? '±0m'
        : `+${totalDeltaMin}m`
      : '—';
  return [
    `Einsteigen München · ${progress.dateKey} (${modeTag})`,
    `${grid}  ${optimalCount}/${totalRounds} Optimal (${deltaPart})`,
  ].join('\n');
}

function LineSequence({
  lineIds,
  network,
}: {
  lineIds: string[];
  network: MunichNetwork;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1 min-w-0">
      {lineIds.map((id, idx) => (
        <div key={`${id}-${idx}`} className="inline-flex items-center gap-1">
          {idx > 0 && (
            <ArrowRight className="w-2.5 h-2.5 text-zinc-400 dark:text-zinc-500 shrink-0" />
          )}
          <LineBadge lineId={id} mode={network.lines[id]?.mode} size="xs" />
        </div>
      ))}
    </div>
  );
}

function LegDetails({
  route,
  network,
  t,
  label,
}: {
  route: ComputedRoute;
  network: MunichNetwork;
  t: Translations;
  label: string;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2 text-[11px] text-zinc-500 dark:text-zinc-400">
        <span className="font-semibold text-zinc-700 dark:text-zinc-300">
          {label}
        </span>
        <span className="tabular-nums">
          {t.minutes(formatMin(route.totalTimeSec))} · {t.transfers(route.transfers)} ·{' '}
          {t.stops(route.totalStops)}
        </span>
      </div>
      <div className="space-y-1">
        {route.legs.map((leg, i) => {
          const fromName =
            network.stations[leg.fromStationId]?.name ?? leg.fromStationId;
          const toName =
            network.stations[leg.toStationId]?.name ?? leg.toStationId;
          const stopsCount = Math.max(0, leg.stationIds.length - 1);
          const legMin = formatMin(leg.rideTimeSec);
          return (
            <div
              key={`${leg.lineId}-${i}`}
              className="flex items-center gap-2 text-[11px] text-zinc-700 dark:text-zinc-300"
            >
              <LineBadge
                lineId={leg.lineId}
                mode={network.lines[leg.lineId]?.mode}
                size="xs"
              />
              <span className="min-w-0 flex-1 truncate">
                {fromName}
                <span className="mx-1 text-zinc-400">→</span>
                {toName}
              </span>
              <span className="text-zinc-400 dark:text-zinc-500 shrink-0 tabular-nums">
                {t.stops(stopsCount)} · {legMin}m
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function DailySummaryModal({
  open,
  onClose,
  t,
  network,
  progress,
  networkMode,
  stats,
  onInspectRound,
  onPlayFreePlay,
  onSwitchNetworkMode,
}: DailySummaryModalProps) {
  const [copied, setCopied] = useState(false);
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const rowRefs = useRef<(HTMLDivElement | null)[]>([]);

  if (!open) return null;

  const { totalRounds, solvedCount, optimalCount, totalDeltaMin } =
    computeSummaryStats(progress.rounds);

  const handleShare = async () => {
    const text = buildShareText(progress, networkMode);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { }
  };

  const handleSelectRound = (idx: number) => {
    setExpandedIndex((prev) => (prev === idx ? null : idx));
    rowRefs.current[idx]?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  };

  return (
    <div
      className="animate-backdrop-in fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-xs p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="animate-modal-in relative w-full sm:max-w-md max-h-[90dvh] sm:max-h-[88dvh] flex flex-col rounded-t-3xl sm:rounded-2xl bg-white dark:bg-zinc-900 border-t border-x sm:border border-zinc-200 dark:border-zinc-800 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="shrink-0 flex items-start justify-between gap-3 px-4 py-3.5 sm:px-5 sm:py-4 border-b border-zinc-100 dark:border-zinc-800">
          <div>
            <h2 className="font-display font-bold text-lg tracking-tight text-zinc-900 dark:text-white leading-tight">
              {t.dailyTitle(progress.dateKey)}
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              {networkMode === 'ust' ? t.modeUST : t.modeUS}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
            aria-label={t.close}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Compact Metrics + 5-Round Strip */}
        <div className="shrink-0 px-4 py-3 sm:px-5 sm:py-3.5 border-b border-zinc-100 dark:border-zinc-800">
          <div className="grid grid-cols-3 divide-x divide-zinc-200/80 dark:divide-zinc-800 text-center">
            <div className="pr-2">
              <div className="font-display font-bold text-xl tabular-nums text-zinc-900 dark:text-white leading-none">
                {optimalCount}
                <span className="text-sm font-medium text-zinc-400">
                  /{totalRounds}
                </span>
              </div>
              <div className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1">
                {t.summaryOptimalMetric}
              </div>
            </div>

            <div className="px-2">
              <div
                className={`font-display font-bold text-xl tabular-nums leading-none ${solvedCount === 0
                    ? 'text-zinc-400'
                    : totalDeltaMin <= 0
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-zinc-900 dark:text-white'
                  }`}
              >
                {solvedCount === 0
                  ? '—'
                  : totalDeltaMin <= 0
                    ? '±0m'
                    : `+${totalDeltaMin}m`}
              </div>
              <div className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1">
                {t.summaryTimeDeltaMetric}
              </div>
            </div>

            <div className="pl-2">
              <div className="font-display font-bold text-xl tabular-nums text-zinc-900 dark:text-white leading-none">
                {stats.currentStreak > 0 ? (
                  stats.currentStreak
                ) : (
                  <>
                    {solvedCount}
                    <span className="text-sm font-medium text-zinc-400">
                      /{totalRounds}
                    </span>
                  </>
                )}
              </div>
              <div className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1">
                {stats.currentStreak > 0
                  ? t.currentStreak
                  : t.summarySolvedMetric}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-5 gap-1.5 mt-3.5">
            {progress.rounds.map((r, i) => (
              <button
                key={r.puzzleId}
                type="button"
                onClick={() => handleSelectRound(i)}
                title={`${i + 1}. ${t.gradeLabel[r.grade]}`}
                aria-label={`${i + 1}. ${t.gradeLabel[r.grade]}`}
                className={`h-1.5 rounded-full transition-opacity cursor-pointer ${gradeColor(r.grade)} ${expandedIndex !== null && expandedIndex !== i
                    ? 'opacity-40 hover:opacity-80'
                    : 'opacity-100'
                  }`}
              />
            ))}
          </div>
        </div>

        {/* Per-Round Breakdown List */}
        <div className="overflow-y-auto px-4 py-3 sm:px-5 sm:py-4 flex-1">
          <div className="rounded-xl border border-zinc-200/90 dark:border-zinc-800 divide-y divide-zinc-100 dark:divide-zinc-800/80 overflow-hidden">
            {progress.rounds.map((r, i) => {
              const fromName =
                network.stations[r.fromStationId]?.name ?? r.fromStationId;
              const toName =
                network.stations[r.toStationId]?.name ?? r.toStationId;
              const deltaMin =
                r.deltaSec !== null ? Math.round(r.deltaSec / 60) : null;
              const optimalMin = formatMin(r.optimalRoute.totalTimeSec);
              const playerMin = r.playerRoute
                ? formatMin(r.playerRoute.totalTimeSec)
                : null;
              const exactMatch =
                r.playerRoute !== null &&
                isSameLineSequence(r.playerRoute, r.optimalRoute);
              const isExpanded = expandedIndex === i;

              return (
                <div
                  key={r.puzzleId}
                  ref={(el) => {
                    rowRefs.current[i] = el;
                  }}
                >
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedIndex((prev) => (prev === i ? null : i))
                    }
                    aria-expanded={isExpanded}
                    className="w-full text-left px-3.5 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors cursor-pointer"
                  >
                    {/* Trip title + result */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className={`w-2 h-2 rounded-full shrink-0 ${gradeColor(r.grade)}`}
                          title={t.gradeLabel[r.grade]}
                        />
                        <span className="text-[13px] font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                          {fromName}
                          <span className="mx-1 text-zinc-400 font-normal">→</span>
                          {toName}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {r.playerRoute === null ? (
                          <span className="text-[11px] font-medium text-rose-600 dark:text-rose-400">
                            {t.gradeLabel.skipped}
                          </span>
                        ) : deltaMin !== null && deltaMin <= 0 ? (
                          <span className="text-[11px] font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
                            ±0m
                          </span>
                        ) : deltaMin !== null ? (
                          <span className="text-[11px] font-semibold tabular-nums text-zinc-500 dark:text-zinc-400">
                            +{deltaMin}m
                          </span>
                        ) : null}
                        <ChevronDown
                          className={`w-3.5 h-3.5 text-zinc-400 transition-transform duration-150 ${isExpanded ? 'rotate-180' : ''
                            }`}
                        />
                      </div>
                    </div>

                    {/* Line sequences */}
                    <div className="mt-2 pl-4 space-y-1.5">
                      {exactMatch && r.playerRoute && (
                        <div className="flex items-center justify-between gap-2">
                          <LineSequence
                            lineIds={r.playerRoute.lineIds}
                            network={network}
                          />
                          <span className="text-[11px] text-zinc-500 dark:text-zinc-400 shrink-0 tabular-nums">
                            {optimalMin}m
                          </span>
                        </div>
                      )}

                      {!exactMatch && r.playerRoute && (
                        <>
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="w-12 text-[11px] text-zinc-400 dark:text-zinc-500 shrink-0">
                                {t.summaryYoursShort}
                              </span>
                              <LineSequence
                                lineIds={r.playerRoute.lineIds}
                                network={network}
                              />
                            </div>
                            <span className="text-[11px] text-zinc-500 dark:text-zinc-400 shrink-0 tabular-nums">
                              {playerMin}m
                            </span>
                          </div>

                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="w-12 text-[11px] font-medium text-emerald-600 dark:text-emerald-400 shrink-0">
                                {t.summaryOptimalShort}
                              </span>
                              <LineSequence
                                lineIds={r.optimalRoute.lineIds}
                                network={network}
                              />
                            </div>
                            <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 shrink-0 tabular-nums">
                              {optimalMin}m
                            </span>
                          </div>
                        </>
                      )}

                      {r.playerRoute === null && (
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="w-12 text-[11px] font-medium text-emerald-600 dark:text-emerald-400 shrink-0">
                              {t.summaryOptimalShort}
                            </span>
                            <LineSequence
                              lineIds={r.optimalRoute.lineIds}
                              network={network}
                            />
                          </div>
                          <span className="text-[11px] text-zinc-500 dark:text-zinc-400 shrink-0 tabular-nums">
                            {optimalMin}m
                          </span>
                        </div>
                      )}
                    </div>
                  </button>

                  <div
                    className="accordion-grid"
                    data-open={isExpanded ? 'true' : 'false'}
                    aria-hidden={!isExpanded}
                  >
                    <div className="accordion-inner">
                      <div className="px-3.5 pb-3 pt-2.5 bg-zinc-50/70 dark:bg-zinc-950/50 border-t border-zinc-100 dark:border-zinc-800/80 space-y-3">
                        {r.playerRoute && (
                          <LegDetails
                            route={r.playerRoute}
                            network={network}
                            t={t}
                            label={t.yourRoute}
                          />
                        )}
                        {!exactMatch && (
                          <LegDetails
                            route={r.optimalRoute}
                            network={network}
                            t={t}
                            label={t.optimalRoute}
                          />
                        )}

                        <button
                          type="button"
                          tabIndex={isExpanded ? 0 : -1}
                          onClick={() => onInspectRound(i)}
                          className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800 active:scale-[0.985] text-zinc-700 dark:text-zinc-200 font-medium text-xs py-1.5 px-3 transition-all cursor-pointer"
                        >
                          <MapPin className="w-3.5 h-3.5 text-zinc-400" />
                          <span>{t.summaryInspectOnMap}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="shrink-0 px-4 pt-3 safe-bottom sm:px-5 sm:py-3.5 border-t border-zinc-100 dark:border-zinc-800 space-y-2">
          <button
            type="button"
            onClick={handleShare}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 dark:bg-white dark:hover:bg-zinc-200 text-white dark:text-zinc-950 font-semibold text-sm py-2.5 px-4 transition-colors cursor-pointer"
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
              className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800 font-medium text-xs py-2 px-3 transition-colors cursor-pointer"
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
              className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800 font-medium text-xs py-2 px-3 transition-colors cursor-pointer"
            >
              <TramFront className="w-3.5 h-3.5" />
              {networkMode === 'us' ? t.modeUST : t.modeUS}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
