# Einsteigen — Munich Transit Puzzle

A free, client-side browser puzzle game for Munich's U-Bahn, S-Bahn, and Tram network (MVV/MVG), inspired by [umsteigen.app/berlin](https://umsteigen.app/berlin).

## Features

- **Daily 5-Round Challenge** — Identical deterministic puzzles every day (`Europe/Berlin`), progressing in difficulty, with a shareable spoiler-free result card.
- **Free Play Mode** — Unlimited randomized routes across Munich.
- **Network Modes** — Classic **U + S-Bahn** or full **U + S + Tram** mode.
- **Real MVV Transit Graph** — Built from official MVV GTFS timetable data with real segment durations, transfer walking times, and full S-Bahn reach.
- **Interactive Munich Map** — Powered by MapLibre GL with clean light/dark basemaps (map labels stay hidden while guessing and reveal your route vs. the optimal route afterward).
- **Bilingual UI** — Instant **DE / EN** toggle.

## Development

```bash
pnpm install
pnpm dev
```

### Rebuild Munich Transit Data from MVV GTFS

```bash
pnpm data:build
```

### Tests & Build

```bash
pnpm test
pnpm build
```

## Data Attribution

Transit network data derived from **Münchner Verkehrs- und Tarifverbund GmbH (MVV)** Open Data (`GTFS-MVV-Gesamt`, CC-BY 4.0). Map tiles courtesy of OpenFreeMap / OpenStreetMap contributors.
