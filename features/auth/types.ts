export type UserRole = "admin" | "supervisor" | "collaborator";

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  roleLabel: string;
  initials: string;
};

export type LoginResponse = {
  user?: SessionUser;
  error?: string;
};
