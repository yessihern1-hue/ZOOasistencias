import Link from "next/link";

import type { DashboardData, DashboardStat } from "@/features/dashboard/types";
import { Avatar } from "@/features/shared/components/avatar";
import { Icon } from "@/features/shared/components/icon";

const statusLabel = {
  present: "A tiempo",
  late: "Tarde",
  absent: "Ausente",
  pending: "Pendiente",
};

function StatCard({ stat }: { stat: DashboardStat }) {
  const icon = stat.label === "Colaboradores" ? "users" : stat.label === "Presentes hoy" ? "check" : "clock";

  return (
    <article className={`stat-card stat-${stat.tone}`}>
      <div className="stat-card-top">
        <span className="stat-icon"><Icon name={icon} size={20} /></span>
        <span className={`trend trend-${stat.trend}`}>
          {stat.trend !== "neutral" && <Icon name={stat.trend === "up" ? "trend-up" : "trend-down"} size={14} />}
          {stat.detail}
        </span>
      </div>
      <strong className="stat-value">{stat.value}</strong>
      <span className="stat-label">{stat.label}</span>
    </article>
  );
}

export function DashboardView({ data, userName }: { data: DashboardData; userName: string }) {
  const firstName = userName.split(" ")[0];
  const days = ["Lun", "Mar", "Mié", "Jue", "Vie"];

  return (
    <div className="page-stack">
      <header className="page-heading heading-with-date">
        <div>
          <span className="eyebrow">RESUMEN GENERAL</span>
          <h1>Buenos días, {firstName} <span aria-hidden="true">👋</span></h1>
          <p>Aquí tienes un vistazo de lo que ocurre hoy en tu equipo.</p>
        </div>
        <span className="date-chip"><Icon name="calendar" size={17} />{data.formattedDate}</span>
      </header>

      <section aria-label="Indicadores de hoy" className="stats-grid">
        {data.stats.map((stat) => <StatCard key={stat.label} stat={stat} />)}
      </section>

      <section className="dashboard-grid">
        <article className="panel attendance-cta">
          <div className="attendance-cta-copy">
            <span className="eyebrow eyebrow-light">TU JORNADA</span>
            <h2>Registra tu asistencia</h2>
            <p>Marca tu entrada o salida de forma rápida y segura.</p>
            <Link className="button button-white" href="/asistencia">
              Ir a tomar asistencia <Icon name="arrow-right" size={17} />
            </Link>
          </div>
          <div className="attendance-cta-visual" aria-hidden="true">
            <span className="orbit orbit-one" />
            <span className="orbit orbit-two" />
            <span className="cta-clock"><Icon name="fingerprint" size={38} /></span>
          </div>
        </article>

        <article className="panel weekly-panel">
          <div className="panel-heading">
            <div><h2>Asistencia semanal</h2><p>Porcentaje de presencia por día</p></div>
            <span className="percentage-pill">89% promedio</span>
          </div>
          <div className="bar-chart" aria-label="Asistencia semanal: lunes 84%, martes 91%, miércoles 88%, jueves 95%, viernes 89%">
            {data.weeklyPresence.map((value, index) => (
              <div className="bar-column" key={days[index]}>
                <span className="bar-value">{value}%</span>
                <span className="bar-track"><span className="bar-fill" style={{ height: `${value}%` }} /></span>
                <small>{days[index]}</small>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="panel recent-panel">
        <div className="panel-heading">
          <div><h2>Registros recientes</h2><p>Últimas entradas registradas hoy</p></div>
          <Link className="text-link" href="/asistencia">Ver todos <Icon name="arrow-right" size={15} /></Link>
        </div>
        <div className="table-scroll">
          <table className="data-table">
            <thead><tr><th>COLABORADOR</th><th>ÁREA</th><th>HORA DE ENTRADA</th><th>ESTADO</th></tr></thead>
            <tbody>
              {data.recentAttendance.map((item) => (
                <tr key={item.id}>
                  <td><div className="person-cell"><Avatar initials={item.initials} tone={item.avatarTone} size="sm" /><strong>{item.employeeName}</strong></div></td>
                  <td>{item.department}</td>
                  <td className="time-cell"><Icon name="clock" size={15} />{item.time}</td>
                  <td><span className={`status-badge status-${item.status}`}>{statusLabel[item.status]}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
