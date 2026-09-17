import type { Metadata } from "next";

import { AttendanceLocationsView } from "@/features/locations/components/attendance-locations-view";
import { requireAdmin } from "@/server/auth/dal";
import { getAttendanceLocations } from "@/server/locations/attendance-location.service";

export const metadata: Metadata = { title: "Ubicaciones" };

export default async function AttendanceLocationsPage() {
  await requireAdmin();
  return <AttendanceLocationsView initialLocations={await getAttendanceLocations()} />;
}
