# TODO

Otvorené nápady na ďalšie iterácie a archív dokončených položiek. Nič z toho
nie je blokujúce, slúži to len ako pracovný zoznam toho, čo dáva zmysel, ak sa
projekt bude rozvíjať.

## Otvorené

- [ ] **Ďalšie STARZ bazény** — Rosnička, Delfín, Tehelné pole; rovnaký
      formát `schedule*.json`, len s iným pool-tabom.
- [ ] **Odporúčač najlepšieho času** — využiť `trend.json` a ponúknuť
      „najtichšie okno tento týždeň" pre zadanú dĺžku + min. dráhy.
      Prirodzené rozšírenie vyhľadávača a trendu, všetky dáta už existujú.
- [ ] **Neistota v trende** — priemer v trende skrýva rozptyl. Zobraziť
      min/max whiskers alebo druhú farebnú dimenziu, aby užívateľ videl,
      ktoré sloty sú premenlivé.
- [ ] **Trend citlivý na sviatky** — sviatky momentálne ťahajú dole
      priemer daného dňa týždňa. `pricing.json.holidays` je už dostupné,
      stačí ich odfiltrovať v `scripts/compute_trend.py`.
- [ ] **Odber kalendára (`subscribe.ics`)** — denne generovaný ICS feed
      so všetkými verejnými blokmi na 14 dní; jedno-klikové „Pridať do
      Google kalendára" miesto per-blok ICS.
- [ ] **Rozdeliť `app.js`** — ~1700 riadkov; ES moduly (render / data /
      watcher / i18n) by zlepšili orientáciu. (Interné — bez dopadu na UX.)

## Hotové — používateľské funkcie

Tieto položky sú pokryté aj v sekcii **Funkcie** hlavného README.

- [x] **PWA** — `manifest.json` + service worker, aby sa dala stránka
      „pridať na plochu" a fungovala offline s poslednými staženými dátami.
      Nazvaná **STARZ Pools**, ikony v `icons/`, `sw.js` s cache-first
      stratégiou pre statické assety a network-first pre JSON.
- [x] **Obľúbené sloty** — uložené do `localStorage`, s indikátorom pri
      riadku v heatmape a v karte „Dnes". ★ tlačidlo pri každom bloku
      v karte „Dnes" prepína (pool + weekday + start/end min) favoritu
      v `localStorage` (`starz-favorites`). V heatmape dostane každý riadok,
      ktorý má aspoň jeden favorit pre daný deň týždňa, žltú hviezdu
      v headeri; bunky v časovom rozsahu favoritu majú žltý bod v rohu.
      Favority sú per-bazén.
- [x] **Export do kalendára** — tlačidlo „Pridať do kalendára" pri
      každom bloku/výsledku vyhľadávača (`.ics` link). Ikonka 📅 v karte
      „Dnes" a pri každom výsledku vyhľadávača stiahne `.ics` súbor s UID,
      DTSTART/DTEND v UTC a popisom slotu.
- [x] **Upozornenia** — opt-in web push, keď sa uvoľní vopred zvolený slot
      (napr. „utorok 18:00, aspoň 3 dráhy"). Sekcia „Sledovať voľný slot":
      deň/čas/dráhy/dĺžka, watche sa ukladajú do `localStorage`,
      `schedule.json` sa re-fetchne každých 5 min a pri novej zhode sa
      pošle lokálna Notifikácia. Pravý „server push" nie je možný bez
      back-endu, takže upozornenia chodia, kým je stránka otvorená.
- [x] **Anglická verzia** — jazykový prepínač (sk/en), texty vytiahnuté
      do `i18n.json`. Prepínač je v pravom hornom rohu, jazyk sa ukladá
      do `localStorage` (`starz-lang`) a rešpektuje `?lang=en` v URL.
      Všetok statický text v `index.html` má `data-i18n*` atribúty,
      dynamické texty v `app.js` idú cez `t(key, vars)`.
- [x] **Trend obsadenosti** — tab/panel s priemerom voľných dráh po
      hodinách/dňoch za posledných N týždňov. Archiv snapshotov je v git
      histórii; `scripts/compute_trend.py` walkuje posledných 8 týždňov
      commitov `schedule*.json`, pre každý dátum vezme najnovší známy stav,
      a agreguje priemery per (bazén, deň-v-týždni, 15-min slot) do
      `trend.json`. Workflow `update-data.yml` ho prepočítava denne.
      V UI je záložka **Trend** s 7×76 heatmapou priemernej voľnosti.
- [x] **Robustnosť scrapera** — ak sa zmení štruktúra zdrojového
      XLSX/HTML, dashboard zobrazí banner „dáta môžu byť neaktuálne".
      `renderScheduleStaleBanner` skontroluje `schedule.updated` aktívneho
      bazéna; ak je staršie ako 3 dni alebo dáta úplne chýbajú, zobrazí sa
      červený pruh nad obsahom s odkazom na zdrojovú stránku. Pokrýva pád
      scrapera aj zmenu štruktúry XLSX.
- [x] **Zachovať posledné známe dáta pri stale** — namiesto „bez dát"
      ponechať vykreslenie heatmapy/karty a zobraziť len banner navrchu.
      Každý úspešný `fetchJSON` zapíše JSON do `localStorage` pod kľúč
      `starz-cache:<path>`; pri zlyhaní fetch-u `fetchJSONWithCache` načíta
      poslednú známu verziu. Vrství sa čisto nad existujúci service worker,
      ktorý už robí network-first pre JSON.
- [x] **OG image pre zdieľanie** — dnešná share karta pred-renderovaná
      ako PNG cez GitHub Action pre náhľad na Slacku/Messengeri.
      `scripts/generate_og.py` (Pillow) renderuje 1200×630 PNG
      z `schedule-50m.json`: značka, dnešný dátum, verejné bloky dňa
      farebne kódované podľa pomeru voľných dráh, footer s URL a dátumom
      aktualizácie. Workflow `update-data.yml` ho denne prepočíta a
      commitne `og.png`. `index.html` má `og:title/description/url/image`
      a `twitter:card=summary_large_image`.
- [x] **A11y audit** — ARIA role pre heatmap-cells, klávesová navigácia
      po bunkách, kontrast tmavých farieb v Semafore. Grid má `role="grid"`
      + `aria-rowcount`/`aria-colcount`, bunky `gridcell` s `aria-label`,
      roving-tabindex ovládané šípkami + Home/End/Enter, fokus-ring,
      v Semafore svetlejšia lane-1 (#ef4444) a lane-4 (#22c55e).
- [x] **Zdieľanie odkazu** — URL s parametrami `?date=…&from=…&lanes=…`,
      ktorá otvorí dashboard s predvyplneným vyhľadávačom. Vyhľadávač sa
      synchronizuje s URL cez `pool`, `date`, `from`, `lanes`, `len`,
      `today`; tlačidlo „Skopírovať odkaz" vloží aktuálny URL do schránky.
- [x] **Print/share karta** — „dnešný plán" ako jedna obrazovka
      optimalizovaná na screenshot do chatu. V karte „Dnes" tlačidlo
      📸 Zdieľať otvorí modal s kompaktným screenshot-friendly prehľadom
      všetkých dnešných verejných blokov (časy, voľné dráhy, dĺžka,
      live/past tag). Modal má „Tlačiť / Uložiť PDF" cez `window.print()`
      s dedikovaným `@media print` štýlom.

## Hotové — interná infraštruktúra

Veci, ktoré používateľ priamo nevidí, ale chránia projekt pred regresiou
alebo zjednodušujú prevádzku.

- [x] **Golden-file test scrapera** — CI test, ktorý padne pri zmene
      štruktúry XLSX, chytí problém skôr než sa dáta zastarajú.
      `tests/test_update_data.py` generuje synthetic XLSX cez `openpyxl`,
      pretláča ich cez `transform_xlsx()` a kontroluje, že (a) výstupný
      JSON má stabilný tvar a (b) zmena štruktúry (premenovaný label
      „Počet voľných dráh", chýbajúci counter row, skrátený workbook)
      padne s čitateľnou `RuntimeError`. Beží v
      `.github/workflows/tests.yml`.
- [x] **Testy čistých funkcií** — `collapseBlocks`, `levelFor`,
      `bandForMinOnDate`, `scheduleAgeDays` sú čisté a triviálne pokryť.
      Odomkne bezpečný refactor. Čisté helpery (`pad`, `toMin`, `fmt`,
      `todayISO`, `collapseBlocks`, `levelFor`, `scheduleAgeDays`,
      `icsEscape`, `icsUTCStamp`) sú v `lib/helpers.js` ako dual-module
      (IIFE s `module.exports` alebo `window`), `tests/helpers.test.mjs`
      pokrýva 14 prípadov cez node's vstavaný `node --test`. Beží v
      `.github/workflows/tests.yml`.
- [x] **Automatické mazanie stale Pages environment branches** — keď
      workflow deploynutia spadne, aktuálne treba manuálne upratať
      deployment-branch rule. Workflow
      `.github/workflows/cleanup-pages-branches.yml` beží týždenne +
      po každom neúspešnom Pages deploy a maže deployment-branch policies,
      ktorým už nezodpovedá žiadna vetva. Mazanie vyžaduje token s
      „Administration: write"; nastav ho ako `PAGES_ADMIN_TOKEN`, inak
      workflow len upozorní varovaním.
