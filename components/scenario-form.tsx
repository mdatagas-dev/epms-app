import { createCapacityScenario } from "@/app/actions";
import { SubmitButton } from "@/components/submit-button";

type Balance = { id: string; name: string; model_code: string; line_code: string };
type Shift = { id: string; name: string; duration_seconds: number; break_seconds: number; meeting_seconds: number; setup_seconds: number; other_stop_seconds: number };

export function ScenarioForm({ balances, shifts }: { balances: Balance[]; shifts: Shift[] }) {
  return <form action={createCapacityScenario} className="panel form-panel"><div className="section-title"><span className="step-index">01</span><div><h2>Planning assumptions</h2><p>Shift losses and assigned Standard Time revisions are snapshotted.</p></div></div><div className="form-grid form-grid--4"><label className="field"><span>Scenario name</span><input name="name" placeholder="800 units — Shift 1" required/></label><label className="field"><span>Line Balance revision</span><select name="lineBalanceId" required defaultValue=""><option value="" disabled>Select balance</option>{balances.map((item) => <option key={item.id} value={item.id}>{item.model_code} · {item.line_code} · {item.name}</option>)}</select></label><label className="field"><span>Shift template</span><select name="shiftTemplateId" required defaultValue=""><option value="" disabled>Select shift</option>{shifts.map((item) => <option key={item.id} value={item.id}>{shiftLabel(item)}</option>)}</select></label><label className="field"><span>Demand / target</span><input name="targetQuantity" type="number" min="1" step="1" placeholder="800" required/></label></div><div className="form-actions"><p>Results remain theoretical until approved.</p><SubmitButton>Calculate capacity</SubmitButton></div></form>;
}

function shiftLabel(shift: Shift) {
  const minutes = (seconds: number) => Math.round(seconds / 60);
  const available = shift.duration_seconds - shift.break_seconds - shift.meeting_seconds - shift.setup_seconds - shift.other_stop_seconds;
  return `${shift.name} · ${minutes(shift.duration_seconds)}m − break ${minutes(shift.break_seconds)} − meeting ${minutes(shift.meeting_seconds)} − setup ${minutes(shift.setup_seconds)} − downtime ${minutes(shift.other_stop_seconds)} = ${minutes(available)}m`;
}
