import { NextResponse } from "next/server";

import type { AttendanceLocationInput } from "@/features/locations/types";
import {
  ForbiddenError,
  PasswordChangeRequiredError,
  requireApiAdmin,
  UnauthorizedError,
} from "@/server/auth/dal";
import {
  AttendanceLocationInputError,
  getAttendanceLocations,
  saveAttendanceLocation,
} from "@/server/locations/attendance-location.service";

function errorResponse(error: unknown) {
  if (error instanceof UnauthorizedError) return NextResponse.json({ error: error.message }, { status: 401 });
  if (error instanceof ForbiddenError) return NextResponse.json({ error: error.message }, { status: 403 });
  if (error instanceof PasswordChangeRequiredError) return NextResponse.json({ error: error.message }, { status: 428 });
  if (error instanceof AttendanceLocationInputError || error instanceof SyntaxError) {
    return NextResponse.json({ error: error instanceof AttendanceLocationInputError ? error.message : "El contenido enviado no es válido." }, { status: 400 });
  }
  console.error("Error de ubicaciones:", error);
  return NextResponse.json({ error: "No se pudo completar la operación con ubicaciones." }, { status: 500 });
}

export async function GET() {
  try {
    await requireApiAdmin();
    return NextResponse.json({ locations: await getAttendanceLocations() }, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const admin = await requireApiAdmin();
    await saveAttendanceLocation(null, (await request.json()) as AttendanceLocationInput, admin);
    return NextResponse.json({ locations: await getAttendanceLocations() }, {
      headers: { "Cache-Control": "private, no-store" },
      status: 201,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
