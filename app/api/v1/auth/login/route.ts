import { NextResponse } from "next/server";

import {
  authenticate,
  AuthenticationRateLimitError,
  InvalidCredentialsError,
} from "@/server/auth/auth.service";

const noStoreHeaders = { "Cache-Control": "private, no-store" };

export async function POST(request: Request) {
  try {
    const contentType = request.headers.get("content-type") ?? "";
    if (!contentType.includes("application/json")) {
      return NextResponse.json(
        { error: "El contenido debe enviarse como JSON." },
        { headers: noStoreHeaders, status: 415 },
      );
    }

    let body: { email?: unknown; password?: unknown };

    try {
      body = (await request.json()) as { email?: unknown; password?: unknown };
    } catch {
      return NextResponse.json(
        { error: "El cuerpo de la solicitud no contiene JSON válido." },
        { headers: noStoreHeaders, status: 400 },
      );
    }

    if (typeof body.email !== "string" || typeof body.password !== "string") {
      return NextResponse.json(
        { error: "Ingresa un correo y una contraseña válidos." },
        { headers: noStoreHeaders, status: 400 },
      );
    }

    const email = body.email.trim();
    if (
      !email.includes("@") ||
      email.length > 254 ||
      body.password.length < 6 ||
      body.password.length > 128
    ) {
      return NextResponse.json(
        { error: "Ingresa un correo y una contraseña válidos." },
        { headers: noStoreHeaders, status: 400 },
      );
    }

    const user = await authenticate(email, body.password);
    return NextResponse.json({ user }, { headers: noStoreHeaders });
  } catch (error) {
    if (error instanceof InvalidCredentialsError) {
      return NextResponse.json(
        { error: error.message },
        { headers: noStoreHeaders, status: 401 },
      );
    }

    if (error instanceof AuthenticationRateLimitError) {
      return NextResponse.json(
        { error: error.message },
        { headers: noStoreHeaders, status: 429 },
      );
    }

    return NextResponse.json(
      { error: "No pudimos iniciar sesión. Intenta nuevamente." },
      { headers: noStoreHeaders, status: 500 },
    );
  }
}
