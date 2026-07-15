export type MasterEntity = "model" | "line" | "station" | "process" | "shift";

type RawMasterInput = Record<string, string | undefined>;

export function parseMasterInput(entity: MasterEntity, raw: RawMasterInput) {
  if (entity === "shift") {
    const durationSeconds = minutesToSeconds(raw.durationMinutes, "Shift duration");
    const breakSeconds = minutesToSeconds(raw.breakMinutes, "Break", true);
    const meetingSeconds = minutesToSeconds(raw.meetingMinutes, "Meeting", true);
    const setupSeconds = minutesToSeconds(raw.setupMinutes, "Setup", true);
    const otherStopSeconds = minutesToSeconds(raw.otherStopMinutes, "Other stop", true);
    if (breakSeconds + meetingSeconds + setupSeconds + otherStopSeconds >= durationSeconds) {
      throw new Error("Shift must retain available production time after planned stops.");
    }
    return {
      name: cleanText(raw.name, "Shift name"),
      durationSeconds,
      breakSeconds,
      meetingSeconds,
      setupSeconds,
      otherStopSeconds,
    };
  }

  const common = {
    code: cleanCode(raw.code),
    name: cleanText(raw.name, "Name"),
  };
  if (entity === "model" || entity === "line") return common;
  if (entity === "station") {
    const sequence = Number(raw.sequence);
    if (!Number.isInteger(sequence) || sequence < 1) throw new Error("Station sequence must be a positive integer.");
    return { ...common, lineId: cleanId(raw.lineId, "Production line"), sequence };
  }
  if (raw.timeType !== "manual" && raw.timeType !== "machine_automatic") {
    throw new Error("Process time type is not valid.");
  }
  return { ...common, timeType: raw.timeType };
}

function cleanCode(value: string | undefined) {
  const code = String(value ?? "").trim().toUpperCase();
  if (!code) throw new Error("Code is required.");
  if (code.length > 30 || !/^[A-Z0-9_-]+$/.test(code)) {
    throw new Error("Code may contain only letters, numbers, hyphens, and underscores (max. 30 characters)." );
  }
  return code;
}

function cleanText(value: string | undefined, label: string) {
  const text = String(value ?? "").trim().replace(/\s+/g, " ");
  if (!text) throw new Error(`${label} is required.`);
  if (text.length > 100) throw new Error(`${label} may contain at most 100 characters.`);
  return text;
}

function cleanId(value: string | undefined, label: string) {
  const id = String(value ?? "").trim();
  if (!/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(id)) throw new Error(`${label} is not valid.`);
  return id;
}

function minutesToSeconds(value: string | undefined, label: string, allowEmpty = false) {
  const normalized = String(value ?? "").trim();
  if (!normalized && allowEmpty) return 0;
  const minutes = Number(normalized);
  if (!Number.isFinite(minutes) || minutes < 0 || (!allowEmpty && minutes <= 0)) {
    throw new Error(`${label} must be ${allowEmpty ? "zero or greater" : "greater than zero"}.`);
  }
  return Math.round(minutes * 60);
}
