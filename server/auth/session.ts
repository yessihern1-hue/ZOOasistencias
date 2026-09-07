import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

import type { SessionUser } from "@/features/auth/types";

export const SESSION_COOKIE = "zoo_session";
export const SESSION_DURATION_SECONDS = 60 * 60 * 8;

type SessionPayload = SessionUser & {
  expiresAt: number;
};

function getSecret() {
  const secret = process.env.SESSION_SECRET;

  if (secret) return secret;
  if (process.env.NODE_ENV === "production") {
    throw new Error("SESSION_SECRET es obligatorio en producción.");
  }

  return "zoo-asistencias-dev-secret-change-me";
}

function sign(value: string) {
  return createHmac("sha256", getSecret()).update(value).digest("base64url");
}

export function createSessionToken(user: SessionUser) {
  const payload: SessionPayload = {
    ...user,
    expiresAt: Date.now() + SESSION_DURATION_SECONDS * 1000,
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");

  return `${encodedPayload}.${sign(encodedPayload)}`;
}

export function verifySessionToken(token?: string): SessionUser | null {
  if (!token) return null;

  try {
    const [encodedPayload, suppliedSignature] = token.split(".");
    if (!encodedPayload || !suppliedSignature) return null;

    const expected = Buffer.from(sign(encodedPayload));
    const supplied = Buffer.from(suppliedSignature);
    if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) {
      return null;
    }

    const payload = JSON.parse(
      Buffer.from(encodedPayload, "base64url").toString("utf8"),
    ) as SessionPayload;

    if (!payload.id || !payload.email || payload.expiresAt <= Date.now()) return null;

    return {
      id: payload.id,
      name: payload.name,
      email: payload.email,
      role: payload.role,
      roleLabel: payload.roleLabel,
      initials: payload.initials,
    };
  } catch {
    return null;
  }
}

export const sessionCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: SESSION_DURATION_SECONDS,
};
