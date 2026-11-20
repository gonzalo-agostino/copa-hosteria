import { connection, NextResponse } from "next/server";
import {
  getSupabaseAdmin,
  isSupabaseConfigured,
  SUPABASE_STATE_ROW_ID,
  SUPABASE_STATE_TABLE,
} from "@/lib/supabase";

export async function GET() {
  await connection();
  const hasUrl = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const hasServiceKey = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
  const configured = isSupabaseConfigured();

  if (!configured) {
    return NextResponse.json({
      storage: "local",
      hasUrl,
      hasServiceKey,
      supabaseOk: false,
      hint: "Falta NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en Environment Variables de Vercel.",
    });
  }

  const supabase = getSupabaseAdmin()!;
  const { data, error } = await supabase
    .from(SUPABASE_STATE_TABLE)
    .select("id, updated_at")
    .eq("id", SUPABASE_STATE_ROW_ID)
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      {
        storage: "supabase",
        hasUrl,
        hasServiceKey,
        supabaseOk: false,
        error: error.message,
      },
      { status: 500 }
    );
  }

  return NextResponse.json({
    storage: "supabase",
    hasUrl,
    hasServiceKey,
    supabaseOk: true,
    rowExists: Boolean(data),
    updatedAt: data?.updated_at ?? null,
  });
}
