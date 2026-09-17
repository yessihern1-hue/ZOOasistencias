export type AuditEntityType = "employee" | "work_shift" | "attendance_location";

export type AdminAuditLog = {
  id: string;
  actorEmployeeId: string | null;
  actorName: string;
  action: string;
  entityType: AuditEntityType;
  entityId: string | null;
  entityLabel: string | null;
  beforeData: Record<string, unknown> | null;
  afterData: Record<string, unknown> | null;
  metadata: Record<string, unknown>;
  createdAt: string;
};

export type RecordAuditInput = {
  action: string;
  entityType: AuditEntityType;
  entityId: string | null;
  entityLabel: string | null;
  beforeData?: Record<string, unknown> | null;
  afterData?: Record<string, unknown> | null;
  metadata?: Record<string, unknown>;
};
