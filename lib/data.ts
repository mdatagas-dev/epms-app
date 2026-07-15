import "server-only";

import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";

export async function getDashboardData() {
  await requireUser();
  const [scenario, pending, activities, standards] = await Promise.all([
    db.query(`
      SELECT cs.*, lb.name AS balance_name, pm.code AS model_code, pl.code AS line_code,
             st.code AS bottleneck_station
      FROM capacity_scenarios cs
      JOIN line_balances lb ON lb.id = cs.line_balance_id
      JOIN product_models pm ON pm.id = lb.model_id
      JOIN production_lines pl ON pl.id = lb.line_id
      JOIN stations st ON st.id = cs.bottleneck_station_id
      WHERE cs.status = 'approved'
      ORDER BY cs.created_at DESC LIMIT 1
    `),
    db.query(`
      SELECT
        (SELECT count(*) FROM time_studies WHERE status = 'submitted')::int AS studies,
        (SELECT count(*) FROM capacity_scenarios WHERE status = 'submitted')::int AS scenarios
    `),
    db.query(`
      SELECT a.*, u.name AS actor_name
      FROM activities a JOIN "user" u ON u.id = a.actor_id
      ORDER BY a.created_at DESC LIMIT 8
    `),
    db.query(`
      SELECT str.id, pe.code, pe.name, pm.code AS model_code, pl.code AS line_code,
             str.revision, str.standard_time_seconds, str.effective_at
      FROM standard_time_revisions str
      JOIN process_elements pe ON pe.id = str.process_element_id
      JOIN product_models pm ON pm.id = str.model_id
      JOIN production_lines pl ON pl.id = str.line_id
      WHERE str.superseded_at IS NULL
      ORDER BY str.effective_at DESC LIMIT 6
    `),
  ]);

  return {
    scenario: scenario.rows[0] ?? null,
    pending: pending.rows[0],
    activities: activities.rows,
    standards: standards.rows,
  };
}

export async function getMasterData() {
  await requireUser();
  const [models, lines, stations, elements, shifts] = await Promise.all([
    db.query("SELECT id, code, name FROM product_models WHERE active ORDER BY code"),
    db.query("SELECT id, code, name FROM production_lines WHERE active ORDER BY code"),
    db.query(`SELECT s.id, s.code, s.name, s.line_id, s.sequence, pl.code AS line_code
              FROM stations s JOIN production_lines pl ON pl.id = s.line_id
              WHERE s.active ORDER BY pl.code, s.sequence`),
    db.query("SELECT id, code, name, time_type FROM process_elements WHERE active ORDER BY code"),
    db.query("SELECT * FROM shift_templates WHERE active ORDER BY name"),
  ]);
  return {
    models: models.rows,
    lines: lines.rows,
    stations: stations.rows,
    elements: elements.rows,
    shifts: shifts.rows,
  };
}

export async function getTimeStudies() {
  await requireUser();
  const result = await db.query(`
    SELECT ts.*, pm.code AS model_code, pl.code AS line_code, pe.code AS process_code,
           pe.name AS process_name, u.name AS creator_name,
           count(co.id)::int AS cycle_count,
           count(co.id) FILTER (WHERE NOT co.is_excluded)::int AS valid_cycle_count
    FROM time_studies ts
    JOIN product_models pm ON pm.id = ts.model_id
    JOIN production_lines pl ON pl.id = ts.line_id
    JOIN process_elements pe ON pe.id = ts.process_element_id
    JOIN "user" u ON u.id = ts.created_by
    LEFT JOIN cycle_observations co ON co.time_study_id = ts.id
    GROUP BY ts.id, pm.code, pl.code, pe.code, pe.name, u.name
    ORDER BY ts.created_at DESC
  `);
  return result.rows;
}

export async function getMotionStudies() {
  await requireUser();
  const result = await db.query(`
    SELECT ms.*, pm.code AS model_code, pl.code AS line_code, s.code AS station_code,
           u.name AS creator_name, count(mo.id)::int AS observation_count,
           coalesce(sum(mo.observed_seconds), 0) AS total_seconds,
           coalesce(sum(mo.observed_seconds) FILTER (WHERE mo.value_class = 'nva'), 0) AS nva_seconds
    FROM motion_studies ms
    JOIN product_models pm ON pm.id = ms.model_id
    JOIN production_lines pl ON pl.id = ms.line_id
    JOIN stations s ON s.id = ms.station_id
    JOIN "user" u ON u.id = ms.created_by
    LEFT JOIN motion_observations mo ON mo.motion_study_id = ms.id
    GROUP BY ms.id, pm.code, pl.code, s.code, u.name
    ORDER BY ms.created_at DESC
  `);
  return result.rows;
}

export async function getMotionStudy(id: string) {
  await requireUser();
  const [study, observations] = await Promise.all([
    db.query(`
      SELECT ms.*, pm.code AS model_code, pm.name AS model_name, pl.code AS line_code,
             s.code AS station_code, s.name AS station_name, u.name AS creator_name
      FROM motion_studies ms
      JOIN product_models pm ON pm.id = ms.model_id
      JOIN production_lines pl ON pl.id = ms.line_id
      JOIN stations s ON s.id = ms.station_id
      JOIN "user" u ON u.id = ms.created_by
      WHERE ms.id = $1
    `, [id]),
    db.query("SELECT * FROM motion_observations WHERE motion_study_id = $1 ORDER BY sequence", [id]),
  ]);
  return { study: study.rows[0] ?? null, observations: observations.rows };
}

export async function getTimeStudy(id: string) {
  await requireUser();
  const [study, cycles, standard] = await Promise.all([
    db.query(`
      SELECT ts.*, pm.code AS model_code, pm.name AS model_name, pl.code AS line_code,
             pe.code AS process_code, pe.name AS process_name, u.name AS creator_name
      FROM time_studies ts
      JOIN product_models pm ON pm.id = ts.model_id
      JOIN production_lines pl ON pl.id = ts.line_id
      JOIN process_elements pe ON pe.id = ts.process_element_id
      JOIN "user" u ON u.id = ts.created_by
      WHERE ts.id = $1
    `, [id]),
    db.query("SELECT * FROM cycle_observations WHERE time_study_id = $1 ORDER BY cycle_number", [id]),
    db.query("SELECT * FROM standard_time_revisions WHERE time_study_id = $1", [id]),
  ]);
  return { study: study.rows[0] ?? null, cycles: cycles.rows, standard: standard.rows[0] ?? null };
}

export async function getLineBalanceData() {
  const masters = await getMasterData();
  const [standards, balances, assignments] = await Promise.all([
    db.query(`
      SELECT str.id, str.model_id, str.line_id, str.process_element_id, str.revision,
             str.standard_time_seconds, pe.code, pe.name, pe.time_type,
             pm.code AS model_code, pl.code AS line_code
      FROM standard_time_revisions str
      JOIN process_elements pe ON pe.id = str.process_element_id
      JOIN product_models pm ON pm.id = str.model_id
      JOIN production_lines pl ON pl.id = str.line_id
      WHERE str.superseded_at IS NULL ORDER BY pe.code
    `),
    db.query(`
      SELECT lb.*, pm.code AS model_code, pl.code AS line_code, count(lba.id)::int AS element_count
      FROM line_balances lb
      JOIN product_models pm ON pm.id = lb.model_id
      JOIN production_lines pl ON pl.id = lb.line_id
      LEFT JOIN line_balance_assignments lba ON lba.line_balance_id = lb.id
      GROUP BY lb.id, pm.code, pl.code ORDER BY lb.created_at DESC
    `),
    db.query(`
      SELECT lba.line_balance_id, s.id AS station_id, s.code AS station_code, s.name AS station_name,
             pe.code AS process_code, pe.name AS process_name, pe.time_type,
             str.standard_time_seconds
      FROM line_balance_assignments lba
      JOIN stations s ON s.id = lba.station_id
      JOIN standard_time_revisions str ON str.id = lba.standard_time_revision_id
      JOIN process_elements pe ON pe.id = str.process_element_id
      ORDER BY s.sequence, pe.code
    `),
  ]);
  return { ...masters, standards: standards.rows, balances: balances.rows, assignments: assignments.rows };
}

export async function getScenarioData() {
  const masters = await getMasterData();
  const [balances, scenarios] = await Promise.all([
    db.query(`
      SELECT lb.id, lb.name, lb.model_id, lb.line_id, pm.code AS model_code, pl.code AS line_code
      FROM line_balances lb
      JOIN product_models pm ON pm.id = lb.model_id
      JOIN production_lines pl ON pl.id = lb.line_id
      ORDER BY lb.created_at DESC
    `),
    db.query(`
      SELECT cs.*, lb.name AS balance_name, pm.code AS model_code, pl.code AS line_code,
             st.code AS bottleneck_station
      FROM capacity_scenarios cs
      JOIN line_balances lb ON lb.id = cs.line_balance_id
      JOIN product_models pm ON pm.id = lb.model_id
      JOIN production_lines pl ON pl.id = lb.line_id
      JOIN stations st ON st.id = cs.bottleneck_station_id
      ORDER BY cs.created_at DESC
    `),
  ]);
  return { ...masters, balances: balances.rows, scenarios: scenarios.rows };
}
