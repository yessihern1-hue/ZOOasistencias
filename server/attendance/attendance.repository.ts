import "server-only";

import type { AttendanceRecord } from "@/features/attendance/types";
import { supabaseAdmin } from "@/server/supabase/admin";

type UserRelation = {
  id: string;
  name: string;
  email: string;
  role: string;
  employee_status: string;
};

type WorkShiftRelation = {
  id: string;
  name: string;
  start_time: string;
  end_time: string;
};

type AttendanceRow = {
  id: string;
  user_id: string;
  shift_id: string;
  date: string;
  check_in: string | null;
  check_out: string | null;
  check_in_photo: string | null;
  check_out_photo: string | null;
  worked_minutes: number | null;
  status: string;
  observation: string | null;

  users:
    | UserRelation
    | UserRelation[]
    | null;

  work_shifts:
    | WorkShiftRelation
    | WorkShiftRelation[]
    | null;
};

type EmployeeShiftRow = {
  shift_id: string;
  start_date: string;
  end_date: string | null;
  active: boolean;

  work_shifts: WorkShiftRelation | null;
};

function getFirstRelation<T>(
  relation: T | T[] | null
): T | null {
  if (!relation) {
    return null;
  }

  if (Array.isArray(relation)) {
    return relation[0] ?? null;
  }

  return relation;
}

function getInitials(name: string): string {
  if (!name) {
    return "";
  }

  return name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

function formatSchedule(
  startTime: string,
  endTime: string
): string {
  return `${startTime.slice(0, 5)} – ${endTime.slice(0, 5)}`;
}

function mapAttendanceRow(
  row: AttendanceRow
): AttendanceRecord {
  const user = getFirstRelation(row.users);
  const shift = getFirstRelation(row.work_shifts);

  const employeeName = user?.name ?? "";

  return {
    id: row.id,
    employeeId: row.user_id,

    employeeName,
    initials: getInitials(employeeName),
    avatarTone: "blue",

    schedule: shift
      ? formatSchedule(
          shift.start_time,
          shift.end_time
        )
      : "",

    checkIn: row.check_in,
    checkOut: row.check_out,

    checkInPhoto: row.check_in_photo,
    checkOutPhoto: row.check_out_photo,

    status:
      row.status as AttendanceRecord["status"],
  };
}

const attendanceSelect = `
  *,
  users (
    id,
    name,
    email,
    role,
    employee_status
  ),
  work_shifts (
    id,
    name,
    start_time,
    end_time
  )
`;

export const attendanceRepository = {
  async listByDate(
    dateKey: string
  ): Promise<AttendanceRecord[]> {
    const { data, error } =
      await supabaseAdmin
        .from("attendance")
        .select(attendanceSelect)
        .eq("date", dateKey)
        .order("check_in", {
          ascending: true,
        });

    if (error) {
      throw new Error(
        `Error al consultar asistencias: ${error.message}`
      );
    }

    return ((data ?? []) as AttendanceRow[]).map(
      mapAttendanceRow
    );
  },

  async findByEmployee(
    employeeId: string,
    dateKey: string
  ): Promise<AttendanceRecord | null> {
    const { data, error } =
      await supabaseAdmin
        .from("attendance")
        .select(attendanceSelect)
        .eq("user_id", employeeId)
        .eq("date", dateKey)
        .maybeSingle();

    if (error) {
      throw new Error(
        `Error al consultar la asistencia del empleado: ${error.message}`
      );
    }

    if (!data) {
      return null;
    }

    return mapAttendanceRow(
      data as AttendanceRow
    );
  },

  async findActiveShiftByEmployee(
    employeeId: string,
    dateKey: string
  ): Promise<EmployeeShiftRow | null> {
    const { data, error } =
      await supabaseAdmin
        .from("employee_shifts")
        .select(`
          shift_id,
          start_date,
          end_date,
          active,
          work_shifts (
            id,
            name,
            start_time,
            end_time
          )
        `)
        .eq("user_id", employeeId)
        .eq("active", true)
        .lte("start_date", dateKey)
        .or(
          `end_date.is.null,end_date.gte.${dateKey}`
        )
        .order("start_date", {
          ascending: false,
        })
        .limit(1)
        .maybeSingle();

    if (error) {
      throw new Error(
        `Error al consultar la jornada del empleado: ${error.message}`
      );
    }

    if (!data) {
      return null;
    }

    const row = data as {
      shift_id: string;
      start_date: string;
      end_date: string | null;
      active: boolean;

      work_shifts:
        | WorkShiftRelation
        | WorkShiftRelation[]
        | null;
    };

    return {
      shift_id: row.shift_id,
      start_date: row.start_date,
      end_date: row.end_date,
      active: row.active,
      work_shifts: getFirstRelation(
        row.work_shifts
      ),
    };
  },

  async save(
    record: AttendanceRecord,
    dateKey: string,
    shiftId: string,
    workedMinutes: number | null = null
  ): Promise<AttendanceRecord> {
    const payload = {
      id: record.id,
      user_id: record.employeeId,
      shift_id: shiftId,
      date: dateKey,

      check_in: record.checkIn,
      check_out: record.checkOut,

      check_in_photo:
        record.checkInPhoto ?? null,

      check_out_photo:
        record.checkOutPhoto ?? null,

      worked_minutes: workedMinutes,
      status: record.status,
    };

    const { data, error } =
      await supabaseAdmin
        .from("attendance")
        .upsert(payload, {
          onConflict: "user_id,date",
        })
        .select(attendanceSelect)
        .single();

    if (error) {
      throw new Error(
        `Error al guardar la asistencia: ${error.message}`
      );
    }

    return mapAttendanceRow(
      data as AttendanceRow
    );
  },
};