import type { Metadata } from "next";

import { EmployeesView } from "@/features/employees/components/employees-view";
import { requireAdmin } from "@/server/auth/dal";
import { getEmployees } from "@/server/employees/employee.service";
import { getActiveWorkShifts } from "@/server/shifts/work-shift.service";

export const metadata: Metadata = { title: "Colaboradores" };

export default async function EmployeesPage() {
  await requireAdmin();
  const [employees, shifts] = await Promise.all([getEmployees(), getActiveWorkShifts()]);
  return <EmployeesView initialEmployees={employees} shifts={shifts} />;
}
