export type MatchStatus = "pendiente" | "en_vivo" | "finalizado";

export type MatchEventType = "gol" | "amarilla" | "roja";

export interface Edition {
  id: string;
  name: string;
  shortName: string;
  year: number;
  date: string;
  isActive: boolean;
}

export interface Player {
  id: string;
  name: string;
  stars: number; // Champion stars (★)
  goals2024?: number;
  goals2025: number;
  assists2025: number;
  yellowCards2025: number;
  redCards2025: number;
  convocadoActual: boolean; // true = 42 convocados 2026, false = histórico
  photoUrl?: string | null;
}

export interface Team {
  id: string;
  editionId: string;
  name: string;
  color: string; // hex color for jersey/badge
  playerIds: string[];
}

export interface Pot {
  id: string;
  number: number; // 1..7
  name: string;
  playerIds: string[];
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

export interface Match {
  id: string;
  editionId: string;
  round: number;
  roundLabel: string;
  homeTeamId: string;
  awayTeamId: string;
  status: MatchStatus;
  events: MatchEvent[];
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
  lastDrawn?: {
    playerId: string;
    teamId: string;
    potNumber: number;
  } | null;
}

export interface TournamentDB {
  editions: Edition[];
  players: Player[];
  teams: Team[];
  draw: DrawState;
  matches: Match[];
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
