import type { Metadata } from "next";

import { EmployeesView } from "@/features/employees/components/employees-view";
import { requireUser } from "@/server/auth/dal";
import { getEmployees } from "@/server/employees/employee.service";

export const metadata: Metadata = { title: "Colaboradores" };

export default async function EmployeesPage() {
  await requireUser();
  return <EmployeesView employees={getEmployees()} />;
}
