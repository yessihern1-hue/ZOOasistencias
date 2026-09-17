import { NextResponse } from "next/server";

import {
  AttendanceDomainError,
  getAttendancePageData,
  registerAttendance,
} from "@/server/attendance/attendance.service";

import {
  PasswordChangeRequiredError,
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

    if (error instanceof PasswordChangeRequiredError) {
      return NextResponse.json({ error: error.message }, { status: 428 });
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
      observation?: unknown;
      location?: unknown;
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

    const location = body.location as {
      latitude?: unknown;
      longitude?: unknown;
      accuracy?: unknown;
    } | null;
    if (
      !location ||
      typeof location.latitude !== "number" ||
      typeof location.longitude !== "number" ||
      typeof location.accuracy !== "number" ||
      !Number.isFinite(location.latitude) ||
      !Number.isFinite(location.longitude) ||
      !Number.isFinite(location.accuracy)
    ) {
      return NextResponse.json(
        { error: "Debes compartir una ubicación válida para registrar asistencia." },
        { status: 400 }
      );
    }

    if (
      body.observation !== undefined &&
      body.observation !== null &&
      (typeof body.observation !== "string" || body.observation.length > 500)
    ) {
      return NextResponse.json(
        { error: "La observación debe tener un máximo de 500 caracteres." },
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
      {
        latitude: location.latitude,
        longitude: location.longitude,
        accuracy: location.accuracy,
      },
      body.photo ?? null,
      typeof body.observation === "string"
        ? body.observation.trim() || null
        : null
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

    if (error instanceof PasswordChangeRequiredError) {
      return NextResponse.json({ error: error.message }, { status: 428 });
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
