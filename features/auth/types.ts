import type { EmployeeStatus } from "@/features/employees/types";

export type UserRole = "admin" | "employee";

export type SessionUser = {
  id: string;
  employeeId: string;
  name: string;
  email: string;
  role: UserRole;
  roleLabel: string;
  initials: string;
  status: EmployeeStatus;
  mustChangePassword: boolean;
};

export type LoginResponse = {
  user?: SessionUser;
  error?: string;
};
