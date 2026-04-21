# STARZ Pools Pasienky

<p align="center">
  <a href="https://dscibrany.github.io/starzpools/"><img alt="Naživo: dscibrany.github.io/starzpools" src="https://img.shields.io/badge/Naživo-dscibrany.github.io%2Fstarzpools-10b981?style=for-the-badge&logo=github&logoColor=white"></a>
</p>

> ### [Otvoriť živý dashboard &rarr;](https://dscibrany.github.io/starzpools/)

Jednoduchý statický dashboard, ktorý vizualizuje počet voľných dráh pre
verejnosť v Mestskej plavárni Pasienky (STARZ Bratislava) v 15-minútových
blokoch na 14 dní dopredu. Podporuje **25 m aj 50 m bazén**.

Zdroje:
- 25 m bazén: <https://bratislava.sk/vzdelavanie-a-volny-cas/starz/prevadzky-sportoviska/mestska-plavaren-pasienky-25m>
- 50 m bazén: <https://bratislava.sk/vzdelavanie-a-volny-cas/starz/prevadzky-sportoviska/mestska-plavaren-pasienky-50m>
- Cenník (PDF): <https://bratislavask.s3.bratislava.sk/upload/2025_Mestska_Plavaren_Pasienky_Cennik46_9a43ab7401.pdf>

## Ukážka

<details open>
<summary>50 m bazén (predvolený)</summary>

![50 m bazén — dashboard](docs/screenshot-50m.png)

</details>

<details>
<summary>25 m bazén</summary>

![25 m bazén — dashboard](docs/screenshot-25m.png)

</details>

<details>
<summary>Farebné témy heatmapy</summary>

Téma sa prepína vpravo nad heatmapou a ukladá sa do `localStorage`.

| Semafor (predvolená) | Viridis |
|---|---|
| ![Semafor](docs/screenshot-theme-traffic.png) | ![Viridis](docs/screenshot-theme-viridis.png) |

| Modrá (monochromatická) | Rozhranie 50 % |
|---|---|
| ![Modrá](docs/screenshot-theme-blues.png) | ![Rozhranie 50 %](docs/screenshot-theme-diverging.png) |

</details>

<details>
<summary>Vyhľadávač („Nájdite si čas“)</summary>

![Vyhľadávač voľných blokov](docs/screenshot-finder.png)

</details>

<details>
<summary>Cenník</summary>

![Cenník](docs/screenshot-pricing.png)

</details>

<details>
<summary>Mobilné zobrazenie</summary>

![Mobilné zobrazenie](docs/screenshot-mobile.png)

</details>

<details>
<summary>Indikácia neaktuálneho cenníka</summary>

Keď sa SHA-256 aktuálneho PDF cenníka na stránke bazéna líši od uloženej
referenčnej kópie (alebo keď link už nie je dostupný), dashboard:

- zobrazí žltý pruh nad obsahom,
- označí ⚠ každú cenovku v karte „Práve teraz" a vo výsledkoch vyhľadávača,
- označí ⚠ každú bunku s cenou v tabuľke cenníka.

![Dashboard s upozornením na neaktuálny cenník](docs/screenshot-stale-dashboard.png)

Vyhľadávač — každý výsledok má žltú cenovku s ⚠:

![Vyhľadávač pri neaktuálnom cenníku](docs/screenshot-stale-finder.png)

Cenník — každá bunka má ⚠:

![Cenník pri neaktuálnom cenníku](docs/screenshot-stale-pricing.png)

</details>

## TODO

Otvorené nápady na ďalšie iterácie — nič z toho nie je blokujúce, slúži
to len ako zoznam vecí, ktoré dávajú zmysel, ak sa projekt bude rozvíjať.

- [x] ~~**PWA** — `manifest.json` + service worker, aby sa dala stránka
      „pridať na plochu" a fungovala offline s poslednými staženými dátami.~~
      (hotovo — nazvaná **STARZ Pools**, ikony v `icons/`, `sw.js` s
      cache-first stratégiou pre statické assety a network-first pre JSON.)
- [x] ~~**Obľúbené sloty** — uložené do `localStorage`, s indikátorom pri
      riadku v heatmape a v karte „Dnes".~~
      (hotovo — ★ tlačidlo pri každom bloku v karte „Dnes" prepína (pool +
      weekday + start/end min) favoritu v `localStorage` (`starz-favorites`).
      V heatmape dostane každý riadok, ktorý má aspoň jeden favorit pre
      daný deň týždňa, žltú hviezdu v headeri; bunky v časovom rozsahu
      favoritu majú žltý bod v rohu. Favority sú per-bazén.)
- [x] ~~**Export do kalendára** — tlačidlo „Pridať do kalendára" pri
      každom bloku/výsledku vyhľadávača (`.ics` link).~~
      (hotovo — ikonka 📅 v karte „Dnes" a pri každom výsledku vyhľadávača
      stiahne `.ics` súbor s UID, DTSTART/DTEND v UTC a popisom slotu.)
- [x] ~~**Upozornenia** — opt-in web push, keď sa uvoľní vopred zvolený slot
      (napr. „utorok 18:00, aspoň 3 dráhy").~~
      (hotovo — sekcia „Sledovať voľný slot": deň/čas/dráhy/dĺžka, watche sa
      ukladajú do `localStorage`, `schedule.json` sa re-fetchne každých 5 min
      a pri novej zhode sa pošle lokálna Notifikácia. Pravý „server push"
      nie je možný bez back-endu, takže upozornenia chodia, kým je stránka
      otvorená.)
- [x] ~~**Anglická verzia** — jazykový prepínač (sk/en), texty vytiahnuté
      do `i18n.json`.~~
      (hotovo — `i18n.json` obsahuje všetky texty v `sk`/`en`, prepínač je
      v pravom hornom rohu, jazyk sa ukladá do `localStorage` (`starz-lang`)
      a rešpektuje `?lang=en` v URL. Všetok statický text v `index.html` má
      `data-i18n*` atribúty, ktoré sa pri prepnutí prekladajú, dynamické
      texty v `app.js` idú cez `t(key, vars)`.)
- [x] ~~**Trend obsadenosti** — tab/panel s priemerom voľných dráh po
      hodinách/dňoch za posledných N týždňov (vyžaduje archiváciu
      `schedule.json` snapshotov).~~
      (hotovo — archiv snapshotov je už v git histórii;
      `scripts/compute_trend.py` walkuje posledných 8 týždňov commitov
      `schedule*.json`, pre každý dátum vezme najnovší známy stav, a
      agreguje priemery per (bazén, deň-v-týždni, 15-min slot) do
      `trend.json`. Workflow `update-data.yml` ho prepočítava denne. V UI
      je nová záložka **Trend** s 7×76 heatmapou priemernej voľnosti.)
- [x] ~~**Robustnosť scrapera** — ak sa zmení štruktúra zdrojového
      XLSX/HTML, dashboard by mal zobraziť banner „dáta môžu byť
      neaktuálne" (podobne ako pri cenníku).~~
      (hotovo — `renderScheduleStaleBanner` skontroluje `schedule.updated`
      aktívneho bazéna; ak je staršie ako 3 dni alebo dáta úplne chýbajú,
      zobrazí sa červený pruh nad obsahom s odkazom na zdrojovú stránku.
      Pokrýva oba prípady: pád scrapera a zmenu štruktúry XLSX — v oboch
      sa `schedule*.json` prestane commitovať a banner sa spustí
      automaticky.)
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
- [x] ~~**Golden-file test scrapera** — stale-banner rieši následok, ale
      CI test, ktorý padne pri zmene štruktúry XLSX, by chytil problém
      skôr než sa dáta zastarajú. Malý test, veľká hodnota.~~
      (hotovo — `tests/test_update_data.py` generuje synthetic XLSX cez
      `openpyxl`, pretláča ich cez `transform_xlsx()` a kontroluje, že
      (a) výstupný JSON má stabilný tvar a (b) zmena štruktúry (premenovaný
      label „Počet voľných dráh", chýbajúci counter row, skrátený
      workbook) padne s čitateľnou `RuntimeError`. Beží v
      `.github/workflows/tests.yml`.)
- [x] ~~**Zachovať posledné známe dáta pri stale** — namiesto „bez dát"
      ponechať vykreslenie heatmapy/karty a zobraziť len banner navrchu.~~
      (hotovo — každý úspešný `fetchJSON` zapíše JSON do `localStorage`
      pod kľúč `starz-cache:<path>`; pri zlyhaní fetch-u `fetchJSONWithCache`
      načíta poslednú známu verziu. Stale-banner na vrchu funguje naďalej
      podľa `data.updated`, len heatmapa/karta sa teraz vykreslia z cache
      namiesto vyprázdnenia. Vrství sa čisto nad existujúci service worker,
      ktorý už robí network-first pre JSON.)
- [ ] **Odber kalendára (`subscribe.ics`)** — denne generovaný ICS feed
      so všetkými verejnými blokmi na 14 dní; jedno-klikové „Pridať do
      Google kalendára" miesto per-blok ICS.
- [x] ~~**OG image pre zdieľanie** — dnešná share karta pred-renderovaná
      ako PNG cez GitHub Action pre náhľad na Slacku/Messengeri.~~
      (hotovo — `scripts/generate_og.py` (Pillow) renderuje 1200×630 PNG
      z `schedule-50m.json`: značka, dnešný dátum, verejné bloky dňa
      farebne kódované podľa pomeru voľných dráh, footer s URL a dátumom
      aktualizácie. Workflow `update-data.yml` ho denne prepočíta a
      commitne `og.png`. `index.html` má `og:title/description/url/image`
      a `twitter:card=summary_large_image`, takže Slack/Messenger/LinkedIn
      ukazujú aktuálny dnešný plán.)
- [x] ~~**Testy čistých funkcií** — `collapseBlocks`, `levelFor`,
      `bandForMinOnDate`, `scheduleAgeDays` sú čisté a triviálne pokryť.
      Odomkne bezpečný refactor.~~
      (hotovo — čisté helpery (`pad`, `toMin`, `fmt`, `todayISO`,
      `collapseBlocks`, `levelFor`, `scheduleAgeDays`, `icsEscape`,
      `icsUTCStamp`) sú v `lib/helpers.js` ako dual-module (IIFE s
      `module.exports` alebo `window`), `tests/helpers.test.mjs`
      pokrýva 14 prípadov cez node's vstavaný `node --test`. Beží v
      `.github/workflows/tests.yml`.)
- [ ] **Rozdeliť `app.js`** — ~1700 riadkov; ES moduly (render / data /
      watcher / i18n) by zlepšili orientáciu.
- [x] ~~**A11y audit** — ARIA role pre heatmap-cells, klávesová navigácia
      po bunkách, kontrast tmavých farieb v Semafore.~~
      (hotovo — grid má `role="grid"` + `aria-rowcount`/`aria-colcount`,
      bunky `gridcell` s `aria-label`, roving-tabindex ovládané šípkami +
      Home/End/Enter, fokus-ring, v Semafore svetlejšia lane-1 (#ef4444)
      a lane-4 (#22c55e).)
- [x] ~~**Zdieľanie odkazu** — URL s parametrami `?date=…&from=…&lanes=…`,
      ktorá otvorí dashboard s predvyplneným vyhľadávačom.~~
      (hotovo — vyhľadávač sa synchronizuje s URL cez `pool`, `date`, `from`,
      `lanes`, `len`, `today`; tlačidlo „Skopírovať odkaz" vloží aktuálny
      URL do schránky.)
- [x] ~~**Print/share karta** — „dnešný plán" ako jedna obrazovka
      optimalizovaná na screenshot do chatu.~~
      (hotovo — v karte „Dnes" tlačidlo 📸 Zdieľať otvorí modal s kompaktným
      screenshot-friendly prehľadom všetkých dnešných verejných blokov (časy,
      voľné dráhy, dĺžka, live/past tag). Modal má „Tlačiť / Uložiť PDF"
      cez `window.print()` s dedikovaným `@media print` štýlom, ktorý
      izoluje len kartu na bielom pozadí.)
- [x] ~~**Automatické mazanie stale Pages environment branches** — keď
      workflow deploynutia spadne, aktuálne treba manuálne upratať
      deployment-branch rule.~~
      (hotovo — workflow `.github/workflows/cleanup-pages-branches.yml`
      beží týždenne + po každom neúspešnom Pages deploy a maže
      deployment-branch policies, ktorým už nezodpovedá žiadna vetva. Mazanie
      vyžaduje token s „Administration: write"; nastav ho ako
      `PAGES_ADMIN_TOKEN`, inak workflow len upozorní varovaním.)

## Funkcie

- **Prepínač bazénov** 25 m / 50 m.
- **Karta „Práve teraz“** — výrazne zvýraznená, pulzujúce orámovanie počas
  prebiehajúceho verejného bloku, počet voľných dráh, kedy blok končí alebo
  kedy začne najbližší verejný blok.
- **Vyhľadávač voľných blokov** — nastavte najskorší čas, minimálny počet
  dráh a minimálnu dĺžku, dashboard vyhľadá všetky vyhovujúce okná a zvýrazní
  ich v heatmape.
- **Heatmapa 14 dní × 76 blokov** — farba podľa pomeru voľných/celkových
  dráh (4 úrovne + zatvorené), zvýraznený dnešný riadok a aktuálny stĺpec.
- **Externé odkazy** — tlačidlá na oficiálnu stránku vybraného bazéna, na
  zdrojovú tabuľku STARZ a na PDF cenník.
- **Cenník** — karta s cenami (doplňte hodnoty do `pricing.json`).
- Automatická obnova každých 30 s.

## Spustenie

Statická stránka — stačí ju otvoriť cez lokálny HTTP server (kvôli
`fetch("schedule.json")`):

```
python3 -m http.server 8000
# otvorte http://localhost:8000
```

## Nasadenie (GitHub Pages)

Repozitár má pripravený workflow
`.github/workflows/pages.yml`, ktorý po každom pushi do `main` nasadí
obsah repozitára na GitHub Pages. Stačí v repo **Settings → Pages**
zvoliť **Source: GitHub Actions** — ďalšie nastavenia netreba.

Výsledná URL má tvar `https://<user>.github.io/starzpools/`. Denný
workflow `update-data.yml` commituje čerstvé JSON-y do `main`,
čo automaticky spustí redeployment.

## Súbory

| Súbor | Obsah |
|---|---|
| `index.html` | rozloženie stránky |
| `styles.css` | štýly (tmavá téma) |
| `app.js` | načítanie dát, render, vyhľadávač |
| `schedule.json` | údaje 25 m bazéna |
| `schedule-50m.json` | údaje 50 m bazéna |
| `pricing.json` | cenník |
| `docs/` | snímky pre README |

## Dátový formát rozvrhu

Každý súbor `schedule*.json` má rovnakú štruktúru:

```json
{
  "pool": "…",
  "source": "https://…",
  "updated": "YYYY-MM-DD",
  "slotMinutes": 15,
  "dayStart": "05:00",
  "dayEnd": "24:00",
  "maxLanes": 4,
  "days": [
    {
      "date": "2026-04-18",
      "weekday": "sobota",
      "free": [0, 0, /* … 76 hodnôt … */ 0]
    }
  ]
}
```

Každý deň má **76 hodnôt** (19 hodín × 4 bloky po 15 minút, 05:00–23:45).
Hodnota = počet dráh voľných pre verejnosť v danom bloku, `0` = mimo
verejnej prevádzky.

Aktualizácia rozvrhu: skopírujte z oficiálnej STARZ tabuľky „Počet voľných
dráh“ hodnoty pre daný deň a vložte ich do `free`.

## Cenník

`pricing.json` obsahuje sekcie s položkami. Prázdny `price` sa zobrazí ako
„— doplňte —“. Doplňte reálne ceny z oficiálneho PDF cenníka.
