const WEEKDAY_SHORT = {
  pondelok: "Po", utorok: "Ut", streda: "St", "štvrtok": "Št",
  piatok: "Pi", sobota: "So", "nedeľa": "Ne",
};

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
const todayISO = (d = new Date()) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

let data = null;

async function load() {
  const res = await fetch("schedule.json", { cache: "no-store" });
  data = await res.json();
  document.getElementById("updated").textContent =
    data.updated ? `Posledná aktualizácia: ${data.updated}.` : "";
  render();
  setInterval(render, 30_000);
}

function slotIndexForNow() {
  const now = new Date();
  const min = now.getHours() * 60 + now.getMinutes();
  const start = toMin(data.dayStart);
  if (min < start) return -1;
  const idx = Math.floor((min - start) / data.slotMinutes);
  const cols = Math.ceil((toMin(data.dayEnd) - start) / data.slotMinutes);
  return idx >= cols ? cols : idx;
}

function findDay(iso) {
  return data.days.find(d => d.date === iso);
}

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
  const now = new Date();
  document.getElementById("now").textContent =
    now.toLocaleString("sk-SK", {
      weekday: "short", day: "2-digit", month: "2-digit",
      hour: "2-digit", minute: "2-digit",
    });

  renderNow(now);
  renderHeatmap(now);
  renderTodayBlocks(now);
}

function renderNow(now) {
  const iso = todayISO(now);
  const day = findDay(iso);
  const pill = document.getElementById("status-pill");
  const big = document.getElementById("now-big");
  const sub = document.getElementById("now-sub");
  const next = document.getElementById("now-next");

  if (!day) {
    pill.textContent = "Mimo rozvrhu";
    pill.className = "pill";
    big.textContent = "—";
    sub.textContent = "Pre tento dátum nie je v rozvrhu záznam.";
    next.textContent = "";
    return;
  }

  const idx = slotIndexForNow();
  const startMin = toMin(data.dayStart);
  const slot = data.slotMinutes;
  const currentFree = (idx >= 0 && idx < day.free.length) ? day.free[idx] : 0;

  big.textContent = `${currentFree} / ${data.maxLanes}`;
  if (currentFree > 0) {
    pill.textContent = "Otvorené pre verejnosť";
    pill.className = "pill open";
    const slotStart = startMin + idx * slot;
    sub.textContent = `voľných dráh · blok ${fmt(slotStart)}–${fmt(slotStart + slot)}`;
  } else {
    pill.textContent = "Mimo verejnej prevádzky";
    pill.className = "pill closed";
    sub.textContent = "žiadne dráhy pre verejnosť";
  }

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
    next.textContent = `Blok končí o ${fmt(endMin)}.`;
  } else if (nextIdx >= 0) {
    const t = startMin + nextIdx * slot;
    const mins = t - (now.getHours() * 60 + now.getMinutes());
    next.textContent = `Najbližší verejný blok: ${fmt(t)} (${day.free[nextIdx]} dráhy) · o ${mins} min.`;
  } else {
    next.textContent = "Dnes už nie je ďalší verejný blok.";
  }
}

function renderHeatmap(now) {
  const slot = data.slotMinutes;
  const startMin = toMin(data.dayStart);
  const endMin = toMin(data.dayEnd);
  const cols = Math.ceil((endMin - startMin) / slot);
  const todayIso = todayISO(now);
  const nowIdx = slotIndexForNow();

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
    const [y, m, d] = day.date.split("-");
    head.innerHTML = `<span class="dow">${WEEKDAY_SHORT[day.weekday] || day.weekday}</span> <span class="date">${d}.${m}.</span>`;
    grid.appendChild(head);

    for (let c = 0; c < cols; c++) {
      const v = day.free[c] ?? 0;
      const el = document.createElement("div");
      el.className = `cell lane-${v}`;
      if (isToday && c === nowIdx) el.classList.add("now");
      const s = startMin + c * slot;
      el.title = `${day.weekday} ${d}.${m}. · ${fmt(s)}–${fmt(s + slot)} · ${v === 0 ? "—" : v + " dráh"}`;
      grid.appendChild(el);
    }
  }
}

function renderTodayBlocks(now) {
  const iso = todayISO(now);
  const day = findDay(iso);
  const box = document.getElementById("today-blocks");
  if (!day) { box.innerHTML = ""; return; }
  const blocks = collapseBlocks(day.free, data.slotMinutes, toMin(data.dayStart));
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const [y, m, d] = day.date.split("-");
  if (!blocks.length) {
    box.innerHTML = `<h3>Dnes (${d}.${m}.)</h3><div class="muted">Žiadne verejné bloky.</div>`;
    return;
  }
  box.innerHTML = `
    <h3>Dnes · ${day.weekday} ${d}.${m}.</h3>
    <ul class="blocks">
      ${blocks.map(b => {
        const past = b.endMin <= nowMin;
        const live = nowMin >= b.startMin && nowMin < b.endMin;
        return `<li class="${past ? "past" : live ? "live" : ""}">
          <span class="time">${fmt(b.startMin)}–${fmt(b.endMin)}</span>
          <span class="lanes">${b.lanes} ${b.lanes === 1 ? "dráha" : "dráhy"}</span>
          ${live ? '<span class="tag">prebieha</span>' : past ? '<span class="tag past">skončilo</span>' : ''}
        </li>`;
      }).join("")}
    </ul>
  `;
}

load().catch(err => {
  document.body.insertAdjacentHTML("afterbegin",
    `<pre style="color:#f43f5e;padding:16px">Chyba: ${err.message}</pre>`);
});
