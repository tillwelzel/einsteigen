import type { ComputedRoute, RouteLeg } from '../types';
import { getTransferTimeSec, type TransitGraph } from './graph';

/** Small virtual bias during optimal search to avoid silly extra transfers saving <30s. */
const TRANSFER_COMFORT_BIAS_SEC = 35;

export interface SingleLinePath {
  stationIds: string[];
  rideTimeSec: number;
}

/**
 * Shortest path between two stations while staying on a single transit line.
 * Handles branching lines (e.g. S1 Freising/Flughafen, S2 Petershausen/Altomünster).
 */
export function shortestPathOnLine(
  graph: TransitGraph,
  lineId: string,
  fromId: string,
  toId: string,
): SingleLinePath | null {
  if (fromId === toId) {
    return { stationIds: [fromId], rideTimeSec: 0 };
  }
  const adj = graph.lineAdj[lineId];
  if (!adj || !adj[fromId] || !adj[toId]) return null;

  const dist = new Map<string, number>();
  const prev = new Map<string, string>();
  const visited = new Set<string>();

  dist.set(fromId, 0);

  while (true) {
    let bestNode: string | null = null;
    let bestDist = Infinity;
    for (const [node, d] of dist) {
      if (!visited.has(node) && d < bestDist) {
        bestDist = d;
        bestNode = node;
      }
    }
    if (bestNode === null) break;
    if (bestNode === toId) break;
    visited.add(bestNode);

    const neighbors = adj[bestNode] ?? [];
    for (const edge of neighbors) {
      if (visited.has(edge.to)) continue;
      const nd = bestDist + edge.timeSec;
      if (nd < (dist.get(edge.to) ?? Infinity)) {
        dist.set(edge.to, nd);
        prev.set(edge.to, bestNode);
      }
    }
  }

  const finalDist = dist.get(toId);
  if (finalDist === undefined) return null;

  const path: string[] = [];
  let cur: string | undefined = toId;
  while (cur !== undefined) {
    path.push(cur);
    cur = prev.get(cur);
  }
  path.reverse();

  return { stationIds: path, rideTimeSec: finalDist };
}

interface SearchState {
  key: string;
  stationId: string;
  lineId: string;
  cost: number; // includes comfort bias
  realTimeSec: number;
  transfers: number;
}

class MinHeap<T> {
  private data: T[] = [];
  private compare: (a: T, b: T) => number;
  constructor(compare: (a: T, b: T) => number) {
    this.compare = compare;
  }
  get size(): number {
    return this.data.length;
  }
  push(item: T): void {
    this.data.push(item);
    this.bubbleUp(this.data.length - 1);
  }
  pop(): T | undefined {
    if (this.data.length === 0) return undefined;
    const top = this.data[0];
    const last = this.data.pop()!;
    if (this.data.length > 0) {
      this.data[0] = last;
      this.sinkDown(0);
    }
    return top;
  }
  private bubbleUp(i: number): void {
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this.compare(this.data[i], this.data[p]) < 0) {
        [this.data[i], this.data[p]] = [this.data[p], this.data[i]];
        i = p;
      } else {
        break;
      }
    }
  }
  private sinkDown(i: number): void {
    const n = this.data.length;
    while (true) {
      let smallest = i;
      const l = 2 * i + 1;
      const r = 2 * i + 2;
      if (l < n && this.compare(this.data[l], this.data[smallest]) < 0) {
        smallest = l;
      }
      if (r < n && this.compare(this.data[r], this.data[smallest]) < 0) {
        smallest = r;
      }
      if (smallest !== i) {
        [this.data[i], this.data[smallest]] = [this.data[smallest], this.data[i]];
        i = smallest;
      } else {
        break;
      }
    }
  }
}

interface PrevStep {
  prevKey: string | null;
  stationId: string;
  lineId: string;
  stepTimeSec: number;
  isTransfer: boolean;
}

/**
 * Finds the fastest realistic transit route between two stations in the active graph.
 */
export function findOptimalRoute(
  graph: TransitGraph,
  fromId: string,
  toId: string,
): ComputedRoute | null {
  if (fromId === toId) return null;
  const startLines = graph.stationLines[fromId];
  if (!startLines || startLines.length === 0) return null;
  if (!graph.stationLines[toId] || graph.stationLines[toId].length === 0) {
    return null;
  }

  const heap = new MinHeap<SearchState>((a, b) => a.cost - b.cost);
  const bestCost = new Map<string, number>();
  const prevMap = new Map<string, PrevStep>();

  for (const lineId of startLines) {
    const key = `${fromId}|${lineId}`;
    bestCost.set(key, 0);
    prevMap.set(key, {
      prevKey: null,
      stationId: fromId,
      lineId,
      stepTimeSec: 0,
      isTransfer: false,
    });
    heap.push({
      key,
      stationId: fromId,
      lineId,
      cost: 0,
      realTimeSec: 0,
      transfers: 0,
    });
  }

  let goalKey: string | null = null;

  while (heap.size > 0) {
    const cur = heap.pop()!;
    if (cur.cost > (bestCost.get(cur.key) ?? Infinity)) continue;

    if (cur.stationId === toId) {
      goalKey = cur.key;
      break;
    }

    // 1. Continue riding along current line
    const neighbors = graph.lineAdj[cur.lineId]?.[cur.stationId] ?? [];
    for (const edge of neighbors) {
      const nextKey = `${edge.to}|${cur.lineId}`;
      const nextCost = cur.cost + edge.timeSec;
      if (nextCost < (bestCost.get(nextKey) ?? Infinity)) {
        bestCost.set(nextKey, nextCost);
        prevMap.set(nextKey, {
          prevKey: cur.key,
          stationId: edge.to,
          lineId: cur.lineId,
          stepTimeSec: edge.timeSec,
          isTransfer: false,
        });
        heap.push({
          key: nextKey,
          stationId: edge.to,
          lineId: cur.lineId,
          cost: nextCost,
          realTimeSec: cur.realTimeSec + edge.timeSec,
          transfers: cur.transfers,
        });
      }
    }

    // 2. Transfer to another line at this station (only if we've ridden at least 1 stop)
    if (cur.stationId !== fromId) {
      const curMode = graph.network.lines[cur.lineId].mode;
      const linesAtStation = graph.stationLines[cur.stationId] ?? [];
      for (const nextLine of linesAtStation) {
        if (nextLine === cur.lineId) continue;
        const nextMode = graph.network.lines[nextLine].mode;
        const transferSec = getTransferTimeSec(cur.stationId, curMode, nextMode);
        const nextKey = `${cur.stationId}|${nextLine}`;
        const nextCost = cur.cost + transferSec + TRANSFER_COMFORT_BIAS_SEC;
        if (nextCost < (bestCost.get(nextKey) ?? Infinity)) {
          bestCost.set(nextKey, nextCost);
          prevMap.set(nextKey, {
            prevKey: cur.key,
            stationId: cur.stationId,
            lineId: nextLine,
            stepTimeSec: transferSec,
            isTransfer: true,
          });
          heap.push({
            key: nextKey,
            stationId: cur.stationId,
            lineId: nextLine,
            cost: nextCost,
            realTimeSec: cur.realTimeSec + transferSec,
            transfers: cur.transfers + 1,
          });
        }
      }
    }
  }

  if (!goalKey) return null;

  // Reconstruct steps
  const steps: PrevStep[] = [];
  let cursor: string | null = goalKey;
  while (cursor !== null) {
    const step = prevMap.get(cursor);
    if (!step) break;
    steps.push(step);
    cursor = step.prevKey;
  }
  steps.reverse();

  // Group into legs
  const legs: RouteLeg[] = [];
  let curLeg: RouteLeg | null = null;

  for (const step of steps) {
    if (!curLeg) {
      curLeg = {
        lineId: step.lineId,
        fromStationId: step.stationId,
        toStationId: step.stationId,
        stationIds: [step.stationId],
        rideTimeSec: 0,
        transferTimeSec: 0,
      };
    } else if (step.isTransfer) {
      legs.push(curLeg);
      curLeg = {
        lineId: step.lineId,
        fromStationId: step.stationId,
        toStationId: step.stationId,
        stationIds: [step.stationId],
        rideTimeSec: 0,
        transferTimeSec: step.stepTimeSec,
      };
    } else {
      curLeg.stationIds.push(step.stationId);
      curLeg.toStationId = step.stationId;
      curLeg.rideTimeSec += step.stepTimeSec;
    }
  }
  if (curLeg) legs.push(curLeg);

  const totalTimeSec = legs.reduce(
    (sum, leg) => sum + leg.rideTimeSec + leg.transferTimeSec,
    0,
  );
  const totalStops = legs.reduce(
    (sum, leg) => sum + Math.max(0, leg.stationIds.length - 1),
    0,
  );

  return {
    legs,
    lineIds: legs.map((l) => l.lineId),
    totalTimeSec,
    transfers: Math.max(0, legs.length - 1),
    totalStops,
  };
}
