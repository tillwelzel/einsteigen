import { describe, expect, it } from 'vitest';
import rawNetwork from '../src/data/munich-network.json';
import { buildTransitGraph } from '../src/engine/graph';
import { findOptimalRoute } from '../src/engine/router';
import { gradeRoute, validateLineSequence } from '../src/engine/validator';
import {
  DAILY_ROUNDS_COUNT,
  generateDailyPuzzles,
  generateFreePlayPuzzle,
} from '../src/engine/puzzle-generator';
import type { MunichNetwork } from '../src/types';

const network = rawNetwork as unknown as MunichNetwork;

describe('Munich Transit Network Data Integrity', () => {
  it('contains U1-U6 (excluding U7/U8) and S1-S8 + S20', () => {
    for (const id of ['U1', 'U2', 'U3', 'U4', 'U5', 'U6']) {
      expect(network.lines[id]).toBeDefined();
      expect(network.lines[id].mode).toBe('ubahn');
    }
    expect(network.lines['U7']).toBeUndefined();
    expect(network.lines['U8']).toBeUndefined();

    for (const id of ['S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8', 'S20']) {
      expect(network.lines[id]).toBeDefined();
      expect(network.lines[id].mode).toBe('sbahn');
    }
  });

  it('merges key Munich interchange hubs cleanly', () => {
    expect(network.stations['hauptbahnhof'].lines).toEqual(
      expect.arrayContaining(['U1', 'U2', 'U4', 'U5', 'S1', 'S7', 'S8', '19']),
    );
    expect(network.stations['marienplatz'].lines).toEqual(
      expect.arrayContaining(['U3', 'U6', 'S1', 'S8']),
    );
    expect(network.stations['odeonsplatz'].lines).toEqual(
      expect.arrayContaining(['U3', 'U4', 'U5', 'U6']),
    );
    expect(network.stations['flughafen-muenchen'].lines).toEqual(
      expect.arrayContaining(['S1', 'S8']),
    );
  });

  it('has a single connected component in both U+S and U+S+Tram modes', () => {
    for (const mode of ['us', 'ust'] as const) {
      const graph = buildTransitGraph(network, mode);
      const start = 'marienplatz';
      const visited = new Set<string>([start]);
      const queue = [start];

      while (queue.length > 0) {
        const cur = queue.shift()!;
        for (const lineId of graph.stationLines[cur] ?? []) {
          for (const edge of graph.lineAdj[lineId][cur] ?? []) {
            if (!visited.has(edge.to)) {
              visited.add(edge.to);
              queue.push(edge.to);
            }
          }
        }
      }

      expect(visited.size).toBe(graph.activeStationIds.length);
    }
  });
});

describe('Router & Validator', () => {
  const usGraph = buildTransitGraph(network, 'us');
  const ustGraph = buildTransitGraph(network, 'ust');

  it('finds direct and 1-transfer U-Bahn routes accurately', () => {
    const direct = findOptimalRoute(usGraph, 'marienplatz', 'garching-forschungszentrum');
    expect(direct).not.toBeNull();
    expect(direct!.lineIds).toEqual(['U6']);
    expect(direct!.transfers).toBe(0);

    const oneTransfer = findOptimalRoute(usGraph, 'arabellapark', 'olympiazentrum');
    expect(oneTransfer).not.toBeNull();
    expect(oneTransfer!.transfers).toBe(1);
    expect(oneTransfer!.lineIds).toEqual(['U4', 'U3']);
  });

  it('routes to Flughafen München via S1 or S8', () => {
    const route = findOptimalRoute(usGraph, 'marienplatz', 'flughafen-muenchen');
    expect(route).not.toBeNull();
    expect(['S1', 'S8']).toContain(route!.lineIds[0]);
  });

  it('validates correct sequences and rejects invalid ones with clear errors', () => {
    // Valid: Arabellapark -> Olympiazentrum via U4 -> U3 (transfer at Odeonsplatz)
    const ok = validateLineSequence(usGraph, 'arabellapark', 'olympiazentrum', ['U4', 'U3']);
    expect(ok.valid).toBe(true);
    expect(ok.route?.legs).toHaveLength(2);
    expect(ok.route?.legs[0].toStationId).toBe('odeonsplatz');

    // Invalid: U2 does not stop at Arabellapark
    const badStart = validateLineSequence(usGraph, 'arabellapark', 'olympiazentrum', ['U2', 'U3']);
    expect(badStart.valid).toBe(false);
    expect(badStart.error?.code).toBe('start_not_served');

    // Invalid: U1 and S20 never intersect (U1 doesn't serve Pasing/Heimeranplatz/Solln)
    const noHit = validateLineSequence(usGraph, 'mangfallplatz', 'hoellriegelskreuth', ['U1', 'S20']);
    expect(noHit.valid).toBe(false);
    expect(noHit.error?.code).toBe('no_intersection');

    // Invalid: duplicate adjacent line
    const dup = validateLineSequence(usGraph, 'arabellapark', 'olympiazentrum', ['U4', 'U4', 'U3']);
    expect(dup.valid).toBe(false);
    expect(dup.error?.code).toBe('duplicate_adjacent_line');
  });

  it('grades optimal and slower routes properly', () => {
    const opt = findOptimalRoute(usGraph, 'arabellapark', 'olympiazentrum')!;
    const playerOpt = validateLineSequence(usGraph, 'arabellapark', 'olympiazentrum', ['U4', 'U3']).route!;
    expect(gradeRoute(playerOpt, opt)).toBe('optimal');

    // Taking U4 -> U1 -> U3 via Hbf & Sendlinger Tor is valid but slower
    const detour = validateLineSequence(usGraph, 'arabellapark', 'olympiazentrum', ['U4', 'U1', 'U3']).route!;
    expect(['good', 'valid', 'great']).toContain(gradeRoute(detour, opt));
    expect(detour.totalTimeSec).toBeGreaterThan(opt.totalTimeSec);
  });

  it('supports Tram lines in U+S+Tram mode and excludes them in U+S mode', () => {
    expect(usGraph.lineStations['19']).toBeUndefined();
    expect(ustGraph.lineStations['19']).toBeDefined();

    const res = validateLineSequence(ustGraph, 'pasing', 'ostbahnhof', ['19']);
    expect(res.valid).toBe(true);
    expect(res.route?.transfers).toBe(0);
  });
});

describe('Puzzle Generator', () => {
  const usGraph = buildTransitGraph(network, 'us');
  const ustGraph = buildTransitGraph(network, 'ust');

  it('generates 5 deterministic daily puzzles with distinct stations', () => {
    const a = generateDailyPuzzles(usGraph, '2026-11-23', 'us');
    const b = generateDailyPuzzles(usGraph, '2026-11-23', 'us');
    const c = generateDailyPuzzles(usGraph, '2026-11-24', 'us');

    expect(a).toHaveLength(DAILY_ROUNDS_COUNT);
    expect(a.map((p) => [p.fromStationId, p.toStationId])).toEqual(
      b.map((p) => [p.fromStationId, p.toStationId]),
    );
    expect(a.map((p) => [p.fromStationId, p.toStationId])).not.toEqual(
      c.map((p) => [p.fromStationId, p.toStationId]),
    );

    const seen = new Set<string>();
    for (const p of a) {
      expect(p.fromStationId).not.toBe(p.toStationId);
      expect(p.optimalRoute.transfers).toBeGreaterThanOrEqual(1);
      seen.add(p.fromStationId);
      seen.add(p.toStationId);
    }
    expect(seen.size).toBe(10);
  });

  it('includes Tram routes in U+S+Tram daily puzzles and generates Free Play rounds', () => {
    const dailyTram = generateDailyPuzzles(ustGraph, '2026-11-23', 'ust');
    expect(dailyTram).toHaveLength(DAILY_ROUNDS_COUNT);
    const tramCount = dailyTram.filter((p) =>
      p.optimalRoute.lineIds.some((id) => network.lines[id].mode === 'tram'),
    ).length;
    expect(tramCount).toBeGreaterThanOrEqual(1);

    const free = generateFreePlayPuzzle(usGraph, 'us', 123456);
    expect(free.optimalRoute.transfers).toBeGreaterThanOrEqual(1);
  });
});
