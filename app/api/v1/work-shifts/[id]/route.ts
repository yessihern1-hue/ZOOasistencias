import { NextResponse } from "next/server";

import type { WorkShiftInput } from "@/features/shifts/types";
import {
  ForbiddenError,
  PasswordChangeRequiredError,
  requireApiAdmin,
  UnauthorizedError,
} from "@/server/auth/dal";
import {
  getWorkShifts,
  saveWorkShift,
  setWorkShiftActive,
  WorkShiftInputError,
} from "@/server/shifts/work-shift.service";

function errorResponse(error: unknown) {
  if (error instanceof UnauthorizedError) return NextResponse.json({ error: error.message }, { status: 401 });
  if (error instanceof ForbiddenError) return NextResponse.json({ error: error.message }, { status: 403 });
  if (error instanceof PasswordChangeRequiredError) return NextResponse.json({ error: error.message }, { status: 428 });
  if (error instanceof WorkShiftInputError || error instanceof SyntaxError) {
    return NextResponse.json(
      { error: error instanceof WorkShiftInputError ? error.message : "El contenido enviado no es válido." },
      { status: 400 }
    );
  }
  return NextResponse.json({ error: "No se pudo actualizar la jornada." }, { status: 500 });
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireApiAdmin();
    const { id } = await params;
    const input = (await request.json()) as WorkShiftInput;
    const shiftId = await saveWorkShift(id, input, admin);
    return NextResponse.json({ shiftId, shifts: await getWorkShifts() }, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireApiAdmin();
    const { id } = await params;
    const body = (await request.json()) as { active?: unknown };
    if (typeof body.active !== "boolean") throw new WorkShiftInputError("El estado no es válido.");
    await setWorkShiftActive(id, body.active, admin);
    return NextResponse.json({ shifts: await getWorkShifts() }, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
