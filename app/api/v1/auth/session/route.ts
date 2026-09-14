import { NextResponse } from "next/server";

import { getCurrentUser } from "@/server/auth/dal";

export async function GET() {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json(
      { error: "Sesión no válida." },
      { headers: { "Cache-Control": "private, no-store" }, status: 401 },
    );
  }

  return NextResponse.json(
    { user },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
