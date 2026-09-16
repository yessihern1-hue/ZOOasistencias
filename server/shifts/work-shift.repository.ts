import "server-only";

import type { WorkShiftOption } from "@/features/employees/types";
import { createSupabaseServerClient } from "@/server/supabase/client";

type ShiftDayRow = { day_of_week: number; start_time: string; end_time: string };
type ShiftRow = {
  id: string;
  name: string;
  start_time: string | null;
  end_time: string | null;
  work_shift_days: ShiftDayRow[] | null;
};

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
        work_shift_days (day_of_week, start_time, end_time)
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
};
