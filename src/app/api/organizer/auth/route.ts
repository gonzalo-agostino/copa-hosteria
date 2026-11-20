import { NextRequest, NextResponse } from "next/server";
import { readDB, writeDB } from "@/lib/db";
import { ORGANIZER_PIN } from "@/lib/seed";

const MAX_ATTEMPTS = 3;

function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;
  return "local-client";
}

export async function GET(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    const db = await readDB();
    const record = db.security?.failedAttemptsByIp?.[ip];
    const count = record?.count ?? 0;
    const blocked = Boolean(record?.blocked || count >= MAX_ATTEMPTS);
    const blockedCount = Object.values(
      db.security?.failedAttemptsByIp ?? {}
    ).filter((r) => r.blocked || r.count >= MAX_ATTEMPTS).length;

    return NextResponse.json({
      blocked,
      remainingAttempts: Math.max(0, MAX_ATTEMPTS - count),
      blockedCount,
    });
  } catch (err) {
    console.error("Error checking organizer auth status:", err);
    return NextResponse.json(
      { blocked: false, remainingAttempts: MAX_ATTEMPTS, blockedCount: 0 },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    const body = (await request.json().catch(() => ({}))) as { pin?: string };
    const pin = String(body.pin ?? "").trim();

    const db = await readDB();
    const attemptsMap = { ...(db.security?.failedAttemptsByIp ?? {}) };
    const current = attemptsMap[ip] ?? {
      count: 0,
      blocked: false,
      lastAttemptAt: new Date().toISOString(),
    };

    if (current.blocked || current.count >= MAX_ATTEMPTS) {
      return NextResponse.json(
        {
          ok: false,
          blocked: true,
          remainingAttempts: 0,
        },
        { status: 403 }
      );
    }

    if (pin === ORGANIZER_PIN) {
      // Reset failed counter on success
      if (attemptsMap[ip]) {
        delete attemptsMap[ip];
        await writeDB({
          ...db,
          security: { failedAttemptsByIp: attemptsMap },
        });
      }
      return NextResponse.json({
        ok: true,
        blocked: false,
        remainingAttempts: MAX_ATTEMPTS,
      });
    }

    // Wrong PIN -> increment and persist in Supabase / DB
    const nextCount = current.count + 1;
    const isNowBlocked = nextCount >= MAX_ATTEMPTS;
    attemptsMap[ip] = {
      count: nextCount,
      blocked: isNowBlocked,
      lastAttemptAt: new Date().toISOString(),
    };

    await writeDB({
      ...db,
      security: { failedAttemptsByIp: attemptsMap },
    });

    return NextResponse.json(
      {
        ok: false,
        blocked: isNowBlocked,
        remainingAttempts: Math.max(0, MAX_ATTEMPTS - nextCount),
      },
      { status: isNowBlocked ? 403 : 401 }
    );
  } catch (err) {
    console.error("Error verifying organizer PIN:", err);
    return NextResponse.json(
      { ok: false, error: "Error verificando el acceso" },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  try {
    const db = await readDB();
    await writeDB({
      ...db,
      security: { failedAttemptsByIp: {} },
    });
    return NextResponse.json({ ok: true, blockedCount: 0 });
  } catch (err) {
    console.error("Error clearing blocked IPs:", err);
    return NextResponse.json(
      { ok: false, error: "No se pudieron limpiar los bloqueos" },
      { status: 500 }
    );
  }
}
