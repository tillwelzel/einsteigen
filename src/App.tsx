import { useEffect, useState } from 'react';
import { Map as MapIcon, Satellite } from 'lucide-react';
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
  const { setting: themeSetting, isDark, cycleTheme } = useTheme();
  const { locale, toggleLocale, t } = useLocale();
  const game = useGameState();

  const [isHome, setIsHome] = useState(true);
  const [mapStyleMode, setMapStyleMode] = useState<MapStyleMode>(() => {
    try {
      const saved = localStorage.getItem(MAP_STYLE_STORAGE_KEY);
      if (saved === 'standard' || saved === 'satellite') return saved;
    } catch {}
    return 'standard';
  });
  const [showStats, setShowStats] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [highlightedRoute, setHighlightedRoute] = useState<
    'both' | 'player' | 'optimal'
  >('both');

  useEffect(() => {
    try {
      localStorage.setItem(MAP_STYLE_STORAGE_KEY, mapStyleMode);
    } catch {}
  }, [mapStyleMode]);

  // Reset route spotlight when puzzle changes
  useEffect(() => {
    setHighlightedRoute('both');
  }, [game.currentPuzzle.id]);

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
      />

      {/* Top floating bar */}
      <Header
        t={t}
        locale={locale}
        onToggleLocale={toggleLocale}
        themeSetting={themeSetting}
        onCycleTheme={cycleTheme}
        isHome={isHome}
        onGoHome={() => setIsHome(true)}
        gameMode={game.gameMode}
        onChangeGameMode={game.switchGameMode}
        networkMode={game.networkMode}
        onChangeNetworkMode={game.setNetworkMode}
        onOpenStats={() => setShowStats(true)}
        onOpenHelp={() => setShowHelp(true)}
      />

      {/* Standard / Satellite basemap toggle */}
      <div
        role="group"
        aria-label={t.mapStyleAriaLabel}
        className="fixed top-[4.4rem] right-3 z-20 flex items-center bg-white/90 dark:bg-zinc-900/90 backdrop-blur-md border border-zinc-200/80 dark:border-zinc-800 rounded-2xl p-1 shadow-lg shadow-black/5"
      >
        <div className="flex items-center bg-zinc-100 dark:bg-zinc-800/90 p-0.5 rounded-xl text-xs font-semibold">
          <button
            type="button"
            onClick={() => setMapStyleMode('standard')}
            aria-pressed={mapStyleMode === 'standard'}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
              mapStyleMode === 'standard'
                ? 'bg-white dark:bg-zinc-950 text-zinc-900 dark:text-white shadow-xs'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
            }`}
          >
            <MapIcon className="w-3.5 h-3.5" />
            <span>{t.mapStyleStandard}</span>
          </button>
          <button
            type="button"
            onClick={() => setMapStyleMode('satellite')}
            aria-pressed={mapStyleMode === 'satellite'}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
              mapStyleMode === 'satellite'
                ? 'bg-white dark:bg-zinc-950 text-zinc-900 dark:text-white shadow-xs'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
            }`}
          >
            <Satellite className="w-3.5 h-3.5" />
            <span>{t.mapStyleSatellite}</span>
          </button>
        </div>
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
        />
      ) : (
        <GamePanel
          t={t}
          network={game.network}
          gameMode={game.gameMode}
          networkMode={game.networkMode}
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
