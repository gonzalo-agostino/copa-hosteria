import { NextRequest, NextResponse } from "next/server";
import { readDB, resetDB, writeDB } from "@/lib/db";
import { TournamentDB } from "@/types/tournament";

export async function GET() {
  try {
    const db = await readDB();
    return NextResponse.json(db, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    console.error("Error reading tournament DB:", err);
    return NextResponse.json(
      { error: "No se pudo leer la base de datos" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = (await request.json()) as TournamentDB;
    if (!body || !Array.isArray(body.players) || !Array.isArray(body.teams)) {
      return NextResponse.json(
        { error: "Datos inválidos" },
        { status: 400 }
      );
    }
    const existing = await readDB();
    const saved = await writeDB({
      ...body,
      security: existing.security ?? body.security,
    });
    return NextResponse.json(saved, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    console.error("Error saving tournament DB:", err);
    const detail = err instanceof Error ? err.message : "Error desconocido";
    return NextResponse.json(
      { error: "No se pudo guardar la base de datos", detail },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  try {
    const fresh = await resetDB();
    return NextResponse.json(fresh);
  } catch (err) {
    console.error("Error resetting tournament DB:", err);
    return NextResponse.json(
      { error: "No se pudo reiniciar la base de datos" },
      { status: 500 }
    );
  }
}
