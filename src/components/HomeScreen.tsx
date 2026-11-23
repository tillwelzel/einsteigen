import { useEffect, useRef } from 'react';
import { Calendar, EyeOff, Play, Shuffle, TrainFront } from 'lucide-react';
import { DAILY_ROUNDS_COUNT } from '../engine/puzzle-generator';
import type { Translations } from '../i18n';
import type {
  DailyProgress,
  GameMode,
  MunichNetwork,
  NetworkMode,
} from '../types';
import { LineBadge } from './LineBadge';

interface HomeScreenProps {
  t: Translations;
  network: MunichNetwork;
  networkMode: NetworkMode;
  onChangeNetworkMode: (mode: NetworkMode) => void;
  dailyProgress: DailyProgress;
  onStartGame: (mode: GameMode) => void;
  onMobileHeightChange?: (height: number) => void;
}

const PREVIEW_UBAHN = ['U1', 'U2', 'U3', 'U4', 'U5', 'U6'];
const PREVIEW_SBAHN = ['S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8'];

export function HomeScreen({
  t,
  network,
  networkMode,
  onChangeNetworkMode,
  dailyProgress,
  onStartGame,
  onMobileHeightChange,
}: HomeScreenProps) {
  const sectionRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const el = sectionRef.current;
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

  const totalLines = Object.keys(network.lines).length;
  const totalStations = Object.keys(network.stations).length;
  const dailyDoneCount = dailyProgress.rounds.length;
  const hasDailyInProgress =
    dailyDoneCount > 0 && dailyDoneCount < DAILY_ROUNDS_COUNT;

  return (
    <section
      ref={sectionRef}
      aria-label={t.appName}
      className="animate-surface-in fixed z-20 inset-x-0 bottom-0 md:inset-x-auto md:left-4 md:top-1/2 md:-translate-y-1/2 md:bottom-auto md:w-[404px] max-h-[68dvh] md:max-h-[calc(100dvh-2rem)] overflow-y-auto bg-white/94 dark:bg-zinc-900/94 backdrop-blur-xl border-t border-x md:border border-zinc-200/80 dark:border-zinc-800 rounded-t-3xl md:rounded-3xl px-4 pt-3.5 safe-bottom md:p-6 shadow-2xl shadow-black/15"
    >
      {/* Brand header */}
      <div className="flex items-center justify-between gap-2.5">
        <div className="flex items-center gap-2.5 md:gap-3 min-w-0">
          <div className="w-9 h-9 md:w-11 md:h-11 rounded-xl md:rounded-2xl bg-[#0065ae] text-white flex items-center justify-center shadow-md shadow-blue-900/20 shrink-0">
            <TrainFront className="w-5 h-5 md:w-6 md:h-6" />
          </div>
          <div className="min-w-0">
            <h1 className="font-display font-extrabold text-xl md:text-2xl tracking-tight text-zinc-900 dark:text-white leading-none">
              {t.appName}
            </h1>
            <p className="text-[11px] md:text-xs font-medium text-zinc-500 dark:text-zinc-400 mt-0.5 md:mt-1 truncate">
              {t.tagline}
            </p>
          </div>
        </div>
        <span className="text-[10px] md:text-[11px] font-semibold px-2 md:px-2.5 py-0.5 md:py-1 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 shrink-0 whitespace-nowrap">
          {t.homeStatsBadge(totalLines, totalStations)}
        </span>
      </div>

      {/* Pitch */}
      <p className="mt-2.5 md:mt-4 text-xs sm:text-sm leading-snug md:leading-relaxed text-zinc-600 dark:text-zinc-300">
        {t.homeSubtitle}
      </p>

      {/* Iconic Munich lines strip (desktop — on mobile the live map shines above) */}
      <div className="hidden md:flex mt-4 flex-wrap items-center gap-1">
        {PREVIEW_UBAHN.map((id) => (
          <LineBadge key={id} lineId={id} mode="ubahn" size="xs" />
        ))}
        {PREVIEW_SBAHN.map((id) => (
          <LineBadge key={id} lineId={id} mode="sbahn" size="xs" />
        ))}
        {networkMode === 'ust' && (
          <span className="inline-flex items-center h-5 px-1.5 rounded-sm text-[11px] font-bold bg-[#e30613] text-white">
            +Tram
          </span>
        )}
      </div>

      {/* Network Mode Selector */}
      <div className="mt-3 md:mt-5">
        <div className="hidden md:block text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1.5">
          {t.homeNetworkLabel}
        </div>
        <div className="grid grid-cols-2 bg-zinc-100 dark:bg-zinc-800/90 p-1 rounded-xl text-xs font-semibold gap-1">
          <button
            type="button"
            onClick={() => onChangeNetworkMode('us')}
            className={`py-1.5 md:py-2 rounded-lg transition-all cursor-pointer ${networkMode === 'us'
                ? 'bg-white dark:bg-zinc-950 text-zinc-900 dark:text-white shadow-xs'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
              }`}
          >
            {t.modeUS}
          </button>
          <button
            type="button"
            onClick={() => onChangeNetworkMode('ust')}
            className={`py-1.5 md:py-2 rounded-lg transition-all cursor-pointer ${networkMode === 'ust'
                ? 'bg-[#e30613] text-white shadow-xs'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
              }`}
          >
            {t.modeUST}
          </button>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="mt-3 md:mt-5 flex flex-col gap-2 md:gap-2.5">
        <button
          type="button"
          onClick={() => onStartGame('daily')}
          className="w-full flex items-center justify-between gap-3 px-4 py-2.5 md:py-3 rounded-2xl bg-[#0065ae] hover:bg-[#005799] active:scale-[0.99] text-white font-semibold text-sm shadow-lg shadow-blue-900/20 transition-all cursor-pointer"
        >
          <span className="flex items-center gap-2.5">
            <Calendar className="w-4 h-4 shrink-0" />
            <span>
              {hasDailyInProgress ? t.homeContinueDaily : t.homePlayDaily}
            </span>
          </span>
          <span className="inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-0.5 rounded-full bg-white/20">
            <span>
              {dailyDoneCount}/{DAILY_ROUNDS_COUNT}
            </span>
            <Play className="w-3 h-3 fill-current" />
          </span>
        </button>

        <button
          type="button"
          onClick={() => onStartGame('free')}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 md:py-2.5 rounded-2xl bg-zinc-100 hover:bg-zinc-200/80 dark:bg-zinc-800 dark:hover:bg-zinc-700/80 active:scale-[0.99] text-zinc-900 dark:text-zinc-100 font-semibold text-sm transition-all cursor-pointer"
        >
          <Shuffle className="w-4 h-4 shrink-0" />
          <span>{t.homePlayFree}</span>
        </button>
      </div>

      {/* Hint about hiding lines */}
      <div className="mt-3 pt-2.5 md:mt-4 md:pt-3.5 border-t border-zinc-200/70 dark:border-zinc-800 flex items-center gap-2 text-[11px] md:text-xs text-zinc-500 dark:text-zinc-400">
        <EyeOff className="w-3.5 h-3.5 shrink-0 text-zinc-400 dark:text-zinc-500" />
        <span>{t.homeHideLinesHint}</span>
      </div>
    </section>
  );
}
