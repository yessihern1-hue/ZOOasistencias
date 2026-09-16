import "server-only";

import { redirect } from "next/navigation";
import { cache } from "react";

import { getUserHomePath } from "@/features/auth/navigation";
import { createSupabaseServerClient } from "@/server/supabase/client";

import { loadSessionUser, toSessionUser } from "./auth.service";

export const getCurrentUser = cache(async () => {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) return null;

  const user = await loadSessionUser(supabase, data.user);
  if (!user || user.employmentStatus === "inactive") return null;

  return toSessionUser(user);
});

export async function requireUser() {
  const user = await getCurrentUser();

  if (!user) redirect("/login");
  if (user.mustChangePassword) redirect("/cambiar-password");
  return user;
}

export async function requireAdmin() {
  const user = await requireUser();

  if (user.role !== "admin") redirect(getUserHomePath(user.role));
  return user;
}

export async function requireEmployee() {
  const user = await requireUser();

  if (user.role !== "employee") redirect(getUserHomePath(user.role));
  return user;
}

export async function requireApiUser() {
  const user = await getCurrentUser();

  if (!user) throw new UnauthorizedError();
  if (user.mustChangePassword) throw new PasswordChangeRequiredError();
  return user;
}

export async function requireApiAdmin() {
  const user = await requireApiUser();

  if (user.role !== "admin") throw new ForbiddenError();
  return user;
}

export async function requireApiEmployee() {
  const user = await requireApiUser();

  if (user.role !== "employee") throw new ForbiddenError();
  return user;
}

export class UnauthorizedError extends Error {
  constructor() {
    super("Tu sesión no es válida, expiró o el usuario está inactivo.");
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends Error {
  constructor() {
    super("No tienes permisos para realizar esta acción.");
    this.name = "ForbiddenError";
  }
}

export class PasswordChangeRequiredError extends Error {
  constructor() {
    super("Debes cambiar tu contraseña temporal antes de continuar.");
    this.name = "PasswordChangeRequiredError";
  }
}
