import {
  ALL_MVV_ZONES,
  type FreePlayDifficulty,
  type MvvZone,
  type NetworkMode,
  type Puzzle,
  type Station,
} from '../types';
import type { TransitGraph } from './graph';
import { findOptimalRoute } from './router';

export const DAILY_ROUNDS_COUNT = 5;

export interface FreePlayOptions {
  zones?: MvvZone[];
  difficulty?: FreePlayDifficulty;
}

/**
 * Checks whether a station belongs to at least one of the selected MVV zones.
 * Boundary stations like "M/1" belong to both Zone M and Zone 1.
 */
export function isStationInZones(
  station: Station | undefined,
  allowedZones: ReadonlySet<MvvZone>,
): boolean {
  if (!station) return false;
  return station.zone
    .split('/')
    .some((part) => allowedZones.has(part as MvvZone));
}

/** Returns YYYY-MM-DD in Europe/Berlin timezone so everyone in Munich gets the same daily reset at midnight. */
export function getBerlinDateKey(date: Date = new Date()): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Berlin',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(date);
}

/** FNV-1a 32-bit string hash */
function hashString(str: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Deterministic Mulberry32 PRNG returning [0, 1) */
function createRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface RoundSpec {
  difficulty: 'easy' | 'medium' | 'hard';
  minTransfers: number;
  maxTransfers: number;
  minStops: number;
  zoneMPreference: 'both' | 'at_least_one' | 'encourage_outer' | 'any';
  preferTram: boolean;
  allowedZones?: ReadonlySet<MvvZone>;
}

function getDailySpecs(mode: NetworkMode): RoundSpec[] {
  const isTram = mode === 'ust';
  return [
    {
      difficulty: 'easy',
      minTransfers: 1,
      maxTransfers: 1,
      minStops: 4,
      zoneMPreference: 'both',
      preferTram: false,
    },
    {
      difficulty: 'easy',
      minTransfers: 1,
      maxTransfers: 1,
      minStops: 5,
      zoneMPreference: 'both',
      preferTram: isTram,
    },
    {
      difficulty: 'medium',
      minTransfers: 1,
      maxTransfers: 2,
      minStops: 6,
      zoneMPreference: 'at_least_one',
      preferTram: false,
    },
    {
      difficulty: 'medium',
      minTransfers: 2,
      maxTransfers: 2,
      minStops: 7,
      zoneMPreference: 'both',
      preferTram: isTram,
    },
    {
      difficulty: 'hard',
      minTransfers: 2,
      maxTransfers: 3,
      minStops: 8,
      zoneMPreference: 'encourage_outer',
      preferTram: false,
    },
  ];
}

function pickFromPool<T>(arr: T[], rng: () => number): T {
  return arr[Math.floor(rng() * arr.length)];
}

function generateSinglePuzzle(
  graph: TransitGraph,
  spec: RoundSpec,
  rng: () => number,
  usedStations: Set<string>,
  puzzleId: string,
  roundNumber?: number,
): Puzzle {
  const allStations = graph.activeStationIds;
  const filteredStations =
    spec.allowedZones && spec.allowedZones.size > 0
      ? allStations.filter((id) =>
          isStationInZones(graph.network.stations[id], spec.allowedZones!),
        )
      : allStations;
  const eligibleStations =
    filteredStations.length >= 2 ? filteredStations : allStations;

  const zoneMStations = eligibleStations.filter(
    (id) => graph.network.stations[id].isZoneM,
  );
  const outerStations = eligibleStations.filter(
    (id) => !graph.network.stations[id].isZoneM,
  );
  const tramStations = eligibleStations.filter((id) =>
    graph.network.stations[id].modes.includes('tram'),
  );
  const shouldPreferTram = spec.preferTram && tramStations.length >= 2;

  // Try strict criteria first, then gradually relax transfer/stop thresholds if needed
  // (while always honoring the user's selected zones).
  for (let pass = 0; pass < 3; pass++) {
    const maxAttempts = pass === 0 ? 450 : 300;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      let fromPool = eligibleStations;
      let toPool = eligibleStations;

      if (spec.zoneMPreference !== 'any') {
        fromPool = zoneMStations.length > 10 ? zoneMStations : eligibleStations;
        toPool = zoneMStations.length > 10 ? zoneMStations : eligibleStations;

        if (spec.zoneMPreference === 'encourage_outer' && outerStations.length > 0) {
          if (rng() < 0.65) {
            if (rng() < 0.5) {
              fromPool = outerStations;
            } else {
              toPool = outerStations;
            }
          }
        } else if (
          spec.zoneMPreference === 'at_least_one' &&
          outerStations.length > 0 &&
          rng() < 0.35
        ) {
          toPool = eligibleStations;
        }
      }

      if (shouldPreferTram && pass === 0 && tramStations.length > 5) {
        if (rng() < 0.7) {
          if (rng() < 0.5) {
            fromPool = tramStations;
          } else {
            toPool = tramStations;
          }
        }
      }

      const fromId = pickFromPool(fromPool, rng);
      const toId = pickFromPool(toPool, rng);

      if (fromId === toId) continue;
      if (pass === 0 && (usedStations.has(fromId) || usedStations.has(toId))) {
        continue;
      }

      // Skip stations that share a direct line when minTransfers >= 1
      const fromLines = graph.stationLines[fromId] ?? [];
      const toLines = new Set(graph.stationLines[toId] ?? []);
      if (spec.minTransfers >= 1 && fromLines.some((l) => toLines.has(l))) {
        continue;
      }

      const optimal = findOptimalRoute(graph, fromId, toId);
      if (!optimal) continue;

      const minT = pass === 2 ? 1 : spec.minTransfers;
      const maxT = pass === 2 ? 3 : spec.maxTransfers;
      const minS = pass === 2 ? 3 : spec.minStops;

      if (optimal.transfers < minT || optimal.transfers > maxT) continue;
      if (optimal.totalStops < minS) continue;

      if (shouldPreferTram && pass === 0) {
        const usesTram = optimal.lineIds.some(
          (id) => graph.network.lines[id]?.mode === 'tram',
        );
        if (!usesTram) continue;
      }

      usedStations.add(fromId);
      usedStations.add(toId);
      return {
        id: puzzleId,
        fromStationId: fromId,
        toStationId: toId,
        optimalRoute: optimal,
        difficulty: spec.difficulty,
        roundNumber,
      };
    }
  }

  // Ultimate fallback: any connected pair inside eligibleStations with >= 1 transfer
  for (let i = 0; i < 500; i++) {
    const fromId = pickFromPool(eligibleStations, rng);
    const toId = pickFromPool(eligibleStations, rng);
    if (fromId === toId) continue;
    const optimal = findOptimalRoute(graph, fromId, toId);
    if (optimal && (optimal.transfers >= 1 || i >= 350)) {
      return {
        id: puzzleId,
        fromStationId: fromId,
        toStationId: toId,
        optimalRoute: optimal,
        difficulty: spec.difficulty,
        roundNumber,
      };
    }
  }

  throw new Error('Could not generate valid puzzle from transit graph');
}

export function generateDailyPuzzles(
  graph: TransitGraph,
  dateKey: string,
  mode: NetworkMode,
): Puzzle[] {
  const seed = hashString(`einsteigen-munich-v1-${dateKey}-${mode}`);
  const rng = createRng(seed);
  const specs = getDailySpecs(mode);
  const usedStations = new Set<string>();

  return specs.map((spec, idx) =>
    generateSinglePuzzle(
      graph,
      spec,
      rng,
      usedStations,
      `daily-${dateKey}-${mode}-${idx + 1}`,
      idx + 1,
    ),
  );
}

export function generateFreePlayPuzzle(
  graph: TransitGraph,
  mode: NetworkMode,
  seed: number = Date.now() ^ Math.floor(Math.random() * 0xffffffff),
  options?: FreePlayOptions,
): Puzzle {
  const rng = createRng(seed);
  const requestedDifficulty: FreePlayDifficulty = options?.difficulty ?? 'any';
  const roll = rng();
  const difficulty: 'easy' | 'medium' | 'hard' =
    requestedDifficulty !== 'any'
      ? requestedDifficulty
      : roll < 0.35
        ? 'easy'
        : roll < 0.75
          ? 'medium'
          : 'hard';

  const hasCustomZones =
    options?.zones !== undefined &&
    options.zones.length > 0 &&
    options.zones.length < ALL_MVV_ZONES.length;
  const allowedZones = hasCustomZones ? new Set(options!.zones!) : undefined;

  const spec: RoundSpec = {
    difficulty,
    minTransfers: difficulty === 'easy' ? 1 : difficulty === 'medium' ? 1 : 2,
    maxTransfers: difficulty === 'easy' ? 1 : difficulty === 'medium' ? 2 : 3,
    minStops: difficulty === 'easy' ? 4 : difficulty === 'medium' ? 6 : 8,
    zoneMPreference: hasCustomZones
      ? 'any'
      : difficulty === 'hard'
        ? 'encourage_outer'
        : difficulty === 'medium'
          ? 'at_least_one'
          : 'both',
    preferTram: mode === 'ust' && rng() < 0.5,
    allowedZones,
  };

  return generateSinglePuzzle(
    graph,
    spec,
    rng,
    new Set(),
    `free-${mode}-${seed}`,
  );
}
