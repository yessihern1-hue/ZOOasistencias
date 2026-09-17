import { NextResponse } from "next/server";

import {
  ForbiddenError,
  PasswordChangeRequiredError,
  requireApiAdmin,
  UnauthorizedError,
} from "@/server/auth/dal";
import type { CreateEmployeeInput } from "@/features/employees/types";
import {
  createEmployee,
  EmployeeConflictError,
  EmployeeInputError,
  getEmployees,
} from "@/server/employees/employee.service";

function authErrorResponse(error: unknown) {
  if (error instanceof UnauthorizedError) {
    return NextResponse.json({ error: error.message }, { status: 401 });
  }
  if (error instanceof ForbiddenError) {
    return NextResponse.json({ error: error.message }, { status: 403 });
  }
  if (error instanceof PasswordChangeRequiredError) {
    return NextResponse.json({ error: error.message }, { status: 428 });
  }
  return null;
}

export async function GET() {
  try {
    await requireApiAdmin();
    return NextResponse.json({ employees: await getEmployees() });
  } catch (error) {
    const authResponse = authErrorResponse(error);
    if (authResponse) return authResponse;
    return NextResponse.json({ error: "No se pudo consultar a los colaboradores." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const admin = await requireApiAdmin();
    const body = (await request.json()) as CreateEmployeeInput;
    const created = await createEmployee(body, admin);
    return NextResponse.json(
      { ...created, employees: await getEmployees() },
      { headers: { "Cache-Control": "private, no-store" }, status: 201 }
    );
  } catch (error) {
    const authResponse = authErrorResponse(error);
    if (authResponse) return authResponse;
    if (error instanceof EmployeeInputError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (error instanceof EmployeeConflictError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    return NextResponse.json(
      { error: "No se pudo crear el colaborador. Revisa la configuración administrativa de Supabase." },
      { status: 500 }
    );
  }
}
