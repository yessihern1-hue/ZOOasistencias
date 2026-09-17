import "server-only";

import { randomUUID } from "node:crypto";

import type { SessionUser } from "@/features/auth/types";
import type {
  AttendanceAction,
  AttendanceCoordinates,
  AttendancePageData,
  AttendanceRecord,
  AttendanceSummary,
} from "@/features/attendance/types";
import type { Employee } from "@/features/employees/types";
import { employeeRepository } from "@/server/employees/employee.repository";
import { formatLongDate, getDateKey } from "@/server/shared/date";
import {
  deleteAttendancePhoto,
  uploadAttendancePhoto,
} from "@/server/storage/attendance-photo.service";
import { attendanceRepository } from "./attendance.repository";

export class AttendanceDomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AttendanceDomainError";
  }
}

function formatSchedule(
  startTime: string | null,
  endTime: string | null,
  fallback: string
): string {
  if (!startTime || !endTime) return fallback;
  return `${startTime.slice(0, 5)} – ${endTime.slice(0, 5)}`;
}

function calculateSummary(
  records: AttendanceRecord[],
  employees: Employee[]
): AttendanceSummary {
  const activeEmployeeIds = new Set(
    employees
      .filter((employee) => employee.status === "active")
      .map((employee) => employee.id)
  );
  const byEmployee = new Map<string, AttendanceRecord[]>();

  for (const record of records) {
    if (!activeEmployeeIds.has(record.employeeId)) continue;
    const employeeRecords = byEmployee.get(record.employeeId) ?? [];
    employeeRecords.push(record);
    byEmployee.set(record.employeeId, employeeRecords);
  }

  let present = 0;
  let late = 0;

  for (const employeeRecords of byEmployee.values()) {
    if (employeeRecords.some((record) => record.status === "late")) {
      late += 1;
    } else {
      present += 1;
    }
  }

  return {
    total: activeEmployeeIds.size,
    present,
    late,
    absent: Math.max(0, activeEmployeeIds.size - byEmployee.size),
  };
}

function getScheduleForDate(
  dateKey: string,
  shift: Awaited<ReturnType<typeof attendanceRepository.findActiveShiftByAuthUser>>
): string | null {
  if (!shift) return null;

  const dayOfWeek = new Date(`${dateKey}T12:00:00Z`).getUTCDay();
  const configuredDay = shift.workShift.work_shift_days?.find(
    (day) => day.day_of_week === dayOfWeek
  );

  return formatSchedule(
    configuredDay?.start_time ?? shift.workShift.start_time,
    configuredDay?.end_time ?? shift.workShift.end_time,
    shift.workShift.name
  );
}

function extractDatabaseMessage(error: unknown): string {
  const rawMessage = error instanceof Error ? error.message : "";
  const knownMessages = [
    "El empleado no esta activo.",
    "El empleado tiene vacaciones o permiso aprobado en este momento.",
    "Ya existe una entrada abierta. Registra la salida primero.",
    "Todavia no se puede registrar otra entrada.",
    "No hay una jornada activa asignada.",
    "La jornada no tiene horario configurado para hoy.",
    "Se alcanzo el maximo de sesiones permitidas para hoy.",
    "Todavia no se puede registrar entrada para esta jornada.",
    "No hay una entrada abierta para cerrar.",
    "La ubicacion recibida no es valida.",
    "No hay una ubicacion activa configurada. Contacta al administrador.",
    "Estas fuera del area permitida para registrar asistencia.",
  ];

  return (
    knownMessages.find((message) => rawMessage.includes(message)) ??
    "No se pudo registrar la asistencia. Intenta nuevamente."
  );
}

export async function getAttendancePageData(
  authUserId: string
): Promise<AttendancePageData> {
  const dateKey = getDateKey();
  const [records, employeeShift, employees, registrationState] = await Promise.all([
    attendanceRepository.listByDate(dateKey),
    attendanceRepository.findActiveShiftByAuthUser(authUserId, dateKey),
    employeeRepository.list(),
    attendanceRepository.getMyRegistrationState(),
  ]);

  const currentUserSessions = records.filter(
    (record) => record.authUserId === authUserId
  );
  const currentUserRecord =
    currentUserSessions.find((record) => record.sessionStatus === "open") ??
    currentUserSessions[0] ??
    null;

  return {
    dateKey,
    formattedDate: formatLongDate(),
    records,
    currentUserRecord,
    currentUserSessions,
    currentUserSchedule: getScheduleForDate(dateKey, employeeShift),
    summary: calculateSummary(records, employees),
    registrationState,
  };
}

export async function registerAttendance(
  user: SessionUser,
  action: AttendanceAction,
  coordinates: AttendanceCoordinates,
  photo?: string | null,
  observation?: string | null
): Promise<{ record: AttendanceRecord; data: AttendancePageData; message: string }> {
  if (!photo) {
    throw new AttendanceDomainError(
      action === "check-in"
        ? "Debe capturar una fotografía antes de registrar la entrada."
        : "Debe capturar una fotografía antes de registrar la salida."
    );
  }

  if (
    !Number.isFinite(coordinates?.latitude) ||
    coordinates.latitude < -90 ||
    coordinates.latitude > 90 ||
    !Number.isFinite(coordinates?.longitude) ||
    coordinates.longitude < -180 ||
    coordinates.longitude > 180 ||
    !Number.isFinite(coordinates?.accuracy) ||
    coordinates.accuracy < 0 ||
    coordinates.accuracy > 10000
  ) {
    throw new AttendanceDomainError("La ubicación recibida no es válida.");
  }

  const employeeId = await attendanceRepository.findEmployeeIdByAuthUser(user.id);
  if (!employeeId) throw new AttendanceDomainError("El empleado no está activo.");

  const sessionId = action === "check-in"
    ? randomUUID()
    : await attendanceRepository.findOpenSessionId(employeeId);
  if (!sessionId) {
    throw new AttendanceDomainError("No hay una entrada abierta para cerrar.");
  }

  let photoPath: string;
  try {
    photoPath = await uploadAttendancePhoto(
      employeeId,
      getDateKey(),
      sessionId,
      action,
      photo
    );
  } catch (error) {
    const message = error instanceof Error && error.message.includes("5 MB")
      ? "La fotografía debe pesar menos de 5 MB."
      : "No se pudo guardar la fotografía. Intenta nuevamente.";
    throw new AttendanceDomainError(message);
  }

  let record: AttendanceRecord;

  try {
    record =
      action === "check-in"
        ? await attendanceRepository.clockIn(sessionId, photoPath, coordinates, observation ?? null)
        : await attendanceRepository.clockOut(photoPath, coordinates, observation ?? null);
  } catch (error) {
    try {
      await deleteAttendancePhoto(photoPath);
    } catch (cleanupError) {
      console.error("No se pudo limpiar una fotografía huérfana:", cleanupError);
    }

    throw new AttendanceDomainError(extractDatabaseMessage(error));
  }

  const registeredTime =
    action === "check-in" ? record.checkIn : record.checkOut;
  const data = await getAttendancePageData(user.id);

  return {
    record,
    data,
    message: `${action === "check-in" ? "Entrada" : "Salida"} registrada a las ${registeredTime ?? "hora del servidor"}.`,
  };
}
