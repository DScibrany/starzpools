# TODO

Otvorené nápady na ďalšie iterácie a archív dokončených položiek. Nič z toho
nie je blokujúce, slúži to len ako pracovný zoznam toho, čo dáva zmysel, ak sa
projekt bude rozvíjať.

## Otvorené

### Nové používateľské funkcie

- [ ] **Flexibilný watcher** — „ktorýkoľvek pracovný večer 18–20 s
      ≥2 dráhami ≥60 min" namiesto presného dňa+času. Súčasný watcher je
      príliš rigidný pre reálne plánovanie. Scan priestoru je malý
      (14 dní × 76 slotov), zostáva client-only.
- [ ] **Mesačný prehľad (1 bunka / deň)** — farebná mriežka nad rámec
      14 dní, ktorá na úrovni celého dňa ukáže „tichý / obsadený",
      s priemerom z `trend.json`. Pre rozhodnutia typu „oplatí sa mi
      permanentka tento mesiac?".
- [ ] **Ďalšie STARZ bazény** — Rosnička, Delfín, Tehelné pole; rovnaký
      formát `schedule*.json`, len s iným pool-tabom.
- [ ] **Odporúčač najlepšieho času** — využiť `trend.json` a ponúknuť
      „najtichšie okno tento týždeň" pre zadanú dĺžku + min. dráhy.
      Prirodzené rozšírenie vyhľadávača a trendu, všetky dáta už existujú.
- [ ] **Neistota v trende** — priemer v trende skrýva rozptyl. Zobraziť
      min/max whiskers alebo druhú farebnú dimenziu, aby užívateľ videl,
      ktoré sloty sú premenlivé.
- [ ] **Odber kalendára (`subscribe.ics`)** — denne generovaný ICS feed
      so všetkými verejnými blokmi na 14 dní; jedno-klikové „Pridať do
      Google kalendára" miesto per-blok ICS.
- [ ] **Check-in / check-out do bazéna** — dobrovoľný opt-in flow, kde
      pri príchode používateľ klikne „som tu (25 m / 50 m)" a pri odchode
      „odišiel som". Agregácia dáva novú dimenziu: reálna obsadenosť
      budovy (šatne, sprchy, ľudia v bazéne), nielen dráhy z oficiálneho
      STARZ feedu. V UI by sa zobrazil chip typu „~N plavcov je tu teraz"
      v karte „Práve teraz" a druhá farebná dimenzia v trende.
      Overenie proti fake check-inom „z gauča" kombinuje dva faktory:
      - **(a) Geolokácia** — `navigator.geolocation` musí vrátiť polohu
        v polomere ~100 m od bazéna. Dá sa spoofovať cez devtools,
        ale odfiltruje náhodné zlo a je zadarmo.
      - **(b) Rotujúci QR na plavárni** — displej pri vstupe renderuje
        QR obmieňaný napr. každých 60 s, kódujúci
        `{ pool, issued_at, HMAC(server_secret, pool || issued_at) }`.
        Backend overí HMAC s držaným `secret`-om, akceptuje len čerstvé
        tokeny (±5 min) a cachuje už použité HMACy (replay-protection).

      Ideálne vyžadovať oba faktory naraz (geo + QR), aby bola bariéra
      pre manipuláciu heatmapy aspoň primeraná. Tradeoffs:
      - **Vyžaduje backend** — counter, auth, rate-limit, auto check-out
        „zabudnutých" sessions po ~3 h. Rozbíja „static only" puritu
        (rovnaký tradeoff ako `Reálne Web Push`); raz postavený backend
        by sa dal zdieľať medzi týmito dvoma featurami.
      - **QR treba niekde vystaviť** — buď samostatný displej / tablet
        na plavárni (vyžaduje spoluprácu so STARZ), alebo tenký webpage,
        ktorý QR renderuje a prevádzka ho niekde premieta.
      - **Privacy** — žiadne user-identifikátory; iba anonymné eventy
        `{ pool, in|out, timestamp }`. Rate-limit per device-id uložený
        v `localStorage`.
      - **Value** — STARZ publikuje voľné dráhy, ale ticho alebo hluk
        v šatni a preplnenosť sprch dáta nezachytia. Tento mechanizmus
        dopĺňa úplne novú, inak nedostupnú dimenziu.
- [ ] **Reálne Web Push cez Cloudflare Worker** — notifikácie chodia aj
      keď je tab zatvorený. Súčasný in-tab watcher to nevie. Tradeoff:
      rozbíja „static only" puritu (VAPID + KV store pre subscriptions),
      ale z UX pohľadu je to najväčší skok z tohto zoznamu.

### Interné

## Hotové — používateľské funkcie

Tieto položky sú pokryté aj v sekcii **Funkcie** hlavného README.

- [x] **Kalkulačka ceny** — pridaný panel **Kalkulačka ceny** v záložke
      **Cenník**. Vstupy: typ vstupenky (štandard / zľavnené ŤZP-do-18),
      dĺžka (60 / 90 min), dátum a čas. Pool je viazaný na aktívny tab
      (50 m / 25 m). Výstup: cena v EUR, kód cenníkového riadku, badge
      pásma (peak / offpeak), badge sviatku, prípadné prechodné pásmo
      (jednotná cena 3,00 € na 25 m do `transitionalUntil`). Mimo predaja
      vstupeniek (napr. 3:00, 23:00) zobrazí chybu „skúste 6:00–22:00",
      lebo nová `bandFor` v `lib/pricing-calc.js` je striktnejšia ako
      pôvodná `bandForMinOnDate` v `app.js` (žiadny fallback na offpeak).
      Pre víkend / sviatok sú spojené ranges peak ∪ offpeak ošetrené ako
      offpeak (label v `pricing.json` to indikuje, hoci jeho `ranges`
      kryjú len pracovný deň). Logika je v čistom UMD module
      `lib/pricing-calc.js` (tabulkové parsy „4,00", „8 × 30,00 = 240,00",
      `formatEUR` v slovenskom formáte) a má 20 unit-testov v
      `tests/test_pricing_calc.mjs` — pokrývajú parse, band-detekciu pre
      pracovný deň / víkend / sviatok / mimo hodín, transitional override,
      missing-input chyby. UI v `lib/pricing.js`
      (`setupCalculator` / `renderCalculator`), HTML v `index.html`,
      i18n kľúče `calc.*` (sk + en), štýly `.pricing-calc *` v
      `styles.css`.
- [x] **Trend citlivý na sviatky** — `scripts/compute_trend.py` teraz
      načítava `pricing.json.holidays` cez `load_holidays()` a preskočí
      každý `(pool, iso)` zápis, kde `iso` je sviatok, takže sviatočné
      otváracie hodiny / nižšia návštevnosť neťahajú dole priemer daného
      dňa týždňa. Výstupný `trend.json` má nové pole `holidayDatesExcluded`
      (triedený zoznam) pre audit. Malformed / missing `pricing.json`
      graceful-fallback-uje na prázdnu množinu sviatkov, takže skript
      beží aj na čerstvom checkoute. Pokryté 4 unittestami
      (`tests/test_compute_trend.py`) — mock-ujú `git_commits` /
      `git_show_json` / `load_holidays` a overujú, že filter funguje
      aj keď je zoznam sviatkov prázdny, a že `load_holidays` je
      odolný voči I/O a JSON chybám.
- [x] **Chips pre sviatky v UI** — `isHoliday(iso)` helper už existoval
      (kontroluje `pricing.json.holidays`). Nový `.holiday-chip` CSS
      pattern (farebne odlíšený od band-chip a unusual-chip) sa zobrazí
      v karte „Práve teraz", karte „Dnes", v hlavičke slot detail modalu
      a v share karte, keď je dnešný / zobrazený deň sviatok. V heatmape
      dostane rowhead pre sviatočný deň subtílny fialový tint a ✦ mark
      vedľa prípadného ★ fav-marku. Cell `title` + `aria-label`
      (teda aj text v popupe) získajú sufix „· sviatok". Bez zmeny
      v dátach — `pricing.json.holidays` je momentálne prázdne, chipy
      sa zapnú automaticky, keď STARZ dáta pridá sviatky.
- [x] **Kliknutie na bunku heatmapy → detail modal** — každá bunka
      heatmapy `role="gridcell"` je teraz klikateľná a volá existujúci
      `openSlotModal(iso, startMin)`. `data-col` sa prevádza na `startMin`
      cez `toMin(data.dayStart) + col * data.slotMinutes`, takže modal
      dostane presne ten 15-min slot, na ktorý užívateľ klikol.
      Existujúca `setupGridKeyboard` klávesová navigácia už volá
      `cell.click()` pri Enter/Space, takže Enter na zvolenej bunke
      otvorí modal bez ďalších úprav. Pôvodný custom `#grid-tooltip`
      (touch-friendly tooltip) je nahradený modalom (natívny `title`
      atribút ostáva pre desktop hover); sprievodné `.cell.selected`
      štýly odstránené ako mŕtvy kód. `.cell[role='gridcell']` dostal
      `cursor: pointer` pre visual affordance.
- [x] **Deep-link na konkrétny slot** — `?slot=YYYY-MM-DDTHH:MM` otvorí
      modal s detailom bloku: dátum + deň + časový rozsah, aktuálny počet
      voľných dráh (plus farebná úroveň + bodky), priemer z `trend.json`
      pre daný (pool, weekday, slot) a delta vs dnes (zelený / červený
      chip pri |delta| ≥ 1.5). Modal má akcie „Pridať do kalendára"
      (volá existujúci `downloadICS`), „Pridať do obľúbených" (toggle cez
      `toggleFavoriteBlock`), „Skopírovať odkaz" (copy-to-clipboard
      s fallbackom na `window.prompt`) a „Zavrieť". V karte „Dnes" má
      každý nezmeškaný blok nové 🔗 tlačidlo, ktoré modal otvorí.
      Zatvorenie modalu vyčistí `?slot` z URL. Helpery `parseSlotParam`,
      `buildSlotURL`, `findBlockContaining`, `openSlotModal`,
      `closeSlotModal`, `setupSlotModal` v `app.js`; `.slot-card` štýly
      v `styles.css`; i18n kľúče `slot.*` + `today.slot_link_tip`.
- [x] **„Neobvykle ticho / obsadené" odznak** — v karte „Práve teraz" sa
      popri band-chip zobrazí `unusual-chip`, keď sa aktuálny počet voľných
      dráh líši od priemeru z `trend.json` pre daný (pool, weekday, slot)
      aspoň o 1.5 dráhy. Chip je zelený („nezvyčajne voľno · +N.N") alebo
      červený („nezvyčajne obsadené · −N.N"). Vyžaduje aspoň 2 vzorky
      v bucketi, inak sa neukazuje, takže fluke snapshot nerozbije UX.
      Logika v `renderNow` → `trendAvgFor` + `renderUnusualChip`; i18n
      kľúče `now.unusual.quiet` / `now.unusual.busy`.
- [x] **Sparkline v karte „Dnes"** — inline SVG polyline zo 76 hodnôt
      `day.free` tesne pod nadpisom karty „Dnes", so zvislou žltou čiarou
      v aktuálnom slote. `viewBox="0 0 100 100"` +
      `preserveAspectRatio="none"` + `vector-effect="non-scaling-stroke"`
      zabezpečujú čistý stretch cez celú šírku karty bez deformácie
      hrúbky čiary. Skrýva sa, ak `day.free` je prázdne alebo obsahuje
      samé 0. Helper `todaySparkHTML` v `app.js`, štýly `.today-spark`
      v `styles.css`.
- [x] **Mobilné zobrazenie blokov a časov** — na úzkych obrazovkách
      (~375 px, iPhone 13 mini) `.blocks li` karty „Dnes" a
      `.finder-results .hit` mali súčet `min-width`-ov detí väčší než
      dostupnú šírku, takže časy presahovali rámec a 📅 tlačidlo sa
      orezalo. Existujúce `@media (max-width: 560px)` v `styles.css`
      bolo rozšírené o `flex-wrap: wrap` a `min-width: 0` na
      `.time` / `.lanes` / `.d` / `.t` / `.len`, takže obsah sa pri
      potrebe zalomí na druhý riadok a všetky akcie (★, 📅, 📸) ostávajú
      viditeľné. Desktop layout (> 560 px) je identický ako predtým.
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

- [x] **Rozdeliť `app.js`** — pôvodný 1999-riadkový `app.js` rozdelený
      na ES moduly v `lib/` a tenký bootstrap (`app.js` má teraz 129
      riadkov). Rozdelenie podľa zodpovednosti: `lib/i18n.js` (jazyk +
      `t()` + `applyStaticI18n`), `lib/state.js` (zdieľaný `state`,
      konštanty, `fetchJSON` + `localStorage` cache), `lib/pricing.js`
      (band/cena helpery + `renderPricing` + kalkulačka), `lib/watcher.js`
      (sledované sloty + obľúbené), `lib/render.js` (heatmapa, „Dnes",
      „Práve teraz", finder, share/slot modaly, trend, theme/views/tabs,
      URL sync, ICS export). Cyklické závislosti `render` ↔ `watcher`
      (toggleFavorite musí re-renderovať) sú vyriešené registry-pattern-om
      `setRenderHook` / `setOnPoolChange` v príslušných moduloch. HTML
      načíta `app.js` ako `<script type="module">`; `lib/helpers.js` a
      `lib/pricing-calc.js` ostávajú UMD a nahrávajú sa cez bežný
      `<script>`, takže existujúce `tests/helpers.test.mjs` (Node
      `createRequire`) ostávajú nedotknuté. Žiadne semantické zmeny
      v UI — všetkých 35 JS testov + 8 Python testov prešlo.
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
