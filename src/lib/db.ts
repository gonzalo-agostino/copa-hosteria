import fs from "fs";
import path from "path";
import { TournamentDB } from "@/types/tournament";
import { createSeedDatabase } from "@/lib/seed";

const DATA_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "copa-hosteria-db.json");

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

export function readDB(): TournamentDB {
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
      writeDB(seed);
      return seed;
    }
    return parsed;
  } catch {
    const seed = createSeedDatabase();
    writeDB(seed);
    return seed;
  }
}

export function writeDB(db: TournamentDB): TournamentDB {
  ensureDataDir();
  const updated: TournamentDB = {
    ...db,
    updatedAt: new Date().toISOString(),
  };
  fs.writeFileSync(DB_PATH, JSON.stringify(updated, null, 2), "utf-8");
  return updated;
}

export function resetDB(): TournamentDB {
  const seed = createSeedDatabase();
  return writeDB(seed);
}
