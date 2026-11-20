import fs from "fs";
import path from "path";
import { TournamentDB } from "@/types/tournament";
import { createSeedDatabase, SEED_EDITIONS, SEED_PLAYERS } from "@/lib/seed";
import {
  getSupabaseAdmin,
  SUPABASE_STATE_ROW_ID,
  SUPABASE_STATE_TABLE,
} from "@/lib/supabase";

const DATA_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "copa-hosteria-db.json");

function normalizeDB(db: TournamentDB): TournamentDB {
  const hasAllOfficialEditions =
    Array.isArray(db.editions) &&
    db.editions.length === SEED_EDITIONS.length &&
    db.editions.every(
      (ed, idx) =>
        ed.date === SEED_EDITIONS[idx].date &&
        ed.champion === SEED_EDITIONS[idx].champion
    );

  const seedPlayerMap = new Map(SEED_PLAYERS.map((p) => [p.id, p]));
  const existingIds = new Set(db.players.map((p) => p.id));

  let playersChanged = false;
  const syncedPlayers = db.players.map((p) => {
    const seed = seedPlayerMap.get(p.id);
    if (!seed) return p;
    if (
      p.goalsEd1 === seed.goalsEd1 &&
      p.goalsEd2 === seed.goalsEd2 &&
      p.goals2024 === seed.goals2024
    ) {
      return p;
    }
    playersChanged = true;
    return {
      ...p,
      goalsEd1: seed.goalsEd1,
      goalsEd2: seed.goalsEd2,
      goals2024: seed.goals2024,
    };
  });

  for (const seed of SEED_PLAYERS) {
    if (!existingIds.has(seed.id)) {
      syncedPlayers.push(seed);
      playersChanged = true;
    }
  }

  if (hasAllOfficialEditions && !playersChanged) return db;
  return {
    ...db,
    editions: SEED_EDITIONS,
    players: syncedPlayers,
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
        return normalizeDB(parsed);
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
