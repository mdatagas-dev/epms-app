import Link from "next/link";

import { Icon } from "@/components/icons";
import { getDashboardData } from "@/lib/data";

export default async function DashboardPage() {
  const { scenario, pending, activities, standards } = await getDashboardData();
  return <main className="page-shell">
    <div className="page-heading">
      <div><p className="eyebrow">Engineering overview</p><h1>Process evidence, at a glance.</h1><p className="page-subtitle">KPI berikut hanya berasal dari approved revision dan calculation scenario yang tersimpan.</p></div>
      <Link href="/time-studies/new" className="button button--primary">New Time Study <span>＋</span></Link>
    </div>

    {scenario ? <>
      <div className="context-strip">
        <div><span>Active calculation</span><strong>{scenario.name}</strong></div>
        <div><span>Model / Line</span><strong>{scenario.model_code} · {scenario.line_code}</strong></div>
        <div><span>Evidence state</span><strong className={`status-text status-text--${scenario.status}`}>{scenario.status}</strong></div>
        <Link href="/scenarios">Open assumptions <Icon name="arrow" size={15}/></Link>
      </div>
      <section className="metric-grid" aria-label="Current engineering metrics">
        <Metric label="Takt Time" value={scenario.takt_time_seconds} unit="sec/unit" note={`Target ${scenario.target_quantity} unit`} />
        <Metric label="Bottleneck CT" value={scenario.bottleneck_cycle_seconds} unit="sec" note={`Station ${scenario.bottleneck_station}`} tone="warn" />
        <Metric label="Theoretical Capacity" value={scenario.theoretical_capacity} unit="unit/shift" note={`${Math.round(Number(scenario.available_time_seconds) / 60)} min available`} />
        <Metric label="Required Manpower" value={scenario.theoretical_manpower} unit="operator" note="Manual work only" />
        <Metric label="Line Efficiency" value={scenario.line_efficiency_pct} unit="%" note={`${scenario.balance_loss_pct}% balance loss`} wide />
      </section>
    </> : <section className="empty-state"><span className="empty-symbol">∅</span><div><h2>Belum ada calculation scenario</h2><p>Approve Standard Time, susun Line Balance, lalu buat target scenario pertama.</p></div><Link href="/time-studies" className="button button--secondary">Mulai dari Time Study</Link></section>}

    <div className="dashboard-columns">
      <section className="panel">
        <div className="panel-heading"><div><p className="eyebrow">Controlled standards</p><h2>Current Standard Time</h2></div><Link href="/time-studies">View all</Link></div>
        {standards.length ? <div className="table-wrap"><table><thead><tr><th>Process</th><th>Context</th><th>Rev.</th><th className="num">Standard</th></tr></thead><tbody>{standards.map((row) => <tr key={row.id}><td><strong>{row.code}</strong><span className="cell-note">{row.name}</span></td><td>{row.model_code}<span className="cell-note">{row.line_code}</span></td><td>R{row.revision}</td><td className="num"><strong>{row.standard_time_seconds}</strong> sec</td></tr>)}</tbody></table></div> : <p className="panel-empty">Belum ada Standard Time yang disetujui.</p>}
      </section>
      <section className="panel activity-panel">
        <div className="panel-heading"><div><p className="eyebrow">Audit trail</p><h2>Engineering activity</h2></div><span className="pending-badge">{Number(pending.studies) + Number(pending.scenarios)} pending</span></div>
        {activities.length ? <ol className="activity-list">{activities.map((item) => <li key={item.id}><span className={`activity-icon activity-icon--${item.action}`}><Icon name={item.action === "approved" ? "check" : "clock"} size={15}/></span><div><p>{item.summary}</p><span>{item.actor_name} · {formatDate(item.created_at)}</span></div></li>)}</ol> : <p className="panel-empty">Aktivitas workflow akan tercatat otomatis.</p>}
      </section>
    </div>
  </main>;
}

function Metric({ label, value, unit, note, tone, wide }: { label: string; value: string | number; unit: string; note: string; tone?: string; wide?: boolean }) {
  return <article className={`metric-card ${tone ? `metric-card--${tone}` : ""} ${wide ? "metric-card--wide" : ""}`}><span>{label}</span><div><strong>{value}</strong><small>{unit}</small></div><p>{note}</p></article>;
}

function formatDate(value: string) { return new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(value)); }
