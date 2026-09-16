export type AttendanceStatus =
  | "present"
  | "late"
  | "absent"
  | "pending";

export type AttendanceSessionStatus =
  | "open"
  | "completed"
  | "corrected"
  | "cancelled";

export type AttendanceDepartureStatus = "on_time" | "early";

export type AttendanceAvailability =
  | "ready"
  | "working"
  | "cooldown"
  | "completed"
  | "blocked";

export type AvatarTone =
  | "blue"
  | "purple"
  | "orange"
  | "green"
  | "pink";

export type AttendanceRecord = {
  id: string;
  employeeId: string;
  authUserId: string | null;
  employeeName: string;
  initials: string;
  avatarTone: AvatarTone;
  schedule: string;
  checkIn: string | null;
  checkOut: string | null;
  checkInPhoto: string | null;
  checkOutPhoto: string | null;
  status: AttendanceStatus;
  sessionSequence: number;
  sessionStatus: AttendanceSessionStatus;
  workedMinutes: number | null;
  nextAllowedCheckInAt: string | null;
  departureStatus: AttendanceDepartureStatus | null;
  checkInObservation: string | null;
  checkOutObservation: string | null;
};

export type AttendanceRegistrationState = {
  availability: AttendanceAvailability;
  nextAction: AttendanceAction | null;
  sessionCount: number;
  maxSessions: number;
  reentryDelayMinutes: number;
  nextAllowedCheckInAt: string | null;
  serverNow: string;
  message: string;
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
  currentUserSessions: AttendanceRecord[];
  currentUserSchedule: string | null;
  summary: AttendanceSummary;
  registrationState: AttendanceRegistrationState;
};

export type AttendanceAction =
  | "check-in"
  | "check-out";

export type AttendanceMutationResponse = {
  record?: AttendanceRecord;
  data?: AttendancePageData;
  message?: string;
  error?: string;
};
