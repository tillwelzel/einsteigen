export type TransitMode = 'ubahn' | 'sbahn' | 'tram';

export type NetworkMode = 'us' | 'ust';

export type GameMode = 'daily' | 'free';

export type Locale = 'de' | 'en';

export type ThemeSetting = 'auto' | 'light' | 'dark';

export type MapStyleMode = 'standard' | 'satellite';

export interface Station {
  id: string;
  name: string;
  lat: number;
  lon: number;
  zone: string;
  isZoneM: boolean;
  lines: string[];
  modes: TransitMode[];
}

export interface TransitLine {
  id: string;
  label: string;
  mode: TransitMode;
  color: string;
  textColor: string;
  stations: string[];
  /** One or more ordered station sequences (covers branching S-Bahn lines like S1/S2). */
  branches: string[][];
}

export interface NetworkSegment {
  from: string;
  to: string;
  line: string;
  timeSec: number;
}

export interface MunichNetwork {
  meta: {
    source: string;
    feedVersion: string;
    generatedAt: string;
    license: string;
    attribution: string;
  };
  stations: Record<string, Station>;
  lines: Record<string, TransitLine>;
  segments: NetworkSegment[];
}

export interface RouteLeg {
  lineId: string;
  fromStationId: string;
  toStationId: string;
  stationIds: string[];
  rideTimeSec: number;
  transferTimeSec: number;
}

export interface ComputedRoute {
  legs: RouteLeg[];
  lineIds: string[];
  totalTimeSec: number;
  transfers: number;
  totalStops: number;
}

export type ValidationErrorCode =
  | 'empty'
  | 'unknown_line'
  | 'duplicate_adjacent_line'
  | 'start_not_served'
  | 'end_not_served'
  | 'no_intersection'
  | 'disconnected_sequence';

export interface RouteValidationResult {
  valid: boolean;
  route?: ComputedRoute;
  error?: {
    code: ValidationErrorCode;
    lineA?: string;
    lineB?: string;
    stationName?: string;
  };
}

export type RoundGrade = 'optimal' | 'great' | 'good' | 'valid' | 'skipped';

export interface Puzzle {
  id: string;
  fromStationId: string;
  toStationId: string;
  optimalRoute: ComputedRoute;
  difficulty: 'easy' | 'medium' | 'hard';
  roundNumber?: number;
}

export interface AttemptRecord {
  lineIds: string[];
  valid: boolean;
  error?: RouteValidationResult['error'];
  route?: ComputedRoute;
}

export interface CompletedRound {
  puzzleId: string;
  fromStationId: string;
  toStationId: string;
  playerRoute: ComputedRoute | null;
  optimalRoute: ComputedRoute;
  attempts: number;
  grade: RoundGrade;
  deltaSec: number | null;
}

export interface DailyProgress {
  dateKey: string;
  networkMode: NetworkMode;
  rounds: CompletedRound[];
  completed: boolean;
}

export interface PlayerStats {
  dailyCompleted: number;
  currentStreak: number;
  bestStreak: number;
  lastDailyDate: string | null;
  totalRoundsPlayed: number;
  optimalRounds: number;
}
