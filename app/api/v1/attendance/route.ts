import { NextResponse } from "next/server";

import type { AttendanceAction } from "@/features/attendance/types";
import {
  AttendanceDomainError,
  getAttendancePageData,
  registerAttendance,
} from "@/server/attendance/attendance.service";
import { requireApiUser, UnauthorizedError } from "@/server/auth/dal";

export async function GET() {
  try {
    const user = await requireApiUser();
    return NextResponse.json( await getAttendancePageData(user.id));
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    return NextResponse.json({ error: "No se pudo consultar la asistencia." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireApiUser();
    const contentType = request.headers.get("content-type") ?? "";

    if (!contentType.includes("application/json")) {
      return NextResponse.json({ error: "El contenido debe enviarse como JSON." }, { status: 415 });
    }

    const body = (await request.json()) as {
      action?: unknown;
      photo?: string | null;
    };
    if (body.action !== "check-in" && body.action !== "check-out") {
      return NextResponse.json({ error: "La acción de asistencia no es válida." }, { status: 400 });
    }

    return NextResponse.json(
      await registerAttendance(
        user,
        body.action as AttendanceAction,
        body.photo
      )
    );
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    if (error instanceof AttendanceDomainError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    return NextResponse.json({ error: "No se pudo registrar la asistencia." }, { status: 500 });
  }
}
