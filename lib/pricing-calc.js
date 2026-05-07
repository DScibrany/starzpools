(function (root) {
  function toMin(hhmm) {
    const [h, m] = hhmm.split(":").map(Number);
    return h * 60 + m;
  }

  function parsePriceValue(s) {
    if (typeof s !== "string") return null;
    const trimmed = s.trim();
    if (!trimmed || trimmed === "—") return null;
    const eqIdx = trimmed.lastIndexOf("=");
    const tail = eqIdx >= 0 ? trimmed.slice(eqIdx + 1) : trimmed;
    const m = /(-?\d+(?:[.,]\d+)?)/.exec(tail);
    if (!m) return null;
    const n = Number(m[1].replace(",", "."));
    return Number.isFinite(n) ? n : null;
  }

  function formatEUR(n, currency) {
    const cur = currency || "€";
    if (n == null || !Number.isFinite(n)) return "—";
    const s = n.toFixed(2).replace(".", ",");
    return `${s} ${cur}`;
  }

  function isHoliday(pricing, iso) {
    return Array.isArray(pricing?.holidays) && pricing.holidays.includes(iso);
  }

  function bandFor(pricing, iso, minOfDay) {
    if (!pricing?.bands || !iso) return "outside";
    const parts = iso.split("-").map(Number);
    if (parts.length !== 3 || parts.some(n => !Number.isFinite(n))) return "outside";
    const [y, mo, d] = parts;
    const dt = new Date(y, mo - 1, d);
    const dow = dt.getDay();
    const isWeekend = dow === 0 || dow === 6;
    const workday = !isWeekend && !isHoliday(pricing, iso);
    const inRange = (ranges) => ranges.some(([a, b]) => {
      const am = toMin(a), bm = toMin(b);
      return minOfDay >= am && minOfDay < bm;
    });
    if (workday) {
      for (const [name, def] of Object.entries(pricing.bands)) {
        if (inRange(def.ranges)) return name;
      }
      return "outside";
    }
    let nonWorkdayBand = null;
    for (const [name, def] of Object.entries(pricing.bands)) {
      if (!def.workdayOnly) { nonWorkdayBand = name; break; }
    }
    if (!nonWorkdayBand) return "outside";
    for (const def of Object.values(pricing.bands)) {
      if (inRange(def.ranges)) return nonWorkdayBand;
    }
    return "outside";
  }

  function findRow(pricing, code) {
    if (!code || !pricing?.sections) return null;
    for (const sec of pricing.sections) {
      for (const r of (sec.rows || [])) {
        if (r.code === code) return r;
      }
    }
    return null;
  }

  function priceFor(pricing, pool, band, category, duration) {
    const codes = pricing?.bandCodes?.[band]?.[category];
    if (!codes) return null;
    const code = codes[String(duration)];
    if (!code) return null;
    const row = findRow(pricing, code);
    if (!row) return null;
    const key = pool === "50m" ? "p50" : "p25";
    const oldKey = key + "Old";
    return {
      code,
      value: parsePriceValue(row[key]),
      oldValue: parsePriceValue(row[oldKey]),
      raw: row[key],
      rawOld: row[oldKey],
    };
  }

  function isTransitional(pricing, iso) {
    if (!pricing?.transitionalUntil || !pricing?.transitional || !iso) return false;
    return iso <= pricing.transitionalUntil;
  }

  function calculate(pricing, input) {
    if (!pricing) return { error: "no-pricing" };
    const { pool, category, duration, iso, minOfDay } = input || {};
    if (!pool || !category || !duration || !iso || minOfDay == null) {
      return { error: "missing-input" };
    }
    const holiday = isHoliday(pricing, iso);
    const band = bandFor(pricing, iso, minOfDay);
    if (band === "outside") return { error: "outside", band, holiday };

    if (pool === "25m" && isTransitional(pricing, iso)) {
      return {
        band, holiday,
        transitional: true,
        transitionalNote: pricing.transitional,
        value: 3.0,
        duration: 90,
        category,
        pool,
      };
    }

    const p = priceFor(pricing, pool, band, category, Number(duration));
    if (!p || p.value == null) return { error: "no-price", band, holiday };
    return {
      band, holiday,
      value: p.value,
      oldValue: p.oldValue,
      code: p.code,
      duration: Number(duration),
      category,
      pool,
    };
  }

  const api = {
    parsePriceValue, formatEUR, isHoliday, bandFor,
    findRow, priceFor, isTransitional, calculate,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  } else {
    root.PricingCalc = api;
  }
})(typeof window !== "undefined" ? window : globalThis);
