import "server-only";

import { workShiftRepository } from "./work-shift.repository";

export async function getActiveWorkShifts() {
  return workShiftRepository.listActive();
}
