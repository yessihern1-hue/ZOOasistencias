import type { SessionUser, UserRole } from "@/features/auth/types";

export function getUserHomePath(role: UserRole): "/admin" | "/asistencia" {
  return role === "admin" ? "/admin" : "/asistencia";
}

export function getUserEntryPath(
  user: Pick<SessionUser, "role" | "mustChangePassword">
): "/cambiar-password" | "/admin" | "/asistencia" {
  return user.mustChangePassword ? "/cambiar-password" : getUserHomePath(user.role);
}
