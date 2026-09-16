import type { Metadata } from "next";

import { DashboardView } from "@/features/dashboard/components/dashboard-view";
import { requireAdmin } from "@/server/auth/dal";
import { getDashboardData } from "@/server/dashboard/dashboard.service";

export const metadata: Metadata = { title: "Administración" };

export default async function AdminPage() {
  const user = await requireAdmin();
  const data = await getDashboardData();

  return <DashboardView data={data} userName={user.name} />;
}
