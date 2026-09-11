import "server-only";

import { randomUUID } from "crypto";

import type { SessionUser } from "@/features/auth/types";
import type {
  AttendanceAction,
  AttendancePageData,
  AttendanceRecord,
  AttendanceSummary,
} from "@/features/attendance/types";

import {
  formatLongDate,
  getDateKey,
  getTime,
} from "@/server/shared/date";

import { attendanceRepository } from "./attendance.repository";

const LATE_TOLERANCE_MINUTES = 10;

export class AttendanceDomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AttendanceDomainError";
  }
}

function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);

  return hours * 60 + minutes;
}

function calculateWorkedMinutes(
  checkIn: string,
  checkOut: string
): number {
  const checkInMinutes = timeToMinutes(checkIn);
  let checkOutMinutes = timeToMinutes(checkOut);

  // Para jornadas que terminan después de medianoche
  if (checkOutMinutes < checkInMinutes) {
    checkOutMinutes += 24 * 60;
  }

  return Math.max(0, checkOutMinutes - checkInMinutes);
}

function isLateArrival(
  checkInTime: string,
  shiftStartTime: string
): boolean {
  const checkInMinutes = timeToMinutes(checkInTime);
  const shiftStartMinutes = timeToMinutes(shiftStartTime);

  return (
    checkInMinutes >
    shiftStartMinutes + LATE_TOLERANCE_MINUTES
  );
}

function formatSchedule(
  startTime: string,
  endTime: string
): string {
  return `${startTime.slice(0, 5)} – ${endTime.slice(0, 5)}`;
}

function calculateSummary(
  records: AttendanceRecord[]
): AttendanceSummary {
  const present = records.filter(
    (record) => record.status === "present"
  ).length;

  const late = records.filter(
    (record) => record.status === "late"
  ).length;

  const absent = records.filter(
    (record) => record.status === "absent"
  ).length;

  return {
    total: records.length,
    present,
    late,
    absent,
  };
}

export async function getAttendancePageData(
  userId: string
): Promise<AttendancePageData> {
  const dateKey = getDateKey();

  const records =
    await attendanceRepository.listByDate(dateKey);

  return {
    dateKey,
    formattedDate: formatLongDate(),

    records,

    currentUserRecord:
      records.find(
        (record) => record.employeeId === userId
      ) ?? null,

    summary: calculateSummary(records),
  };
}

export async function registerAttendance(
  user: SessionUser,
  action: AttendanceAction,
  photo?: string | null
): Promise<{
  record: AttendanceRecord;
  message: string;
}> {
  const dateKey = getDateKey();
  const time = getTime();

  const existing =
    await attendanceRepository.findByEmployee(
      user.id,
      dateKey
    );

  const employeeShift =
    await attendanceRepository.findActiveShiftByEmployee(
      user.id,
      dateKey
    );

  if (!employeeShift) {
    throw new AttendanceDomainError(
      "No tienes una jornada de trabajo asignada."
    );
  }

  if (!employeeShift.work_shifts) {
    throw new AttendanceDomainError(
      "La jornada asignada no tiene una configuración válida."
    );
  }

  const shift = employeeShift.work_shifts;
  const shiftId = employeeShift.shift_id;

  const schedule = formatSchedule(
    shift.start_time,
    shift.end_time
  );

  if (!photo) {
    throw new AttendanceDomainError(
      action === "check-in"
        ? "Debe capturar una fotografía antes de registrar la entrada."
        : "Debe capturar una fotografía antes de registrar la salida."
    );
  }

  // =========================
  // ENTRADA
  // =========================
  if (action === "check-in") {
    if (existing?.checkIn) {
      throw new AttendanceDomainError(
        "Tu entrada ya fue registrada hoy."
      );
    }

    const isLate = isLateArrival(
      time,
      shift.start_time
    );

    const record: AttendanceRecord = {
      id: existing?.id ?? randomUUID(),

      employeeId: user.id,
      employeeName: user.name,
      initials: user.initials,

      avatarTone: "blue",
      department: "—",

      schedule,

      checkIn: time,
      checkOut: null,

      checkInPhoto: photo,
      checkOutPhoto: null,

      status: isLate ? "late" : "present",
    };

    const savedRecord =
      await attendanceRepository.save(
        record,
        dateKey,
        shiftId,
        null
      );

    return {
      record: {
        ...savedRecord,
        employeeName: user.name,
        initials: user.initials,
        avatarTone: "blue",
        department: "—",
        schedule,
      },

      message: `Entrada registrada a las ${time}.`,
    };
  }

  // =========================
  // SALIDA
  // =========================
  if (!existing?.checkIn) {
    throw new AttendanceDomainError(
      "Primero debes registrar tu entrada."
    );
  }

  if (existing.checkOut) {
    throw new AttendanceDomainError(
      "Tu salida ya fue registrada hoy."
    );
  }

  const workedMinutes = calculateWorkedMinutes(
    existing.checkIn,
    time
  );

  const updated: AttendanceRecord = {
    ...existing,

    employeeName: user.name,
    initials: user.initials,
    avatarTone: "blue",
    department: "—",
    schedule,

    checkOut: time,
    checkOutPhoto: photo,
  };

  const savedRecord =
    await attendanceRepository.save(
      updated,
      dateKey,
      shiftId,
      workedMinutes
    );

  return {
    record: {
      ...savedRecord,
      employeeName: user.name,
      initials: user.initials,
      avatarTone: "blue",
      department: "—",
      schedule,
    },

    message: `Salida registrada a las ${time}.`,
  };
}