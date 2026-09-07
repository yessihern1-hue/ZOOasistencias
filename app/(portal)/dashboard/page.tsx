import type { Metadata } from "next";

import { DashboardView } from "@/features/dashboard/components/dashboard-view";
import { requireUser } from "@/server/auth/dal";
import { getDashboardData } from "@/server/dashboard/dashboard.service";

export const metadata: Metadata = { title: "Resumen" };

export default async function DashboardPage() {
  const user = await requireUser();
  const data = getDashboardData();

  return <DashboardView data={data} userName={user.name} />;
}
