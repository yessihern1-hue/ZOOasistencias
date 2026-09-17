import type { Metadata } from "next";

import { WorkShiftsView } from "@/features/shifts/components/work-shifts-view";
import { requireAdmin } from "@/server/auth/dal";
import { getWorkShifts } from "@/server/shifts/work-shift.service";

export const metadata: Metadata = { title: "Jornadas" };

export default async function WorkShiftsPage() {
  await requireAdmin();
  return <WorkShiftsView initialShifts={await getWorkShifts()} />;
}
