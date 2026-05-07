import { state, POOL_PAGE } from "./state.js";
import { t } from "./i18n.js";

const { pad, toMin, fmt, todayISO } = window;
const PC = window.PricingCalc;

export function isHoliday(iso) {
  return Array.isArray(state.pricing?.holidays) && state.pricing.holidays.includes(iso);
}

export function bandForMinOnDate(iso, minOfDay) {
  const p = state.pricing;
  if (!p?.bands) return "outside";
  const [y, mo, d] = iso.split("-").map(Number);
  const dt = new Date(y, mo - 1, d);
  const dow = dt.getDay();
  const isWeekend = dow === 0 || dow === 6;
  const workday = !isWeekend && !isHoliday(iso);
  const inRange = (ranges) => ranges.some(([a, b]) => {
    const am = toMin(a), bm = toMin(b);
    return minOfDay >= am && minOfDay < bm;
  });
  for (const [name, def] of Object.entries(p.bands)) {
    if (def.workdayOnly && !workday) continue;
    if (inRange(def.ranges)) return name;
  }
  for (const [name, def] of Object.entries(p.bands)) {
    if (!def.workdayOnly) return name;
  }
  return "outside";
}

export function bandForDate(date) {
  const iso = todayISO(date);
  return bandForMinOnDate(iso, date.getHours() * 60 + date.getMinutes());
}

export function findPricingRow(code) {
  if (!code || !state.pricing?.sections) return null;
  for (const sec of state.pricing.sections) {
    for (const r of (sec.rows || [])) {
      if (r.code === code) return r;
    }
  }
  return null;
}

export function priceFor(pool, band, category, duration) {
  const codes = state.pricing?.bandCodes?.[band]?.[category];
  if (!codes) return null;
  const code = codes[duration];
  if (!code) return null;
  const row = findPricingRow(code);
  if (!row) return null;
  const key = pool === "50m" ? "p50" : "p25";
  const oldKey = key + "Old";
  return { code, value: row[key], old: row[oldKey] };
}

export function bandLabel(band) {
  return state.pricing?.bandLabels?.[band] || band;
}

export function priceWithCurrency(v) {
  const cur = state.pricing?.currency || "€";
  if (!v) return "";
  if (v === "—" || v.toLowerCase?.() === "dohodou") return v;
  if (/\d/.test(v) && !v.includes(cur) && !v.includes("%")) return `${v} ${cur}`;
  return v;
}

export function isPricingStale() {
  return state.pricing?.status?.upToDate === false;
}

export function renderBandChip(el, band) {
  if (!el) return;
  el.className = `band-chip ${band}`;
  el.textContent = bandLabel(band);
}

export function renderHolidayChip(el, showHoliday) {
  if (!el) return;
  if (showHoliday) {
    el.hidden = false;
    el.textContent = t("holiday.chip");
  } else {
    el.hidden = true;
    el.textContent = "";
  }
}

export function renderUnusualChip(el, delta) {
  if (!el) return;
  const threshold = 1.5;
  if (delta == null || Math.abs(delta) < threshold) {
    el.hidden = true;
    el.className = "unusual-chip";
    el.textContent = "";
    return;
  }
  const quiet = delta > 0;
  const rounded = Math.round(Math.abs(delta) * 10) / 10;
  const deltaStr = `${delta > 0 ? "+" : "−"}${rounded.toFixed(1)}`;
  el.hidden = false;
  el.className = `unusual-chip ${quiet ? "quiet" : "busy"}`;
  el.textContent = t(quiet ? "now.unusual.quiet" : "now.unusual.busy", { delta: deltaStr });
}

export function renderNowPrices(box, band) {
  if (!box) return;
  const STALE_TITLE = t("pricing.stale_title");
  box.classList.toggle("stale", isPricingStale());
  if (!state.pricing || band === "outside") {
    const msg = band === "outside"
      ? (state.pricing?.bandLabels?.outside || t("pricing.outside"))
      : "";
    box.innerHTML = msg ? `<span class="np-note">${msg}</span>` : "";
    return;
  }
  const stale = isPricingStale();
  const staleMark = stale ? `<span class="np-stale" title="${STALE_TITLE}">⚠</span>` : "";
  const durations = [60, 90];
  const items = [];
  for (const dur of durations) {
    const adult = priceFor(state.pool, band, "adult", dur);
    const reduced = priceFor(state.pool, band, "reduced", dur);
    if (!adult && !reduced) continue;
    items.push(`
      <div class="np${stale ? " stale" : ""}">
        <span class="np-lbl">${dur} min ${staleMark}</span>
        <span class="np-val">${adult?.old ? `<span class="np-old">${priceWithCurrency(adult.old)}</span>` : ""}${priceWithCurrency(adult?.value || "—")}</span>
        ${reduced ? `<span class="np-lbl" title="${t("pricing.reduced.tip")}">${t("pricing.reduced")}${reduced.old ? ` <span class="np-old">${priceWithCurrency(reduced.old)}</span>` : ""} ${priceWithCurrency(reduced.value)}</span>` : ""}
      </div>
    `);
  }
  box.innerHTML = items.join("") || `<span class="np-note">${bandLabel(band)}</span>`;
}

export function priceChipHTML(pool, band, duration) {
  const STALE_TITLE = t("pricing.stale_title");
  if (band === "outside" || !state.pricing?.bandCodes) {
    return `<span class="price-chip muted"><span class="pc-band">${t("pricing.outside")}</span></span>`;
  }
  const p = priceFor(pool, band, "adult", duration);
  if (!p) return "";
  const label = band === "peak" ? t("pricing.peak") : band === "offpeak" ? t("pricing.offpeak") : band;
  const oldHtml = p.old ? `<span class="pc-old">${priceWithCurrency(p.old)}</span>` : "";
  const stale = isPricingStale();
  const staleCls = stale ? " stale" : "";
  const staleMark = stale ? `<span class="pc-stale" title="${STALE_TITLE}">⚠</span>` : "";
  return `<span class="price-chip${staleCls}" ${stale ? `title="${STALE_TITLE}"` : ""}><span class="pc-band">${label} · ${duration}m</span><span class="pc-price">${staleMark}${oldHtml}${priceWithCurrency(p.value || "—")}</span></span>`;
}

export function renderPricingStaleBanner() {
  const el = document.getElementById("pricing-stale");
  if (!el) return;
  const st = state.pricing?.status;
  if (!st || st.upToDate !== false) {
    el.hidden = true;
    return;
  }
  const page = st.sourcePage || POOL_PAGE["25m"];
  const reason = st.reason === "missing-link"
    ? t("pricing.stale.missing_link")
    : st.reason === "download-failed"
      ? t("pricing.stale.download_failed")
      : t("pricing.stale.mismatch");
  const checked = st.lastChecked ? t("pricing.stale.verified", { date: st.lastChecked }) : "";
  el.innerHTML = `
    <strong>${t("pricing.stale.heading")}</strong>
    <span>${reason}${checked}</span>
    <a href="${page}" target="_blank" rel="noopener">${t("pricing.stale.open_page")}</a>
  `;
  el.hidden = false;
}

export function renderPricing() {
  const body = document.getElementById("pricing-body");
  const foot = document.querySelector(".pricing-foot");
  const banner = document.getElementById("pricing-banner");
  const priceNote = document.getElementById("pricing-note");
  const activePool = state.pool;
  if (!state.pricing || !state.pricing.sections) {
    body.innerHTML = `<div class="empty-state">${t("pricing.unavailable", { file: "<code>pricing.json</code>" })}</div>`;
    return;
  }
  const cur = state.pricing.currency || "€";
  const stale = isPricingStale();
  const withUnit = (v) => {
    if (v === "—" || v.toLowerCase() === "dohodou") return v;
    if (/\d/.test(v) && !v.includes(cur) && !v.includes("%")) return `${v} ${cur}`;
    return v;
  };
  const fmtPrice = (newVal, oldVal) => {
    if (!newVal && !oldVal) return `<span class="empty">${t("pricing.fill_in")}</span>`;
    const parts = [];
    if (oldVal) parts.push(`<span class="old">${withUnit(oldVal)}</span>`);
    if (newVal) parts.push(`<span class="new">${withUnit(newVal)}</span>`);
    if (stale) parts.push(`<span class="cell-stale" title="${t("pricing.stale_title")}">⚠</span>`);
    return parts.join(" ");
  };

  if (banner) {
    const txt = state.pricing.transitional || "";
    const until = state.pricing.transitionalUntil;
    const expired = until && todayISO() > until;
    const show = txt && !expired;
    banner.textContent = show ? txt : "";
    banner.style.display = show ? "" : "none";
  }
  if (priceNote) {
    priceNote.textContent = state.pricing.priceNote || "";
    priceNote.style.display = state.pricing.priceNote ? "" : "none";
  }

  body.innerHTML = state.pricing.sections.map(sec => {
    const rows = (sec.rows || []).map(r => {
      const highlight50 = activePool === "50m" ? " class=\"active\"" : "";
      const highlight25 = activePool === "25m" ? " class=\"active\"" : "";
      return `<tr>
        <td class="code">${r.code || ""}</td>
        <td class="desc">${r.label || ""}</td>
        <td class="unit">${r.unit || ""}</td>
        <td${highlight50}>${fmtPrice(r.p50, r.p50Old)}</td>
        <td${highlight25}>${fmtPrice(r.p25, r.p25Old)}</td>
      </tr>`;
    }).join("");
    const note = sec.note ? `<p class="section-note muted">${sec.note}</p>` : "";
    return `
      <div class="pricing-section">
        <h4>${sec.title}</h4>
        <div class="price-table-wrap">
          <table class="price-table">
            <thead>
              <tr>
                <th>${t("pricing.col.code")}</th>
                <th>${t("pricing.col.desc")}</th>
                <th>${t("pricing.col.unit")}</th>
                <th class="${activePool === "50m" ? "active" : ""}">${t("pricing.col.50m")}</th>
                <th class="${activePool === "25m" ? "active" : ""}">${t("pricing.col.25m")}</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
        ${note}
      </div>
    `;
  }).join("");

  const parts = [];
  if (state.pricing.effectiveFrom) parts.push(t("pricing.valid_from", { date: state.pricing.effectiveFrom }));
  if (state.pricing.issuedBy) parts.push(state.pricing.issuedBy);
  if (state.pricing.updated) parts.push(t("pricing.last_updated", { date: state.pricing.updated }));
  foot.innerHTML = parts.join(" · ");
}

export function setupCalculator() {
  const dateEl = document.getElementById("calc-date");
  const timeEl = document.getElementById("calc-time");
  if (!dateEl || !timeEl) return;
  const now = new Date();
  dateEl.value = todayISO(now);
  const nowMin = now.getHours() * 60 + now.getMinutes();
  timeEl.value = fmt(Math.round(nowMin / 15) * 15);
  const inputs = [
    dateEl, timeEl,
    ...document.querySelectorAll("input[name='calc-cat'], input[name='calc-dur']"),
  ];
  inputs.forEach(el => el.addEventListener("change", renderCalculator));
}

export function renderCalculator() {
  const out = document.getElementById("calc-result");
  const hint = document.getElementById("calc-hint");
  if (!out) return;
  if (!PC) { out.innerHTML = ""; return; }

  const poolLabel = state.pool === "25m" ? t("pools.25m") : t("pools.50m");
  if (hint) hint.textContent = t("calc.hint", { pool: poolLabel });

  if (!state.pricing) {
    out.className = "calc-result error";
    out.textContent = t("calc.error.no_pricing");
    return;
  }

  const dateEl = document.getElementById("calc-date");
  const timeEl = document.getElementById("calc-time");
  const cat = document.querySelector("input[name='calc-cat']:checked")?.value || "adult";
  const dur = Number(document.querySelector("input[name='calc-dur']:checked")?.value || 60);
  const iso = dateEl?.value || todayISO();
  const time = timeEl?.value || "12:00";
  const minOfDay = toMin(time);

  const result = PC.calculate(state.pricing, {
    pool: state.pool, category: cat, duration: dur, iso, minOfDay,
  });

  if (result.error === "outside") {
    out.className = "calc-result error";
    out.textContent = t("calc.error.outside");
    return;
  }
  if (result.error === "no-price") {
    out.className = "calc-result error";
    out.textContent = t("calc.error.no_price");
    return;
  }
  if (result.error) {
    out.className = "calc-result error";
    out.textContent = t("calc.error.no_pricing");
    return;
  }

  const currency = state.pricing.currency || "€";
  const priceStr = PC.formatEUR(result.value, currency);
  const oldStr = result.oldValue != null && result.oldValue !== result.value
    ? `<span class="calc-was">${t("calc.result.was", { old: PC.formatEUR(result.oldValue, currency) })}</span>`
    : "";
  const bandLbl = result.band === "peak"
    ? t("calc.result.band.peak")
    : result.band === "offpeak"
      ? t("calc.result.band.offpeak")
      : "";
  const holiday = result.holiday ? `<span class="calc-pill holiday">${t("calc.result.holiday")}</span>` : "";
  const codeChip = result.code ? `<span class="calc-pill code">${t("calc.result.code", { code: result.code })}</span>` : "";
  const bandChip = bandLbl ? `<span class="calc-pill band-${result.band}">${bandLbl}</span>` : "";
  const transNote = result.transitional && state.pricing.transitionalUntil
    ? `<div class="calc-trans">${t("calc.result.transitional", { until: state.pricing.transitionalUntil })}</div>`
    : "";

  out.className = "calc-result ok";
  out.innerHTML = `
    <div class="calc-line">
      <span class="calc-price">${t("calc.result.price", { price: priceStr })}</span>
      ${oldStr}
    </div>
    <div class="calc-meta">${bandChip}${holiday}${codeChip}</div>
    ${transNote}
  `;
}
