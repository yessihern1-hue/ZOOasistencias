import "server-only";

import type { AttendanceReportRow } from "@/features/reports/types";
import { createSupabaseServerClient } from "@/server/supabase/client";

type EmployeeRelation = {
  id: string;
  full_name: string;
  department: string | null;
  avatar_tone: string;
};

type ShiftRelation = { id: string; name: string; timezone: string };

type ReportRow = {
  id: string;
  employee_id: string;
  work_date: string;
  session_sequence: number;
  check_in_at: string;
  check_out_at: string | null;
  arrival_status: "on_time" | "late";
  departure_status: "on_time" | "early" | null;
  session_status: AttendanceReportRow["sessionStatus"];
  worked_minutes: number | null;
  check_in_photo_path: string | null;
  check_out_photo_path: string | null;
  check_in_photo_deleted_at: string | null;
  check_out_photo_deleted_at: string | null;
  check_in_observation: string | null;
  check_out_observation: string | null;
  check_in_distance_meters: number | null;
  check_out_distance_meters: number | null;
  check_in_location: { name: string } | { name: string }[] | null;
  check_out_location: { name: string } | { name: string }[] | null;
  employees: EmployeeRelation | EmployeeRelation[] | null;
  work_shifts: ShiftRelation | ShiftRelation[] | null;
};

function first<T>(relation: T | T[] | null): T | null {
  if (!relation) return null;
  return Array.isArray(relation) ? relation[0] ?? null : relation;
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "US";
}

function time(timestamp: string | null, timezone: string) {
  if (!timestamp) return null;
  return new Intl.DateTimeFormat("es-GT", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(timestamp));
}

export const reportRepository = {
  async listSessions(from: string, to: string): Promise<AttendanceReportRow[]> {
    const supabase = await createSupabaseServerClient();
    const rows: ReportRow[] = [];
    const pageSize = 1000;
    let offset = 0;

    while (true) {
      const { data, error } = await supabase
        .from("attendance_sessions")
        .select(`
        id,
        employee_id,
        work_date,
        session_sequence,
        check_in_at,
        check_out_at,
        arrival_status,
        departure_status,
        session_status,
        worked_minutes,
        check_in_photo_path,
        check_out_photo_path,
        check_in_photo_deleted_at,
        check_out_photo_deleted_at,
        check_in_observation,
        check_out_observation,
        check_in_distance_meters,
        check_out_distance_meters,
        check_in_location:attendance_locations!attendance_sessions_check_in_location_id_fkey (name),
        check_out_location:attendance_locations!attendance_sessions_check_out_location_id_fkey (name),
        employees!attendance_sessions_employee_id_fkey (
          id,
          full_name,
          department,
          avatar_tone
        ),
        work_shifts!attendance_sessions_work_shift_id_fkey (
          id,
          name,
          timezone
        )
      `)
        .gte("work_date", from)
        .lte("work_date", to)
        .neq("session_status", "cancelled")
        .order("check_in_at", { ascending: false })
        .order("id", { ascending: false })
        .range(offset, offset + pageSize - 1);

      if (error) throw new Error(`No se pudo consultar el historial: ${error.message}`);
      const page = (data ?? []) as unknown as ReportRow[];
      rows.push(...page);
      if (page.length < pageSize) break;
      offset += pageSize;
    }

    return rows.map((row) => {
      const employee = first(row.employees);
      const shift = first(row.work_shifts);
      const employeeName = employee?.full_name ?? "Empleado";
      const timezone = shift?.timezone ?? "America/Guatemala";
      const checkInLocation = first(row.check_in_location);
      const checkOutLocation = first(row.check_out_location);
      return {
        id: row.id,
        employeeId: row.employee_id,
        employeeName,
        initials: initials(employeeName),
        avatarTone: (employee?.avatar_tone ?? "blue") as AttendanceReportRow["avatarTone"],
        department: employee?.department ?? "Sin asignar",
        shiftId: shift?.id ?? "",
        shiftName: shift?.name ?? "Sin jornada",
        workDate: row.work_date,
        sessionSequence: row.session_sequence,
        checkIn: time(row.check_in_at, timezone) ?? "—",
        checkOut: time(row.check_out_at, timezone),
        workedMinutes: row.worked_minutes ?? 0,
        arrivalStatus: row.arrival_status,
        departureStatus: row.departure_status,
        sessionStatus: row.session_status,
        hasCheckInPhoto: Boolean(row.check_in_photo_path),
        hasCheckOutPhoto: Boolean(row.check_out_photo_path),
        checkInPhotoDeletedAt: row.check_in_photo_deleted_at,
        checkOutPhotoDeletedAt: row.check_out_photo_deleted_at,
        checkInObservation: row.check_in_observation,
        checkOutObservation: row.check_out_observation,
        checkInLocationName: checkInLocation?.name ?? null,
        checkOutLocationName: checkOutLocation?.name ?? null,
        checkInDistanceMeters: row.check_in_distance_meters,
        checkOutDistanceMeters: row.check_out_distance_meters,
      };
    });
  },
};
