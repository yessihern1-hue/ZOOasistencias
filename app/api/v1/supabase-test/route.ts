import { NextResponse } from "next/server";

import { supabase } from "@/server/supabase/client";

export async function GET() {
  const { data, error } = await supabase
    .from("work_shifts")
    .select("*");

  if (error) {
    return NextResponse.json(
      {
        connected: false,
        error: error.message,
      },
      { status: 500 }
    );
  }

  return NextResponse.json({
    connected: true,
    data,
  });
}