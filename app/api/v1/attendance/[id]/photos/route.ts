import { NextResponse } from "next/server";

import {
  ForbiddenError,
  PasswordChangeRequiredError,
  requireApiAdmin,
  UnauthorizedError,
} from "@/server/auth/dal";
import { getAttendancePhotoUrls } from "@/server/storage/attendance-photo.service";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireApiAdmin();
    const { id } = await params;
    if (!uuidPattern.test(id)) {
      return NextResponse.json({ error: "La sesión no es válida." }, { status: 400 });
    }
    return NextResponse.json(await getAttendancePhotoUrls(id), {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    if (error instanceof UnauthorizedError) return NextResponse.json({ error: error.message }, { status: 401 });
    if (error instanceof ForbiddenError) return NextResponse.json({ error: error.message }, { status: 403 });
    if (error instanceof PasswordChangeRequiredError) return NextResponse.json({ error: error.message }, { status: 428 });
    return NextResponse.json({ error: "No se pudieron abrir las fotografías." }, { status: 500 });
  }
}
