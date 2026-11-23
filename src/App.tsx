import { useEffect, useState } from 'react';
import { LocateFixed, Map as MapIcon, Satellite } from 'lucide-react';
import { DailySummaryModal } from './components/DailySummaryModal';
import { GamePanel } from './components/GamePanel';
import { Header } from './components/Header';
import { HelpModal } from './components/HelpModal';
import { HomeScreen } from './components/HomeScreen';
import { MapView } from './components/MapView';
import { StatsModal } from './components/StatsModal';
import { useGameState } from './hooks/useGameState';
import { useLocale } from './hooks/useLocale';
import { useTheme } from './hooks/useTheme';
import type { GameMode, MapStyleMode } from './types';

const MAP_STYLE_STORAGE_KEY = 'einsteigen-map-style';

export function App() {
  const { isDark, cycleTheme } = useTheme();
  const { locale, toggleLocale, t } = useLocale();
  const game = useGameState();

  const [isHome, setIsHome] = useState(true);
  const [mapStyleMode, setMapStyleMode] = useState<MapStyleMode>(() => {
    try {
      const saved = localStorage.getItem(MAP_STYLE_STORAGE_KEY);
      if (saved === 'standard' || saved === 'satellite') return saved;
    } catch { }
    return 'standard';
  });
  const [showStats, setShowStats] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [highlightedRoute, setHighlightedRoute] = useState<
    'both' | 'player' | 'optimal'
  >('both');
  const [canRecenter, setCanRecenter] = useState(false);
  const [recenterTrigger, setRecenterTrigger] = useState(0);
  const [isSheetCollapsed, setIsSheetCollapsed] = useState(false);
  const [mobileBottomInset, setMobileBottomInset] = useState(0);

  useEffect(() => {
    try {
      localStorage.setItem(MAP_STYLE_STORAGE_KEY, mapStyleMode);
    } catch { }
  }, [mapStyleMode]);

  // Reset route spotlight and mobile sheet state when puzzle changes
  useEffect(() => {
    setHighlightedRoute('both');
    setIsSheetCollapsed(false);
  }, [game.currentPuzzle.id]);

  // Reset collapsed sheet when navigating home
  useEffect(() => {
    if (isHome) {
      setIsSheetCollapsed(false);
    }
  }, [isHome]);

  // Close modals on Escape
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowStats(false);
        setShowHelp(false);
        game.setShowSummaryModal(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [game]);

  const handleStartGame = (mode: GameMode) => {
    game.switchGameMode(mode);
    setIsHome(false);
  };

  return (
    <div className="relative w-full h-dvh overflow-hidden select-none">
      {/* Fullscreen interactive Munich map */}
      <MapView
        network={game.network}
        networkMode={game.networkMode}
        fromStationId={game.currentPuzzle.fromStationId}
        toStationId={game.currentPuzzle.toStationId}
        startLabel={t.from}
        endLabel={t.to}
        isDark={isDark}
        mapStyleMode={mapStyleMode}
        isHome={isHome}
        isRevealed={game.isRevealed}
        playerRoute={game.currentResult?.playerRoute ?? null}
        optimalRoute={game.currentPuzzle.optimalRoute}
        highlightedRoute={highlightedRoute}
        recenterTrigger={recenterTrigger}
        mobileBottomInset={mobileBottomInset}
        isSheetCollapsed={isSheetCollapsed}
        onCanRecenterChange={setCanRecenter}
      />

      {/* Top floating bar */}
      <Header
        t={t}
        locale={locale}
        onToggleLocale={toggleLocale}
        isDark={isDark}
        onToggleTheme={cycleTheme}
        isHome={isHome}
        onGoHome={() => setIsHome(true)}
        gameMode={game.gameMode}
        onChangeGameMode={game.switchGameMode}
        networkMode={game.networkMode}
        onChangeNetworkMode={game.setNetworkMode}
        onOpenStats={() => setShowStats(true)}
        onOpenHelp={() => setShowHelp(true)}
      />

      {/* Floating top-right map controls: basemap toggle + recenter button */}
      <div className="fixed top-[calc(max(0.625rem,env(safe-area-inset-top))+3.1rem)] right-2.5 md:top-[4.4rem] md:right-3 z-20 flex flex-col items-end gap-1.5 md:gap-2 pointer-events-none">
        <div
          role="group"
          aria-label={t.mapStyleAriaLabel}
          className="pointer-events-auto flex items-center bg-white/90 dark:bg-zinc-900/90 backdrop-blur-md border border-zinc-200/80 dark:border-zinc-800 rounded-2xl p-1 shadow-lg shadow-black/5"
        >
          <div className="flex items-center bg-zinc-100 dark:bg-zinc-800/90 p-0.5 rounded-xl text-xs font-semibold">
            <button
              type="button"
              onClick={() => setMapStyleMode('standard')}
              aria-pressed={mapStyleMode === 'standard'}
              aria-label={t.mapStyleStandard}
              title={t.mapStyleStandard}
              className={`flex items-center gap-1.5 px-2 sm:px-2.5 py-1.5 sm:py-1 rounded-lg transition-all cursor-pointer ${mapStyleMode === 'standard'
                  ? 'bg-white dark:bg-zinc-950 text-zinc-900 dark:text-white shadow-xs'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
                }`}
            >
              <MapIcon className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{t.mapStyleStandard}</span>
            </button>
            <button
              type="button"
              onClick={() => setMapStyleMode('satellite')}
              aria-pressed={mapStyleMode === 'satellite'}
              aria-label={t.mapStyleSatellite}
              title={t.mapStyleSatellite}
              className={`flex items-center gap-1.5 px-2 sm:px-2.5 py-1.5 sm:py-1 rounded-lg transition-all cursor-pointer ${mapStyleMode === 'satellite'
                  ? 'bg-white dark:bg-zinc-950 text-zinc-900 dark:text-white shadow-xs'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
                }`}
            >
              <Satellite className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{t.mapStyleSatellite}</span>
            </button>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setRecenterTrigger((n) => n + 1)}
          aria-label={isHome ? t.recenterMunichTitle : t.recenterStationsTitle}
          title={isHome ? t.recenterMunichTitle : t.recenterStationsTitle}
          tabIndex={canRecenter ? 0 : -1}
          aria-hidden={!canRecenter}
          className={`flex items-center gap-1.5 p-2 sm:px-3 sm:py-1.5 rounded-2xl text-xs font-semibold bg-white/92 dark:bg-zinc-900/92 hover:bg-white dark:hover:bg-zinc-800 text-zinc-800 dark:text-zinc-100 backdrop-blur-md border border-zinc-200/80 dark:border-zinc-800 shadow-lg shadow-black/10 active:scale-[0.97] transition-all duration-200 cursor-pointer ${canRecenter
              ? 'pointer-events-auto opacity-100 translate-y-0 scale-100'
              : 'pointer-events-none opacity-0 -translate-y-1.5 scale-95'
            }`}
        >
          <LocateFixed className="w-4 h-4 sm:w-3.5 sm:h-3.5 text-[#0065ae] dark:text-sky-400 shrink-0" />
          <span className="hidden sm:inline">{t.recenterMap}</span>
        </button>
      </div>

      {/* Home Screen or Active Game Card */}
      {isHome ? (
        <HomeScreen
          t={t}
          network={game.network}
          networkMode={game.networkMode}
          onChangeNetworkMode={game.setNetworkMode}
          dailyProgress={game.dailyProgress}
          onStartGame={handleStartGame}
          onMobileHeightChange={setMobileBottomInset}
        />
      ) : (
        <GamePanel
          t={t}
          network={game.network}
          gameMode={game.gameMode}
          networkMode={game.networkMode}
          onChangeNetworkMode={game.setNetworkMode}
          freePlayConfig={game.freePlayConfig}
          onUpdateFreePlayConfig={game.updateFreePlayConfig}
          freePlayStationCount={game.freePlayStationCount}
          puzzle={game.currentPuzzle}
          dailyIndex={game.dailyIndex}
          dailyProgress={game.dailyProgress}
          onSelectDailyRound={game.selectDailyRound}
          selectedLines={game.selectedLines}
          onAddLine={game.addLine}
          onRemoveLastLine={game.removeLastLine}
          onRemoveLineAt={game.removeLineAt}
          onClearLines={game.clearLines}
          onSubmit={game.submitGuess}
          onGiveUp={game.giveUp}
          onNextRound={game.nextRound}
          onOpenSummary={() => game.setShowSummaryModal(true)}
          attemptsLeft={game.attemptsLeft}
          lastInvalidAttempt={game.lastInvalidAttempt}
          currentResult={game.currentResult}
          highlightedRoute={highlightedRoute}
          onChangeHighlightedRoute={setHighlightedRoute}
          isCollapsed={isSheetCollapsed}
          onToggleCollapsed={() => setIsSheetCollapsed((v) => !v)}
          onMobileHeightChange={setMobileBottomInset}
        />
      )}

      {/* Modals */}
      <DailySummaryModal
        open={game.showSummaryModal}
        onClose={() => game.setShowSummaryModal(false)}
        t={t}
        network={game.network}
        progress={game.dailyProgress}
        networkMode={game.networkMode}
        stats={game.stats}
        onInspectRound={(roundIndex) => {
          game.switchGameMode('daily');
          game.selectDailyRound(roundIndex);
          game.setShowSummaryModal(false);
          setIsHome(false);
        }}
        onPlayFreePlay={() => game.switchGameMode('free')}
        onSwitchNetworkMode={game.setNetworkMode}
      />

      <StatsModal
        open={showStats}
        onClose={() => setShowStats(false)}
        t={t}
        stats={game.stats}
      />

      <HelpModal
        open={showHelp}
        onClose={() => setShowHelp(false)}
        t={t}
        feedVersion={game.network.meta.feedVersion}
      />
    </div>
  );
}
export default App;
