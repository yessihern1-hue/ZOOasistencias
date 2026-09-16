"use client";

import { type FormEvent, useMemo, useState } from "react";

import type {
  Employee,
  EmployeeStatus,
  WorkShiftOption,
} from "@/features/employees/types";
import { Avatar } from "@/features/shared/components/avatar";
import { Icon } from "@/features/shared/components/icon";

const statusLabels: Record<EmployeeStatus, string> = {
  active: "Activo",
  inactive: "Inactivo",
  vacation: "Vacaciones",
  permission: "Permiso",
};

type ModalState = { mode: "create"; employee: null } | { mode: "edit"; employee: Employee };

type EmployeeMutationResponse = {
  employees?: Employee[];
  temporaryPassword?: string;
  error?: string;
};

function todayKey() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Guatemala",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function EmployeesView({
  initialEmployees,
  shifts,
}: {
  initialEmployees: Employee[];
  shifts: WorkShiftOption[];
}) {
  const [employees, setEmployees] = useState(initialEmployees);
  const [modal, setModal] = useState<ModalState | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | EmployeeStatus>("all");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [temporaryPassword, setTemporaryPassword] = useState("");
  const [passwordCopied, setPasswordCopied] = useState(false);

  const filteredEmployees = useMemo(() => {
    const query = search.trim().toLowerCase();
    return employees.filter((employee) => {
      const matchesSearch = !query ||
        employee.name.toLowerCase().includes(query) ||
        employee.email.toLowerCase().includes(query) ||
        employee.department.toLowerCase().includes(query);
      const matchesStatus = statusFilter === "all" || employee.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [employees, search, statusFilter]);

  const activeEmployees = employees.filter((employee) => employee.status === "active").length;
  const absentEmployees = employees.filter(
    (employee) => employee.status === "vacation" || employee.status === "permission"
  ).length;

  function openCreate() {
    setError("");
    setTemporaryPassword("");
    setPasswordCopied(false);
    setModal({ mode: "create", employee: null });
  }

  function openEdit(employee: Employee) {
    setError("");
    setTemporaryPassword("");
    setModal({ mode: "edit", employee });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!modal) return;
    setIsSaving(true);
    setError("");

    const form = new FormData(event.currentTarget);
    const body = {
      name: form.get("name"),
      email: form.get("email"),
      role: form.get("role"),
      department: form.get("department"),
      position: form.get("position"),
      shiftId: form.get("shiftId") || null,
      status: form.get("status"),
      absenceStart: form.get("absenceStart"),
      absenceEnd: form.get("absenceEnd"),
      reason: form.get("reason"),
    };
    const url = modal.mode === "create"
      ? "/api/v1/employees"
      : `/api/v1/employees/${modal.employee.id}`;

    try {
      const response = await fetch(url, {
        method: modal.mode === "create" ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = (await response.json()) as EmployeeMutationResponse;
      if (!response.ok) {
        setError(result.error ?? "No se pudieron guardar los cambios.");
        return;
      }

      if (result.employees) setEmployees(result.employees);
      if (result.temporaryPassword) {
        setTemporaryPassword(result.temporaryPassword);
      } else {
        setModal(null);
      }
    } catch {
      setError("No hay conexión con el servidor. Intenta nuevamente.");
    } finally {
      setIsSaving(false);
    }
  }

  async function copyPassword() {
    await navigator.clipboard.writeText(temporaryPassword);
    setPasswordCopied(true);
  }

  return (
    <div className="page-stack">
      <header className="page-heading heading-with-action">
        <div>
          <span className="eyebrow">GESTIÓN DE EQUIPO</span>
          <h1>Colaboradores</h1>
          <p>Crea cuentas, asigna jornadas y administra el estado de tu equipo.</p>
        </div>
        <button className="button button-primary" onClick={openCreate} type="button">
          <span className="button-plus">+</span>Nuevo colaborador
        </button>
      </header>

      <section className="directory-stats">
        <article className="panel directory-stat"><span className="stat-icon stat-blue"><Icon name="users" /></span><div><strong>{employees.length}</strong><small>Total colaboradores</small></div></article>
        <article className="panel directory-stat"><span className="stat-icon stat-green"><Icon name="check" /></span><div><strong>{activeEmployees}</strong><small>Activos</small></div></article>
        <article className="panel directory-stat"><span className="stat-icon stat-amber"><Icon name="calendar" /></span><div><strong>{absentEmployees}</strong><small>Vacaciones o permiso</small></div></article>
      </section>

      <section className="panel recent-panel">
        <div className="directory-toolbar">
          <label className="directory-search"><Icon name="search" size={17} /><input aria-label="Buscar colaborador" onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por nombre, correo o departamento…" value={search} /></label>
          <select aria-label="Filtrar por estado" className="filter-select" onChange={(event) => setStatusFilter(event.target.value as "all" | EmployeeStatus)} value={statusFilter}>
            <option value="all">Todos los estados</option>
            <option value="active">Activos</option>
            <option value="inactive">Inactivos</option>
            <option value="vacation">Vacaciones</option>
            <option value="permission">Permisos</option>
          </select>
        </div>
        <div className="table-scroll">
          <table className="data-table employee-table">
            <thead><tr><th>COLABORADOR</th><th>PUESTO</th><th>DEPARTAMENTO</th><th>JORNADA</th><th>ROL</th><th>ESTADO</th><th /></tr></thead>
            <tbody>
              {filteredEmployees.map((employee) => (
                <tr key={employee.id}>
                  <td><div className="person-cell"><Avatar initials={employee.initials} tone={employee.avatarTone} /><span><strong>{employee.name}</strong><small>{employee.email}</small></span></div></td>
                  <td>{employee.position}</td>
                  <td>{employee.department}</td>
                  <td>{employee.schedule}</td>
                  <td>{employee.role === "admin" ? "Administrador" : "Empleado"}</td>
                  <td><span className={`status-badge status-${employee.status === "active" ? "present" : employee.status === "inactive" ? "absent" : "late"}`}>{statusLabels[employee.status]}</span></td>
                  <td><button className="table-action" onClick={() => openEdit(employee)} type="button">Editar</button></td>
                </tr>
              ))}
              {!filteredEmployees.length && (
                <tr><td className="empty-table" colSpan={7}>No hay colaboradores que coincidan con el filtro.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <footer className="table-footer"><span>Mostrando {filteredEmployees.length} de {employees.length} colaboradores</span></footer>
      </section>

      {modal && (
        <div className="modal-backdrop" role="presentation">
          <section aria-labelledby="employee-modal-title" aria-modal="true" className="employee-modal" role="dialog">
            <header className="modal-header">
              <div>
                <span className="eyebrow">{modal.mode === "create" ? "NUEVA CUENTA" : "ADMINISTRAR"}</span>
                <h2 id="employee-modal-title">{modal.mode === "create" ? "Nuevo colaborador" : modal.employee.name}</h2>
              </div>
              <button aria-label="Cerrar" className="icon-button" disabled={isSaving} onClick={() => setModal(null)} type="button"><Icon name="x" /></button>
            </header>

            {temporaryPassword ? (
              <div className="temporary-password-result">
                <span className="success-mark"><Icon name="check" size={25} /></span>
                <h3>Cuenta creada correctamente</h3>
                <p>Comparte esta contraseña temporal de forma segura. Solo se mostrará en esta ocasión.</p>
                <code>{temporaryPassword}</code>
                <button className="button button-primary" onClick={copyPassword} type="button">
                  {passwordCopied ? "Copiada" : "Copiar contraseña"}
                </button>
                <button className="button button-secondary" onClick={() => setModal(null)} type="button">Cerrar</button>
              </div>
            ) : (
              <EmployeeForm
                employee={modal.employee}
                error={error}
                isSaving={isSaving}
                mode={modal.mode}
                onCancel={() => setModal(null)}
                onSubmit={handleSubmit}
                shifts={shifts}
              />
            )}
          </section>
        </div>
      )}
    </div>
  );
}

function EmployeeForm({
  employee,
  error,
  isSaving,
  mode,
  onCancel,
  onSubmit,
  shifts,
}: {
  employee: Employee | null;
  error: string;
  isSaving: boolean;
  mode: "create" | "edit";
  onCancel: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  shifts: WorkShiftOption[];
}) {
  const [status, setStatus] = useState<EmployeeStatus>(employee?.status ?? "active");
  const today = todayKey();

  return (
    <form className="employee-form" onSubmit={onSubmit}>
      <div className="form-grid">
        <label className="admin-field admin-field-wide"><span>Nombre completo</span><input defaultValue={employee?.name ?? ""} maxLength={120} name="name" required /></label>
        <label className="admin-field admin-field-wide"><span>Correo electrónico</span><input defaultValue={employee?.email ?? ""} disabled={mode === "edit"} maxLength={254} name="email" required type="email" /></label>
        <label className="admin-field"><span>Rol</span><select defaultValue={employee?.role ?? "employee"} name="role"><option value="employee">Empleado</option><option value="admin">Administrador</option></select></label>
        {mode === "edit" && (
          <label className="admin-field"><span>Estado</span><select name="status" onChange={(event) => setStatus(event.target.value as EmployeeStatus)} value={status}><option value="active">Activo</option><option value="inactive">Inactivo</option><option value="vacation">Vacaciones</option><option value="permission">Permiso</option></select></label>
        )}
        {mode === "create" && <input name="status" type="hidden" value="active" />}
        <label className="admin-field"><span>Puesto</span><input defaultValue={employee?.position === "Sin asignar" ? "" : employee?.position ?? ""} maxLength={120} name="position" /></label>
        <label className="admin-field"><span>Departamento</span><input defaultValue={employee?.department === "Sin asignar" ? "" : employee?.department ?? ""} maxLength={120} name="department" /></label>
        <label className="admin-field admin-field-wide"><span>Jornada</span><select defaultValue={employee?.shiftId ?? ""} name="shiftId"><option value="">Sin jornada asignada</option>{shifts.map((shift) => <option key={shift.id} value={shift.id}>{shift.name} · {shift.schedule}</option>)}</select></label>

        {(status === "vacation" || status === "permission") && (
          <>
            <label className="admin-field"><span>Desde</span><input defaultValue={today} name="absenceStart" required type="date" /></label>
            <label className="admin-field"><span>Hasta</span><input defaultValue={today} min={today} name="absenceEnd" required type="date" /></label>
          </>
        )}
        {mode === "edit" && status !== "active" && (
          <label className="admin-field admin-field-wide"><span>Motivo u observación</span><textarea maxLength={300} name="reason" placeholder={status === "inactive" ? "Motivo de desactivación" : "Motivo opcional"} rows={3} /></label>
        )}
      </div>

      {error && <p className="form-error" role="alert">{error}</p>}
      <footer className="modal-actions">
        <button className="button button-secondary" disabled={isSaving} onClick={onCancel} type="button">Cancelar</button>
        <button className="button button-primary" disabled={isSaving} type="submit">{isSaving ? "Guardando…" : mode === "create" ? "Crear colaborador" : "Guardar cambios"}</button>
      </footer>
    </form>
  );
}
