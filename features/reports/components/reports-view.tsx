import { Icon } from "@/features/shared/components/icon";

const departmentData = [
  { name: "Operaciones", value: 94, color: "blue" },
  { name: "Veterinaria", value: 91, color: "purple" },
  { name: "Administración", value: 88, color: "green" },
  { name: "Mantenimiento", value: 85, color: "orange" },
];

export function ReportsView() {
  return (
    <div className="page-stack">
      <header className="page-heading heading-with-action">
        <div><span className="eyebrow">ANÁLISIS Y RESULTADOS</span><h1>Reportes</h1><p>Analiza tendencias y exporta la información de asistencia.</p></div>
        <button className="button button-secondary" type="button"><Icon name="document" size={17} />Exportar reporte</button>
      </header>

      <section className="report-filters panel">
        <label><span>PERIODO</span><button type="button"><Icon name="calendar" size={16} />01 ago – 31 ago, 2026<Icon name="chevron-down" size={14} /></button></label>
        <label><span>DEPARTAMENTO</span><button type="button">Todos los departamentos<Icon name="chevron-down" size={14} /></button></label>
        <label><span>TIPO DE REPORTE</span><button type="button">Resumen de asistencia<Icon name="chevron-down" size={14} /></button></label>
        <button className="button button-primary" type="button">Aplicar filtros</button>
      </section>

      <section className="report-kpis">
        <article className="panel report-kpi"><span>TASA DE ASISTENCIA</span><strong>89.4%</strong><small className="positive"><Icon name="trend-up" size={14} />2.3% vs. periodo anterior</small></article>
        <article className="panel report-kpi"><span>PUNTUALIDAD</span><strong>92.1%</strong><small className="positive"><Icon name="trend-up" size={14} />1.8% vs. periodo anterior</small></article>
        <article className="panel report-kpi"><span>HORAS TRABAJADAS</span><strong>18,420</strong><small>Promedio de 7.6 h por día</small></article>
        <article className="panel report-kpi"><span>INCIDENCIAS</span><strong>34</strong><small className="positive"><Icon name="trend-down" size={14} />6 menos que el mes anterior</small></article>
      </section>

      <section className="reports-grid">
        <article className="panel trend-panel">
          <div className="panel-heading"><div><h2>Tendencia de asistencia</h2><p>Comparativa de las últimas cuatro semanas</p></div><span className="chart-legend"><i />Asistencia</span></div>
          <div className="line-chart" aria-label="Gráfica con tendencia creciente de asistencia">
            <div className="y-axis"><span>100%</span><span>90%</span><span>80%</span><span>70%</span></div>
            <div className="chart-canvas">
              <div className="grid-line grid-one" /><div className="grid-line grid-two" /><div className="grid-line grid-three" /><div className="grid-line grid-four" />
              <svg aria-hidden="true" preserveAspectRatio="none" viewBox="0 0 600 180"><defs><linearGradient id="area" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#246bfd" stopOpacity=".25"/><stop offset="1" stopColor="#246bfd" stopOpacity="0"/></linearGradient></defs><path d="M0 120 C70 110,90 70,150 82 S240 108,300 68 S395 40,450 60 S545 35,600 24 V180 H0Z" fill="url(#area)"/><path d="M0 120 C70 110,90 70,150 82 S240 108,300 68 S395 40,450 60 S545 35,600 24" fill="none" stroke="#246bfd" strokeWidth="4" vectorEffect="non-scaling-stroke"/></svg>
              <div className="x-axis"><span>Sem 1</span><span>Sem 2</span><span>Sem 3</span><span>Sem 4</span></div>
            </div>
          </div>
        </article>

        <article className="panel department-panel">
          <div className="panel-heading"><div><h2>Por departamento</h2><p>Promedio de asistencia</p></div></div>
          <div className="department-bars">{departmentData.map((item) => <div className="department-row" key={item.name}><div><span>{item.name}</span><strong>{item.value}%</strong></div><span className="department-track"><span className={`department-fill fill-${item.color}`} style={{ width: `${item.value}%` }} /></span></div>)}</div>
        </article>
      </section>
    </div>
  );
}
