/**
 * Build script: parses official MVV GTFS open data into a clean, compact
 * Munich transit network JSON (`src/data/munich-network.json`) for Einsteigen.
 *
 * Usage:
 *   pnpm data:build            (reuses cached .cache/gtfs if present)
 *   pnpm data:build --refresh  (re-downloads fresh MVV GTFS zip + Tarifzonen CSV)
 */

import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { execSync } from 'node:child_process';
import { getLineVisual, sortLineIds } from '../src/data/mvg-colors.ts';
import type {
  MunichNetwork,
  NetworkSegment,
  Station,
  TransitLine,
  TransitMode,
} from '../src/types.ts';

const ROOT = process.cwd();
const CACHE_DIR = path.join(ROOT, '.cache', 'gtfs');
const EXTRACTED_DIR = path.join(CACHE_DIR, 'extracted');
const OUTPUT_PATH = path.join(ROOT, 'src', 'data', 'munich-network.json');

const GTFS_URL =
  'https://www.mvv-muenchen.de/fileadmin/mediapool/developer/opendata/gesamt_gtfs.zip';
const TARIFZONEN_URL =
  'https://www.mvv-muenchen.de/fileadmin/mediapool/developer/opendata/Haltestellen_Tarifzonen_s26.csv';

const UBAHN_ALLOWED = new Set(['U1', 'U2', 'U3', 'U4', 'U5', 'U6']);
const SBAHN_ALLOWED = new Set(['S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8', 'S20']);
// Daytime Munich MVG Tram lines (excluding night lines N17/N19/N20/N27)
const TRAM_REGEX = /^\d{2}$/;

/** Parse a single CSV line supporting double-quoted fields. */
function parseCsvLine(line: string, delimiter = ','): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === delimiter && !inQuotes) {
      out.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}

function readCsvSync(filePath: string, delimiter = ','): Record<string, string>[] {
  const raw = fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '');
  const lines = raw.split(/\r?\n/).filter((l) => l.length > 0);
  if (lines.length === 0) return [];
  const headers = parseCsvLine(lines[0], delimiter);
  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i], delimiter);
    const obj: Record<string, string> = {};
    for (let j = 0; j < headers.length; j++) {
      obj[headers[j]] = cols[j] ?? '';
    }
    rows.push(obj);
  }
  return rows;
}

function parseGtfsTime(hms: string): number | null {
  const parts = hms.split(':');
  if (parts.length !== 3) return null;
  const h = Number(parts[0]);
  const m = Number(parts[1]);
  const s = Number(parts[2]);
  if (Number.isNaN(h) || Number.isNaN(m) || Number.isNaN(s)) return null;
  return h * 3600 + m * 60 + s;
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Clean MVV stop names and unify known Munich multi-name interchange stations
 * (e.g., "Hauptbahnhof (S, U, Bus, Tram)", "Hauptbahnhof Nord/Süd", "München Hbf Gl. 27-36" -> "Hauptbahnhof").
 */
function cleanStationName(rawName: string): string {
  let name = rawName.trim();

  // Strip trailing parenthetical mode lists like "(S, U, Bus, Tram)" or "(U)"
  name = name.replace(/\s*\((?:[SUVBRT]|Bus|Tram|U-Bahn|S-Bahn|,\s*)+\)\s*$/i, '');
  // Strip "München, " or "München-" prefixes for city stations while keeping suburbs readable
  name = name.replace(/^München,\s*/i, '');
  name = name.replace(/^München\s+Hbf.*$/i, 'Hauptbahnhof');
  name = name.replace(/^München-Pasing$/i, 'Pasing');
  name = name.replace(/^Pasing\s+Bf\.?(\s+Nord|\s+Süd)?$/i, 'Pasing');
  name = name.replace(/^München\s+Ost(\s+\(Ostbahnhof\))?$/i, 'Ostbahnhof');
  name = name.replace(/^Ostbahnhof\s+Friedenstraße$/i, 'Ostbahnhof');
  name = name.replace(/^München\s+Leuchtenbergring$/i, 'Leuchtenbergring');
  name = name.replace(/^München\s+Donnersbergerbrücke$/i, 'Donnersbergerbrücke');
  name = name.replace(/^München\s+Hackerbrücke$/i, 'Hackerbrücke');
  name = name.replace(/^München\s+Isartor$/i, 'Isartor');
  name = name.replace(/^München\s+Marienplatz$/i, 'Marienplatz');
  name = name.replace(/^München\s+Karlsplatz$/i, 'Karlsplatz (Stachus)');
  name = name.replace(/^München\s+Rosenheimer Platz$/i, 'Rosenheimer Platz');
  name = name.replace(/^München\s+Heimeranplatz$/i, 'Heimeranplatz');
  name = name.replace(/^München\s+Harras$/i, 'Harras');
  name = name.replace(/^München-Giesing$/i, 'Giesing');
  name = name.replace(/^Giesing\s+Bf\.?$/i, 'Giesing');
  name = name.replace(/^München-Moosach$/i, 'Moosach');
  name = name.replace(/^Moosach\s+Bf\.?$/i, 'Moosach');
  name = name.replace(/^München-Trudering$/i, 'Trudering');
  name = name.replace(/^Trudering\s+Bf\.?$/i, 'Trudering');
  name = name.replace(/^München-Feldmoching$/i, 'Feldmoching');
  name = name.replace(/^Feldmoching\s+Bf\.?$/i, 'Feldmoching');
  name = name.replace(/^München-Laim$/i, 'Laim');
  name = name.replace(/^Laim\s+Bf\.?$/i, 'Laim');
  name = name.replace(/^München-Berg am Laim$/i, 'Berg am Laim');
  name = name.replace(/^Berg am Laim\s+Bf\.?$/i, 'Berg am Laim');
  name = name.replace(/^München-Riem$/i, 'Riem');
  name = name.replace(/^München-Daglfing$/i, 'Daglfing');
  name = name.replace(/^München-Englschalking$/i, 'Englschalking');
  name = name.replace(/^München-Johanneskirchen$/i, 'Johanneskirchen');
  name = name.replace(/^München-Fasanerie$/i, 'Fasanerie');
  name = name.replace(/^München-Allach$/i, 'Allach');
  name = name.replace(/^München-Karlsfeld$/i, 'Karlsfeld');
  name = name.replace(/^München-Langwied$/i, 'Langwied');
  name = name.replace(/^München-Lochhausen$/i, 'Lochhausen');
  name = name.replace(/^München-Aubing$/i, 'Aubing');
  name = name.replace(/^München-Westkreuz$/i, 'Westkreuz');
  name = name.replace(/^München-Neuaubing$/i, 'Neuaubing');
  name = name.replace(/^München-Freiham$/i, 'Freiham');
  name = name.replace(/^München-Mittersendling$/i, 'Mittersendling');
  name = name.replace(/^München-Siemenswerke$/i, 'Siemenswerke');
  name = name.replace(/^München-Solln$/i, 'Solln');
  name = name.replace(/^München-Fasangarten$/i, 'Fasangarten');
  name = name.replace(/^München-Perlach$/i, 'Perlach');
  name = name.replace(/^München-St\.?\s*Martin-Straße$/i, 'St.-Martin-Straße');
  name = name.replace(/^München-Hirschgarten$/i, 'Hirschgarten');
  name = name.replace(/^München-Obermenzing$/i, 'Obermenzing');
  name = name.replace(/^München-Untermenzing$/i, 'Untermenzing');

  // Unify Tram sub-stops at major hubs into their main hub
  const hubAliases: Record<string, string> = {
    'Hauptbahnhof Nord': 'Hauptbahnhof',
    'Hauptbahnhof Süd': 'Hauptbahnhof',
    'Hauptbahnhof (Bahnhofplatz)': 'Hauptbahnhof',
    'Hbf (Bahnhofplatz)': 'Hauptbahnhof',
    'Sendlinger Tor (U)': 'Sendlinger Tor',
    'Max-Weber-Platz (Johannispl.)': 'Max-Weber-Platz',
    'Max-Weber-Platz (Johannisplatz)': 'Max-Weber-Platz',
    'Effnerplatz (Arabellapark)': 'Effnerplatz',
    'Münchner Freiheit (U)': 'Münchner Freiheit',
    'St.-Martins-Platz': 'St.-Martins-Platz',
    'Flughafen München': 'Flughafen München',
    'München Flughafen Terminal': 'Flughafen München',
    'Flughafen Besucherpark': 'Flughafen Besucherpark',
    'München Flughafen Besucherpark': 'Flughafen Besucherpark',
    'Bahnhof Höllriegelskreuth': 'Höllriegelskreuth',
    'Neuperlach Süd (U/S)': 'Neuperlach Süd',
    'Neuperlach Süd': 'Neuperlach Süd',
    'Garching, Forschungszentrum': 'Garching-Forschungszentrum',
    'Garching, Hochbrück': 'Garching-Hochbrück',
  };

  if (hubAliases[name]) {
    name = hubAliases[name];
  }

  return name.trim();
}

function median(nums: number[]): number {
  if (nums.length === 0) return 120;
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? Math.round((sorted[mid - 1] + sorted[mid]) / 2)
    : sorted[mid];
}

function ensureGtfsDownloaded(forceRefresh: boolean): void {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  const zipPath = path.join(CACHE_DIR, 'gesamt_gtfs.zip');
  const tzPath = path.join(CACHE_DIR, 'tarifzonen.csv');

  if (forceRefresh || !fs.existsSync(zipPath)) {
    console.log('Downloading MVV Gesamt GTFS...');
    execSync(`curl -sSL "${GTFS_URL}" -o "${zipPath}"`, { stdio: 'inherit' });
  }
  if (forceRefresh || !fs.existsSync(tzPath)) {
    console.log('Downloading MVV Tarifzonen CSV...');
    execSync(`curl -sSL "${TARIFZONEN_URL}" -o "${tzPath}"`, { stdio: 'inherit' });
  }
  if (forceRefresh || !fs.existsSync(path.join(EXTRACTED_DIR, 'routes.txt'))) {
    fs.mkdirSync(EXTRACTED_DIR, { recursive: true });
    console.log('Extracting GTFS archive...');
    execSync(`unzip -oq "${zipPath}" -d "${EXTRACTED_DIR}"`, { stdio: 'inherit' });
  }
}

async function main() {
  const forceRefresh = process.argv.includes('--refresh');
  ensureGtfsDownloaded(forceRefresh);

  // 1. Feed metadata
  const feedInfoRows = readCsvSync(path.join(EXTRACTED_DIR, 'feed_info.txt'));
  const feedVersion = feedInfoRows[0]?.feed_version ?? 'unknown';
  console.log(`MVV GTFS feed version: ${feedVersion}`);

  // 2. Load Tarifzonen CSV (semicolon-delimited)
  const tzPath = path.join(CACHE_DIR, 'tarifzonen.csv');
  const zoneByGlobalId = new Map<string, string>();
  const zoneByCleanName = new Map<string, string>();
  if (fs.existsSync(tzPath)) {
    const tzRows = readCsvSync(tzPath, ';');
    for (const row of tzRows) {
      const gid = row['Globale ID']?.trim();
      const zone = row['Tarifzone TSR']?.trim();
      const rawName = row['Name mit Ort']?.trim();
      if (gid && zone) zoneByGlobalId.set(gid, zone);
      if (rawName && zone) {
        const cleaned = cleanStationName(rawName);
        if (!zoneByCleanName.has(cleaned)) {
          zoneByCleanName.set(cleaned, zone);
        }
      }
    }
  }
  console.log(`Loaded ${zoneByGlobalId.size} Tarifzone mappings.`);

  // 3. Filter routes: U1-U6, S1-S8 + S20, daytime MVG Trams
  const routesRows = readCsvSync(path.join(EXTRACTED_DIR, 'routes.txt'));
  const targetRoutes = new Map<
    string,
    { lineId: string; mode: TransitMode; label: string }
  >();

  for (const r of routesRows) {
    const id = r.route_id;
    const shortName = r.route_short_name?.trim();
    const type = r.route_type?.trim();

    if (type === '1' && UBAHN_ALLOWED.has(shortName) && id.includes('|U:')) {
      targetRoutes.set(id, { lineId: shortName, mode: 'ubahn', label: shortName });
    } else if (
      SBAHN_ALLOWED.has(shortName) &&
      (id.startsWith('ddb-') || type === '0' || type === '2')
    ) {
      targetRoutes.set(id, { lineId: shortName, mode: 'sbahn', label: shortName });
    } else if (
      type === '0' &&
      id.includes('|T:') &&
      TRAM_REGEX.test(shortName) &&
      !shortName.startsWith('N')
    ) {
      targetRoutes.set(id, { lineId: shortName, mode: 'tram', label: shortName });
    }
  }

  console.log(
    `Matched ${targetRoutes.size} routes:`,
    sortLineIds([...new Set([...targetRoutes.values()].map((v) => v.lineId))]).join(', '),
  );

  // 4. Load stops.txt and resolve parent stations
  const stopsRows = readCsvSync(path.join(EXTRACTED_DIR, 'stops.txt'));
  const stopById = new Map<
    string,
    { id: string; name: string; lat: number; lon: number; parent: string }
  >();
  for (const s of stopsRows) {
    stopById.set(s.stop_id, {
      id: s.stop_id,
      name: s.stop_name,
      lat: Number(s.stop_lat),
      lon: Number(s.stop_lon),
      parent: s.parent_station?.trim() || '',
    });
  }

  // Canonical hub resolver: maps any GTFS stop_id -> canonical station slug + cleaned name
  const canonicalStations = new Map<
    string,
    {
      id: string;
      name: string;
      lats: number[];
      lons: number[];
      zones: string[];
      lines: Set<string>;
      modes: Set<TransitMode>;
    }
  >();

  function resolveCanonicalStop(stopId: string): { id: string; name: string } | null {
    const s = stopById.get(stopId);
    if (!s) return null;
    const parent = s.parent ? stopById.get(s.parent) ?? s : s;
    const cleaned = cleanStationName(parent.name);
    const id = slugify(cleaned);
    if (!id) return null;

    let entry = canonicalStations.get(id);
    if (!entry) {
      entry = {
        id,
        name: cleaned,
        lats: [],
        lons: [],
        zones: [],
        lines: new Set(),
        modes: new Set(),
      };
      canonicalStations.set(id, entry);
    }

    if (parent.lat && parent.lon) {
      entry.lats.push(parent.lat);
      entry.lons.push(parent.lon);
    }
    const z =
      zoneByGlobalId.get(parent.id) ??
      zoneByGlobalId.get(s.id) ??
      zoneByCleanName.get(cleaned);
    if (z) entry.zones.push(z);

    return { id, name: cleaned };
  }

  // 5. Load trips belonging to target routes
  const tripsRows = readCsvSync(path.join(EXTRACTED_DIR, 'trips.txt'));
  const tripToLine = new Map<
    string,
    { lineId: string; mode: TransitMode; directionId: string }
  >();

  for (const t of tripsRows) {
    const route = targetRoutes.get(t.route_id);
    if (!route) continue;
    tripToLine.set(t.trip_id, {
      lineId: route.lineId,
      mode: route.mode,
      directionId: t.direction_id ?? '0',
    });
  }
  console.log(`Matched ${tripToLine.size} trips for target lines.`);

  // 6. Stream stop_times.txt to collect trip stop sequences & segment durations
  const tripStops = new Map<
    string,
    Array<{ seq: number; stopId: string; depSec: number | null; arrSec: number | null }>
  >();

  const stStream = fs.createReadStream(path.join(EXTRACTED_DIR, 'stop_times.txt'), {
    encoding: 'utf8',
  });
  const rl = readline.createInterface({ input: stStream, crlfDelay: Infinity });

  let headers: string[] | null = null;
  let idxTrip = 0;
  let idxArr = 1;
  let idxDep = 2;
  let idxStop = 3;
  let idxSeq = 4;

  for await (const rawLine of rl) {
    if (!rawLine) continue;
    if (!headers) {
      headers = parseCsvLine(rawLine.replace(/^\uFEFF/, ''));
      idxTrip = headers.indexOf('trip_id');
      idxArr = headers.indexOf('arrival_time');
      idxDep = headers.indexOf('departure_time');
      idxStop = headers.indexOf('stop_id');
      idxSeq = headers.indexOf('stop_sequence');
      continue;
    }

    // Fast pre-check before full CSV parse: extract trip_id quickly
    const firstComma = rawLine.indexOf(',');
    if (firstComma === -1) continue;
    const rawTripId = rawLine.slice(0, firstComma).replace(/^"|"$/g, '');
    if (!tripToLine.has(rawTripId)) continue;

    const cols = parseCsvLine(rawLine);
    const tripId = cols[idxTrip];
    const stopId = cols[idxStop];
    const seq = Number(cols[idxSeq]);
    const arrSec = parseGtfsTime(cols[idxArr]);
    const depSec = parseGtfsTime(cols[idxDep]);

    let arr = tripStops.get(tripId);
    if (!arr) {
      arr = [];
      tripStops.set(tripId, arr);
    }
    arr.push({ seq, stopId, depSec, arrSec });
  }

  console.log(`Collected stop_times for ${tripStops.size} trips.`);

  // 7. Aggregate patterns & segment travel times per line
  interface LineAgg {
    lineId: string;
    mode: TransitMode;
    patternCounts: Map<string, { stations: string[]; count: number }>;
    segmentTimes: Map<string, number[]>; // key "a|b" (sorted) -> durations in sec
    edgeCounts: Map<string, number>;
    totalTrips: number;
  }

  const lineAggs = new Map<string, LineAgg>();

  for (const [tripId, stops] of tripStops) {
    const meta = tripToLine.get(tripId);
    if (!meta) continue;
    stops.sort((a, b) => a.seq - b.seq);

    const canonicalSeq: Array<{ id: string; arrSec: number | null; depSec: number | null }> = [];
    for (const st of stops) {
      const resolved = resolveCanonicalStop(st.stopId);
      if (!resolved) continue;
      // Deduplicate consecutive identical canonical stops (e.g. if a tram stops twice inside one merged hub)
      if (canonicalSeq.length > 0 && canonicalSeq[canonicalSeq.length - 1].id === resolved.id) {
        continue;
      }
      canonicalSeq.push({ id: resolved.id, arrSec: st.arrSec, depSec: st.depSec });
    }

    if (canonicalSeq.length < 2) continue;

    let agg = lineAggs.get(meta.lineId);
    if (!agg) {
      agg = {
        lineId: meta.lineId,
        mode: meta.mode,
        patternCounts: new Map(),
        segmentTimes: new Map(),
        edgeCounts: new Map(),
        totalTrips: 0,
      };
      lineAggs.set(meta.lineId, agg);
    }
    agg.totalTrips++;

    const stationIds = canonicalSeq.map((s) => s.id);
    const patKey = stationIds.join('>');
    const existingPat = agg.patternCounts.get(patKey);
    if (existingPat) {
      existingPat.count++;
    } else {
      agg.patternCounts.set(patKey, { stations: stationIds, count: 1 });
    }

    for (let i = 0; i < canonicalSeq.length - 1; i++) {
      const a = canonicalSeq[i];
      const b = canonicalSeq[i + 1];
      const [u, v] = a.id < b.id ? [a.id, b.id] : [b.id, a.id];
      const edgeKey = `${u}|${v}`;
      agg.edgeCounts.set(edgeKey, (agg.edgeCounts.get(edgeKey) ?? 0) + 1);

      if (a.depSec !== null && b.arrSec !== null) {
        const dt = b.arrSec - a.depSec;
        if (dt >= 30 && dt <= 1800) {
          let times = agg.segmentTimes.get(edgeKey);
          if (!times) {
            times = [];
            agg.segmentTimes.set(edgeKey, times);
          }
          times.push(dt);
        }
      }
    }
  }

  // 8. Build final clean lines, branches, segments, and stations
  // Filter out ultra-rare one-off depot/construction detour edges (< 1.5% of a line's trips and < 10 trips)
  // while keeping real scheduled branches (like S1 Freising/Flughafen, S2 Altomünster/Petershausen, S20).
  const finalLines: Record<string, TransitLine> = {};
  const finalSegments: NetworkSegment[] = [];
  const usedStationIds = new Set<string>();

  for (const lineId of sortLineIds([...lineAggs.keys()])) {
    const agg = lineAggs.get(lineId)!;
    if (agg.totalTrips < 5) {
      console.log(`Skipping inactive/empty line ${lineId} (${agg.totalTrips} trips)`);
      continue;
    }

    // Keep edges appearing in at least max(3, 2% of totalTrips) trips — avoids single-day detour noise
    const minEdgeCount = Math.max(3, Math.floor(agg.totalTrips * 0.02));
    const validEdges = new Set<string>();
    const lineStationSet = new Set<string>();

    for (const [edgeKey, count] of agg.edgeCounts) {
      if (count >= minEdgeCount) {
        validEdges.add(edgeKey);
        const [u, v] = edgeKey.split('|');
        lineStationSet.add(u);
        lineStationSet.add(v);
      }
    }

    if (lineStationSet.size < 3) {
      console.log(`Skipping tiny line ${lineId} (${lineStationSet.size} stations)`);
      continue;
    }

    // Select representative branches from frequent patterns whose edges are all valid.
    // Only add an extra branch if it introduces at least one NEW station (prevents
    // express / skip-stop patterns from creating shortcut edges bypassing regular stops).
    const minBranchTrips = Math.max(4, Math.floor(agg.totalTrips * 0.03));
    const sortedPatterns = [...agg.patternCounts.values()]
      .filter((p) => {
        if (p.count < minBranchTrips) return false;
        for (let i = 0; i < p.stations.length - 1; i++) {
          const [u, v] =
            p.stations[i] < p.stations[i + 1]
              ? [p.stations[i], p.stations[i + 1]]
              : [p.stations[i + 1], p.stations[i]];
          if (!validEdges.has(`${u}|${v}`)) return false;
        }
        return true;
      })
      .sort((a, b) => b.stations.length - a.stations.length || b.count - a.count);

    const branches: string[][] = [];
    const coveredStations = new Set<string>();
    const coveredEdges = new Set<string>();

    for (const pat of sortedPatterns) {
      const addsNewStation = pat.stations.some((s) => !coveredStations.has(s));
      if (!addsNewStation) continue;

      branches.push(pat.stations);
      for (const s of pat.stations) coveredStations.add(s);
      for (let i = 0; i < pat.stations.length - 1; i++) {
        const [u, v] =
          pat.stations[i] < pat.stations[i + 1]
            ? [pat.stations[i], pat.stations[i + 1]]
            : [pat.stations[i + 1], pat.stations[i]];
        coveredEdges.add(`${u}|${v}`);
      }
    }

    // Emit clean segments for all covered edges (or validEdges if branches missed any)
    const activeEdges = coveredEdges.size > 0 ? coveredEdges : validEdges;
    const finalLineStations = new Set<string>();

    for (const edgeKey of activeEdges) {
      const [u, v] = edgeKey.split('|');
      finalLineStations.add(u);
      finalLineStations.add(v);
      usedStationIds.add(u);
      usedStationIds.add(v);

      const times = agg.segmentTimes.get(edgeKey) ?? [];
      finalSegments.push({
        from: u,
        to: v,
        line: lineId,
        timeSec: median(times),
      });

      const stU = canonicalStations.get(u);
      const stV = canonicalStations.get(v);
      if (stU) {
        stU.lines.add(lineId);
        stU.modes.add(agg.mode);
      }
      if (stV) {
        stV.lines.add(lineId);
        stV.modes.add(agg.mode);
      }
    }

    const visual = getLineVisual(lineId, agg.mode);
    finalLines[lineId] = {
      id: lineId,
      label: lineId,
      mode: agg.mode,
      color: visual.color,
      textColor: visual.textColor,
      stations: [...finalLineStations].sort(),
      branches,
    };
  }

  // 9. Build final stations dictionary
  const finalStations: Record<string, Station> = {};
  for (const id of [...usedStationIds].sort()) {
    const raw = canonicalStations.get(id);
    if (!raw || raw.lats.length === 0) continue;

    // Average coordinates cleanly
    const lat = Number(
      (raw.lats.reduce((a, b) => a + b, 0) / raw.lats.length).toFixed(5),
    );
    const lon = Number(
      (raw.lons.reduce((a, b) => a + b, 0) / raw.lons.length).toFixed(5),
    );

    // Pick most common Tarifzone
    let zone = 'M';
    if (raw.zones.length > 0) {
      const counts = new Map<string, number>();
      for (const z of raw.zones) counts.set(z, (counts.get(z) ?? 0) + 1);
      zone = [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
    } else {
      // Rough fallback distance from Marienplatz (48.1371, 11.5761)
      const distKm = Math.hypot((lat - 48.1371) * 111, (lon - 11.5761) * 74);
      zone = distKm <= 10.5 ? 'M' : 'outer';
    }

    const isZoneM = zone.split('/').includes('M');

    finalStations[id] = {
      id,
      name: raw.name,
      lat,
      lon,
      zone,
      isZoneM,
      lines: sortLineIds([...raw.lines]),
      modes: [...raw.modes].sort(),
    };
  }

  const network: MunichNetwork = {
    meta: {
      source: 'MVV GTFS-Gesamtnetz',
      feedVersion,
      generatedAt: new Date().toISOString(),
      license: 'CC-BY 4.0',
      attribution: 'Münchner Verkehrs- und Tarifverbund GmbH (MVV)',
    },
    stations: finalStations,
    lines: finalLines,
    segments: finalSegments,
  };

  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(network, null, 2), 'utf8');

  // Diagnostic report
  const lineSummary = Object.values(finalLines).map(
    (l) =>
      `  ${l.id.padEnd(4)} (${l.mode.padEnd(5)}): ${String(l.stations.length).padStart(3)} stations, ${l.branches.length} branch(es) [${l.branches[0]?.[0]} <-> ${l.branches[0]?.[l.branches[0].length - 1]}]`,
  );
  console.log('\n=== BUILT MUNICH NETWORK ===');
  console.log(`Stations: ${Object.keys(finalStations).length}`);
  console.log(`Lines:    ${Object.keys(finalLines).length}`);
  console.log(`Segments: ${finalSegments.length}`);
  console.log(lineSummary.join('\n'));

  console.log('\n=== KEY HUBS CHECK ===');
  for (const hub of [
    'hauptbahnhof',
    'marienplatz',
    'karlsplatz-stachus',
    'sendlinger-tor',
    'odeonsplatz',
    'ostbahnhof',
    'pasing',
    'muenchner-freiheit',
    'scheidplatz',
    'innsbrucker-ring',
    'moosach',
    'giesing',
    'neuperlach-sued',
    'flughafen-muenchen',
  ]) {
    const st = finalStations[hub];
    console.log(
      `  ${hub.padEnd(20)}: ${st ? `${st.name} [${st.zone}] -> ${st.lines.join(', ')}` : 'MISSING!'}`,
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
