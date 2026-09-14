import "server-only";

import { supabaseAdmin } from "@/server/supabase/admin";

const BUCKET_NAME = "attendance-photos";

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
  userId: string,
  dateKey: string,
  type: AttendancePhotoType,
  photo: string
): Promise<string> {
  const {
    buffer,
    mimeType,
    extension,
  } = base64ToBuffer(photo);

  const fileName =
    `${type}-${Date.now()}.${extension}`;

  const path =
    `${userId}/${dateKey}/${fileName}`;

  const { error } = await supabaseAdmin.storage
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