import "server-only";

import type {
  AttendanceRecord,
  AttendanceRegistrationState,
  AttendanceSessionStatus,
} from "@/features/attendance/types";
import { createSupabaseServerClient } from "@/server/supabase/client";

type EmployeeRelation = {
  id: string;
  auth_user_id: string | null;
  full_name: string;
  avatar_tone: string;
};

type WorkShiftDayRelation = {
  day_of_week: number;
  start_time: string;
  end_time: string;
};

type WorkShiftRelation = {
  id: string;
  name: string;
  timezone: string;
  start_time: string | null;
  end_time: string | null;
  early_checkin_minutes: number;
  reentry_delay_minutes: number;
  max_sessions_per_day: number;
  work_shift_days: WorkShiftDayRelation[] | null;
};

type AttendanceSessionRow = {
  id: string;
  employee_id: string;
  work_date: string;
  session_sequence: number;
  check_in_at: string;
  check_out_at: string | null;
  check_in_photo_path: string | null;
  check_out_photo_path: string | null;
  arrival_status: "on_time" | "late";
  session_status: AttendanceSessionStatus;
  worked_minutes: number | null;
  next_allowed_check_in_at: string | null;
  departure_status: "on_time" | "early" | null;
  check_in_observation: string | null;
  check_out_observation: string | null;
  employees: EmployeeRelation | EmployeeRelation[] | null;
  work_shifts: WorkShiftRelation | WorkShiftRelation[] | null;
};

type EmployeeShiftAssignmentRow = {
  id: string;
  work_shift_id: string;
  start_date: string;
  end_date: string | null;
  work_shifts: WorkShiftRelation | WorkShiftRelation[] | null;
};

export type ActiveEmployeeShift = {
  assignmentId: string;
  shiftId: string;
  startDate: string;
  endDate: string | null;
  workShift: WorkShiftRelation;
};

const attendanceSelect = `
  id,
  employee_id,
  work_date,
  session_sequence,
  check_in_at,
  check_out_at,
  check_in_photo_path,
  check_out_photo_path,
  arrival_status,
  session_status,
  worked_minutes,
  next_allowed_check_in_at,
  departure_status,
  check_in_observation,
  check_out_observation,
  employees!attendance_sessions_employee_id_fkey (
    id,
    auth_user_id,
    full_name,
    avatar_tone
  ),
  work_shifts!attendance_sessions_work_shift_id_fkey (
    id,
    name,
    timezone,
    start_time,
    end_time,
    early_checkin_minutes,
    reentry_delay_minutes,
    max_sessions_per_day,
    work_shift_days (
      day_of_week,
      start_time,
      end_time
    )
  )
`;

function getFirstRelation<T>(relation: T | T[] | null): T | null {
  if (!relation) return null;
  if (Array.isArray(relation)) return relation[0] ?? null;
  return relation;
}

function getInitials(name: string): string {
  return (
    name
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join("") || "US"
  );
}

function getDayOfWeek(dateKey: string): number {
  return new Date(`${dateKey}T12:00:00Z`).getUTCDay();
}

function formatTime(timestamp: string | null, timeZone: string): string | null {
  if (!timestamp) return null;

  return new Intl.DateTimeFormat("es-GT", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(timestamp));
}

function formatSchedule(shift: WorkShiftRelation, dateKey: string): string {
  const configuredDay = shift.work_shift_days?.find(
    (day) => day.day_of_week === getDayOfWeek(dateKey)
  );
  const startTime = configuredDay?.start_time ?? shift.start_time;
  const endTime = configuredDay?.end_time ?? shift.end_time;

  if (!startTime || !endTime) return shift.name;
  return `${startTime.slice(0, 5)} – ${endTime.slice(0, 5)}`;
}

function mapAttendanceRow(row: AttendanceSessionRow): AttendanceRecord {
  const employee = getFirstRelation(row.employees);
  const shift = getFirstRelation(row.work_shifts);
  const employeeName = employee?.full_name ?? "Empleado";
  const timeZone = shift?.timezone ?? "America/Guatemala";

  return {
    id: row.id,
    employeeId: row.employee_id,
    authUserId: employee?.auth_user_id ?? null,
    employeeName,
    initials: getInitials(employeeName),
    avatarTone: (employee?.avatar_tone ?? "blue") as AttendanceRecord["avatarTone"],
    schedule: shift ? formatSchedule(shift, row.work_date) : "",
    checkIn: formatTime(row.check_in_at, timeZone),
    checkOut: formatTime(row.check_out_at, timeZone),
    checkInPhoto: row.check_in_photo_path,
    checkOutPhoto: row.check_out_photo_path,
    status: row.arrival_status === "late" ? "late" : "present",
    sessionSequence: row.session_sequence,
    sessionStatus: row.session_status,
    workedMinutes: row.worked_minutes,
    nextAllowedCheckInAt: row.next_allowed_check_in_at,
    departureStatus: row.departure_status,
    checkInObservation: row.check_in_observation,
    checkOutObservation: row.check_out_observation,
  };
}

function throwRepositoryError(context: string, message: string): never {
  throw new Error(`${context}: ${message}`);
}

export const attendanceRepository = {
  async listByDate(dateKey: string): Promise<AttendanceRecord[]> {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("attendance_sessions")
      .select(attendanceSelect)
      .eq("work_date", dateKey)
      .neq("session_status", "cancelled")
      .order("check_in_at", { ascending: false });

    if (error) {
      throwRepositoryError("Error al consultar asistencias", error.message);
    }

    return ((data ?? []) as unknown as AttendanceSessionRow[]).map(
      mapAttendanceRow
    );
  },

  async findActiveShiftByAuthUser(
    authUserId: string,
    dateKey: string
  ): Promise<ActiveEmployeeShift | null> {
    const supabase = await createSupabaseServerClient();
    const { data: employee, error: employeeError } = await supabase
      .from("employees")
      .select("id")
      .eq("auth_user_id", authUserId)
      .maybeSingle();

    if (employeeError) {
      throwRepositoryError(
        "Error al consultar el empleado autenticado",
        employeeError.message
      );
    }
    if (!employee) return null;

    const { data, error } = await supabase
      .from("employee_shift_assignments")
      .select(`
        id,
        work_shift_id,
        start_date,
        end_date,
        work_shifts!employee_shift_assignments_work_shift_id_fkey (
          id,
          name,
          timezone,
          start_time,
          end_time,
          early_checkin_minutes,
          reentry_delay_minutes,
          max_sessions_per_day,
          work_shift_days (
            day_of_week,
            start_time,
            end_time
          )
        )
      `)
      .eq("employee_id", employee.id)
      .eq("active", true)
      .lte("start_date", dateKey)
      .or(`end_date.is.null,end_date.gte.${dateKey}`)
      .order("start_date", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      throwRepositoryError("Error al consultar la jornada", error.message);
    }
    if (!data) return null;

    const row = data as unknown as EmployeeShiftAssignmentRow;
    const workShift = getFirstRelation(row.work_shifts);
    if (!workShift) return null;

    return {
      assignmentId: row.id,
      shiftId: row.work_shift_id,
      startDate: row.start_date,
      endDate: row.end_date,
      workShift,
    };
  },

  async clockIn(photoPath: string, observation: string | null = null) {
    return this.registerWithRpc("clock_in", photoPath, observation);
  },

  async clockOut(photoPath: string, observation: string | null = null) {
    return this.registerWithRpc("clock_out", photoPath, observation);
  },

  async getMyRegistrationState(): Promise<AttendanceRegistrationState> {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc("get_my_attendance_state");

    if (error) {
      throwRepositoryError(
        "Error al consultar el estado de la jornada",
        error.message
      );
    }

    const state = (Array.isArray(data) ? data[0] : data) as {
      availability?: AttendanceRegistrationState["availability"];
      next_action?: AttendanceRegistrationState["nextAction"];
      session_count?: number;
      max_sessions?: number;
      reentry_delay_minutes?: number;
      next_allowed_check_in_at?: string | null;
      server_now?: string;
      message?: string;
    } | null;

    if (!state?.availability || !state.server_now || !state.message) {
      throw new Error("Supabase no devolvió un estado de jornada válido.");
    }

    return {
      availability: state.availability,
      nextAction: state.next_action ?? null,
      sessionCount: state.session_count ?? 0,
      maxSessions: state.max_sessions ?? 0,
      reentryDelayMinutes: state.reentry_delay_minutes ?? 0,
      nextAllowedCheckInAt: state.next_allowed_check_in_at ?? null,
      serverNow: state.server_now,
      message: state.message,
    };
  },

  async registerWithRpc(
    functionName: "clock_in" | "clock_out",
    photoPath: string,
    observation: string | null
  ): Promise<AttendanceRecord> {
    const supabase = await createSupabaseServerClient();
    const { data: rpcData, error: rpcError } = await supabase.rpc(functionName, {
      p_photo_path: photoPath,
      p_observation: observation,
    });

    if (rpcError) {
      throwRepositoryError("No se pudo registrar la asistencia", rpcError.message);
    }

    const result = Array.isArray(rpcData) ? rpcData[0] : rpcData;
    const sessionId = result?.id;
    if (!sessionId) {
      throw new Error("Supabase no devolvió la sesión de asistencia creada.");
    }

    const { data, error } = await supabase
      .from("attendance_sessions")
      .select(attendanceSelect)
      .eq("id", sessionId)
      .single();

    if (error) {
      throwRepositoryError(
        "La asistencia se guardó, pero no pudo recuperarse",
        error.message
      );
    }

    return mapAttendanceRow(data as unknown as AttendanceSessionRow);
  },
};
