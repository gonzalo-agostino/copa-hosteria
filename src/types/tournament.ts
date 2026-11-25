export type MatchStatus = "pendiente" | "en_vivo" | "finalizado";

export type MatchEventType = "gol" | "amarilla" | "roja";

export interface Edition {
  id: string;
  name: string;
  shortName: string;
  year: number;
  date: string;
  champion?: string;
  championPlayerIds?: string[];
  isActive: boolean;
}

export type PlayerPosition =
  | ""
  | "Arquero"
  | "Defensor"
  | "Mediocampista"
  | "Delantero";

export interface Player {
  id: string;
  name: string;
  position?: PlayerPosition;
  stars: number; // Champion stars (★)
  goalsEd1?: number; // 1° Edición (13/01/2024)
  goalsEd2?: number; // 2° Edición (30/11/2024)
  goals2024?: number; // Total 2024 (Ed.1 + Ed.2)
  goals2025: number; // 3° Edición (06/12/2025)
  assists2025: number;
  yellowCards2025: number;
  redCards2025: number;
  convocadoActual: boolean; // true = 42 convocados 2026, false = histórico
  isSubstitute?: boolean; // true = jugador suplente (juega algunos minutos)
  isDT?: boolean; // true = Director Técnico (DT)
  photoUrl?: string | null;
}

export interface Team {
  id: string;
  editionId: string;
  name: string;
  color: string; // hex color for jersey/badge
  imageUrl?: string | null;
  playerIds: string[];
  captainId?: string | null;
  dtId?: string | null;
  maxPlayers?: number;
  tiebreakOrder?: number;
}

export interface Pot {
  id: string;
  number: number; // 1..7
  name: string;
  playerIds: string[];
  reservePlayerIds?: string[];
}

export interface MatchEvent {
  id: string;
  matchId: string;
  teamId: string;
  playerId: string;
  assistPlayerId?: string | null;
  type: MatchEventType;
  minute?: number;
  isSecondYellow?: boolean;
  createdAt: string;
}

export type MatchStage = "liga" | "playoff";

export type PlayoffSlot = "sf1" | "sf2" | "third" | "final";

export interface Match {
  id: string;
  editionId: string;
  round: number;
  roundLabel: string;
  stage?: MatchStage;
  playoffSlot?: PlayoffSlot;
  scheduledTime?: string;
  homeTeamId: string;
  awayTeamId: string;
  homePlaceholder?: string;
  awayPlaceholder?: string;
  status: MatchStatus;
  events: MatchEvent[];
  penaltiesHome?: number | null;
  penaltiesAway?: number | null;
  createdAt: string;
}

export interface DrawState {
  teamCount: number;
  pots: Pot[];
  drawnPlayerIds: string[];
  currentPotIndex: number;
  // For each pot, a shuffled order of team indices [0..teamCount-1] so each team gets 1 player per pot
  potTeamOrders: Record<number, number[]>;
  isComplete: boolean;
  presetVersion?: string;
  lastDrawn?: {
    playerId: string;
    teamId: string;
    potNumber: number;
  } | null;
}

export interface FailedAttemptRecord {
  count: number;
  blocked: boolean;
  lastAttemptAt: string;
}

export interface SecurityState {
  failedAttemptsByIp: Record<string, FailedAttemptRecord>;
}

export interface TournamentDB {
  editions: Edition[];
  players: Player[];
  teams: Team[];
  draw: DrawState;
  matches: Match[];
  deletedPlayerIds?: string[];
  security?: SecurityState;
  updatedAt: string;
}

export interface StandingRow {
  teamId: string;
  teamName: string;
  teamColor: string;
  pj: number;
  g: number;
  e: number;
  p: number;
  gf: number;
  gc: number;
  dg: number;
  pts: number;
  tiebreakOrder?: number;
}

export interface PlayerStatsRow {
  player: Player;
  teamName?: string;
  teamColor?: string;
  goals: number;
  assists: number;
  yellowCards: number;
  redCards: number;
  doubleYellows: number;
  expulsions: number;
  isSuspendedNextMatch: boolean;
  suspendedReason?: string;
}
