import "server-only";

import type { WorkShiftOption } from "@/features/employees/types";
import type { WorkShift } from "@/features/shifts/types";
import { getDateKey } from "@/server/shared/date";
import { createSupabaseServerClient } from "@/server/supabase/client";

type ShiftDayRow = {
  day_of_week: number;
  start_time: string;
  end_time: string;
  unpaid_break_minutes: number;
};
type ShiftRow = {
  id: string;
  name: string;
  start_time: string | null;
  end_time: string | null;
  timezone: string;
  late_tolerance_minutes: number;
  early_checkin_minutes: number;
  early_departure_tolerance_minutes: number;
  reentry_delay_minutes: number;
  max_sessions_per_day: number;
  active: boolean;
  work_shift_days: ShiftDayRow[] | null;
};

type AssignmentRow = { work_shift_id: string };

function formatShiftSchedule(shift: ShiftRow) {
  const days = shift.work_shift_days ?? [];
  const first = days[0];
  const start = first?.start_time ?? shift.start_time;
  const end = first?.end_time ?? shift.end_time;

  if (!start || !end) return "Horario por día";
  return `${start.slice(0, 5)} – ${end.slice(0, 5)}`;
}

export const workShiftRepository = {
  async listActive(): Promise<WorkShiftOption[]> {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("work_shifts")
      .select(`
        id,
        name,
        start_time,
        end_time,
        work_shift_days (day_of_week, start_time, end_time, unpaid_break_minutes)
      `)
      .eq("active", true)
      .order("name");

    if (error) throw new Error(`No se pudieron consultar las jornadas: ${error.message}`);

    return ((data ?? []) as unknown as ShiftRow[]).map((shift) => ({
      id: shift.id,
      name: shift.name,
      schedule: formatShiftSchedule(shift),
    }));
  },

  async listAll(): Promise<WorkShift[]> {
    const supabase = await createSupabaseServerClient();
    const today = getDateKey();
    const [{ data: shifts, error: shiftsError }, { data: assignments, error: assignmentsError }] =
      await Promise.all([
        supabase
          .from("work_shifts")
          .select(`
            id,
            name,
            start_time,
            end_time,
            timezone,
            late_tolerance_minutes,
            early_checkin_minutes,
            early_departure_tolerance_minutes,
            reentry_delay_minutes,
            max_sessions_per_day,
            active,
            work_shift_days (
              day_of_week,
              start_time,
              end_time,
              unpaid_break_minutes
            )
          `)
          .order("name"),
        supabase
          .from("employee_shift_assignments")
          .select("work_shift_id")
          .eq("active", true)
          .lte("start_date", today)
          .or(`end_date.is.null,end_date.gte.${today}`),
      ]);

    if (shiftsError) throw new Error(`No se pudieron consultar las jornadas: ${shiftsError.message}`);
    if (assignmentsError) {
      throw new Error(`No se pudieron consultar las asignaciones: ${assignmentsError.message}`);
    }

    const assignmentCounts = new Map<string, number>();
    for (const assignment of (assignments ?? []) as AssignmentRow[]) {
      assignmentCounts.set(
        assignment.work_shift_id,
        (assignmentCounts.get(assignment.work_shift_id) ?? 0) + 1
      );
    }

    return ((shifts ?? []) as unknown as ShiftRow[]).map((shift) => ({
      id: shift.id,
      name: shift.name,
      timezone: shift.timezone,
      lateToleranceMinutes: shift.late_tolerance_minutes,
      earlyCheckinMinutes: shift.early_checkin_minutes,
      earlyDepartureToleranceMinutes: shift.early_departure_tolerance_minutes,
      reentryDelayMinutes: shift.reentry_delay_minutes,
      maxSessionsPerDay: shift.max_sessions_per_day,
      active: shift.active,
      days: (shift.work_shift_days ?? [])
        .map((day) => ({
          dayOfWeek: day.day_of_week,
          startTime: day.start_time.slice(0, 5),
          endTime: day.end_time.slice(0, 5),
          unpaidBreakMinutes: day.unpaid_break_minutes,
        }))
        .sort((left, right) => left.dayOfWeek - right.dayOfWeek),
      activeAssignments: assignmentCounts.get(shift.id) ?? 0,
    }));
  },
};
