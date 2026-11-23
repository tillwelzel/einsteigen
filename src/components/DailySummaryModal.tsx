import { useRef, useState } from 'react';
import {
  ArrowRight,
  Award,
  Check,
  ChevronDown,
  Clock,
  Eye,
  Flame,
  Gauge,
  MapPin,
  Repeat2,
  Share2,
  Shuffle,
  Sparkles,
  Target,
  TramFront,
  X,
  Zap,
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

type RankTier = 'legend' | 'pro' | 'commuter' | 'rider' | 'tourist';

const GRADE_EMOJI: Record<RoundGrade, string> = {
  optimal: '🟩',
  great: '🟦',
  good: '🟨',
  valid: '⬜',
  skipped: '🟥',
};

const GRADE_POINTS: Record<RoundGrade, number> = {
  optimal: 20,
  great: 16,
  good: 12,
  valid: 8,
  skipped: 0,
};

function formatMin(sec: number): number {
  return Math.max(1, Math.round(sec / 60));
}

function isSameLineSequence(a: ComputedRoute, b: ComputedRoute): boolean {
  return a.lineIds.join('|') === b.lineIds.join('|');
}

interface DailyInsights {
  totalRounds: number;
  solvedCount: number;
  optimalCount: number;
  firstTryCount: number;
  totalDeltaMin: number;
  timeEfficiencyPct: number | null;
  avgAttempts: string | null;
  totalPlayerTransfers: number;
  totalOptimalTransfers: number;
  transferDiff: number | null;
  score: number;
  rankTier: RankTier;
}

function computeDailyInsights(rounds: CompletedRound[]): DailyInsights {
  const totalRounds = rounds.length;
  const solvedRounds = rounds.filter((r) => r.playerRoute !== null);
  const solvedCount = solvedRounds.length;
  const optimalCount = rounds.filter((r) => r.grade === 'optimal').length;
  const firstTryCount = solvedRounds.filter((r) => r.attempts === 1).length;

  const totalOptimalTimeSec = solvedRounds.reduce(
    (sum, r) => sum + r.optimalRoute.totalTimeSec,
    0,
  );
  const totalPlayerTimeSec = solvedRounds.reduce(
    (sum, r) => sum + (r.playerRoute?.totalTimeSec ?? 0),
    0,
  );
  const totalDeltaSec = solvedRounds.reduce(
    (sum, r) => sum + Math.max(0, r.deltaSec ?? 0),
    0,
  );
  const totalDeltaMin = Math.round(totalDeltaSec / 60);

  const timeEfficiencyPct =
    totalPlayerTimeSec > 0
      ? Math.min(100, Math.round((totalOptimalTimeSec / totalPlayerTimeSec) * 100))
      : null;

  const avgAttempts =
    solvedCount > 0
      ? (
          solvedRounds.reduce((sum, r) => sum + r.attempts, 0) / solvedCount
        ).toFixed(1)
      : null;

  const totalPlayerTransfers = solvedRounds.reduce(
    (sum, r) => sum + (r.playerRoute?.transfers ?? 0),
    0,
  );
  const totalOptimalTransfers = solvedRounds.reduce(
    (sum, r) => sum + r.optimalRoute.transfers,
    0,
  );
  const transferDiff =
    solvedCount > 0 ? totalPlayerTransfers - totalOptimalTransfers : null;

  const earnedPoints = rounds.reduce((sum, r) => sum + GRADE_POINTS[r.grade], 0);
  const maxPoints = Math.max(1, totalRounds * 20);
  const score = Math.round((earnedPoints / maxPoints) * 100);

  const rankTier: RankTier =
    score >= 95
      ? 'legend'
      : score >= 80
        ? 'pro'
        : score >= 60
          ? 'commuter'
          : score >= 35
            ? 'rider'
            : 'tourist';

  return {
    totalRounds,
    solvedCount,
    optimalCount,
    firstTryCount,
    totalDeltaMin,
    timeEfficiencyPct,
    avgAttempts,
    totalPlayerTransfers,
    totalOptimalTransfers,
    transferDiff,
    score,
    rankTier,
  };
}

function rankTheme(tier: RankTier) {
  switch (tier) {
    case 'legend':
    case 'pro':
      return {
        glow: 'from-emerald-500/20 via-teal-500/10 to-transparent',
        stroke: '#10b981',
        badge:
          'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
        scoreText: 'text-emerald-600 dark:text-emerald-400',
      };
    case 'commuter':
      return {
        glow: 'from-sky-500/20 via-blue-500/10 to-transparent',
        stroke: '#0ea5e9',
        badge: 'bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30',
        scoreText: 'text-sky-600 dark:text-sky-400',
      };
    case 'rider':
      return {
        glow: 'from-amber-500/20 via-orange-500/10 to-transparent',
        stroke: '#f59e0b',
        badge:
          'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30',
        scoreText: 'text-amber-600 dark:text-amber-400',
      };
    case 'tourist':
      return {
        glow: 'from-rose-500/20 via-pink-500/10 to-transparent',
        stroke: '#f43f5e',
        badge: 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30',
        scoreText: 'text-rose-600 dark:text-rose-400',
      };
  }
}

function gradeStyles(grade: RoundGrade) {
  switch (grade) {
    case 'optimal':
      return {
        node: 'bg-emerald-500 text-white shadow-emerald-500/35 ring-emerald-500/25',
        pill: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
        accentBar: 'bg-emerald-500',
        delta: 'text-emerald-600 dark:text-emerald-400',
      };
    case 'great':
      return {
        node: 'bg-sky-500 text-white shadow-sky-500/35 ring-sky-500/25',
        pill: 'bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30',
        accentBar: 'bg-sky-500',
        delta: 'text-sky-600 dark:text-sky-400',
      };
    case 'good':
      return {
        node: 'bg-amber-500 text-white shadow-amber-500/35 ring-amber-500/25',
        pill: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30',
        accentBar: 'bg-amber-500',
        delta: 'text-amber-600 dark:text-amber-400',
      };
    case 'valid':
      return {
        node: 'bg-zinc-500 text-white shadow-zinc-500/30 ring-zinc-500/25',
        pill: 'bg-zinc-500/15 text-zinc-700 dark:text-zinc-300 border-zinc-500/30',
        accentBar: 'bg-zinc-400 dark:bg-zinc-500',
        delta: 'text-zinc-600 dark:text-zinc-400',
      };
    case 'skipped':
      return {
        node: 'bg-rose-500 text-white shadow-rose-500/35 ring-rose-500/25',
        pill: 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30',
        accentBar: 'bg-rose-500',
        delta: 'text-rose-500 dark:text-rose-400',
      };
  }
}

function buildShareText(
  progress: DailyProgress,
  networkMode: NetworkMode,
  insights: DailyInsights,
): string {
  const modeTag = networkMode === 'ust' ? 'U+S+Tram' : 'U+S';
  const grid = progress.rounds.map((r) => GRADE_EMOJI[r.grade]).join('');
  const deltaPart =
    insights.solvedCount > 0
      ? insights.totalDeltaMin <= 0
        ? '±0m'
        : `+${insights.totalDeltaMin}m`
      : '—';
  const lines = [
    `🚇 Einsteigen München · ${progress.dateKey} (${modeTag})`,
    `${grid}  ${insights.score}/100 · ${insights.optimalCount}/${insights.totalRounds} Optimal (${deltaPart})`,
  ];
  return lines.join('\n');
}

function LineSequence({
  lineIds,
  network,
}: {
  lineIds: string[];
  network: MunichNetwork;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1">
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
  dotColor,
}: {
  route: ComputedRoute;
  network: MunichNetwork;
  t: Translations;
  label: string;
  dotColor: string;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
        <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />
        <span>{label}</span>
        <span className="text-zinc-300 dark:text-zinc-700">·</span>
        <span>
          {t.minutes(formatMin(route.totalTimeSec))} · {t.transfers(route.transfers)} ·{' '}
          {t.stops(route.totalStops)}
        </span>
      </div>
      <div className="space-y-1 pl-2 border-l border-zinc-200 dark:border-zinc-800 ml-0.5">
        {route.legs.map((leg, i) => {
          const fromName = network.stations[leg.fromStationId]?.name ?? leg.fromStationId;
          const toName = network.stations[leg.toStationId]?.name ?? leg.toStationId;
          const stopsCount = Math.max(0, leg.stationIds.length - 1);
          const legMin = formatMin(leg.rideTimeSec);
          return (
            <div
              key={`${leg.lineId}-${i}`}
              className="flex items-center gap-1.5 text-[11px] text-zinc-700 dark:text-zinc-300"
            >
              <LineBadge
                lineId={leg.lineId}
                mode={network.lines[leg.lineId]?.mode}
                size="xs"
              />
              <span className="min-w-0 flex-1 truncate">
                <span className="font-medium">{fromName}</span>
                <span className="mx-1 text-zinc-400">→</span>
                <span className="font-medium">{toName}</span>
              </span>
              <span className="text-[10px] text-zinc-400 shrink-0 tabular-nums">
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

  const insights = computeDailyInsights(progress.rounds);
  const theme = rankTheme(insights.rankTier);

  const ringRadius = 34;
  const ringCircumference = 2 * Math.PI * ringRadius;
  const ringDashOffset =
    ringCircumference * (1 - Math.max(0, Math.min(100, insights.score)) / 100);

  const handleShare = async () => {
    const text = buildShareText(progress, networkMode, insights);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  const handleJumpToCard = (idx: number) => {
    setExpandedIndex((prev) => (prev === idx ? null : idx));
    rowRefs.current[idx]?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-3 sm:p-4"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg max-h-[90dvh] flex flex-col rounded-3xl bg-white dark:bg-zinc-900 border border-zinc-200/90 dark:border-zinc-800 shadow-2xl shadow-black/30 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Ambient Hero Header */}
        <div
          className={`relative shrink-0 bg-gradient-to-b ${theme.glow} px-5 pt-5 pb-4 border-b border-zinc-200/70 dark:border-zinc-800/90`}
        >
          {/* Top metadata row + close */}
          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-zinc-900/5 dark:bg-white/10 text-zinc-700 dark:text-zinc-200">
                {t.dailyTitle(progress.dateKey)}
              </span>
              <span className="inline-flex items-center text-[11px] font-semibold px-2 py-0.5 rounded-full bg-zinc-900/5 dark:bg-white/10 text-zinc-600 dark:text-zinc-300">
                {networkMode === 'ust' ? t.modeUST : t.modeUS}
              </span>
              {stats.currentStreak > 0 && (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-orange-500/15 text-orange-600 dark:text-orange-400">
                  <Flame className="w-3 h-3" />
                  {t.summaryStreakPill(stats.currentStreak)}
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer"
              aria-label={t.close}
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Rank title + circular score gauge */}
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-0.5">
                <Award className="w-3.5 h-3.5" />
                <span>{t.summarySolvedOf(insights.solvedCount, insights.totalRounds)}</span>
              </div>
              <h2 className="font-display font-extrabold text-xl sm:text-2xl tracking-tight text-zinc-900 dark:text-white leading-tight">
                {t.summaryRank[insights.rankTier]}
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                {t.dailySubtitle}
              </p>
            </div>

            {/* Circular Score Ring */}
            <div className="relative w-20 h-20 shrink-0 flex items-center justify-center">
              <svg className="w-20 h-20 -rotate-90" viewBox="0 0 80 80" aria-hidden="true">
                <circle
                  cx="40"
                  cy="40"
                  r={ringRadius}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="5.5"
                  className="text-zinc-200/90 dark:text-zinc-800"
                />
                {insights.score > 0 && (
                  <circle
                    cx="40"
                    cy="40"
                    r={ringRadius}
                    fill="none"
                    stroke={theme.stroke}
                    strokeWidth="5.5"
                    strokeLinecap="round"
                    strokeDasharray={ringCircumference}
                    strokeDashoffset={ringDashOffset}
                    className="transition-all duration-700 ease-out"
                  />
                )}
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center leading-none">
                <span
                  className={`font-display font-extrabold text-xl tabular-nums leading-none ${theme.scoreText}`}
                >
                  {insights.score}
                </span>
                <span className="text-[8.5px] font-bold uppercase tracking-[0.12em] text-zinc-400 mt-1 leading-none">
                  {t.summaryScoreLabel}
                </span>
              </div>
            </div>
          </div>

          {/* Metro-Line Journey Strip */}
          <div className="mt-4 pt-3 border-t border-zinc-200/60 dark:border-zinc-800/70">
            <div className="relative flex items-start justify-between px-2">
              {/* Connecting rail */}
              <div
                aria-hidden="true"
                className="absolute left-6 right-6 top-4 h-0.5 bg-zinc-200 dark:bg-zinc-800 rounded-full"
              />
              {progress.rounds.map((r, i) => {
                const styles = gradeStyles(r.grade);
                const deltaMin =
                  r.deltaSec !== null ? Math.round(r.deltaSec / 60) : null;
                const isSelected = expandedIndex === i;
                return (
                  <button
                    key={r.puzzleId}
                    type="button"
                    onClick={() => handleJumpToCard(i)}
                    className="relative z-10 flex flex-col items-center gap-1 group cursor-pointer"
                    title={`${i + 1}. ${t.gradeLabel[r.grade]}`}
                  >
                    <span
                      className={`w-8 h-8 rounded-xl flex items-center justify-center shadow-md ring-4 transition-transform group-hover:scale-105 ${styles.node} ${
                        isSelected
                          ? 'scale-110 ring-zinc-900/20 dark:ring-white/30'
                          : ''
                      }`}
                    >
                      {r.grade === 'optimal' ? (
                        <Check className="w-4 h-4 stroke-[2.75]" />
                      ) : r.grade === 'skipped' ? (
                        <Eye className="w-3.5 h-3.5" />
                      ) : (
                        <Sparkles className="w-3.5 h-3.5" />
                      )}
                    </span>
                    <span className="text-[10px] font-bold tabular-nums text-zinc-500 dark:text-zinc-400">
                      {deltaMin === null
                        ? '—'
                        : deltaMin <= 0
                          ? '±0m'
                          : `+${deltaMin}m`}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Scrollable Insights + Trip Comparison Body */}
        <div className="overflow-y-auto px-5 py-4 space-y-4 flex-1">
          {/* 4-Tile Performance Insights */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {/* Optimal hits */}
            <div className="rounded-2xl bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200/80 dark:border-zinc-800/90 p-2.5">
              <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                <Target className="w-3 h-3 text-emerald-500" />
                <span className="truncate">{t.summaryOptimalMetric}</span>
              </div>
              <div className="font-display font-extrabold text-lg text-zinc-900 dark:text-white mt-1 tabular-nums leading-none">
                {insights.optimalCount}
                <span className="text-xs font-semibold text-zinc-400">
                  /{insights.totalRounds}
                </span>
              </div>
              <div className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-1 truncate">
                {t.summarySolvedOf(insights.solvedCount, insights.totalRounds)}
              </div>
            </div>

            {/* Time delta vs optimal */}
            <div className="rounded-2xl bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200/80 dark:border-zinc-800/90 p-2.5">
              <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                <Gauge className="w-3 h-3 text-sky-500" />
                <span className="truncate">{t.summaryTimeDeltaMetric}</span>
              </div>
              <div
                className={`font-display font-extrabold text-lg mt-1 tabular-nums leading-none ${
                  insights.solvedCount === 0
                    ? 'text-zinc-400'
                    : insights.totalDeltaMin <= 0
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-amber-600 dark:text-amber-400'
                }`}
              >
                {insights.solvedCount === 0
                  ? '—'
                  : insights.totalDeltaMin <= 0
                    ? '±0m'
                    : `+${insights.totalDeltaMin}m`}
              </div>
              <div className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-1 truncate">
                {insights.timeEfficiencyPct === null
                  ? '—'
                  : insights.totalDeltaMin <= 0
                    ? t.summaryNoTimeLost
                    : t.summaryPacePct(insights.timeEfficiencyPct)}
              </div>
            </div>

            {/* 1st-try accuracy */}
            <div className="rounded-2xl bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200/80 dark:border-zinc-800/90 p-2.5">
              <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                <Zap className="w-3 h-3 text-amber-500" />
                <span className="truncate">{t.summaryFirstTryMetric}</span>
              </div>
              <div className="font-display font-extrabold text-lg text-zinc-900 dark:text-white mt-1 tabular-nums leading-none">
                {insights.firstTryCount}
                <span className="text-xs font-semibold text-zinc-400">
                  /{insights.totalRounds}
                </span>
              </div>
              <div className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-1 truncate">
                {insights.avgAttempts !== null
                  ? t.summaryAvgTries(insights.avgAttempts)
                  : '—'}
              </div>
            </div>

            {/* Transfers comparison */}
            <div className="rounded-2xl bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200/80 dark:border-zinc-800/90 p-2.5">
              <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                <Repeat2 className="w-3 h-3 text-violet-500" />
                <span className="truncate">{t.summaryTransfersMetric}</span>
              </div>
              <div
                className={`font-display font-extrabold text-lg mt-1 tabular-nums leading-none ${
                  insights.transferDiff === null
                    ? 'text-zinc-400'
                    : insights.transferDiff <= 0
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-zinc-900 dark:text-white'
                }`}
              >
                {insights.transferDiff === null
                  ? '—'
                  : insights.transferDiff === 0
                    ? '±0'
                    : insights.transferDiff > 0
                      ? `+${insights.transferDiff}`
                      : `${insights.transferDiff}`}
              </div>
              <div className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-1 truncate">
                {insights.transferDiff !== null
                  ? t.summaryTransfersCompare(
                      insights.totalPlayerTransfers,
                      insights.totalOptimalTransfers,
                    )
                  : '—'}
              </div>
            </div>
          </div>

          {/* Per-Round Submitted vs. Optimal Breakdown */}
          <div>
            <div className="flex items-center justify-between mb-2 px-0.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                {t.summaryTripsHeading}
              </span>
              <span className="text-[11px] text-zinc-400 dark:text-zinc-500">
                {t.summaryTapToCompare}
              </span>
            </div>

            <div className="space-y-2.5">
              {progress.rounds.map((r, i) => {
                const fromName =
                  network.stations[r.fromStationId]?.name ?? r.fromStationId;
                const toName =
                  network.stations[r.toStationId]?.name ?? r.toStationId;
                const styles = gradeStyles(r.grade);
                const deltaMin =
                  r.deltaSec !== null ? Math.round(r.deltaSec / 60) : null;
                const optimalMin = formatMin(r.optimalRoute.totalTimeSec);
                const playerMin = r.playerRoute
                  ? formatMin(r.playerRoute.totalTimeSec)
                  : null;
                const exactMatch =
                  r.playerRoute !== null &&
                  isSameLineSequence(r.playerRoute, r.optimalRoute);
                const hasAlternative =
                  r.playerRoute !== null && !exactMatch;
                const isExpanded = expandedIndex === i;

                const maxBarSec = r.playerRoute
                  ? Math.max(
                      r.playerRoute.totalTimeSec,
                      r.optimalRoute.totalTimeSec,
                      1,
                    )
                  : 1;
                const optimalBarPct = Math.max(
                  12,
                  Math.round((r.optimalRoute.totalTimeSec / maxBarSec) * 100),
                );
                const playerBarPct = r.playerRoute
                  ? Math.max(
                      12,
                      Math.round((r.playerRoute.totalTimeSec / maxBarSec) * 100),
                    )
                  : 0;

                return (
                  <div
                    key={r.puzzleId}
                    ref={(el) => {
                      rowRefs.current[i] = el;
                    }}
                    className={`relative rounded-2xl border transition-all overflow-hidden ${
                      isExpanded
                        ? 'bg-zinc-50 dark:bg-zinc-950/90 border-zinc-300 dark:border-zinc-700 shadow-sm'
                        : 'bg-zinc-50/80 dark:bg-zinc-950/50 border-zinc-200/80 dark:border-zinc-800/90 hover:border-zinc-300 dark:hover:border-zinc-700'
                    }`}
                  >
                    {/* Left color bar */}
                    <div
                      className={`absolute left-0 top-0 bottom-0 w-1 ${styles.accentBar}`}
                    />

                    <button
                      type="button"
                      onClick={() =>
                        setExpandedIndex((prev) => (prev === i ? null : i))
                      }
                      aria-expanded={isExpanded}
                      className="w-full text-left pl-3.5 pr-3 py-2.5 cursor-pointer"
                    >
                      {/* Row Header: Trip Name + Grade + Delta */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[11px] font-bold text-zinc-400 tabular-nums shrink-0">
                              #{i + 1}
                            </span>
                            <span className="font-semibold text-[13px] text-zinc-900 dark:text-zinc-100 truncate">
                              {fromName} → {toName}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${styles.pill}`}
                          >
                            {t.gradeLabel[r.grade]}
                          </span>
                          {deltaMin !== null && (
                            <span
                              className={`text-[11px] font-bold tabular-nums min-w-[2.25rem] text-right ${styles.delta}`}
                            >
                              {deltaMin <= 0 ? '±0m' : `+${deltaMin}m`}
                            </span>
                          )}
                          <ChevronDown
                            className={`w-3.5 h-3.5 text-zinc-400 transition-transform duration-200 ${
                              isExpanded ? 'rotate-180' : ''
                            }`}
                          />
                        </div>
                      </div>

                      {/* Route Comparison Section */}
                      <div className="mt-2 space-y-1.5">
                        {exactMatch && r.playerRoute && (
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 shrink-0">
                                <Check className="w-3 h-3 stroke-[2.5]" />
                                {t.summaryYoursShort}
                              </span>
                              <LineSequence
                                lineIds={r.playerRoute.lineIds}
                                network={network}
                              />
                            </div>
                            <div className="flex items-center gap-1.5 text-[11px] text-zinc-500 dark:text-zinc-400 shrink-0 tabular-nums">
                              <Clock className="w-3 h-3 text-zinc-400" />
                              <span className="font-semibold text-zinc-700 dark:text-zinc-200">
                                {optimalMin}m
                              </span>
                              {r.attempts > 0 && (
                                <span className="text-[10px] text-zinc-400">
                                  · {t.summaryTriesUsed(r.attempts)}
                                </span>
                              )}
                            </div>
                          </div>
                        )}

                        {hasAlternative && r.playerRoute && (
                          <div className="space-y-1.5">
                            {/* Player submitted route */}
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="inline-flex items-center gap-1 w-14 text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 shrink-0">
                                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
                                  {t.summaryYoursShort}
                                </span>
                                <LineSequence
                                  lineIds={r.playerRoute.lineIds}
                                  network={network}
                                />
                              </div>
                              <span className="text-[11px] font-semibold text-zinc-700 dark:text-zinc-200 shrink-0 tabular-nums">
                                {playerMin}m · {r.playerRoute.transfers}×
                              </span>
                            </div>

                            {/* Optimal route */}
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="inline-flex items-center gap-1 w-14 text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 shrink-0">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                                  {t.summaryOptimalShort}
                                </span>
                                <LineSequence
                                  lineIds={r.optimalRoute.lineIds}
                                  network={network}
                                />
                              </div>
                              <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 shrink-0 tabular-nums">
                                {optimalMin}m · {r.optimalRoute.transfers}×
                              </span>
                            </div>

                            {/* Dual relative duration comparison bar */}
                            <div className="pt-1 flex items-center gap-2">
                              <div className="flex-1 space-y-1">
                                <div className="h-1.5 rounded-full bg-zinc-200/80 dark:bg-zinc-800 overflow-hidden">
                                  <div
                                    className="h-full rounded-full bg-blue-500/85"
                                    style={{ width: `${playerBarPct}%` }}
                                  />
                                </div>
                                <div className="h-1.5 rounded-full bg-zinc-200/80 dark:bg-zinc-800 overflow-hidden">
                                  <div
                                    className="h-full rounded-full bg-emerald-500"
                                    style={{ width: `${optimalBarPct}%` }}
                                  />
                                </div>
                              </div>
                              <span className="text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 shrink-0">
                                {deltaMin !== null && deltaMin <= 0
                                  ? t.summaryAlternativeTie
                                  : r.attempts > 0
                                    ? t.summaryTriesUsed(r.attempts)
                                    : ''}
                              </span>
                            </div>
                          </div>
                        )}

                        {r.playerRoute === null && (
                          <div className="space-y-1">
                            <div className="flex items-center justify-between gap-2 text-[11px] text-zinc-400 dark:text-zinc-500">
                              <span className="italic">{t.noRouteSubmitted}</span>
                              {r.attempts > 0 && (
                                <span className="text-[10px] tabular-nums">
                                  {t.summaryTriesUsed(r.attempts)}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 shrink-0">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                                  {t.summaryOptimalShort}
                                </span>
                                <LineSequence
                                  lineIds={r.optimalRoute.lineIds}
                                  network={network}
                                />
                              </div>
                              <span className="text-[11px] font-semibold text-zinc-600 dark:text-zinc-300 shrink-0 tabular-nums">
                                {optimalMin}m · {r.optimalRoute.transfers}×
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    </button>

                    {/* Expandable Leg-by-Leg & Inspect on Map */}
                    {isExpanded && (
                      <div className="pl-3.5 pr-3 pb-3 pt-2 border-t border-zinc-200/70 dark:border-zinc-800/80 space-y-2.5">
                        {r.playerRoute && (
                          <LegDetails
                            route={r.playerRoute}
                            network={network}
                            t={t}
                            label={
                              exactMatch
                                ? `${t.yourRoute} (${t.summaryExactBadge})`
                                : t.yourRoute
                            }
                            dotColor={exactMatch ? 'bg-emerald-500' : 'bg-blue-500'}
                          />
                        )}
                        {!exactMatch && (
                          <LegDetails
                            route={r.optimalRoute}
                            network={network}
                            t={t}
                            label={t.optimalRoute}
                            dotColor="bg-emerald-500"
                          />
                        )}

                        <button
                          type="button"
                          onClick={() => onInspectRound(i)}
                          className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl bg-zinc-200/70 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700/80 text-zinc-800 dark:text-zinc-100 font-semibold text-[11px] py-1.5 px-3 transition-colors cursor-pointer"
                        >
                          <MapPin className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                          <span>{t.summaryInspectOnMap}</span>
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Pinned Footer Actions */}
        <div className="shrink-0 px-5 py-3.5 border-t border-zinc-200/80 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-950/50 space-y-2">
          <button
            type="button"
            onClick={handleShare}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-[0.99] text-white font-bold text-sm py-2.5 px-4 shadow-md shadow-emerald-900/20 transition-all cursor-pointer"
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
              className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-zinc-200 dark:border-zinc-700/80 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 font-semibold text-xs py-2 px-3 transition-colors cursor-pointer"
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
              className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-zinc-200 dark:border-zinc-700/80 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 font-semibold text-xs py-2 px-3 transition-colors cursor-pointer"
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
