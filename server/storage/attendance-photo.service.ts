import "server-only";

import { createSupabaseServerClient } from "@/server/supabase/client";

const BUCKET_NAME = "attendance-photos";
const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

type AttendancePhotoType =
  | "check-in"
  | "check-out";

function base64ToBuffer(photo: string) {
  const match = photo.match(
    /^data:(image\/(?:jpeg|jpg|png|webp));base64,(.+)$/
  );

  if (!match) {
    throw new Error(
      "El formato de la fotografía no es válido."
    );
  }

  const mimeType = match[1];
  const base64Data = match[2];

  const buffer = Buffer.from(
    base64Data,
    "base64"
  );

  if (!buffer.length || buffer.length > MAX_PHOTO_BYTES) {
    throw new Error("La fotografía debe pesar menos de 5 MB.");
  }

  let extension = "jpg";

  if (mimeType === "image/png") {
    extension = "png";
  }

  if (mimeType === "image/webp") {
    extension = "webp";
  }

  return {
    buffer,
    mimeType,
    extension,
  };
}

export async function uploadAttendancePhoto(
  employeeId: string,
  dateKey: string,
  sessionId: string,
  type: AttendancePhotoType,
  photo: string
): Promise<string> {
  const {
    buffer,
    mimeType,
    extension,
  } = base64ToBuffer(photo);

  const [year, month] = dateKey.split("-");
  const path = `${employeeId}/${year}/${month}/${sessionId}/${type}.${extension}`;

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(path, buffer, {
      contentType: mimeType,
      upsert: false,
    });

  if (error) {
    throw new Error(
      `No se pudo guardar la fotografía: ${error.message}`
    );
  }

  return path;
}

export async function deleteAttendancePhoto(path: string): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.storage
    .from(BUCKET_NAME)
    .remove([path]);

  if (error) {
    throw new Error(`No se pudo eliminar la fotografía: ${error.message}`);
  }
}

export async function getAttendancePhotoUrls(sessionId: string) {
  const supabase = await createSupabaseServerClient();
  const { data: session, error: sessionError } = await supabase
    .from("attendance_sessions")
    .select("check_in_photo_path, check_out_photo_path, check_in_photo_deleted_at, check_out_photo_deleted_at")
    .eq("id", sessionId)
    .maybeSingle();

  if (sessionError) throw new Error(`No se pudo consultar la evidencia: ${sessionError.message}`);
  if (!session) throw new Error("La sesión de asistencia no existe.");

  async function sign(path: string | null) {
    if (!path) return null;
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .createSignedUrl(path, 300);
    if (error) throw new Error(`No se pudo abrir la fotografía: ${error.message}`);
    return data.signedUrl;
  }

  const [checkInUrl, checkOutUrl] = await Promise.all([
    sign(session.check_in_photo_path),
    sign(session.check_out_photo_path),
  ]);
  return {
    checkInUrl,
    checkOutUrl,
    checkInDeletedAt: session.check_in_photo_deleted_at,
    checkOutDeletedAt: session.check_out_photo_deleted_at,
  };
}
