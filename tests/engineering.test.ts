import assert from "node:assert/strict";
import test from "node:test";

import { calculateLineScenario, calculateStandardTime } from "../lib/engineering.ts";
import { parseMasterInput } from "../lib/master-data.ts";
import * as engineering from "../lib/engineering.ts";

test("calculates standard time from 30 valid observed cycles", () => {
  const result = calculateStandardTime({
    cycles: Array.from({ length: 30 }, () => ({ seconds: 60 })),
    performanceRatingPct: 100,
    allowancePct: 10,
  });

  assert.equal(result.validCycleCount, 30);
  assert.equal(result.averageCycleSeconds, 60);
  assert.equal(result.normalTimeSeconds, 60);
  assert.equal(result.standardTimeSeconds, 66.67);
});

test("flags an outlier without silently excluding it", () => {
  const result = calculateStandardTime({
    cycles: [
      ...Array.from({ length: 29 }, () => ({ seconds: 60 })),
      { seconds: 180 },
    ],
    performanceRatingPct: 100,
    allowancePct: 10,
  });

  assert.deepEqual(result.outlierIndexes, [29]);
  assert.equal(result.validCycleCount, 30);
  assert.equal(result.averageCycleSeconds, 64);
});

test("rejects an excluded cycle without a reason", () => {
  assert.throws(
    () =>
      calculateStandardTime({
        cycles: [
          ...Array.from({ length: 30 }, () => ({ seconds: 60 })),
          { seconds: 180, excluded: true },
        ],
        performanceRatingPct: 100,
        allowancePct: 10,
      }),
    /alasan/i,
  );
});

test("calculates takt, bottleneck capacity, balance, and manual manpower", () => {
  const result = calculateLineScenario({
    shiftSeconds: 28_800,
    plannedStopSeconds: [3_600, 600, 900],
    targetQuantity: 300,
    stations: [
      {
        name: "S01",
        elements: [
          { seconds: 40, type: "manual" },
          { seconds: 10, type: "manual" },
        ],
      },
      {
        name: "S02",
        elements: [
          { seconds: 25, type: "manual" },
          { seconds: 45, type: "machine_automatic" },
        ],
      },
      {
        name: "S03",
        elements: [{ seconds: 55, type: "manual" }],
      },
    ],
  });

  assert.equal(result.availableTimeSeconds, 23_700);
  assert.equal(result.taktTimeSeconds, 79);
  assert.equal(result.bottleneckStation, "S02");
  assert.equal(result.bottleneckCycleSeconds, 70);
  assert.equal(result.theoreticalCapacity, 338);
  assert.equal(result.theoreticalManpower, 2);
  assert.equal(result.unitsPerHour, 51.43);
  assert.equal(result.loadingPct, 88.61);
  assert.equal(result.timeUtilizationPct, 82.29);
  assert.equal(result.lineEfficiencyPct, 83.33);
  assert.equal(result.balanceLossPct, 16.67);
});

test("normalizes master codes and rejects a shift with no production time", () => {
  assert.deepEqual(parseMasterInput("model", { code: " ac-18k ", name: " Split AC 18K " }), {
    code: "AC-18K",
    name: "Split AC 18K",
  });

  assert.throws(
    () => parseMasterInput("shift", { name: "Shift 1", durationMinutes: "60", breakMinutes: "60" }),
    /available production time/i,
  );
});

test("summarizes motion observations by value class and ranks NVA waste", () => {
  const calculateMotionSummary = (engineering as unknown as {
    calculateMotionSummary?: (observations: Array<{ category: string; valueClass: string; seconds: number }>) => unknown;
  }).calculateMotionSummary;
  assert.equal(typeof calculateMotionSummary, "function");

  assert.deepEqual(calculateMotionSummary!([
    { category: "picking", valueClass: "va", seconds: 30 },
    { category: "inspection", valueClass: "nnva", seconds: 10 },
    { category: "walking", valueClass: "nva", seconds: 15 },
    { category: "waiting", valueClass: "nva", seconds: 5 },
    { category: "walking", valueClass: "nva", seconds: 10 },
  ]), {
    totalSeconds: 70,
    vaSeconds: 30,
    nvaSeconds: 30,
    nnvaSeconds: 10,
    vaRatioPct: 42.86,
    nvaRatioPct: 42.86,
    nnvaRatioPct: 14.29,
    wasteByCategory: [
      { category: "walking", seconds: 25, ratioPct: 35.71 },
      { category: "waiting", seconds: 5, ratioPct: 7.14 },
    ],
  });
});

test("rejects a Motion Study without observations", () => {
  assert.throws(() => engineering.calculateMotionSummary([]), /observation/i);
});

test("rejects a motion observation with a non-positive duration", () => {
  assert.throws(() => engineering.calculateMotionSummary([
    { category: "walking", valueClass: "nva", seconds: 0 },
  ]), /duration/i);
});

test("rejects an unknown motion value class from untrusted input", () => {
  assert.throws(() => engineering.calculateMotionSummary([
    { category: "walking", valueClass: "productive" as never, seconds: 10 },
  ]), /value class/i);
});

test("rejects an unknown motion category from untrusted input", () => {
  assert.throws(() => engineering.calculateMotionSummary([
    { category: "other" as never, valueClass: "nva", seconds: 10 },
  ]), /category/i);
});

test("builds Yamazumi station status against scenario takt", () => {
  const buildYamazumiSeries = (engineering as unknown as {
    buildYamazumiSeries?: (rows: Array<{ stationCode: string; processCode: string; timeType: string; seconds: number }>, taktSeconds: number) => {
      scaleSeconds: number;
      taktPositionPct: number;
      stations: Array<{ code: string; totalSeconds: number; utilizationPct: number; status: string; excessSeconds: number }>;
    };
  }).buildYamazumiSeries;
  assert.equal(typeof buildYamazumiSeries, "function");

  const result = buildYamazumiSeries!([
    { stationCode: "S01", processCode: "P01", timeType: "manual", seconds: 20 },
    { stationCode: "S01", processCode: "P02", timeType: "machine_automatic", seconds: 20 },
    { stationCode: "S02", processCode: "P03", timeType: "manual", seconds: 55 },
    { stationCode: "S03", processCode: "P04", timeType: "manual", seconds: 65 },
  ], 60);

  assert.equal(result.scaleSeconds, 71.5);
  assert.equal(result.taktPositionPct, 83.92);
  assert.deepEqual(result.stations.map(({ code, totalSeconds, utilizationPct, status, excessSeconds }) => ({ code, totalSeconds, utilizationPct, status, excessSeconds })), [
    { code: "S01", totalSeconds: 40, utilizationPct: 66.67, status: "underloaded", excessSeconds: 0 },
    { code: "S02", totalSeconds: 55, utilizationPct: 91.67, status: "balanced", excessSeconds: 0 },
    { code: "S03", totalSeconds: 65, utilizationPct: 108.33, status: "overloaded", excessSeconds: 5 },
  ]);
});
