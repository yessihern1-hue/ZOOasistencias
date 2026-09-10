import "server-only";

import type { SessionUser } from "@/features/auth/types";
import type {
  AttendanceAction,
  AttendancePageData,
  AttendanceRecord,
  AttendanceSummary,
} from "@/features/attendance/types";
import { formatLongDate, getDateKey, getTime } from "@/server/shared/date";

import { attendanceRepository } from "./attendance.repository";

export class AttendanceDomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AttendanceDomainError";
  }
}

function calculateSummary(records: AttendanceRecord[]): AttendanceSummary {
  const currentUserRecord = records.find((item) => item.employeeId === "usr-andrea");
  const checkedIn = Boolean(currentUserRecord?.checkIn);

  return {
    total: 127,
    present: 113 + (checkedIn && currentUserRecord?.status === "present" ? 1 : 0),
    late: 8 + (checkedIn && currentUserRecord?.status === "late" ? 1 : 0),
    absent: 6 - (checkedIn ? 1 : 0),
  };
}

export function getAttendancePageData(userId: string): AttendancePageData {
  const dateKey = getDateKey();
  const records = attendanceRepository.listByDate(dateKey);

  return {
    dateKey,
    formattedDate: formatLongDate(),
    records,
    currentUserRecord:
      records.find((record) => record.employeeId === userId) ?? null,
    summary: calculateSummary(records),
  };
}

export function registerAttendance(user: SessionUser, action: AttendanceAction,photo?: string | null): { record: AttendanceRecord; message: string;}
 {
  const dateKey = getDateKey();
  const existing = attendanceRepository.findByEmployee(user.id, dateKey);
  const time = getTime();

  if (!photo) {
  throw new AttendanceDomainError(
    "Debe capturar una fotografía antes de registrar la asistencia."
  );
}

  if (action === "check-in") {
    if (existing?.checkIn) {
      throw new AttendanceDomainError("Tu entrada ya fue registrada hoy.");
    }

    const isLate = time > "08:10";
    const record: AttendanceRecord = {
      id: existing?.id ?? `att-${user.id}-${dateKey}`,
      employeeId: user.id,
      employeeName: user.name,
      initials: user.initials,
      avatarTone: "blue",
      department: "Dirección",
      schedule: "08:00 – 17:00",
      checkIn: time,
      checkOut: null,
      status: isLate ? "late" : "present",
      checkInPhoto:  photo,
      checkOutPhoto: null,
      
    };

    return {
      record: attendanceRepository.save(record, dateKey),
      message: `Entrada registrada a las ${time}.`,
    };
  }

  if (!existing?.checkIn) {
    throw new AttendanceDomainError("Primero debes registrar tu entrada.");
  }
  if (existing.checkOut) {
    throw new AttendanceDomainError("Tu salida ya fue registrada hoy.");
  }

  const updated = { ...existing, checkOut: time,checkOutPhoto: photo ?? null,};
  return {
    record: attendanceRepository.save(updated, dateKey),
    message: `Salida registrada a las ${time}.`,
  };
}
