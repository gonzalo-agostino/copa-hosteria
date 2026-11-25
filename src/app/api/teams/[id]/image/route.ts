import fs from "fs";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import { readDB, writeDB } from "@/lib/db";
import {
  getSupabaseAdmin,
  SUPABASE_PHOTOS_BUCKET,
} from "@/lib/supabase";

const UPLOADS_DIR = path.join(process.cwd(), "public", "uploads", "teams");
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

function removeOldLocalImage(imageUrl?: string | null) {
  if (!imageUrl || !imageUrl.startsWith("/uploads/teams/")) return;
  const filename = path.basename(imageUrl);
  const fullPath = path.join(UPLOADS_DIR, filename);
  if (fs.existsSync(fullPath)) {
    try {
      fs.unlinkSync(fullPath);
    } catch {
      // ignore
    }
  }
}

function extractSupabaseStoragePath(imageUrl?: string | null): string | null {
  if (!imageUrl) return null;
  const marker = `/storage/v1/object/public/${SUPABASE_PHOTOS_BUCKET}/`;
  const idx = imageUrl.indexOf(marker);
  if (idx === -1) return null;
  return imageUrl.slice(idx + marker.length);
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const db = await readDB();
    const team = db.teams.find((t) => t.id === id);
    if (!team) {
      return NextResponse.json(
        { error: "Equipo no encontrado" },
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

    const ext = ALLOWED_MIME[file.type] ?? "png";
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json(
        { error: "La imagen supera el límite de 5 MB" },
        { status: 400 }
      );
    }

    const safeId = id.replace(/[^a-zA-Z0-9_-]/g, "");
    const filename = `${safeId}-${Date.now()}.${ext}`;
    const storagePath = `teams/${filename}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    let imageUrl: string;
    const supabase = getSupabaseAdmin();

    if (supabase) {
      const oldPath = extractSupabaseStoragePath(team.imageUrl);
      if (oldPath) {
        await supabase.storage.from(SUPABASE_PHOTOS_BUCKET).remove([oldPath]);
      }

      const { error: uploadErr } = await supabase.storage
        .from(SUPABASE_PHOTOS_BUCKET)
        .upload(storagePath, buffer, {
          contentType: file.type || "image/png",
          upsert: true,
        });

      if (uploadErr) {
        throw new Error(`Supabase Storage error: ${uploadErr.message}`);
      }

      const { data: pubData } = supabase.storage
        .from(SUPABASE_PHOTOS_BUCKET)
        .getPublicUrl(storagePath);
      imageUrl = pubData.publicUrl;
    } else {
      ensureUploadsDir();
      removeOldLocalImage(team.imageUrl);
      fs.writeFileSync(path.join(UPLOADS_DIR, filename), buffer);
      imageUrl = `/uploads/teams/${filename}`;
    }

    const updatedDB = await writeDB({
      ...db,
      teams: db.teams.map((t) => (t.id === id ? { ...t, imageUrl } : t)),
    });

    return NextResponse.json({ imageUrl, db: updatedDB });
  } catch (err) {
    console.error("Error uploading team image:", err);
    return NextResponse.json(
      { error: "Error al guardar la imagen del equipo" },
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
    const team = db.teams.find((t) => t.id === id);
    if (!team) {
      return NextResponse.json(
        { error: "Equipo no encontrado" },
        { status: 404 }
      );
    }

    const supabase = getSupabaseAdmin();
    if (supabase) {
      const oldPath = extractSupabaseStoragePath(team.imageUrl);
      if (oldPath) {
        await supabase.storage.from(SUPABASE_PHOTOS_BUCKET).remove([oldPath]);
      }
    } else {
      removeOldLocalImage(team.imageUrl);
    }

    const updatedDB = await writeDB({
      ...db,
      teams: db.teams.map((t) =>
        t.id === id ? { ...t, imageUrl: null } : t
      ),
    });

    return NextResponse.json({ db: updatedDB });
  } catch (err) {
    console.error("Error deleting team image:", err);
    return NextResponse.json(
      { error: "Error al eliminar la imagen del equipo" },
      { status: 500 }
    );
  }
}
