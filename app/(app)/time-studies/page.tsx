import Link from "next/link";

import { getTimeStudies } from "@/lib/data";

export default async function TimeStudiesPage() {
  const studies = await getTimeStudies();
  return <main className="page-shell">
    <div className="page-heading"><div><p className="eyebrow">Measurement evidence</p><h1>Time Studies</h1><p className="page-subtitle">Raw observations, revision status, dan approval history.</p></div><Link href="/time-studies/new" className="button button--primary">New Time Study <span>＋</span></Link></div>
    <section className="panel">
      {studies.length ? <div className="table-wrap"><table><thead><tr><th>Study</th><th>Process</th><th>Context</th><th>Cycles</th><th>Status</th><th></th></tr></thead><tbody>{studies.map((study) => <tr key={study.id}><td><strong>{study.study_number}</strong><span className="cell-note">Revision {study.revision}</span></td><td>{study.process_code}<span className="cell-note">{study.process_name}</span></td><td>{study.model_code}<span className="cell-note">{study.line_code}</span></td><td><strong>{study.valid_cycle_count}</strong><span className="cell-note">of {study.cycle_count} valid</span></td><td><span className={`status-pill status-pill--${study.status}`}>{study.status}</span></td><td className="num"><Link className="row-link" href={`/time-studies/${study.id}`}>Open →</Link></td></tr>)}</tbody></table></div> : <div className="panel-empty panel-empty--large">Belum ada Time Study. Buat measurement record pertama untuk memulai evidence chain.</div>}
    </section>
  </main>;
}
