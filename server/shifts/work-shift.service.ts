import "server-only";

import type { WorkShiftInput } from "@/features/shifts/types";
import type { SessionUser } from "@/features/auth/types";
import { recordAdminAuditSafely } from "@/server/audit/admin-audit.service";
import { createSupabaseServerClient } from "@/server/supabase/client";

import { workShiftRepository } from "./work-shift.repository";

const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class WorkShiftInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WorkShiftInputError";
  }
}

function integerInRange(value: unknown, label: string, minimum: number, maximum: number) {
  if (typeof value !== "number" || !Number.isInteger(value) || value < minimum || value > maximum) {
    throw new WorkShiftInputError(`${label} debe estar entre ${minimum} y ${maximum}.`);
  }
  return value;
}

function normalizeInput(input: WorkShiftInput) {
  if (typeof input?.name !== "string" || !input.name.trim() || input.name.trim().length > 120) {
    throw new WorkShiftInputError("Ingresa un nombre válido para la jornada.");
  }
  if (typeof input.timezone !== "string" || !input.timezone.trim() || input.timezone.length > 80) {
    throw new WorkShiftInputError("Selecciona una zona horaria válida.");
  }
  if (!Array.isArray(input.days) || input.days.length === 0) {
    throw new WorkShiftInputError("Configura al menos un día laboral.");
  }

  const seenDays = new Set<number>();
  const days = input.days.map((day) => {
    const dayOfWeek = integerInRange(day?.dayOfWeek, "El día", 0, 6);
    if (seenDays.has(dayOfWeek)) throw new WorkShiftInputError("No se puede repetir un día laboral.");
    seenDays.add(dayOfWeek);
    if (!timePattern.test(day?.startTime ?? "") || !timePattern.test(day?.endTime ?? "")) {
      throw new WorkShiftInputError("Uno de los horarios no es válido.");
    }
    return {
      day_of_week: dayOfWeek,
      start_time: day.startTime,
      end_time: day.endTime,
      unpaid_break_minutes: integerInRange(
        day.unpaidBreakMinutes,
        "El descanso no pagado",
        0,
        1440
      ),
    };
  });

  return {
    name: input.name.trim(),
    timezone: input.timezone.trim(),
    lateToleranceMinutes: integerInRange(input.lateToleranceMinutes, "La tolerancia de llegada", 0, 1440),
    earlyCheckinMinutes: integerInRange(input.earlyCheckinMinutes, "La entrada anticipada", 0, 1440),
    earlyDepartureToleranceMinutes: integerInRange(input.earlyDepartureToleranceMinutes, "La tolerancia de salida", 0, 1440),
    reentryDelayMinutes: integerInRange(input.reentryDelayMinutes, "La espera entre sesiones", 0, 1440),
    maxSessionsPerDay: integerInRange(input.maxSessionsPerDay, "Las sesiones diarias", 1, 10),
    days,
  };
}

export async function getActiveWorkShifts() {
  return workShiftRepository.listActive();
}

export async function getWorkShifts() {
  return workShiftRepository.listAll();
}

export async function saveWorkShift(
  shiftId: string | null,
  input: WorkShiftInput,
  actor: SessionUser
) {
  if (shiftId && !uuidPattern.test(shiftId)) throw new WorkShiftInputError("La jornada no es válida.");
  const values = normalizeInput(input);
  const before = shiftId
    ? (await workShiftRepository.listAll()).find((shift) => shift.id === shiftId) ?? null
    : null;
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("save_work_shift", {
    p_shift_id: shiftId,
    p_name: values.name,
    p_timezone: values.timezone,
    p_late_tolerance_minutes: values.lateToleranceMinutes,
    p_early_checkin_minutes: values.earlyCheckinMinutes,
    p_early_departure_tolerance_minutes: values.earlyDepartureToleranceMinutes,
    p_reentry_delay_minutes: values.reentryDelayMinutes,
    p_max_sessions_per_day: values.maxSessionsPerDay,
    p_days: values.days,
  });

  if (error) {
    const isDomainError = error.message.includes("jornada") ||
      error.message.includes("dia") ||
      error.message.includes("tolerancia") ||
      error.message.includes("sesiones") ||
      error.message.includes("zona horaria");
    if (isDomainError) throw new WorkShiftInputError(error.message);
    throw new Error(`No se pudo guardar la jornada: ${error.message}`);
  }
  const savedId = data as string;
  await recordAdminAuditSafely(actor, {
    action: shiftId ? "work_shift.updated" : "work_shift.created",
    entityType: "work_shift",
    entityId: savedId,
    entityLabel: values.name,
    beforeData: before ? {
      name: before.name,
      timezone: before.timezone,
      lateToleranceMinutes: before.lateToleranceMinutes,
      earlyCheckinMinutes: before.earlyCheckinMinutes,
      earlyDepartureToleranceMinutes: before.earlyDepartureToleranceMinutes,
      reentryDelayMinutes: before.reentryDelayMinutes,
      maxSessionsPerDay: before.maxSessionsPerDay,
      days: before.days,
      active: before.active,
    } : null,
    afterData: {
      name: values.name,
      timezone: values.timezone,
      lateToleranceMinutes: values.lateToleranceMinutes,
      earlyCheckinMinutes: values.earlyCheckinMinutes,
      earlyDepartureToleranceMinutes: values.earlyDepartureToleranceMinutes,
      reentryDelayMinutes: values.reentryDelayMinutes,
      maxSessionsPerDay: values.maxSessionsPerDay,
      days: values.days.map((day) => ({
        dayOfWeek: day.day_of_week,
        startTime: day.start_time,
        endTime: day.end_time,
        unpaidBreakMinutes: day.unpaid_break_minutes,
      })),
      active: before?.active ?? true,
    },
  });
  return savedId;
}

export async function setWorkShiftActive(
  shiftId: string,
  active: boolean,
  actor: SessionUser
) {
  if (!uuidPattern.test(shiftId)) throw new WorkShiftInputError("La jornada no es válida.");
  if (typeof active !== "boolean") throw new WorkShiftInputError("El estado no es válido.");

  const current = (await workShiftRepository.listAll()).find((shift) => shift.id === shiftId);
  if (!current) throw new WorkShiftInputError("La jornada no existe.");
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("work_shifts")
    .update({ active })
    .eq("id", shiftId)
    .select("id")
    .maybeSingle();

  if (error) throw new Error(`No se pudo cambiar el estado de la jornada: ${error.message}`);
  if (!data) throw new WorkShiftInputError("La jornada no existe.");
  await recordAdminAuditSafely(actor, {
    action: active ? "work_shift.activated" : "work_shift.deactivated",
    entityType: "work_shift",
    entityId: shiftId,
    entityLabel: current.name,
    beforeData: { active: current.active },
    afterData: { active },
  });
}
