import "server-only";

import type { AdminAuditLog, RecordAuditInput } from "@/features/audit/types";
import type { SessionUser } from "@/features/auth/types";
import { createSupabaseAdminClient } from "@/server/supabase/admin";
import { createSupabaseServerClient } from "@/server/supabase/client";

type AuditRow = {
  id: string;
  actor_employee_id: string | null;
  actor_name: string;
  action: string;
  entity_type: AdminAuditLog["entityType"];
  entity_id: string | null;
  entity_label: string | null;
  before_data: Record<string, unknown> | null;
  after_data: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

export const adminAuditRepository = {
  async list(limit = 300): Promise<AdminAuditLog[]> {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("admin_audit_logs")
      .select("id,actor_employee_id,actor_name,action,entity_type,entity_id,entity_label,before_data,after_data,metadata,created_at")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) throw new Error(`No se pudo consultar la auditoría: ${error.message}`);
    return ((data ?? []) as AuditRow[]).map((row) => ({
      id: row.id,
      actorEmployeeId: row.actor_employee_id,
      actorName: row.actor_name,
      action: row.action,
      entityType: row.entity_type,
      entityId: row.entity_id,
      entityLabel: row.entity_label,
      beforeData: row.before_data,
      afterData: row.after_data,
      metadata: row.metadata ?? {},
      createdAt: row.created_at,
    }));
  },

  async record(actor: SessionUser, input: RecordAuditInput): Promise<void> {
    const admin = createSupabaseAdminClient();
    const { error } = await admin.from("admin_audit_logs").insert({
      actor_employee_id: actor.employeeId,
      actor_auth_user_id: actor.id,
      actor_name: actor.name,
      action: input.action,
      entity_type: input.entityType,
      entity_id: input.entityId,
      entity_label: input.entityLabel,
      before_data: input.beforeData ?? null,
      after_data: input.afterData ?? null,
      metadata: input.metadata ?? {},
    });
    if (error) throw new Error(`No se pudo registrar la auditoría: ${error.message}`);
  },
};
