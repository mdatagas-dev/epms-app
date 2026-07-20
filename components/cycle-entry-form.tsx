"use client";

import { useMemo, useRef, useState } from "react";

import { createTimeStudy } from "@/app/actions";
import { SubmitButton } from "@/components/submit-button";
import { calculateStandardTime } from "@/lib/engineering";

type Master = { id: string; code: string; name: string };
type Entry = { id: number; seconds: string; excluded: boolean; exclusionReason: string };

export function CycleEntryForm({ models, lines, elements }: { models: Master[]; lines: Master[]; elements: Master[] }) {
  const nextId = useRef(31);
  const [entries, setEntries] = useState<Entry[]>(() => Array.from({ length: 30 }, (_, index) => ({ id: index + 1, seconds: "", excluded: false, exclusionReason: "" })));
  const [rating, setRating] = useState(100);
  const [allowance, setAllowance] = useState(10);
  const validEntries = entries.filter((entry) => Number(entry.seconds) > 0);
  const preview = useMemo(() => {
    if (validEntries.filter((entry) => !entry.excluded).length < 30) return null;
    try { return calculateStandardTime({ cycles: validEntries.map((entry) => ({ seconds: Number(entry.seconds), excluded: entry.excluded, exclusionReason: entry.exclusionReason })), performanceRatingPct: rating, allowancePct: allowance }); } catch { return null; }
  }, [validEntries, rating, allowance]);
  const outliers = new Set(preview?.outlierIndexes ?? []);

  function pasteCycles(text: string) {
    const values = text.split(/[\s,;]+/).map(Number).filter((value) => Number.isFinite(value) && value > 0).slice(0, 100);
    if (!values.length) return;
    setEntries(values.map((seconds) => ({ id: nextId.current++, seconds: String(seconds), excluded: false, exclusionReason: "" })));
  }

  function update(index: number, patch: Partial<Entry>) { setEntries((current) => current.map((entry, i) => i === index ? { ...entry, ...patch } : entry)); }
  function addCycle() {
    if (entries.length >= 100) return;
    const id = nextId.current++;
    setEntries((current) => [...current, { id, seconds: "", excluded: false, exclusionReason: "" }]);
  }

  const payload = validEntries.map((entry) => ({ seconds: Number(entry.seconds), excluded: entry.excluded, exclusionReason: entry.exclusionReason || undefined }));
  return <form action={createTimeStudy} className="workflow-grid">
    <section className="panel form-panel">
      <div className="section-title"><span className="step-index">01</span><div><h2>Study context</h2><p>Identitas Standard Time yang akan direvisi.</p></div></div>
      <div className="form-grid form-grid--3">
        <label className="field"><span>Product model</span><select name="modelId" required defaultValue=""><option value="" disabled>Select model</option>{models.map((item) => <option key={item.id} value={item.id}>{item.code} — {item.name}</option>)}</select></label>
        <label className="field"><span>Production line</span><select name="lineId" required defaultValue=""><option value="" disabled>Select line</option>{lines.map((item) => <option key={item.id} value={item.id}>{item.code} — {item.name}</option>)}</select></label>
        <label className="field"><span>Process element</span><select name="processElementId" required defaultValue=""><option value="" disabled>Select process</option>{elements.map((item) => <option key={item.id} value={item.id}>{item.code} — {item.name}</option>)}</select></label>
      </div>
    </section>
    <section className="panel form-panel">
      <div className="section-title"><span className="step-index">02</span><div><h2>Observed cycles</h2><p>Raw data tidak akan dihapus setelah study dibuat.</p></div><span className={`cycle-counter ${validEntries.length >= 30 ? "cycle-counter--ready" : ""}`}>{validEntries.length} / 30 minimum</span></div>
      <label className="paste-zone"><span>Paste from Excel</span><textarea rows={2} placeholder="60.2  59.8  61.1  …" onPaste={(event) => { event.preventDefault(); pasteCycles(event.clipboardData.getData("text")); }} onChange={(event) => pasteCycles(event.target.value)} /><small>Whitespace, tab, comma, and line breaks are supported.</small></label>
      <input type="hidden" name="cycles" value={JSON.stringify(payload)} />
      <div className="cycle-table-wrap"><table className="cycle-table"><thead><tr><th>#</th><th>Observed time (sec)</th><th>Evidence status</th><th>Exclude</th></tr></thead><tbody>{entries.map((entry, index) => <tr key={entry.id} className={outliers.has(index) ? "cycle-row--outlier" : ""}><td className="mono-cell">{String(index + 1).padStart(2, "0")}</td><td><input aria-label={`Cycle ${index + 1}`} inputMode="decimal" type="number" min="0.01" step="0.01" value={entry.seconds} onChange={(event) => update(index, { seconds: event.target.value })} /></td><td>{outliers.has(index) ? <span className="outlier-flag">IQR outlier</span> : entry.seconds ? <span className="valid-flag">Valid</span> : <span className="muted">Waiting</span>}</td><td><label className="exclude-control"><input type="checkbox" checked={entry.excluded} onChange={(event) => update(index, { excluded: event.target.checked })}/><span>Exclude</span></label>{entry.excluded && <input className="reason-input" value={entry.exclusionReason} onChange={(event) => update(index, { exclusionReason: event.target.value })} placeholder="Required reason" required />}</td></tr>)}</tbody></table></div>
      <button type="button" onClick={addCycle} className="text-button add-cycle" disabled={entries.length >= 100}>＋ Add cycle</button>
    </section>
    <section className="panel form-panel">
      <div className="section-title"><span className="step-index">03</span><div><h2>Standard adjustment</h2><p>Default changes require visible justification.</p></div></div>
      <div className="form-grid form-grid--3">
        <label className="field"><span>Performance rating</span><div className="input-suffix"><input name="performanceRatingPct" type="number" min="1" step="0.01" value={rating} onChange={(e) => setRating(Number(e.target.value))} required/><small>%</small></div></label>
        <label className="field"><span>Allowance</span><div className="input-suffix"><input name="allowancePct" type="number" min="0" max="99.99" step="0.01" value={allowance} onChange={(e) => setAllowance(Number(e.target.value))} required/><small>%</small></div></label>
        <label className="field"><span>Adjustment justification</span><input name="justification" placeholder="Required when defaults change" required={rating !== 100 || allowance !== 10}/></label>
      </div>
      <div className="calculation-preview"><div><span>Valid average</span><strong>{preview?.averageCycleSeconds ?? "—"}<small> sec</small></strong></div><div><span>Normal Time</span><strong>{preview?.normalTimeSeconds ?? "—"}<small> sec</small></strong></div><div className="preview-primary"><span>Calculated Standard Time</span><strong>{preview?.standardTimeSeconds ?? "—"}<small> sec</small></strong></div></div>
      <div className="form-actions"><p>Study tersimpan sebagai <strong>Draft</strong> sebelum diajukan.</p><SubmitButton>Save Time Study</SubmitButton></div>
    </section>
  </form>;
}
