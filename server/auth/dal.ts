import "server-only";

import { redirect } from "next/navigation";
import { cache } from "react";

import { createSupabaseServerClient } from "@/server/supabase/client";

import { mapSupabaseUser } from "./auth.service";

export const getCurrentUser = cache(async () => {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) return null;

  return mapSupabaseUser(data.user);
});

export async function requireUser() {
  const user = await getCurrentUser();

  if (!user) redirect("/login");
  return user;
}

export async function requireApiUser() {
  const user = await getCurrentUser();

  if (!user) {
    throw new UnauthorizedError();
  }

  return user;
}

export class UnauthorizedError extends Error {
  constructor() {
    super("Tu sesión no es válida o ya expiró.");
    this.name = "UnauthorizedError";
  }
}
