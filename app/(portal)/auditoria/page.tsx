import type { Metadata } from "next";

import { AdminAuditView } from "@/features/audit/components/admin-audit-view";
import { getAdminAuditLogs } from "@/server/audit/admin-audit.service";
import { requireAdmin } from "@/server/auth/dal";

export const metadata: Metadata = { title: "Auditoría" };

export default async function AuditPage() {
  await requireAdmin();
  return <AdminAuditView logs={await getAdminAuditLogs()} />;
}
