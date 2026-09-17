"use client";

import { type FormEvent, useMemo, useState } from "react";

import type {
  AttendancePhotoUrls,
  AttendanceReportData,
  AttendanceReportRow,
} from "@/features/reports/types";
import { Avatar } from "@/features/shared/components/avatar";
import { Icon } from "@/features/shared/components/icon";

type ReportResponse = AttendanceReportData & { error?: string };

function hours(minutes: number) {
  const whole = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return `${whole}h ${remainder}m`;
}

function dateLabel(dateKey: string) {
  return new Intl.DateTimeFormat("es-GT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(`${dateKey}T12:00:00`));
}

function csvValue(value: string | number) {
  return `"${String(value).replaceAll('"', '""')}"`;
}

function addDays(dateKey: string, amount: number) {
  const date = new Date(`${dateKey}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}

function currentDateKey() {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: "America/Guatemala",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return `${value("year")}-${value("month")}-${value("day")}`;
}

function weekRange(offsetWeeks = 0) {
  const today = currentDateKey();
  const day = new Date(`${today}T12:00:00Z`).getUTCDay();
  const daysSinceMonday = day === 0 ? 6 : day - 1;
  const from = addDays(today, -daysSinceMonday + offsetWeeks * 7);
  return { from, to: addDays(from, 6) };
}

function monthRange() {
  const today = currentDateKey();
  const from = `${today.slice(0, 7)}-01`;
  const nextMonth = new Date(`${from}T12:00:00Z`);
  nextMonth.setUTCMonth(nextMonth.getUTCMonth() + 1);
  return { from, to: addDays(nextMonth.toISOString().slice(0, 10), -1) };
}

function dayColumnLabel(dateKey: string) {
  const date = new Date(`${dateKey}T12:00:00Z`);
  const weekday = new Intl.DateTimeFormat("es-GT", { weekday: "short", timeZone: "UTC" })
    .format(date)
    .replace(".", "");
  return { weekday, day: dateKey.slice(8, 10) };
}

export function ReportsView({ initialData }: { initialData: AttendanceReportData }) {
  const [data, setData] = useState(initialData);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [from, setFrom] = useState(initialData.from);
  const [to, setTo] = useState(initialData.to);
  const [employeeId, setEmployeeId] = useState(initialData.employeeId ?? "");
  const [department, setDepartment] = useState(initialData.department ?? "");
  const [shiftId, setShiftId] = useState(initialData.shiftId ?? "");
  const [status, setStatus] = useState(initialData.status ?? "");
  const [page, setPage] = useState(1);
  const [photoState, setPhotoState] = useState<{
    row: AttendanceReportRow;
    urls: AttendancePhotoUrls | null;
    error: string;
  } | null>(null);

  async function applyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsLoading(true);
    setError("");
    const params = new URLSearchParams({
      from,
      to,
    });
    if (employeeId) params.set("employeeId", employeeId);
    if (department) params.set("department", department);
    if (shiftId) params.set("shiftId", shiftId);
    if (status) params.set("status", status);

    try {
      const response = await fetch(`/api/v1/reports?${params}`, { cache: "no-store" });
      const result = (await response.json()) as ReportResponse;
      if (!response.ok) {
        setError(result.error ?? "No se pudo generar el reporte.");
        return;
      }
      setData(result);
      setPage(1);
    } catch {
      setError("No hay conexión con el servidor.");
    } finally {
      setIsLoading(false);
    }
  }

  function exportCsv() {
    const header = ["Colaborador", "Departamento", "Fecha", "Sesión", "Entrada", "Salida", "Minutos", "Llegada", "Salida anticipada", "Estado sesión", "Jornada", "Ubicación entrada", "Distancia entrada (m)", "Ubicación salida", "Distancia salida (m)", "Observación entrada", "Observación salida", "Evidencia entrada", "Evidencia salida"];
    const rows = data.rows.map((row) => [
      row.employeeName,
      row.department,
      row.workDate,
      row.sessionSequence,
      row.checkIn,
      row.checkOut ?? "",
      row.workedMinutes,
      row.arrivalStatus === "late" ? "Tarde" : "A tiempo",
      row.departureStatus === "early" ? "Sí" : "No",
      row.sessionStatus,
      row.shiftName,
      row.checkInLocationName ?? "",
      row.checkInDistanceMeters === null ? "" : Math.round(row.checkInDistanceMeters),
      row.checkOutLocationName ?? "",
      row.checkOutDistanceMeters === null ? "" : Math.round(row.checkOutDistanceMeters),
      row.checkInObservation ?? "",
      row.checkOutObservation ?? "",
      row.hasCheckInPhoto ? "Disponible" : row.checkInPhotoDeletedAt ? "Eliminada por retención" : "Sin fotografía",
      row.hasCheckOutPhoto ? "Disponible" : row.checkOutPhotoDeletedAt ? "Eliminada por retención" : "Sin fotografía",
    ]);
    const csv = [header, ...rows].map((row) => row.map(csvValue).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `asistencia-${data.from}-${data.to}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  const pageSize = 25;
  const pageCount = Math.max(1, Math.ceil(data.rows.length / pageSize));
  const visibleRows = useMemo(
    () => data.rows.slice((page - 1) * pageSize, page * pageSize),
    [data.rows, page]
  );
  const showDailyBreakdown = data.dateColumns.length === 7;

  async function openPhotos(row: AttendanceReportRow) {
    setPhotoState({ row, urls: null, error: "" });
    try {
      const response = await fetch(`/api/v1/attendance/${row.id}/photos`, { cache: "no-store" });
      const result = (await response.json()) as AttendancePhotoUrls & { error?: string };
      if (!response.ok) {
        setPhotoState({ row, urls: null, error: result.error ?? "No se pudieron abrir las fotografías." });
        return;
      }
      setPhotoState({ row, urls: result, error: "" });
    } catch {
      setPhotoState({ row, urls: null, error: "No hay conexión con el servidor." });
    }
  }

  return (
    <div className="page-stack">
      <header className="page-heading heading-with-action">
        <div><span className="eyebrow">ANÁLISIS Y RESULTADOS</span><h1>Reportes de asistencia</h1><p>Consulta sesiones, evidencia y horas acumuladas del equipo.</p></div>
        <button className="button button-secondary" disabled={!data.rows.length} onClick={exportCsv} type="button"><Icon name="document" size={17} />Exportar CSV</button>
      </header>

      <div className="report-presets" aria-label="Rangos rápidos">
        <span>Rangos rápidos:</span>
        <button onClick={() => { const range = weekRange(); setFrom(range.from); setTo(range.to); }} type="button">Esta semana</button>
        <button onClick={() => { const range = weekRange(-1); setFrom(range.from); setTo(range.to); }} type="button">Semana anterior</button>
        <button onClick={() => { const range = monthRange(); setFrom(range.from); setTo(range.to); }} type="button">Este mes</button>
      </div>

      <form className="report-filters panel real-report-filters" onSubmit={applyFilters}>
        <label><span>DESDE</span><input name="from" onChange={(event) => setFrom(event.target.value)} required type="date" value={from} /></label>
        <label><span>HASTA</span><input name="to" onChange={(event) => setTo(event.target.value)} required type="date" value={to} /></label>
        <label><span>COLABORADOR</span><select name="employeeId" onChange={(event) => setEmployeeId(event.target.value)} value={employeeId}><option value="">Todos</option>{data.employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.name}</option>)}</select></label>
        <label><span>DEPARTAMENTO</span><select name="department" onChange={(event) => setDepartment(event.target.value)} value={department}><option value="">Todos</option>{data.departments.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
        <label><span>JORNADA</span><select name="shiftId" onChange={(event) => setShiftId(event.target.value)} value={shiftId}><option value="">Todas</option>{data.shifts.map((shift) => <option key={shift.id} value={shift.id}>{shift.name}</option>)}</select></label>
        <label><span>ESTADO</span><select name="status" onChange={(event) => setStatus(event.target.value)} value={status}><option value="">Todos</option><option value="on_time">A tiempo</option><option value="late">Llegada tarde</option><option value="early">Salida anticipada</option><option value="open">En curso</option><option value="completed">Completada</option></select></label>
        <button className="button button-primary" disabled={isLoading} type="submit">{isLoading ? "Consultando…" : "Aplicar filtros"}</button>
      </form>
      {error && <p className="report-error" role="alert">{error}</p>}

      <section className="report-kpis">
        <article className="panel report-kpi"><span>COBERTURA DEL EQUIPO</span><strong>{data.summary.attendanceRate}%</strong><small>{data.summary.presentEmployees} colaboradores con registros</small></article>
        <article className="panel report-kpi"><span>PUNTUALIDAD</span><strong>{data.summary.punctualityRate}%</strong><small>Primera entrada de cada día</small></article>
        <article className="panel report-kpi"><span>HORAS TRABAJADAS</span><strong>{hours(data.summary.workedMinutes)}</strong><small>Sesiones completadas del período</small></article>
        <article className="panel report-kpi"><span>INCIDENCIAS</span><strong>{data.summary.incidents}</strong><small>Llegadas tarde y salidas anticipadas</small></article>
      </section>

      <section className="panel report-section">
        <div className="panel-heading"><div><h2>{showDailyBreakdown ? "Total semanal por colaborador" : "Horas por colaborador"}</h2><p>Acumulado entre {dateLabel(data.from)} y {dateLabel(data.to)}</p></div></div>
        <div className="table-scroll">
          <table className="data-table report-totals-table">
            <thead><tr><th>COLABORADOR</th><th>DEPARTAMENTO</th>{showDailyBreakdown && data.dateColumns.map((date) => { const label = dayColumnLabel(date); return <th className="report-day-heading" key={date}><span>{label.weekday}</span><small>{label.day}</small></th>; })}<th>DÍAS</th><th>SESIONES</th><th>TARDES</th><th>SALIDAS ANTICIPADAS</th><th>TOTAL</th></tr></thead>
            <tbody>{data.weeklyTotals.map((total) => (
              <tr key={total.employeeId}><td><strong>{total.employeeName}</strong></td><td>{total.department}</td>{showDailyBreakdown && data.dateColumns.map((date) => <td className="daily-hours" key={date}>{total.dailyMinutes[date] ? hours(total.dailyMinutes[date]) : "—"}</td>)}<td>{total.attendanceDays}</td><td>{total.completedSessions}</td><td>{total.lateArrivals}</td><td>{total.earlyDepartures}</td><td className="worked-total">{hours(total.workedMinutes)}</td></tr>
            ))}</tbody>
          </table>
        </div>
      </section>

      <section className="panel report-section">
        <div className="panel-heading"><div><h2>Historial de sesiones</h2><p>{data.rows.length} registros encontrados</p></div></div>
        <div className="table-scroll">
          <table className="data-table report-history-table">
            <thead><tr><th>COLABORADOR</th><th>FECHA</th><th>SESIÓN</th><th>ENTRADA</th><th>SALIDA</th><th>TIEMPO</th><th>UBICACIÓN</th><th>OBSERVACIÓN</th><th>ESTADO</th><th>EVIDENCIA</th></tr></thead>
            <tbody>{visibleRows.map((row) => (
              <tr key={row.id}>
                <td><div className="person-cell"><Avatar initials={row.initials} tone={row.avatarTone} size="sm" /><span><strong>{row.employeeName}</strong><small>{row.department} · {row.shiftName}</small></span></div></td>
                <td>{dateLabel(row.workDate)}</td><td>#{row.sessionSequence}</td><td className="time-cell">{row.checkIn}</td><td className="time-cell">{row.checkOut ?? "En curso"}</td><td>{row.sessionStatus === "open" ? "En curso" : hours(row.workedMinutes)}</td>
                <td><div className="report-location"><span>{row.checkInLocationName ?? "Registro anterior"}{row.checkInDistanceMeters !== null ? ` · ${Math.round(row.checkInDistanceMeters)} m` : ""}</span>{row.checkOutLocationName && <small>Salida: {row.checkOutLocationName}{row.checkOutDistanceMeters !== null ? ` · ${Math.round(row.checkOutDistanceMeters)} m` : ""}</small>}</div></td>
                <td><div className="report-observation"><span title={row.checkInObservation ?? undefined}>{row.checkInObservation ?? "—"}</span>{row.checkOutObservation && <small title={row.checkOutObservation}>Salida: {row.checkOutObservation}</small>}</div></td>
                <td><div className="report-statuses"><span className={`status-badge status-${row.arrivalStatus === "late" ? "late" : "present"}`}>{row.arrivalStatus === "late" ? "Tarde" : "A tiempo"}</span>{row.sessionStatus === "open" && <span className="status-badge status-pending">En curso</span>}{row.sessionStatus === "corrected" && <span className="status-badge status-pending">Corregida</span>}{row.departureStatus === "early" && <span className="status-badge status-late">Salida anticipada</span>}</div></td>
                <td>{row.hasCheckInPhoto || row.hasCheckOutPhoto ? <button className="table-action" onClick={() => openPhotos(row)} type="button"><Icon name="eye" size={13} />Ver fotos</button> : row.checkInPhotoDeletedAt || row.checkOutPhotoDeletedAt ? <span className="evidence-expired">Retención vencida</span> : "—"}</td>
              </tr>
            ))}
            {!data.rows.length && <tr><td className="empty-table" colSpan={10}>No hay asistencias para los filtros seleccionados.</td></tr>}
            </tbody>
          </table>
        </div>
        {data.rows.length > pageSize && <footer className="report-pagination"><span>Mostrando {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, data.rows.length)} de {data.rows.length}</span><div><button disabled={page === 1} onClick={() => setPage((current) => Math.max(1, current - 1))} type="button">Anterior</button><strong>{page} / {pageCount}</strong><button disabled={page === pageCount} onClick={() => setPage((current) => Math.min(pageCount, current + 1))} type="button">Siguiente</button></div></footer>}
      </section>

      {photoState && (
        <div className="modal-backdrop" role="presentation">
          <section aria-labelledby="photos-title" aria-modal="true" className="employee-modal photos-modal" role="dialog">
            <header className="modal-header"><div><span className="eyebrow">EVIDENCIA PRIVADA</span><h2 id="photos-title">{photoState.row.employeeName} · {dateLabel(photoState.row.workDate)}</h2></div><button aria-label="Cerrar" className="icon-button" onClick={() => setPhotoState(null)} type="button"><Icon name="x" /></button></header>
            {photoState.error && <p className="form-error" role="alert">{photoState.error}</p>}
            {!photoState.urls && !photoState.error && <div className="photo-loading">Generando enlaces seguros…</div>}
            {photoState.urls && <div className="report-photos">
              <figure><figcaption>Entrada · {photoState.row.checkIn}</figcaption>{photoState.urls.checkInUrl ? <PhotoEvidence alt={`Entrada de ${photoState.row.employeeName}`} url={photoState.urls.checkInUrl} /> : <span>{photoState.urls.checkInDeletedAt ? "Eliminada por retención" : "Sin fotografía"}</span>}</figure>
              <figure><figcaption>Salida · {photoState.row.checkOut ?? "En curso"}</figcaption>{photoState.urls.checkOutUrl ? <PhotoEvidence alt={`Salida de ${photoState.row.employeeName}`} url={photoState.urls.checkOutUrl} /> : <span>{photoState.urls.checkOutDeletedAt ? "Eliminada por retención" : "Sin fotografía"}</span>}</figure>
            </div>}
            <p className="photo-expiry-note"><Icon name="shield" size={14} />Los enlaces expiran automáticamente en 5 minutos.</p>
          </section>
        </div>
      )}
    </div>
  );
}

function PhotoEvidence({ alt, url }: { alt: string; url: string }) {
  // Signed Storage URLs are short-lived and intentionally bypass image optimization.
  // eslint-disable-next-line @next/next/no-img-element
  return <img alt={alt} src={url} />;
}
