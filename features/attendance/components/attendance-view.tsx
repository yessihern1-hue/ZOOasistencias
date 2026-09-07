"use client";

import { useEffect, useMemo, useState } from "react";

import type {
  AttendanceAction,
  AttendanceMutationResponse,
  AttendancePageData,
  AttendanceRecord,
} from "@/features/attendance/types";
import { Avatar } from "@/features/shared/components/avatar";
import { Icon } from "@/features/shared/components/icon";

const statusLabel = {
  present: "A tiempo",
  late: "Llegó tarde",
  absent: "Ausente",
  pending: "Pendiente",
};

function formatClock(date: Date) {
  return new Intl.DateTimeFormat("es-GT", {
    timeZone: "America/Guatemala",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(date);
}

export function AttendanceView({ initialData }: { initialData: AttendancePageData }) {
  const [clock, setClock] = useState("--:--:--");
  const [currentRecord, setCurrentRecord] = useState(initialData.currentUserRecord);
  const [records, setRecords] = useState(initialData.records);
  const [isSaving, setIsSaving] = useState(false);
  const [notice, setNotice] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    const updateClock = () => setClock(formatClock(new Date()));
    updateClock();
    const timer = window.setInterval(updateClock, 1000);
    return () => window.clearInterval(timer);
  }, []);

  const action: AttendanceAction = currentRecord?.checkIn && !currentRecord.checkOut ? "check-out" : "check-in";
  const isComplete = Boolean(currentRecord?.checkIn && currentRecord.checkOut);
  const summary = useMemo(() => {
    const newlyCheckedIn = currentRecord?.checkIn && !initialData.currentUserRecord?.checkIn;

    if (!newlyCheckedIn) return initialData.summary;
    return {
      ...initialData.summary,
      present: initialData.summary.present + (currentRecord.status === "present" ? 1 : 0),
      late: initialData.summary.late + (currentRecord.status === "late" ? 1 : 0),
      absent: Math.max(0, initialData.summary.absent - 1),
    };
  }, [currentRecord, initialData]);

  async function register() {
    if (isComplete) return;
    setIsSaving(true);
    setNotice(null);

    try {
      const response = await fetch("/api/v1/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const result = (await response.json()) as AttendanceMutationResponse;

      if (!response.ok || !result.record) {
        setNotice({ type: "error", text: result.error ?? "No se pudo guardar el registro." });
        return;
      }

      setCurrentRecord(result.record);
      setRecords((current) => {
        const withoutCurrent = current.filter((item) => item.employeeId !== result.record!.employeeId);
        return [result.record!, ...withoutCurrent];
      });
      setNotice({ type: "success", text: result.message ?? "Asistencia registrada." });
    } catch {
      setNotice({ type: "error", text: "No hay conexión con el servidor." });
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="page-stack">
      <header className="page-heading heading-with-date">
        <div>
          <span className="eyebrow">CONTROL DE ASISTENCIA</span>
          <h1>Tomar asistencia</h1>
          <p>Registra tu entrada y salida para completar tu jornada.</p>
        </div>
        <span className="date-chip"><Icon name="calendar" size={17} />{initialData.formattedDate}</span>
      </header>

      <section className="checkin-layout">
        <article className="panel checkin-card">
          <span className="checkin-label">HORA ACTUAL</span>
          <time className="live-clock">{clock}</time>
          <p className="clock-zone">Hora de Guatemala · GMT-6</p>

          <div className={`fingerprint-ring ${isComplete ? "fingerprint-complete" : ""}`}>
            <span><Icon name={isComplete ? "check" : "fingerprint"} size={42} /></span>
          </div>

          <h2>
            {isComplete
              ? "Jornada completada"
              : action === "check-in"
                ? "¿Listo para comenzar?"
                : "¿Terminaste por hoy?"}
          </h2>
          <p>
            {isComplete
              ? "Tu entrada y salida quedaron registradas."
              : action === "check-in"
                ? "Registra tu entrada con un solo toque."
                : "Registra tu hora de salida para cerrar la jornada."}
          </p>
          <button
            className="button button-primary checkin-button"
            disabled={isSaving || isComplete}
            onClick={register}
            type="button"
          >
            <Icon name={action === "check-in" ? "arrow-right" : "logout"} size={19} />
            {isSaving ? "Registrando…" : isComplete ? "Asistencia completa" : action === "check-in" ? "Registrar entrada" : "Registrar salida"}
          </button>
          {notice && <p className={`inline-notice notice-${notice.type}`} role="status">{notice.text}</p>}
        </article>

        <div className="attendance-side-stack">
          <article className="panel today-card">
            <div className="panel-heading"><div><h2>Tu jornada de hoy</h2><p>Horario asignado: 08:00 – 17:00</p></div><span className={`status-badge ${currentRecord ? `status-${currentRecord.status}` : "status-pending"}`}>{currentRecord ? statusLabel[currentRecord.status] : "Sin iniciar"}</span></div>
            <div className="timeline-row">
              <div className="timeline-point timeline-point-active"><span><Icon name="arrow-right" size={16} /></span><div><small>ENTRADA</small><strong>{currentRecord?.checkIn ?? "--:--"}</strong></div></div>
              <div className="timeline-line"><span style={{ width: currentRecord?.checkOut ? "100%" : currentRecord?.checkIn ? "50%" : "0%" }} /></div>
              <div className={`timeline-point ${currentRecord?.checkOut ? "timeline-point-active" : ""}`}><span><Icon name="logout" size={16} /></span><div><small>SALIDA</small><strong>{currentRecord?.checkOut ?? "--:--"}</strong></div></div>
            </div>
          </article>

          <article className="panel team-summary-card">
            <div className="panel-heading"><div><h2>Equipo hoy</h2><p>Estado general de asistencia</p></div></div>
            <div className="mini-summary-grid">
              <div><span className="summary-dot dot-green" /><strong>{summary.present}</strong><small>Presentes</small></div>
              <div><span className="summary-dot dot-amber" /><strong>{summary.late}</strong><small>Tarde</small></div>
              <div><span className="summary-dot dot-red" /><strong>{summary.absent}</strong><small>Ausentes</small></div>
            </div>
            <div className="progress-bar" aria-label={`${Math.round((summary.present / summary.total) * 100)}% de asistencia`}><span style={{ width: `${(summary.present / summary.total) * 100}%` }} /></div>
            <p className="summary-foot"><strong>{Math.round((summary.present / summary.total) * 100)}%</strong> de asistencia general</p>
          </article>
        </div>
      </section>

      <section className="panel recent-panel">
        <div className="panel-heading"><div><h2>Asistencia del equipo</h2><p>Registros del día en tiempo real</p></div><label className="small-search"><Icon name="search" size={16} /><input aria-label="Buscar en registros" placeholder="Buscar…" /></label></div>
        <div className="table-scroll">
          <table className="data-table">
            <thead><tr><th>COLABORADOR</th><th>ÁREA</th><th>HORARIO</th><th>ENTRADA</th><th>SALIDA</th><th>ESTADO</th></tr></thead>
            <tbody>{records.map((record: AttendanceRecord) => (
              <tr key={record.id}>
                <td><div className="person-cell"><Avatar initials={record.initials} tone={record.avatarTone} size="sm" /><strong>{record.employeeName}</strong></div></td>
                <td>{record.department}</td><td>{record.schedule}</td>
                <td className="time-cell">{record.checkIn ?? "—"}</td><td className="time-cell">{record.checkOut ?? "—"}</td>
                <td><span className={`status-badge status-${record.status}`}>{statusLabel[record.status]}</span></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
