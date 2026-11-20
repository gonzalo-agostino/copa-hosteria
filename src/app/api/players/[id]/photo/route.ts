import fs from "fs";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import { readDB, writeDB } from "@/lib/db";
import {
  getSupabaseAdmin,
  SUPABASE_PHOTOS_BUCKET,
} from "@/lib/supabase";

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

function removeOldLocalPhoto(photoUrl?: string | null) {
  if (!photoUrl || !photoUrl.startsWith("/uploads/players/")) return;
  const filename = path.basename(photoUrl);
  const fullPath = path.join(UPLOADS_DIR, filename);
  if (fs.existsSync(fullPath)) {
    try {
      fs.unlinkSync(fullPath);
    } catch {
      // ignore
    }
  }
}

function extractSupabaseStoragePath(photoUrl?: string | null): string | null {
  if (!photoUrl) return null;
  const marker = `/storage/v1/object/public/${SUPABASE_PHOTOS_BUCKET}/`;
  const idx = photoUrl.indexOf(marker);
  if (idx === -1) return null;
  return photoUrl.slice(idx + marker.length);
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const db = await readDB();
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

    const safeId = id.replace(/[^a-zA-Z0-9_-]/g, "");
    const filename = `${safeId}-${Date.now()}.${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    let photoUrl: string;
    const supabase = getSupabaseAdmin();

    if (supabase) {
      // Clean up previous Supabase photo if any
      const oldPath = extractSupabaseStoragePath(player.photoUrl);
      if (oldPath) {
        await supabase.storage.from(SUPABASE_PHOTOS_BUCKET).remove([oldPath]);
      }

      const { error: uploadErr } = await supabase.storage
        .from(SUPABASE_PHOTOS_BUCKET)
        .upload(filename, buffer, {
          contentType: file.type || "image/jpeg",
          upsert: true,
        });

      if (uploadErr) {
        throw new Error(`Supabase Storage error: ${uploadErr.message}`);
      }

      const { data: pubData } = supabase.storage
        .from(SUPABASE_PHOTOS_BUCKET)
        .getPublicUrl(filename);
      photoUrl = pubData.publicUrl;
    } else {
      ensureUploadsDir();
      removeOldLocalPhoto(player.photoUrl);
      fs.writeFileSync(path.join(UPLOADS_DIR, filename), buffer);
      photoUrl = `/uploads/players/${filename}`;
    }

    const updatedDB = await writeDB({
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
    const db = await readDB();
    const player = db.players.find((p) => p.id === id);
    if (!player) {
      return NextResponse.json(
        { error: "Jugador no encontrado" },
        { status: 404 }
      );
    }

    const supabase = getSupabaseAdmin();
    if (supabase) {
      const oldPath = extractSupabaseStoragePath(player.photoUrl);
      if (oldPath) {
        await supabase.storage.from(SUPABASE_PHOTOS_BUCKET).remove([oldPath]);
      }
    } else {
      removeOldLocalPhoto(player.photoUrl);
    }

    const updatedDB = await writeDB({
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
