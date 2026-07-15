import { notFound } from "next/navigation";

import { calculateMotionSummary, type MotionObservation } from "@/lib/engineering";
import { getMotionStudy } from "@/lib/data";

const labels: Record<string, string> = { walking: "Walking", searching: "Searching", picking: "Picking", holding: "Holding", inspection: "Inspection", machine_time: "Machine time", waiting: "Waiting", transportation: "Transportation" };

export default async function MotionStudyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { study, observations } = await getMotionStudy(id);
  if (!study) notFound();
  const summary = calculateMotionSummary(observations.map((item) => ({ category: item.category, valueClass: item.value_class, seconds: Number(item.observed_seconds) }) as MotionObservation));
  return <main className="page-shell">
    <div className="page-heading"><div><p className="eyebrow">{study.study_number} · Immutable evidence</p><h1>{study.name}</h1><p className="page-subtitle">{study.model_code} · {study.line_code} · Station {study.station_code} · observed by {study.creator_name}</p></div></div>
    <section className="motion-summary">
      <MotionMetric label="Total observed" value={summary.totalSeconds} unit="sec" tone="total"/>
      <MotionMetric label="Value Added" value={summary.vaRatioPct} unit="%" tone="va" note={`${summary.vaSeconds} sec`}/>
      <MotionMetric label="Non-Value Added" value={summary.nvaRatioPct} unit="%" tone="nva" note={`${summary.nvaSeconds} sec`}/>
      <MotionMetric label="Necessary NVA" value={summary.nnvaRatioPct} unit="%" tone="nnva" note={`${summary.nnvaSeconds} sec`}/>
    </section>
    <div className="motion-columns">
      <section className="panel"><div className="panel-heading"><h2>Observed sequence</h2><span>{observations.length} motions</span></div><div className="table-wrap"><table><thead><tr><th>#</th><th>Motion</th><th>Category</th><th>Class</th><th className="num">Duration</th></tr></thead><tbody>{observations.map((item) => <tr key={item.id}><td className="mono-cell">{item.sequence}</td><td><strong>{item.description}</strong>{item.note && <span className="cell-note">{item.note}</span>}</td><td>{labels[item.category]}</td><td><span className={`value-pill value-pill--${item.value_class}`}>{item.value_class}</span></td><td className="num">{Number(item.observed_seconds).toFixed(2)} sec</td></tr>)}</tbody></table></div></section>
      <section className="panel"><div className="panel-heading"><h2>NVA waste ranking</h2><span>Share of total time</span></div>{summary.wasteByCategory.length ? <div className="waste-list">{summary.wasteByCategory.map((item) => <div key={item.category}><div><strong>{labels[item.category]}</strong><span>{item.seconds} sec · {item.ratioPct}%</span></div><div className="waste-track"><span style={{ width: `${Math.min(item.ratioPct, 100)}%` }}/></div></div>)}</div> : <p className="panel-empty">No NVA motion classified.</p>}</section>
    </div>
  </main>;
}

function MotionMetric({ label, value, unit, tone, note }: { label: string; value: number; unit: string; tone: string; note?: string }) {
  return <div className={`motion-metric motion-metric--${tone}`}><span>{label}</span><div><strong>{value}</strong><small>{unit}</small></div>{note && <p>{note}</p>}</div>;
}
