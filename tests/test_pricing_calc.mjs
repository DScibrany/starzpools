import { test } from "node:test";
import { strict as assert } from "node:assert";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);
const PC = require("../lib/pricing-calc.js");

const HERE = dirname(fileURLToPath(import.meta.url));
const PRICING = JSON.parse(readFileSync(join(HERE, "..", "pricing.json"), "utf8"));

test("parsePriceValue: basic decimal forms", () => {
  assert.equal(PC.parsePriceValue("4,00"), 4);
  assert.equal(PC.parsePriceValue("13,50"), 13.5);
  assert.equal(PC.parsePriceValue("0,50"), 0.5);
  assert.equal(PC.parsePriceValue("100"), 100);
});

test("parsePriceValue: takes the value after '=' for compound rows", () => {
  assert.equal(PC.parsePriceValue("8 × 30,00 = 240,00"), 240);
  assert.equal(PC.parsePriceValue("12 × 210,00 = 2520,00"), 2520);
});

test("parsePriceValue: returns null for empty or em-dash", () => {
  assert.equal(PC.parsePriceValue(""), null);
  assert.equal(PC.parsePriceValue("—"), null);
  assert.equal(PC.parsePriceValue(undefined), null);
  assert.equal(PC.parsePriceValue(null), null);
  assert.equal(PC.parsePriceValue("dohodou"), null);
});

test("formatEUR: Slovak comma decimal + currency suffix", () => {
  assert.equal(PC.formatEUR(4), "4,00 €");
  assert.equal(PC.formatEUR(13.5), "13,50 €");
  assert.equal(PC.formatEUR(0), "0,00 €");
  assert.equal(PC.formatEUR(null), "—");
  assert.equal(PC.formatEUR(NaN), "—");
});

test("isHoliday: respects pricing.holidays list", () => {
  assert.equal(PC.isHoliday({ holidays: ["2026-01-01"] }, "2026-01-01"), true);
  assert.equal(PC.isHoliday({ holidays: ["2026-01-01"] }, "2026-01-02"), false);
  assert.equal(PC.isHoliday({ holidays: [] }, "2026-01-01"), false);
  assert.equal(PC.isHoliday({}, "2026-01-01"), false);
});

test("bandFor: weekday peak window resolves to peak", () => {
  // 2026-05-07 is Thursday — workday
  assert.equal(PC.bandFor(PRICING, "2026-05-07", 7 * 60), "peak"); // 07:00
  assert.equal(PC.bandFor(PRICING, "2026-05-07", 16 * 60), "peak"); // 16:00
});

test("bandFor: weekday off-peak window resolves to offpeak", () => {
  assert.equal(PC.bandFor(PRICING, "2026-05-07", 12 * 60), "offpeak"); // 12:00
  assert.equal(PC.bandFor(PRICING, "2026-05-07", 21 * 60), "offpeak"); // 21:00
});

test("bandFor: weekend resolves to offpeak even in peak hours", () => {
  // 2026-05-09 is Saturday
  assert.equal(PC.bandFor(PRICING, "2026-05-09", 7 * 60), "offpeak");
  assert.equal(PC.bandFor(PRICING, "2026-05-09", 16 * 60), "offpeak");
});

test("bandFor: holiday resolves to offpeak in peak hours", () => {
  const pricing = { ...PRICING, holidays: ["2026-05-07"] };
  assert.equal(PC.bandFor(pricing, "2026-05-07", 16 * 60), "offpeak");
});

test("bandFor: outside selling hours", () => {
  assert.equal(PC.bandFor(PRICING, "2026-05-07", 3 * 60), "outside"); // 03:00
  assert.equal(PC.bandFor(PRICING, "2026-05-07", 23 * 60), "outside"); // 23:00
});

test("priceFor: peak/adult/60 on 50m → 6,00 €", () => {
  const p = PC.priceFor(PRICING, "50m", "peak", "adult", 60);
  assert.equal(p.code, "A3");
  assert.equal(p.value, 6);
  assert.equal(p.oldValue, 9);
});

test("priceFor: offpeak/adult/90 on 25m → 5,00 €", () => {
  const p = PC.priceFor(PRICING, "25m", "offpeak", "adult", 90);
  assert.equal(p.code, "A2");
  assert.equal(p.value, 5);
});

test("priceFor: peak/reduced/90 on 50m → 7,00 €", () => {
  const p = PC.priceFor(PRICING, "50m", "peak", "reduced", 90);
  assert.equal(p.code, "B4");
  assert.equal(p.value, 7);
});

test("isTransitional: 25m before transitionalUntil", () => {
  const p = { transitional: "x", transitionalUntil: "2026-01-11" };
  assert.equal(PC.isTransitional(p, "2025-12-31"), true);
  assert.equal(PC.isTransitional(p, "2026-01-11"), true);
  assert.equal(PC.isTransitional(p, "2026-01-12"), false);
});

test("calculate: peak workday adult 60min on 50m", () => {
  const r = PC.calculate(PRICING, {
    pool: "50m", category: "adult", duration: 60,
    iso: "2026-05-07", minOfDay: 16 * 60,
  });
  assert.equal(r.band, "peak");
  assert.equal(r.value, 6);
  assert.equal(r.code, "A3");
  assert.equal(r.error, undefined);
});

test("calculate: offpeak weekend reduced 90min on 25m", () => {
  // 2026-05-09 is Saturday, past transitional end → normal pricing
  const r = PC.calculate(PRICING, {
    pool: "25m", category: "reduced", duration: 90,
    iso: "2026-05-09", minOfDay: 11 * 60,
  });
  assert.equal(r.band, "offpeak");
  assert.equal(r.value, 4);
  assert.equal(r.code, "B2");
});

test("calculate: outside selling hours", () => {
  const r = PC.calculate(PRICING, {
    pool: "50m", category: "adult", duration: 60,
    iso: "2026-05-07", minOfDay: 3 * 60,
  });
  assert.equal(r.error, "outside");
  assert.equal(r.band, "outside");
});

test("calculate: 25m transitional uniform price overrides band", () => {
  const r = PC.calculate(PRICING, {
    pool: "25m", category: "adult", duration: 60,
    iso: "2025-12-23", minOfDay: 16 * 60,
  });
  assert.equal(r.transitional, true);
  assert.equal(r.value, 3);
  assert.equal(r.duration, 90);
});

test("calculate: 50m never gets transitional override", () => {
  const r = PC.calculate(PRICING, {
    pool: "50m", category: "adult", duration: 60,
    iso: "2025-12-23", minOfDay: 16 * 60,
  });
  assert.equal(r.transitional, undefined);
  assert.equal(r.band, "peak");
  assert.equal(r.value, 6);
});

test("calculate: missing input returns error", () => {
  assert.equal(PC.calculate(null, {}).error, "no-pricing");
  assert.equal(PC.calculate(PRICING, {}).error, "missing-input");
  assert.equal(PC.calculate(PRICING, { pool: "50m" }).error, "missing-input");
});
