import {
  BarChart3,
  HelpCircle,
  Moon,
  Sun,
  TrainFront,
} from 'lucide-react';
import type { Translations } from '../i18n';
import type { GameMode, Locale, NetworkMode } from '../types';

interface HeaderProps {
  t: Translations;
  locale: Locale;
  onToggleLocale: () => void;
  isDark: boolean;
  onToggleTheme: () => void;
  isHome: boolean;
  onGoHome: () => void;
  gameMode: GameMode;
  onChangeGameMode: (mode: GameMode) => void;
  networkMode: NetworkMode;
  onChangeNetworkMode: (mode: NetworkMode) => void;
  onOpenStats: () => void;
  onOpenHelp: () => void;
}

export function Header({
  t,
  locale,
  onToggleLocale,
  isDark,
  onToggleTheme,
  isHome,
  onGoHome,
  gameMode,
  onChangeGameMode,
  networkMode,
  onChangeNetworkMode,
  onOpenStats,
  onOpenHelp,
}: HeaderProps) {
  const ThemeIcon = isDark ? Sun : Moon;

  return (
    <header className="fixed top-3 inset-x-3 z-20 pointer-events-none flex items-center justify-between gap-2">
      {/* Brand + Mode Switcher (hidden on Home Screen where the welcome card owns mode selection) */}
      {isHome ? (
        <div />
      ) : (
        <div className="pointer-events-auto flex items-center gap-2 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-md border border-zinc-200/80 dark:border-zinc-800 rounded-2xl px-2.5 py-1.5 shadow-lg shadow-black/5">
          <button
            type="button"
            onClick={onGoHome}
            title={t.homeButtonTitle}
            className="flex items-center gap-2 pr-1 rounded-xl hover:opacity-80 active:scale-[0.98] transition-all cursor-pointer"
          >
            <div className="w-7 h-7 rounded-xl bg-[#0065ae] text-white flex items-center justify-center shadow-xs shrink-0">
              <TrainFront className="w-4 h-4" />
            </div>
            <div className="hidden sm:block leading-tight">
              <h1 className="font-display font-extrabold text-base tracking-tight text-zinc-900 dark:text-white">
                {t.appName}
              </h1>
            </div>
          </button>

          {/* Daily / Free Play segmented control */}
          <div className="flex items-center bg-zinc-100 dark:bg-zinc-800/90 p-0.5 rounded-xl text-xs font-semibold">
            <button
              type="button"
              onClick={() => onChangeGameMode('daily')}
              className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                gameMode === 'daily'
                  ? 'bg-white dark:bg-zinc-950 text-zinc-900 dark:text-white shadow-xs'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
              }`}
            >
              {t.daily}
            </button>
            <button
              type="button"
              onClick={() => onChangeGameMode('free')}
              className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                gameMode === 'free'
                  ? 'bg-white dark:bg-zinc-950 text-zinc-900 dark:text-white shadow-xs'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
              }`}
            >
              {t.freePlay}
            </button>
          </div>

          {/* Network Mode Toggle: U+S vs U+S+Tram */}
          <div className="hidden md:flex items-center bg-zinc-100 dark:bg-zinc-800/90 p-0.5 rounded-xl text-xs font-semibold">
            <button
              type="button"
              onClick={() => onChangeNetworkMode('us')}
              className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                networkMode === 'us'
                  ? 'bg-white dark:bg-zinc-950 text-zinc-900 dark:text-white shadow-xs'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
              }`}
            >
              {t.modeUS}
            </button>
            <button
              type="button"
              onClick={() => onChangeNetworkMode('ust')}
              className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                networkMode === 'ust'
                  ? 'bg-[#e30613] text-white shadow-xs'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
              }`}
            >
              {t.modeUST}
            </button>
          </div>
        </div>
      )}

      {/* Right utility controls */}
      <div className="pointer-events-auto flex items-center gap-1 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-md border border-zinc-200/80 dark:border-zinc-800 rounded-2xl p-1 shadow-lg shadow-black/5">
        {/* Compact mobile Tram toggle (only while playing) */}
        {!isHome && (
          <button
            type="button"
            onClick={() =>
              onChangeNetworkMode(networkMode === 'us' ? 'ust' : 'us')
            }
            className={`md:hidden px-2 py-1.5 rounded-xl text-[11px] font-bold transition-colors cursor-pointer ${
              networkMode === 'ust'
                ? 'bg-[#e30613] text-white'
                : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300'
            }`}
            title={networkMode === 'us' ? t.modeUST : t.modeUS}
          >
            {networkMode === 'us' ? 'U+S' : '+Tram'}
          </button>
        )}

        <button
          type="button"
          onClick={onToggleLocale}
          className="px-2 py-1.5 rounded-xl text-xs font-bold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
          aria-label="Toggle language"
          title="DE / EN"
        >
          {locale.toUpperCase()}
        </button>

        <button
          type="button"
          onClick={onOpenStats}
          className="p-2 rounded-xl text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
          aria-label={t.statsTitle}
          title={t.statsTitle}
        >
          <BarChart3 className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={onOpenHelp}
          className="p-2 rounded-xl text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
          aria-label={t.helpTitle}
          title={t.helpTitle}
        >
          <HelpCircle className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={onToggleTheme}
          className="p-2 rounded-xl text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
          aria-label="Toggle theme"
          title={isDark ? t.themeLight : t.themeDark}
        >
          <ThemeIcon className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
}
