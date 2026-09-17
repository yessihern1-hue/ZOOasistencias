import { purgeExpiredAttendancePhotos } from "@/server/storage/attendance-photo-retention.service";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization");

  if (!cronSecret || authorization !== `Bearer ${cronSecret}`) {
    return Response.json({ error: "No autorizado." }, { status: 401 });
  }

  try {
    return Response.json({
      success: true,
      ...(await purgeExpiredAttendancePhotos()),
    });
  } catch (error) {
    console.error("No se pudo ejecutar la retención de fotografías:", error);
    return Response.json(
      { success: false, error: "No se pudo ejecutar la retención de fotografías." },
      { status: 500 }
    );
  }
}
