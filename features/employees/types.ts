import type { AvatarTone } from "@/features/attendance/types";

export type Employee = {
  id: string;
  name: string;
  initials: string;
  avatarTone: AvatarTone;
  email: string;
  department: string;
  position: string;
  schedule: string;
  status: "active" | "vacation";
};
