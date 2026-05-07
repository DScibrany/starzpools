import {
  state, POOL_FILE, POOL_PAGE, THEMES, WEEKDAYS,
  activeData, activeMaxLanes,
} from "./state.js";
import {
  t, lanesWord, weekdayLabel, weekdayShort, getLang,
} from "./i18n.js";
import {
  bandForDate, bandForMinOnDate, isHoliday,
  renderBandChip, renderHolidayChip, renderUnusualChip,
  renderNowPrices, priceChipHTML,
} from "./pricing.js";
import {
  renderWatcher,
  findFavoriteForBlock, cellFavoritedFor, rowHasFavorite, toggleFavoriteBlock,
} from "./watcher.js";

const {
  pad, toMin, fmt, todayISO,
  collapseBlocks, levelFor, scheduleAgeDays,
  icsEscape, icsUTCStamp,
} = window;

const SCHEDULE_STALE_DAYS = 3;

export function buildICS({ iso, startMin, endMin, lanes, pool }) {
  const [y, mo, d] = iso.split("-").map(Number);
  const sh = Math.floor(startMin / 60), sm = startMin % 60;
  const eh = Math.floor(endMin / 60), em = endMin % 60;
  const dtStart = icsUTCStamp(new Date(y, mo - 1, d, sh, sm, 0));
  const dtEnd = icsUTCStamp(new Date(y, mo - 1, d, eh, em, 0));
  const now = icsUTCStamp(new Date());
  const uid = `starz-${pool}-${iso}-${pad(sh)}${pad(sm)}@starzpools`;
  const summary = t("ics.summary", { pool, lanes, lanesWord: lanesWord(lanes) });
  const description = t("ics.description", { pool, lanes });
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//STARZ Pools//SK",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${now}`,
    `DTSTART:${dtStart}`,
    `DTEND:${dtEnd}`,
    `SUMMARY:${icsEscape(summary)}`,
    `DESCRIPTION:${icsEscape(description)}`,
    "LOCATION:Mestská plaváreň Pasienky\\, Junácka 4\\, Bratislava",
    "END:VEVENT",
    "END:VCALENDAR",
    "",
  ].join("\r\n");
}

export function downloadICS(event) {
  const text = buildICS(event);
  const blob = new Blob([text], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `starz-${event.pool}-${event.iso}-${fmt(event.startMin).replace(":","")}.ics`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function applyPoolFromURL() {
  const pool = new URLSearchParams(location.search).get("pool");
  if (pool === "25m" || pool === "50m") state.pool = pool;
  document.querySelectorAll(".pool-tab").forEach(x => {
    const active = x.dataset.pool === state.pool;
    x.classList.toggle("active", active);
    x.setAttribute("aria-selected", active ? "true" : "false");
  });
}

export function applyFinderFromURL() {
  const params = new URLSearchParams(location.search);
  const from = params.get("from");
  const lanes = params.get("lanes");
  const len = params.get("len");
  const date = params.get("date");
  const todayParam = params.get("today");
  if (!from && !lanes && !len && !date && !todayParam) return;

  if (from && /^\d{2}:\d{2}$/.test(from)) {
    document.getElementById("finder-from").value = from;
  }
  if (lanes && /^\d+$/.test(lanes)) {
    const n = Math.max(1, Math.min(Number(lanes), activeMaxLanes()));
    document.getElementById("finder-min").value = String(n);
  }
  if (len && ["60","90"].includes(len)) {
    document.getElementById("finder-len").value = len;
  }
  if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
    document.getElementById("finder-date").value = date;
  }
  if (todayParam === "1") {
    document.getElementById("finder-today").checked = true;
  }
  const details = document.querySelector(".finder");
  if (details) details.open = true;
  runFinder();
}

export function updateURLFromState() {
  const params = new URLSearchParams();
  if (state.pool !== "50m") params.set("pool", state.pool);
  const from = document.getElementById("finder-from")?.value;
  const minSel = document.getElementById("finder-min")?.value;
  const lenSel = document.getElementById("finder-len")?.value;
  const dateVal = document.getElementById("finder-date")?.value;
  const todayChk = document.getElementById("finder-today")?.checked;
  if (from) params.set("from", from);
  if (minSel && minSel !== "1") params.set("lanes", minSel);
  if (lenSel && lenSel !== "60") params.set("len", lenSel);
  if (dateVal) params.set("date", dateVal);
  if (todayChk && !dateVal) params.set("today", "1");
  const qs = params.toString();
  const url = location.pathname + (qs ? "?" + qs : "") + location.hash;
  history.replaceState(null, "", url);
}

export function renderScheduleStaleBanner(data, now) {
  const el = document.getElementById("schedule-stale");
  if (!el) return;
  const page = POOL_PAGE[state.pool];
  const missing = !data || !Array.isArray(data.days) || data.days.length === 0;
  const age = scheduleAgeDays(data?.updated, now);
  const stale = !missing && age != null && age >= SCHEDULE_STALE_DAYS;
  if (!missing && !stale) {
    el.hidden = true;
    el.innerHTML = "";
    return;
  }
  const detail = missing
    ? t("schedule.stale.missing")
    : t("schedule.stale.days_old", { date: data.updated, days: age });
  el.innerHTML = `
    <strong>${t("schedule.stale.heading")}</strong>
    <span>${detail}</span>
    <a href="${page}" target="_blank" rel="noopener">${t("schedule.stale.open_page")}</a>
  `;
  el.hidden = false;
}

export function applyTheme(name) {
  if (!THEMES.includes(name)) name = "traffic";
  state.theme = name;
  document.body.classList.remove(...THEMES.map(x => "theme-" + x));
  document.body.classList.add("theme-" + name);
  try { localStorage.setItem("starz-theme", name); } catch {}
}

export function setupTheme() {
  let saved = null;
  try { saved = localStorage.getItem("starz-theme"); } catch {}
  applyTheme(saved || "traffic");
  const sel = document.getElementById("theme");
  if (sel) {
    sel.value = state.theme;
    sel.addEventListener("change", () => {
      applyTheme(sel.value);
      renderLegend(activeData()?.maxLanes || 4);
    });
  }
}

export function setupViews() {
  const tabs = document.querySelectorAll(".view-tab");
  const apply = (name) => {
    state.view = name;
    tabs.forEach(x => {
      const active = x.dataset.view === name;
      x.classList.toggle("active", active);
      x.setAttribute("aria-selected", active ? "true" : "false");
    });
    document.getElementById("dashboard-view").hidden = name !== "dashboard";
    document.getElementById("trend-view").hidden = name !== "trend";
    document.getElementById("pricing-view").hidden = name !== "pricing";
    if (name === "trend") renderTrend();
    if (location.hash.slice(1) !== name) history.replaceState(null, "", "#" + name);
  };
  tabs.forEach(tab => tab.addEventListener("click", () => apply(tab.dataset.view)));
  const fromHash = location.hash.slice(1);
  const initialView = ["pricing", "trend", "dashboard"].includes(fromHash) ? fromHash : "dashboard";
  apply(initialView);
}

export function trendAvgFor(pool, weekday, idx) {
  const bucket = state.trend?.pools?.[pool]?.byWeekday?.[weekday];
  if (!bucket || (bucket.samples || 0) < 2) return null;
  const v = bucket.avg?.[idx];
  return (typeof v === "number") ? v : null;
}

export function todaySparkHTML(day, data, nowIdx) {
  const free = day?.free || [];
  const n = free.length;
  const max = data?.maxLanes || 4;
  if (n < 2 || !free.some(v => v > 0)) return "";
  const pts = [];
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 100;
    const y = (1 - Math.max(0, Math.min(free[i], max)) / max) * 100;
    pts.push(`${x.toFixed(2)},${y.toFixed(2)}`);
  }
  const nowLine = (nowIdx >= 0 && nowIdx < n)
    ? `<line class="spark-now" x1="${((nowIdx / (n - 1)) * 100).toFixed(2)}" x2="${((nowIdx / (n - 1)) * 100).toFixed(2)}" y1="0" y2="100" vector-effect="non-scaling-stroke"/>`
    : "";
  return `<svg class="today-spark" viewBox="0 0 100 100" preserveAspectRatio="none" aria-label="${t("today.spark_aria")}" role="img">
    <polyline class="spark-line" points="${pts.join(" ")}" fill="none" vector-effect="non-scaling-stroke"/>
    ${nowLine}
  </svg>`;
}

export function populateLaneOptions(sel, max, defaultValue) {
  if (!sel) return;
  const prev = sel.value;
  const opts = [];
  for (let i = 1; i <= max; i++) opts.push(`<option value="${i}">${t("finder.at_least", { n: i })}</option>`);
  sel.innerHTML = opts.join("");
  const keep = prev && Number(prev) >= 1 && Number(prev) <= max ? prev : String(Math.min(defaultValue ?? 1, max));
  sel.value = keep;
}

export function refreshLaneOptions() {
  const max = activeMaxLanes();
  populateLaneOptions(document.getElementById("finder-min"), max, 1);
  populateLaneOptions(document.getElementById("watch-lanes"), max, Math.min(3, max));
}

export function populateWeekdayOptions() {
  const sel = document.getElementById("watch-day");
  if (!sel) return;
  const current = sel.value;
  const opts = [`<option value="any">${t("watcher.any")}</option>`];
  for (const w of WEEKDAYS) {
    opts.push(`<option value="${w}">${weekdayLabel(w)}</option>`);
  }
  sel.innerHTML = opts.join("");
  sel.value = current || "any";
}

let setupTabsHook = null;
export function setOnPoolChange(fn) { setupTabsHook = fn; }

export function setupTabs() {
  const tabs = document.querySelectorAll(".pool-tab");
  tabs.forEach(tab => {
    tab.addEventListener("click", () => {
      state.pool = tab.dataset.pool;
      tabs.forEach(x => {
        const active = x.dataset.pool === state.pool;
        x.classList.toggle("active", active);
        x.setAttribute("aria-selected", active ? "true" : "false");
      });
      if (setupTabsHook) setupTabsHook();
      else {
        setupLinks();
        state.finderHits = [];
        document.getElementById("finder-results").innerHTML = "";
        refreshLaneOptions();
        render();
        if (state.view === "trend") renderTrend();
        updateURLFromState();
      }
    });
  });
}

export function setupLinks() {
  const d = activeData();
  const poolText = state.pool === "25m" ? t("links.pool.25m") : t("links.pool.50m");
  document.querySelectorAll(".link-pool").forEach(a => {
    a.href = POOL_PAGE[state.pool];
    a.textContent = poolText;
  });
  document.querySelectorAll(".link-source").forEach(a => {
    a.href = d?.source || POOL_PAGE[state.pool];
    a.textContent = t("links.source");
  });
  const priceUrl = state.pricing?.source;
  document.querySelectorAll(".link-pricing").forEach(a => {
    if (priceUrl) {
      a.href = priceUrl;
      a.textContent = t("links.pricing");
      a.style.display = "";
    } else {
      a.style.display = "none";
    }
  });
}

export function slotIndexForNow(data) {
  const now = new Date();
  const min = now.getHours() * 60 + now.getMinutes();
  const start = toMin(data.dayStart);
  if (min < start) return -1;
  const cols = Math.ceil((toMin(data.dayEnd) - start) / data.slotMinutes);
  const idx = Math.floor((min - start) / data.slotMinutes);
  return idx >= cols ? cols : idx;
}

export function findDay(data, iso) { return data.days.find(d => d.date === iso); }

export function nextDateForWeekday(data, weekday) {
  if (!data?.days) return null;
  return data.days.find(d => d.weekday === weekday)?.date || null;
}

export function render() {
  const data = activeData();
  const now = new Date();
  document.getElementById("now").textContent =
    now.toLocaleString(getLang() === "en" ? "en-GB" : "sk-SK", {
      weekday: "short", day: "2-digit", month: "2-digit",
      hour: "2-digit", minute: "2-digit",
    });
  document.getElementById("updated").textContent =
    data?.updated ? t("footer.updated", { date: data.updated }) : "";

  renderScheduleStaleBanner(data, now);

  if (!data || !data.days || data.days.length === 0) {
    renderEmpty();
    renderWatcher();
    return;
  }
  renderNow(now, data);
  renderHeatmap(now, data);
  renderTodayBlocks(now, data);
  applyFinderHighlight();
  renderWatcher();
}

function renderEmpty() {
  const big = document.getElementById("now-big");
  const sub = document.getElementById("now-sub");
  const next = document.getElementById("now-next");
  const pill = document.getElementById("status-pill");
  const card = document.getElementById("now-card");
  const dots = document.getElementById("now-dots");
  renderUnusualChip(document.getElementById("unusual-chip"), null);
  renderHolidayChip(document.getElementById("holiday-chip"), false);
  card.classList.remove("live");
  pill.textContent = t("now.nodata");
  pill.className = "pill";
  big.className = "big";
  big.textContent = "—";
  if (dots) { dots.className = "now-dots"; dots.innerHTML = ""; }
  sub.textContent = t("empty.no_pool_data");
  next.textContent = t("empty.fill_schedule");
  document.getElementById("today-blocks").innerHTML =
    `<div class="empty-state">${t("empty.no_pool_data_for", { pool: state.pool })}<br>${t("empty.edit_file", { file: `<code>${POOL_FILE[state.pool]}</code>` })}</div>`;
  document.getElementById("grid").innerHTML = "";
}

function renderNow(now, data) {
  const iso = todayISO(now);
  const day = findDay(data, iso);
  const pill = document.getElementById("status-pill");
  const big = document.getElementById("now-big");
  const sub = document.getElementById("now-sub");
  const next = document.getElementById("now-next");
  const card = document.getElementById("now-card");
  const chip = document.getElementById("band-chip");
  const unusualChip = document.getElementById("unusual-chip");
  const holidayChip = document.getElementById("holiday-chip");
  const pricesBox = document.getElementById("now-prices");
  const dots = document.getElementById("now-dots");

  if (!day) {
    renderBandChip(chip, "outside");
    renderUnusualChip(unusualChip, null);
    renderHolidayChip(holidayChip, false);
    card.classList.remove("live");
    pill.textContent = t("now.outofschedule");
    pill.className = "pill";
    big.className = "big";
    big.textContent = "—";
    if (dots) { dots.className = "now-dots"; dots.innerHTML = ""; }
    sub.textContent = t("now.noscheduletoday");
    next.textContent = "";
    if (pricesBox) pricesBox.innerHTML = "";
    return;
  }

  const idx = slotIndexForNow(data);
  const startMin = toMin(data.dayStart);
  const slot = data.slotMinutes;
  const currentFree = (idx >= 0 && idx < day.free.length) ? day.free[idx] : 0;
  const band = currentFree > 0 ? bandForDate(now) : "outside";
  renderBandChip(chip, band);
  renderHolidayChip(holidayChip, isHoliday(day.date));
  const avg = (currentFree > 0) ? trendAvgFor(state.pool, day.weekday, idx) : null;
  renderUnusualChip(unusualChip, avg != null ? currentFree - avg : null);

  const level = currentFree > 0 ? levelFor(currentFree, data.maxLanes) : 0;
  big.className = `big lane-${level}`;
  big.innerHTML = `${currentFree}<span class="of"> / ${data.maxLanes}</span>`;
  if (dots) {
    const dotsOn = "●".repeat(currentFree);
    const dotsOff = "○".repeat(Math.max(0, data.maxLanes - currentFree));
    dots.className = `now-dots lane-${level}`;
    dots.innerHTML = `<span class="on">${dotsOn}</span><span class="off">${dotsOff}</span>`;
  }
  if (currentFree > 0) {
    pill.textContent = t("now.open");
    pill.className = "pill open";
    card.classList.add("live");
    const slotStart = startMin + idx * slot;
    sub.textContent = t("now.current_block", { from: fmt(slotStart), to: fmt(slotStart + slot) });
  } else {
    pill.textContent = t("now.closed");
    pill.className = "pill closed";
    card.classList.remove("live");
    sub.textContent = t("now.no_lanes_now");
  }

  renderNowPrices(pricesBox, band);

  let nextIdx = -1;
  const startSearch = Math.max(0, idx + (currentFree === 0 ? 0 : 1));
  for (let i = startSearch; i < day.free.length; i++) {
    if (day.free[i] > 0 && (currentFree === 0 || day.free[i] !== currentFree)) {
      nextIdx = i; break;
    }
  }
  if (currentFree > 0) {
    let endIdx = idx;
    while (endIdx + 1 < day.free.length && day.free[endIdx + 1] === currentFree) endIdx++;
    const endMin = startMin + (endIdx + 1) * slot;
    const mins = endMin - (now.getHours() * 60 + now.getMinutes());
    next.textContent = t("now.block_ends", { end: fmt(endMin), mins });
  } else if (nextIdx >= 0) {
    const tMin = startMin + nextIdx * slot;
    const mins = tMin - (now.getHours() * 60 + now.getMinutes());
    next.textContent = t("now.next_block", {
      time: fmt(tMin), lanes: day.free[nextIdx], lanesWord: lanesWord(day.free[nextIdx]), mins,
    });
  } else {
    next.textContent = t("now.no_more_today");
  }
}

function renderHeatmap(now, data) {
  const slot = data.slotMinutes;
  const startMin = toMin(data.dayStart);
  const endMin = toMin(data.dayEnd);
  const cols = Math.ceil((endMin - startMin) / slot);
  const todayIso = todayISO(now);
  const nowIdx = slotIndexForNow(data);
  const slotsPerHour = Math.max(1, Math.round(60 / slot));
  const nowStart = nowIdx;
  const nowEnd = nowIdx >= 0 ? Math.min(nowIdx + slotsPerHour - 1, cols - 1) : -1;
  const inNowBand = (c) => nowStart >= 0 && c >= nowStart && c <= nowEnd;

  const grid = document.getElementById("grid");
  grid.style.gridTemplateColumns = `110px repeat(${cols}, minmax(10px, 1fr))`;
  grid.innerHTML = "";
  grid.setAttribute("role", "grid");
  grid.setAttribute("aria-label", t("heatmap.title"));
  grid.setAttribute("aria-rowcount", String(data.days.length + 1));
  grid.setAttribute("aria-colcount", String(cols + 1));

  const corner = document.createElement("div");
  corner.className = "cell header rowhead";
  corner.setAttribute("role", "columnheader");
  corner.setAttribute("aria-rowindex", "1");
  corner.setAttribute("aria-colindex", "1");
  corner.textContent = t("grid.day_header");
  grid.appendChild(corner);
  for (let c = 0; c < cols; c++) {
    const tm = startMin + c * slot;
    const el = document.createElement("div");
    el.className = "cell header tick";
    el.setAttribute("role", "columnheader");
    el.setAttribute("aria-rowindex", "1");
    el.setAttribute("aria-colindex", String(c + 2));
    el.setAttribute("aria-label", fmt(tm));
    if (inNowBand(c)) {
      el.classList.add("now-col");
      if (c === nowStart) el.classList.add("now-col-start");
      if (c === nowEnd) el.classList.add("now-col-end");
    }
    if (tm % 60 === 0) {
      el.textContent = String(Math.floor(tm / 60));
      el.classList.add("hour");
    }
    grid.appendChild(el);
  }

  let initialFocusCell = null;
  for (let r = 0; r < data.days.length; r++) {
    const day = data.days[r];
    const isToday = day.date === todayIso;
    const head = document.createElement("div");
    const hasFav = rowHasFavorite(state.pool, day.weekday);
    const isHol = isHoliday(day.date);
    head.className = "cell rowhead" + (isToday ? " today" : "") + (hasFav ? " has-fav" : "") + (isHol ? " holiday" : "");
    head.setAttribute("role", "rowheader");
    head.setAttribute("aria-rowindex", String(r + 2));
    head.setAttribute("aria-colindex", "1");
    const [, m, d] = day.date.split("-");
    const dow = weekdayShort(day.weekday);
    head.setAttribute("aria-label", `${weekdayLabel(day.weekday)} ${d}.${m}.${isHol ? t("grid.aria_row_holiday") : ""}${hasFav ? t("grid.aria_row_fav") : ""}`);
    head.innerHTML = `<span class="dow">${dow}</span> <span class="date">${d}.${m}.</span>${isHol ? `<span class="hol-mark" title="${t("holiday.chip")}" aria-hidden="true">✦</span>` : ""}${hasFav ? '<span class="fav-mark" aria-hidden="true">★</span>' : ""}`;
    grid.appendChild(head);

    for (let c = 0; c < cols; c++) {
      const raw = day.free[c] ?? 0;
      const level = levelFor(raw, data.maxLanes);
      const el = document.createElement("div");
      el.className = `cell lane-${level}`;
      el.setAttribute("role", "gridcell");
      el.setAttribute("aria-rowindex", String(r + 2));
      el.setAttribute("aria-colindex", String(c + 2));
      el.setAttribute("tabindex", "-1");
      if (raw > 0) el.dataset.free = String(raw);
      if (isToday && inNowBand(c)) {
        el.classList.add("now");
        if (c === nowStart) el.classList.add("now-start");
        if (c === nowEnd) el.classList.add("now-end");
      }
      const s = startMin + c * slot;
      const lanesText = raw === 0 ? t("grid.no_free_lanes") : t("grid.lanes_ratio", { free: raw, max: data.maxLanes });
      const lanesShort = raw === 0 ? t("grid.no_free_lanes") : t("grid.lanes_short", { free: raw, max: data.maxLanes });
      const isFavCell = cellFavoritedFor(state.pool, day.weekday, s);
      if (isFavCell) el.classList.add("fav");
      const holSuffix = isHoliday(day.date) ? ` · ${t("holiday.chip")}` : "";
      const dotsViz = " · " + "●".repeat(raw) + "○".repeat(Math.max(0, data.maxLanes - raw));
      el.title = t("grid.tooltip", { weekday: weekdayLabel(day.weekday), from: fmt(s), to: fmt(s + slot), lanes: lanesShort }) + holSuffix + (isFavCell ? " · ★" : "") + dotsViz;
      el.setAttribute("aria-label", t("grid.aria_cell", { weekday: weekdayLabel(day.weekday), date: `${d}.${m}.`, time: fmt(s), lanes: lanesText }) + (isFavCell ? " " + t("grid.aria_fav") : "") + (isHoliday(day.date) ? t("grid.aria_row_holiday") : ""));
      el.dataset.date = day.date;
      el.dataset.row = String(r);
      el.dataset.col = String(c);
      grid.appendChild(el);
      if (isToday && inNowBand(c) && !initialFocusCell) initialFocusCell = el;
    }
  }

  if (!initialFocusCell) {
    initialFocusCell = grid.querySelector(".cell[role='gridcell']");
  }
  if (initialFocusCell) initialFocusCell.setAttribute("tabindex", "0");

  renderLegend(data.maxLanes);
}

export function setupGridKeyboard(gridId) {
  const grid = document.getElementById(gridId);
  if (!grid) return;
  grid.addEventListener("keydown", (e) => {
    const cell = e.target.closest?.(".cell[role='gridcell']");
    if (!cell || !grid.contains(cell)) return;
    const r = Number(cell.dataset.row);
    const c = Number(cell.dataset.col);
    const move = (nr, nc) =>
      grid.querySelector(`.cell[role='gridcell'][data-row='${nr}'][data-col='${nc}']`);
    const rowCells = (nr) =>
      grid.querySelectorAll(`.cell[role='gridcell'][data-row='${nr}']`);
    let target = null;
    switch (e.key) {
      case "ArrowRight": target = move(r, c + 1); break;
      case "ArrowLeft":  target = move(r, c - 1); break;
      case "ArrowDown":  target = move(r + 1, c); break;
      case "ArrowUp":    target = move(r - 1, c); break;
      case "Home": { const list = rowCells(r); target = list[0] || null; break; }
      case "End":  { const list = rowCells(r); target = list[list.length - 1] || null; break; }
      case "Enter":
      case " ": e.preventDefault(); cell.click(); return;
      default: return;
    }
    if (!target) return;
    e.preventDefault();
    cell.setAttribute("tabindex", "-1");
    target.setAttribute("tabindex", "0");
    target.focus();
  });
}

export function resolveMainCellSlot(cell) {
  const data = activeData();
  if (!data) return null;
  const iso = cell.dataset.date;
  if (!iso) return null;
  const col = Number(cell.dataset.col);
  return { iso, startMin: toMin(data.dayStart) + col * data.slotMinutes };
}

export function resolveTrendCellSlot(cell) {
  const data = activeData();
  if (!data) return null;
  const iso = nextDateForWeekday(data, cell.dataset.wd);
  if (!iso) return null;
  const col = Number(cell.dataset.col);
  return { iso, startMin: toMin(data.dayStart) + col * data.slotMinutes };
}

export function setupGridPopup(wrapSelector, gridId, resolver) {
  const wrap = document.querySelector(wrapSelector);
  const grid = document.getElementById(gridId);
  if (!wrap || !grid) return;

  const pop = document.createElement("div");
  pop.className = "grid-popup";
  pop.hidden = true;
  wrap.appendChild(pop);

  const clearSelected = () => {
    wrap.querySelectorAll(".cell.selected").forEach(el => el.classList.remove("selected"));
  };
  const hide = () => {
    pop.hidden = true;
    pop.dataset.forCell = "";
    clearSelected();
  };

  wrap.addEventListener("click", (e) => {
    if (e.target.closest(".grid-popup")) return;
    const cell = e.target.closest(".cell[role='gridcell']");
    if (!cell) { hide(); return; }
    const key = `${cell.dataset.row}:${cell.dataset.col}`;
    if (!pop.hidden && pop.dataset.forCell === key) { hide(); return; }
    const resolved = resolver(cell);
    clearSelected();
    cell.classList.add("selected");
    const text = cell.title || cell.getAttribute("aria-label") || "";
    const linkBtn = resolved
      ? `<button type="button" class="grid-popup-link" title="${t("grid.open_detail")}" aria-label="${t("grid.open_detail")}">🔗</button>`
      : "";
    pop.innerHTML = `<span class="grid-popup-text">${text}</span>${linkBtn}`;
    pop.hidden = false;
    pop.dataset.forCell = key;
    if (resolved) {
      pop.querySelector(".grid-popup-link")?.addEventListener("click", (ev) => {
        ev.stopPropagation();
        hide();
        openSlotModal(resolved.iso, resolved.startMin);
      });
    }
    requestAnimationFrame(() => {
      const cr = cell.getBoundingClientRect();
      const wr = wrap.getBoundingClientRect();
      const popW = pop.offsetWidth;
      const popH = pop.offsetHeight;
      let left = cr.left - wr.left + wrap.scrollLeft + cr.width / 2 - popW / 2;
      const maxLeft = wrap.scrollLeft + wrap.clientWidth - popW - 6;
      left = Math.max(wrap.scrollLeft + 6, Math.min(left, maxLeft));
      let top = cr.top - wr.top + wrap.scrollTop - popH - 8;
      if (top < wrap.scrollTop + 2) top = cr.bottom - wr.top + wrap.scrollTop + 8;
      pop.style.left = left + "px";
      pop.style.top = top + "px";
    });
  });

  document.addEventListener("click", (e) => {
    if (pop.hidden) return;
    if (!e.target.closest(wrapSelector)) hide();
  });
  wrap.addEventListener("scroll", hide, { passive: true });
  window.addEventListener("resize", hide);
}

export function renderLegend(max) {
  const legend = document.querySelector(".legend");
  if (!legend) return;
  const q = (n) => Math.max(1, Math.round(max * n));
  const range = (lo, hi) => lo === hi ? String(lo) : `${lo}–${hi}`;
  const r1Hi = q(0.25);
  const r2Lo = r1Hi + 1, r2Hi = q(0.5);
  const r3Lo = r2Hi + 1, r3Hi = q(0.75);
  const r4Lo = r3Hi + 1, r4Hi = max;
  legend.innerHTML = `
    <span>${t("legend.lanes_free", { max })}</span>
    <span><i class="sw lane-0"></i> ${t("legend.closed")}</span>
    <span><i class="sw lane-1"></i> ${range(1, r1Hi)}</span>
    ${r2Lo <= r2Hi ? `<span><i class="sw lane-2"></i> ${range(r2Lo, r2Hi)}</span>` : ""}
    ${r3Lo <= r3Hi ? `<span><i class="sw lane-3"></i> ${range(r3Lo, r3Hi)}</span>` : ""}
    ${r4Lo <= r4Hi ? `<span><i class="sw lane-4"></i> ${range(r4Lo, r4Hi)}</span>` : ""}
    <span><i class="sw now"></i> ${t("legend.now")}</span>
  `;
}

function renderTodayBlocks(now, data) {
  const iso = todayISO(now);
  const day = findDay(data, iso);
  const box = document.getElementById("today-blocks");
  if (!day) {
    box.innerHTML = `<h3>${t("today.title")}</h3><div class="muted">${t("today.no_record")}</div>`;
    return;
  }
  const blocks = collapseBlocks(day.free, data.slotMinutes, toMin(data.dayStart));
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const [, m, d] = day.date.split("-");
  if (!blocks.length) {
    box.innerHTML = `<h3>${t("today.title")} (${d}.${m}.)</h3><div class="muted">${t("today.no_blocks")}</div>`;
    return;
  }
  const items = blocks.map(b => ({
    b,
    past: b.endMin <= nowMin,
    live: nowMin >= b.startMin && nowMin < b.endMin,
  }));
  let lastPastIdx = -1;
  items.forEach((it, i) => { if (it.past) lastPastIdx = i; });
  let futureSeen = 0;
  let hiddenCount = 0;
  items.forEach((it, i) => {
    if (it.past && i !== lastPastIdx) it.hide = true;
    else if (!it.past && !it.live) {
      futureSeen++;
      if (futureSeen > 2) it.hide = true;
    }
    if (it.hide) hiddenCount++;
  });

  const rows = items.map(it => {
    const b = it.b;
    const level = levelFor(b.lanes, data.maxLanes);
    const cls = [it.past ? "past" : it.live ? "live" : "", it.hide ? "mobile-hidden" : ""].filter(Boolean).join(" ");
    const icsBtn = it.past ? "" :
      `<button type="button" class="ics-btn" title="${t("today.ics_tip")}"
        data-iso="${day.date}" data-start="${b.startMin}" data-end="${b.endMin}" data-lanes="${b.lanes}">📅</button>`;
    const linkBtn = it.past ? "" :
      `<button type="button" class="slot-link-btn" title="${t("today.slot_link_tip")}"
        data-iso="${day.date}" data-start="${b.startMin}">🔗</button>`;
    const dotsOn = "●".repeat(b.lanes);
    const dotsOff = "○".repeat(Math.max(0, data.maxLanes - b.lanes));
    const isFav = !!findFavoriteForBlock(state.pool, day.weekday, b.startMin, b.endMin);
    const favBtn = `<button type="button" class="fav-btn${isFav ? " on" : ""}"
      title="${isFav ? t("today.fav.remove") : t("today.fav.add")}"
      aria-pressed="${isFav ? "true" : "false"}"
      data-weekday="${day.weekday}" data-start="${b.startMin}" data-end="${b.endMin}">${isFav ? "★" : "☆"}</button>`;
    return `<li class="${cls}">
      ${favBtn}
      <span class="time">${fmt(b.startMin)}–${fmt(b.endMin)}</span>
      <span class="lanes lane-${level}">${b.lanes} ${lanesWord(b.lanes)}</span>
      <span class="dots lane-${level}" aria-hidden="true"><span class="on">${dotsOn}</span><span class="off">${dotsOff}</span></span>
      ${it.live ? `<span class="tag">${t("today.tag.live")}</span>` : it.past ? `<span class="tag past">${t("today.tag.past")}</span>` : ''}
      ${icsBtn}
      ${linkBtn}
    </li>`;
  }).join("");

  const toggleHtml = hiddenCount > 0
    ? `<button type="button" class="blocks-toggle" aria-expanded="false">${t("today.show_all", { n: hiddenCount })}</button>`
    : "";

  const sparkHtml = todaySparkHTML(day, data, slotIndexForNow(data));
  const holidayChip = isHoliday(day.date) ? `<span class="holiday-chip">${t("holiday.chip")}</span>` : "";

  box.innerHTML = `
    <h3>${t("today.title")} · ${weekdayLabel(day.weekday)} ${d}.${m}. ${holidayChip}
      <button type="button" class="share-trigger" title="${t("today.share_tip")}">${t("today.share")}</button>
    </h3>
    ${sparkHtml}
    <ul class="blocks">${rows}</ul>
    ${toggleHtml}
  `;

  box.querySelector(".share-trigger")?.addEventListener("click", openShareCard);

  box.querySelectorAll(".fav-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      toggleFavoriteBlock(
        state.pool,
        btn.dataset.weekday,
        Number(btn.dataset.start),
        Number(btn.dataset.end),
      );
    });
  });

  box.querySelectorAll(".ics-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      downloadICS({
        iso: btn.dataset.iso,
        startMin: Number(btn.dataset.start),
        endMin: Number(btn.dataset.end),
        lanes: Number(btn.dataset.lanes),
        pool: state.pool,
      });
    });
  });

  box.querySelectorAll(".slot-link-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      openSlotModal(btn.dataset.iso, Number(btn.dataset.start));
    });
  });

  const toggle = box.querySelector(".blocks-toggle");
  if (toggle) {
    toggle.addEventListener("click", () => {
      const ul = box.querySelector(".blocks");
      const expanded = ul.classList.toggle("expanded");
      toggle.setAttribute("aria-expanded", expanded ? "true" : "false");
      toggle.textContent = expanded ? t("today.collapse") : t("today.show_all", { n: hiddenCount });
    });
  }
}

export function setupFinder() {
  const now = new Date();
  const nowRounded = Math.ceil((now.getHours() * 60 + now.getMinutes()) / 15) * 15;
  document.getElementById("finder-from").value = fmt(nowRounded);
  document.getElementById("finder-run").addEventListener("click", runFinder);
  ["finder-from","finder-min","finder-len","finder-today","finder-date"].forEach(id => {
    document.getElementById(id).addEventListener("change", runFinder);
  });
  const todayChk = document.getElementById("finder-today");
  const dateInp = document.getElementById("finder-date");
  todayChk.addEventListener("change", () => {
    if (todayChk.checked) dateInp.value = "";
  });
  dateInp.addEventListener("change", () => {
    if (dateInp.value) todayChk.checked = false;
  });
  const share = document.getElementById("finder-share");
  if (share) share.addEventListener("click", () => shareLink(share));
}

async function shareLink(btn) {
  updateURLFromState();
  const url = location.href;
  try {
    await navigator.clipboard.writeText(url);
    const orig = btn.textContent;
    btn.textContent = t("finder.copied");
    btn.classList.add("copied");
    setTimeout(() => {
      btn.textContent = orig;
      btn.classList.remove("copied");
    }, 1800);
  } catch {
    window.prompt(t("finder.copy_prompt"), url);
  }
}

export function runFinder() {
  const data = activeData();
  const box = document.getElementById("finder-results");
  if (!data || !data.days || !data.days.length) {
    box.innerHTML = `<div class="empty">${t("finder.no_pool_data", { pool: state.pool })}</div>`;
    state.finderHits = [];
    applyFinderHighlight();
    return;
  }
  const fromMin = toMin(document.getElementById("finder-from").value || "00:00");
  const minLanes = Number(document.getElementById("finder-min").value);
  const lenMin = Number(document.getElementById("finder-len").value);
  const onlyToday = document.getElementById("finder-today").checked;
  const onlyDate = document.getElementById("finder-date").value || "";
  const slot = data.slotMinutes;
  const startMin = toMin(data.dayStart);
  const todayIso = todayISO();

  const nowMinToday = new Date().getHours() * 60 + new Date().getMinutes();
  const hits = [];
  for (const day of data.days) {
    if (day.date < todayIso) continue;
    if (onlyToday && day.date !== todayIso) continue;
    if (onlyDate && day.date !== onlyDate) continue;
    const isToday = day.date === todayIso;
    let i = 0;
    while (i < day.free.length) {
      if (day.free[i] < minLanes) { i++; continue; }
      let j = i;
      let minLanesInBlock = day.free[i];
      while (j < day.free.length && day.free[j] >= minLanes) {
        minLanesInBlock = Math.min(minLanesInBlock, day.free[j]);
        j++;
      }
      const blockStart = startMin + i * slot;
      const blockEnd = startMin + j * slot;
      const lowerBound = Math.max(fromMin, isToday ? nowMinToday : 0);
      const adjStart = Math.max(blockStart, Math.ceil((lowerBound - startMin) / slot) * slot + startMin);
      if (adjStart >= blockEnd) { i = j; continue; }
      if (blockEnd - adjStart >= lenMin) {
        hits.push({
          date: day.date, weekday: day.weekday,
          startCol: Math.floor((adjStart - startMin) / slot),
          endCol: j,
          startMin: adjStart, endMin: blockEnd,
          lanes: minLanesInBlock,
        });
      }
      i = j;
    }
  }

  state.finderHits = hits;
  renderFinderResults(hits);
  applyFinderHighlight();
  updateURLFromState();
}

function renderFinderResults(hits) {
  const box = document.getElementById("finder-results");
  if (!hits.length) {
    box.innerHTML = `<div class="empty">${t("finder.empty")}</div>`;
    return;
  }
  const lenMin = Number(document.getElementById("finder-len").value);
  const parts = [`<div class="group">${t("finder.found", { n: hits.length })}</div>`];
  for (const h of hits) {
    const [, m, d] = h.date.split("-");
    const lenH = Math.floor((h.endMin - h.startMin) / 60);
    const lenM = (h.endMin - h.startMin) % 60;
    const lenStr = lenH ? `${lenH} h${lenM ? " " + lenM + " min" : ""}` : `${lenM} min`;
    const band = bandForMinOnDate(h.date, h.startMin);
    const chip = priceChipHTML(state.pool, band, lenMin);
    const icsEnd = Math.min(h.endMin, h.startMin + lenMin);
    parts.push(`<div class="hit">
      <span class="d">${weekdayShort(h.weekday)} ${d}.${m}.</span>
      <span class="t">${fmt(h.startMin)}–${fmt(h.endMin)}</span>
      <span class="len muted">${lenStr}</span>
      <span class="l">≥${h.lanes} ${lanesWord(h.lanes)}</span>
      ${chip}
      <button type="button" class="ics-btn" title="${t("today.ics_tip")}"
        data-iso="${h.date}" data-start="${h.startMin}" data-end="${icsEnd}" data-lanes="${h.lanes}">📅</button>
    </div>`);
  }
  box.innerHTML = parts.join("");
  box.querySelectorAll(".ics-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      downloadICS({
        iso: btn.dataset.iso,
        startMin: Number(btn.dataset.start),
        endMin: Number(btn.dataset.end),
        lanes: Number(btn.dataset.lanes),
        pool: state.pool,
      });
    });
  });
}

function applyFinderHighlight() {
  document.querySelectorAll("#grid .cell.match").forEach(el => el.classList.remove("match"));
  if (!state.finderHits.length) return;
  const cells = document.querySelectorAll("#grid .cell[data-date]");
  const map = new Map();
  cells.forEach(el => {
    const k = `${el.dataset.date}:${el.dataset.col}`;
    map.set(k, el);
  });
  for (const h of state.finderHits) {
    for (let c = h.startCol; c < h.endCol; c++) {
      const el = map.get(`${h.date}:${c}`);
      if (el) el.classList.add("match");
    }
  }
}

function buildShareCardHTML(data, now) {
  const poolLabel = state.pool === "25m" ? t("pools.25m") : t("pools.50m");
  const dateStr = now.toLocaleDateString(getLang() === "en" ? "en-GB" : "sk-SK", {
    weekday: "long", day: "numeric", month: "numeric", year: "numeric",
  });
  const updatedStr = data?.updated ? t("share.data", { date: data.updated }) : "";
  const todayIso = todayISO(now);
  const holChip = isHoliday(todayIso) ? `<span class="holiday-chip">${t("holiday.chip")}</span>` : "";
  const headHTML = `
    <div class="sc-head">
      <div class="sc-brand">${t("share.brand")}</div>
      <div class="sc-pool">${poolLabel}</div>
      ${holChip}
      <div class="sc-date">${dateStr}</div>
    </div>`;
  const footHTML = `
    <div class="sc-foot">
      <span class="sc-url">dscibrany.github.io/starzpools</span>
      ${updatedStr ? `<span class="sc-updated">${updatedStr}</span>` : ""}
    </div>`;
  if (!data) {
    return `${headHTML}<div class="sc-empty">${t("share.no_data")}</div>${footHTML}`;
  }
  const iso = todayISO(now);
  const day = findDay(data, iso);
  if (!day) {
    return `${headHTML}<div class="sc-empty">${t("share.no_record")}</div>${footHTML}`;
  }
  const blocks = collapseBlocks(day.free, data.slotMinutes, toMin(data.dayStart));
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const maxLanes = data.maxLanes;
  if (!blocks.length) {
    return `${headHTML}<div class="sc-empty">${t("share.no_blocks")}</div>${footHTML}`;
  }
  const rows = blocks.map(b => {
    const level = levelFor(b.lanes, maxLanes);
    const isPast = b.endMin <= nowMin;
    const isLive = nowMin >= b.startMin && nowMin < b.endMin;
    const lenMin = b.endMin - b.startMin;
    const lenH = Math.floor(lenMin / 60), lenR = lenMin % 60;
    const lenStr = lenH ? `${lenH} h${lenR ? " " + lenR + " min" : ""}` : `${lenR} min`;
    const dotsFilled = "●".repeat(b.lanes);
    const dotsEmpty = "○".repeat(Math.max(0, maxLanes - b.lanes));
    const tag = isLive ? `<span class="sc-tag live">${t("today.tag.live")}</span>`
             : isPast ? `<span class="sc-tag past">${t("today.tag.past")}</span>` : "";
    return `<li class="${isPast ? "past" : isLive ? "live" : ""}">
      <span class="sc-time">${fmt(b.startMin)}–${fmt(b.endMin)}</span>
      <span class="sc-dur">${lenStr}</span>
      <span class="sc-lanes lane-${level}">${b.lanes} ${lanesWord(b.lanes)}</span>
      <span class="sc-dots lane-${level}" aria-hidden="true"><span class="on">${dotsFilled}</span><span class="off">${dotsEmpty}</span></span>
      ${tag}
    </li>`;
  }).join("");
  return `${headHTML}
    <ul class="sc-blocks">${rows}</ul>
    <div class="sc-legend">${t("share.max_lanes", { max: maxLanes })}</div>
    ${footHTML}`;
}

function openShareCard() {
  const modal = document.getElementById("share-modal");
  const card = document.getElementById("share-card");
  if (!modal || !card) return;
  card.innerHTML = buildShareCardHTML(activeData(), new Date());
  modal.hidden = false;
  document.body.classList.add("share-open");
  document.getElementById("share-close")?.focus();
}

function closeShareCard() {
  const modal = document.getElementById("share-modal");
  if (!modal) return;
  modal.hidden = true;
  document.body.classList.remove("share-open");
}

export function setupShareModal() {
  const modal = document.getElementById("share-modal");
  if (!modal) return;
  modal.addEventListener("click", (e) => {
    const el = e.target;
    if (el && el instanceof Element && el.getAttribute("data-close") === "1") closeShareCard();
  });
  document.getElementById("share-print")?.addEventListener("click", () => window.print());
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !modal.hidden) closeShareCard();
  });
}

function parseSlotParam(raw) {
  if (!raw) return null;
  const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})$/.exec(raw);
  if (!m) return null;
  return { iso: m[1], startMin: Number(m[2]) * 60 + Number(m[3]) };
}

function buildSlotURL(iso, startMin) {
  const params = new URLSearchParams();
  if (state.pool !== "50m") params.set("pool", state.pool);
  params.set("slot", `${iso}T${fmt(startMin)}`);
  const qs = params.toString();
  return location.origin + location.pathname + (qs ? "?" + qs : "");
}

export function applySlotFromURL() {
  const raw = new URLSearchParams(location.search).get("slot");
  const parsed = parseSlotParam(raw);
  if (!parsed) return;
  openSlotModal(parsed.iso, parsed.startMin);
}

function findBlockContaining(day, data, startMin) {
  const blocks = collapseBlocks(day.free, data.slotMinutes, toMin(data.dayStart));
  return blocks.find(b => startMin >= b.startMin && startMin < b.endMin) || null;
}

export function openSlotModal(iso, startMin) {
  const modal = document.getElementById("slot-modal");
  const card = document.getElementById("slot-card");
  const icsBtn = document.getElementById("slot-ics");
  const favBtn = document.getElementById("slot-fav");
  const copyBtn = document.getElementById("slot-copy");
  if (!modal || !card) return;

  const data = activeData();
  const day = data ? findDay(data, iso) : null;
  const [, m, d] = iso.split("-");
  const maxLanes = data?.maxLanes || 4;

  if (!day) {
    card.innerHTML = `
      <div class="slot-head">
        <div class="slot-title" id="slot-title">${d}.${m}. · ${fmt(startMin)}</div>
      </div>
      <div class="slot-body muted">${t("slot.no_data")}</div>
    `;
    if (icsBtn) icsBtn.hidden = true;
    if (favBtn) favBtn.hidden = true;
  } else {
    const block = findBlockContaining(day, data, startMin);
    const weekday = day.weekday;
    const slotIdx = Math.floor((startMin - toMin(data.dayStart)) / data.slotMinutes);
    const avg = trendAvgFor(state.pool, weekday, slotIdx);

    if (!block) {
      card.innerHTML = `
        <div class="slot-head">
          <div class="slot-title" id="slot-title">${weekdayLabel(weekday)} · ${fmt(startMin)}</div>
          <span class="slot-pool">${state.pool}</span>
          ${isHoliday(iso) ? `<span class="holiday-chip">${t("holiday.chip")}</span>` : ""}
        </div>
        <div class="slot-body muted">${t("slot.closed")}</div>
      `;
      if (icsBtn) icsBtn.hidden = true;
      if (favBtn) favBtn.hidden = true;
    } else {
      const level = levelFor(block.lanes, maxLanes);
      const dotsOn = "●".repeat(block.lanes);
      const dotsOff = "○".repeat(Math.max(0, maxLanes - block.lanes));
      const trendHTML = (avg != null)
        ? (() => {
            const delta = block.lanes - avg;
            const sign = delta > 0 ? "+" : delta < 0 ? "−" : "±";
            const abs = (Math.round(Math.abs(delta) * 10) / 10).toFixed(1);
            const cls = Math.abs(delta) >= 1.5 ? (delta > 0 ? "quiet" : "busy") : "";
            return `<div class="slot-trend ${cls}">${t("slot.trend_avg", {
              weekday: weekdayLabel(weekday),
              time: fmt(block.startMin),
              avg: (Math.round(avg * 10) / 10).toFixed(1),
              max: maxLanes,
              delta: `${sign}${abs}`,
            })}</div>`;
          })()
        : `<div class="slot-trend muted">${t("slot.trend_none")}</div>`;

      card.innerHTML = `
        <div class="slot-head">
          <div class="slot-title" id="slot-title">${weekdayLabel(weekday)} · ${fmt(block.startMin)}–${fmt(block.endMin)}</div>
          <span class="slot-pool">${state.pool}</span>
          ${isHoliday(iso) ? `<span class="holiday-chip">${t("holiday.chip")}</span>` : ""}
        </div>
        <div class="slot-lanes lane-${level}">
          <span class="slot-lanes-big">${block.lanes} / ${maxLanes}</span>
          <span class="slot-dots lane-${level}" aria-hidden="true"><span class="on">${dotsOn}</span><span class="off">${dotsOff}</span></span>
          <span class="slot-lanes-word">${lanesWord(block.lanes)}</span>
        </div>
        ${trendHTML}
      `;

      if (icsBtn) {
        icsBtn.hidden = false;
        icsBtn.onclick = () => downloadICS({
          iso, startMin: block.startMin, endMin: block.endMin,
          lanes: block.lanes, pool: state.pool,
        });
      }
      if (favBtn) {
        const isFav = !!findFavoriteForBlock(state.pool, weekday, block.startMin, block.endMin);
        favBtn.hidden = false;
        favBtn.textContent = t(isFav ? "today.fav.remove" : "slot.favorite");
        favBtn.onclick = () => {
          toggleFavoriteBlock(state.pool, weekday, block.startMin, block.endMin);
          const nowFav = !!findFavoriteForBlock(state.pool, weekday, block.startMin, block.endMin);
          favBtn.textContent = t(nowFav ? "today.fav.remove" : "slot.favorite");
        };
      }
    }
  }

  if (copyBtn) {
    copyBtn.textContent = t("slot.copy");
    copyBtn.classList.remove("copied");
    copyBtn.onclick = async () => {
      const url = buildSlotURL(iso, startMin);
      try {
        await navigator.clipboard.writeText(url);
        copyBtn.textContent = t("finder.copied");
        copyBtn.classList.add("copied");
        setTimeout(() => {
          copyBtn.textContent = t("slot.copy");
          copyBtn.classList.remove("copied");
        }, 1800);
      } catch {
        window.prompt(t("finder.copy_prompt"), url);
      }
    };
  }

  modal.hidden = false;
  document.body.classList.add("share-open");
  document.getElementById("slot-close")?.focus();
}

function closeSlotModal() {
  const modal = document.getElementById("slot-modal");
  if (!modal) return;
  modal.hidden = true;
  if (document.getElementById("share-modal")?.hidden !== false) {
    document.body.classList.remove("share-open");
  }
  const params = new URLSearchParams(location.search);
  if (params.has("slot")) {
    params.delete("slot");
    const qs = params.toString();
    history.replaceState(null, "", location.pathname + (qs ? "?" + qs : "") + location.hash);
  }
}

export function setupSlotModal() {
  const modal = document.getElementById("slot-modal");
  if (!modal) return;
  modal.addEventListener("click", (e) => {
    const el = e.target;
    if (el && el instanceof Element && el.getAttribute("data-close") === "1") closeSlotModal();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !modal.hidden) closeSlotModal();
  });
}

export function renderTrend() {
  const grid = document.getElementById("trend-grid");
  const meta = document.getElementById("trend-meta");
  const legend = document.getElementById("trend-legend");
  if (!grid || !meta || !legend) return;

  const trend = state.trend;
  if (!trend || !trend.pools || !trend.pools[state.pool]) {
    grid.innerHTML = "";
    legend.innerHTML = "";
    meta.textContent = t("trend.no_data");
    return;
  }
  const p = trend.pools[state.pool];
  const maxLanes = p.maxLanes || 4;
  const slotMin = p.slotMinutes || 15;
  const startMin = toMin(p.dayStart || "05:00");
  const endMin = toMin(p.dayEnd || "24:00");
  const cols = Math.ceil((endMin - startMin) / slotMin);

  const byWd = p.byWeekday || {};
  const totalSamples = Object.values(byWd).reduce((a, b) => a + (b.samples || 0), 0);
  meta.textContent = t("trend.meta", {
    weeks: trend.windowWeeks || 8,
    pool: state.pool,
    samples: totalSamples,
    updated: trend.updated || "—",
  });

  grid.style.gridTemplateColumns = `110px repeat(${cols}, minmax(10px, 1fr))`;
  grid.innerHTML = "";
  grid.setAttribute("role", "grid");
  grid.setAttribute("aria-label", t("trend.title"));
  grid.setAttribute("aria-rowcount", String(WEEKDAYS.length + 1));
  grid.setAttribute("aria-colcount", String(cols + 1));

  const corner = document.createElement("div");
  corner.className = "cell header rowhead";
  corner.textContent = t("grid.day_header");
  grid.appendChild(corner);
  for (let c = 0; c < cols; c++) {
    const tm = startMin + c * slotMin;
    const el = document.createElement("div");
    el.className = "cell header tick";
    if (tm % 60 === 0) {
      el.textContent = String(Math.floor(tm / 60));
      el.classList.add("hour");
    }
    grid.appendChild(el);
  }

  let initialFocusCell = null;
  for (let r = 0; r < WEEKDAYS.length; r++) {
    const wd = WEEKDAYS[r];
    const bucket = byWd[wd];
    const head = document.createElement("div");
    head.className = "cell rowhead";
    head.innerHTML = `<span class="dow">${weekdayShort(wd)}</span> <span class="date">${weekdayLabel(wd)}</span>`;
    grid.appendChild(head);
    const avg = bucket?.avg || [];
    for (let c = 0; c < cols; c++) {
      const v = avg[c];
      const el = document.createElement("div");
      el.setAttribute("role", "gridcell");
      el.setAttribute("tabindex", "-1");
      el.dataset.wd = wd;
      el.dataset.row = String(r);
      el.dataset.col = String(c);
      if (!bucket || v == null) {
        el.className = "cell lane-0";
        el.title = t("trend.tooltip_nodata", { weekday: weekdayLabel(wd), time: fmt(startMin + c * slotMin) });
      } else {
        const rounded = Math.round(v * 10) / 10;
        const level = v <= 0 ? 0 : levelFor(Math.max(1, Math.round(v)), maxLanes);
        el.className = `cell lane-${level}`;
        const avgWhole = Math.max(0, Math.min(maxLanes, Math.round(v)));
        const dotsViz = " · " + "●".repeat(avgWhole) + "○".repeat(maxLanes - avgWhole);
        el.title = t("trend.tooltip", {
          weekday: weekdayLabel(wd),
          time: fmt(startMin + c * slotMin),
          avg: rounded,
          max: maxLanes,
          samples: bucket.samples,
        }) + dotsViz;
      }
      el.setAttribute("aria-label", el.title);
      if (!initialFocusCell) initialFocusCell = el;
      grid.appendChild(el);
    }
  }

  if (initialFocusCell) initialFocusCell.setAttribute("tabindex", "0");

  renderTrendLegend(legend, maxLanes);
}

function renderTrendLegend(el, max) {
  const q = (n) => Math.max(1, Math.round(max * n));
  const range = (lo, hi) => lo === hi ? String(lo) : `${lo}–${hi}`;
  const r1Hi = q(0.25);
  const r2Lo = r1Hi + 1, r2Hi = q(0.5);
  const r3Lo = r2Hi + 1, r3Hi = q(0.75);
  const r4Lo = r3Hi + 1, r4Hi = max;
  el.innerHTML = `
    <span>${t("trend.legend", { max })}</span>
    <span><i class="sw lane-0"></i> ${t("legend.closed")}</span>
    <span><i class="sw lane-1"></i> ${range(1, r1Hi)}</span>
    ${r2Lo <= r2Hi ? `<span><i class="sw lane-2"></i> ${range(r2Lo, r2Hi)}</span>` : ""}
    ${r3Lo <= r3Hi ? `<span><i class="sw lane-3"></i> ${range(r3Lo, r3Hi)}</span>` : ""}
    ${r4Lo <= r4Hi ? `<span><i class="sw lane-4"></i> ${range(r4Lo, r4Hi)}</span>` : ""}
  `;
}
