import { fetchJSON } from "./state.js";

const WEEKDAY_SHORT_SK = {
  pondelok: "Po", utorok: "Ut", streda: "St", "štvrtok": "Št",
  piatok: "Pi", sobota: "So", "nedeľa": "Ne",
};
const LANG_KEY = "starz-lang";
const I18N = { sk: {}, en: {} };
let CURRENT_LANG = "sk";

export async function loadI18n() {
  try {
    const data = await fetchJSON("i18n.json");
    if (data && typeof data === "object") {
      if (data.sk) I18N.sk = data.sk;
      if (data.en) I18N.en = data.en;
    }
  } catch {}
}

export function initLang() {
  const urlLang = new URLSearchParams(location.search).get("lang");
  let saved = null;
  try { saved = localStorage.getItem(LANG_KEY); } catch {}
  CURRENT_LANG = (urlLang === "sk" || urlLang === "en") ? urlLang
    : (saved === "sk" || saved === "en") ? saved
    : "sk";
  document.documentElement.setAttribute("lang", CURRENT_LANG);
}

export function getLang() { return CURRENT_LANG; }

export function setLang(lang) {
  if (lang !== "sk" && lang !== "en") return;
  CURRENT_LANG = lang;
  try { localStorage.setItem(LANG_KEY, lang); } catch {}
  const params = new URLSearchParams(location.search);
  if (lang === "en") params.set("lang", "en"); else params.delete("lang");
  const qs = params.toString();
  history.replaceState(null, "", location.pathname + (qs ? "?" + qs : "") + location.hash);
}

export function t(key, vars) {
  const map = I18N[CURRENT_LANG] || I18N.sk || {};
  let s = map[key];
  if (s == null) s = I18N.sk?.[key] ?? key;
  if (vars) {
    s = s.replace(/\{(\w+)\}/g, (m, k) => (vars[k] != null ? String(vars[k]) : m));
  }
  return s;
}

export function weekdayLabel(w) { return t("weekday." + w) || w; }
export function weekdayShort(w) { return t("weekday.short." + w) || WEEKDAY_SHORT_SK[w] || w; }

export const lanesWord = (n) => {
  if (CURRENT_LANG === "en") return n === 1 ? "lane" : "lanes";
  return (n === 1 ? "dráha" : n >= 2 && n <= 4 ? "dráhy" : "dráh");
};

export function applyStaticI18n() {
  document.querySelectorAll("[data-i18n]").forEach(el => {
    el.textContent = t(el.getAttribute("data-i18n"));
  });
  document.querySelectorAll("[data-i18n-title]").forEach(el => {
    el.title = t(el.getAttribute("data-i18n-title"));
  });
  document.querySelectorAll("[data-i18n-aria]").forEach(el => {
    el.setAttribute("aria-label", t(el.getAttribute("data-i18n-aria")));
  });
  document.title = t("app.title_full");
  document.documentElement.setAttribute("lang", CURRENT_LANG);
}
