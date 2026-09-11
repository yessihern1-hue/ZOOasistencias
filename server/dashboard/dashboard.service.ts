import "server-only";

import type { DashboardData } from "@/features/dashboard/types";

import { attendanceRepository } from "@/server/attendance/attendance.repository";
import { formatLongDate, getDateKey } from "@/server/shared/date";

export async function getDashboardData(): Promise<DashboardData> {
  const dateKey = getDateKey();

  const records = await attendanceRepository.listByDate(dateKey);

  return {
    formattedDate: formatLongDate(),

    stats: [
      {
        label: "Colaboradores",
        value: 127,
        detail: "+4 este mes",
        tone: "blue",
        trend: "up",
      },
      {
        label: "Presentes hoy",
        value: 113,
        detail: "89% del equipo",
        tone: "green",
        trend: "up",
      },
      {
        label: "Llegadas tarde",
        value: 8,
        detail: "2 menos que ayer",
        tone: "amber",
        trend: "down",
      },
      {
        label: "Ausencias",
        value: 6,
        detail: "4.7% del equipo",
        tone: "red",
        trend: "neutral",
      },
    ],

    weeklyPresence: [84, 91, 88, 95, 89],

    recentAttendance: records
      .filter((record) => record.checkIn)
      .slice(0, 4)
      .map((record) => ({
        id: record.id,
        employeeName: record.employeeName,
        initials: record.initials,
        avatarTone: record.avatarTone,
        department: record.department,
        time: record.checkIn!,
        status: record.status,
      })),
  };
}