export const POOL_PAGE = {
  "25m": "https://bratislava.sk/vzdelavanie-a-volny-cas/starz/prevadzky-sportoviska/mestska-plavaren-pasienky-25m",
  "50m": "https://bratislava.sk/vzdelavanie-a-volny-cas/starz/prevadzky-sportoviska/mestska-plavaren-pasienky-50m",
};
export const POOL_FILE = { "25m": "schedule.json", "50m": "schedule-50m.json" };
export const THEMES = ["viridis", "blues", "traffic", "diverging"];
export const WEEKDAYS = ["pondelok","utorok","streda","štvrtok","piatok","sobota","nedeľa"];
export const WATCH_KEY = "starz-watches";
export const NOTIFIED_KEY = "starz-notified";
export const FAV_KEY = "starz-favorites";
export const SCHEDULE_REFRESH_MS = 5 * 60 * 1000;
export const NOTIFIED_TTL_MS = 48 * 60 * 60 * 1000;

export const state = {
  pool: "50m",
  view: "dashboard",
  theme: "viridis",
  data: { "25m": null, "50m": null },
  pricing: null,
  trend: null,
  finderHits: [],
  watches: [],
  notified: {},
  favorites: [],
};

const CACHE_PREFIX = "starz-cache:";

export function saveCache(path, json) {
  try { localStorage.setItem(CACHE_PREFIX + path, JSON.stringify(json)); } catch {}
}

export function loadCache(path) {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + path);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export async function fetchJSON(path) {
  const res = await fetch(path, { cache: "no-store" });
  if (!res.ok) throw new Error(`${path}: ${res.status}`);
  const json = await res.json();
  saveCache(path, json);
  return json;
}

export async function fetchJSONWithCache(path) {
  try {
    return await fetchJSON(path);
  } catch {
    return loadCache(path);
  }
}

export function activeData() { return state.data[state.pool]; }

export function activeMaxLanes() {
  const n = activeData()?.maxLanes;
  return Number.isFinite(n) && n > 0 ? n : 4;
}
