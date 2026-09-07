import type { Metadata } from "next";

import { AttendanceView } from "@/features/attendance/components/attendance-view";
import { getAttendancePageData } from "@/server/attendance/attendance.service";
import { requireUser } from "@/server/auth/dal";

export const metadata: Metadata = { title: "Tomar asistencia" };

export default async function AttendancePage() {
  const user = await requireUser();
  const data = getAttendancePageData(user.id);

  return <AttendanceView initialData={data} />;
}
