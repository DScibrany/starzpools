const WEEKDAY_SHORT = {
  pondelok: "Po", utorok: "Ut", streda: "St", "štvrtok": "Št",
  piatok: "Pi", sobota: "So", "nedeľa": "Ne",
};
const POOL_PAGE = {
  "25m": "https://bratislava.sk/vzdelavanie-a-volny-cas/starz/prevadzky-sportoviska/mestska-plavaren-pasienky-25m",
  "50m": "https://bratislava.sk/vzdelavanie-a-volny-cas/starz/prevadzky-sportoviska/mestska-plavaren-pasienky-50m",
};
const POOL_FILE = { "25m": "schedule.json", "50m": "schedule-50m.json" };

const toMin = (hhmm) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};
const fmt = (min) => {
  const h = String(Math.floor((min % 1440) / 60)).padStart(2, "0");
  const m = String(min % 60).padStart(2, "0");
  return `${h}:${m}`;
};
const pad = (n) => String(n).padStart(2, "0");
const lanesWord = (n) => (n === 1 ? "dráha" : n >= 2 && n <= 4 ? "dráhy" : "dráh");
const todayISO = (d = new Date()) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

const THEMES = ["viridis", "blues", "traffic", "diverging"];
const state = {
  pool: "50m",
  view: "dashboard",
  theme: "viridis",
  data: { "25m": null, "50m": null },
  pricing: null,
  finderHits: [],
};

async function fetchJSON(path) {
  const res = await fetch(path, { cache: "no-store" });
  if (!res.ok) throw new Error(`${path}: ${res.status}`);
  return res.json();
}

async function load() {
  const [d25, d50, pricing] = await Promise.all([
    fetchJSON(POOL_FILE["25m"]).catch(() => null),
    fetchJSON(POOL_FILE["50m"]).catch(() => null),
    fetchJSON("pricing.json").catch(() => null),
  ]);
  state.data["25m"] = d25;
  state.data["50m"] = d50;
  state.pricing = pricing;

  setupViews();
  setupTabs();
  setupTheme();
  setupFinder();
  setupLinks();
  setupGridTooltip();
  renderPricingStaleBanner();
  renderPricing();
  render();
  setInterval(render, 30_000);
}

function renderPricingStaleBanner() {
  const el = document.getElementById("pricing-stale");
  if (!el) return;
  const st = state.pricing?.status;
  if (!st || st.upToDate !== false) {
    el.hidden = true;
    return;
  }
  const page = st.sourcePage || POOL_PAGES["25m"];
  const reason = st.reason === "missing-link"
    ? "Na stránke bazéna sa už nenašiel odkaz na cenník."
    : st.reason === "download-failed"
      ? "Aktuálny cenník sa nepodarilo stiahnuť."
      : "Cenník na stránke bazéna sa líši od uloženej kópie.";
  const checked = st.lastChecked ? ` (overené ${st.lastChecked})` : "";
  el.innerHTML = `
    <strong>Cenník môže byť neaktuálny.</strong>
    <span>${reason}${checked}</span>
    <a href="${page}" target="_blank" rel="noopener">Otvoriť stránku bazéna ↗</a>
  `;
  el.hidden = false;
}

function applyTheme(name) {
  if (!THEMES.includes(name)) name = "traffic";
  state.theme = name;
  document.body.classList.remove(...THEMES.map(t => "theme-" + t));
  document.body.classList.add("theme-" + name);
  try { localStorage.setItem("starz-theme", name); } catch {}
}

function setupTheme() {
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

function setupViews() {
  const tabs = document.querySelectorAll(".view-tab");
  const apply = (name) => {
    state.view = name;
    tabs.forEach(x => {
      const active = x.dataset.view === name;
      x.classList.toggle("active", active);
      x.setAttribute("aria-selected", active ? "true" : "false");
    });
    document.getElementById("dashboard-view").hidden = name !== "dashboard";
    document.getElementById("pricing-view").hidden = name !== "pricing";
    if (location.hash.slice(1) !== name) history.replaceState(null, "", "#" + name);
  };
  tabs.forEach(t => t.addEventListener("click", () => apply(t.dataset.view)));
  const fromHash = location.hash.slice(1);
  apply(fromHash === "pricing" ? "pricing" : "dashboard");
}

function isHoliday(iso) {
  return Array.isArray(state.pricing?.holidays) && state.pricing.holidays.includes(iso);
}

function bandForMinOnDate(iso, minOfDay) {
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

function bandForDate(date) {
  const iso = todayISO(date);
  return bandForMinOnDate(iso, date.getHours() * 60 + date.getMinutes());
}

function findPricingRow(code) {
  if (!code || !state.pricing?.sections) return null;
  for (const sec of state.pricing.sections) {
    for (const r of (sec.rows || [])) {
      if (r.code === code) return r;
    }
  }
  return null;
}

function priceFor(pool, band, category, duration) {
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

function bandLabel(band) {
  return state.pricing?.bandLabels?.[band] || band;
}

function priceWithCurrency(v) {
  const cur = state.pricing?.currency || "€";
  if (!v) return "";
  if (v === "—" || v.toLowerCase?.() === "dohodou") return v;
  if (/\d/.test(v) && !v.includes(cur) && !v.includes("%")) return `${v} ${cur}`;
  return v;
}

function renderBandChip(el, band) {
  if (!el) return;
  el.className = `band-chip ${band}`;
  el.textContent = bandLabel(band);
}

function isPricingStale() {
  return state.pricing?.status?.upToDate === false;
}

const STALE_TITLE = "Cenník môže byť neaktuálny — overte na stránke bazéna.";

function renderNowPrices(box, band) {
  if (!box) return;
  box.classList.toggle("stale", isPricingStale());
  if (!state.pricing || band === "outside") {
    const msg = band === "outside"
      ? (state.pricing?.bandLabels?.outside || "mimo predaja vstupeniek")
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
        ${reduced ? `<span class="np-lbl" title="zľavnené (ŤZP, do 18 r.)">zľavnené${reduced.old ? ` <span class="np-old">${priceWithCurrency(reduced.old)}</span>` : ""} ${priceWithCurrency(reduced.value)}</span>` : ""}
      </div>
    `);
  }
  box.innerHTML = items.join("") || `<span class="np-note">${bandLabel(band)}</span>`;
}

function priceChipHTML(pool, band, duration) {
  if (band === "outside" || !state.pricing?.bandCodes) {
    return `<span class="price-chip muted"><span class="pc-band">mimo predaja</span></span>`;
  }
  const p = priceFor(pool, band, "adult", duration);
  if (!p) return "";
  const label = band === "peak" ? "špička" : band === "offpeak" ? "mimo šp." : band;
  const oldHtml = p.old ? `<span class="pc-old">${priceWithCurrency(p.old)}</span>` : "";
  const stale = isPricingStale();
  const staleCls = stale ? " stale" : "";
  const staleMark = stale ? `<span class="pc-stale" title="${STALE_TITLE}">⚠</span>` : "";
  return `<span class="price-chip${staleCls}" ${stale ? `title="${STALE_TITLE}"` : ""}><span class="pc-band">${label} · ${duration}m</span><span class="pc-price">${staleMark}${oldHtml}${priceWithCurrency(p.value || "—")}</span></span>`;
}

function activeData() { return state.data[state.pool]; }

function setupTabs() {
  const tabs = document.querySelectorAll(".pool-tab");
  tabs.forEach(t => {
    t.addEventListener("click", () => {
      state.pool = t.dataset.pool;
      tabs.forEach(x => {
        const active = x.dataset.pool === state.pool;
        x.classList.toggle("active", active);
        x.setAttribute("aria-selected", active ? "true" : "false");
      });
      setupLinks();
      state.finderHits = [];
      document.getElementById("finder-results").innerHTML = "";
      renderPricing();
      render();
    });
  });
}

function setupLinks() {
  const d = activeData();
  const poolText = state.pool === "25m" ? "Stránka 25 m ↗" : "Stránka 50 m ↗";
  document.querySelectorAll(".link-pool").forEach(a => {
    a.href = POOL_PAGE[state.pool];
    a.textContent = poolText;
  });
  document.querySelectorAll(".link-source").forEach(a => {
    a.href = d?.source || POOL_PAGE[state.pool];
  });
  const priceUrl = state.pricing?.source;
  document.querySelectorAll(".link-pricing").forEach(a => {
    if (priceUrl) {
      a.href = priceUrl;
      a.style.display = "";
    } else {
      a.style.display = "none";
    }
  });
}

function slotIndexForNow(data) {
  const now = new Date();
  const min = now.getHours() * 60 + now.getMinutes();
  const start = toMin(data.dayStart);
  if (min < start) return -1;
  const cols = Math.ceil((toMin(data.dayEnd) - start) / data.slotMinutes);
  const idx = Math.floor((min - start) / data.slotMinutes);
  return idx >= cols ? cols : idx;
}

function findDay(data, iso) { return data.days.find(d => d.date === iso); }

function collapseBlocks(free, slotMinutes, startMin) {
  const blocks = [];
  let i = 0;
  while (i < free.length) {
    if (free[i] === 0) { i++; continue; }
    let j = i;
    while (j < free.length && free[j] === free[i]) j++;
    blocks.push({
      startMin: startMin + i * slotMinutes,
      endMin: startMin + j * slotMinutes,
      lanes: free[i],
    });
    i = j;
  }
  return blocks;
}

function render() {
  const data = activeData();
  const now = new Date();
  document.getElementById("now").textContent =
    now.toLocaleString("sk-SK", {
      weekday: "short", day: "2-digit", month: "2-digit",
      hour: "2-digit", minute: "2-digit",
    });
  document.getElementById("updated").textContent =
    data?.updated ? `Posledná aktualizácia: ${data.updated}.` : "";

  if (!data || !data.days || data.days.length === 0) {
    renderEmpty();
    return;
  }
  renderNow(now, data);
  renderHeatmap(now, data);
  renderTodayBlocks(now, data);
  applyFinderHighlight();
}

function renderEmpty() {
  const big = document.getElementById("now-big");
  const sub = document.getElementById("now-sub");
  const next = document.getElementById("now-next");
  const pill = document.getElementById("status-pill");
  const card = document.getElementById("now-card");
  card.classList.remove("live");
  pill.textContent = "Bez dát";
  pill.className = "pill";
  big.textContent = "—";
  sub.textContent = "Pre tento bazén ešte nie sú v repozitári žiadne údaje.";
  next.textContent = "Doplňte hodnoty do zodpovedajúceho schedule súboru.";
  document.getElementById("today-blocks").innerHTML =
    `<div class="empty-state">Nie sú k dispozícii dáta pre ${state.pool} bazén.<br>Upravte <code>${POOL_FILE[state.pool]}</code>.</div>`;
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
  const pricesBox = document.getElementById("now-prices");

  if (!day) {
    renderBandChip(chip, "outside");
    card.classList.remove("live");
    pill.textContent = "Mimo rozvrhu";
    pill.className = "pill";
    big.textContent = "—";
    sub.textContent = "Pre dnešný dátum nie je v rozvrhu záznam.";
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

  big.innerHTML = `${currentFree}<span class="of"> / ${data.maxLanes}</span>`;
  if (currentFree > 0) {
    pill.textContent = "Otvorené pre verejnosť";
    pill.className = "pill open";
    card.classList.add("live");
    const slotStart = startMin + idx * slot;
    sub.textContent = `voľných dráh · prebiehajúci blok ${fmt(slotStart)}–${fmt(slotStart + slot)}`;
  } else {
    pill.textContent = "Mimo verejnej prevádzky";
    pill.className = "pill closed";
    card.classList.remove("live");
    sub.textContent = "pre verejnosť práve nie sú k dispozícii dráhy";
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
    next.textContent = `Blok končí o ${fmt(endMin)} (o ${mins} min).`;
  } else if (nextIdx >= 0) {
    const t = startMin + nextIdx * slot;
    const mins = t - (now.getHours() * 60 + now.getMinutes());
    next.textContent = `Najbližší verejný blok: ${fmt(t)} (${day.free[nextIdx]} ${lanesWord(day.free[nextIdx])}) · o ${mins} min.`;
  } else {
    next.textContent = "Dnes už nie je ďalší verejný blok.";
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

  const corner = document.createElement("div");
  corner.className = "cell header rowhead";
  corner.textContent = "deň";
  grid.appendChild(corner);
  for (let c = 0; c < cols; c++) {
    const t = startMin + c * slot;
    const el = document.createElement("div");
    el.className = "cell header tick";
    if (inNowBand(c)) {
      el.classList.add("now-col");
      if (c === nowStart) el.classList.add("now-col-start");
      if (c === nowEnd) el.classList.add("now-col-end");
    }
    if (t % 60 === 0) {
      el.textContent = String(Math.floor(t / 60));
      el.classList.add("hour");
    }
    grid.appendChild(el);
  }

  for (const day of data.days) {
    const isToday = day.date === todayIso;
    const head = document.createElement("div");
    head.className = "cell rowhead" + (isToday ? " today" : "");
    const [, m, d] = day.date.split("-");
    head.innerHTML = `<span class="dow">${WEEKDAY_SHORT[day.weekday] || day.weekday}</span> <span class="date">${d}.${m}.</span>`;
    grid.appendChild(head);

    for (let c = 0; c < cols; c++) {
      const raw = day.free[c] ?? 0;
      const level = levelFor(raw, data.maxLanes);
      const el = document.createElement("div");
      el.className = `cell lane-${level}`;
      if (raw > 0) el.dataset.free = String(raw);
      if (isToday && inNowBand(c)) {
        el.classList.add("now");
        if (c === nowStart) el.classList.add("now-start");
        if (c === nowEnd) el.classList.add("now-end");
      }
      const s = startMin + c * slot;
      el.title = `${day.weekday} ${d}.${m}. · ${fmt(s)}–${fmt(s + slot)} · ${raw === 0 ? "žiadne voľné dráhy" : raw + " / " + data.maxLanes + " dráh"}`;
      el.dataset.date = day.date;
      el.dataset.col = String(c);
      grid.appendChild(el);
    }
  }

  renderLegend(data.maxLanes);
  const tip = document.getElementById("grid-tooltip");
  if (tip) { tip.hidden = true; tip.dataset.forCell = ""; }
}

function setupGridTooltip() {
  const wrap = document.querySelector(".grid-wrap");
  if (!wrap) return;
  const tip = document.createElement("div");
  tip.id = "grid-tooltip";
  tip.hidden = true;
  wrap.appendChild(tip);

  const clearSelected = () => {
    wrap.querySelectorAll(".cell.selected").forEach(el => el.classList.remove("selected"));
  };
  const hide = () => {
    tip.hidden = true;
    tip.dataset.forCell = "";
    clearSelected();
  };

  wrap.addEventListener("click", (e) => {
    const cell = e.target.closest(".cell[data-date]");
    if (!cell) { hide(); return; }
    const key = `${cell.dataset.date}:${cell.dataset.col}`;
    if (!tip.hidden && tip.dataset.forCell === key) { hide(); return; }
    clearSelected();
    cell.classList.add("selected");
    tip.textContent = cell.title || "";
    tip.hidden = false;
    tip.dataset.forCell = key;
    requestAnimationFrame(() => {
      const cr = cell.getBoundingClientRect();
      const wr = wrap.getBoundingClientRect();
      const tipW = tip.offsetWidth;
      const tipH = tip.offsetHeight;
      let left = cr.left - wr.left + wrap.scrollLeft + cr.width / 2 - tipW / 2;
      const maxLeft = wrap.scrollLeft + wrap.clientWidth - tipW - 6;
      left = Math.max(wrap.scrollLeft + 6, Math.min(left, maxLeft));
      let top = cr.top - wr.top + wrap.scrollTop - tipH - 8;
      if (top < wrap.scrollTop + 2) top = cr.bottom - wr.top + wrap.scrollTop + 8;
      tip.style.left = left + "px";
      tip.style.top = top + "px";
    });
  });

  document.addEventListener("click", (e) => {
    if (tip.hidden) return;
    if (!e.target.closest(".grid-wrap")) hide();
  });
  wrap.addEventListener("scroll", hide, { passive: true });
  window.addEventListener("resize", hide);
}

function levelFor(raw, max) {
  if (raw <= 0) return 0;
  const r = raw / max;
  if (r <= 0.25) return 1;
  if (r <= 0.5) return 2;
  if (r <= 0.75) return 3;
  return 4;
}

function renderLegend(max) {
  const legend = document.querySelector(".legend");
  if (!legend) return;
  const q = (n) => Math.max(1, Math.round(max * n));
  const range = (lo, hi) => lo === hi ? String(lo) : `${lo}–${hi}`;
  const r1Hi = q(0.25);
  const r2Lo = r1Hi + 1, r2Hi = q(0.5);
  const r3Lo = r2Hi + 1, r3Hi = q(0.75);
  const r4Lo = r3Hi + 1, r4Hi = max;
  legend.innerHTML = `
    <span>voľných dráh (z ${max}):</span>
    <span><i class="sw lane-0"></i> 0 (mimo verejnosti)</span>
    <span><i class="sw lane-1"></i> ${range(1, r1Hi)}</span>
    ${r2Lo <= r2Hi ? `<span><i class="sw lane-2"></i> ${range(r2Lo, r2Hi)}</span>` : ""}
    ${r3Lo <= r3Hi ? `<span><i class="sw lane-3"></i> ${range(r3Lo, r3Hi)}</span>` : ""}
    ${r4Lo <= r4Hi ? `<span><i class="sw lane-4"></i> ${range(r4Lo, r4Hi)}</span>` : ""}
    <span><i class="sw now"></i> aktuálna hodina</span>
  `;
}

function renderTodayBlocks(now, data) {
  const iso = todayISO(now);
  const day = findDay(data, iso);
  const box = document.getElementById("today-blocks");
  if (!day) {
    box.innerHTML = `<h3>Dnes</h3><div class="muted">Pre dnešok nie je záznam.</div>`;
    return;
  }
  const blocks = collapseBlocks(day.free, data.slotMinutes, toMin(data.dayStart));
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const [, m, d] = day.date.split("-");
  if (!blocks.length) {
    box.innerHTML = `<h3>Dnes (${d}.${m}.)</h3><div class="muted">Žiadne verejné bloky.</div>`;
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
    return `<li class="${cls}">
      <span class="time">${fmt(b.startMin)}–${fmt(b.endMin)}</span>
      <span class="lanes lane-${level}">${b.lanes} ${lanesWord(b.lanes)}</span>
      ${it.live ? '<span class="tag">prebieha</span>' : it.past ? '<span class="tag past">skončilo</span>' : ''}
    </li>`;
  }).join("");

  const toggleHtml = hiddenCount > 0
    ? `<button type="button" class="blocks-toggle" aria-expanded="false">Zobraziť všetko (+${hiddenCount})</button>`
    : "";

  box.innerHTML = `
    <h3>Dnes · ${day.weekday} ${d}.${m}.</h3>
    <ul class="blocks">${rows}</ul>
    ${toggleHtml}
  `;

  const toggle = box.querySelector(".blocks-toggle");
  if (toggle) {
    toggle.addEventListener("click", () => {
      const ul = box.querySelector(".blocks");
      const expanded = ul.classList.toggle("expanded");
      toggle.setAttribute("aria-expanded", expanded ? "true" : "false");
      toggle.textContent = expanded ? "Zbaliť" : `Zobraziť všetko (+${hiddenCount})`;
    });
  }
}

function setupFinder() {
  const now = new Date();
  const nowRounded = Math.ceil((now.getHours() * 60 + now.getMinutes()) / 15) * 15;
  document.getElementById("finder-from").value = fmt(nowRounded);
  document.getElementById("finder-run").addEventListener("click", runFinder);
  ["finder-from","finder-min","finder-len","finder-today"].forEach(id => {
    document.getElementById(id).addEventListener("change", runFinder);
  });
}

function runFinder() {
  const data = activeData();
  const box = document.getElementById("finder-results");
  if (!data || !data.days || !data.days.length) {
    box.innerHTML = `<div class="empty">Pre ${state.pool} bazén nie sú dostupné žiadne dáta.</div>`;
    state.finderHits = [];
    applyFinderHighlight();
    return;
  }
  const fromMin = toMin(document.getElementById("finder-from").value || "00:00");
  const minLanes = Number(document.getElementById("finder-min").value);
  const lenMin = Number(document.getElementById("finder-len").value);
  const onlyToday = document.getElementById("finder-today").checked;
  const slot = data.slotMinutes;
  const startMin = toMin(data.dayStart);
  const need = Math.ceil(lenMin / slot);
  const todayIso = todayISO();

  const nowMinToday = new Date().getHours() * 60 + new Date().getMinutes();
  const hits = [];
  for (const day of data.days) {
    if (day.date < todayIso) continue;
    if (onlyToday && day.date !== todayIso) continue;
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
}

function renderFinderResults(hits) {
  const box = document.getElementById("finder-results");
  if (!hits.length) {
    box.innerHTML = `<div class="empty">Nenašli sa žiadne zhodné bloky. Skúste iný čas alebo menej dráh.</div>`;
    return;
  }
  const lenMin = Number(document.getElementById("finder-len").value);
  const parts = [`<div class="group">Nájdené okná: ${hits.length}</div>`];
  for (const h of hits) {
    const [, m, d] = h.date.split("-");
    const lenH = Math.floor((h.endMin - h.startMin) / 60);
    const lenM = (h.endMin - h.startMin) % 60;
    const lenStr = lenH ? `${lenH} h${lenM ? " " + lenM + " min" : ""}` : `${lenM} min`;
    const band = bandForMinOnDate(h.date, h.startMin);
    const chip = priceChipHTML(state.pool, band, lenMin);
    parts.push(`<div class="hit">
      <span class="d">${WEEKDAY_SHORT[h.weekday] || h.weekday} ${d}.${m}.</span>
      <span class="t">${fmt(h.startMin)}–${fmt(h.endMin)}</span>
      <span class="len muted">${lenStr}</span>
      <span class="l">≥${h.lanes} ${lanesWord(h.lanes)}</span>
      ${chip}
    </div>`);
  }
  box.innerHTML = parts.join("");
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

function renderPricing() {
  const body = document.getElementById("pricing-body");
  const foot = document.querySelector(".pricing-foot");
  const banner = document.getElementById("pricing-banner");
  const priceNote = document.getElementById("pricing-note");
  const activePool = state.pool;
  if (!state.pricing || !state.pricing.sections) {
    body.innerHTML = `<div class="empty-state">Cenník nie je k dispozícii. Pridajte hodnoty do <code>pricing.json</code>.</div>`;
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
    if (!newVal && !oldVal) return `<span class="empty">— doplňte —</span>`;
    const parts = [];
    if (oldVal) parts.push(`<span class="old">${withUnit(oldVal)}</span>`);
    if (newVal) parts.push(`<span class="new">${withUnit(newVal)}</span>`);
    if (stale) parts.push(`<span class="cell-stale" title="${STALE_TITLE}">⚠</span>`);
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
                <th>Kód</th>
                <th>Popis</th>
                <th>Jednotka</th>
                <th class="${activePool === "50m" ? "active" : ""}">50 m bazén</th>
                <th class="${activePool === "25m" ? "active" : ""}">25 m bazén</th>
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
  if (state.pricing.effectiveFrom) parts.push(`Platnosť od: ${state.pricing.effectiveFrom}.`);
  if (state.pricing.issuedBy) parts.push(state.pricing.issuedBy);
  if (state.pricing.updated) parts.push(`Posledná aktualizácia: ${state.pricing.updated}.`);
  foot.innerHTML = parts.join(" · ");
}

load().catch(err => {
  document.body.insertAdjacentHTML("afterbegin",
    `<pre style="color:#f43f5e;padding:16px">Chyba: ${err.message}</pre>`);
});
