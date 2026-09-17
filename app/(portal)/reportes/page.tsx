import type { Metadata } from "next";

import { ReportsView } from "@/features/reports/components/reports-view";
import { requireAdmin } from "@/server/auth/dal";
import { getAttendanceReport } from "@/server/reports/report.service";

export const metadata: Metadata = { title: "Reportes" };

export default async function ReportsPage() {
  await requireAdmin();
  return <ReportsView initialData={await getAttendanceReport()} />;
}
