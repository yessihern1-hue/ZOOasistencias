import "server-only";

import type { DashboardData } from "@/features/dashboard/types";

import { attendanceRepository } from "@/server/attendance/attendance.repository";
import { employeeRepository } from "@/server/employees/employee.repository";
import { addDays, formatLongDate, getCurrentWeekRange, getDateKey } from "@/server/shared/date";

export async function getDashboardData(): Promise<DashboardData> {
  const dateKey = getDateKey();
  const week = getCurrentWeekRange();
  const weekdays = Array.from({ length: 5 }, (_, index) => addDays(week.from, index));

  const [records, weeklyRecords, employees] = await Promise.all([
    attendanceRepository.listByDate(dateKey),
    attendanceRepository.listByRange(week.from, addDays(week.from, 4)),
    employeeRepository.list(),
  ]);
  const latestByEmployee = new Map<string, (typeof records)[number]>();
  for (const record of records) {
    if (!latestByEmployee.has(record.employeeId)) {
      latestByEmployee.set(record.employeeId, record);
    }
  }
  const activeEmployees = employees.filter((employee) => employee.status === "active");
  const activeEmployeeIds = new Set(activeEmployees.map((employee) => employee.id));
  const attendedEmployeeIds = new Set(
    records.filter((record) => activeEmployeeIds.has(record.employeeId)).map((record) => record.employeeId)
  );
  const lateEmployeeIds = new Set(
    records
      .filter((record) => activeEmployeeIds.has(record.employeeId) && record.status === "late")
      .map((record) => record.employeeId)
  );
  const absentEmployees = activeEmployees.filter(
    (employee) => !attendedEmployeeIds.has(employee.id)
  ).length;
  const attendanceRate = activeEmployees.length
    ? Math.round((attendedEmployeeIds.size / activeEmployees.length) * 100)
    : 0;
  const weeklyPresence = weekdays.map((day) => {
    const present = new Set(
      weeklyRecords
        .filter((record) => record.workDate === day && activeEmployeeIds.has(record.employeeId))
        .map((record) => record.employeeId)
    ).size;
    return activeEmployees.length ? Math.round((present / activeEmployees.length) * 100) : 0;
  });
  const elapsedPresence = weeklyPresence.filter((_, index) => weekdays[index] <= dateKey);
  const weeklyPresenceAverage = elapsedPresence.length
    ? Math.round(elapsedPresence.reduce((total, value) => total + value, 0) / elapsedPresence.length)
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

    weeklyPresence,
    weeklyPresenceAverage,

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
