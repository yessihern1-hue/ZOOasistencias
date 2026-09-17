export type WorkShiftDay = {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  unpaidBreakMinutes: number;
};

export type WorkShift = {
  id: string;
  name: string;
  timezone: string;
  lateToleranceMinutes: number;
  earlyCheckinMinutes: number;
  earlyDepartureToleranceMinutes: number;
  reentryDelayMinutes: number;
  maxSessionsPerDay: number;
  active: boolean;
  days: WorkShiftDay[];
  activeAssignments: number;
};

export type WorkShiftInput = Omit<WorkShift, "id" | "active" | "activeAssignments">;
