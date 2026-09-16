"use client";

import { useEffect, useState } from "react";

import type {
  AttendanceMutationResponse,
  AttendancePageData,
  AttendanceRecord,
} from "@/features/attendance/types";
import { Avatar } from "@/features/shared/components/avatar";
import { Icon } from "@/features/shared/components/icon";
import { CameraCapture } from "./camera-capture";

const statusLabel = {
  present: "A tiempo",
  late: "Llegó tarde",
  absent: "Ausente",
  pending: "Pendiente",
};

function formatClock(timestamp: number) {
  return new Intl.DateTimeFormat("es-GT", {
    timeZone: "America/Guatemala",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date(timestamp));
}

function formatCountdown(totalSeconds: number) {
  const safeSeconds = Math.max(0, totalSeconds);
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;

  return [hours, minutes, seconds]
    .map((value) => value.toString().padStart(2, "0"))
    .join(":");
}

function getRecordStatus(record: AttendanceRecord) {
  if (record.departureStatus === "early" && record.checkOut) {
    return { className: "status-late", label: "Salida anticipada" };
  }

  return {
    className: `status-${record.status}`,
    label: statusLabel[record.status],
  };
}

export function AttendanceView({ initialData }: { initialData: AttendancePageData }) {
  const [pageData, setPageData] = useState(initialData);
  const [serverOffsetMs, setServerOffsetMs] = useState(
    () => new Date(initialData.registrationState.serverNow).getTime() - Date.now()
  );
  const [nowMs, setNowMs] = useState(
    () => Date.now() + serverOffsetMs
  );
  const [isSaving, setIsSaving] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [notice, setNotice] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [checkInPhoto, setCheckInPhoto] = useState<string | null>(null);
  const [checkOutPhoto, setCheckOutPhoto] = useState<string | null>(null);
  const [observation, setObservation] = useState("");

  const registration = pageData.registrationState;
  const currentRecord = pageData.currentUserRecord;
  const action = registration.nextAction;
  const canRegister =
    registration.availability === "ready" ||
    registration.availability === "working";
  const requiresPhoto = action === "check-in" ? !checkInPhoto : !checkOutPhoto;
  const isComplete = registration.availability === "completed";
  const isCooldown = registration.availability === "cooldown";
  const cooldownTarget = registration.nextAllowedCheckInAt
    ? new Date(registration.nextAllowedCheckInAt).getTime()
    : null;
  const remainingSeconds = cooldownTarget
    ? Math.max(0, Math.ceil((cooldownTarget - nowMs) / 1000))
    : 0;
  const summary = pageData.summary;
  const attendancePercentage = summary.total > 0
    ? Math.round(((summary.present + summary.late) / summary.total) * 100)
    : 0;
  const totalWorkedMinutes = pageData.currentUserSessions.reduce(
    (total, session) => total + (session.workedMinutes ?? 0),
    0
  );

  function applyPageData(data: AttendancePageData) {
    const offset = new Date(data.registrationState.serverNow).getTime() - Date.now();
    setServerOffsetMs(offset);
    setNowMs(Date.now() + offset);
    setPageData(data);
  }

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNowMs(Date.now() + serverOffsetMs);
    }, 1000);

    return () => window.clearInterval(timer);
  }, [serverOffsetMs]);

  useEffect(() => {
    if (!isCooldown || !cooldownTarget) return;

    const delay = Math.max(250, cooldownTarget - (Date.now() + serverOffsetMs) + 250);
    const timer = window.setTimeout(async () => {
      setIsRefreshing(true);

      try {
        const response = await fetch("/api/v1/attendance", { cache: "no-store" });
        if (!response.ok) return;
        applyPageData((await response.json()) as AttendancePageData);
      } finally {
        setIsRefreshing(false);
      }
    }, delay);

    return () => window.clearTimeout(timer);
  }, [cooldownTarget, isCooldown, serverOffsetMs]);

  async function register() {
    if (!canRegister || !action) return;

    if (requiresPhoto) {
      setNotice({
        type: "error",
        text: action === "check-in"
          ? "Debe capturar una fotografía antes de registrar la entrada."
          : "Debe capturar una fotografía antes de registrar la salida.",
      });
      return;
    }

    setIsSaving(true);
    setNotice(null);

    try {
      const response = await fetch("/api/v1/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          observation: observation.trim() || null,
          photo: action === "check-in" ? checkInPhoto : checkOutPhoto,
        }),
      });
      const result = (await response.json()) as AttendanceMutationResponse;

      if (!response.ok || !result.record || !result.data) {
        setNotice({
          type: "error",
          text: result.error ?? "No se pudo guardar el registro.",
        });
        return;
      }

      applyPageData(result.data);
      setCheckInPhoto(null);
      setCheckOutPhoto(null);
      setObservation("");
      setNotice({
        type: "success",
        text: result.message ?? "Asistencia registrada correctamente.",
      });
    } catch {
      setNotice({ type: "error", text: "No hay conexión con el servidor." });
    } finally {
      setIsSaving(false);
    }
  }

  const headline = registration.availability === "working"
    ? "¿Terminaste esta sesión?"
    : registration.availability === "ready"
      ? registration.sessionCount > 0
        ? "¿Listo para continuar?"
        : "¿Listo para comenzar?"
      : registration.availability === "cooldown"
        ? "Jornada completada"
        : registration.availability === "completed"
          ? "Asistencia completa"
          : "Registro no disponible";

  const buttonLabel = isSaving
    ? "Registrando…"
    : isRefreshing
      ? "Actualizando…"
      : action === "check-in"
        ? "Registrar entrada"
        : action === "check-out"
          ? "Registrar salida"
          : isCooldown
            ? `Disponible en ${formatCountdown(remainingSeconds)}`
            : isComplete
              ? "Límite diario completado"
              : "Registro no disponible";

  return (
    <div className="page-stack">
      <header className="page-heading heading-with-date">
        <div>
          <span className="eyebrow">CONTROL DE ASISTENCIA</span>
          <h1>Tomar asistencia</h1>
          <p>Registra tus entradas y salidas durante la jornada.</p>
        </div>
        <span className="date-chip">
          <Icon name="calendar" size={17} />
          {pageData.formattedDate}
        </span>
      </header>

      <section className="checkin-layout">
        <article className="panel checkin-card">
          <span className="checkin-label">HORA OFICIAL</span>
          <time className="live-clock">{formatClock(nowMs)}</time>
          <p className="clock-zone">Hora de Guatemala · sincronizada con el servidor</p>

          <div className={`fingerprint-ring ${!canRegister ? "fingerprint-complete" : ""}`}>
            <span>
              <Icon
                name={!canRegister ? "check" : "fingerprint"}
                size={42}
              />
            </span>
          </div>

          <h2>{headline}</h2>
          <p>
            {registration.message}
            {isCooldown && cooldownTarget
              ? ` Tiempo restante: ${formatCountdown(remainingSeconds)}.`
              : ""}
          </p>

          {canRegister && (
            <label className="attendance-observation">
              <span>Observación opcional</span>
              <textarea
                maxLength={500}
                onChange={(event) => setObservation(event.target.value)}
                placeholder={action === "check-in"
                  ? "Ej. visita médica antes de ingresar"
                  : "Ej. salida autorizada"
                }
                rows={2}
                value={observation}
              />
            </label>
          )}

          {canRegister && requiresPhoto && (
            <CameraCapture
              onCapture={(image) => {
                if (action === "check-in") setCheckInPhoto(image);
                if (action === "check-out") setCheckOutPhoto(image);
              }}
            />
          )}

          <button
            className="button button-primary checkin-button"
            disabled={isSaving || isRefreshing || !canRegister || requiresPhoto}
            onClick={register}
            type="button"
          >
            <Icon name={action === "check-out" ? "logout" : "arrow-right"} size={19} />
            {buttonLabel}
          </button>

          {notice && (
            <p className={`inline-notice notice-${notice.type}`} role="status">
              {notice.text}
            </p>
          )}
        </article>

        <div className="attendance-side-stack">
          <article className="panel today-card">
            <div className="panel-heading">
              <div>
                <h2>Tu jornada de hoy</h2>
                <p>Horario: {pageData.currentUserSchedule || "Sin jornada"}</p>
              </div>
              <span className={`status-badge ${currentRecord
                ? getRecordStatus(currentRecord).className
                : "status-pending"
              }`}>
                {currentRecord ? getRecordStatus(currentRecord).label : "Sin iniciar"}
              </span>
            </div>

            <div className="session-meta">
              <span>Sesiones <strong>{registration.sessionCount}/{registration.maxSessions || "—"}</strong></span>
              <span>Tiempo registrado <strong>{Math.floor(totalWorkedMinutes / 60)}h {totalWorkedMinutes % 60}m</strong></span>
            </div>

            <div className="timeline-row">
              <div className="timeline-point timeline-point-active">
                <span><Icon name="arrow-right" size={16} /></span>
                <div><small>ENTRADA ACTUAL</small><strong>{currentRecord?.checkIn ?? "--:--"}</strong></div>
              </div>
              <div className="timeline-line">
                <span style={{ width: currentRecord?.checkOut ? "100%" : currentRecord?.checkIn ? "50%" : "0%" }} />
              </div>
              <div className={`timeline-point ${currentRecord?.checkOut ? "timeline-point-active" : ""}`}>
                <span><Icon name="logout" size={16} /></span>
                <div><small>SALIDA ACTUAL</small><strong>{currentRecord?.checkOut ?? "--:--"}</strong></div>
              </div>
            </div>
          </article>

          <article className="panel team-summary-card">
            <div className="panel-heading">
              <div><h2>Equipo hoy</h2><p>Estado general de asistencia</p></div>
            </div>
            <div className="mini-summary-grid">
              <div><span className="summary-dot dot-green" /><strong>{summary.present}</strong><small>Presentes</small></div>
              <div><span className="summary-dot dot-amber" /><strong>{summary.late}</strong><small>Tarde</small></div>
              <div><span className="summary-dot dot-red" /><strong>{summary.absent}</strong><small>Ausentes</small></div>
            </div>
            <div className="progress-bar" aria-label={`${attendancePercentage}% de asistencia`}>
              <span style={{ width: `${attendancePercentage}%` }} />
            </div>
            <p className="summary-foot"><strong>{attendancePercentage}%</strong> de asistencia general</p>
          </article>
        </div>
      </section>

      <section className="panel recent-panel">
        <div className="panel-heading">
          <div><h2>Sesiones registradas</h2><p>Entradas y salidas del día en tiempo real</p></div>
        </div>
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr><th>COLABORADOR</th><th>SESIÓN</th><th>ENTRADA</th><th>SALIDA</th><th>TIEMPO</th><th>OBSERVACIÓN</th><th>ESTADO</th></tr>
            </thead>
            <tbody>
              {pageData.records.map((record) => {
                const recordStatus = getRecordStatus(record);
                const recordObservation = record.checkOutObservation ?? record.checkInObservation;

                return (
                  <tr key={record.id}>
                    <td>
                      <div className="person-cell">
                        <Avatar initials={record.initials} tone={record.avatarTone} size="sm" />
                        <span><strong>{record.employeeName}</strong><small>{record.schedule || "Sin horario"}</small></span>
                      </div>
                    </td>
                    <td>#{record.sessionSequence}</td>
                    <td className="time-cell">{record.checkIn ?? "—"}</td>
                    <td className="time-cell">{record.checkOut ?? "—"}</td>
                    <td>{record.workedMinutes === null ? "En curso" : `${Math.floor(record.workedMinutes / 60)}h ${record.workedMinutes % 60}m`}</td>
                    <td>{recordObservation || "—"}</td>
                    <td><span className={`status-badge ${recordStatus.className}`}>{recordStatus.label}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
