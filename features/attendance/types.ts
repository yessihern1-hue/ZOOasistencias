export type AttendanceStatus =
  | "present"
  | "late"
  | "absent"
  | "pending";

export type AvatarTone =
  | "blue"
  | "purple"
  | "orange"
  | "green"
  | "pink";

export type AttendanceRecord = {
  id: string;
  employeeId: string;
  employeeName: string;
  initials: string;
  avatarTone: AvatarTone;
  schedule: string;
  checkIn: string | null;
  checkOut: string | null;
  checkInPhoto: string | null;
  checkOutPhoto: string | null;
  status: AttendanceStatus;
};

export type AttendanceSummary = {
  total: number;
  present: number;
  late: number;
  absent: number;
};

export type AttendancePageData = {
  dateKey: string;
  formattedDate: string;
  records: AttendanceRecord[];
  currentUserRecord: AttendanceRecord | null;
  currentUserSchedule: string | null;
  summary: AttendanceSummary;
};

export type AttendanceAction =
  | "check-in"
  | "check-out";

export type AttendanceMutationResponse = {
  record?: AttendanceRecord;
  message?: string;
  error?: string;
};
