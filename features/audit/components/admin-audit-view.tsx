"use client";

import { useMemo, useState } from "react";

import type { AdminAuditLog, AuditEntityType } from "@/features/audit/types";
import { Icon } from "@/features/shared/components/icon";

const actionLabels: Record<string, string> = {
  "employee.created": "Colaborador creado",
  "employee.updated": "Colaborador actualizado",
  "work_shift.created": "Jornada creada",
  "work_shift.updated": "Jornada actualizada",
  "work_shift.activated": "Jornada activada",
  "work_shift.deactivated": "Jornada desactivada",
  "attendance_location.created": "Ubicación creada",
  "attendance_location.updated": "Ubicación actualizada",
  "attendance_location.activated": "Ubicación activada",
  "attendance_location.deactivated": "Ubicación desactivada",
};

const entityLabels: Record<AuditEntityType, string> = {
  employee: "Colaborador",
  work_shift: "Jornada",
  attendance_location: "Ubicación",
};

const fieldLabels: Record<string, string> = {
  name: "Nombre",
  email: "Correo",
  role: "Rol",
  status: "Estado efectivo",
  employmentStatus: "Estado laboral",
  department: "Departamento",
  position: "Puesto",
  shiftId: "Jornada asignada",
  absenceStart: "Inicio de ausencia",
  absenceEnd: "Fin de ausencia",
  reason: "Motivo",
  terminationDate: "Fecha de baja",
  inactiveReason: "Motivo de baja",
  mustChangePassword: "Cambio de contraseña requerido",
  timezone: "Zona horaria",
  lateToleranceMinutes: "Tolerancia de llegada",
  earlyCheckinMinutes: "Entrada anticipada",
  earlyDepartureToleranceMinutes: "Tolerancia de salida",
  reentryDelayMinutes: "Espera de reingreso",
  maxSessionsPerDay: "Sesiones por día",
  days: "Días y horarios",
  active: "Activo",
  latitude: "Latitud",
  longitude: "Longitud",
  allowedRadiusMeters: "Radio permitido",
};

function formatDate(timestamp: string) {
  return new Intl.DateTimeFormat("es-GT", {
    timeZone: "America/Guatemala",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(timestamp));
}

function formatValue(value: unknown) {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Sí" : "No";
  if (typeof value === "object") return JSON.stringify(value, null, 2);
  return String(value);
}

export function AdminAuditView({ logs }: { logs: AdminAuditLog[] }) {
  const [search, setSearch] = useState("");
  const [entityType, setEntityType] = useState<AuditEntityType | "all">("all");
  const filtered = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("es");
    return logs.filter((log) => {
      if (entityType !== "all" && log.entityType !== entityType) return false;
      if (!query) return true;
      return [
        log.actorName,
        log.entityLabel,
        actionLabels[log.action] ?? log.action,
        entityLabels[log.entityType],
      ].some((value) => value?.toLocaleLowerCase("es").includes(query));
    });
  }, [entityType, logs, search]);

  return (
    <div className="page-stack">
      <header className="page-heading">
        <span className="eyebrow">TRAZABILIDAD ADMINISTRATIVA</span>
        <h1>Auditoría</h1>
        <p>Consulta quién realizó cada cambio sensible y cuáles fueron sus valores anteriores y nuevos.</p>
      </header>

      <section className="directory-stats">
        <article className="panel directory-stat"><span className="stat-icon stat-blue"><Icon name="shield" /></span><div><strong>{logs.length}</strong><small>Eventos recientes</small></div></article>
        <article className="panel directory-stat"><span className="stat-icon stat-green"><Icon name="users" /></span><div><strong>{new Set(logs.map((log) => log.actorEmployeeId).filter(Boolean)).size}</strong><small>Administradores</small></div></article>
        <article className="panel directory-stat"><span className="stat-icon stat-amber"><Icon name="document" /></span><div><strong>{new Set(logs.map((log) => log.entityId).filter(Boolean)).size}</strong><small>Entidades modificadas</small></div></article>
      </section>

      <section className="panel audit-toolbar">
        <label className="directory-search"><Icon name="search" size={16} /><input aria-label="Buscar auditoría" onChange={(event) => setSearch(event.target.value)} placeholder="Buscar administrador, acción o elemento…" value={search} /></label>
        <label className="audit-filter"><span>TIPO</span><select onChange={(event) => setEntityType(event.target.value as AuditEntityType | "all")} value={entityType}><option value="all">Todos</option><option value="employee">Colaboradores</option><option value="work_shift">Jornadas</option><option value="attendance_location">Ubicaciones</option></select></label>
      </section>

      <section className="panel audit-list">
        {filtered.map((log) => (
          <details className="audit-event" key={log.id}>
            <summary>
              <span className="audit-event-icon"><Icon name="shield" size={17} /></span>
              <span className="audit-event-main"><strong>{actionLabels[log.action] ?? log.action}</strong><small>{entityLabels[log.entityType]} · {log.entityLabel ?? log.entityId ?? "Sin referencia"}</small></span>
              <span className="audit-event-actor"><strong>{log.actorName}</strong><small>{formatDate(log.createdAt)}</small></span>
              <Icon name="chevron-down" size={16} />
            </summary>
            <AuditDiff before={log.beforeData} after={log.afterData} />
          </details>
        ))}
        {!filtered.length && <div className="audit-empty"><Icon name="document" size={28} /><strong>No hay eventos para estos filtros</strong><span>Los próximos cambios administrativos aparecerán aquí.</span></div>}
      </section>
    </div>
  );
}

function AuditDiff({
  before,
  after,
}: {
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
}) {
  const keys = [...new Set([
    ...Object.keys(before ?? {}),
    ...Object.keys(after ?? {}),
  ])];

  return (
    <div className="audit-diff">
      <div className="audit-diff-header"><span>CAMPO</span><span>ANTES</span><span>DESPUÉS</span></div>
      {keys.map((key) => {
        const previous = before?.[key];
        const next = after?.[key];
        const changed = JSON.stringify(previous) !== JSON.stringify(next);
        return (
          <div className={changed ? "audit-diff-row changed" : "audit-diff-row"} key={key}>
            <strong>{fieldLabels[key] ?? key}</strong>
            <pre>{formatValue(previous)}</pre>
            <pre>{formatValue(next)}</pre>
          </div>
        );
      })}
    </div>
  );
}
