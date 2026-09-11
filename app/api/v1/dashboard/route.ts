import { NextResponse } from "next/server";

import { requireApiUser, UnauthorizedError } from "@/server/auth/dal";
import { getDashboardData } from "@/server/dashboard/dashboard.service";

export async function GET() {
  try {
    await requireApiUser();

    return NextResponse.json(await getDashboardData());
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json(
        { error: error.message },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { error: "No se pudo cargar el resumen." },
      { status: 500 }
    );
  }
}