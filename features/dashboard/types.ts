import type { AvatarTone, AttendanceStatus } from "@/features/attendance/types";

export type DashboardStat = {
  label: string;
  value: number;
  detail: string;
  tone: "blue" | "green" | "amber" | "red";
  trend: "up" | "down" | "neutral";
};

export type RecentAttendanceItem = {
  id: string;
  employeeName: string;
  initials: string;
  avatarTone: AvatarTone;
  department: string;
  time: string;
  status: AttendanceStatus;
};

export type DashboardData = {
  stats: DashboardStat[];
  weeklyPresence: number[];
  recentAttendance: RecentAttendanceItem[];
  formattedDate: string;
};
