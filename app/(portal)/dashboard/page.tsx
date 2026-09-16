import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { requireAdmin } from "@/server/auth/dal";

export const metadata: Metadata = { title: "Resumen" };

export default async function DashboardPage() {
  await requireAdmin();
  redirect("/admin");
}
