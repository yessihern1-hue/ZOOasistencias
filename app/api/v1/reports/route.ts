import { NextResponse } from "next/server";

import {
  ForbiddenError,
  PasswordChangeRequiredError,
  requireApiAdmin,
  UnauthorizedError,
} from "@/server/auth/dal";
import { getAttendanceReport, ReportInputError } from "@/server/reports/report.service";

export async function GET(request: Request) {
  try {
    await requireApiAdmin();
    const url = new URL(request.url);
    const data = await getAttendanceReport({
      from: url.searchParams.get("from"),
      to: url.searchParams.get("to"),
      employeeId: url.searchParams.get("employeeId"),
      department: url.searchParams.get("department"),
      shiftId: url.searchParams.get("shiftId"),
      status: url.searchParams.get("status"),
    });
    return NextResponse.json(data, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof UnauthorizedError) return NextResponse.json({ error: error.message }, { status: 401 });
    if (error instanceof ForbiddenError) return NextResponse.json({ error: error.message }, { status: 403 });
    if (error instanceof PasswordChangeRequiredError) return NextResponse.json({ error: error.message }, { status: 428 });
    if (error instanceof ReportInputError) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ error: "No se pudo generar el reporte." }, { status: 500 });
  }
}
