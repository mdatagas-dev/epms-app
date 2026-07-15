"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { calculateLineScenario, calculateMotionSummary, calculateStandardTime, type CycleObservation, type MotionObservation } from "@/lib/engineering";
import { parseMasterInput, type MasterEntity } from "@/lib/master-data";
import { requireSupervisor, requireUser } from "@/lib/session";

export type ActionState = { error?: string } | undefined;
export type MasterActionState = { error?: string; success?: string } | undefined;

export async function saveMasterData(_: MasterActionState, formData: FormData): Promise<MasterActionState> {
  const supervisor = await requireSupervisor();
  const entity = masterEntity(formData);
  const id = String(formData.get("id") ?? "").trim();
  if (id && !isUuid(id)) return { error: "Master data ID is not valid." };

  try {
    const input = parseMasterInput(entity, Object.fromEntries(
      Array.from(formData.entries()).map(([key, value]) => [key, String(value)]),
    ));
    const result = await upsertMaster(entity, id, input);
    const action = id ? "updated" : "created";
    await recordActivity(db, supervisor.id, action, `master_${entity}`, result.id, `${result.label} ${action}.`);
    revalidateMasterPaths();
    return { success: `${result.label} ${id ? "updated" : "created"}.` };
  } catch (error) {
    if (isUniqueViolation(error)) return { error: "Code or name is already in use." };
    return { error: error instanceof Error ? error.message : "Master data could not be saved." };
  }
}

export async function deactivateMasterData(formData: FormData) {
  const supervisor = await requireSupervisor();
  const entity = masterEntity(formData);
  const id = required(formData, "id");
  if (!isUuid(id)) throw new Error("Master data ID is not valid.");
  const tables: Record<MasterEntity, string> = {
    model: "product_models", line: "production_lines", station: "stations",
    process: "process_elements", shift: "shift_templates",
  };
  const result = await db.query(`UPDATE ${tables[entity]} SET active = false WHERE id = $1 AND active RETURNING id`, [id]);
  if (result.rowCount !== 1) throw new Error("Master data is already inactive or was not found.");
  await recordActivity(db, supervisor.id, "deactivated", `master_${entity}`, id, `${entity} master deactivated.`);
  revalidateMasterPaths();
}

export async function loginAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) return { error: "Account dan password wajib diisi." };

  try {
    await auth.api.signInEmail({ body: { email, password }, headers: await headers() });
  } catch {
    return { error: "Account atau password tidak sesuai." };
  }
  redirect("/dashboard");
}

export async function logoutAction() {
  await auth.api.signOut({ headers: await headers() });
  redirect("/login");
}

export async function createTimeStudy(formData: FormData) {
  const user = await requireUser();
  const modelId = required(formData, "modelId");
  const lineId = required(formData, "lineId");
  const processElementId = required(formData, "processElementId");
  const performanceRatingPct = numberField(formData, "performanceRatingPct");
  const allowancePct = numberField(formData, "allowancePct");
  const cycles = parseCycles(required(formData, "cycles"));
  calculateStandardTime({ cycles, performanceRatingPct, allowancePct });

  const client = await db.connect();
  let studyId = "";
  try {
    await client.query("BEGIN");
    const revisionResult = await client.query(`
      SELECT coalesce(max(revision), 0)::int + 1 AS revision FROM time_studies
      WHERE model_id = $1 AND line_id = $2 AND process_element_id = $3
    `, [modelId, lineId, processElementId]);
    const revision = revisionResult.rows[0].revision;
    const studyNumber = `TS-${Date.now()}`;
    const inserted = await client.query(`
      INSERT INTO time_studies
        (study_number, model_id, line_id, process_element_id, revision,
         performance_rating_pct, allowance_pct, justification, created_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id
    `, [studyNumber, modelId, lineId, processElementId, revision, performanceRatingPct,
      allowancePct, String(formData.get("justification") ?? "").trim() || null, user.id]);
    studyId = inserted.rows[0].id;
    for (const [index, cycle] of cycles.entries()) {
      await client.query(`
        INSERT INTO cycle_observations
          (time_study_id, cycle_number, observed_seconds, is_excluded, exclusion_reason)
        VALUES ($1,$2,$3,$4,$5)
      `, [studyId, index + 1, cycle.seconds, Boolean(cycle.excluded), cycle.exclusionReason ?? null]);
    }
    await recordActivity(client, user.id, "created", "time_study", studyId, `${studyNumber} dibuat dengan ${cycles.length} siklus.`);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
  redirect(`/time-studies/${studyId}`);
}

export async function createMotionStudy(formData: FormData) {
  const user = await requireUser();
  const name = required(formData, "name");
  const modelId = required(formData, "modelId");
  const lineId = required(formData, "lineId");
  const stationId = required(formData, "stationId");
  const observedAt = required(formData, "observedAt");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(observedAt)) throw new Error("Observation date is not valid.");
  const observations = parseMotionObservations(required(formData, "observations"));
  calculateMotionSummary(observations);

  const client = await db.connect();
  let studyId = "";
  try {
    await client.query("BEGIN");
    const context = await client.query(`
      SELECT s.id FROM stations s
      JOIN production_lines pl ON pl.id = s.line_id
      JOIN product_models pm ON pm.id = $1
      WHERE s.id = $2 AND s.line_id = $3 AND s.active AND pl.active AND pm.active
    `, [modelId, stationId, lineId]);
    if (context.rowCount !== 1) throw new Error("Model, line, or station context is not valid.");
    const studyNumber = `MS-${Date.now()}`;
    const inserted = await client.query(`
      INSERT INTO motion_studies (study_number, name, model_id, line_id, station_id, observed_at, note, created_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id
    `, [studyNumber, name, modelId, lineId, stationId, observedAt, String(formData.get("note") ?? "").trim() || null, user.id]);
    studyId = inserted.rows[0].id;
    for (const [index, observation] of observations.entries()) {
      await client.query(`
        INSERT INTO motion_observations
          (motion_study_id, sequence, description, category, value_class, observed_seconds)
        VALUES ($1,$2,$3,$4,$5,$6)
      `, [studyId, index + 1, observation.description, observation.category, observation.valueClass,
        observation.seconds]);
    }
    await recordActivity(client, user.id, "created", "motion_study", studyId, `${studyNumber} created with ${observations.length} observations.`);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
  redirect(`/motion-studies/${studyId}`);
}

export async function submitTimeStudy(formData: FormData) {
  const user = await requireUser();
  const id = required(formData, "id");
  const result = await db.query(`
    UPDATE time_studies SET status = 'submitted', submitted_at = now(), updated_at = now()
    WHERE id = $1 AND status = 'draft' RETURNING study_number
  `, [id]);
  if (result.rowCount !== 1) throw new Error("Time Study tidak dapat diajukan.");
  await recordActivity(db, user.id, "submitted", "time_study", id, `${result.rows[0].study_number} diajukan untuk approval.`);
  revalidatePath(`/time-studies/${id}`);
  revalidatePath("/dashboard");
}

export async function approveTimeStudy(formData: FormData) {
  const supervisor = await requireSupervisor();
  const id = required(formData, "id");
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const studyResult = await client.query("SELECT * FROM time_studies WHERE id = $1 FOR UPDATE", [id]);
    const study = studyResult.rows[0];
    if (!study || study.status !== "submitted") throw new Error("Time Study tidak menunggu approval.");
    if (study.created_by === supervisor.id) throw new Error("Pembuat tidak boleh menyetujui revisinya sendiri.");
    const cycleResult = await client.query("SELECT * FROM cycle_observations WHERE time_study_id = $1 ORDER BY cycle_number", [id]);
    const cycles = cycleResult.rows.map((cycle) => ({
      seconds: Number(cycle.observed_seconds),
      excluded: cycle.is_excluded,
      exclusionReason: cycle.exclusion_reason ?? undefined,
    }));
    const result = calculateStandardTime({
      cycles,
      performanceRatingPct: Number(study.performance_rating_pct),
      allowancePct: Number(study.allowance_pct),
    });
    const previous = await client.query(`
      UPDATE standard_time_revisions SET superseded_at = now()
      WHERE model_id = $1 AND line_id = $2 AND process_element_id = $3 AND superseded_at IS NULL
      RETURNING time_study_id
    `, [study.model_id, study.line_id, study.process_element_id]);
    if (previous.rowCount) {
      await client.query("UPDATE time_studies SET status = 'superseded' WHERE id = ANY($1::uuid[])", [previous.rows.map((row) => row.time_study_id)]);
    }
    await client.query(`
      INSERT INTO standard_time_revisions
        (time_study_id, model_id, line_id, process_element_id, revision,
         average_cycle_seconds, normal_time_seconds, standard_time_seconds,
         valid_cycle_count, approved_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
    `, [id, study.model_id, study.line_id, study.process_element_id, study.revision,
      result.averageCycleSeconds, result.normalTimeSeconds, result.standardTimeSeconds,
      result.validCycleCount, supervisor.id]);
    await client.query("UPDATE time_studies SET status = 'approved', approved_at = now(), approved_by = $2, updated_at = now() WHERE id = $1", [id, supervisor.id]);
    await recordActivity(client, supervisor.id, "approved", "time_study", id, `${study.study_number} disetujui menjadi Standard Time rev. ${study.revision}.`);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
  revalidatePath(`/time-studies/${id}`);
  revalidatePath("/dashboard");
}

export async function rejectTimeStudy(formData: FormData) {
  const supervisor = await requireSupervisor();
  const id = required(formData, "id");
  const comment = required(formData, "comment");
  const result = await db.query(`
    UPDATE time_studies SET status = 'draft', submitted_at = null, justification = $2, updated_at = now()
    WHERE id = $1 AND status = 'submitted' RETURNING study_number
  `, [id, comment]);
  if (result.rowCount !== 1) throw new Error("Time Study tidak dapat dikembalikan.");
  await recordActivity(db, supervisor.id, "rejected", "time_study", id, `${result.rows[0].study_number} dikembalikan: ${comment}`);
  revalidatePath(`/time-studies/${id}`);
  revalidatePath("/dashboard");
}

export async function createLineBalance(formData: FormData) {
  const user = await requireUser();
  const name = required(formData, "name");
  const modelId = required(formData, "modelId");
  const lineId = required(formData, "lineId");
  const assignments = JSON.parse(required(formData, "assignments")) as Array<{ stationId: string; standardTimeRevisionId: string }>;
  if (!Array.isArray(assignments) || assignments.length === 0) throw new Error("Minimal satu process element harus ditugaskan.");

  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const valid = await client.query(`
      SELECT count(*)::int AS count FROM standard_time_revisions
      WHERE id = ANY($1::uuid[]) AND model_id = $2 AND line_id = $3 AND superseded_at IS NULL
    `, [assignments.map((item) => item.standardTimeRevisionId), modelId, lineId]);
    if (valid.rows[0].count !== assignments.length) throw new Error("Assignment memakai Standard Time yang tidak valid.");
    const revision = (await client.query("SELECT coalesce(max(revision), 0)::int + 1 AS revision FROM line_balances WHERE model_id = $1 AND line_id = $2", [modelId, lineId])).rows[0].revision;
    const balance = await client.query(`
      INSERT INTO line_balances (name, model_id, line_id, revision, created_by)
      VALUES ($1,$2,$3,$4,$5) RETURNING id
    `, [name, modelId, lineId, revision, user.id]);
    for (const item of assignments) {
      await client.query("INSERT INTO line_balance_assignments (line_balance_id, station_id, standard_time_revision_id) VALUES ($1,$2,$3)", [balance.rows[0].id, item.stationId, item.standardTimeRevisionId]);
    }
    await recordActivity(client, user.id, "created", "line_balance", balance.rows[0].id, `${name} rev. ${revision} dibuat dengan ${assignments.length} process element.`);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
  revalidatePath("/line-balance");
}

export async function createCapacityScenario(formData: FormData) {
  const user = await requireUser();
  const name = required(formData, "name");
  const lineBalanceId = required(formData, "lineBalanceId");
  const shiftTemplateId = required(formData, "shiftTemplateId");
  const targetQuantity = numberField(formData, "targetQuantity");
  const [shiftResult, assignmentResult] = await Promise.all([
    db.query("SELECT * FROM shift_templates WHERE id = $1", [shiftTemplateId]),
    db.query(`
      SELECT s.id AS station_id, s.code AS station_code, pe.time_type,
             str.standard_time_seconds
      FROM line_balance_assignments lba
      JOIN stations s ON s.id = lba.station_id
      JOIN standard_time_revisions str ON str.id = lba.standard_time_revision_id
      JOIN process_elements pe ON pe.id = str.process_element_id
      WHERE lba.line_balance_id = $1 ORDER BY s.sequence
    `, [lineBalanceId]),
  ]);
  const shift = shiftResult.rows[0];
  if (!shift || assignmentResult.rowCount === 0) throw new Error("Line Balance atau Shift tidak valid.");
  const stations = Array.from(new Set(assignmentResult.rows.map((row) => row.station_id))).map((stationId) => {
    const rows = assignmentResult.rows.filter((row) => row.station_id === stationId);
    return {
      id: stationId,
      name: rows[0].station_code,
      elements: rows.map((row) => ({ seconds: Number(row.standard_time_seconds), type: row.time_type })),
    };
  });
  const result = calculateLineScenario({
    shiftSeconds: shift.duration_seconds,
    plannedStopSeconds: [shift.break_seconds, shift.meeting_seconds, shift.setup_seconds, shift.other_stop_seconds],
    targetQuantity,
    stations,
  });
  const bottleneck = stations.find((station) => station.name === result.bottleneckStation)!;
  const scenarioNumber = `SC-${Date.now()}`;
  const inserted = await db.query(`
    INSERT INTO capacity_scenarios
      (scenario_number, name, line_balance_id, shift_template_id, target_quantity,
       shift_seconds, break_seconds, meeting_seconds, setup_seconds, planned_downtime_seconds,
       available_time_seconds, takt_time_seconds, bottleneck_cycle_seconds,
       bottleneck_station_id, theoretical_capacity, theoretical_manpower,
       units_per_hour, loading_pct, time_utilization_pct,
       line_efficiency_pct, balance_loss_pct, created_by)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22) RETURNING id
  `, [scenarioNumber, name, lineBalanceId, shiftTemplateId, targetQuantity,
    shift.duration_seconds, shift.break_seconds, shift.meeting_seconds, shift.setup_seconds, shift.other_stop_seconds,
    result.availableTimeSeconds, result.taktTimeSeconds, result.bottleneckCycleSeconds,
    bottleneck.id, result.theoreticalCapacity, result.theoreticalManpower,
    result.unitsPerHour, result.loadingPct, result.timeUtilizationPct,
    result.lineEfficiencyPct, result.balanceLossPct, user.id]);
  await recordActivity(db, user.id, "created", "capacity_scenario", inserted.rows[0].id, `${scenarioNumber} dihitung untuk target ${targetQuantity} unit.`);
  revalidatePath("/scenarios");
  revalidatePath("/dashboard");
}

export async function submitScenario(formData: FormData) {
  const user = await requireUser();
  const id = required(formData, "id");
  const result = await db.query("UPDATE capacity_scenarios SET status = 'submitted' WHERE id = $1 AND status = 'draft' RETURNING scenario_number", [id]);
  if (result.rowCount !== 1) throw new Error("Scenario tidak dapat diajukan.");
  await recordActivity(db, user.id, "submitted", "capacity_scenario", id, `${result.rows[0].scenario_number} diajukan untuk approval.`);
  revalidatePath("/scenarios");
  revalidatePath("/dashboard");
}

export async function approveScenario(formData: FormData) {
  const supervisor = await requireSupervisor();
  const id = required(formData, "id");
  const result = await db.query(`
    UPDATE capacity_scenarios SET status = 'approved', approved_by = $2, approved_at = now()
    WHERE id = $1 AND status = 'submitted' AND created_by <> $2 RETURNING scenario_number
  `, [id, supervisor.id]);
  if (result.rowCount !== 1) throw new Error("Scenario tidak dapat disetujui oleh user ini.");
  await recordActivity(db, supervisor.id, "approved", "capacity_scenario", id, `${result.rows[0].scenario_number} disetujui.`);
  revalidatePath("/scenarios");
  revalidatePath("/dashboard");
}

async function upsertMaster(entity: MasterEntity, id: string, input: ReturnType<typeof parseMasterInput>) {
  const values = input as Record<string, string | number>;
  let result;
  if (entity === "model") {
    result = id
      ? await db.query("UPDATE product_models SET code = $2, name = $3 WHERE id = $1 AND active RETURNING id, code AS label", [id, values.code, values.name])
      : await db.query("INSERT INTO product_models (code, name) VALUES ($1,$2) RETURNING id, code AS label", [values.code, values.name]);
  } else if (entity === "line") {
    result = id
      ? await db.query("UPDATE production_lines SET code = $2, name = $3 WHERE id = $1 AND active RETURNING id, code AS label", [id, values.code, values.name])
      : await db.query("INSERT INTO production_lines (code, name) VALUES ($1,$2) RETURNING id, code AS label", [values.code, values.name]);
  } else if (entity === "station") {
    result = id
      ? await db.query("UPDATE stations SET line_id = $2, code = $3, name = $4, sequence = $5 WHERE id = $1 AND active RETURNING id, code AS label", [id, values.lineId, values.code, values.name, values.sequence])
      : await db.query("INSERT INTO stations (line_id, code, name, sequence) VALUES ($1,$2,$3,$4) RETURNING id, code AS label", [values.lineId, values.code, values.name, values.sequence]);
  } else if (entity === "process") {
    result = id
      ? await db.query("UPDATE process_elements SET code = $2, name = $3, time_type = $4 WHERE id = $1 AND active RETURNING id, code AS label", [id, values.code, values.name, values.timeType])
      : await db.query("INSERT INTO process_elements (code, name, time_type) VALUES ($1,$2,$3) RETURNING id, code AS label", [values.code, values.name, values.timeType]);
  } else {
    const shiftValues = [values.name, values.durationSeconds, values.breakSeconds, values.meetingSeconds, values.setupSeconds, values.otherStopSeconds];
    result = id
      ? await db.query(`UPDATE shift_templates SET name = $2, duration_seconds = $3, break_seconds = $4,
          meeting_seconds = $5, setup_seconds = $6, other_stop_seconds = $7
          WHERE id = $1 AND active RETURNING id, name AS label`, [id, ...shiftValues])
      : await db.query(`INSERT INTO shift_templates
          (name, duration_seconds, break_seconds, meeting_seconds, setup_seconds, other_stop_seconds)
          VALUES ($1,$2,$3,$4,$5,$6) RETURNING id, name AS label`, shiftValues);
  }
  if (result.rowCount !== 1) throw new Error("Active master data was not found.");
  return result.rows[0] as { id: string; label: string };
}

function masterEntity(formData: FormData): MasterEntity {
  const entity = String(formData.get("entity") ?? "");
  if (!(["model", "line", "station", "process", "shift"] as string[]).includes(entity)) {
    throw new Error("Master data type is not valid.");
  }
  return entity as MasterEntity;
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(value);
}

function isUniqueViolation(error: unknown): error is { code: string } {
  return typeof error === "object" && error !== null && "code" in error && error.code === "23505";
}

function revalidateMasterPaths() {
  for (const path of ["/master-data", "/time-studies/new", "/line-balance", "/scenarios"]) revalidatePath(path);
}

function parseCycles(raw: string): CycleObservation[] {
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { throw new Error("Data siklus tidak valid."); }
  if (!Array.isArray(parsed) || parsed.length > 100) throw new Error("Jumlah siklus harus antara 30 dan 100.");
  return parsed.map((item) => {
    if (typeof item !== "object" || item === null || !("seconds" in item)) throw new Error("Data siklus tidak valid.");
    const cycle = item as CycleObservation;
    return { seconds: Number(cycle.seconds), excluded: Boolean(cycle.excluded), exclusionReason: cycle.exclusionReason };
  });
}

type StoredMotionObservation = MotionObservation & { description: string };
function parseMotionObservations(raw: string): StoredMotionObservation[] {
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { throw new Error("Motion observations are not valid."); }
  if (!Array.isArray(parsed) || parsed.length === 0 || parsed.length > 200) throw new Error("Motion Study requires 1–200 observations.");
  return parsed.map((item) => {
    if (typeof item !== "object" || item === null) throw new Error("Motion observation is not valid.");
    const rawItem = item as Record<string, unknown>;
    const description = String(rawItem.description ?? "").trim();
    if (!description || description.length > 150) throw new Error("Each motion requires a description of at most 150 characters.");
    return {
      description,
      category: String(rawItem.category ?? "") as MotionObservation["category"],
      valueClass: String(rawItem.valueClass ?? "") as MotionObservation["valueClass"],
      seconds: Number(rawItem.seconds),
    };
  });
}

function required(formData: FormData, name: string) {
  const value = String(formData.get(name) ?? "").trim();
  if (!value) throw new Error(`${name} wajib diisi.`);
  return value;
}

function numberField(formData: FormData, name: string) {
  const value = Number(required(formData, name));
  if (!Number.isFinite(value)) throw new Error(`${name} harus berupa angka.`);
  return value;
}

type Queryable = { query: (text: string, values?: unknown[]) => Promise<unknown> };
async function recordActivity(dbClient: Queryable, actorId: string, action: string, entityType: string, entityId: string, summary: string) {
  await dbClient.query(`
    INSERT INTO activities (actor_id, action, entity_type, entity_id, summary)
    VALUES ($1,$2,$3,$4,$5)
  `, [actorId, action, entityType, entityId, summary]);
}
