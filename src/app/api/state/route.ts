import { NextRequest, NextResponse } from "next/server";
import { readDB, resetDB, writeDB } from "@/lib/db";
import { TournamentDB } from "@/types/tournament";

export async function GET() {
  try {
    const db = readDB();
    return NextResponse.json(db);
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
    const saved = writeDB(body);
    return NextResponse.json(saved);
  } catch (err) {
    console.error("Error saving tournament DB:", err);
    return NextResponse.json(
      { error: "No se pudo guardar la base de datos" },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  try {
    const fresh = resetDB();
    return NextResponse.json(fresh);
  } catch (err) {
    console.error("Error resetting tournament DB:", err);
    return NextResponse.json(
      { error: "No se pudo reiniciar la base de datos" },
      { status: 500 }
    );
  }
}
