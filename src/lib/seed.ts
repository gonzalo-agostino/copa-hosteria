import { Edition, Player, PlayerPosition, Team, TournamentDB, DrawState, Pot } from "@/types/tournament";

export const ORGANIZER_PIN = "1129";

export const TEAM_COLOR_PRESETS = [
  { name: "Blanco", hex: "#FFFFFF" },
  { name: "Rojo", hex: "#EF4444" },
  { name: "Amarillo", hex: "#FACC15" },
  { name: "Verde", hex: "#22C55E" },
  { name: "Violeta", hex: "#A855F7" },
  { name: "Negro", hex: "#111827" },
  { name: "Naranja", hex: "#F97316" },
  { name: "Azul Francia", hex: "#2563EB" },
  { name: "Celeste", hex: "#0EA5E9" },
  { name: "Bordó", hex: "#9F1239" },
];

export const DEFAULT_TEAMS_META = [
  { name: "Equipo 1", color: "#FFFFFF" },
  { name: "Equipo 2", color: "#EF4444" },
  { name: "Equipo 3", color: "#FACC15" },
  { name: "Equipo 4", color: "#22C55E" },
  { name: "Equipo 5", color: "#A855F7" },
  { name: "Equipo 6", color: "#111827" },
  { name: "Equipo 7", color: "#F97316" },
  { name: "Equipo 8", color: "#0EA5E9" },
];

export const SEED_EDITIONS: Edition[] = [
  {
    id: "ed-2024-1",
    name: "Copa Hostería · 1° Edición",
    shortName: "1° Edición",
    year: 2024,
    date: "13/01/2024",
    champion: "GOLF IS NOT FOR SALE",
    championPlayerIds: ["p-42", "p-20", "p-51", "p-17", "p-18"],
    isActive: false,
  },
  {
    id: "ed-2024-2",
    name: "Copa Hostería · 2° Edición",
    shortName: "2° Edición",
    year: 2024,
    date: "30/11/2024",
    champion: "ORTO Y TETAS",
    championPlayerIds: ["p-53", "p-46", "p-01", "p-26", "p-41"],
    isActive: false,
  },
  {
    id: "ed-2025",
    name: "Copa Hostería · 3° Edición",
    shortName: "3° Edición",
    year: 2025,
    date: "06/12/2025",
    champion: "LUCCA FC",
    championPlayerIds: ["p-54", "p-35", "p-22", "p-09", "p-41", "p-39", "p-55"],
    isActive: false,
  },
  {
    id: "ed-2026",
    name: "Copa Hostería · 4° Edición",
    shortName: "4° Edición",
    year: 2026,
    date: "28/11/2026",
    isActive: true,
  },
];

function makePlayer(
  index: number,
  name: string,
  stars: number,
  goals2025: number,
  convocadoActual = true,
  goalsEd1 = 0,
  goalsEd2 = 0,
  position: PlayerPosition = ""
): Player {
  return {
    id: `p-${String(index).padStart(2, "0")}`,
    name,
    ...(position ? { position } : {}),
    stars,
    goalsEd1,
    goalsEd2,
    goals2024: goalsEd1 + goalsEd2,
    goals2025,
    assists2025: 0,
    yellowCards2025: 0,
    redCards2025: 0,
    convocadoActual,
  };
}

export const SEED_PLAYERS: Player[] = [
  // 42 convocados 2026 (params: index, name, stars, goals2025 [Ed.3], convocadoActual, goalsEd1, goalsEd2)
  makePlayer(1, "Lucio Aranda", 1, 3, true, 0, 2),
  makePlayer(2, "Juan Bianchi", 0, 0, true),
  makePlayer(3, "Joaquin Binetti", 0, 0, true, 0, 1),
  makePlayer(4, "Tomi Binetti", 0, 0, true),
  makePlayer(5, "Tute Bondanza", 0, 0, true, 0, 0, "Arquero"),
  makePlayer(6, "José Campos", 0, 1, true, 3, 1),
  makePlayer(7, "Vicente Campos", 0, 3, true, 0, 6),
  makePlayer(8, "Iván Casco", 0, 0, true, 0, 0, "Arquero"),
  makePlayer(9, "Nico Castiñeira", 1, 7, true),
  makePlayer(10, "Rami Castiñeira", 0, 1, true),
  makePlayer(11, "Pola Castro", 0, 0, true),
  makePlayer(12, "Fran Cava", 0, 0, true),
  makePlayer(13, "Fran Cordero", 0, 0, true),
  makePlayer(14, "Lucas Cordon", 0, 1, true),
  makePlayer(15, "Kiti Cuevas", 0, 3, true),
  makePlayer(16, "Santino Cuevas", 0, 0, true),
  makePlayer(17, "Marian Diaz Mauro", 1, 1, true, 5, 4),
  makePlayer(18, "Pancho Duhour", 1, 3, true, 4, 0),
  makePlayer(19, "Lucas Espeleta", 0, 0, true, 0, 0, "Arquero"),
  makePlayer(20, "Laucha Freire", 1, 1, true),
  makePlayer(21, "Aquito Giudice", 0, 0, true, 0, 4),
  makePlayer(22, "Alan Maimo", 1, 8, true),
  // Suplente / alternativa del Bombo B (no cuenta dentro de los 42 titulares del sorteo)
  makePlayer(23, "Chicho Margaride", 0, 0, false),
  makePlayer(24, "Fede Martin", 0, 5, true),
  makePlayer(25, "Juancho Mignone", 0, 2, true, 0, 1),
  makePlayer(26, "Franco Ortigosa", 1, 4, true, 0, 3),
  makePlayer(27, "Sebas Perez Bianchi", 0, 4, true, 0, 4),
  makePlayer(28, "Colo Perez Bianchi", 0, 0, true),
  makePlayer(29, "Manu Perez Delia", 0, 0, true, 0, 0, "Arquero"),
  makePlayer(30, "Nico Polo", 0, 0, true),
  makePlayer(31, "Bubi Puricelli", 0, 4, true),
  makePlayer(32, "Atu Rodriguez", 0, 0, true, 0, 0, "Arquero"),
  makePlayer(33, "Fede Sacchi", 0, 0, true),
  makePlayer(34, "Marcos Scorzato", 0, 0, true, 0, 1, "Arquero"),
  makePlayer(35, "Santi Scorzato", 1, 3, true),
  makePlayer(36, "Facu Sequeira", 0, 1, true, 2, 2),
  makePlayer(37, "Fede Serdeiro", 0, 3, true),
  makePlayer(38, "Felipe Spallarosa", 0, 0, true),
  makePlayer(39, "Mati Tasso", 1, 0, true, 1, 0),
  makePlayer(40, "Roque Vera", 0, 0, true, 0, 0, "Arquero"),
  makePlayer(41, "Nacho Verdejo", 2, 1, true, 1, 5),
  makePlayer(42, "Enzo Virgile", 1, 0, true),

  // Jugadores históricos 2024 / 2025 (convocado_actual: false)
  makePlayer(43, "Bruno Silva", 0, 6, false),
  makePlayer(44, "Fede Carneiro", 0, 4, false, 0, 1),
  makePlayer(45, "Berchu Milicich", 0, 3, false, 0, 6),
  makePlayer(46, "Gonzalo Agostino", 1, 1, false, 2, 1),
  makePlayer(47, "Fermín Urtasun", 0, 1, false),
  makePlayer(48, "Nicolás Etcheto", 0, 0, false, 7, 0),
  makePlayer(49, "Ignacio Mardones", 0, 0, false, 5, 0),
  makePlayer(50, "Federico Demeco", 0, 0, false, 2, 2),
  makePlayer(51, "Ignacio Molina", 1, 0, false, 2, 0),
  makePlayer(52, "Nacho Rodriguez", 0, 0, false, 0, 1),
  makePlayer(53, "Gonzalo Pighin", 1, 0, false, 0, 0, "Arquero"),
  makePlayer(54, "Gregorio Aner", 1, 0, false, 0, 0, "Arquero"),
  makePlayer(55, "Juan Urtasun", 1, 0, false),
  // Nuevo convocado 2026 (Bombo E)
  makePlayer(56, "De Cicco", 0, 0, true),
];

export const OFFICIAL_DRAW_PRESET_VERSION = "2026-official-7x6-v1";
export const OFFICIAL_DRAW_TEAM_COUNT = 7;
export const OFFICIAL_PLAYERS_PER_TEAM = 6;

export function buildOfficialDrawPots(): Pot[] {
  return [
    {
      id: "pot-1",
      number: 1,
      name: "Bombo 1 · Arqueros",
      playerIds: ["p-08", "p-19", "p-40", "p-32", "p-05", "p-34", "p-29"],
    },
    {
      id: "pot-2",
      number: 2,
      name: "Bombo B",
      playerIds: ["p-03", "p-30", "p-39", "p-24", "p-42", "p-04", "p-20"],
      reservePlayerIds: ["p-23"], // Chicho Margaride (suplente / alternativa si falta alguno)
    },
    {
      id: "pot-3",
      number: 3,
      name: "Bombo C",
      playerIds: ["p-06", "p-14", "p-36", "p-37", "p-25", "p-41", "p-21"],
    },
    {
      id: "pot-4",
      number: 4,
      name: "Bombo D",
      playerIds: ["p-16", "p-38", "p-12", "p-10", "p-18", "p-02", "p-33"],
    },
    {
      id: "pot-5",
      number: 5,
      name: "Bombo E",
      playerIds: ["p-07", "p-01", "p-27", "p-56", "p-15", "p-11", "p-13"],
    },
    {
      id: "pot-6",
      number: 6,
      name: "Bombo F",
      playerIds: ["p-22", "p-26", "p-17", "p-28", "p-35", "p-09", "p-31"],
    },
  ];
}

export function buildSuggestedPots(players: Player[], teamCount: number): Pot[] {
  const activePlayers = players.filter((p) => p.convocadoActual);
  // Remainder players join the last pot instead of creating a tiny extra pot
  const potCount = Math.max(1, Math.floor(activePlayers.length / teamCount));

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

export function createInitialTeams(
  teamCount = OFFICIAL_DRAW_TEAM_COUNT,
  maxPlayers?: number
): Team[] {
  return Array.from({ length: teamCount }, (_, i) => {
    const preset = DEFAULT_TEAMS_META[i % DEFAULT_TEAMS_META.length];
    return {
      id: `team-${i + 1}`,
      editionId: "ed-2026",
      name: preset.name,
      color: preset.color,
      playerIds: [],
      ...(typeof maxPlayers === "number" ? { maxPlayers } : {}),
    };
  });
}

export function createInitialDrawState(
  players: Player[],
  teamCount = OFFICIAL_DRAW_TEAM_COUNT
): DrawState {
  const useOfficial = teamCount === OFFICIAL_DRAW_TEAM_COUNT;
  return {
    teamCount,
    pots: useOfficial
      ? buildOfficialDrawPots()
      : buildSuggestedPots(players, teamCount),
    drawnPlayerIds: [],
    currentPotIndex: 0,
    potTeamOrders: {},
    isComplete: false,
    presetVersion: OFFICIAL_DRAW_PRESET_VERSION,
    lastDrawn: null,
  };
}

export function createSeedDatabase(): TournamentDB {
  const teamCount = OFFICIAL_DRAW_TEAM_COUNT;
  return {
    editions: SEED_EDITIONS,
    players: SEED_PLAYERS,
    teams: createInitialTeams(teamCount, OFFICIAL_PLAYERS_PER_TEAM),
    draw: createInitialDrawState(SEED_PLAYERS, teamCount),
    matches: [],
    updatedAt: new Date().toISOString(),
  };
}
