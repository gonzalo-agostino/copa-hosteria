import fs from "fs";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import { readDB, writeDB } from "@/lib/db";

const UPLOADS_DIR = path.join(process.cwd(), "public", "uploads", "players");
const ALLOWED_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

function ensureUploadsDir() {
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }
}

function removeOldPhotoIfLocal(photoUrl?: string | null) {
  if (!photoUrl || !photoUrl.startsWith("/uploads/players/")) return;
  const filename = path.basename(photoUrl);
  const fullPath = path.join(UPLOADS_DIR, filename);
  if (fs.existsSync(fullPath)) {
    try {
      fs.unlinkSync(fullPath);
    } catch {
      // ignore cleanup failure
    }
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const db = readDB();
    const player = db.players.find((p) => p.id === id);
    if (!player) {
      return NextResponse.json(
        { error: "Jugador no encontrado" },
        { status: 404 }
      );
    }

    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "No se recibió ningún archivo de imagen" },
        { status: 400 }
      );
    }

    const ext = ALLOWED_MIME[file.type] ?? "jpg";
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json(
        { error: "La imagen supera el límite de 5 MB" },
        { status: 400 }
      );
    }

    ensureUploadsDir();
    removeOldPhotoIfLocal(player.photoUrl);

    const safeId = id.replace(/[^a-zA-Z0-9_-]/g, "");
    const filename = `${safeId}-${Date.now()}.${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());
    fs.writeFileSync(path.join(UPLOADS_DIR, filename), buffer);

    const photoUrl = `/uploads/players/${filename}`;
    const updatedDB = writeDB({
      ...db,
      players: db.players.map((p) =>
        p.id === id ? { ...p, photoUrl } : p
      ),
    });

    return NextResponse.json({ photoUrl, db: updatedDB });
  } catch (err) {
    console.error("Error uploading player photo:", err);
    return NextResponse.json(
      { error: "Error al guardar la foto del jugador" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const db = readDB();
    const player = db.players.find((p) => p.id === id);
    if (!player) {
      return NextResponse.json(
        { error: "Jugador no encontrado" },
        { status: 404 }
      );
    }

    removeOldPhotoIfLocal(player.photoUrl);
    const updatedDB = writeDB({
      ...db,
      players: db.players.map((p) =>
        p.id === id ? { ...p, photoUrl: null } : p
      ),
    });

    return NextResponse.json({ db: updatedDB });
  } catch (err) {
    console.error("Error deleting player photo:", err);
    return NextResponse.json(
      { error: "Error al eliminar la foto" },
      { status: 500 }
    );
  }
}
