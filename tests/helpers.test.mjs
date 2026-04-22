import { test } from "node:test";
import { strict as assert } from "node:assert";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const {
  pad, toMin, fmt, todayISO,
  collapseBlocks, levelFor, scheduleAgeDays,
  icsEscape, icsUTCStamp,
} = require("../lib/helpers.js");

test("pad", () => {
  assert.equal(pad(0), "00");
  assert.equal(pad(9), "09");
  assert.equal(pad(10), "10");
  assert.equal(pad(123), "123");
});

test("toMin", () => {
  assert.equal(toMin("00:00"), 0);
  assert.equal(toMin("05:00"), 300);
  assert.equal(toMin("23:45"), 23 * 60 + 45);
  assert.equal(toMin("24:00"), 24 * 60);
});

test("fmt", () => {
  assert.equal(fmt(0), "00:00");
  assert.equal(fmt(300), "05:00");
  assert.equal(fmt(23 * 60 + 45), "23:45");
  assert.equal(fmt(60), "01:00");
  assert.equal(fmt(7), "00:07");
});

test("todayISO", () => {
  assert.equal(todayISO(new Date(2026, 0, 1)), "2026-01-01");
  assert.equal(todayISO(new Date(2026, 11, 31)), "2026-12-31");
  assert.equal(todayISO(new Date(2025, 2, 5)), "2025-03-05");
});

test("collapseBlocks: empty input yields no blocks", () => {
  assert.deepEqual(collapseBlocks([0, 0, 0], 15, 300), []);
  assert.deepEqual(collapseBlocks([], 15, 0), []);
});

test("collapseBlocks: merges consecutive equal lane counts", () => {
  const blocks = collapseBlocks([0, 0, 3, 3, 3, 0, 2, 2, 0], 15, 300);
  assert.deepEqual(blocks, [
    { startMin: 330, endMin: 375, lanes: 3 },
    { startMin: 390, endMin: 420, lanes: 2 },
  ]);
});

test("collapseBlocks: splits on changed lane count even when adjacent", () => {
  const blocks = collapseBlocks([2, 2, 3, 3, 1], 15, 0);
  assert.deepEqual(blocks, [
    { startMin: 0, endMin: 30, lanes: 2 },
    { startMin: 30, endMin: 60, lanes: 3 },
    { startMin: 60, endMin: 75, lanes: 1 },
  ]);
});

test("levelFor: 25 % quartiles against max", () => {
  assert.equal(levelFor(0, 4), 0);
  assert.equal(levelFor(-1, 4), 0);
  assert.equal(levelFor(1, 4), 1);
  assert.equal(levelFor(2, 4), 2);
  assert.equal(levelFor(3, 4), 3);
  assert.equal(levelFor(4, 4), 4);
});

test("levelFor: scales with maxLanes (50 m pool, max 8)", () => {
  assert.equal(levelFor(1, 8), 1);
  assert.equal(levelFor(2, 8), 1);
  assert.equal(levelFor(3, 8), 2);
  assert.equal(levelFor(4, 8), 2);
  assert.equal(levelFor(5, 8), 3);
  assert.equal(levelFor(6, 8), 3);
  assert.equal(levelFor(7, 8), 4);
  assert.equal(levelFor(8, 8), 4);
});

test("scheduleAgeDays: returns calendar-day diff", () => {
  const now = new Date(2026, 3, 21);
  assert.equal(scheduleAgeDays("2026-04-21", now), 0);
  assert.equal(scheduleAgeDays("2026-04-20", now), 1);
  assert.equal(scheduleAgeDays("2026-04-18", now), 3);
  assert.equal(scheduleAgeDays("2026-04-01", now), 20);
});

test("scheduleAgeDays: null for missing / malformed input", () => {
  const now = new Date(2026, 3, 21);
  assert.equal(scheduleAgeDays(null, now), null);
  assert.equal(scheduleAgeDays(undefined, now), null);
  assert.equal(scheduleAgeDays("", now), null);
  assert.equal(scheduleAgeDays("not a date", now), null);
  assert.equal(scheduleAgeDays("2026/04/21", now), null);
});

test("scheduleAgeDays: ignores wall-clock time of day", () => {
  const morning = new Date(2026, 3, 21, 6, 0, 0);
  const evening = new Date(2026, 3, 21, 23, 59, 0);
  assert.equal(scheduleAgeDays("2026-04-21", morning), 0);
  assert.equal(scheduleAgeDays("2026-04-21", evening), 0);
});

test("scheduleAgeDays: accepts date+time (space or T separator)", () => {
  const now = new Date(2026, 3, 21);
  assert.equal(scheduleAgeDays("2026-04-21 06:37", now), 0);
  assert.equal(scheduleAgeDays("2026-04-20 23:59", now), 1);
  assert.equal(scheduleAgeDays("2026-04-18T04:17Z", now), 3);
  assert.equal(scheduleAgeDays("2026-04-21T06:37:00+02:00", now), 0);
});

test("icsEscape", () => {
  assert.equal(icsEscape("a;b,c\nd\\e"), "a\\;b\\,c\\nd\\\\e");
  assert.equal(icsEscape("plain"), "plain");
});

test("icsUTCStamp", () => {
  const d = new Date(Date.UTC(2026, 3, 21, 17, 30, 15));
  assert.equal(icsUTCStamp(d), "20260421T173015Z");
});
