import "server-only";

import type { User } from "@supabase/supabase-js";

import type { SessionUser, UserRole } from "@/features/auth/types";
import { createSupabaseServerClient } from "@/server/supabase/client";

const roleLabels: Record<UserRole, string> = {
  admin: "Administración",
  supervisor: "Supervisión",
  collaborator: "Colaborador",
};

function isUserRole(value: unknown): value is UserRole {
  return value === "admin" || value === "supervisor" || value === "collaborator";
}

function getDisplayName(user: User) {
  const fullName = user.user_metadata.full_name;
  const name = user.user_metadata.name;

  if (typeof fullName === "string" && fullName.trim()) return fullName.trim();
  if (typeof name === "string" && name.trim()) return name.trim();

  return user.email?.split("@")[0] || "Usuario";
}

function getInitials(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);

  return (
    words
      .slice(0, 2)
      .map((word) => word[0]?.toUpperCase())
      .join("") || "US"
  );
}

export function mapSupabaseUser(user: User): SessionUser {
  const appRole = user.app_metadata.role;
  const role: UserRole = isUserRole(appRole) ? appRole : "collaborator";
  const name = getDisplayName(user);

  return {
    id: user.id,
    name,
    email: user.email ?? "",
    role,
    roleLabel: roleLabels[role],
    initials: getInitials(name),
  };
}

export class InvalidCredentialsError extends Error {
  constructor() {
    super("El correo o la contraseña no coinciden.");
    this.name = "InvalidCredentialsError";
  }
}

export class AuthenticationRateLimitError extends Error {
  constructor() {
    super("Demasiados intentos. Espera un momento antes de volver a intentar.");
    this.name = "AuthenticationRateLimitError";
  }
}

export async function authenticate(email: string, password: string) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password,
  });

  if (error) {
    if (error.status === 429) throw new AuthenticationRateLimitError();

    if (error.status === 400 || error.status === 401 || error.status === 422) {
      throw new InvalidCredentialsError();
    }

    throw new Error("No se pudo conectar con Supabase Auth.", { cause: error });
  }

  if (!data.user || !data.session) throw new InvalidCredentialsError();

  return mapSupabaseUser(data.user);
}
