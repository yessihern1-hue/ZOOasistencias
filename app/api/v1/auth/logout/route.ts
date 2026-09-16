import { NextResponse } from "next/server";

import { createSupabaseServerClient } from "@/server/supabase/client";

export async function POST() {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signOut({ scope: "local" });

  if (error) {
    return NextResponse.json(
      { error: "No se pudo cerrar la sesión." },
      { headers: { "Cache-Control": "private, no-store" }, status: 500 },
    );
  }

  return NextResponse.json(
    { success: true },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
