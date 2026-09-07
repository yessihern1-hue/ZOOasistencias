import type { Metadata } from "next";

import { ReportsView } from "@/features/reports/components/reports-view";
import { requireUser } from "@/server/auth/dal";

export const metadata: Metadata = { title: "Reportes" };

export default async function ReportsPage() {
  await requireUser();
  return <ReportsView />;
}
