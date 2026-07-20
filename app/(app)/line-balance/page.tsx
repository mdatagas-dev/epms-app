import { LineBalanceForm } from "@/components/line-balance-form";
import { YamazumiChart } from "@/components/yamazumi-chart";
import { getLineBalanceData } from "@/lib/data";

export default async function LineBalancePage() {
  const data = await getLineBalanceData();
  return <main className="page-shell"><div className="page-heading"><div><p className="eyebrow">Work distribution</p><h1>Line Balance & Yamazumi</h1><p className="page-subtitle">Assign approved process elements, then compare station load against a saved Capacity scenario.</p></div></div><LineBalanceForm models={data.models as never[]} lines={data.lines as never[]} stations={data.stations as never[]} standards={data.standards as never[]}/>
    <section className="balance-list">{data.balances.map((balance) => { const rows = data.assignments.filter((item) => item.line_balance_id === balance.id); const scenarios = data.scenarios.filter((item) => item.line_balance_id === balance.id); const stationCodes = [...new Set([...data.stations.flatMap((item) => item.line_id === balance.line_id ? [item.code] : []), ...rows.map((item) => item.station_code)])]; return <article className="panel yamazumi-card" key={balance.id}><div className="panel-heading"><div><p className="eyebrow">{balance.model_code} · {balance.line_code} · Revision {balance.revision}</p><h2>{balance.name}</h2></div><span>{balance.element_count} elements</span></div><YamazumiChart rows={rows as never[]} scenarios={scenarios as never[]} stationCodes={stationCodes}/></article>; })}{!data.balances.length && <div className="panel panel-empty panel-empty--large">No Line Balance yet. Approve Standard Time first.</div>}</section>
  </main>;
}
