const DAYS = [
  { key: "mon", label: "Po" },
  { key: "tue", label: "Ut" },
  { key: "wed", label: "St" },
  { key: "thu", label: "Št" },
  { key: "fri", label: "Pi" },
  { key: "sat", label: "So" },
  { key: "sun", label: "Ne" },
];
const DAY_LONG = {
  mon: "Pondelok", tue: "Utorok", wed: "Streda", thu: "Štvrtok",
  fri: "Piatok", sat: "Sobota", sun: "Nedeľa",
};

const toMin = (hhmm) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};
const fmt = (min) => {
  const h = String(Math.floor(min / 60)).padStart(2, "0");
  const m = String(min % 60).padStart(2, "0");
  return `${h}:${m}`;
};
const jsDayToKey = (d) => ["sun","mon","tue","wed","thu","fri","sat"][d];

let data = null;
let selectedDay = null;

async function load() {
  const res = await fetch("schedule.json", { cache: "no-store" });
  data = await res.json();
  selectedDay = jsDayToKey(new Date().getDay());
  document.getElementById("updated").textContent =
    data.updated ? `Posledná aktualizácia: ${data.updated}.` : "";
  renderDayPicker();
  render();
  setInterval(render, 30_000);
}

function renderDayPicker() {
  const todayKey = jsDayToKey(new Date().getDay());
  const nav = document.getElementById("days");
  nav.innerHTML = "";
  for (const d of DAYS) {
    const btn = document.createElement("button");
    btn.textContent = d.label;
    if (d.key === todayKey) btn.classList.add("today");
    if (d.key === selectedDay) btn.classList.add("active");
    btn.addEventListener("click", () => {
      selectedDay = d.key;
      renderDayPicker();
      render();
    });
    nav.appendChild(btn);
  }
}

function cellStatus(dayKey, lane, slotStart, slotEnd) {
  const hours = data.hours[dayKey];
  const openMin = toMin(hours.open);
  const closeMin = toMin(hours.close);
  if (slotEnd <= openMin || slotStart >= closeMin) return { status: "closed" };

  const entries = data.schedule[dayKey] || [];
  for (const e of entries) {
    if (!e.lanes.includes(lane)) continue;
    const s = toMin(e.start);
    const en = toMin(e.end);
    if (slotStart >= s && slotEnd <= en) {
      return { status: e.status, label: e.label };
    }
  }
  return { status: "closed" };
}

function render() {
  const now = new Date();
  document.getElementById("now").textContent =
    now.toLocaleString("sk-SK", { weekday: "short", hour: "2-digit", minute: "2-digit" });

  const dayKey = selectedDay;
  document.getElementById("day-title").textContent = DAY_LONG[dayKey];
  const h = data.hours[dayKey];
  document.getElementById("hours").textContent =
    h ? `Otváracie hodiny: ${h.open}–${h.close}` : "Zatvorené";

  const slot = data.slotMinutes || 30;
  const startMin = toMin(data.dayStart || "06:00");
  const endMin = toMin(data.dayEnd || "22:00");
  const cols = Math.ceil((endMin - startMin) / slot);
  const lanes = data.lanes;

  const grid = document.getElementById("grid");
  grid.style.gridTemplateColumns = `70px repeat(${cols}, minmax(28px, 1fr))`;
  grid.innerHTML = "";

  const corner = document.createElement("div");
  corner.className = "cell header rowhead";
  corner.textContent = "dráha \\ čas";
  grid.appendChild(corner);
  for (let c = 0; c < cols; c++) {
    const t = startMin + c * slot;
    const el = document.createElement("div");
    el.className = "cell header";
    el.textContent = t % 60 === 0 ? fmt(t) : "";
    grid.appendChild(el);
  }

  const todayKey = jsDayToKey(now.getDay());
  const nowMin = now.getHours() * 60 + now.getMinutes();

  for (let lane = 1; lane <= lanes; lane++) {
    const head = document.createElement("div");
    head.className = "cell rowhead";
    head.textContent = `${lane}`;
    grid.appendChild(head);
    for (let c = 0; c < cols; c++) {
      const s = startMin + c * slot;
      const e = s + slot;
      const { status, label } = cellStatus(dayKey, lane, s, e);
      const el = document.createElement("div");
      el.className = `cell ${status}`;
      el.title = `${fmt(s)}–${fmt(e)} · dráha ${lane} · ${label || status}`;
      if (dayKey === todayKey && nowMin >= s && nowMin < e) {
        el.classList.add("now");
      }
      grid.appendChild(el);
    }
  }

  renderSummary(dayKey, todayKey, nowMin);
}

function renderSummary(dayKey, todayKey, nowMin) {
  const box = document.getElementById("summary");
  const pill = document.getElementById("status-pill");
  const isToday = dayKey === todayKey;

  let publicLanes = 0, reservedLanes = 0;
  if (isToday) {
    for (let lane = 1; lane <= data.lanes; lane++) {
      const { status } = cellStatus(dayKey, lane, nowMin, nowMin + 1);
      if (status === "public") publicLanes++;
      else if (status === "reserved") reservedLanes++;
    }
    pill.textContent = publicLanes > 0 ? "Otvorené pre verejnosť" : "Mimo verejnej prevádzky";
    pill.className = "pill " + (publicLanes > 0 ? "open" : (reservedLanes > 0 ? "reserved" : ""));
    box.innerHTML = `
      <h3>Práve teraz</h3>
      <div class="big">${publicLanes} / ${data.lanes}</div>
      <div class="muted">dráh voľných pre verejnosť · ${reservedLanes} rezervovaných</div>
    `;
  } else {
    pill.textContent = "";
    pill.className = "pill";
    const nextPublic = findNextPublicBlock(dayKey);
    box.innerHTML = nextPublic
      ? `<h3>${DAY_LONG[dayKey]}</h3><div class="muted">Prvý verejný blok: <strong>${nextPublic.start}–${nextPublic.end}</strong> (${nextPublic.lanes} dráh)</div>`
      : `<h3>${DAY_LONG[dayKey]}</h3><div class="muted">Žiadny verejný blok.</div>`;
  }
}

function findNextPublicBlock(dayKey) {
  const entries = (data.schedule[dayKey] || []).filter(e => e.status === "public");
  if (!entries.length) return null;
  entries.sort((a, b) => toMin(a.start) - toMin(b.start));
  const first = entries[0];
  return { start: first.start, end: first.end, lanes: first.lanes.length };
}

load().catch(err => {
  document.body.insertAdjacentHTML("afterbegin",
    `<pre style="color:#f43f5e;padding:16px">Chyba: ${err.message}</pre>`);
});
