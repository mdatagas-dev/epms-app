import { notFound } from "next/navigation";

import { approveTimeStudy, rejectTimeStudy, submitTimeStudy } from "@/app/actions";
import { SubmitButton } from "@/components/submit-button";
import { getTimeStudy } from "@/lib/data";
import { calculateStandardTime } from "@/lib/engineering";
import { requireUser } from "@/lib/session";

const dateFormatter = new Intl.DateTimeFormat("id-ID", { dateStyle: "medium" });

export default async function TimeStudyDetailPage({ params }: PageProps<"/time-studies/[id]">) {
  const [{ id }, user] = await Promise.all([params, requireUser()]);
  const { study, cycles, standard } = await getTimeStudy(id);
  if (!study) notFound();
  const observations = cycles.map((cycle) => ({ seconds: Number(cycle.observed_seconds), excluded: cycle.is_excluded, exclusionReason: cycle.exclusion_reason ?? undefined }));
  const result = calculateStandardTime({ cycles: observations, performanceRatingPct: Number(study.performance_rating_pct), allowancePct: Number(study.allowance_pct) });
  const outliers = new Set(result.outlierIndexes);

  return <main className="page-shell">
    <div className="page-heading"><div><p className="eyebrow">{study.study_number} · Revision {study.revision}</p><h1>{study.process_code} — {study.process_name}</h1><p className="page-subtitle">{study.model_code} · {study.line_code} · created by {study.creator_name}</p></div><span className={`status-pill status-pill--${study.status}`}>{study.status}</span></div>
    <div className="detail-grid">
      <section className="panel evidence-panel">
        <div className="panel-heading"><div><p className="eyebrow">Calculation evidence</p><h2>Standard Time breakdown</h2></div><span className="formula-chip">NT ÷ (1 − A)</span></div>
        <div className="detail-metrics"><div><span>Valid cycles</span><strong>{result.validCycleCount}</strong></div><div><span>Average CT</span><strong>{result.averageCycleSeconds}<small> sec</small></strong></div><div><span>Rating</span><strong>{study.performance_rating_pct}<small>%</small></strong></div><div><span>Allowance</span><strong>{study.allowance_pct}<small>%</small></strong></div><div className="detail-metric--primary"><span>Standard Time</span><strong>{result.standardTimeSeconds}<small> sec</small></strong></div></div>
        <div className="evidence-note"><span>i</span><p>Outlier hanya ditandai. Nilai tetap ikut perhitungan kecuali engineer mengecualikannya dengan alasan sebelum study dibuat.</p></div>
      </section>
      <aside className="panel approval-panel"><p className="eyebrow">Workflow control</p><h2>{study.status === "draft" ? "Ready to submit?" : study.status === "submitted" ? "Pending supervisor" : study.status === "approved" ? "Approved standard" : "Superseded revision"}</h2><p>{standard ? `Effective ${formatDate(standard.effective_at)}. Historical scenarios keep this exact revision.` : "Approval freezes the calculation and creates a controlled Standard Time revision."}</p>
        {study.status === "draft" && <form action={submitTimeStudy}><input type="hidden" name="id" value={id}/><SubmitButton className="button button--primary button--full">Submit for approval</SubmitButton></form>}
        {study.status === "submitted" && user.role === "supervisor" && <div className="approval-actions"><form action={approveTimeStudy}><input type="hidden" name="id" value={id}/><SubmitButton className="button button--primary button--full">Approve Standard Time</SubmitButton></form><form action={rejectTimeStudy} className="reject-form"><input type="hidden" name="id" value={id}/><input name="comment" placeholder="Return comment" required/><SubmitButton className="button button--danger button--full">Return to draft</SubmitButton></form></div>}
        {study.status === "submitted" && user.role !== "supervisor" && <span className="pending-note">Waiting for another Supervisor to review.</span>}
      </aside>
    </div>
    <section className="panel"><div className="panel-heading"><div><p className="eyebrow">Immutable raw data</p><h2>Cycle observations</h2></div><span>{outliers.size} statistical flags</span></div><div className="observation-grid">{cycles.map((cycle, index) => <div key={cycle.id} className={`observation ${outliers.has(index) ? "observation--outlier" : ""} ${cycle.is_excluded ? "observation--excluded" : ""}`}><span>{String(cycle.cycle_number).padStart(2, "0")}</span><strong>{cycle.observed_seconds}</strong><small>{cycle.is_excluded ? "Excluded" : outliers.has(index) ? "Outlier" : "sec"}</small></div>)}</div></section>
  </main>;
}

function formatDate(value: string) { return dateFormatter.format(new Date(value)); }
