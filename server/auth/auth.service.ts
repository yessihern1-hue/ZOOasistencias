import "server-only";

import type { SupabaseClient, User } from "@supabase/supabase-js";

import type { SessionUser, UserRole } from "@/features/auth/types";
import type { EmployeeStatus } from "@/features/employees/types";
import { createSupabaseServerClient } from "@/server/supabase/client";

type EmployeeIdentityRow = {
  id: string;
  full_name: string;
  email: string;
  role: UserRole;
  employment_status: "active" | "inactive";
  effective_status: EmployeeStatus;
  must_change_password: boolean;
};

export type LoadedSessionUser = SessionUser & {
  employmentStatus: "active" | "inactive";
};

const roleLabels: Record<UserRole, string> = {
  admin: "Administración",
  employee: "Empleado",
};

function getInitials(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);

  return (
    words
      .slice(0, 2)
      .map((word) => word[0]?.toUpperCase())
      .join("") || "US"
  );
}

export async function loadSessionUser(
  supabase: SupabaseClient,
  authUser: User
): Promise<LoadedSessionUser | null> {
  const { data, error } = await supabase
    .from("employee_effective_status")
    .select(`
      id,
      full_name,
      email,
      role,
      employment_status,
      effective_status,
      must_change_password
    `)
    .eq("auth_user_id", authUser.id)
    .maybeSingle();

  if (error) {
    throw new Error(`No se pudo consultar el perfil del empleado: ${error.message}`);
  }
  if (!data) return null;

  const employee = data as EmployeeIdentityRow;

  return {
    id: authUser.id,
    employeeId: employee.id,
    name: employee.full_name,
    email: employee.email,
    role: employee.role,
    roleLabel: roleLabels[employee.role],
    initials: getInitials(employee.full_name),
    status: employee.effective_status,
    employmentStatus: employee.employment_status,
    mustChangePassword: employee.must_change_password,
  };
}

export function toSessionUser(user: LoadedSessionUser): SessionUser {
  return {
    id: user.id,
    employeeId: user.employeeId,
    name: user.name,
    email: user.email,
    role: user.role,
    roleLabel: user.roleLabel,
    initials: user.initials,
    status: user.status,
    mustChangePassword: user.mustChangePassword,
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

export class MissingEmployeeProfileError extends Error {
  constructor() {
    super("Tu cuenta todavía no está asociada a un empleado. Contacta al administrador.");
    this.name = "MissingEmployeeProfileError";
  }
}

export class InactiveEmployeeError extends Error {
  constructor() {
    super("Tu usuario está inactivo. Contacta al administrador para recuperar el acceso.");
    this.name = "InactiveEmployeeError";
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

  const user = await loadSessionUser(supabase, data.user);

  if (!user) {
    await supabase.auth.signOut({ scope: "local" });
    throw new MissingEmployeeProfileError();
  }

  if (user.employmentStatus === "inactive") {
    await supabase.auth.signOut({ scope: "local" });
    throw new InactiveEmployeeError();
  }

  return toSessionUser(user);
}
