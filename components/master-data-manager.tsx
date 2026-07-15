"use client";

import { useActionState, useEffect, useState } from "react";

import { deactivateMasterData, saveMasterData, type MasterActionState } from "@/app/actions";
import type { MasterEntity } from "@/lib/master-data";
import { SubmitButton } from "@/components/submit-button";

type MasterRow = Record<string, string | number | boolean | null> & { id: string };
type MasterData = {
  models: MasterRow[];
  lines: MasterRow[];
  stations: MasterRow[];
  elements: MasterRow[];
  shifts: MasterRow[];
};

const tabs: Array<{ id: MasterEntity; label: string; source: keyof MasterData }> = [
  { id: "model", label: "Models", source: "models" },
  { id: "line", label: "Lines", source: "lines" },
  { id: "station", label: "Stations", source: "stations" },
  { id: "process", label: "Processes", source: "elements" },
  { id: "shift", label: "Shifts", source: "shifts" },
];

export function MasterDataManager({ data, canManage }: { data: MasterData; canManage: boolean }) {
  const [entity, setEntity] = useState<MasterEntity>("model");
  const [editing, setEditing] = useState<MasterRow | null | undefined>(undefined);
  const tab = tabs.find((item) => item.id === entity)!;
  const rows = data[tab.source];

  function selectEntity(next: MasterEntity) {
    setEntity(next);
    setEditing(undefined);
  }

  return (
    <section className="panel master-manager">
      <div className="master-toolbar">
        <div className="master-tabs" role="tablist" aria-label="Master data category">
          {tabs.map((item) => <button key={item.id} type="button" role="tab" aria-selected={entity === item.id} onClick={() => selectEntity(item.id)}>{item.label}<span>{data[item.source].length}</span></button>)}
        </div>
        {canManage && <button type="button" className="button button--primary master-add" onClick={() => setEditing(null)}>Add {tab.label.slice(0, -1)}</button>}
      </div>

      {editing !== undefined && canManage && <MasterEditor key={`${entity}-${editing?.id ?? "new"}`} entity={entity} row={editing} lines={data.lines} onClose={() => setEditing(undefined)} />}

      {!canManage && <p className="master-access-note">Read-only access. Engineering Supervisor approval is required to maintain controlled references.</p>}

      <div className="table-wrap">
        <table className="master-table">
          <thead><MasterHead entity={entity} canManage={canManage} /></thead>
          <tbody>
            {rows.map((row) => <MasterTableRow key={row.id} entity={entity} row={row} canManage={canManage} onEdit={() => setEditing(row)} />)}
          </tbody>
        </table>
        {rows.length === 0 && <p className="panel-empty">No active {tab.label.toLowerCase()}.</p>}
      </div>
    </section>
  );
}

function MasterEditor({ entity, row, lines, onClose }: { entity: MasterEntity; row: MasterRow | null; lines: MasterRow[]; onClose: () => void }) {
  const [state, action] = useActionState<MasterActionState, FormData>(saveMasterData, undefined);
  useEffect(() => { if (state?.success) onClose(); }, [state?.success, onClose]);
  const isShift = entity === "shift";

  return (
    <form action={action} className="master-editor">
      <input type="hidden" name="entity" value={entity}/>
      {row && <input type="hidden" name="id" value={row.id}/>} 
      <div className="master-editor-title"><div><strong>{row ? "Edit" : "Add"} {entity}</strong><span>Data ini akan dipakai pada perhitungan berikutnya.</span></div><button type="button" className="text-button" onClick={onClose}>Cancel</button></div>
      <div className={`master-fields ${isShift ? "master-fields--shift" : ""}`}>
        {isShift ? <ShiftFields row={row}/> : <>
          <label className="field"><span>Code</span><input name="code" defaultValue={String(row?.code ?? "")} placeholder="e.g. AC-18K" maxLength={30} required/></label>
          <label className="field"><span>Name</span><input name="name" defaultValue={String(row?.name ?? "")} placeholder="Descriptive name" maxLength={100} required/></label>
          {entity === "station" && <><label className="field"><span>Production line</span><select name="lineId" defaultValue={String(row?.line_id ?? "")} required><option value="" disabled>Select line</option>{lines.map((line) => <option key={line.id} value={line.id}>{line.code} · {line.name}</option>)}</select></label><label className="field"><span>Sequence</span><input name="sequence" type="number" min="1" step="1" defaultValue={String(row?.sequence ?? 1)} required/></label></>}
          {entity === "process" && <label className="field"><span>Time type</span><select name="timeType" defaultValue={String(row?.time_type ?? "manual")}><option value="manual">Manual</option><option value="machine_automatic">Machine automatic</option></select></label>}
        </>}
        <div className="master-save"><SubmitButton>{row ? "Save changes" : "Create"}</SubmitButton></div>
      </div>
      {state?.error && <p className="form-error">{state.error}</p>}
    </form>
  );
}

function ShiftFields({ row }: { row: MasterRow | null }) {
  const minutes = (key: string, fallback = 0) => String(Number(row?.[key] ?? fallback) / 60);
  return <><label className="field"><span>Name</span><input name="name" defaultValue={String(row?.name ?? "")} placeholder="Shift 1" required/></label><label className="field"><span>Duration (min)</span><input name="durationMinutes" type="number" min="1" step="1" defaultValue={minutes("duration_seconds", 28800)} required/></label><label className="field"><span>Break</span><input name="breakMinutes" type="number" min="0" step="1" defaultValue={minutes("break_seconds")}/></label><label className="field"><span>Meeting</span><input name="meetingMinutes" type="number" min="0" step="1" defaultValue={minutes("meeting_seconds")}/></label><label className="field"><span>Setup</span><input name="setupMinutes" type="number" min="0" step="1" defaultValue={minutes("setup_seconds")}/></label><label className="field"><span>Other stop</span><input name="otherStopMinutes" type="number" min="0" step="1" defaultValue={minutes("other_stop_seconds")}/></label></>;
}

function MasterHead({ entity, canManage }: { entity: MasterEntity; canManage: boolean }) {
  if (entity === "shift") return <tr><th>Name</th><th className="num">Duration</th><th className="num">Planned stops</th><th className="num">Available</th>{canManage && <th/>}</tr>;
  return <tr><th>Code</th><th>Name</th>{entity === "station" && <><th>Line</th><th className="num">Sequence</th></>}{entity === "process" && <th>Time type</th>}{canManage && <th/>}</tr>;
}

function MasterTableRow({ entity, row, canManage, onEdit }: { entity: MasterEntity; row: MasterRow; canManage: boolean; onEdit: () => void }) {
  const stops = Number(row.break_seconds ?? 0) + Number(row.meeting_seconds ?? 0) + Number(row.setup_seconds ?? 0) + Number(row.other_stop_seconds ?? 0);
  return <tr>{entity === "shift" ? <><td><strong>{row.name}</strong></td><td className="num">{formatMinutes(Number(row.duration_seconds))}</td><td className="num">{formatMinutes(stops)}</td><td className="num"><strong>{formatMinutes(Number(row.duration_seconds) - stops)}</strong></td></> : <><td><strong className="master-code">{row.code}</strong></td><td>{row.name}</td>{entity === "station" && <><td>{row.line_code}</td><td className="num">{row.sequence}</td></>}{entity === "process" && <td>{row.time_type === "machine_automatic" ? "Machine automatic" : "Manual"}</td>}</>}{canManage && <td><div className="master-row-actions"><button type="button" className="text-button" onClick={onEdit}>Edit</button><form action={deactivateMasterData} onSubmit={(event) => { if (!confirm("Deactivate this master record? Existing historical records will be preserved.")) event.preventDefault(); }}><input type="hidden" name="entity" value={entity}/><input type="hidden" name="id" value={row.id}/><button className="text-button text-button--danger" type="submit">Deactivate</button></form></div></td>}</tr>;
}

function formatMinutes(seconds: number) {
  return `${Math.round(seconds / 60)} min`;
}
