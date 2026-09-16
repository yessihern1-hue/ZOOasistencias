import { NextResponse } from "next/server";

import { requireApiUser, UnauthorizedError } from "@/server/auth/dal";
import { createSupabaseServerClient } from "@/server/supabase/client";

export async function GET() {
  try {
    await requireApiUser();
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("work_shifts")
      .select("*");

    if (error) {
      return NextResponse.json(
        { connected: false, error: error.message },
        { status: 500 },
      );
    }

    return NextResponse.json({ connected: true, data });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }

    return NextResponse.json(
      { connected: false, error: "No se pudo comprobar Supabase." },
      { status: 500 },
    );
  }
}
