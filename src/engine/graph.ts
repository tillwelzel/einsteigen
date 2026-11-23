import type {
  MunichNetwork,
  NetworkMode,
  Station,
  TransitLine,
  TransitMode,
} from '../types';

export interface AdjEdge {
  to: string;
  timeSec: number;
}

export interface TransitGraph {
  network: MunichNetwork;
  mode: NetworkMode;
  activeLineIds: string[];
  activeStationIds: string[];
  /** lineAdj[lineId][stationId] -> adjacent stops on that line */
  lineAdj: Record<string, Record<string, AdjEdge[]>>;
  /** stationLines[stationId] -> active line IDs at that station */
  stationLines: Record<string, string[]>;
  /** lineStations[lineId] -> Set of station IDs served by that line */
  lineStations: Record<string, Set<string>>;
}

const CROSS_PLATFORM_U_HUBS = new Set([
  'innsbrucker-ring',
  'scheidplatz',
  'muenchner-freiheit',
  'implerstrasse',
  'kolumbusplatz',
  'neuperlach-sued',
]);

const MAJOR_MULTI_LEVEL_HUBS = new Set([
  'hauptbahnhof',
  'marienplatz',
  'karlsplatz-stachus',
  'ostbahnhof',
  'sendlinger-tor',
  'odeonsplatz',
]);

export function isModeAllowed(
  transitMode: TransitMode,
  networkMode: NetworkMode,
): boolean {
  if (networkMode === 'us') {
    return transitMode === 'ubahn' || transitMode === 'sbahn';
  }
  return true;
}

export function getTransferTimeSec(
  stationId: string,
  fromMode: TransitMode,
  toMode: TransitMode,
): number {
  if (fromMode === 'ubahn' && toMode === 'ubahn') {
    return CROSS_PLATFORM_U_HUBS.has(stationId) ? 120 : 180;
  }
  if (fromMode === 'sbahn' && toMode === 'sbahn') {
    return 120;
  }
  if (
    (fromMode === 'ubahn' && toMode === 'sbahn') ||
    (fromMode === 'sbahn' && toMode === 'ubahn')
  ) {
    if (stationId === 'neuperlach-sued') return 120;
    return MAJOR_MULTI_LEVEL_HUBS.has(stationId) ? 270 : 210;
  }
  if (fromMode === 'tram' && toMode === 'tram') {
    return 150;
  }
  // U/S <-> Tram (underground/elevated to street level)
  return MAJOR_MULTI_LEVEL_HUBS.has(stationId) ? 270 : 240;
}

export function buildTransitGraph(
  network: MunichNetwork,
  mode: NetworkMode,
): TransitGraph {
  const activeLineSet = new Set<string>();
  const activeLineIds: string[] = [];
  const lineStations: Record<string, Set<string>> = {};
  const lineAdj: Record<string, Record<string, AdjEdge[]>> = {};

  for (const line of Object.values(network.lines)) {
    if (!isModeAllowed(line.mode, mode)) continue;
    activeLineSet.add(line.id);
    activeLineIds.push(line.id);
    lineStations[line.id] = new Set(line.stations);
    lineAdj[line.id] = {};
  }

  for (const seg of network.segments) {
    if (!activeLineSet.has(seg.line)) continue;
    const adj = lineAdj[seg.line];
    if (!adj[seg.from]) adj[seg.from] = [];
    if (!adj[seg.to]) adj[seg.to] = [];

    const existingFwd = adj[seg.from].find((e) => e.to === seg.to);
    if (!existingFwd) {
      adj[seg.from].push({ to: seg.to, timeSec: seg.timeSec });
    } else if (seg.timeSec < existingFwd.timeSec) {
      existingFwd.timeSec = seg.timeSec;
    }

    const existingRev = adj[seg.to].find((e) => e.to === seg.from);
    if (!existingRev) {
      adj[seg.to].push({ to: seg.from, timeSec: seg.timeSec });
    } else if (seg.timeSec < existingRev.timeSec) {
      existingRev.timeSec = seg.timeSec;
    }
  }

  const stationLines: Record<string, string[]> = {};
  const activeStationIds: string[] = [];

  for (const station of Object.values(network.stations)) {
    const linesHere = station.lines.filter((id) => activeLineSet.has(id));
    if (linesHere.length > 0) {
      stationLines[station.id] = linesHere;
      activeStationIds.push(station.id);
    }
  }

  return {
    network,
    mode,
    activeLineIds,
    activeStationIds,
    lineAdj,
    stationLines,
    lineStations,
  };
}

export function getSharedStations(
  graph: TransitGraph,
  lineA: string,
  lineB: string,
): string[] {
  const setA = graph.lineStations[lineA];
  const setB = graph.lineStations[lineB];
  if (!setA || !setB) return [];
  const shared: string[] = [];
  for (const st of setA) {
    if (setB.has(st)) shared.push(st);
  }
  return shared;
}

export function getStation(graph: TransitGraph, id: string): Station | undefined {
  return graph.network.stations[id];
}

export function getLine(graph: TransitGraph, id: string): TransitLine | undefined {
  return graph.network.lines[id];
}
