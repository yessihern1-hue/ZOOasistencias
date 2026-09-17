import "server-only";

import type {
  AttendanceReportData,
  ReportStatusFilter,
  WeeklyEmployeeTotal,
} from "@/features/reports/types";
import { employeeRepository } from "@/server/employees/employee.repository";
import { addDays, getCurrentWeekRange } from "@/server/shared/date";
import { workShiftRepository } from "@/server/shifts/work-shift.repository";

import { reportRepository } from "./report.repository";

const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const reportStatuses: ReportStatusFilter[] = ["on_time", "late", "early", "open", "completed"];

export class ReportInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReportInputError";
  }
}

function validDate(value: string) {
  if (!datePattern.test(value)) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function getRange(from?: string | null, to?: string | null) {
  const fallback = getCurrentWeekRange();
  const normalizedFrom = from || fallback.from;
  const normalizedTo = to || fallback.to;
  if (!validDate(normalizedFrom) || !validDate(normalizedTo)) {
    throw new ReportInputError("El rango de fechas no es válido.");
  }
  if (normalizedTo < normalizedFrom) {
    throw new ReportInputError("La fecha final no puede ser anterior a la inicial.");
  }
  const days = Math.floor(
    (new Date(`${normalizedTo}T12:00:00Z`).getTime() - new Date(`${normalizedFrom}T12:00:00Z`).getTime()) /
      86_400_000
  ) + 1;
  if (days > 92) throw new ReportInputError("El reporte permite consultar hasta 92 días por vez.");
  return { from: normalizedFrom, to: normalizedTo };
}

export async function getAttendanceReport(options: {
  from?: string | null;
  to?: string | null;
  employeeId?: string | null;
  department?: string | null;
  shiftId?: string | null;
  status?: string | null;
} = {}): Promise<AttendanceReportData> {
  const range = getRange(options.from, options.to);
  const employeeId = options.employeeId?.trim() || null;
  const department = options.department?.trim() || null;
  const shiftId = options.shiftId?.trim() || null;
  const status = options.status?.trim() || null;
  if (employeeId && !uuidPattern.test(employeeId)) {
    throw new ReportInputError("El colaborador seleccionado no es válido.");
  }
  if (department && department.length > 120) {
    throw new ReportInputError("El departamento seleccionado no es válido.");
  }
  if (shiftId && !uuidPattern.test(shiftId)) {
    throw new ReportInputError("La jornada seleccionada no es válida.");
  }
  if (status && !reportStatuses.includes(status as ReportStatusFilter)) {
    throw new ReportInputError("El estado seleccionado no es válido.");
  }

  const [allRows, employees, allShifts] = await Promise.all([
    reportRepository.listSessions(range.from, range.to),
    employeeRepository.list(),
    workShiftRepository.listAll(),
  ]);
  const employeeOptions = employees.map((employee) => ({
    id: employee.id,
    name: employee.name,
    department: employee.department,
  }));
  const departments = [...new Set(employeeOptions.map((employee) => employee.department))]
    .filter((value) => value !== "Sin asignar")
    .sort((left, right) => left.localeCompare(right, "es"));
  const shifts = allShifts
    .map((shift) => ({ id: shift.id, name: shift.name }))
    .sort((left, right) => left.name.localeCompare(right.name, "es"));
  const dateColumns: string[] = [];
  for (let date = range.from; date <= range.to; date = addDays(date, 1)) {
    dateColumns.push(date);
  }

  const allowedEmployees = employeeOptions.filter((employee) =>
    (!employeeId || employee.id === employeeId) &&
    (!department || employee.department === department)
  );
  const allowedIds = new Set(allowedEmployees.map((employee) => employee.id));
  const rows = allRows.filter((row) => {
    if (!allowedIds.has(row.employeeId)) return false;
    if (shiftId && row.shiftId !== shiftId) return false;
    if (status === "on_time" && row.arrivalStatus !== "on_time") return false;
    if (status === "late" && row.arrivalStatus !== "late") return false;
    if (status === "early" && row.departureStatus !== "early") return false;
    if (status === "open" && row.sessionStatus !== "open") return false;
    if (status === "completed" && row.sessionStatus !== "completed" && row.sessionStatus !== "corrected") return false;
    return true;
  });
  const completedRows = rows.filter((row) => row.sessionStatus === "completed" || row.sessionStatus === "corrected");
  const firstEntries = rows.filter((row) => row.sessionSequence === 1);
  const lateArrivals = firstEntries.filter((row) => row.arrivalStatus === "late").length;
  const earlyDepartures = completedRows.filter((row) => row.departureStatus === "early").length;
  const workedMinutes = completedRows.reduce((total, row) => total + row.workedMinutes, 0);
  const presentEmployeeIds = new Set(rows.map((row) => row.employeeId));

  const totalByEmployee = new Map<string, WeeklyEmployeeTotal>();
  for (const employee of allowedEmployees) {
    totalByEmployee.set(employee.id, {
      employeeId: employee.id,
      employeeName: employee.name,
      department: employee.department,
      workedMinutes: 0,
      completedSessions: 0,
      attendanceDays: 0,
      lateArrivals: 0,
      earlyDepartures: 0,
      dailyMinutes: {},
    });
  }
  const attendanceDays = new Map<string, Set<string>>();
  for (const row of rows) {
    const total = totalByEmployee.get(row.employeeId);
    if (!total) continue;
    const days = attendanceDays.get(row.employeeId) ?? new Set<string>();
    days.add(row.workDate);
    attendanceDays.set(row.employeeId, days);
    if (row.sessionStatus === "completed" || row.sessionStatus === "corrected") {
      total.workedMinutes += row.workedMinutes;
      total.dailyMinutes[row.workDate] = (total.dailyMinutes[row.workDate] ?? 0) + row.workedMinutes;
      total.completedSessions += 1;
      if (row.departureStatus === "early") total.earlyDepartures += 1;
    }
    if (row.sessionSequence === 1 && row.arrivalStatus === "late") total.lateArrivals += 1;
  }
  for (const [id, days] of attendanceDays) {
    const total = totalByEmployee.get(id);
    if (total) total.attendanceDays = days.size;
  }

  return {
    ...range,
    employeeId,
    department,
    shiftId,
    status: status as ReportStatusFilter | null,
    employees: employeeOptions,
    departments,
    shifts,
    dateColumns,
    summary: {
      attendanceRate: allowedEmployees.length
        ? Math.round((presentEmployeeIds.size / allowedEmployees.length) * 100)
        : 0,
      punctualityRate: firstEntries.length
        ? Math.round(((firstEntries.length - lateArrivals) / firstEntries.length) * 100)
        : 0,
      workedMinutes,
      incidents: lateArrivals + earlyDepartures,
      presentEmployees: presentEmployeeIds.size,
    },
    weeklyTotals: [...totalByEmployee.values()].sort((left, right) =>
      right.workedMinutes - left.workedMinutes || left.employeeName.localeCompare(right.employeeName, "es")
    ),
    rows,
  };
}
