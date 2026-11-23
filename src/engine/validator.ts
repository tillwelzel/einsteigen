import type {
  ComputedRoute,
  RoundGrade,
  RouteLeg,
  RouteValidationResult,
} from '../types';
import {
  getSharedStations,
  getTransferTimeSec,
  type TransitGraph,
} from './graph';
import { shortestPathOnLine } from './router';

interface DPNode {
  stationId: string;
  totalTimeSec: number;
  prevIndex: number;
  leg: RouteLeg;
}

/**
 * Validates a player's submitted sequence of lines from `fromId` to `toId`
 * and resolves the optimal transfer stations for that exact line sequence.
 */
export function validateLineSequence(
  graph: TransitGraph,
  fromId: string,
  toId: string,
  lineIds: string[],
): RouteValidationResult {
  if (lineIds.length === 0) {
    return { valid: false, error: { code: 'empty' } };
  }

  for (let i = 0; i < lineIds.length; i++) {
    const id = lineIds[i];
    if (!graph.lineStations[id]) {
      return { valid: false, error: { code: 'unknown_line', lineA: id } };
    }
    if (i > 0 && lineIds[i - 1] === id) {
      return {
        valid: false,
        error: { code: 'duplicate_adjacent_line', lineA: id },
      };
    }
  }

  const startStation = graph.network.stations[fromId];
  const endStation = graph.network.stations[toId];
  const firstLine = lineIds[0];
  const lastLine = lineIds[lineIds.length - 1];

  if (!graph.lineStations[firstLine].has(fromId)) {
    return {
      valid: false,
      error: {
        code: 'start_not_served',
        lineA: firstLine,
        stationName: startStation?.name ?? fromId,
      },
    };
  }

  if (!graph.lineStations[lastLine].has(toId)) {
    return {
      valid: false,
      error: {
        code: 'end_not_served',
        lineA: lastLine,
        stationName: endStation?.name ?? toId,
      },
    };
  }

  // Single-line direct route
  if (lineIds.length === 1) {
    const path = shortestPathOnLine(graph, firstLine, fromId, toId);
    if (!path) {
      return { valid: false, error: { code: 'disconnected_sequence' } };
    }
    const leg: RouteLeg = {
      lineId: firstLine,
      fromStationId: fromId,
      toStationId: toId,
      stationIds: path.stationIds,
      rideTimeSec: path.rideTimeSec,
      transferTimeSec: 0,
    };
    return {
      valid: true,
      route: {
        legs: [leg],
        lineIds: [firstLine],
        totalTimeSec: path.rideTimeSec,
        transfers: 0,
        totalStops: Math.max(0, path.stationIds.length - 1),
      },
    };
  }

  // Pre-check consecutive intersections for clear, specific player feedback
  const transferCandidates: string[][] = [];
  for (let i = 0; i < lineIds.length - 1; i++) {
    const shared = getSharedStations(graph, lineIds[i], lineIds[i + 1]);
    if (shared.length === 0) {
      return {
        valid: false,
        error: {
          code: 'no_intersection',
          lineA: lineIds[i],
          lineB: lineIds[i + 1],
        },
      };
    }
    transferCandidates.push(shared);
  }

  // Dynamic programming over transfer stations to pick the fastest valid itinerary
  // for the player's chosen line sequence.
  // First try requiring every leg to ride >= 1 stop; if impossible (e.g. redundant line at start/end),
  // fall back to allowing 0-stop transfer so valid intersections still resolve cleanly.
  const resolved =
    resolveWithDP(graph, fromId, toId, lineIds, transferCandidates, true) ??
    resolveWithDP(graph, fromId, toId, lineIds, transferCandidates, false);

  if (!resolved) {
    return { valid: false, error: { code: 'disconnected_sequence' } };
  }

  return { valid: true, route: resolved };
}

function resolveWithDP(
  graph: TransitGraph,
  fromId: string,
  toId: string,
  lineIds: string[],
  transferCandidates: string[][],
  requireNonZeroLegs: boolean,
): ComputedRoute | null {
  const numLegs = lineIds.length;
  const layers: DPNode[][] = [];

  // Leg 0: fromId -> candidate transfer station t in transferCandidates[0]
  const firstLayer: DPNode[] = [];
  for (const t of transferCandidates[0]) {
    if (requireNonZeroLegs && t === fromId) continue;
    const p = shortestPathOnLine(graph, lineIds[0], fromId, t);
    if (!p) continue;
    firstLayer.push({
      stationId: t,
      totalTimeSec: p.rideTimeSec,
      prevIndex: -1,
      leg: {
        lineId: lineIds[0],
        fromStationId: fromId,
        toStationId: t,
        stationIds: p.stationIds,
        rideTimeSec: p.rideTimeSec,
        transferTimeSec: 0,
      },
    });
  }
  if (firstLayer.length === 0) return null;
  layers.push(firstLayer);

  // Intermediate legs: 1 .. numLegs - 2
  for (let i = 1; i < numLegs - 1; i++) {
    const prevLayer = layers[i - 1];
    const prevMode = graph.network.lines[lineIds[i - 1]].mode;
    const curMode = graph.network.lines[lineIds[i]].mode;
    const curLayer: DPNode[] = [];

    for (const nextT of transferCandidates[i]) {
      let bestNode: DPNode | null = null;
      for (let pIdx = 0; pIdx < prevLayer.length; pIdx++) {
        const prevNode = prevLayer[pIdx];
        if (requireNonZeroLegs && prevNode.stationId === nextT) continue;
        const p = shortestPathOnLine(graph, lineIds[i], prevNode.stationId, nextT);
        if (!p) continue;
        const transferSec = getTransferTimeSec(prevNode.stationId, prevMode, curMode);
        const total = prevNode.totalTimeSec + transferSec + p.rideTimeSec;
        if (!bestNode || total < bestNode.totalTimeSec) {
          bestNode = {
            stationId: nextT,
            totalTimeSec: total,
            prevIndex: pIdx,
            leg: {
              lineId: lineIds[i],
              fromStationId: prevNode.stationId,
              toStationId: nextT,
              stationIds: p.stationIds,
              rideTimeSec: p.rideTimeSec,
              transferTimeSec: transferSec,
            },
          };
        }
      }
      if (bestNode) curLayer.push(bestNode);
    }

    if (curLayer.length === 0) return null;
    layers.push(curLayer);
  }

  // Final leg: last transfer -> toId
  const lastPrevLayer = layers[layers.length - 1];
  const prevMode = graph.network.lines[lineIds[numLegs - 2]].mode;
  const lastMode = graph.network.lines[lineIds[numLegs - 1]].mode;

  let bestFinal: DPNode | null = null;
  for (let pIdx = 0; pIdx < lastPrevLayer.length; pIdx++) {
    const prevNode = lastPrevLayer[pIdx];
    if (requireNonZeroLegs && prevNode.stationId === toId) continue;
    const p = shortestPathOnLine(
      graph,
      lineIds[numLegs - 1],
      prevNode.stationId,
      toId,
    );
    if (!p) continue;
    const transferSec = getTransferTimeSec(prevNode.stationId, prevMode, lastMode);
    const total = prevNode.totalTimeSec + transferSec + p.rideTimeSec;
    if (!bestFinal || total < bestFinal.totalTimeSec) {
      bestFinal = {
        stationId: toId,
        totalTimeSec: total,
        prevIndex: pIdx,
        leg: {
          lineId: lineIds[numLegs - 1],
          fromStationId: prevNode.stationId,
          toStationId: toId,
          stationIds: p.stationIds,
          rideTimeSec: p.rideTimeSec,
          transferTimeSec: transferSec,
        },
      };
    }
  }

  if (!bestFinal) return null;

  // Backtrack legs
  const legs: RouteLeg[] = [bestFinal.leg];
  let idx = bestFinal.prevIndex;
  for (let layerIdx = layers.length - 1; layerIdx >= 0; layerIdx--) {
    const node = layers[layerIdx][idx];
    legs.push(node.leg);
    idx = node.prevIndex;
  }
  legs.reverse();

  const totalStops = legs.reduce(
    (sum, leg) => sum + Math.max(0, leg.stationIds.length - 1),
    0,
  );

  return {
    legs,
    lineIds: legs.map((l) => l.lineId),
    totalTimeSec: bestFinal.totalTimeSec,
    transfers: Math.max(0, legs.length - 1),
    totalStops,
  };
}

export function gradeRoute(
  playerRoute: ComputedRoute,
  optimalRoute: ComputedRoute,
): RoundGrade {
  const deltaSec = playerRoute.totalTimeSec - optimalRoute.totalTimeSec;
  if (deltaSec <= 60) return 'optimal';
  if (deltaSec <= 240) return 'great';
  if (deltaSec <= 540) return 'good';
  return 'valid';
}
