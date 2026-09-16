import type { AvatarTone } from "@/features/attendance/types";

export type EmployeeStatus =
  | "active"
  | "inactive"
  | "vacation"
  | "permission";

export type Employee = {
  id: string;
  authUserId: string | null;
  name: string;
  initials: string;
  avatarTone: AvatarTone;
  email: string;
  role: "admin" | "employee";
  department: string;
  position: string;
  schedule: string;
  shiftId: string | null;
  status: EmployeeStatus;
  activeAbsenceId: string | null;
  mustChangePassword: boolean;
};

export type WorkShiftOption = {
  id: string;
  name: string;
  schedule: string;
};

export type CreateEmployeeInput = {
  name: string;
  email: string;
  role: "admin" | "employee";
  department: string;
  position: string;
  shiftId: string | null;
};

export type UpdateEmployeeInput = {
  name: string;
  role: "admin" | "employee";
  department: string;
  position: string;
  shiftId: string | null;
  status: EmployeeStatus;
  absenceStart?: string;
  absenceEnd?: string;
  reason?: string;
};
