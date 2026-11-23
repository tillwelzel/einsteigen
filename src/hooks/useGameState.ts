import { useCallback, useEffect, useMemo, useState } from 'react';
import rawNetwork from '../data/munich-network.json';
import { buildTransitGraph } from '../engine/graph';
import {
  DAILY_ROUNDS_COUNT,
  generateDailyPuzzles,
  generateFreePlayPuzzle,
  getBerlinDateKey,
  isStationInZones,
} from '../engine/puzzle-generator';
import { gradeRoute, validateLineSequence } from '../engine/validator';
import {
  ALL_MVV_ZONES,
  type AttemptRecord,
  type CompletedRound,
  type DailyProgress,
  type FreePlayConfig,
  type FreePlayDifficulty,
  type GameMode,
  type MunichNetwork,
  type MvvZone,
  type NetworkMode,
  type PlayerStats,
  type Puzzle,
} from '../types';

export const MAX_ATTEMPTS = 3;

const DAILY_STORAGE_PREFIX = 'einsteigen-daily-v1:';
const STATS_STORAGE_KEY = 'einsteigen-stats-v1';
const NETWORK_MODE_KEY = 'einsteigen-network-mode';
const FREE_PLAY_CONFIG_KEY = 'einsteigen-freeplay-config-v1';

const DEFAULT_FREE_PLAY_CONFIG: FreePlayConfig = {
  zones: [...ALL_MVV_ZONES],
  difficulty: 'any',
};

function loadFreePlayConfig(): FreePlayConfig {
  try {
    const raw = localStorage.getItem(FREE_PLAY_CONFIG_KEY);
    if (!raw) return DEFAULT_FREE_PLAY_CONFIG;
    const parsed = JSON.parse(raw) as Partial<FreePlayConfig>;
    const validZones = Array.isArray(parsed.zones)
      ? ALL_MVV_ZONES.filter((z) => parsed.zones!.includes(z))
      : [];
    const difficulty: FreePlayDifficulty =
      parsed.difficulty === 'easy' ||
      parsed.difficulty === 'medium' ||
      parsed.difficulty === 'hard' ||
      parsed.difficulty === 'any'
        ? parsed.difficulty
        : 'any';
    return {
      zones: validZones.length > 0 ? validZones : [...ALL_MVV_ZONES],
      difficulty,
    };
  } catch {
    return DEFAULT_FREE_PLAY_CONFIG;
  }
}

function saveFreePlayConfig(config: FreePlayConfig) {
  try {
    localStorage.setItem(FREE_PLAY_CONFIG_KEY, JSON.stringify(config));
  } catch {}
}

const DEFAULT_STATS: PlayerStats = {
  dailyCompleted: 0,
  currentStreak: 0,
  bestStreak: 0,
  lastDailyDate: null,
  totalRoundsPlayed: 0,
  optimalRounds: 0,
};

export const MUNICH_NETWORK = rawNetwork as unknown as MunichNetwork;

function loadStats(): PlayerStats {
  try {
    const raw = localStorage.getItem(STATS_STORAGE_KEY);
    if (!raw) return DEFAULT_STATS;
    return { ...DEFAULT_STATS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_STATS;
  }
}

function saveStats(stats: PlayerStats) {
  try {
    localStorage.setItem(STATS_STORAGE_KEY, JSON.stringify(stats));
  } catch {}
}

function loadDailyProgress(dateKey: string, mode: NetworkMode): DailyProgress {
  try {
    const raw = localStorage.getItem(`${DAILY_STORAGE_PREFIX}${dateKey}:${mode}`);
    if (raw) {
      const parsed = JSON.parse(raw) as DailyProgress;
      if (parsed.dateKey === dateKey && parsed.networkMode === mode) {
        return parsed;
      }
    }
  } catch {}
  return {
    dateKey,
    networkMode: mode,
    rounds: [],
    completed: false,
  };
}

function saveDailyProgress(progress: DailyProgress) {
  try {
    localStorage.setItem(
      `${DAILY_STORAGE_PREFIX}${progress.dateKey}:${progress.networkMode}`,
      JSON.stringify(progress),
    );
  } catch {}
}

function isYesterday(prevDateKey: string | null, todayKey: string): boolean {
  if (!prevDateKey) return false;
  const prev = new Date(`${prevDateKey}T12:00:00Z`);
  const today = new Date(`${todayKey}T12:00:00Z`);
  const diffDays = Math.round((today.getTime() - prev.getTime()) / 86400000);
  return diffDays === 1;
}

export function useGameState() {
  const dateKey = useMemo(() => getBerlinDateKey(), []);

  const [gameMode, setGameMode] = useState<GameMode>('daily');
  const [networkMode, setNetworkModeState] = useState<NetworkMode>(() => {
    try {
      const saved = localStorage.getItem(NETWORK_MODE_KEY);
      if (saved === 'us' || saved === 'ust') return saved;
    } catch {}
    return 'us';
  });

  const graph = useMemo(
    () => buildTransitGraph(MUNICH_NETWORK, networkMode),
    [networkMode],
  );

  const dailyPuzzles = useMemo(
    () => generateDailyPuzzles(graph, dateKey, networkMode),
    [graph, dateKey, networkMode],
  );

  const [dailyProgress, setDailyProgress] = useState<DailyProgress>(() =>
    loadDailyProgress(dateKey, networkMode),
  );
  const [dailyIndex, setDailyIndex] = useState<number>(() => {
    const saved = loadDailyProgress(dateKey, networkMode);
    return Math.min(saved.rounds.length, DAILY_ROUNDS_COUNT - 1);
  });

  const [freePlayConfig, setFreePlayConfig] =
    useState<FreePlayConfig>(loadFreePlayConfig);
  const [freePuzzle, setFreePuzzle] = useState<Puzzle>(() =>
    generateFreePlayPuzzle(graph, networkMode, undefined, loadFreePlayConfig()),
  );
  const [freeResult, setFreeResult] = useState<CompletedRound | null>(null);

  const freePlayStationCount = useMemo(() => {
    const zoneSet = new Set<MvvZone>(freePlayConfig.zones);
    return graph.activeStationIds.filter((id) =>
      isStationInZones(MUNICH_NETWORK.stations[id], zoneSet),
    ).length;
  }, [graph, freePlayConfig.zones]);

  const [selectedLines, setSelectedLines] = useState<string[]>([]);
  const [attempts, setAttempts] = useState<AttemptRecord[]>([]);
  const [stats, setStats] = useState<PlayerStats>(loadStats);
  const [showSummaryModal, setShowSummaryModal] = useState(false);

  // Reload daily progress and reset free puzzle when networkMode switches
  const setNetworkMode = useCallback(
    (nextMode: NetworkMode) => {
      if (nextMode === networkMode) return;
      setNetworkModeState(nextMode);
      try {
        localStorage.setItem(NETWORK_MODE_KEY, nextMode);
      } catch {}
      const nextGraph = buildTransitGraph(MUNICH_NETWORK, nextMode);
      const nextProgress = loadDailyProgress(dateKey, nextMode);
      setDailyProgress(nextProgress);
      setDailyIndex(Math.min(nextProgress.rounds.length, DAILY_ROUNDS_COUNT - 1));
      setFreePuzzle(
        generateFreePlayPuzzle(nextGraph, nextMode, undefined, freePlayConfig),
      );
      setFreeResult(null);
      setSelectedLines([]);
      setAttempts([]);
    },
    [networkMode, dateKey, freePlayConfig],
  );

  const updateFreePlayConfig = useCallback(
    (patch: Partial<FreePlayConfig>) => {
      const nextZones = patch.zones
        ? ALL_MVV_ZONES.filter((z) => patch.zones!.includes(z))
        : freePlayConfig.zones;
      const nextConfig: FreePlayConfig = {
        zones: nextZones.length > 0 ? nextZones : [...ALL_MVV_ZONES],
        difficulty: patch.difficulty ?? freePlayConfig.difficulty,
      };
      setFreePlayConfig(nextConfig);
      saveFreePlayConfig(nextConfig);
      setFreePuzzle(
        generateFreePlayPuzzle(graph, networkMode, undefined, nextConfig),
      );
      setFreeResult(null);
      setSelectedLines([]);
      setAttempts([]);
    },
    [graph, networkMode, freePlayConfig],
  );

  const switchGameMode = useCallback((nextMode: GameMode) => {
    setGameMode(nextMode);
    setSelectedLines([]);
    setAttempts([]);
  }, []);

  const currentPuzzle: Puzzle =
    gameMode === 'daily' ? dailyPuzzles[dailyIndex] : freePuzzle;

  const currentResult: CompletedRound | null =
    gameMode === 'daily'
      ? dailyProgress.rounds[dailyIndex] ?? null
      : freeResult;

  const isRevealed = currentResult !== null;

  const addLine = useCallback(
    (lineId: string) => {
      if (isRevealed) return;
      setSelectedLines((prev) => {
        if (prev.length >= 6) return prev;
        if (prev[prev.length - 1] === lineId) return prev;
        return [...prev, lineId];
      });
    },
    [isRevealed],
  );

  const removeLastLine = useCallback(() => {
    if (isRevealed) return;
    setSelectedLines((prev) => prev.slice(0, -1));
  }, [isRevealed]);

  const removeLineAt = useCallback(
    (index: number) => {
      if (isRevealed) return;
      setSelectedLines((prev) => prev.filter((_, i) => i !== index));
    },
    [isRevealed],
  );

  const clearLines = useCallback(() => {
    if (isRevealed) return;
    setSelectedLines([]);
  }, [isRevealed]);

  const recordCompletedRound = useCallback(
    (round: CompletedRound) => {
      // Update global stats
      setStats((prevStats) => {
        const nextStats: PlayerStats = {
          ...prevStats,
          totalRoundsPlayed: prevStats.totalRoundsPlayed + 1,
          optimalRounds:
            prevStats.optimalRounds + (round.grade === 'optimal' ? 1 : 0),
        };
        saveStats(nextStats);
        return nextStats;
      });

      if (gameMode === 'free') {
        setFreeResult(round);
        return;
      }

      setDailyProgress((prev) => {
        const rounds = [...prev.rounds];
        rounds[dailyIndex] = round;
        const completed = rounds.filter(Boolean).length >= DAILY_ROUNDS_COUNT;
        const next: DailyProgress = {
          ...prev,
          rounds,
          completed,
        };
        saveDailyProgress(next);

        if (completed && !prev.completed) {
          setStats((prevStats) => {
            const alreadyCountedToday = prevStats.lastDailyDate === dateKey;
            if (alreadyCountedToday) return prevStats;
            const streak = isYesterday(prevStats.lastDailyDate, dateKey)
              ? prevStats.currentStreak + 1
              : 1;
            const nextStats: PlayerStats = {
              ...prevStats,
              dailyCompleted: prevStats.dailyCompleted + 1,
              currentStreak: streak,
              bestStreak: Math.max(prevStats.bestStreak, streak),
              lastDailyDate: dateKey,
            };
            saveStats(nextStats);
            return nextStats;
          });
        }
        return next;
      });
    },
    [gameMode, dailyIndex, dateKey],
  );

  const submitGuess = useCallback(() => {
    if (isRevealed || selectedLines.length === 0) return;

    const validation = validateLineSequence(
      graph,
      currentPuzzle.fromStationId,
      currentPuzzle.toStationId,
      selectedLines,
    );

    const nextAttempts: AttemptRecord[] = [
      ...attempts,
      {
        lineIds: [...selectedLines],
        valid: validation.valid,
        error: validation.error,
        route: validation.route,
      },
    ];
    setAttempts(nextAttempts);

    if (validation.valid && validation.route) {
      const grade = gradeRoute(validation.route, currentPuzzle.optimalRoute);
      const deltaSec =
        validation.route.totalTimeSec - currentPuzzle.optimalRoute.totalTimeSec;

      recordCompletedRound({
        puzzleId: currentPuzzle.id,
        fromStationId: currentPuzzle.fromStationId,
        toStationId: currentPuzzle.toStationId,
        playerRoute: validation.route,
        optimalRoute: currentPuzzle.optimalRoute,
        attempts: nextAttempts.length,
        grade,
        deltaSec,
      });
      return;
    }

    // Invalid attempt — if out of tries, reveal optimal route
    if (nextAttempts.length >= MAX_ATTEMPTS) {
      recordCompletedRound({
        puzzleId: currentPuzzle.id,
        fromStationId: currentPuzzle.fromStationId,
        toStationId: currentPuzzle.toStationId,
        playerRoute: null,
        optimalRoute: currentPuzzle.optimalRoute,
        attempts: nextAttempts.length,
        grade: 'skipped',
        deltaSec: null,
      });
    }
  }, [
    isRevealed,
    selectedLines,
    graph,
    currentPuzzle,
    attempts,
    recordCompletedRound,
  ]);

  const giveUp = useCallback(() => {
    if (isRevealed) return;
    recordCompletedRound({
      puzzleId: currentPuzzle.id,
      fromStationId: currentPuzzle.fromStationId,
      toStationId: currentPuzzle.toStationId,
      playerRoute: null,
      optimalRoute: currentPuzzle.optimalRoute,
      attempts: attempts.length,
      grade: 'skipped',
      deltaSec: null,
    });
  }, [isRevealed, currentPuzzle, attempts.length, recordCompletedRound]);

  const nextRound = useCallback(() => {
    setSelectedLines([]);
    setAttempts([]);
    if (gameMode === 'free') {
      setFreeResult(null);
      setFreePuzzle(
        generateFreePlayPuzzle(graph, networkMode, undefined, freePlayConfig),
      );
      return;
    }
    if (dailyIndex < DAILY_ROUNDS_COUNT - 1) {
      setDailyIndex((idx) => idx + 1);
    } else {
      setShowSummaryModal(true);
    }
  }, [gameMode, graph, networkMode, dailyIndex, freePlayConfig]);

  const selectDailyRound = useCallback(
    (idx: number) => {
      if (idx < 0 || idx >= DAILY_ROUNDS_COUNT) return;
      // Allow jumping to already-completed rounds or the current frontier round
      const maxReachable = Math.min(
        dailyProgress.rounds.length,
        DAILY_ROUNDS_COUNT - 1,
      );
      if (idx > maxReachable) return;
      setDailyIndex(idx);
      setSelectedLines([]);
      setAttempts([]);
    },
    [dailyProgress.rounds.length],
  );

  // Global keyboard shortcuts
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }
      if (e.key === 'Backspace' && !isRevealed) {
        e.preventDefault();
        removeLastLine();
      } else if (e.key === 'Enter') {
        if (!isRevealed && selectedLines.length > 0) {
          e.preventDefault();
          submitGuess();
        } else if (isRevealed && !showSummaryModal) {
          e.preventDefault();
          nextRound();
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    isRevealed,
    selectedLines.length,
    showSummaryModal,
    removeLastLine,
    submitGuess,
    nextRound,
  ]);

  const lastInvalidAttempt =
    !isRevealed && attempts.length > 0 && !attempts[attempts.length - 1].valid
      ? attempts[attempts.length - 1]
      : null;

  return {
    dateKey,
    network: MUNICH_NETWORK,
    graph,
    gameMode,
    switchGameMode,
    networkMode,
    setNetworkMode,
    freePlayConfig,
    updateFreePlayConfig,
    freePlayStationCount,
    dailyPuzzles,
    dailyProgress,
    dailyIndex,
    selectDailyRound,
    currentPuzzle,
    currentResult,
    isRevealed,
    selectedLines,
    addLine,
    removeLastLine,
    removeLineAt,
    clearLines,
    attempts,
    attemptsLeft: Math.max(0, MAX_ATTEMPTS - attempts.length),
    lastInvalidAttempt,
    submitGuess,
    giveUp,
    nextRound,
    stats,
    showSummaryModal,
    setShowSummaryModal,
  };
}
