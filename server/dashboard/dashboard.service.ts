import "server-only";

import type { DashboardData } from "@/features/dashboard/types";

import { attendanceRepository } from "@/server/attendance/attendance.repository";
import { employeeRepository } from "@/server/employees/employee.repository";
import { formatLongDate, getDateKey } from "@/server/shared/date";

export async function getDashboardData(): Promise<DashboardData> {
  const dateKey = getDateKey();

  const [records, employees] = await Promise.all([
    attendanceRepository.listByDate(dateKey),
    employeeRepository.list(),
  ]);
  const latestByEmployee = new Map<string, (typeof records)[number]>();
  for (const record of records) {
    if (!latestByEmployee.has(record.employeeId)) {
      latestByEmployee.set(record.employeeId, record);
    }
  }
  const attendedEmployeeIds = new Set(records.map((record) => record.employeeId));
  const lateEmployeeIds = new Set(
    records.filter((record) => record.status === "late").map((record) => record.employeeId)
  );
  const activeEmployees = employees.filter((employee) => employee.status === "active");
  const absentEmployees = activeEmployees.filter(
    (employee) => !attendedEmployeeIds.has(employee.id)
  ).length;
  const attendanceRate = activeEmployees.length
    ? Math.round((attendedEmployeeIds.size / activeEmployees.length) * 100)
    : 0;

  return {
    formattedDate: formatLongDate(),

    stats: [
      {
        label: "Colaboradores",
        value: employees.length,
        detail: `${activeEmployees.length} activos`,
        tone: "blue",
        trend: "up",
      },
      {
        label: "Presentes hoy",
        value: attendedEmployeeIds.size,
        detail: `${attendanceRate}% del equipo`,
        tone: "green",
        trend: "up",
      },
      {
        label: "Llegadas tarde",
        value: lateEmployeeIds.size,
        detail: "Registradas hoy",
        tone: "amber",
        trend: "down",
      },
      {
        label: "Ausencias",
        value: absentEmployees,
        detail: "Sin registro hoy",
        tone: "red",
        trend: "neutral",
      },
    ],

    weeklyPresence: [84, 91, 88, 95, 89],

    recentAttendance: [...latestByEmployee.values()]
      .filter((record) => record.checkIn)
      .slice(0, 4)
      .map((record) => ({
        id: record.id,
        employeeName: record.employeeName,
        initials: record.initials,
        avatarTone: record.avatarTone,
        time: record.checkIn!,
        status: record.status,
      })),
  };
}
