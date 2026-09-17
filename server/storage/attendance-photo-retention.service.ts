import "server-only";

import { createSupabaseAdminClient } from "@/server/supabase/admin";

const BUCKET_NAME = "attendance-photos";
const RETENTION_DAYS = 20;
const BATCH_SIZE = 100;
const MAX_BATCHES_PER_RUN = 20;

type PhotoKind = "check-in" | "check-out";
type RetentionRow = { id: string; photo_path: string | null };

const columnsByKind = {
  "check-in": {
    timestamp: "check_in_at",
    path: "check_in_photo_path",
    deletedAt: "check_in_photo_deleted_at",
  },
  "check-out": {
    timestamp: "check_out_at",
    path: "check_out_photo_path",
    deletedAt: "check_out_photo_deleted_at",
  },
} as const;

async function purgeKind(kind: PhotoKind, cutoff: string) {
  const supabase = createSupabaseAdminClient();
  const columns = columnsByKind[kind];
  let deleted = 0;

  for (let batch = 0; batch < MAX_BATCHES_PER_RUN; batch += 1) {
    const { data, error } = await supabase
      .from("attendance_sessions")
      .select(`id,photo_path:${columns.path}`)
      .not(columns.path, "is", null)
      .is(columns.deletedAt, null)
      .lt(columns.timestamp, cutoff)
      .order(columns.timestamp, { ascending: true })
      .limit(BATCH_SIZE);

    if (error) throw new Error(`No se pudo consultar la retención de ${kind}: ${error.message}`);
    const rows = (data ?? []) as unknown as RetentionRow[];
    if (!rows.length) break;

    const paths = rows.flatMap((row) => row.photo_path ? [row.photo_path] : []);
    if (!paths.length) break;

    const { error: storageError } = await supabase.storage
      .from(BUCKET_NAME)
      .remove(paths);
    if (storageError) {
      throw new Error(`No se pudieron eliminar fotografías de ${kind}: ${storageError.message}`);
    }

    const deletedAt = new Date().toISOString();
    const update = {
      [columns.path]: null,
      [columns.deletedAt]: deletedAt,
    };
    const { error: updateError } = await supabase
      .from("attendance_sessions")
      .update(update)
      .in("id", rows.map((row) => row.id))
      .not(columns.path, "is", null);
    if (updateError) {
      throw new Error(`No se pudo registrar la retención de ${kind}: ${updateError.message}`);
    }

    deleted += paths.length;
    if (rows.length < BATCH_SIZE) break;
  }

  return deleted;
}

export async function purgeExpiredAttendancePhotos() {
  const cutoff = new Date(
    Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000
  ).toISOString();
  const [checkInPhotos, checkOutPhotos] = await Promise.all([
    purgeKind("check-in", cutoff),
    purgeKind("check-out", cutoff),
  ]);

  return {
    retentionDays: RETENTION_DAYS,
    cutoff,
    checkInPhotos,
    checkOutPhotos,
    totalDeleted: checkInPhotos + checkOutPhotos,
  };
}
