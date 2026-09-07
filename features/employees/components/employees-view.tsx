import type { Employee } from "@/features/employees/types";
import { Avatar } from "@/features/shared/components/avatar";
import { Icon } from "@/features/shared/components/icon";

export function EmployeesView({ employees }: { employees: Employee[] }) {
  return (
    <div className="page-stack">
      <header className="page-heading heading-with-action">
        <div><span className="eyebrow">GESTIÓN DE EQUIPO</span><h1>Colaboradores</h1><p>Consulta y administra la información de tu equipo.</p></div>
        <button className="button button-primary" type="button"><span className="button-plus">+</span>Nuevo colaborador</button>
      </header>

      <section className="directory-stats">
        <article className="panel directory-stat"><span className="stat-icon stat-blue"><Icon name="users" /></span><div><strong>127</strong><small>Total colaboradores</small></div></article>
        <article className="panel directory-stat"><span className="stat-icon stat-green"><Icon name="check" /></span><div><strong>119</strong><small>Activos</small></div></article>
        <article className="panel directory-stat"><span className="stat-icon stat-amber"><Icon name="calendar" /></span><div><strong>8</strong><small>En vacaciones</small></div></article>
      </section>

      <section className="panel recent-panel">
        <div className="directory-toolbar">
          <label className="directory-search"><Icon name="search" size={17} /><input aria-label="Buscar colaborador" placeholder="Buscar por nombre o correo…" /></label>
          <button className="filter-button" type="button">Todos los departamentos <Icon name="chevron-down" size={15} /></button>
          <button className="filter-button" type="button">Todos los estados <Icon name="chevron-down" size={15} /></button>
        </div>
        <div className="table-scroll">
          <table className="data-table employee-table">
            <thead><tr><th>COLABORADOR</th><th>PUESTO</th><th>DEPARTAMENTO</th><th>HORARIO</th><th>ESTADO</th><th /></tr></thead>
            <tbody>{employees.map((employee) => (
              <tr key={employee.id}>
                <td><div className="person-cell"><Avatar initials={employee.initials} tone={employee.avatarTone} /><span><strong>{employee.name}</strong><small>{employee.email}</small></span></div></td>
                <td>{employee.position}</td><td>{employee.department}</td><td>{employee.schedule}</td>
                <td><span className={`status-badge status-${employee.status === "active" ? "present" : "late"}`}>{employee.status === "active" ? "Activo" : "Vacaciones"}</span></td>
                <td><button aria-label={`Opciones de ${employee.name}`} className="more-button" type="button">•••</button></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
        <footer className="table-footer"><span>Mostrando 6 de 127 colaboradores</span><div><button disabled type="button">Anterior</button><button type="button">Siguiente</button></div></footer>
      </section>
    </div>
  );
}
