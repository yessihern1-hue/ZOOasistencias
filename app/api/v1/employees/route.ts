import { NextResponse } from "next/server";

import { requireApiUser, UnauthorizedError } from "@/server/auth/dal";
import { getEmployees } from "@/server/employees/employee.service";

export async function GET() {
  try {
    await requireApiUser();
    return NextResponse.json({ employees: getEmployees() });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    return NextResponse.json({ error: "No se pudo consultar a los colaboradores." }, { status: 500 });
  }
}
