import type { Locale, RoundGrade, RouteValidationResult } from './types';

export interface Translations {
  appName: string;
  tagline: string;
  daily: string;
  freePlay: string;
  modeUS: string;
  modeUST: string;
  from: string;
  to: string;
  roundOf: (current: number, total: number) => string;
  pickLinesPrompt: string;
  selectedLines: string;
  submit: string;
  undo: string;
  clear: string;
  giveUp: string;
  nextRound: string;
  newRound: string;
  viewSummary: string;
  attemptsLeft: (n: number) => string;
  ubahn: string;
  sbahn: string;
  tram: string;
  yourRoute: string;
  optimalRoute: string;
  fastestRoute: string;
  minutes: (min: number) => string;
  transfers: (n: number) => string;
  stops: (n: number) => string;
  fasterBy: (min: number) => string;
  slowerBy: (min: number) => string;
  exactMatch: string;
  transferAt: (station: string) => string;
  gradeLabel: Record<RoundGrade, string>;
  dailyTitle: (dateKey: string) => string;
  dailySubtitle: string;
  shareResults: string;
  copied: string;
  playFreePlay: string;
  switchToTram: string;
  switchToUS: string;
  statsTitle: string;
  dailyCompleted: string;
  currentStreak: string;
  bestStreak: string;
  optimalRate: string;
  helpTitle: string;
  helpIntro: string;
  helpRules: string[];
  helpModesTitle: string;
  helpModesBody: string;
  helpScoringTitle: string;
  helpScoringBody: string;
  helpAttribution: string;
  close: string;
  themeAuto: string;
  themeLight: string;
  themeDark: string;
  mapStyleStandard: string;
  mapStyleSatellite: string;
  mapStyleAriaLabel: string;
  recenterMap: string;
  recenterStationsTitle: string;
  recenterMunichTitle: string;
  homeSubtitle: string;
  homePlayDaily: string;
  homeContinueDaily: string;
  homePlayFree: string;
  homeHideLinesHint: string;
  homeNetworkLabel: string;
  homeStatsBadge: (lines: number, stations: number) => string;
  homeButtonTitle: string;
  showNetworkHint: string;
  zoneLabel: (zone: string) => string;
  validationError: (err: NonNullable<RouteValidationResult['error']>) => string;
  difficulty: {
    easy: string;
    medium: string;
    hard: string;
  };
  noRouteSubmitted: string;
  sameDurationTie: string;
  attemptHistory: string;
  invalidAttempt: string;
  summaryOptimalMetric: string;
  summaryTimeDeltaMetric: string;
  summarySolvedMetric: string;
  summaryYoursShort: string;
  summaryOptimalShort: string;
  summaryInspectOnMap: string;
  freePlayFilters: string;
  freePlayZonesLabel: string;
  freePlayAllZones: string;
  freePlayDifficultyLabel: string;
  freePlayDifficultyAny: string;
  freePlayIncludeTram: string;
  freePlayStationsCount: (n: number) => string;
  freePlayZonesSummary: (zones: string[]) => string;
}

const de: Translations = {
  appName: 'Einsteigen',
  tagline: 'Münchner ÖPNV-Rätsel',
  daily: 'Tagesrätsel',
  freePlay: 'Freies Spiel',
  modeUS: 'U + S',
  modeUST: 'U + S + Tram',
  from: 'Start',
  to: 'Ziel',
  roundOf: (c, t) => `Runde ${c} von ${t}`,
  pickLinesPrompt: 'Wähle die Linien in der richtigen Reihenfolge:',
  selectedLines: 'Deine Verbindung',
  submit: 'Prüfen',
  undo: 'Zurück',
  clear: 'Leeren',
  giveUp: 'Auflösen',
  nextRound: 'Nächste Runde',
  newRound: 'Neue Strecke',
  viewSummary: 'Ergebnis ansehen',
  attemptsLeft: (n) => (n === 1 ? 'Noch 1 Versuch' : `Noch ${n} Versuche`),
  ubahn: 'U-Bahn',
  sbahn: 'S-Bahn',
  tram: 'Tram',
  yourRoute: 'Deine Route',
  optimalRoute: 'Schnellste Route',
  fastestRoute: 'Optimale Route',
  minutes: (m) => `${m} Min.`,
  transfers: (n) => (n === 0 ? 'Direkt' : n === 1 ? '1× Umsteigen' : `${n}× Umsteigen`),
  stops: (n) => (n === 1 ? '1 Halt' : `${n} Halte`),
  fasterBy: (m) => `${m} Min. schneller`,
  slowerBy: (m) => `+${m} Min. langsamer`,
  exactMatch: 'Optimal!',
  transferAt: (s) => `Umstieg ${s}`,
  gradeLabel: {
    optimal: 'Optimal',
    great: 'Stark',
    good: 'Gut',
    valid: 'Angekommen',
    skipped: 'Aufgelöst',
  },
  dailyTitle: (dateKey) => `Tagesrätsel · ${dateKey}`,
  dailySubtitle: 'Alle 5 Strecken geschafft — morgen gibt es neue!',
  shareResults: 'Ergebnis teilen',
  copied: 'Kopiert!',
  playFreePlay: 'Im Freien Spiel weitermachen',
  switchToTram: 'Auch mit Tram spielen',
  switchToUS: 'Klassik (U + S) spielen',
  statsTitle: 'Statistik',
  dailyCompleted: 'Tagesrätsel',
  currentStreak: 'Aktuelle Serie',
  bestStreak: 'Beste Serie',
  optimalRate: 'Optimal-Quote',
  helpTitle: 'So funktioniert Einsteigen',
  helpIntro:
    'Teste dein Wissen über das Münchner U-Bahn-, S-Bahn- und Tramnetz — ganz ohne MVG-App!',
  helpRules: [
    'Du bekommst eine Start- und eine Zielhaltestelle auf einer neutralen München-Karte.',
    'Wähle die Linien in der Reihenfolge aus, mit der du von Start zum Ziel fährst (z. B. U3 → U2).',
    'Umsteigehaltestellen werden automatisch optimal bestimmt — entscheidend ist, dass sich die Linien wirklich kreuzen.',
    'Nach einem gültigen Versuch (max. 3 Versuche) siehst du deine Route im Vergleich zur schnellsten Verbindung auf der Karte.',
  ],
  helpModesTitle: 'Netz-Modi',
  helpModesBody:
    'U + S enthält U1–U6 sowie S1–S8 & S20 im gesamten MVV-Netz. Mit U + S + Tram kommt zusätzlich das Münchner Tramnetz dazu.',
  helpScoringTitle: 'Bewertung',
  helpScoringBody:
    'Optimal = innerhalb von 1 Min. der schnellsten Route · Stark = bis +4 Min. · Gut = bis +9 Min. · Angekommen = gültige Verbindung.',
  helpAttribution:
    'Fahrplandaten: Münchner Verkehrs- und Tarifverbund GmbH (MVV), GTFS-Gesamtnetz (CC-BY 4.0). Karte: OpenFreeMap / OpenStreetMap · Satellit: Esri World Imagery.',
  close: 'Schließen',
  themeAuto: 'System',
  themeLight: 'Hell',
  themeDark: 'Dunkel',
  mapStyleStandard: 'Standard',
  mapStyleSatellite: 'Satellit',
  mapStyleAriaLabel: 'Kartenansicht wechseln',
  recenterMap: 'Zentrieren',
  recenterStationsTitle: 'Karte wieder auf die Stationen zentrieren',
  recenterMunichTitle: 'Karte wieder auf München zentrieren',
  homeSubtitle:
    'Erkennst du Münchens U-Bahn-, S-Bahn- und Tramnetz aus dem Kopf?',
  homePlayDaily: 'Tagesrätsel starten',
  homeContinueDaily: 'Tagesrätsel fortsetzen',
  homePlayFree: 'Freies Spiel',
  homeHideLinesHint:
    'Sobald du startest, werden alle Linien auf der Karte ausgeblendet.',
  homeNetworkLabel: 'Netz wählen',
  homeStatsBadge: (lines, stations) => `${lines} Linien · ${stations} Halte`,
  homeButtonTitle: 'Zur Startseite',
  showNetworkHint: 'Liniennetz ausblenden während du rätst — kein Schummeln!',
  zoneLabel: (z) => `Zone ${z}`,
  validationError: (err) => {
    switch (err.code) {
      case 'empty':
        return 'Bitte wähle mindestens eine Linie aus.';
      case 'unknown_line':
        return `Unbekannte Linie ${err.lineA ?? ''}.`;
      case 'duplicate_adjacent_line':
        return `${err.lineA} ist zweimal hintereinander ausgewählt.`;
      case 'start_not_served':
        return `${err.lineA} hält nicht an ${err.stationName}.`;
      case 'end_not_served':
        return `${err.lineA} fährt nicht bis ${err.stationName}.`;
      case 'no_intersection':
        return `${err.lineA} und ${err.lineB} haben keinen gemeinsamen Umsteigepunkt.`;
      case 'disconnected_sequence':
        return 'Diese Linienfolge verbindet Start und Ziel nicht.';
    }
  },
  difficulty: {
    easy: 'Leicht',
    medium: 'Mittel',
    hard: 'Knifflig',
  },
  noRouteSubmitted: 'Keine gültige Route abgegeben',
  sameDurationTie: 'Gleich schnell wie die Optimalroute!',
  attemptHistory: 'Fehlversuche',
  invalidAttempt: 'Ungültig',
  summaryOptimalMetric: 'Optimal',
  summaryTimeDeltaMetric: 'Zeitverlust',
  summarySolvedMetric: 'Gelöst',
  summaryYoursShort: 'Deine',
  summaryOptimalShort: 'Optimal',
  summaryInspectOnMap: 'Auf Karte ansehen',
  freePlayFilters: 'Filter',
  freePlayZonesLabel: 'MVV-Zonen',
  freePlayAllZones: 'Alle',
  freePlayDifficultyLabel: 'Schwierigkeit',
  freePlayDifficultyAny: 'Gemischt',
  freePlayIncludeTram: 'Tram einschließen',
  freePlayStationsCount: (n) => `${n} Halte`,
  freePlayZonesSummary: (zones) =>
    zones.length === 1 ? `Zone ${zones[0]}` : `Zonen ${zones.join(', ')}`,
};

const en: Translations = {
  appName: 'Einsteigen',
  tagline: 'Munich Transit Puzzle',
  daily: 'Daily',
  freePlay: 'Free Play',
  modeUS: 'U + S',
  modeUST: 'U + S + Tram',
  from: 'Start',
  to: 'Destination',
  roundOf: (c, t) => `Round ${c} of ${t}`,
  pickLinesPrompt: 'Pick the sequence of lines to connect these stations:',
  selectedLines: 'Your route',
  submit: 'Check',
  undo: 'Undo',
  clear: 'Clear',
  giveUp: 'Reveal',
  nextRound: 'Next round',
  newRound: 'New trip',
  viewSummary: 'View summary',
  attemptsLeft: (n) => (n === 1 ? '1 try left' : `${n} tries left`),
  ubahn: 'U-Bahn',
  sbahn: 'S-Bahn',
  tram: 'Tram',
  yourRoute: 'Your route',
  optimalRoute: 'Fastest route',
  fastestRoute: 'Optimal route',
  minutes: (m) => `${m} min`,
  transfers: (n) => (n === 0 ? 'Direct' : n === 1 ? '1 transfer' : `${n} transfers`),
  stops: (n) => (n === 1 ? '1 stop' : `${n} stops`),
  fasterBy: (m) => `${m} min faster`,
  slowerBy: (m) => `+${m} min slower`,
  exactMatch: 'Optimal!',
  transferAt: (s) => `Transfer at ${s}`,
  gradeLabel: {
    optimal: 'Optimal',
    great: 'Great',
    good: 'Good',
    valid: 'Valid',
    skipped: 'Revealed',
  },
  dailyTitle: (dateKey) => `Daily · ${dateKey}`,
  dailySubtitle: 'All 5 trips completed — come back tomorrow for a new set!',
  shareResults: 'Share results',
  copied: 'Copied!',
  playFreePlay: 'Keep playing in Free Play',
  switchToTram: 'Try U + S + Tram mode',
  switchToUS: 'Try classic U + S mode',
  statsTitle: 'Statistics',
  dailyCompleted: 'Dailies',
  currentStreak: 'Streak',
  bestStreak: 'Best streak',
  optimalRate: 'Optimal rate',
  helpTitle: 'How to play Einsteigen',
  helpIntro:
    "Test your mental map of Munich's U-Bahn, S-Bahn, and Tram network — without reaching for a transit app.",
  helpRules: [
    'Each round gives you a Start and Destination station pinned on a label-free Munich map.',
    'Select the transit lines in order to make the trip (e.g. U3 → U2).',
    'Transfer hubs are resolved automatically — what counts is knowing which lines actually connect.',
    'Submit a valid route (up to 3 tries) to see it animated on the map alongside the fastest route.',
  ],
  helpModesTitle: 'Network modes',
  helpModesBody:
    'U + S covers U1–U6 and the full S1–S8 & S20 network. Toggle U + S + Tram to include Munich’s Tram lines.',
  helpScoringTitle: 'Scoring',
  helpScoringBody:
    'Optimal = within 1 min of fastest · Great = within +4 min · Good = within +9 min · Valid = any valid connection.',
  helpAttribution:
    'Schedule data: Münchner Verkehrs- und Tarifverbund GmbH (MVV), GTFS Gesamtnetz (CC-BY 4.0). Map: OpenFreeMap / OpenStreetMap · Satellite: Esri World Imagery.',
  close: 'Close',
  themeAuto: 'Auto',
  themeLight: 'Light',
  themeDark: 'Dark',
  mapStyleStandard: 'Standard',
  mapStyleSatellite: 'Satellite',
  mapStyleAriaLabel: 'Switch map style',
  recenterMap: 'Recenter',
  recenterStationsTitle: 'Recenter map on the stations',
  recenterMunichTitle: 'Recenter map on Munich',
  homeSubtitle:
    'Can you navigate Munich’s U-Bahn, S-Bahn, and Tram network from memory?',
  homePlayDaily: 'Play Daily Challenge',
  homeContinueDaily: 'Continue Daily',
  homePlayFree: 'Free Play',
  homeHideLinesHint:
    'All transit lines hide from the map as soon as you start playing.',
  homeNetworkLabel: 'Choose network',
  homeStatsBadge: (lines, stations) => `${lines} lines · ${stations} stations`,
  homeButtonTitle: 'Back to Home',
  showNetworkHint: 'Station labels stay hidden while guessing.',
  zoneLabel: (z) => `Zone ${z}`,
  validationError: (err) => {
    switch (err.code) {
      case 'empty':
        return 'Pick at least one line first.';
      case 'unknown_line':
        return `Unknown line ${err.lineA ?? ''}.`;
      case 'duplicate_adjacent_line':
        return `${err.lineA} is selected twice in a row.`;
      case 'start_not_served':
        return `${err.lineA} doesn't stop at ${err.stationName}.`;
      case 'end_not_served':
        return `${err.lineA} doesn't reach ${err.stationName}.`;
      case 'no_intersection':
        return `${err.lineA} and ${err.lineB} don't intersect.`;
      case 'disconnected_sequence':
        return "This sequence of lines doesn't connect start to destination.";
    }
  },
  difficulty: {
    easy: 'Easy',
    medium: 'Medium',
    hard: 'Tricky',
  },
  noRouteSubmitted: 'No valid route submitted',
  sameDurationTie: 'Tied for fastest!',
  attemptHistory: 'Failed attempts',
  invalidAttempt: 'Invalid',
  summaryOptimalMetric: 'Optimal',
  summaryTimeDeltaMetric: 'Time lost',
  summarySolvedMetric: 'Solved',
  summaryYoursShort: 'Yours',
  summaryOptimalShort: 'Optimal',
  summaryInspectOnMap: 'View on map',
  freePlayFilters: 'Options',
  freePlayZonesLabel: 'MVV Zones',
  freePlayAllZones: 'All',
  freePlayDifficultyLabel: 'Difficulty',
  freePlayDifficultyAny: 'Mixed',
  freePlayIncludeTram: 'Include Tram',
  freePlayStationsCount: (n) => `${n} stations`,
  freePlayZonesSummary: (zones) =>
    zones.length === 1 ? `Zone ${zones[0]}` : `Zones ${zones.join(', ')}`,
};

export const TRANSLATIONS: Record<Locale, Translations> = { de, en };
