"use client";

import { useState } from "react";

import { createMotionStudy } from "@/app/actions";
import { SubmitButton } from "@/components/submit-button";
import { calculateMotionSummary, type MotionCategory, type MotionObservation, type MotionValueClass } from "@/lib/engineering";

type Master = { id: string; code: string; name: string };
type Station = Master & { line_id: string };
type MotionRow = MotionObservation & { id: number; description: string };

const categoryLabels: Record<MotionCategory, string> = { walking: "Walking", searching: "Searching", picking: "Picking", holding: "Holding", inspection: "Inspection", machine_time: "Machine time", waiting: "Waiting", transportation: "Transportation" };
const suggestions: Record<MotionCategory, MotionValueClass> = { walking: "nva", searching: "nva", picking: "va", holding: "nnva", inspection: "nnva", machine_time: "nnva", waiting: "nva", transportation: "nva" };
const categories = Object.keys(categoryLabels) as MotionCategory[];

export function MotionStudyForm({ models, lines, stations, today }: { models: Master[]; lines: Master[]; stations: Station[]; today: string }) {
  const [lineId, setLineId] = useState("");
  const [nextId, setNextId] = useState(2);
  const [rows, setRows] = useState<MotionRow[]>([{ id: 1, description: "", category: "picking", valueClass: "va", seconds: 0 }]);
  const validRows = rows.filter((row) => row.description.trim() && row.seconds > 0);
  const summary = validRows.length ? calculateMotionSummary(validRows) : null;

  function update(id: number, patch: Partial<MotionRow>) {
    setRows((current) => current.map((row) => row.id === id ? { ...row, ...patch } : row));
  }

  function addRow() {
    if (rows.length >= 200) return;
    setRows((current) => [...current, { id: nextId, description: "", category: "picking", valueClass: "va", seconds: 0 }]);
    setNextId((value) => value + 1);
  }

  return <form action={createMotionStudy} className="panel motion-form">
    <section className="motion-form-section"><div className="section-title"><span className="step-index">01</span><div><h2>Study context</h2><p>Model, line, and station are saved with the evidence.</p></div></div><div className="form-grid form-grid--3"><label className="field"><span>Study name</span><input name="name" placeholder="Indoor assembly motion review" maxLength={100} required/></label><label className="field"><span>Observed date</span><input name="observedAt" type="date" defaultValue={today} required/></label><label className="field"><span>Product model</span><select name="modelId" defaultValue="" required><option value="" disabled>Select model</option>{models.map((item) => <option key={item.id} value={item.id}>{item.code} · {item.name}</option>)}</select></label><label className="field"><span>Production line</span><select name="lineId" value={lineId} onChange={(event) => setLineId(event.target.value)} required><option value="" disabled>Select line</option>{lines.map((item) => <option key={item.id} value={item.id}>{item.code} · {item.name}</option>)}</select></label><label className="field"><span>Station</span><select key={lineId} name="stationId" defaultValue="" disabled={!lineId} required><option value="" disabled>Select station</option>{stations.filter((item) => item.line_id === lineId).map((item) => <option key={item.id} value={item.id}>{item.code} · {item.name}</option>)}</select></label><label className="field"><span>Study note</span><input name="note" placeholder="Optional scope or condition" maxLength={250}/></label></div></section>
    <section className="motion-form-section"><div className="section-title"><span className="step-index">02</span><div><h2>Observed motions</h2><p>Suggested classifications are editable before saving.</p></div><span className="cycle-counter">{validRows.length} valid</span></div><input type="hidden" name="observations" value={JSON.stringify(rows.map(({ description, category, valueClass, seconds }) => ({ description, category, valueClass, seconds })))}/><div className="motion-entry-head"><span>#</span><span>Description</span><span>Category</span><span>VA class</span><span>Seconds</span><span/></div><div className="motion-entry-list">{rows.map((row, index) => <div className="motion-entry-row" key={row.id}><span className="mono-cell">{String(index + 1).padStart(2, "0")}</span><input aria-label={`Motion ${index + 1} description`} value={row.description} onChange={(event) => update(row.id, { description: event.target.value })} placeholder="Observed activity" maxLength={150} required/><select aria-label={`Motion ${index + 1} category`} value={row.category} onChange={(event) => { const category = event.target.value as MotionCategory; update(row.id, { category, valueClass: suggestions[category] }); }}>{categories.map((category) => <option key={category} value={category}>{categoryLabels[category]}</option>)}</select><select aria-label={`Motion ${index + 1} value class`} value={row.valueClass} onChange={(event) => update(row.id, { valueClass: event.target.value as MotionValueClass })}><option value="va">VA</option><option value="nva">NVA</option><option value="nnva">NNVA</option></select><input aria-label={`Motion ${index + 1} duration`} type="number" min="0.01" step="0.01" value={row.seconds || ""} onChange={(event) => update(row.id, { seconds: Number(event.target.value) })} placeholder="0.00" required/><button type="button" className="text-button text-button--danger" disabled={rows.length === 1} onClick={() => setRows((current) => current.filter((item) => item.id !== row.id))}>Remove</button></div>)}</div><button type="button" className="text-button add-cycle" onClick={addRow} disabled={rows.length >= 200}>＋ Add motion</button>
      <div className="motion-preview"><Preview label="Total" value={summary?.totalSeconds ?? 0}/><Preview label="VA" value={summary?.vaRatioPct ?? 0}/><Preview label="NVA" value={summary?.nvaRatioPct ?? 0}/><Preview label="NNVA" value={summary?.nnvaRatioPct ?? 0}/></div>
    </section>
    <div className="form-actions motion-submit"><p>Saved observations are immutable evidence. Create a new study for corrections.</p><SubmitButton>Save Motion Study</SubmitButton></div>
  </form>;
}

function Preview({ label, value }: { label: string; value: number }) {
  return <div><span>{label}</span><strong>{value}</strong><small>{label === "Total" ? " sec" : "%"}</small></div>;
}
