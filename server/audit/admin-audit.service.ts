import "server-only";

import type { RecordAuditInput } from "@/features/audit/types";
import type { SessionUser } from "@/features/auth/types";

import { adminAuditRepository } from "./admin-audit.repository";

export function getAdminAuditLogs() {
  return adminAuditRepository.list();
}

export async function recordAdminAuditSafely(actor: SessionUser, input: RecordAuditInput) {
  try {
    await adminAuditRepository.record(actor, input);
  } catch (error) {
    // The administrative mutation has already completed. Do not make the user
    // repeat it, but leave an operational signal for monitoring.
    console.error("No se pudo registrar un evento de auditoría:", error);
  }
}
