import { Edition, Player, Team, TournamentDB, DrawState, Pot } from "@/types/tournament";

export const ORGANIZER_PIN = "1129";

export const TEAM_COLOR_PRESETS = [
  { name: "Azul Francia", hex: "#2563EB" },
  { name: "Dorado", hex: "#D49B35" },
  { name: "Rojo", hex: "#DC2626" },
  { name: "Verde Esmeralda", hex: "#16A34A" },
  { name: "Blanco", hex: "#F8FAFC" },
  { name: "Negro", hex: "#1E293B" },
  { name: "Celeste", hex: "#0EA5E9" },
  { name: "Violeta", hex: "#7C3AED" },
  { name: "Naranja", hex: "#EA580C" },
  { name: "Bordó", hex: "#9F1239" },
];

export const DEFAULT_TEAMS_META = [
  { name: "Equipo Azul", color: "#2563EB" },
  { name: "Equipo Dorado", color: "#D49B35" },
  { name: "Equipo Rojo", color: "#DC2626" },
  { name: "Equipo Verde", color: "#16A34A" },
  { name: "Equipo Blanco", color: "#F8FAFC" },
  { name: "Equipo Celeste", color: "#0EA5E9" },
  { name: "Equipo Violeta", color: "#7C3AED" },
  { name: "Equipo Naranja", color: "#EA580C" },
];

export const SEED_EDITIONS: Edition[] = [
  {
    id: "ed-2024",
    name: "Copa Hostería 2024",
    shortName: "2° Edición (2024)",
    year: 2024,
    date: "2024",
    isActive: false,
  },
  {
    id: "ed-2025",
    name: "Copa Hostería 2025",
    shortName: "3° Edición (2025)",
    year: 2025,
    date: "2025",
    isActive: false,
  },
  {
    id: "ed-2026",
    name: "Copa Hostería - 4° Edición (28.11.2026)",
    shortName: "4° Edición (2026)",
    year: 2026,
    date: "28.11.2026",
    isActive: true,
  },
];

function makePlayer(
  index: number,
  name: string,
  stars: number,
  goals2025: number,
  convocadoActual = true,
  goals2024 = 0
): Player {
  return {
    id: `p-${String(index).padStart(2, "0")}`,
    name,
    stars,
    goals2024,
    goals2025,
    assists2025: 0,
    yellowCards2025: 0,
    redCards2025: 0,
    convocadoActual,
  };
}

export const SEED_PLAYERS: Player[] = [
  // 42 convocados 2026
  makePlayer(1, "Lucio Aranda", 1, 3, true),
  makePlayer(2, "Juan Bianchi", 0, 0, true),
  makePlayer(3, "Joaquin Binetti", 0, 0, true),
  makePlayer(4, "Tomi Binetti", 0, 0, true),
  makePlayer(5, "Tute Bondanza", 0, 0, true),
  makePlayer(6, "José Campos", 0, 1, true),
  makePlayer(7, "Vicente Campos", 0, 3, true),
  makePlayer(8, "Iván Casco", 0, 0, true),
  makePlayer(9, "Nico Castiñeira", 1, 7, true),
  makePlayer(10, "Rami Castiñeira", 0, 1, true),
  makePlayer(11, "Pola Castro", 0, 0, true),
  makePlayer(12, "Fran Cava", 0, 0, true),
  makePlayer(13, "Fran Cordero", 0, 0, true),
  makePlayer(14, "Lucas Cordon", 0, 1, true),
  makePlayer(15, "Kiti Cuevas", 0, 3, true),
  makePlayer(16, "Santino Cuevas", 0, 0, true),
  makePlayer(17, "Marian Diaz Mauro", 1, 1, true),
  makePlayer(18, "Pancho Duhour", 1, 3, true),
  makePlayer(19, "Lucas Espeleta", 0, 0, true),
  makePlayer(20, "Laucha Freire", 1, 1, true),
  makePlayer(21, "Aquito Giudice", 0, 0, true),
  makePlayer(22, "Alan Maimo", 1, 8, true),
  makePlayer(23, "Chicho Margaride", 0, 0, true),
  makePlayer(24, "Fede Martin", 0, 5, true),
  makePlayer(25, "Juancho Mignone", 0, 2, true),
  makePlayer(26, "Franco Ortigosa", 1, 4, true),
  makePlayer(27, "Sebas Perez Bianchi", 0, 4, true),
  makePlayer(28, "Colo Perez Bianchi", 0, 0, true),
  makePlayer(29, "Manu Perez Delia", 0, 0, true),
  makePlayer(30, "Nico Polo", 0, 0, true),
  makePlayer(31, "Bubi Puricelli", 0, 4, true),
  makePlayer(32, "Atu Rodriguez", 0, 0, true),
  makePlayer(33, "Fede Sacchi", 0, 0, true),
  makePlayer(34, "Marcos Scorzato", 0, 0, true),
  makePlayer(35, "Santi Scorzato", 1, 3, true),
  makePlayer(36, "Facu Sequeira", 0, 1, true),
  makePlayer(37, "Fede Serdeiro", 0, 3, true),
  makePlayer(38, "Felipe Spallarosa", 0, 0, true),
  makePlayer(39, "Mati Tasso", 1, 0, true),
  makePlayer(40, "Roque Vera", 0, 0, true),
  makePlayer(41, "Nacho Verdejo", 2, 1, true),
  makePlayer(42, "Enzo Virgile", 1, 0, true),

  // Jugadores históricos 2024 / 2025 (convocado_actual: false)
  makePlayer(43, "Bruno Silva", 0, 6, false),
  makePlayer(44, "Fede Carneiro", 0, 4, false),
  makePlayer(45, "Berchu Milicich", 0, 3, false),
  makePlayer(46, "Gonzalo Agostino", 1, 1, false),
  makePlayer(47, "Fermín Urtasun", 0, 1, false),
  makePlayer(48, "Nicolás Etcheto", 0, 0, false, 7),
];

export function buildSuggestedPots(players: Player[], teamCount: number): Pot[] {
  const activePlayers = players.filter((p) => p.convocadoActual);
  const potCount = Math.max(1, Math.ceil(activePlayers.length / teamCount));

  // Rank by stars first, then 2025 goals, then alphabetical
  const ranked = [...activePlayers].sort((a, b) => {
    const scoreA = a.stars * 100 + a.goals2025 * 10;
    const scoreB = b.stars * 100 + b.goals2025 * 10;
    if (scoreB !== scoreA) return scoreB - scoreA;
    return a.name.localeCompare(b.name, "es");
  });

  const pots: Pot[] = Array.from({ length: potCount }, (_, idx) => ({
    id: `pot-${idx + 1}`,
    number: idx + 1,
    name: `Bombo ${idx + 1}`,
    playerIds: [],
  }));

  ranked.forEach((player, idx) => {
    const potIdx = Math.min(Math.floor(idx / teamCount), potCount - 1);
    pots[potIdx].playerIds.push(player.id);
  });

  return pots;
}

export function createInitialTeams(teamCount: number): Team[] {
  return Array.from({ length: teamCount }, (_, i) => {
    const preset = DEFAULT_TEAMS_META[i % DEFAULT_TEAMS_META.length];
    return {
      id: `team-${i + 1}`,
      editionId: "ed-2026",
      name: preset.name,
      color: preset.color,
      playerIds: [],
    };
  });
}

export function createInitialDrawState(players: Player[], teamCount = 6): DrawState {
  return {
    teamCount,
    pots: buildSuggestedPots(players, teamCount),
    drawnPlayerIds: [],
    currentPotIndex: 0,
    potTeamOrders: {},
    isComplete: false,
    lastDrawn: null,
  };
}

export function createSeedDatabase(): TournamentDB {
  const teamCount = 6;
  return {
    editions: SEED_EDITIONS,
    players: SEED_PLAYERS,
    teams: createInitialTeams(teamCount),
    draw: createInitialDrawState(SEED_PLAYERS, teamCount),
    matches: [],
    updatedAt: new Date().toISOString(),
  };
}
