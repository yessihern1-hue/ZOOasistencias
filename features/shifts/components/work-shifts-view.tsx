"use client";

import { type FormEvent, useMemo, useState } from "react";

import type { WorkShift, WorkShiftDay, WorkShiftInput } from "@/features/shifts/types";
import { Icon } from "@/features/shared/components/icon";

const orderedDays = [1, 2, 3, 4, 5, 6, 0];
const dayLabels: Record<number, { short: string; long: string }> = {
  0: { short: "Dom", long: "Domingo" },
  1: { short: "Lun", long: "Lunes" },
  2: { short: "Mar", long: "Martes" },
  3: { short: "Mié", long: "Miércoles" },
  4: { short: "Jue", long: "Jueves" },
  5: { short: "Vie", long: "Viernes" },
  6: { short: "Sáb", long: "Sábado" },
};

type EditableDay = WorkShiftDay & { enabled: boolean };
type ShiftResponse = { shifts?: WorkShift[]; error?: string };

function createDays(shift?: WorkShift): EditableDay[] {
  return orderedDays.map((dayOfWeek) => {
    const configured = shift?.days.find((day) => day.dayOfWeek === dayOfWeek);
    return {
      dayOfWeek,
      enabled: Boolean(configured) || (!shift && dayOfWeek >= 1 && dayOfWeek <= 5),
      startTime: configured?.startTime ?? "08:00",
      endTime: configured?.endTime ?? "17:00",
      unpaidBreakMinutes: configured?.unpaidBreakMinutes ?? 0,
    };
  });
}

function getDaysSummary(shift: WorkShift) {
  const days = shift.days.map((day) => day.dayOfWeek);
  if ([1, 2, 3, 4, 5].every((day) => days.includes(day)) && days.length === 5) {
    return "Lunes a viernes";
  }
  return orderedDays.filter((day) => days.includes(day)).map((day) => dayLabels[day].short).join(", ");
}

function getTimeSummary(shift: WorkShift) {
  const schedules = new Set(shift.days.map((day) => `${day.startTime} – ${day.endTime}`));
  return schedules.size === 1 ? [...schedules][0] : "Horario variable";
}

export function WorkShiftsView({ initialShifts }: { initialShifts: WorkShift[] }) {
  const [shifts, setShifts] = useState(initialShifts);
  const [editing, setEditing] = useState<WorkShift | "new" | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const stats = useMemo(() => ({
    active: shifts.filter((shift) => shift.active).length,
    assigned: shifts.reduce((total, shift) => total + shift.activeAssignments, 0),
  }), [shifts]);

  function openModal(shift: WorkShift | "new") {
    setError("");
    setEditing(shift);
  }

  async function saveShift(input: WorkShiftInput) {
    if (!editing) return;
    setIsSaving(true);
    setError("");
    const isNew = editing === "new";

    try {
      const response = await fetch(
        isNew ? "/api/v1/work-shifts" : `/api/v1/work-shifts/${editing.id}`,
        {
          method: isNew ? "POST" : "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        }
      );
      const result = (await response.json()) as ShiftResponse;
      if (!response.ok) {
        setError(result.error ?? "No se pudo guardar la jornada.");
        return;
      }
      if (result.shifts) setShifts(result.shifts);
      setEditing(null);
    } catch {
      setError("No hay conexión con el servidor. Intenta nuevamente.");
    } finally {
      setIsSaving(false);
    }
  }

  async function toggleShift(shift: WorkShift) {
    if (
      shift.active &&
      shift.activeAssignments > 0 &&
      !window.confirm(
        `Esta jornada tiene ${shift.activeAssignments} colaborador${shift.activeAssignments === 1 ? "" : "es"} asignado${shift.activeAssignments === 1 ? "" : "s"}. Al desactivarla no podrán registrar nuevas entradas. ¿Deseas continuar?`
      )
    ) return;

    setUpdatingId(shift.id);
    try {
      const response = await fetch(`/api/v1/work-shifts/${shift.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !shift.active }),
      });
      const result = (await response.json()) as ShiftResponse;
      if (!response.ok) {
        window.alert(result.error ?? "No se pudo cambiar el estado de la jornada.");
        return;
      }
      if (result.shifts) setShifts(result.shifts);
    } catch {
      window.alert("No hay conexión con el servidor.");
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <div className="page-stack">
      <header className="page-heading heading-with-action">
        <div>
          <span className="eyebrow">CONFIGURACIÓN LABORAL</span>
          <h1>Jornadas</h1>
          <p>Define horarios, tolerancias y reglas de registro para cada equipo.</p>
        </div>
        <button className="button button-primary" onClick={() => openModal("new")} type="button">
          <span className="button-plus">+</span>Nueva jornada
        </button>
      </header>

      <section className="directory-stats">
        <article className="panel directory-stat"><span className="stat-icon stat-blue"><Icon name="calendar" /></span><div><strong>{shifts.length}</strong><small>Total jornadas</small></div></article>
        <article className="panel directory-stat"><span className="stat-icon stat-green"><Icon name="check" /></span><div><strong>{stats.active}</strong><small>Jornadas activas</small></div></article>
        <article className="panel directory-stat"><span className="stat-icon stat-amber"><Icon name="users" /></span><div><strong>{stats.assigned}</strong><small>Asignaciones actuales</small></div></article>
      </section>

      <section className="shift-grid">
        {shifts.map((shift) => (
          <article className={`panel shift-card ${shift.active ? "" : "shift-card-inactive"}`} key={shift.id}>
            <header className="shift-card-header">
              <span className="shift-card-icon"><Icon name="clock" size={20} /></span>
              <div><h2>{shift.name}</h2><p>{getDaysSummary(shift)}</p></div>
              <span className={`status-badge status-${shift.active ? "present" : "absent"}`}>{shift.active ? "Activa" : "Inactiva"}</span>
            </header>

            <div className="shift-main-time"><strong>{getTimeSummary(shift)}</strong><small>{shift.timezone}</small></div>
            <div className="shift-day-pills">
              {orderedDays.map((day) => {
                const configured = shift.days.find((item) => item.dayOfWeek === day);
                return <span className={configured ? "configured" : ""} key={day}>{dayLabels[day].short}</span>;
              })}
            </div>
            <dl className="shift-rules">
              <div><dt>Tolerancia tarde</dt><dd>{shift.lateToleranceMinutes} min</dd></div>
              <div><dt>Entrada anticipada</dt><dd>{shift.earlyCheckinMinutes} min</dd></div>
              <div><dt>Espera reingreso</dt><dd>{shift.reentryDelayMinutes} min</dd></div>
              <div><dt>Sesiones diarias</dt><dd>{shift.maxSessionsPerDay}</dd></div>
            </dl>
            <footer className="shift-card-footer">
              <span><Icon name="users" size={14} />{shift.activeAssignments} asignado{shift.activeAssignments === 1 ? "" : "s"}</span>
              <div>
                <button className="table-action" onClick={() => openModal(shift)} type="button">Editar</button>
                <button className={`table-action ${shift.active ? "danger-action" : ""}`} disabled={updatingId === shift.id} onClick={() => toggleShift(shift)} type="button">
                  {updatingId === shift.id ? "Guardando…" : shift.active ? "Desactivar" : "Activar"}
                </button>
              </div>
            </footer>
          </article>
        ))}
        {!shifts.length && (
          <div className="panel shift-empty"><Icon name="calendar" size={34} /><h2>Aún no hay jornadas</h2><p>Crea la primera para poder asignarla a tus colaboradores.</p></div>
        )}
      </section>

      {editing && (
        <div className="modal-backdrop" role="presentation">
          <section aria-labelledby="shift-modal-title" aria-modal="true" className="employee-modal shift-modal" role="dialog">
            <header className="modal-header">
              <div><span className="eyebrow">REGLAS DE ASISTENCIA</span><h2 id="shift-modal-title">{editing === "new" ? "Nueva jornada" : `Editar ${editing.name}`}</h2></div>
              <button aria-label="Cerrar" className="icon-button" disabled={isSaving} onClick={() => setEditing(null)} type="button"><Icon name="x" /></button>
            </header>
            <WorkShiftForm
              error={error}
              isSaving={isSaving}
              onCancel={() => setEditing(null)}
              onSave={saveShift}
              shift={editing === "new" ? undefined : editing}
            />
          </section>
        </div>
      )}
    </div>
  );
}

function WorkShiftForm({
  error,
  isSaving,
  onCancel,
  onSave,
  shift,
}: {
  error: string;
  isSaving: boolean;
  onCancel: () => void;
  onSave: (input: WorkShiftInput) => void;
  shift?: WorkShift;
}) {
  const [days, setDays] = useState(() => createDays(shift));

  function updateDay(dayOfWeek: number, changes: Partial<EditableDay>) {
    setDays((current) => current.map((day) => day.dayOfWeek === dayOfWeek ? { ...day, ...changes } : day));
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    onSave({
      name: String(form.get("name") ?? ""),
      timezone: String(form.get("timezone") ?? "America/Guatemala"),
      lateToleranceMinutes: Number(form.get("lateToleranceMinutes")),
      earlyCheckinMinutes: Number(form.get("earlyCheckinMinutes")),
      earlyDepartureToleranceMinutes: Number(form.get("earlyDepartureToleranceMinutes")),
      reentryDelayMinutes: Number(form.get("reentryDelayMinutes")),
      maxSessionsPerDay: Number(form.get("maxSessionsPerDay")),
      days: days.filter((day) => day.enabled).map((day) => ({
        dayOfWeek: day.dayOfWeek,
        startTime: day.startTime,
        endTime: day.endTime,
        unpaidBreakMinutes: day.unpaidBreakMinutes,
      })),
    });
  }

  return (
    <form className="employee-form" onSubmit={submit}>
      <div className="form-grid">
        <label className="admin-field admin-field-wide"><span>Nombre de la jornada</span><input defaultValue={shift?.name ?? ""} maxLength={120} name="name" placeholder="Ej. Jornada administrativa" required /></label>
        <label className="admin-field admin-field-wide"><span>Zona horaria</span><select defaultValue={shift?.timezone ?? "America/Guatemala"} name="timezone"><option value="America/Guatemala">America/Guatemala (GMT-6)</option><option value="America/Mexico_City">America/Mexico_City</option><option value="America/Costa_Rica">America/Costa_Rica</option><option value="America/El_Salvador">America/El_Salvador</option><option value="America/Tegucigalpa">America/Tegucigalpa</option></select></label>
      </div>

      <fieldset className="shift-days-fieldset">
        <legend>Días y horarios</legend>
        <div className="shift-days-list">
          {days.map((day) => (
            <div className={`shift-day-editor ${day.enabled ? "enabled" : ""}`} key={day.dayOfWeek}>
              <label className="shift-day-toggle"><input checked={day.enabled} onChange={(event) => updateDay(day.dayOfWeek, { enabled: event.target.checked })} type="checkbox" /><span>{dayLabels[day.dayOfWeek].long}</span></label>
              <label><span>Entrada</span><input disabled={!day.enabled} onChange={(event) => updateDay(day.dayOfWeek, { startTime: event.target.value })} type="time" value={day.startTime} /></label>
              <label><span>Salida</span><input disabled={!day.enabled} onChange={(event) => updateDay(day.dayOfWeek, { endTime: event.target.value })} type="time" value={day.endTime} /></label>
              <label><span>Descanso</span><div className="number-with-unit"><input disabled={!day.enabled} max={1440} min={0} onChange={(event) => updateDay(day.dayOfWeek, { unpaidBreakMinutes: Number(event.target.value) })} type="number" value={day.unpaidBreakMinutes} /><small>min</small></div></label>
              {day.enabled && day.endTime <= day.startTime && <em>Termina al día siguiente</em>}
            </div>
          ))}
        </div>
      </fieldset>

      <fieldset className="shift-rules-fieldset">
        <legend>Reglas de registro</legend>
        <div className="form-grid">
          <label className="admin-field"><span>Tolerancia de llegada tarde</span><div className="number-with-unit"><input defaultValue={shift?.lateToleranceMinutes ?? 10} max={1440} min={0} name="lateToleranceMinutes" required type="number" /><small>min</small></div></label>
          <label className="admin-field"><span>Entrada anticipada permitida</span><div className="number-with-unit"><input defaultValue={shift?.earlyCheckinMinutes ?? 0} max={1440} min={0} name="earlyCheckinMinutes" required type="number" /><small>min</small></div></label>
          <label className="admin-field"><span>Tolerancia de salida anticipada</span><div className="number-with-unit"><input defaultValue={shift?.earlyDepartureToleranceMinutes ?? 0} max={1440} min={0} name="earlyDepartureToleranceMinutes" required type="number" /><small>min</small></div></label>
          <label className="admin-field"><span>Espera antes de reingresar</span><div className="number-with-unit"><input defaultValue={shift?.reentryDelayMinutes ?? 60} max={1440} min={0} name="reentryDelayMinutes" required type="number" /><small>min</small></div></label>
          <label className="admin-field admin-field-wide"><span>Máximo de sesiones por día</span><input defaultValue={shift?.maxSessionsPerDay ?? 2} max={10} min={1} name="maxSessionsPerDay" required type="number" /></label>
        </div>
      </fieldset>

      {error && <p className="form-error" role="alert">{error}</p>}
      <footer className="modal-actions"><button className="button button-secondary" disabled={isSaving} onClick={onCancel} type="button">Cancelar</button><button className="button button-primary" disabled={isSaving} type="submit">{isSaving ? "Guardando…" : "Guardar jornada"}</button></footer>
    </form>
  );
}
