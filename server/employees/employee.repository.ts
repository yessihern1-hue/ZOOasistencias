import "server-only";

import type { AvatarTone } from "@/features/attendance/types";
import type { Employee, EmployeeStatus } from "@/features/employees/types";
import { getDateKey } from "@/server/shared/date";
import { createSupabaseServerClient } from "@/server/supabase/client";

type EmployeeRow = {
  id: string;
  auth_user_id: string | null;
  full_name: string;
  email: string;
  role: "admin" | "employee";
  employment_status: "active" | "inactive";
  effective_status: EmployeeStatus;
  department: string | null;
  position: string | null;
  avatar_tone: string;
  active_absence_id: string | null;
  must_change_password: boolean;
};

type ShiftDayRow = {
  day_of_week: number;
  start_time: string;
  end_time: string;
};

type ShiftRow = {
  name: string;
  start_time: string | null;
  end_time: string | null;
  work_shift_days: ShiftDayRow[] | null;
};

type AssignmentRow = {
  employee_id: string;
  work_shift_id: string;
  work_shifts: ShiftRow | ShiftRow[] | null;
};

const avatarTones: AvatarTone[] = ["blue", "purple", "orange", "green", "pink"];

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

function getAvatarTone(value: string): AvatarTone {
  return avatarTones.includes(value as AvatarTone)
    ? (value as AvatarTone)
    : "blue";
}

function formatSchedule(assignment: AssignmentRow | undefined, dateKey: string) {
  const shift = getFirstRelation(assignment?.work_shifts ?? null);
  if (!shift) return "Sin jornada";

  const dayOfWeek = new Date(`${dateKey}T12:00:00Z`).getUTCDay();
  const shiftDay = shift.work_shift_days?.find(
    (day) => day.day_of_week === dayOfWeek
  );
  const startTime = shiftDay?.start_time ?? shift.start_time;
  const endTime = shiftDay?.end_time ?? shift.end_time;

  if (!startTime || !endTime) return shift.name;
  return `${startTime.slice(0, 5)} – ${endTime.slice(0, 5)}`;
}

export const employeeRepository = {
  async list(): Promise<Employee[]> {
    const supabase = await createSupabaseServerClient();
    const dateKey = getDateKey();
    const [{ data: employees, error: employeesError }, { data: assignments, error: assignmentsError }] =
      await Promise.all([
        supabase
          .from("employee_effective_status")
          .select(`
            id,
            auth_user_id,
            full_name,
            email,
            role,
            employment_status,
            effective_status,
            department,
            position,
            avatar_tone,
            active_absence_id,
            must_change_password
          `)
          .order("full_name"),
        supabase
          .from("employee_shift_assignments")
          .select(`
            employee_id,
            work_shift_id,
            work_shifts!employee_shift_assignments_work_shift_id_fkey (
              name,
              start_time,
              end_time,
              work_shift_days (
                day_of_week,
                start_time,
                end_time
              )
            )
          `)
          .eq("active", true)
          .lte("start_date", dateKey)
          .or(`end_date.is.null,end_date.gte.${dateKey}`)
          .order("start_date", { ascending: false }),
      ]);

    if (employeesError) {
      throw new Error(`Error al consultar empleados: ${employeesError.message}`);
    }
    if (assignmentsError) {
      throw new Error(`Error al consultar jornadas asignadas: ${assignmentsError.message}`);
    }

    const assignmentByEmployee = new Map<string, AssignmentRow>();
    for (const assignment of (assignments ?? []) as unknown as AssignmentRow[]) {
      if (!assignmentByEmployee.has(assignment.employee_id)) {
        assignmentByEmployee.set(assignment.employee_id, assignment);
      }
    }

    return ((employees ?? []) as unknown as EmployeeRow[]).map((employee) => ({
      id: employee.id,
      authUserId: employee.auth_user_id,
      name: employee.full_name,
      initials: getInitials(employee.full_name),
      avatarTone: getAvatarTone(employee.avatar_tone),
      email: employee.email,
      role: employee.role,
      department: employee.department ?? "Sin asignar",
      position: employee.position ?? "Sin asignar",
      schedule: formatSchedule(assignmentByEmployee.get(employee.id), dateKey),
      shiftId: assignmentByEmployee.get(employee.id)?.work_shift_id ?? null,
      status: employee.effective_status,
      activeAbsenceId: employee.active_absence_id,
      mustChangePassword: employee.must_change_password,
    }));
  },
};
