import { state, WATCH_KEY, NOTIFIED_KEY, FAV_KEY, NOTIFIED_TTL_MS } from "./state.js";
import { t, lanesWord, weekdayLabel, weekdayShort } from "./i18n.js";

const { toMin, fmt, todayISO } = window;

let renderHook = null;
export function setRenderHook(fn) { renderHook = fn; }

function loadWatches() {
  try {
    const raw = localStorage.getItem(WATCH_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch { return []; }
}
function saveWatches() {
  try { localStorage.setItem(WATCH_KEY, JSON.stringify(state.watches)); } catch {}
}
function loadNotified() {
  try {
    const raw = localStorage.getItem(NOTIFIED_KEY);
    const obj = raw ? JSON.parse(raw) : {};
    return obj && typeof obj === "object" ? obj : {};
  } catch { return {}; }
}
function saveNotified() {
  try { localStorage.setItem(NOTIFIED_KEY, JSON.stringify(state.notified)); } catch {}
}

export function setupWatcher() {
  state.watches = loadWatches();
  state.notified = loadNotified();
  pruneNotified();
  const addBtn = document.getElementById("watch-add");
  if (addBtn) addBtn.addEventListener("click", addWatch);
  renderWatcherNote();
}

function pruneNotified() {
  const now = Date.now();
  let changed = false;
  for (const k of Object.keys(state.notified)) {
    if (now - state.notified[k] > NOTIFIED_TTL_MS) {
      delete state.notified[k];
      changed = true;
    }
  }
  if (changed) saveNotified();
}

function addWatch() {
  const weekday = document.getElementById("watch-day").value;
  const fromTime = document.getElementById("watch-from").value || "00:00";
  const minLanes = Number(document.getElementById("watch-lanes").value);
  const duration = Number(document.getElementById("watch-len").value);
  if (!/^\d{2}:\d{2}$/.test(fromTime)) return;
  const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  state.watches.push({ id, pool: state.pool, weekday, fromTime, minLanes, duration });
  saveWatches();
  requestNotifyPermission();
  renderWatcher();
}

function removeWatch(id) {
  state.watches = state.watches.filter(w => w.id !== id);
  saveWatches();
  renderWatcher();
}

function requestNotifyPermission() {
  if (!("Notification" in window)) return;
  if (Notification.permission === "default") {
    Notification.requestPermission().then(() => renderWatcherNote()).catch(() => {});
  }
}

export function renderWatcherNote() {
  const el = document.getElementById("watcher-note");
  if (!el) return;
  if (!("Notification" in window)) {
    el.textContent = t("watcher.unsupported");
    el.className = "watcher-note warn";
    return;
  }
  if (Notification.permission === "granted") {
    el.textContent = t("watcher.granted");
    el.className = "watcher-note ok";
  } else if (Notification.permission === "denied") {
    el.textContent = t("watcher.denied");
    el.className = "watcher-note warn";
  } else {
    el.textContent = t("watcher.default");
    el.className = "watcher-note";
  }
}

function findMatchForWatch(watch) {
  const data = state.data[watch.pool];
  if (!data || !data.days || !data.days.length) return null;
  const slot = data.slotMinutes;
  const startMin = toMin(data.dayStart);
  const fromMin = toMin(watch.fromTime);
  const need = Math.ceil(watch.duration / slot);
  const todayIso = todayISO();
  const nowMin = new Date().getHours() * 60 + new Date().getMinutes();
  for (const day of data.days) {
    if (day.date < todayIso) continue;
    if (watch.weekday !== "any" && day.weekday !== watch.weekday) continue;
    const isToday = day.date === todayIso;
    for (let i = 0; i + need <= day.free.length; i++) {
      const blockStart = startMin + i * slot;
      if (blockStart < fromMin) continue;
      if (isToday && blockStart < nowMin) continue;
      let ok = true, minL = Infinity;
      for (let k = 0; k < need; k++) {
        const v = day.free[i + k];
        if (v < watch.minLanes) { ok = false; break; }
        if (v < minL) minL = v;
      }
      if (ok) {
        return {
          date: day.date,
          weekday: day.weekday,
          startMin: blockStart,
          endMin: blockStart + need * slot,
          lanes: minL,
        };
      }
    }
  }
  return null;
}

function notifyMatch(watch, match) {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  const [, m, d] = match.date.split("-");
  const dayLabel = weekdayShort(match.weekday);
  const title = t("watcher.notify_title", {
    time: fmt(match.startMin), lanes: match.lanes, lanesWord: lanesWord(match.lanes),
  });
  const body = t("watcher.notify_body", {
    weekday: dayLabel, date: `${d}.${m}.`, pool: watch.pool,
    from: fmt(match.startMin), to: fmt(match.endMin),
  });
  try {
    new Notification(title, {
      body,
      icon: "icons/icon-192.png",
      tag: `starz-watch-${watch.id}-${match.date}-${match.startMin}`,
    });
  } catch {}
}

export function renderWatcher() {
  renderWatcherNote();
  const ul = document.getElementById("watch-list");
  if (!ul) return;
  if (!state.watches.length) {
    ul.innerHTML = "";
    return;
  }
  let notifiedChanged = false;
  const items = state.watches.map(w => {
    const match = findMatchForWatch(w);
    if (match) {
      const key = `${w.id}:${match.date}:${match.startMin}`;
      if (!state.notified[key]) {
        state.notified[key] = Date.now();
        notifiedChanged = true;
        notifyMatch(w, match);
      }
    }
    const dayLabel = w.weekday === "any" ? t("watcher.any_day") : weekdayLabel(w.weekday);
    const statusHTML = match
      ? `<span class="watch-status match">🔔 ${weekdayShort(match.weekday)} ${match.date.slice(8,10)}.${match.date.slice(5,7)}. · ${fmt(match.startMin)} · ${match.lanes} ${lanesWord(match.lanes)}</span>`
      : `<span class="watch-status">${t("watcher.pending")}</span>`;
    return `<li data-id="${w.id}">
      <span class="watch-crit">${w.pool} · ${dayLabel} · ${t("watcher.from").toLowerCase()} ${w.fromTime} · ${w.minLanes}+ ${lanesWord(w.minLanes)} · ${w.duration} min</span>
      ${statusHTML}
      <button type="button" class="watch-remove" aria-label="${t("watcher.remove_aria")}" title="${t("watcher.remove_tip")}">×</button>
    </li>`;
  });
  ul.innerHTML = items.join("");
  ul.querySelectorAll(".watch-remove").forEach(btn => {
    btn.addEventListener("click", e => {
      const li = e.target.closest("li");
      if (li?.dataset.id) removeWatch(li.dataset.id);
    });
  });
  if (notifiedChanged) saveNotified();
}

function loadFavorites() {
  try {
    const raw = localStorage.getItem(FAV_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch { return []; }
}
function saveFavorites() {
  try { localStorage.setItem(FAV_KEY, JSON.stringify(state.favorites)); } catch {}
}
export function setupFavorites() { state.favorites = loadFavorites(); }

export function findFavoriteForBlock(pool, weekday, startMin, endMin) {
  return state.favorites.find(f =>
    f.pool === pool && f.weekday === weekday &&
    f.startMin === startMin && f.endMin === endMin
  );
}

export function cellFavoritedFor(pool, weekday, minOfDay) {
  return state.favorites.some(f =>
    f.pool === pool && f.weekday === weekday &&
    minOfDay >= f.startMin && minOfDay < f.endMin
  );
}

export function rowHasFavorite(pool, weekday) {
  return state.favorites.some(f => f.pool === pool && f.weekday === weekday);
}

export function toggleFavoriteBlock(pool, weekday, startMin, endMin) {
  const existing = findFavoriteForBlock(pool, weekday, startMin, endMin);
  if (existing) {
    state.favorites = state.favorites.filter(f => f.id !== existing.id);
  } else {
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    state.favorites.push({ id, pool, weekday, startMin, endMin });
  }
  saveFavorites();
  if (renderHook) renderHook();
}
