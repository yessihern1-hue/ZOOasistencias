import { NextResponse } from "next/server";

import {
  AttendanceDomainError,
  getAttendancePageData,
  registerAttendance,
} from "@/server/attendance/attendance.service";

import {
  requireApiUser,
  UnauthorizedError,
} from "@/server/auth/dal";

export async function GET() {
  try {
    const user = await requireApiUser();

    const data = await getAttendancePageData(user.id);

    return NextResponse.json(data);
  } catch (error) {
    console.error(
      "ERROR REAL AL CONSULTAR ASISTENCIA:",
      error
    );

    if (error instanceof UnauthorizedError) {
      return NextResponse.json(
        { error: error.message },
        { status: 401 }
      );
    }

    return NextResponse.json(
      {
        error: "No se pudo consultar la asistencia.",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireApiUser();

    const contentType =
      request.headers.get("content-type") ?? "";

    if (!contentType.includes("application/json")) {
      return NextResponse.json(
        {
          error: "El contenido debe enviarse como JSON.",
        },
        { status: 415 }
      );
    }

    const body = (await request.json()) as {
      action?: unknown;
      photo?: unknown;
    };

    if (
      body.action !== "check-in" &&
      body.action !== "check-out"
    ) {
      return NextResponse.json(
        {
          error: "La acción de asistencia no es válida.",
        },
        { status: 400 }
      );
    }

    if (
      body.photo !== undefined &&
      body.photo !== null &&
      typeof body.photo !== "string"
    ) {
      return NextResponse.json(
        {
          error: "La fotografía enviada no es válida.",
        },
        { status: 400 }
      );
    }

    const result = await registerAttendance(
      user,
      body.action,
      body.photo ?? null
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error(
      "ERROR REAL AL REGISTRAR ASISTENCIA:",
      error
    );

    if (error instanceof UnauthorizedError) {
      return NextResponse.json(
        { error: error.message },
        { status: 401 }
      );
    }

    if (error instanceof AttendanceDomainError) {
      return NextResponse.json(
        { error: error.message },
        { status: 409 }
      );
    }

    return NextResponse.json(
      {
        error: "No se pudo registrar la asistencia.",
      },
      { status: 500 }
    );
  }
}