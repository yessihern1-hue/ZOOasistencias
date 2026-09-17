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
  setAttendanceLocationActive,
} from "@/server/locations/attendance-location.service";

function errorResponse(error: unknown) {
  if (error instanceof UnauthorizedError) return NextResponse.json({ error: error.message }, { status: 401 });
  if (error instanceof ForbiddenError) return NextResponse.json({ error: error.message }, { status: 403 });
  if (error instanceof PasswordChangeRequiredError) return NextResponse.json({ error: error.message }, { status: 428 });
  if (error instanceof AttendanceLocationInputError || error instanceof SyntaxError) {
    return NextResponse.json({ error: error instanceof AttendanceLocationInputError ? error.message : "El contenido enviado no es válido." }, { status: 400 });
  }
  console.error("Error de ubicaciones:", error);
  return NextResponse.json({ error: "No se pudo actualizar la ubicación." }, { status: 500 });
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireApiAdmin();
    const { id } = await params;
    await saveAttendanceLocation(id, (await request.json()) as AttendanceLocationInput, admin);
    return NextResponse.json({ locations: await getAttendanceLocations() }, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireApiAdmin();
    const { id } = await params;
    const body = (await request.json()) as { active?: unknown };
    if (typeof body.active !== "boolean") {
      throw new AttendanceLocationInputError("El estado no es válido.");
    }
    await setAttendanceLocationActive(id, body.active, admin);
    return NextResponse.json({ locations: await getAttendanceLocations() }, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
