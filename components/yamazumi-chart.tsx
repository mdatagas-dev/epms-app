"use client";

import { useState, type CSSProperties } from "react";

import { buildYamazumiSeries } from "@/lib/engineering";

type Row = { station_code: string; process_code: string; process_name: string; time_type: string; standard_time_seconds: string };
type Scenario = { id: string; scenario_number: string; name: string; target_quantity: number; takt_time_seconds: string; status: string };

export function YamazumiChart({ rows, scenarios }: { rows: Row[]; scenarios: Scenario[] }) {
  const [scenarioId, setScenarioId] = useState(scenarios[0]?.id ?? "");
  const scenario = scenarios.find((item) => item.id === scenarioId);

  if (!scenario) return <div className="yamazumi-empty"><strong>Takt line not available</strong><p>Create a Capacity scenario from this Line Balance to compare station load against demand.</p></div>;

  const series = buildYamazumiSeries(rows.map((row) => ({ stationCode: row.station_code, processCode: row.process_code, timeType: row.time_type, seconds: Number(row.standard_time_seconds) })), Number(scenario.takt_time_seconds));
  const overloaded = series.stations.filter((station) => station.status === "overloaded");
  const style = { "--station-count": series.stations.length, "--takt-position": `${series.taktPositionPct}%` } as CSSProperties;

  return <div className="yamazumi-chart">
    <div className="yamazumi-toolbar"><div><span>Capacity scenario</span><select aria-label="Capacity scenario for Yamazumi" value={scenarioId} onChange={(event) => setScenarioId(event.target.value)}>{scenarios.map((item) => <option key={item.id} value={item.id}>{item.scenario_number} · {item.target_quantity} units · {item.takt_time_seconds}s · {item.status}</option>)}</select></div><div className="yamazumi-legend"><span data-type="manual">Manual</span><span data-type="machine_automatic">Machine</span><span data-status="overloaded">Over takt</span></div></div>
    <div className="yamazumi-scroll" style={style}><div className="yamazumi-scroll-inner"><div className="yamazumi-plot" role="img" aria-label={`Yamazumi for ${scenario.name}, takt ${scenario.takt_time_seconds} seconds`}><div className="takt-line"><span>Takt {scenario.takt_time_seconds} sec</span></div><div className="yama-columns">{series.stations.map((station) => <div className="yama-column" key={station.code}><div className={`yama-bar yama-bar--${station.status}`} style={{ height: `${(station.totalSeconds / series.scaleSeconds) * 100}%` }}>{station.segments.map((segment) => <span key={segment.processCode} data-type={segment.timeType} style={{ flex: segment.seconds }} title={`${segment.processCode}: ${segment.seconds} sec`}/>)}</div></div>)}</div></div><div className="yama-labels">{series.stations.map((station) => <div className="yama-label" key={station.code}><strong>{station.totalSeconds.toFixed(2)} sec</strong><span>{station.code}</span><small data-status={station.status}>{station.status === "underloaded" ? "Idle capacity" : station.status === "overloaded" ? `+${station.excessSeconds.toFixed(2)} sec` : "Within takt"}</small></div>)}</div></div></div>
    <div className={`yamazumi-guidance ${overloaded.length ? "yamazumi-guidance--warn" : ""}`}><strong>{overloaded.length ? `${overloaded.length} overloaded station${overloaded.length > 1 ? "s" : ""}` : "All stations within takt"}</strong><p>{overloaded.length ? overloaded.map((station) => `${station.code} exceeds takt by ${station.excessSeconds.toFixed(2)} sec`).join(" · ") + ". Rebalance work elements before approving capacity." : "No station cycle time exceeds the selected scenario takt."}</p></div>
  </div>;
}
