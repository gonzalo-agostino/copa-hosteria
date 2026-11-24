import fs from "fs";
import path from "path";
import { TournamentDB } from "@/types/tournament";
import {
  buildOfficialDrawPots,
  createSeedDatabase,
  DEFAULT_TEAMS_META,
  OFFICIAL_DRAW_PRESET_VERSION,
  OFFICIAL_DRAW_TEAM_COUNT,
  OFFICIAL_PLAYERS_PER_TEAM,
  SEED_EDITIONS,
  SEED_PLAYERS,
} from "@/lib/seed";
import { generateCopaHosteriaFixture } from "@/lib/stats";
import {
  getSupabaseAdmin,
  SUPABASE_STATE_ROW_ID,
  SUPABASE_STATE_TABLE,
} from "@/lib/supabase";

const DATA_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "copa-hosteria-db.json");

const LEGACY_TEAM_COLORS = [
  "#2563EB",
  "#D49B35",
  "#DC2626",
  "#16A34A",
  "#F8FAFC",
  "#0EA5E9",
  "#7C3AED",
];

const LEGACY_TEAM_NAMES = new Set([
  "Equipo Azul",
  "Equipo Dorado",
  "Equipo Rojo",
  "Equipo Verde",
  "Equipo Blanco",
  "Equipo Celeste",
  "Equipo Violeta",
  "Equipo Naranja",
]);

function normalizeDB(db: TournamentDB): TournamentDB {
  const hasAllOfficialEditions =
    Array.isArray(db.editions) &&
    db.editions.length === SEED_EDITIONS.length &&
    db.editions.every((ed, idx) => {
      const seedEd = SEED_EDITIONS[idx];
      const sameIds =
        JSON.stringify(ed.championPlayerIds ?? []) ===
        JSON.stringify(seedEd.championPlayerIds ?? []);
      return (
        ed.date === seedEd.date &&
        ed.champion === seedEd.champion &&
        sameIds
      );
    });

  const seedPlayerMap = new Map(SEED_PLAYERS.map((p) => [p.id, p]));
  const existingIds = new Set(db.players.map((p) => p.id));

  const needsOfficialDrawSync =
    db.draw?.presetVersion !== OFFICIAL_DRAW_PRESET_VERSION;

  const groupMatches = Array.isArray(db.matches)
    ? db.matches.filter((m) => m.stage !== "playoff")
    : [];
  const OFFICIAL_GROUP_LABELS = ["F1", "F2", "F3", "F4", "F5", "F6", "F7"];
  const hasOfficial7GroupMatches =
    groupMatches.length === 7 &&
    groupMatches.every(
      (m, idx) =>
        m.roundLabel === OFFICIAL_GROUP_LABELS[idx] && Boolean(m.scheduledTime)
    );
  const needsOfficialFixtureSync =
    needsOfficialDrawSync || !hasOfficial7GroupMatches;

  let playersChanged = false;
  const syncedPlayers = db.players.map((p) => {
    const seed = seedPlayerMap.get(p.id);
    if (!seed) return p;
    const needsGoalsSync =
      p.goalsEd1 !== seed.goalsEd1 ||
      p.goalsEd2 !== seed.goalsEd2 ||
      p.goals2024 !== seed.goals2024;
    const needsPositionSync = !p.position && Boolean(seed.position);
    const needsStarsSync = p.id === "p-51" && p.stars === 0 && seed.stars > 0;
    const needsSubSync =
      p.isSubstitute === undefined && Boolean(seed.isSubstitute);
    const needsConvocadoSync =
      needsOfficialDrawSync && p.convocadoActual !== seed.convocadoActual;

    if (
      !needsGoalsSync &&
      !needsPositionSync &&
      !needsStarsSync &&
      !needsSubSync &&
      !needsConvocadoSync
    ) {
      return p;
    }
    playersChanged = true;
    return {
      ...p,
      goalsEd1: seed.goalsEd1,
      goalsEd2: seed.goalsEd2,
      goals2024: seed.goals2024,
      ...(needsPositionSync ? { position: seed.position } : {}),
      ...(needsStarsSync ? { stars: seed.stars } : {}),
      ...(needsSubSync ? { isSubstitute: seed.isSubstitute } : {}),
      ...(needsConvocadoSync ? { convocadoActual: seed.convocadoActual } : {}),
    };
  });

  const deletedSet = new Set(db.deletedPlayerIds ?? []);

  for (const seed of SEED_PLAYERS) {
    if (!existingIds.has(seed.id) && !deletedSet.has(seed.id)) {
      syncedPlayers.push(seed);
      playersChanged = true;
    }
  }

  const hasLegacyColors =
    !needsOfficialDrawSync &&
    Array.isArray(db.teams) &&
    (db.teams.length !== OFFICIAL_DRAW_TEAM_COUNT ||
      db.teams.some(
        (t, idx) =>
          t.color.toUpperCase() === LEGACY_TEAM_COLORS[idx]?.toUpperCase()
      ));

  if (
    hasAllOfficialEditions &&
    !playersChanged &&
    !needsOfficialDrawSync &&
    !needsOfficialFixtureSync &&
    !hasLegacyColors
  ) {
    return db;
  }

  const nextTeams =
    needsOfficialDrawSync ||
    !Array.isArray(db.teams) ||
    db.teams.length !== OFFICIAL_DRAW_TEAM_COUNT
      ? Array.from({ length: OFFICIAL_DRAW_TEAM_COUNT }, (_, i) => {
          const existing = db.teams?.[i];
          const preset = DEFAULT_TEAMS_META[i % DEFAULT_TEAMS_META.length];
          const keepCustomName =
            existing?.name && !LEGACY_TEAM_NAMES.has(existing.name);
          const keepPlayers =
            !needsOfficialDrawSync &&
            Array.isArray(existing?.playerIds) &&
            db.teams?.length === OFFICIAL_DRAW_TEAM_COUNT;
          return {
            id: existing?.id ?? `team-${i + 1}`,
            editionId: "ed-2026",
            name: keepCustomName ? existing.name : preset.name,
            color: preset.color,
            playerIds: keepPlayers ? existing.playerIds : [],
            captainId: keepPlayers ? (existing?.captainId ?? null) : null,
            dtId: existing?.dtId ?? null,
            maxPlayers: OFFICIAL_PLAYERS_PER_TEAM,
          };
        })
      : hasLegacyColors
        ? db.teams.map((t, i) => {
            const preset = DEFAULT_TEAMS_META[i % DEFAULT_TEAMS_META.length];
            const keepCustomName = t.name && !LEGACY_TEAM_NAMES.has(t.name);
            return {
              ...t,
              name: keepCustomName ? t.name : preset.name,
              color: preset.color,
            };
          })
        : db.teams;

  const nextDraw = needsOfficialDrawSync
    ? {
        teamCount: OFFICIAL_DRAW_TEAM_COUNT,
        pots: buildOfficialDrawPots(),
        drawnPlayerIds: [],
        currentPotIndex: 0,
        potTeamOrders: {},
        isComplete: false,
        presetVersion: OFFICIAL_DRAW_PRESET_VERSION,
        lastDrawn: null,
      }
    : db.draw;

  const nextMatches = needsOfficialFixtureSync
    ? generateCopaHosteriaFixture(nextTeams)
    : db.matches;

  return {
    ...db,
    editions: SEED_EDITIONS,
    players: syncedPlayers,
    teams: nextTeams,
    draw: nextDraw,
    matches: nextMatches,
  };
}

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function readLocalDB(): TournamentDB {
  ensureDataDir();
  if (!fs.existsSync(DB_PATH)) {
    const seed = createSeedDatabase();
    fs.writeFileSync(DB_PATH, JSON.stringify(seed, null, 2), "utf-8");
    return seed;
  }

  try {
    const raw = fs.readFileSync(DB_PATH, "utf-8");
    const parsed = JSON.parse(raw) as TournamentDB;
    if (!parsed || !Array.isArray(parsed.players) || parsed.players.length === 0) {
      const seed = createSeedDatabase();
      writeLocalDB(seed);
      return seed;
    }
    return normalizeDB(parsed);
  } catch {
    const seed = createSeedDatabase();
    writeLocalDB(seed);
    return seed;
  }
}

function writeLocalDB(db: TournamentDB): TournamentDB {
  ensureDataDir();
  const updated: TournamentDB = {
    ...db,
    updatedAt: new Date().toISOString(),
  };
  fs.writeFileSync(DB_PATH, JSON.stringify(updated, null, 2), "utf-8");
  return updated;
}

export async function readDB(): Promise<TournamentDB> {
  const supabase = getSupabaseAdmin();
  if (supabase) {
    const { data, error } = await supabase
      .from(SUPABASE_STATE_TABLE)
      .select("data")
      .eq("id", SUPABASE_STATE_ROW_ID)
      .maybeSingle();

    if (!error && data?.data) {
      const parsed = data.data as TournamentDB;
      if (Array.isArray(parsed.players) && parsed.players.length > 0) {
        const normalized = normalizeDB(parsed);
        if (normalized !== parsed) {
          const updatedAt = new Date().toISOString();
          const withTimestamp = { ...normalized, updatedAt };
          await supabase.from(SUPABASE_STATE_TABLE).upsert({
            id: SUPABASE_STATE_ROW_ID,
            data: withTimestamp,
            updated_at: updatedAt,
          });
          return withTimestamp;
        }
        return normalized;
      }
    }

    // Auto-seed Supabase on first run
    const seed = createSeedDatabase();
    await supabase.from(SUPABASE_STATE_TABLE).upsert({
      id: SUPABASE_STATE_ROW_ID,
      data: seed,
      updated_at: seed.updatedAt,
    });
    return seed;
  }

  return readLocalDB();
}

export async function writeDB(db: TournamentDB): Promise<TournamentDB> {
  const updated: TournamentDB = {
    ...db,
    updatedAt: new Date().toISOString(),
  };

  const supabase = getSupabaseAdmin();
  if (supabase) {
    const { error } = await supabase.from(SUPABASE_STATE_TABLE).upsert({
      id: SUPABASE_STATE_ROW_ID,
      data: updated,
      updated_at: updated.updatedAt,
    });
    if (error) {
      throw new Error(`Supabase write error: ${error.message}`);
    }
    return updated;
  }

  return writeLocalDB(updated);
}

export async function resetDB(): Promise<TournamentDB> {
  const seed = createSeedDatabase();
  return writeDB(seed);
}
