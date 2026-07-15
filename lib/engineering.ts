export type CycleObservation = {
  seconds: number;
  excluded?: boolean;
  exclusionReason?: string;
};

type WorkElement = {
  seconds: number;
  type: "manual" | "machine_automatic";
};

type StationLoad = {
  name: string;
  elements: WorkElement[];
};

export type MotionCategory = "walking" | "searching" | "picking" | "holding" | "inspection" | "machine_time" | "waiting" | "transportation";
export type MotionValueClass = "va" | "nva" | "nnva";
export type MotionObservation = { category: MotionCategory; valueClass: MotionValueClass; seconds: number };
export const MOTION_CATEGORIES: MotionCategory[] = ["walking", "searching", "picking", "holding", "inspection", "machine_time", "waiting", "transportation"];
export const MOTION_VALUE_CLASSES: MotionValueClass[] = ["va", "nva", "nnva"];

export type YamazumiRow = { stationCode: string; processCode: string; timeType: string; seconds: number };

export function buildYamazumiSeries(rows: YamazumiRow[], taktSeconds: number, stationCodes: string[] = []) {
  if (!Number.isFinite(taktSeconds) || taktSeconds <= 0) throw new Error("Yamazumi takt must be greater than 0 seconds.");
  if (rows.length === 0 && stationCodes.length === 0) throw new Error("Yamazumi requires at least one station.");
  if (rows.some((row) => !Number.isFinite(row.seconds) || row.seconds <= 0)) throw new Error("Yamazumi element time must be greater than 0 seconds.");

  const grouped = new Map<string, YamazumiRow[]>(stationCodes.map((code) => [code, []]));
  for (const row of rows) grouped.set(row.stationCode, [...(grouped.get(row.stationCode) ?? []), row]);
  const stations = [...grouped.entries()].map(([code, segments]) => {
    const totalSeconds = segments.reduce((sum, segment) => sum + segment.seconds, 0);
    const utilizationPct = (totalSeconds / taktSeconds) * 100;
    return {
      code,
      totalSeconds: round(totalSeconds),
      utilizationPct: round(utilizationPct),
      status: utilizationPct > 100 ? "overloaded" as const : utilizationPct < 85 ? "underloaded" as const : "balanced" as const,
      excessSeconds: round(Math.max(totalSeconds - taktSeconds, 0)),
      segments,
    };
  });
  const scaleSeconds = round(Math.max(taktSeconds, ...stations.map((station) => station.totalSeconds)) * 1.1);

  return {
    scaleSeconds,
    taktPositionPct: round((taktSeconds / scaleSeconds) * 100),
    stations,
  };
}

export function calculateMotionSummary(observations: MotionObservation[]) {
  if (observations.length === 0) throw new Error("Minimal one motion observation is required.");
  if (observations.some((item) => !MOTION_CATEGORIES.includes(item.category))) throw new Error("Motion category is not valid.");
  if (observations.some((item) => !MOTION_VALUE_CLASSES.includes(item.valueClass))) throw new Error("Motion value class is not valid.");
  if (observations.some((item) => !Number.isFinite(item.seconds) || item.seconds <= 0)) {
    throw new Error("Motion duration must be greater than 0 seconds.");
  }
  const totalSeconds = observations.reduce((sum, item) => sum + item.seconds, 0);
  const secondsFor = (valueClass: MotionValueClass) => observations
    .filter((item) => item.valueClass === valueClass)
    .reduce((sum, item) => sum + item.seconds, 0);
  const vaSeconds = secondsFor("va");
  const nvaSeconds = secondsFor("nva");
  const nnvaSeconds = secondsFor("nnva");
  const wasteTotals = new Map<MotionCategory, number>();
  for (const item of observations.filter((item) => item.valueClass === "nva")) {
    wasteTotals.set(item.category, (wasteTotals.get(item.category) ?? 0) + item.seconds);
  }

  return {
    totalSeconds: round(totalSeconds),
    vaSeconds: round(vaSeconds),
    nvaSeconds: round(nvaSeconds),
    nnvaSeconds: round(nnvaSeconds),
    vaRatioPct: round((vaSeconds / totalSeconds) * 100),
    nvaRatioPct: round((nvaSeconds / totalSeconds) * 100),
    nnvaRatioPct: round((nnvaSeconds / totalSeconds) * 100),
    wasteByCategory: [...wasteTotals.entries()]
      .map(([category, seconds]) => ({ category, seconds: round(seconds), ratioPct: round((seconds / totalSeconds) * 100) }))
      .sort((a, b) => b.seconds - a.seconds),
  };
}

export function calculateStandardTime({
  cycles,
  performanceRatingPct,
  allowancePct,
}: {
  cycles: CycleObservation[];
  performanceRatingPct: number;
  allowancePct: number;
}) {
  const validCycles = cycles.filter((cycle) => !cycle.excluded);

  if (validCycles.length < 30) {
    throw new Error("Minimal 30 siklus valid diperlukan.");
  }

  if (cycles.some((cycle) => !Number.isFinite(cycle.seconds) || cycle.seconds <= 0)) {
    throw new Error("Cycle time harus lebih besar dari 0 detik.");
  }

  if (cycles.some((cycle) => cycle.excluded && !cycle.exclusionReason?.trim())) {
    throw new Error("Siklus yang dikecualikan wajib memiliki alasan.");
  }

  if (!Number.isFinite(performanceRatingPct) || performanceRatingPct <= 0) {
    throw new Error("Performance rating harus lebih besar dari 0%.");
  }

  if (!Number.isFinite(allowancePct) || allowancePct < 0 || allowancePct >= 100) {
    throw new Error("Allowance harus berada di antara 0% dan kurang dari 100%.");
  }

  const averageCycleSeconds =
    validCycles.reduce((total, cycle) => total + cycle.seconds, 0) / validCycles.length;
  const normalTimeSeconds = averageCycleSeconds * (performanceRatingPct / 100);
  const standardTimeSeconds = normalTimeSeconds / (1 - allowancePct / 100);
  const sortedSeconds = cycles.map((cycle) => cycle.seconds).sort((a, b) => a - b);
  const q1 = percentile(sortedSeconds, 0.25);
  const q3 = percentile(sortedSeconds, 0.75);
  const iqr = q3 - q1;
  const lowerBound = q1 - 1.5 * iqr;
  const upperBound = q3 + 1.5 * iqr;

  return {
    validCycleCount: validCycles.length,
    outlierIndexes: cycles.flatMap((cycle, index) =>
      cycle.seconds < lowerBound || cycle.seconds > upperBound ? [index] : [],
    ),
    averageCycleSeconds: round(averageCycleSeconds),
    normalTimeSeconds: round(normalTimeSeconds),
    standardTimeSeconds: round(standardTimeSeconds),
  };
}

export function calculateLineScenario({
  shiftSeconds,
  plannedStopSeconds,
  targetQuantity,
  stations,
}: {
  shiftSeconds: number;
  plannedStopSeconds: number[];
  targetQuantity: number;
  stations: StationLoad[];
}) {
  const availableTimeSeconds = shiftSeconds - plannedStopSeconds.reduce((sum, stop) => sum + stop, 0);

  if (!Number.isFinite(availableTimeSeconds) || availableTimeSeconds <= 0) {
    throw new Error("Available production time harus lebih besar dari 0 detik.");
  }

  if (!Number.isInteger(targetQuantity) || targetQuantity <= 0) {
    throw new Error("Target quantity harus berupa bilangan bulat positif.");
  }

  const activeStations = stations.filter((station) => station.elements.length > 0);
  if (activeStations.length === 0) {
    throw new Error("Minimal satu station aktif diperlukan.");
  }

  const stationLoads = activeStations.map((station) => ({
    name: station.name,
    seconds: station.elements.reduce((sum, element) => sum + element.seconds, 0),
  }));
  const bottleneck = stationLoads.reduce((slowest, station) =>
    station.seconds > slowest.seconds ? station : slowest,
  );

  if (!Number.isFinite(bottleneck.seconds) || bottleneck.seconds <= 0) {
    throw new Error("Cycle time station harus lebih besar dari 0 detik.");
  }

  const taktTimeSeconds = availableTimeSeconds / targetQuantity;
  const totalAssignedSeconds = stationLoads.reduce((sum, station) => sum + station.seconds, 0);
  const totalManualSeconds = activeStations.reduce(
    (sum, station) =>
      sum +
      station.elements
        .filter((element) => element.type === "manual")
        .reduce((stationSum, element) => stationSum + element.seconds, 0),
    0,
  );
  const lineEfficiency = totalAssignedSeconds / (activeStations.length * bottleneck.seconds);

  return {
    availableTimeSeconds,
    taktTimeSeconds: round(taktTimeSeconds),
    bottleneckStation: bottleneck.name,
    bottleneckCycleSeconds: round(bottleneck.seconds),
    theoreticalCapacity: Math.floor(availableTimeSeconds / bottleneck.seconds),
    theoreticalManpower: Math.ceil(totalManualSeconds / taktTimeSeconds),
    unitsPerHour: round(3600 / bottleneck.seconds),
    loadingPct: round((targetQuantity * bottleneck.seconds / availableTimeSeconds) * 100),
    timeUtilizationPct: round((availableTimeSeconds / shiftSeconds) * 100),
    lineEfficiencyPct: round(lineEfficiency * 100),
    balanceLossPct: round((1 - lineEfficiency) * 100),
    stationLoads,
  };
}

function round(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function percentile(sortedValues: number[], ratio: number) {
  const position = (sortedValues.length - 1) * ratio;
  const lowerIndex = Math.floor(position);
  const fraction = position - lowerIndex;
  const lower = sortedValues[lowerIndex];
  const upper = sortedValues[lowerIndex + 1] ?? lower;

  return lower + (upper - lower) * fraction;
}
