import Link from "next/link";

import { getMotionStudies } from "@/lib/data";

export default async function MotionStudiesPage() {
  const studies = await getMotionStudies();
  return <main className="page-shell">
    <div className="page-heading"><div><p className="eyebrow">Waste evidence</p><h1>Motion Studies</h1><p className="page-subtitle">Traceable VA, NVA, and NNVA observations by station.</p></div><Link href="/motion-studies/new" className="button button--primary">New Motion Study <span>＋</span></Link></div>
    <section className="panel">
      <div className="panel-heading"><h2>Study history</h2><span>{studies.length} records</span></div>
      {studies.length ? <div className="table-wrap"><table><thead><tr><th>Study</th><th>Context</th><th>Observed</th><th className="num">Duration</th><th className="num">NVA</th><th/></tr></thead><tbody>{studies.map((study) => { const total = Number(study.total_seconds); const nva = Number(study.nva_seconds); return <tr key={study.id}><td><strong>{study.study_number}</strong><span className="cell-note">{study.name}</span></td><td>{study.model_code} · {study.line_code}<span className="cell-note">Station {study.station_code}</span></td><td>{new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(new Date(study.observed_at))}<span className="cell-note">{study.observation_count} motions</span></td><td className="num">{total.toFixed(2)} sec</td><td className="num"><strong>{total ? ((nva / total) * 100).toFixed(2) : "0.00"}%</strong></td><td className="num"><Link className="row-link" href={`/motion-studies/${study.id}`}>Open →</Link></td></tr>; })}</tbody></table></div> : <div className="panel-empty panel-empty--large">Belum ada Motion Study. Record observed motion untuk memulai waste evidence.</div>}
    </section>
  </main>;
}
