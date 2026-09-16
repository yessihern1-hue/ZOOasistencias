import { NextResponse } from "next/server";

import {
  ForbiddenError,
  PasswordChangeRequiredError,
  requireApiAdmin,
  UnauthorizedError,
} from "@/server/auth/dal";
import { getDashboardData } from "@/server/dashboard/dashboard.service";

export async function GET() {
  try {
    await requireApiAdmin();

    return NextResponse.json(await getDashboardData());
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json(
        { error: error.message },
        { status: 401 }
      );
    }


    if (error instanceof ForbiddenError) {
      return NextResponse.json(
        { error: error.message },
        { status: 403 }
      );
    }

    if (error instanceof PasswordChangeRequiredError) {
      return NextResponse.json({ error: error.message }, { status: 428 });
    }

    return NextResponse.json(
      { error: "No se pudo cargar el resumen." },
      { status: 500 }
    );
  }
}
