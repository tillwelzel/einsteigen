import { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  Check,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Clock,
  Delete,
  Eye,
  Flag,
  MapPin,
  RefreshCw,
  RotateCcw,
  Shuffle,
  SlidersHorizontal,
  TramFront,
  Trophy,
} from 'lucide-react';
import { sortLineIds } from '../data/mvg-colors';
import { DAILY_ROUNDS_COUNT } from '../engine/puzzle-generator';
import type { Translations } from '../i18n';
import {
  ALL_MVV_ZONES,
  type AttemptRecord,
  type CompletedRound,
  type ComputedRoute,
  type DailyProgress,
  type FreePlayConfig,
  type FreePlayDifficulty,
  type GameMode,
  type MunichNetwork,
  type MvvZone,
  type NetworkMode,
  type Puzzle,
  type RoundGrade,
} from '../types';
import { LineBadge } from './LineBadge';

interface GamePanelProps {
  t: Translations;
  network: MunichNetwork;
  gameMode: GameMode;
  networkMode: NetworkMode;
  onChangeNetworkMode: (mode: NetworkMode) => void;
  freePlayConfig: FreePlayConfig;
  onUpdateFreePlayConfig: (patch: Partial<FreePlayConfig>) => void;
  freePlayStationCount: number;
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
  isCollapsed?: boolean;
  onToggleCollapsed?: () => void;
  onMobileHeightChange?: (height: number) => void;
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
      className={`rounded-xl border p-2.5 md:p-3 transition-all ${
        onClick ? 'cursor-pointer' : ''
      } ${
        active
          ? accent === 'player'
            ? 'border-blue-500/70 bg-blue-50/60 dark:bg-blue-950/25 shadow-xs'
            : 'border-emerald-500/70 bg-emerald-50/60 dark:bg-emerald-950/25 shadow-xs'
          : 'border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900/50 hover:border-zinc-300 dark:hover:border-zinc-700'
      }`}
    >
      <div className="flex items-center justify-between gap-2 mb-1.5 md:mb-2">
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] md:text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            {title}
          </span>
          {badgeText && (
            <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded-md bg-zinc-200/80 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
              {badgeText}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 md:gap-2 text-[11px] md:text-xs font-semibold text-zinc-700 dark:text-zinc-200">
          <span className="inline-flex items-center gap-1">
            <Clock className="w-3 h-3 md:w-3.5 md:h-3.5 text-zinc-400" />
            {t.minutes(formatMin(route.totalTimeSec))}
          </span>
          <span className="text-zinc-300 dark:text-zinc-700">·</span>
          <span className="text-zinc-500 dark:text-zinc-400">
            {t.transfers(route.transfers)}
          </span>
        </div>
      </div>

      {/* Sequence of line badges + transfer hubs */}
      <div className="space-y-1 md:space-y-1.5">
        {route.legs.map((leg, i) => {
          const fromName =
            network.stations[leg.fromStationId]?.name ?? leg.fromStationId;
          const toName =
            network.stations[leg.toStationId]?.name ?? leg.toStationId;
          const stopsCount = Math.max(0, leg.stationIds.length - 1);
          const legMin = formatMin(leg.rideTimeSec);
          const line = network.lines[leg.lineId];

          return (
            <div
              key={`${leg.lineId}-${i}`}
              className="flex items-center gap-1.5 md:gap-2 text-xs"
            >
              <LineBadge lineId={leg.lineId} mode={line?.mode} size="xs" />
              <div className="min-w-0 flex-1 truncate text-zinc-700 dark:text-zinc-200">
                <span className="font-medium">{fromName}</span>
                <span className="mx-1 text-zinc-400">→</span>
                <span className="font-medium">{toName}</span>
              </div>
              <span className="text-[11px] text-zinc-400 shrink-0 tabular-nums">
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
  onChangeNetworkMode,
  freePlayConfig,
  onUpdateFreePlayConfig,
  freePlayStationCount,
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
  isCollapsed = false,
  onToggleCollapsed,
  onMobileHeightChange,
}: GamePanelProps) {
  const [showFreeOptions, setShowFreeOptions] = useState(false);
  const [mobilePickerTab, setMobilePickerTab] = useState<'us' | 'tram'>('us');
  const panelRef = useRef<HTMLElement | null>(null);
  const touchStartYRef = useRef<number | null>(null);

  // Reset mobile picker tab when switching away from Tram mode or moving to a new puzzle
  useEffect(() => {
    if (networkMode === 'us') {
      setMobilePickerTab('us');
    }
  }, [networkMode]);

  useEffect(() => {
    setMobilePickerTab('us');
  }, [puzzle.id]);

  // Measure sheet height on mobile so MapView dynamically frames the visible map above it
  useEffect(() => {
    const el = panelRef.current;
    if (!el || !onMobileHeightChange) return;

    const report = () => {
      if (window.innerWidth < 768) {
        onMobileHeightChange(Math.round(el.getBoundingClientRect().height));
      } else {
        onMobileHeightChange(0);
      }
    };

    report();
    const ro = new ResizeObserver(report);
    ro.observe(el);
    window.addEventListener('resize', report);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', report);
    };
  }, [onMobileHeightChange]);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartYRef.current = e.touches[0]?.clientY ?? null;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartYRef.current === null || !onToggleCollapsed) return;
    const endY = e.changedTouches[0]?.clientY;
    if (endY === undefined) return;
    const deltaY = endY - touchStartYRef.current;
    touchStartYRef.current = null;

    if (!isCollapsed && deltaY > 36) {
      onToggleCollapsed();
    } else if (isCollapsed && deltaY < -36) {
      onToggleCollapsed();
    }
  };

  const fromSt = network.stations[puzzle.fromStationId];
  const toSt = network.stations[puzzle.toStationId];

  const isAllZones = freePlayConfig.zones.length === ALL_MVV_ZONES.length;

  const handleToggleZone = (zone: MvvZone) => {
    if (isAllZones) {
      onUpdateFreePlayConfig({ zones: [zone] });
      return;
    }
    const exists = freePlayConfig.zones.includes(zone);
    if (exists) {
      const next = freePlayConfig.zones.filter((z) => z !== zone);
      onUpdateFreePlayConfig({
        zones: next.length > 0 ? next : [...ALL_MVV_ZONES],
      });
    } else {
      onUpdateFreePlayConfig({
        zones: [...freePlayConfig.zones, zone],
      });
    }
  };

  const difficultyOptions: { value: FreePlayDifficulty; label: string }[] = [
    { value: 'any', label: t.freePlayDifficultyAny },
    { value: 'easy', label: t.difficulty.easy },
    { value: 'medium', label: t.difficulty.medium },
    { value: 'hard', label: t.difficulty.hard },
  ];

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
    <aside
      ref={panelRef}
      className="fixed z-20 inset-x-0 bottom-0 md:inset-x-auto md:left-3 md:top-[4.4rem] md:bottom-auto md:w-[416px] max-h-[62dvh] md:max-h-[calc(100dvh-5.5rem)] flex flex-col bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xl border-t border-x md:border border-zinc-200/80 dark:border-zinc-800 rounded-t-3xl md:rounded-2xl shadow-2xl shadow-black/15 overflow-hidden"
    >
      {/* Mobile-only sheet drag/tap handle bar */}
      <div
        className="md:hidden shrink-0 flex items-center justify-between px-3.5 pt-2 pb-1 touch-none"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <div className="w-16" aria-hidden="true" />
        <button
          type="button"
          onClick={onToggleCollapsed}
          aria-label={isCollapsed ? t.expandSheetAria : t.collapseSheetAria}
          className="flex items-center justify-center px-6 py-1 -my-1 cursor-pointer"
        >
          <span className="w-10 h-1 rounded-full bg-zinc-300 dark:bg-zinc-700" />
        </button>
        <button
          type="button"
          onClick={onToggleCollapsed}
          aria-label={isCollapsed ? t.expandSheetAria : t.collapseSheetAria}
          className="inline-flex items-center justify-end gap-0.5 w-16 text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 active:text-zinc-900 dark:active:text-white cursor-pointer"
        >
          <span>{isCollapsed ? t.showPanel : t.showMap}</span>
          {isCollapsed ? (
            <ChevronUp className="w-3.5 h-3.5" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5" />
          )}
        </button>
      </div>

      {/* Mobile-only collapsed peek bar (gives 80%+ of screen to the map) */}
      {isCollapsed && (
        <div
          className="md:hidden px-3.5 pt-1 safe-bottom"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          <div className="flex items-center justify-between gap-2.5">
            <button
              type="button"
              onClick={onToggleCollapsed}
              className="flex-1 min-w-0 text-left space-y-1 cursor-pointer"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
                <span className="font-display font-bold text-sm text-zinc-900 dark:text-white truncate">
                  {fromSt?.name}
                </span>
              </div>
              <div className="flex items-center gap-2 min-w-0">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shrink-0" />
                <span className="font-display font-bold text-sm text-zinc-900 dark:text-white truncate">
                  {toSt?.name}
                </span>
              </div>
            </button>

            <div className="shrink-0 flex items-center gap-1.5">
              {isRevealed ? (
                <>
                  <span
                    className={`text-[11px] font-bold px-2 py-1 rounded-lg border ${gradeBadgeClasses(
                      currentResult.grade,
                    )}`}
                  >
                    {t.gradeLabel[currentResult.grade]}
                  </span>
                  <button
                    type="button"
                    onClick={isLastDailyRound ? onOpenSummary : onNextRound}
                    className="inline-flex items-center gap-1 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-950 font-bold text-xs py-2 px-3 shadow-xs cursor-pointer"
                  >
                    {gameMode === 'free' ? (
                      <RefreshCw className="w-3.5 h-3.5" />
                    ) : isLastDailyRound ? (
                      <Trophy className="w-3.5 h-3.5" />
                    ) : (
                      <ChevronRight className="w-3.5 h-3.5" />
                    )}
                    <span>
                      {gameMode === 'free'
                        ? t.newRound
                        : isLastDailyRound
                          ? t.viewSummary
                          : t.nextRound}
                    </span>
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={onToggleCollapsed}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-950 font-bold text-xs py-2 px-3 shadow-xs cursor-pointer"
                >
                  <span>{t.showPanel}</span>
                  {selectedLines.length > 0 && (
                    <span className="px-1.5 py-0.5 rounded-full bg-white/20 dark:bg-black/15 text-[10px] leading-none">
                      {selectedLines.length}
                    </span>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Expanded panel content (always visible on md+ desktop, hidden on mobile when collapsed) */}
      <div
        className={
          isCollapsed
            ? 'hidden md:flex md:flex-col md:min-h-0 md:flex-1'
            : 'flex flex-col min-h-0 flex-1'
        }
      >
        {/* Top progress strip for Daily mode */}
        {gameMode === 'daily' && (
          <div className="shrink-0 flex items-center justify-between px-3.5 py-1.5 md:px-4 md:pt-3 md:pb-2 border-b border-zinc-100 dark:border-zinc-800/80">
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
                    className={`w-5.5 h-5.5 md:w-6 md:h-6 rounded-full text-[11px] font-bold border transition-all flex items-center justify-center ${gradeDotClasses(
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
                  <span className="hidden sm:inline">{t.viewSummary}</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* Top controls strip for Free Play mode */}
        {gameMode === 'free' && (
          <div className="shrink-0 border-b border-zinc-100 dark:border-zinc-800/80">
            <div className="flex items-center justify-between gap-2 px-3.5 py-1.5 md:px-4 md:pt-3 md:pb-2">
              {/* Active filter summary pills (clicking opens options) */}
              <button
                type="button"
                onClick={() => setShowFreeOptions((v) => !v)}
                className="flex flex-wrap items-center gap-1 md:gap-1.5 min-w-0 text-left cursor-pointer group"
                aria-expanded={showFreeOptions}
              >
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 group-hover:bg-zinc-200/80 dark:group-hover:bg-zinc-700/80 transition-colors">
                  {isAllZones
                    ? t.freePlayAllZones
                    : t.freePlayZonesSummary(freePlayConfig.zones)}
                </span>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 group-hover:bg-zinc-200/80 dark:group-hover:bg-zinc-700/80 transition-colors">
                  {freePlayConfig.difficulty === 'any'
                    ? t.difficulty[puzzle.difficulty]
                    : t.difficulty[freePlayConfig.difficulty]}
                </span>
                <span
                  className={`text-[11px] font-bold px-2 py-0.5 rounded-full transition-colors ${
                    networkMode === 'ust'
                      ? 'bg-[#e30613]/15 text-[#e30613] dark:text-red-400'
                      : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400'
                  }`}
                >
                  {networkMode === 'ust' ? '+Tram' : t.modeUS}
                </span>
              </button>

              {/* Right controls: New trip + Options toggle */}
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={onNextRound}
                  className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                  title={t.newRound}
                  aria-label={t.newRound}
                >
                  <Shuffle className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setShowFreeOptions((v) => !v)}
                  aria-expanded={showFreeOptions}
                  className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold transition-colors cursor-pointer ${
                    showFreeOptions
                      ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-950'
                      : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-200/80 dark:hover:bg-zinc-700/80'
                  }`}
                >
                  <SlidersHorizontal className="w-3 h-3" />
                  <span>{t.freePlayFilters}</span>
                  <ChevronDown
                    className={`w-3 h-3 transition-transform duration-150 ${
                      showFreeOptions ? 'rotate-180' : ''
                    }`}
                  />
                </button>
              </div>
            </div>

            {/* Collapsible Free Play Filter Drawer */}
            {showFreeOptions && (
              <div className="px-3.5 md:px-4 pb-2.5 md:pb-3 pt-1 space-y-2 md:space-y-2.5 bg-zinc-50/80 dark:bg-zinc-950/40 border-t border-zinc-100 dark:border-zinc-800/80">
                {/* Zones Multi-Select */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                      {t.freePlayZonesLabel}
                    </span>
                    <span className="text-[10px] font-medium text-zinc-400 dark:text-zinc-500 tabular-nums">
                      {t.freePlayStationsCount(freePlayStationCount)}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() =>
                        onUpdateFreePlayConfig({ zones: [...ALL_MVV_ZONES] })
                      }
                      aria-pressed={isAllZones}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        isAllZones
                          ? 'bg-[#0065ae] text-white shadow-xs'
                          : 'bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-300 hover:border-zinc-300 dark:hover:border-zinc-700'
                      }`}
                    >
                      {t.freePlayAllZones}
                    </button>
                    {ALL_MVV_ZONES.map((zone) => {
                      const active =
                        !isAllZones && freePlayConfig.zones.includes(zone);
                      return (
                        <button
                          key={zone}
                          type="button"
                          onClick={() => handleToggleZone(zone)}
                          aria-pressed={active}
                          className={`flex-1 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                            active
                              ? 'bg-[#0065ae] text-white shadow-xs'
                              : 'bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-300 hover:border-zinc-300 dark:hover:border-zinc-700'
                          }`}
                        >
                          {zone}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Difficulty Segmented Control */}
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1">
                    {t.freePlayDifficultyLabel}
                  </div>
                  <div className="grid grid-cols-4 bg-zinc-200/70 dark:bg-zinc-900 p-0.5 rounded-xl gap-0.5 text-[11px] font-semibold">
                    {difficultyOptions.map((opt) => {
                      const active = freePlayConfig.difficulty === opt.value;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() =>
                            onUpdateFreePlayConfig({ difficulty: opt.value })
                          }
                          aria-pressed={active}
                          className={`py-1 rounded-lg transition-all cursor-pointer ${
                            active
                              ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-xs'
                              : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
                          }`}
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Include Tram Switch */}
                <div className="flex items-center justify-between gap-2 pt-0.5">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-700 dark:text-zinc-200">
                    <TramFront
                      className={`w-3.5 h-3.5 ${
                        networkMode === 'ust'
                          ? 'text-[#e30613]'
                          : 'text-zinc-400 dark:text-zinc-500'
                      }`}
                    />
                    <span>{t.freePlayIncludeTram}</span>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={networkMode === 'ust'}
                    onClick={() =>
                      onChangeNetworkMode(networkMode === 'ust' ? 'us' : 'ust')
                    }
                    className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors cursor-pointer ${
                      networkMode === 'ust'
                        ? 'bg-[#e30613]'
                        : 'bg-zinc-300 dark:bg-zinc-700'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 rounded-full bg-white shadow-xs transition-transform ${
                        networkMode === 'ust' ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Scrollable interior */}
        <div className="overflow-y-auto overscroll-contain px-3.5 py-2.5 md:px-4 md:py-3.5 space-y-2.5 md:space-y-3.5 flex-1 min-h-0">
          {/* Start -> Destination Station Header */}
          <div className="flex items-stretch gap-2.5 md:gap-3">
            <div className="flex flex-col items-center py-1 md:py-1.5">
              <span className="w-2.5 h-2.5 md:w-3 md:h-3 rounded-full bg-emerald-500 ring-3 md:ring-4 ring-emerald-500/20 shrink-0" />
              <span className="w-0.5 flex-1 bg-gradient-to-b from-emerald-500/50 to-rose-500/50 my-0.5 md:my-1 rounded-full" />
              <span className="w-2.5 h-2.5 md:w-3 md:h-3 rounded-full bg-rose-500 ring-3 md:ring-4 ring-rose-500/20 shrink-0" />
            </div>
            <div className="flex-1 min-w-0 space-y-1 md:space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="hidden md:block text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                    {t.from}
                  </div>
                  <div className="font-display font-bold text-[15px] md:text-lg leading-tight truncate text-zinc-900 dark:text-white">
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
                  <div className="hidden md:block text-[10px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400">
                    {t.to}
                  </div>
                  <div className="font-display font-bold text-[15px] md:text-lg leading-tight truncate text-zinc-900 dark:text-white">
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
              <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/90 dark:bg-zinc-950/60 px-2.5 py-2 md:p-2.5">
                {/* Desktop header row */}
                <div className="hidden md:flex items-center justify-between mb-2">
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

                {/* Unified sequence row (compact inline controls on mobile) */}
                <div className="flex items-center justify-between gap-2 min-h-7 md:min-h-9">
                  {selectedLines.length === 0 ? (
                    <div className="flex items-center text-xs text-zinc-400 dark:text-zinc-500 italic px-0.5 truncate">
                      {t.pickLinesPrompt}
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-center gap-1 md:gap-1.5 min-w-0">
                      <MapPin className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                      {selectedLines.map((lineId, idx) => (
                        <div
                          key={`${lineId}-${idx}`}
                          className="flex items-center gap-1 md:gap-1.5"
                        >
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

                  {/* Mobile inline tries + undo/clear */}
                  <div className="flex md:hidden items-center gap-1 shrink-0">
                    {selectedLines.length > 0 ? (
                      <>
                        <button
                          type="button"
                          onClick={onRemoveLastLine}
                          className="p-1.5 rounded-lg text-zinc-500 active:text-zinc-900 dark:active:text-white bg-zinc-200/60 dark:bg-zinc-800/80 transition-colors cursor-pointer"
                          title={t.undo}
                          aria-label={t.undo}
                        >
                          <Delete className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={onClearLines}
                          className="p-1.5 rounded-lg text-zinc-500 active:text-zinc-900 dark:active:text-white bg-zinc-200/60 dark:bg-zinc-800/80 transition-colors cursor-pointer"
                          title={t.clear}
                          aria-label={t.clear}
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                        </button>
                      </>
                    ) : (
                      <span className="text-[11px] font-medium text-zinc-400 whitespace-nowrap">
                        {t.attemptsLeft(attemptsLeft)}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Inline error feedback on invalid sequence */}
              {lastInvalidAttempt?.error && (
                <div className="flex items-start gap-2 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 px-2.5 py-1.5 md:px-3 md:py-2 text-xs text-rose-700 dark:text-rose-300">
                  <AlertCircle className="w-3.5 h-3.5 md:w-4 md:h-4 shrink-0 mt-0.5" />
                  <span className="font-medium leading-snug">
                    {t.validationError(lastInvalidAttempt.error)}
                  </span>
                </div>
              )}

              {/* Mobile-only U+S / Tram picker tab bar when Tram mode is enabled */}
              {tramLines.length > 0 && (
                <div className="md:hidden grid grid-cols-2 bg-zinc-100 dark:bg-zinc-800/90 p-0.5 rounded-xl text-xs font-bold gap-0.5">
                  <button
                    type="button"
                    onClick={() => setMobilePickerTab('us')}
                    className={`py-1.5 rounded-lg transition-all cursor-pointer ${
                      mobilePickerTab === 'us'
                        ? 'bg-white dark:bg-zinc-950 text-zinc-900 dark:text-white shadow-xs'
                        : 'text-zinc-500 dark:text-zinc-400'
                    }`}
                  >
                    {t.modeUS}
                  </button>
                  <button
                    type="button"
                    onClick={() => setMobilePickerTab('tram')}
                    className={`inline-flex items-center justify-center gap-1.5 py-1.5 rounded-lg transition-all cursor-pointer ${
                      mobilePickerTab === 'tram'
                        ? 'bg-[#e30613] text-white shadow-xs'
                        : 'text-zinc-500 dark:text-zinc-400'
                    }`}
                  >
                    <TramFront className="w-3.5 h-3.5" />
                    <span>
                      {t.tram} ({tramLines.length})
                    </span>
                  </button>
                </div>
              )}

              {/* Line Picker */}
              <div className="space-y-2 md:space-y-2.5">
                {/* U-Bahn */}
                <div
                  className={
                    tramLines.length > 0 && mobilePickerTab === 'tram'
                      ? 'hidden md:block'
                      : ''
                  }
                >
                  <div className="text-[10px] md:text-[11px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 mb-1 md:mb-1.5">
                    {t.ubahn}
                  </div>
                  <div className="grid grid-cols-6 gap-1.5 md:flex md:flex-wrap">
                    {ubahnLines.map((id) => (
                      <LineBadge
                        key={id}
                        lineId={id}
                        mode="ubahn"
                        size="md"
                        interactive
                        selected={selectedLines[selectedLines.length - 1] === id}
                        onClick={() => onAddLine(id)}
                        className="w-full min-w-0 px-1 md:w-auto md:min-w-11 md:px-2.5"
                      />
                    ))}
                  </div>
                </div>

                {/* S-Bahn */}
                <div
                  className={
                    tramLines.length > 0 && mobilePickerTab === 'tram'
                      ? 'hidden md:block'
                      : ''
                  }
                >
                  <div className="text-[10px] md:text-[11px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 mb-1 md:mb-1.5">
                    {t.sbahn}
                  </div>
                  <div className="grid grid-cols-5 gap-1.5 md:flex md:flex-wrap">
                    {sbahnLines.map((id) => (
                      <LineBadge
                        key={id}
                        lineId={id}
                        mode="sbahn"
                        size="md"
                        interactive
                        selected={selectedLines[selectedLines.length - 1] === id}
                        onClick={() => onAddLine(id)}
                        className="w-full min-w-0 px-1 md:w-auto md:min-w-11 md:px-2.5"
                      />
                    ))}
                  </div>
                </div>

                {/* Tram (only in U+S+Tram mode) */}
                {tramLines.length > 0 && (
                  <div
                    className={
                      mobilePickerTab === 'us' ? 'hidden md:block' : ''
                    }
                  >
                    <div className="hidden md:block text-[11px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 mb-1.5">
                      {t.tram}
                    </div>
                    <div className="grid grid-cols-6 gap-1.5 md:flex md:flex-wrap">
                      {tramLines.map((id) => (
                        <LineBadge
                          key={id}
                          lineId={id}
                          mode="tram"
                          size="md"
                          interactive
                          selected={
                            selectedLines[selectedLines.length - 1] === id
                          }
                          onClick={() => onAddLine(id)}
                          className="w-full min-w-0 px-1 md:w-auto md:h-6 md:min-w-9 md:px-2"
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            /* === REVEALED RESULT STATE === */
            <div className="space-y-2.5 md:space-y-3">
              {/* Grade Banner */}
              <div
                className={`flex items-center justify-between gap-2 rounded-xl border px-3 py-2 md:py-2.5 ${gradeBadgeClasses(
                  currentResult.grade,
                )}`}
              >
                <div className="flex items-center gap-1.5 font-display font-bold text-sm">
                  {currentResult.grade === 'optimal' && (
                    <Check className="w-4 h-4 shrink-0" />
                  )}
                  <span>{t.gradeLabel[currentResult.grade]}</span>
                </div>
                <div className="text-xs font-semibold">
                  {currentResult.playerRoute === null
                    ? t.noRouteSubmitted
                    : deltaMin !== null && deltaMin <= 0
                      ? sameLinesAsOptimal
                        ? t.exactMatch
                        : t.sameDurationTie
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
                      highlightedRoute === 'both' ||
                      highlightedRoute === 'optimal'
                    }
                    onClick={
                      currentResult.playerRoute
                        ? () =>
                            onChangeHighlightedRoute(
                              highlightedRoute === 'optimal'
                                ? 'both'
                                : 'optimal',
                            )
                        : undefined
                    }
                  />
                )}
              </div>
            </div>
          )}
        </div>

        {/* Sticky Footer CTA Bar (always visible & thumb-reachable) */}
        <div className="shrink-0 px-3.5 pt-2 safe-bottom md:px-4 md:py-3 border-t border-zinc-100 dark:border-zinc-800/80 bg-white/85 dark:bg-zinc-900/85">
          {!isRevealed ? (
            <div className="flex items-center gap-2">
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
          ) : (
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
          )}
        </div>
      </div>
    </aside>
  );
}
