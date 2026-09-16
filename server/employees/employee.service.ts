import "server-only";

import { randomBytes } from "node:crypto";

import type {
  CreateEmployeeInput,
  EmployeeStatus,
  UpdateEmployeeInput,
} from "@/features/employees/types";
import { getDateKey } from "@/server/shared/date";
import { createSupabaseAdminClient } from "@/server/supabase/admin";

import { employeeRepository } from "./employee.repository";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;

export class EmployeeInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EmployeeInputError";
  }
}

export class EmployeeConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EmployeeConflictError";
  }
}

function requiredText(value: unknown, label: string, maxLength = 120) {
  if (typeof value !== "string" || !value.trim()) {
    throw new EmployeeInputError(`${label} es obligatorio.`);
  }
  const normalized = value.trim();
  if (normalized.length > maxLength) {
    throw new EmployeeInputError(`${label} no puede superar ${maxLength} caracteres.`);
  }
  return normalized;
}

function optionalText(value: unknown, maxLength = 120) {
  if (typeof value !== "string") return "";
  const normalized = value.trim();
  if (normalized.length > maxLength) {
    throw new EmployeeInputError(`Uno de los textos supera ${maxLength} caracteres.`);
  }
  return normalized;
}

function normalizeRole(value: unknown): "admin" | "employee" {
  if (value !== "admin" && value !== "employee") {
    throw new EmployeeInputError("Selecciona un rol válido.");
  }
  return value;
}

function normalizeStatus(value: unknown): EmployeeStatus {
  if (!(["active", "inactive", "vacation", "permission"] as const).includes(value as EmployeeStatus)) {
    throw new EmployeeInputError("Selecciona un estado válido.");
  }
  return value as EmployeeStatus;
}

function normalizeShiftId(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string" || !/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(value)) {
    throw new EmployeeInputError("Selecciona una jornada válida.");
  }
  return value;
}

function normalizeDate(value: unknown, label: string) {
  if (typeof value !== "string" || !datePattern.test(value)) {
    throw new EmployeeInputError(`${label} no es válida.`);
  }
  const date = new Date(`${value}T12:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new EmployeeInputError(`${label} no es válida.`);
  }
  return value;
}

function nextDate(dateKey: string) {
  const date = new Date(`${dateKey}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

function generateTemporaryPassword() {
  return `Zoo-${randomBytes(10).toString("base64url")}!7`;
}

async function assertActiveShift(shiftId: string | null) {
  if (!shiftId) return;
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("work_shifts")
    .select("id")
    .eq("id", shiftId)
    .eq("active", true)
    .maybeSingle();

  if (error) throw new Error(`No se pudo validar la jornada: ${error.message}`);
  if (!data) throw new EmployeeInputError("La jornada seleccionada ya no está activa.");
}

async function replaceShiftAssignment(employeeId: string, shiftId: string | null) {
  const admin = createSupabaseAdminClient();
  const today = getDateKey();
  const { data: current, error: currentError } = await admin
    .from("employee_shift_assignments")
    .select("id, work_shift_id")
    .eq("employee_id", employeeId)
    .eq("active", true)
    .lte("start_date", today)
    .or(`end_date.is.null,end_date.gte.${today}`)
    .order("start_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (currentError) throw new Error(`No se pudo consultar la jornada actual: ${currentError.message}`);
  if (current?.work_shift_id === shiftId) return;

  if (current) {
    const { error } = await admin
      .from("employee_shift_assignments")
      .update({ active: false, end_date: today })
      .eq("id", current.id);
    if (error) throw new Error(`No se pudo cerrar la jornada anterior: ${error.message}`);
  }

  if (shiftId) {
    const { error } = await admin.from("employee_shift_assignments").insert({
      employee_id: employeeId,
      work_shift_id: shiftId,
      start_date: today,
      active: true,
    });
    if (error) throw new Error(`No se pudo asignar la jornada: ${error.message}`);
  }
}

async function setEmployeeAbsence(
  employeeId: string,
  adminEmployeeId: string,
  status: EmployeeStatus,
  absenceStart?: unknown,
  absenceEnd?: unknown,
  reason?: unknown
) {
  const admin = createSupabaseAdminClient();
  const now = new Date().toISOString();
  const { error: cancelError } = await admin
    .from("employee_absences")
    .update({ status: "cancelled" })
    .eq("employee_id", employeeId)
    .eq("status", "approved")
    .gte("ends_at", now);

  if (cancelError) throw new Error(`No se pudo actualizar la ausencia anterior: ${cancelError.message}`);
  if (status !== "vacation" && status !== "permission") return;

  const start = normalizeDate(absenceStart, "La fecha inicial");
  const end = normalizeDate(absenceEnd, "La fecha final");
  if (end < start) throw new EmployeeInputError("La fecha final no puede ser anterior a la inicial.");

  const { error } = await admin.from("employee_absences").insert({
    employee_id: employeeId,
    absence_type: status,
    status: "approved",
    starts_at: `${start}T00:00:00-06:00`,
    ends_at: `${nextDate(end)}T00:00:00-06:00`,
    requested_by_employee_id: adminEmployeeId,
    approved_by_employee_id: adminEmployeeId,
    approved_at: now,
    reason: optionalText(reason, 300) || null,
  });
  if (error) throw new Error(`No se pudo registrar la ausencia: ${error.message}`);
}

function normalizeCreateInput(input: CreateEmployeeInput) {
  const email = requiredText(input.email, "El correo", 254).toLowerCase();
  if (!emailPattern.test(email)) throw new EmployeeInputError("Ingresa un correo válido.");

  return {
    name: requiredText(input.name, "El nombre"),
    email,
    role: normalizeRole(input.role),
    department: optionalText(input.department),
    position: optionalText(input.position),
    shiftId: normalizeShiftId(input.shiftId),
  };
}

function normalizeUpdateInput(input: UpdateEmployeeInput) {
  const status = normalizeStatus(input.status);
  const reason = optionalText(input.reason, 300);
  const absenceStart = status === "vacation" || status === "permission"
    ? normalizeDate(input.absenceStart, "La fecha inicial")
    : undefined;
  const absenceEnd = status === "vacation" || status === "permission"
    ? normalizeDate(input.absenceEnd, "La fecha final")
    : undefined;
  if (absenceStart && absenceEnd && absenceEnd < absenceStart) {
    throw new EmployeeInputError("La fecha final no puede ser anterior a la inicial.");
  }

  return {
    name: requiredText(input.name, "El nombre"),
    role: normalizeRole(input.role),
    status,
    department: optionalText(input.department),
    position: optionalText(input.position),
    shiftId: normalizeShiftId(input.shiftId),
    absenceStart,
    absenceEnd,
    reason,
  };
}

export async function getEmployees() {
  return employeeRepository.list();
}

export async function createEmployee(input: CreateEmployeeInput) {
  const values = normalizeCreateInput(input);
  await assertActiveShift(values.shiftId);
  const temporaryPassword = generateTemporaryPassword();
  const admin = createSupabaseAdminClient();
  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email: values.email,
    password: temporaryPassword,
    email_confirm: true,
    user_metadata: { full_name: values.name },
    app_metadata: { role: values.role },
  });

  if (authError || !authData.user) {
    if (authError?.code === "email_exists" || authError?.message.toLowerCase().includes("already")) {
      throw new EmployeeConflictError("Ya existe una cuenta con ese correo.");
    }
    throw new Error(`No se pudo crear la cuenta de acceso: ${authError?.message ?? "respuesta inválida"}`);
  }

  const authUserId = authData.user.id;
  const { data: employee, error: employeeError } = await admin
    .from("employees")
    .insert({
      auth_user_id: authUserId,
      full_name: values.name,
      email: values.email,
      role: values.role,
      employment_status: "active",
      department: values.department || null,
      position: values.position || null,
      hire_date: getDateKey(),
      must_change_password: true,
    })
    .select("id")
    .single();

  if (employeeError || !employee) {
    await admin.auth.admin.deleteUser(authUserId);
    if (employeeError?.code === "23505") {
      throw new EmployeeConflictError("Ya existe un colaborador con ese correo.");
    }
    throw new Error(`No se pudo crear el colaborador: ${employeeError?.message ?? "respuesta inválida"}`);
  }

  try {
    await replaceShiftAssignment(employee.id, values.shiftId);
  } catch (error) {
    await admin.from("employees").delete().eq("id", employee.id);
    await admin.auth.admin.deleteUser(authUserId);
    throw error;
  }

  return { employeeId: employee.id, temporaryPassword };
}

export async function updateEmployee(
  employeeId: string,
  input: UpdateEmployeeInput,
  currentAdminEmployeeId: string
) {
  const values = normalizeUpdateInput(input);
  await assertActiveShift(values.shiftId);
  const admin = createSupabaseAdminClient();
  const { data: current, error: currentError } = await admin
    .from("employees")
    .select("id, auth_user_id, role, employment_status")
    .eq("id", employeeId)
    .maybeSingle();

  if (currentError) throw new Error(`No se pudo consultar el colaborador: ${currentError.message}`);
  if (!current) throw new EmployeeInputError("El colaborador no existe.");

  if (
    employeeId === currentAdminEmployeeId &&
    (values.role !== "admin" || values.status === "inactive")
  ) {
    throw new EmployeeConflictError("No puedes quitar tu propio acceso administrativo.");
  }

  const employmentStatus = values.status === "inactive" ? "inactive" : "active";
  const removesActiveAdmin =
    current.role === "admin" &&
    current.employment_status === "active" &&
    (values.role !== "admin" || employmentStatus !== "active");

  if (removesActiveAdmin) {
    const { count, error } = await admin
      .from("employees")
      .select("id", { count: "exact", head: true })
      .eq("role", "admin")
      .eq("employment_status", "active")
      .neq("id", employeeId);
    if (error) throw new Error(`No se pudo validar a los administradores: ${error.message}`);
    if (!count) throw new EmployeeConflictError("Debe quedar al menos un administrador activo.");
  }

  const today = getDateKey();
  const { error: updateError } = await admin
    .from("employees")
    .update({
      full_name: values.name,
      role: values.role,
      employment_status: employmentStatus,
      department: values.department || null,
      position: values.position || null,
      termination_date: employmentStatus === "inactive" ? today : null,
      inactive_reason: employmentStatus === "inactive" ? values.reason || "Desactivado por administración" : null,
    })
    .eq("id", employeeId);
  if (updateError) throw new Error(`No se pudo actualizar el colaborador: ${updateError.message}`);

  await setEmployeeAbsence(
    employeeId,
    currentAdminEmployeeId,
    values.status,
    values.absenceStart,
    values.absenceEnd,
    values.reason
  );
  await replaceShiftAssignment(employeeId, values.shiftId);

  if (current.auth_user_id) {
    const { error: authError } = await admin.auth.admin.updateUserById(current.auth_user_id, {
      user_metadata: { full_name: values.name },
      app_metadata: { role: values.role },
      ban_duration: employmentStatus === "inactive" ? "876000h" : "none",
    });
    return {
      employeeId,
      warning: authError
        ? "Los datos se guardaron, pero la cuenta de Supabase no pudo sincronizarse."
        : undefined,
    };
  }

  return { employeeId };
}
