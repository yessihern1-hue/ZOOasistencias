import "server-only";

import type { AttendanceRecord } from "@/features/attendance/types";
import { createSupabaseServerClient } from "@/server/supabase/client";

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
};

type EmployeeShiftRow = {
  shift_id: string;
  start_date: string;
  end_date: string | null;
  active: boolean;
  work_shifts: {
    id: string;
    name: string;
    start_time: string;
    end_time: string;
  } | null;
};

function mapAttendanceRow(row: AttendanceRow): AttendanceRecord {
  return {
    id: row.id,
    employeeId: row.user_id,

    // Estos datos se completarán luego con users
    employeeName: "",
    initials: "",
    avatarTone: "blue",
    department: "",

    schedule: "",
    checkIn: row.check_in,
    checkOut: row.check_out,
    checkInPhoto: row.check_in_photo,
    checkOutPhoto: row.check_out_photo,

    status: row.status as AttendanceRecord["status"],
  };
}

export const attendanceRepository = {
  async listByDate(dateKey: string): Promise<AttendanceRecord[]> {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("attendance")
      .select("*")
      .eq("date", dateKey)
      .order("check_in", { ascending: true });

    if (error) {
      throw new Error(
        `Error al consultar asistencias: ${error.message}`
      );
    }

    return ((data ?? []) as AttendanceRow[]).map(mapAttendanceRow);
  },

  async findByEmployee(
    employeeId: string,
    dateKey: string
  ): Promise<AttendanceRecord | null> {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("attendance")
      .select("*")
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

    return mapAttendanceRow(data as AttendanceRow);
  },

  async findActiveShiftByEmployee(
    employeeId: string,
    dateKey: string
  ): Promise<EmployeeShiftRow | null> {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
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
      .or(`end_date.is.null,end_date.gte.${dateKey}`)
      .order("start_date", { ascending: false })
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
        | {
            id: string;
            name: string;
            start_time: string;
            end_time: string;
          }
        | {
            id: string;
            name: string;
            start_time: string;
            end_time: string;
          }[]
        | null;
    };

    const workShift = Array.isArray(row.work_shifts)
      ? row.work_shifts[0] ?? null
      : row.work_shifts;

    return {
      shift_id: row.shift_id,
      start_date: row.start_date,
      end_date: row.end_date,
      active: row.active,
      work_shifts: workShift,
    };
  },

  async save(
    record: AttendanceRecord,
    dateKey: string,
    shiftId: string,
    workedMinutes: number | null = null
  ): Promise<AttendanceRecord> {
    const supabase = await createSupabaseServerClient();
    const payload = {
      id: record.id,
      user_id: record.employeeId,
      shift_id: shiftId,
      date: dateKey,
      check_in: record.checkIn,
      check_out: record.checkOut,
      check_in_photo: record.checkInPhoto ?? null,
      check_out_photo: record.checkOutPhoto ?? null,
      worked_minutes: workedMinutes,
      status: record.status,
    };

    const { data, error } = await supabase
      .from("attendance")
      .upsert(payload, {
        onConflict: "user_id,date",
      })
      .select()
      .single();

    if (error) {
      throw new Error(
        `Error al guardar la asistencia: ${error.message}`
      );
    }

    return mapAttendanceRow(data as AttendanceRow);
  },
};
