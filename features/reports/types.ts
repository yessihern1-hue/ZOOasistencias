import type { AvatarTone, AttendanceDepartureStatus, AttendanceSessionStatus } from "@/features/attendance/types";

export type ReportEmployeeOption = {
  id: string;
  name: string;
  department: string;
};

export type ReportShiftOption = {
  id: string;
  name: string;
};

export type ReportStatusFilter = "on_time" | "late" | "early" | "open" | "completed";

export type AttendanceReportRow = {
  id: string;
  employeeId: string;
  employeeName: string;
  initials: string;
  avatarTone: AvatarTone;
  department: string;
  shiftId: string;
  shiftName: string;
  workDate: string;
  sessionSequence: number;
  checkIn: string;
  checkOut: string | null;
  workedMinutes: number;
  arrivalStatus: "on_time" | "late";
  departureStatus: AttendanceDepartureStatus | null;
  sessionStatus: AttendanceSessionStatus;
  hasCheckInPhoto: boolean;
  hasCheckOutPhoto: boolean;
  checkInPhotoDeletedAt: string | null;
  checkOutPhotoDeletedAt: string | null;
  checkInObservation: string | null;
  checkOutObservation: string | null;
  checkInLocationName: string | null;
  checkOutLocationName: string | null;
  checkInDistanceMeters: number | null;
  checkOutDistanceMeters: number | null;
};

export type WeeklyEmployeeTotal = {
  employeeId: string;
  employeeName: string;
  department: string;
  workedMinutes: number;
  completedSessions: number;
  attendanceDays: number;
  lateArrivals: number;
  earlyDepartures: number;
  dailyMinutes: Record<string, number>;
};

export type AttendanceReportData = {
  from: string;
  to: string;
  employeeId: string | null;
  department: string | null;
  shiftId: string | null;
  status: ReportStatusFilter | null;
  employees: ReportEmployeeOption[];
  departments: string[];
  shifts: ReportShiftOption[];
  dateColumns: string[];
  summary: {
    attendanceRate: number;
    punctualityRate: number;
    workedMinutes: number;
    incidents: number;
    presentEmployees: number;
  };
  weeklyTotals: WeeklyEmployeeTotal[];
  rows: AttendanceReportRow[];
};

export type AttendancePhotoUrls = {
  checkInUrl: string | null;
  checkOutUrl: string | null;
  checkInDeletedAt: string | null;
  checkOutDeletedAt: string | null;
};
