import { NextResponse } from "next/server";

import { SESSION_COOKIE } from "@/server/auth/session";

export async function POST() {
  const response = NextResponse.json({ success: true });
  response.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    expires: new Date(0),
    sameSite: "lax",
    path: "/",
  });
  return response;
}
