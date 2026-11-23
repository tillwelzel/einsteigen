import {
  AlertCircle,
  ArrowRight,
  Check,
  ChevronRight,
  Clock,
  Delete,
  Eye,
  Flag,
  MapPin,
  RefreshCw,
  RotateCcw,
  Sparkles,
  Trophy,
} from 'lucide-react';
import { sortLineIds } from '../data/mvg-colors';
import { DAILY_ROUNDS_COUNT } from '../engine/puzzle-generator';
import type { Translations } from '../i18n';
import type {
  AttemptRecord,
  CompletedRound,
  ComputedRoute,
  DailyProgress,
  GameMode,
  MunichNetwork,
  NetworkMode,
  Puzzle,
  RoundGrade,
} from '../types';
import { LineBadge } from './LineBadge';

interface GamePanelProps {
  t: Translations;
  network: MunichNetwork;
  gameMode: GameMode;
  networkMode: NetworkMode;
  puzzle: Puzzle;
  dailyIndex: number;
  dailyProgress: DailyProgress;
  onSelectDailyRound: (idx: number) => void;
  selectedLines: string[];
  onAddLine: (lineId: string) => void;
  onRemoveLastLine: () => void;
  onRemoveLineAt: (idx: number) => void;
  onClearLines: () => void;
  onSubmit: () => void;
  onGiveUp: () => void;
  onNextRound: () => void;
  onOpenSummary: () => void;
  attemptsLeft: number;
  lastInvalidAttempt: AttemptRecord | null;
  currentResult: CompletedRound | null;
  highlightedRoute: 'both' | 'player' | 'optimal';
  onChangeHighlightedRoute: (mode: 'both' | 'player' | 'optimal') => void;
}

function formatMin(sec: number): number {
  return Math.max(1, Math.round(sec / 60));
}

function gradeBadgeClasses(grade: RoundGrade): string {
  switch (grade) {
    case 'optimal':
      return 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30';
    case 'great':
      return 'bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30';
    case 'good':
      return 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30';
    case 'valid':
      return 'bg-zinc-500/15 text-zinc-700 dark:text-zinc-300 border-zinc-500/30';
    case 'skipped':
      return 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30';
  }
}

function gradeDotClasses(grade?: RoundGrade): string {
  switch (grade) {
    case 'optimal':
      return 'bg-emerald-500 border-emerald-500 text-white';
    case 'great':
      return 'bg-sky-500 border-sky-500 text-white';
    case 'good':
      return 'bg-amber-500 border-amber-500 text-white';
    case 'valid':
      return 'bg-zinc-500 border-zinc-500 text-white';
    case 'skipped':
      return 'bg-rose-500 border-rose-500 text-white';
    default:
      return 'bg-zinc-100 dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700 text-zinc-500';
  }
}

function RouteBreakdownCard({
  title,
  route,
  network,
  t,
  accent,
  active,
  onClick,
  badgeText,
}: {
  title: string;
  route: ComputedRoute;
  network: MunichNetwork;
  t: Translations;
  accent: 'player' | 'optimal';
  active: boolean;
  onClick?: () => void;
  badgeText?: string;
}) {
  return (
    <div
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
      className={`rounded-xl border p-3 transition-all ${
        onClick ? 'cursor-pointer' : ''
      } ${
        active
          ? accent === 'player'
            ? 'border-blue-500/70 bg-blue-50/60 dark:bg-blue-950/25 shadow-xs'
            : 'border-emerald-500/70 bg-emerald-50/60 dark:bg-emerald-950/25 shadow-xs'
          : 'border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900/50 hover:border-zinc-300 dark:hover:border-zinc-700'
      }`}
    >
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            {title}
          </span>
          {badgeText && (
            <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded-md bg-zinc-200/80 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
              {badgeText}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs font-semibold text-zinc-700 dark:text-zinc-200">
          <span className="inline-flex items-center gap-1">
            <Clock className="w-3.5 h-3.5 text-zinc-400" />
            {t.minutes(formatMin(route.totalTimeSec))}
          </span>
          <span className="text-zinc-300 dark:text-zinc-700">·</span>
          <span className="text-zinc-500 dark:text-zinc-400">
            {t.transfers(route.transfers)}
          </span>
        </div>
      </div>

      {/* Sequence of line badges + transfer hubs */}
      <div className="space-y-1.5">
        {route.legs.map((leg, i) => {
          const fromName = network.stations[leg.fromStationId]?.name ?? leg.fromStationId;
          const toName = network.stations[leg.toStationId]?.name ?? leg.toStationId;
          const stopsCount = Math.max(0, leg.stationIds.length - 1);
          const legMin = formatMin(leg.rideTimeSec);
          const line = network.lines[leg.lineId];

          return (
            <div key={`${leg.lineId}-${i}`} className="flex items-center gap-2 text-xs">
              <LineBadge lineId={leg.lineId} mode={line?.mode} size="xs" />
              <div className="min-w-0 flex-1 truncate text-zinc-700 dark:text-zinc-200">
                <span className="font-medium">{fromName}</span>
                <span className="mx-1 text-zinc-400">→</span>
                <span className="font-medium">{toName}</span>
              </div>
              <span className="text-[11px] text-zinc-400 shrink-0">
                {t.stops(stopsCount)} · {legMin}m
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function GamePanel({
  t,
  network,
  gameMode,
  networkMode,
  puzzle,
  dailyIndex,
  dailyProgress,
  onSelectDailyRound,
  selectedLines,
  onAddLine,
  onRemoveLastLine,
  onRemoveLineAt,
  onClearLines,
  onSubmit,
  onGiveUp,
  onNextRound,
  onOpenSummary,
  attemptsLeft,
  lastInvalidAttempt,
  currentResult,
  highlightedRoute,
  onChangeHighlightedRoute,
}: GamePanelProps) {
  const fromSt = network.stations[puzzle.fromStationId];
  const toSt = network.stations[puzzle.toStationId];

  const allLineIds = sortLineIds(Object.keys(network.lines));
  const ubahnLines = allLineIds.filter((id) => network.lines[id].mode === 'ubahn');
  const sbahnLines = allLineIds.filter((id) => network.lines[id].mode === 'sbahn');
  const tramLines =
    networkMode === 'ust'
      ? allLineIds.filter((id) => network.lines[id].mode === 'tram')
      : [];

  const isRevealed = currentResult !== null;
  const isLastDailyRound =
    gameMode === 'daily' && dailyIndex === DAILY_ROUNDS_COUNT - 1;

  const sameLinesAsOptimal =
    currentResult?.playerRoute &&
    currentResult.playerRoute.lineIds.join('|') ===
      currentResult.optimalRoute.lineIds.join('|');

  const deltaMin =
    currentResult?.deltaSec !== null && currentResult?.deltaSec !== undefined
      ? Math.round(currentResult.deltaSec / 60)
      : null;

  return (
    <aside className="fixed z-20 inset-x-3 bottom-3 md:inset-x-auto md:left-3 md:top-[4.4rem] md:bottom-auto md:w-[416px] max-h-[58dvh] md:max-h-[calc(100dvh-5.5rem)] flex flex-col bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xl border border-zinc-200/80 dark:border-zinc-800 rounded-2xl shadow-2xl shadow-black/10 overflow-hidden">
      {/* Top progress strip for Daily mode */}
      {gameMode === 'daily' && (
        <div className="flex items-center justify-between px-4 pt-3 pb-2 border-b border-zinc-100 dark:border-zinc-800/80">
          <div className="flex items-center gap-1.5">
            {Array.from({ length: DAILY_ROUNDS_COUNT }).map((_, idx) => {
              const done = dailyProgress.rounds[idx];
              const isCurrent = idx === dailyIndex;
              const reachable = idx <= dailyProgress.rounds.length;
              return (
                <button
                  key={idx}
                  type="button"
                  disabled={!reachable}
                  onClick={() => onSelectDailyRound(idx)}
                  className={`w-6 h-6 rounded-full text-[11px] font-bold border transition-all flex items-center justify-center ${gradeDotClasses(
                    done?.grade,
                  )} ${
                    isCurrent
                      ? 'ring-2 ring-zinc-900 dark:ring-white ring-offset-1 ring-offset-white dark:ring-offset-zinc-900 scale-105'
                      : ''
                  } ${reachable ? 'cursor-pointer' : 'opacity-40 cursor-not-allowed'}`}
                  title={t.roundOf(idx + 1, DAILY_ROUNDS_COUNT)}
                >
                  {idx + 1}
                </button>
              );
            })}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300">
              {t.difficulty[puzzle.difficulty]}
            </span>
            {dailyProgress.completed && (
              <button
                type="button"
                onClick={onOpenSummary}
                className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
              >
                <Trophy className="w-3.5 h-3.5" />
                {t.viewSummary}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Scrollable interior */}
      <div className="overflow-y-auto px-4 py-3.5 space-y-3.5">
        {/* Start -> Destination Station Header */}
        <div className="flex items-stretch gap-3">
          <div className="flex flex-col items-center py-1.5">
            <span className="w-3 h-3 rounded-full bg-emerald-500 ring-4 ring-emerald-500/20 shrink-0" />
            <span className="w-0.5 flex-1 bg-gradient-to-b from-emerald-500/50 to-rose-500/50 my-1 rounded-full" />
            <span className="w-3 h-3 rounded-full bg-rose-500 ring-4 ring-rose-500/20 shrink-0" />
          </div>
          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                  {t.from}
                </div>
                <div className="font-display font-bold text-base sm:text-lg leading-tight truncate text-zinc-900 dark:text-white">
                  {fromSt?.name}
                </div>
              </div>
              {fromSt && (
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 shrink-0">
                  {t.zoneLabel(fromSt.zone)}
                </span>
              )}
            </div>

            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="text-[10px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400">
                  {t.to}
                </div>
                <div className="font-display font-bold text-base sm:text-lg leading-tight truncate text-zinc-900 dark:text-white">
                  {toSt?.name}
                </div>
              </div>
              {toSt && (
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 shrink-0">
                  {t.zoneLabel(toSt.zone)}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* === ACTIVE GUESSING STATE === */}
        {!isRevealed ? (
          <>
            {/* Selected Lines Sequence Tray */}
            <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/90 dark:bg-zinc-950/60 p-2.5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400">
                  {t.selectedLines}
                </span>
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-medium text-zinc-400">
                    {t.attemptsLeft(attemptsLeft)}
                  </span>
                  {selectedLines.length > 0 && (
                    <>
                      <button
                        type="button"
                        onClick={onRemoveLastLine}
                        className="p-1 rounded-md text-zinc-500 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-200/70 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                        title={t.undo}
                        aria-label={t.undo}
                      >
                        <Delete className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={onClearLines}
                        className="p-1 rounded-md text-zinc-500 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-200/70 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                        title={t.clear}
                        aria-label={t.clear}
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                      </button>
                    </>
                  )}
                </div>
              </div>

              {selectedLines.length === 0 ? (
                <div className="min-h-9 flex items-center text-xs text-zinc-400 dark:text-zinc-500 italic px-1">
                  {t.pickLinesPrompt}
                </div>
              ) : (
                <div className="min-h-9 flex flex-wrap items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  {selectedLines.map((lineId, idx) => (
                    <div key={`${lineId}-${idx}`} className="flex items-center gap-1.5">
                      {idx > 0 && (
                        <ArrowRight className="w-3 h-3 text-zinc-400 shrink-0" />
                      )}
                      <LineBadge
                        lineId={lineId}
                        mode={network.lines[lineId]?.mode}
                        size="sm"
                        interactive
                        onClick={() => onRemoveLineAt(idx)}
                        title={t.undo}
                      />
                    </div>
                  ))}
                  <Flag className="w-3.5 h-3.5 text-rose-500 shrink-0 ml-0.5" />
                </div>
              )}
            </div>

            {/* Inline error feedback on invalid sequence */}
            {lastInvalidAttempt?.error && (
              <div className="flex items-start gap-2 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 px-3 py-2 text-xs text-rose-700 dark:text-rose-300">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span className="font-medium">
                  {t.validationError(lastInvalidAttempt.error)}
                </span>
              </div>
            )}

            {/* Line Picker */}
            <div className="space-y-2.5">
              {/* U-Bahn */}
              <div>
                <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 mb-1.5">
                  {t.ubahn}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {ubahnLines.map((id) => (
                    <LineBadge
                      key={id}
                      lineId={id}
                      mode="ubahn"
                      size="md"
                      interactive
                      selected={selectedLines[selectedLines.length - 1] === id}
                      onClick={() => onAddLine(id)}
                    />
                  ))}
                </div>
              </div>

              {/* S-Bahn */}
              <div>
                <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 mb-1.5">
                  {t.sbahn}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {sbahnLines.map((id) => (
                    <LineBadge
                      key={id}
                      lineId={id}
                      mode="sbahn"
                      size="md"
                      interactive
                      selected={selectedLines[selectedLines.length - 1] === id}
                      onClick={() => onAddLine(id)}
                    />
                  ))}
                </div>
              </div>

              {/* Tram (only in U+S+Tram mode) */}
              {tramLines.length > 0 && (
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 mb-1.5">
                    {t.tram}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {tramLines.map((id) => (
                      <LineBadge
                        key={id}
                        lineId={id}
                        mode="tram"
                        size="sm"
                        interactive
                        selected={selectedLines[selectedLines.length - 1] === id}
                        onClick={() => onAddLine(id)}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                disabled={selectedLines.length === 0}
                onClick={onSubmit}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-950 font-bold text-sm py-2.5 px-4 shadow-sm hover:bg-zinc-800 dark:hover:bg-zinc-200 disabled:opacity-35 disabled:cursor-not-allowed transition-all cursor-pointer"
              >
                <Check className="w-4 h-4" />
                {t.submit}
              </button>
              <button
                type="button"
                onClick={onGiveUp}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 font-semibold text-xs py-2.5 px-3 transition-colors cursor-pointer"
                title={t.giveUp}
              >
                <Eye className="w-3.5 h-3.5" />
                {t.giveUp}
              </button>
            </div>
          </>
        ) : (
          /* === REVEALED RESULT STATE === */
          <div className="space-y-3">
            {/* Grade Banner */}
            <div
              className={`flex items-center justify-between gap-2 rounded-xl border px-3 py-2.5 ${gradeBadgeClasses(
                currentResult.grade,
              )}`}
            >
              <div className="flex items-center gap-2 font-display font-bold text-sm">
                <Sparkles className="w-4 h-4 shrink-0" />
                <span>{t.gradeLabel[currentResult.grade]}</span>
              </div>
              <div className="text-xs font-semibold">
                {currentResult.playerRoute === null
                  ? t.noRouteSubmitted
                  : deltaMin !== null && deltaMin <= 0
                    ? t.exactMatch
                    : deltaMin !== null
                      ? t.slowerBy(deltaMin)
                      : ''}
              </div>
            </div>

            {/* Route cards */}
            <div className="space-y-2">
              {currentResult.playerRoute && (
                <RouteBreakdownCard
                  title={t.yourRoute}
                  route={currentResult.playerRoute}
                  network={network}
                  t={t}
                  accent="player"
                  active={
                    highlightedRoute === 'both' || highlightedRoute === 'player'
                  }
                  onClick={
                    sameLinesAsOptimal
                      ? undefined
                      : () =>
                          onChangeHighlightedRoute(
                            highlightedRoute === 'player' ? 'both' : 'player',
                          )
                  }
                />
              )}

              {!sameLinesAsOptimal && (
                <RouteBreakdownCard
                  title={t.optimalRoute}
                  route={currentResult.optimalRoute}
                  network={network}
                  t={t}
                  accent="optimal"
                  active={
                    highlightedRoute === 'both' || highlightedRoute === 'optimal'
                  }
                  onClick={
                    currentResult.playerRoute
                      ? () =>
                          onChangeHighlightedRoute(
                            highlightedRoute === 'optimal' ? 'both' : 'optimal',
                          )
                      : undefined
                  }
                />
              )}
            </div>

            {/* Next Round / Summary / New Trip CTA */}
            <button
              type="button"
              onClick={isLastDailyRound ? onOpenSummary : onNextRound}
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-950 font-bold text-sm py-2.5 px-4 shadow-sm hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-all cursor-pointer"
            >
              {gameMode === 'free' ? (
                <>
                  <RefreshCw className="w-4 h-4" />
                  {t.newRound}
                </>
              ) : isLastDailyRound ? (
                <>
                  <Trophy className="w-4 h-4" />
                  {t.viewSummary}
                </>
              ) : (
                <>
                  {t.nextRound}
                  <ChevronRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
