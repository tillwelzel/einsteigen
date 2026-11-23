import { useEffect, useState } from 'react';
import { DailySummaryModal } from './components/DailySummaryModal';
import { GamePanel } from './components/GamePanel';
import { Header } from './components/Header';
import { HelpModal } from './components/HelpModal';
import { MapView } from './components/MapView';
import { StatsModal } from './components/StatsModal';
import { useGameState } from './hooks/useGameState';
import { useLocale } from './hooks/useLocale';
import { useTheme } from './hooks/useTheme';

export function App() {
  const { setting: themeSetting, isDark, cycleTheme } = useTheme();
  const { locale, toggleLocale, t } = useLocale();
  const game = useGameState();

  const [showStats, setShowStats] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [highlightedRoute, setHighlightedRoute] = useState<
    'both' | 'player' | 'optimal'
  >('both');

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

  return (
    <div className="relative w-full h-dvh overflow-hidden select-none">
      {/* Fullscreen interactive Munich map */}
      <MapView
        network={game.network}
        networkMode={game.networkMode}
        fromStationId={game.currentPuzzle.fromStationId}
        toStationId={game.currentPuzzle.toStationId}
        isDark={isDark}
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
        gameMode={game.gameMode}
        onChangeGameMode={game.switchGameMode}
        networkMode={game.networkMode}
        onChangeNetworkMode={game.setNetworkMode}
        onOpenStats={() => setShowStats(true)}
        onOpenHelp={() => setShowHelp(true)}
      />

      {/* Main game card */}
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
