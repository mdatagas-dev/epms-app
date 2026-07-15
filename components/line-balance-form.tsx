"use client";

import { useMemo, useState } from "react";

import { createLineBalance } from "@/app/actions";
import { SubmitButton } from "@/components/submit-button";

type Master = { id: string; code: string; name: string };
type Station = Master & { line_id: string; line_code: string };
type Standard = { id: string; model_id: string; line_id: string; code: string; name: string; time_type: string; standard_time_seconds: string; revision: number };

export function LineBalanceForm({ models, lines, stations, standards }: { models: Master[]; lines: Master[]; stations: Station[]; standards: Standard[] }) {
  const [modelId, setModelId] = useState("");
  const [lineId, setLineId] = useState("");
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const relevantStandards = standards.filter((item) => item.model_id === modelId && item.line_id === lineId);
  const relevantStations = stations.filter((item) => item.line_id === lineId);
  const assignments = useMemo(() => relevantStandards.flatMap((standard) => mapping[standard.id] ? [{ standardTimeRevisionId: standard.id, stationId: mapping[standard.id] }] : []), [relevantStandards, mapping]);

  return <form action={createLineBalance} className="panel form-panel">
    <div className="section-title"><span className="step-index">01</span><div><h2>Balance context</h2><p>Only current approved Standard Time revisions are available.</p></div></div>
    <div className="form-grid form-grid--3"><label className="field"><span>Balance name</span><input name="name" placeholder="Line 01 — 800 units" required/></label><label className="field"><span>Product model</span><select name="modelId" value={modelId} onChange={(e) => { setModelId(e.target.value); setMapping({}); }} required><option value="">Select model</option>{models.map((item) => <option key={item.id} value={item.id}>{item.code}</option>)}</select></label><label className="field"><span>Production line</span><select name="lineId" value={lineId} onChange={(e) => { setLineId(e.target.value); setMapping({}); }} required><option value="">Select line</option>{lines.map((item) => <option key={item.id} value={item.id}>{item.code}</option>)}</select></label></div>
    <input type="hidden" name="assignments" value={JSON.stringify(assignments)}/>
    <div className="assignment-list"><div className="assignment-head"><span>Approved process element</span><span>Standard</span><span>Assign station</span></div>{relevantStandards.length ? relevantStandards.map((standard) => <div className="assignment-row" key={standard.id}><div><strong>{standard.code}</strong><span>{standard.name} · {standard.time_type === "manual" ? "Manual" : "Machine automatic"}</span></div><div className="standard-cell"><strong>{standard.standard_time_seconds}</strong><span>sec · R{standard.revision}</span></div><select aria-label={`Station for ${standard.code}`} value={mapping[standard.id] ?? ""} onChange={(e) => setMapping((current) => ({ ...current, [standard.id]: e.target.value }))}><option value="">Unassigned</option>{relevantStations.map((station) => <option key={station.id} value={station.id}>{station.code} — {station.name}</option>)}</select></div>) : <div className="panel-empty">Select a model and line with approved Standard Times.</div>}</div>
    <div className="form-actions"><p>{assignments.length} of {relevantStandards.length} elements assigned.</p><SubmitButton>Create Line Balance</SubmitButton></div>
  </form>;
}
