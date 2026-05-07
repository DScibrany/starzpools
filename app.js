import {
  state, POOL_FILE, SCHEDULE_REFRESH_MS,
  fetchJSON, fetchJSONWithCache, activeMaxLanes,
} from "./lib/state.js";
import {
  loadI18n, initLang, applyStaticI18n, setLang, getLang, t,
} from "./lib/i18n.js";
import {
  renderPricingStaleBanner, renderPricing,
  setupCalculator, renderCalculator,
} from "./lib/pricing.js";
import {
  setupWatcher, renderWatcher, setupFavorites, setRenderHook,
} from "./lib/watcher.js";
import {
  render, applyPoolFromURL, applyFinderFromURL, applySlotFromURL,
  setupViews, setupTabs, setupTheme, setupFinder, setupShareModal, setupSlotModal,
  setupGridKeyboard, setupGridPopup, resolveMainCellSlot, resolveTrendCellSlot,
  setupLinks, populateLaneOptions, refreshLaneOptions, populateWeekdayOptions,
  renderTrend, setOnPoolChange, updateURLFromState,
} from "./lib/render.js";

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    const hadController = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.register("sw.js").catch(() => {});
    if (hadController) {
      let reloaded = false;
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        if (reloaded) return;
        reloaded = true;
        location.reload();
      });
    }
  });
}

setRenderHook(render);

setOnPoolChange(() => {
  setupLinks();
  state.finderHits = [];
  document.getElementById("finder-results").innerHTML = "";
  refreshLaneOptions();
  renderPricing();
  renderCalculator();
  render();
  if (state.view === "trend") renderTrend();
  updateURLFromState();
});

function setupLangToggle() {
  const sel = document.getElementById("lang-select");
  if (!sel) return;
  sel.value = getLang();
  sel.addEventListener("change", () => onLangChange(sel.value));
}

function onLangChange(lang) {
  setLang(lang);
  applyStaticI18n();
  setupLinks();
  populateLaneOptions(document.getElementById("finder-min"), activeMaxLanes(), 1);
  populateLaneOptions(document.getElementById("watch-lanes"), activeMaxLanes(), Math.min(3, activeMaxLanes()));
  populateWeekdayOptions();
  renderPricingStaleBanner();
  renderPricing();
  renderCalculator();
  render();
  if (state.view === "trend") renderTrend();
}

async function refreshSchedule() {
  const [d25, d50] = await Promise.all([
    fetchJSON(POOL_FILE["25m"]).catch(() => null),
    fetchJSON(POOL_FILE["50m"]).catch(() => null),
  ]);
  if (d25) state.data["25m"] = d25;
  if (d50) state.data["50m"] = d50;
  render();
}

async function load() {
  await loadI18n();
  initLang();
  const [d25, d50, pricing, trend] = await Promise.all([
    fetchJSONWithCache(POOL_FILE["25m"]),
    fetchJSONWithCache(POOL_FILE["50m"]),
    fetchJSONWithCache("pricing.json"),
    fetchJSONWithCache("trend.json"),
  ]);
  state.data["25m"] = d25;
  state.data["50m"] = d50;
  state.pricing = pricing;
  state.trend = trend;

  applyStaticI18n();
  setupLangToggle();
  applyPoolFromURL();
  setupViews();
  setupTabs();
  setupTheme();
  setupFinder();
  setupWatcher();
  setupFavorites();
  populateWeekdayOptions();
  refreshLaneOptions();
  setupLinks();
  setupGridPopup(".grid-wrap", "grid", resolveMainCellSlot);
  setupGridKeyboard("grid");
  setupGridPopup(".trend-wrap", "trend-grid", resolveTrendCellSlot);
  setupGridKeyboard("trend-grid");
  setupShareModal();
  setupSlotModal();
  setupCalculator();
  renderPricingStaleBanner();
  renderPricing();
  renderCalculator();
  render();
  applyFinderFromURL();
  applySlotFromURL();
  setInterval(render, 30_000);
  setInterval(refreshSchedule, SCHEDULE_REFRESH_MS);
}

load().catch(err => {
  document.body.insertAdjacentHTML("afterbegin",
    `<pre style="color:#f43f5e;padding:16px">Chyba: ${err.message}</pre>`);
});
