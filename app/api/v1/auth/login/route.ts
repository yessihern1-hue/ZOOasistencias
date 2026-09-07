import { NextResponse } from "next/server";

import { authenticate } from "@/server/auth/auth.service";
import {
  createSessionToken,
  SESSION_COOKIE,
  sessionCookieOptions,
} from "@/server/auth/session";

export async function POST(request: Request) {
  try {
    const contentType = request.headers.get("content-type") ?? "";
    if (!contentType.includes("application/json")) {
      return NextResponse.json(
        { error: "El contenido debe enviarse como JSON." },
        { status: 415 },
      );
    }

    const body = (await request.json()) as { email?: unknown; password?: unknown };
    if (typeof body.email !== "string" || typeof body.password !== "string") {
      return NextResponse.json(
        { error: "Ingresa un correo y una contraseña válidos." },
        { status: 400 },
      );
    }

    const user = authenticate(body.email, body.password);
    if (!user) {
      return NextResponse.json(
        { error: "El correo o la contraseña no coinciden." },
        { status: 401 },
      );
    }

    const response = NextResponse.json({ user });
    response.cookies.set(SESSION_COOKIE, createSessionToken(user), sessionCookieOptions);
    return response;
  } catch {
    return NextResponse.json(
      { error: "No pudimos iniciar sesión. Intenta nuevamente." },
      { status: 500 },
    );
  }
}
