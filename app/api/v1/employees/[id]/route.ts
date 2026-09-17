import { NextResponse } from "next/server";

import type { UpdateEmployeeInput } from "@/features/employees/types";
import {
  ForbiddenError,
  PasswordChangeRequiredError,
  requireApiAdmin,
  UnauthorizedError,
} from "@/server/auth/dal";
import {
  EmployeeConflictError,
  EmployeeInputError,
  getEmployees,
  updateEmployee,
} from "@/server/employees/employee.service";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireApiAdmin();
    const { id } = await params;
    const body = (await request.json()) as UpdateEmployeeInput;
    const updated = await updateEmployee(id, body, admin);

    return NextResponse.json({ ...updated, employees: await getEmployees() }, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    if (error instanceof PasswordChangeRequiredError) {
      return NextResponse.json({ error: error.message }, { status: 428 });
    }
    if (error instanceof EmployeeInputError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (error instanceof EmployeeConflictError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    return NextResponse.json({ error: "No se pudo actualizar el colaborador." }, { status: 500 });
  }
}
