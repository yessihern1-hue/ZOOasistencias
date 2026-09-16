import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { getSupabaseConfig } from "./config";

export async function createSupabaseServerClient() {
  const cookieStore = await cookies();
  const { publishableKey, url } = getSupabaseConfig();

  return createServerClient(url, publishableKey, {
    cookieOptions: {
      httpOnly: true,
      path: "/",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    },
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, options, value }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Los Server Components no pueden escribir cookies. El proxy se
          // encarga de renovar la sesión antes de que se rendericen.
        }
      },
    },
  });
}
