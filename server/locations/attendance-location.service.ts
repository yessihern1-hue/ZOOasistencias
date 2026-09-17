import "server-only";

import type { AttendanceLocationInput } from "@/features/locations/types";
import type { SessionUser } from "@/features/auth/types";
import { recordAdminAuditSafely } from "@/server/audit/admin-audit.service";

import { attendanceLocationRepository } from "./attendance-location.repository";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class AttendanceLocationInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AttendanceLocationInputError";
  }
}

function finiteInRange(value: unknown, label: string, minimum: number, maximum: number) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < minimum || value > maximum) {
    throw new AttendanceLocationInputError(`${label} debe estar entre ${minimum} y ${maximum}.`);
  }
  return value;
}

function normalizeInput(input: AttendanceLocationInput): AttendanceLocationInput {
  if (typeof input?.name !== "string" || !input.name.trim() || input.name.trim().length > 120) {
    throw new AttendanceLocationInputError("Ingresa un nombre válido para la ubicación.");
  }
  const radius = finiteInRange(input.allowedRadiusMeters, "El radio permitido", 10, 10000);
  if (!Number.isInteger(radius)) {
    throw new AttendanceLocationInputError("El radio permitido debe ser un número entero.");
  }
  return {
    name: input.name.trim(),
    latitude: finiteInRange(input.latitude, "La latitud", -90, 90),
    longitude: finiteInRange(input.longitude, "La longitud", -180, 180),
    allowedRadiusMeters: radius,
  };
}

function validateId(id: string) {
  if (!uuidPattern.test(id)) throw new AttendanceLocationInputError("La ubicación no es válida.");
}

export function getAttendanceLocations() {
  return attendanceLocationRepository.list();
}

export async function saveAttendanceLocation(
  id: string | null,
  input: AttendanceLocationInput,
  actor: SessionUser
) {
  if (id) validateId(id);
  const values = normalizeInput(input);
  const before = id
    ? (await attendanceLocationRepository.list()).find((location) => location.id === id) ?? null
    : null;
  let savedId: string;
  if (id) {
    const updatedId = await attendanceLocationRepository.update(id, values);
    if (!updatedId) {
      throw new AttendanceLocationInputError("La ubicación no existe.");
    }
    savedId = updatedId;
  } else {
    savedId = await attendanceLocationRepository.create(values);
  }
  await recordAdminAuditSafely(actor, {
    action: id ? "attendance_location.updated" : "attendance_location.created",
    entityType: "attendance_location",
    entityId: savedId,
    entityLabel: values.name,
    beforeData: before ? {
      name: before.name,
      latitude: before.latitude,
      longitude: before.longitude,
      allowedRadiusMeters: before.allowedRadiusMeters,
      active: before.active,
    } : null,
    afterData: {
      name: values.name,
      latitude: values.latitude,
      longitude: values.longitude,
      allowedRadiusMeters: values.allowedRadiusMeters,
      active: before?.active ?? true,
    },
  });
  return savedId;
}

export async function setAttendanceLocationActive(
  id: string,
  active: boolean,
  actor: SessionUser
) {
  validateId(id);
  if (typeof active !== "boolean") {
    throw new AttendanceLocationInputError("El estado no es válido.");
  }

  const locations = await attendanceLocationRepository.list();
  const current = locations.find((item) => item.id === id);
  if (!current) throw new AttendanceLocationInputError("La ubicación no existe.");

  if (!active) {
    if (current.active && locations.filter((item) => item.active).length === 1) {
      throw new AttendanceLocationInputError(
        "Debe permanecer al menos una ubicación activa para registrar asistencia."
      );
    }
  }

  if (!await attendanceLocationRepository.setActive(id, active)) {
    throw new AttendanceLocationInputError("La ubicación no existe.");
  }
  await recordAdminAuditSafely(actor, {
    action: active ? "attendance_location.activated" : "attendance_location.deactivated",
    entityType: "attendance_location",
    entityId: id,
    entityLabel: current.name,
    beforeData: { active: current.active },
    afterData: { active },
  });
}
