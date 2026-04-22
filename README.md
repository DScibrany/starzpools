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

> **Poznámka k snímkam:** hlavné dashboard screenshoty
> (`screenshot-50m.png`, `screenshot-25m.png`) pochádzajú z čias pred
> niektorými nedávnymi UI úpravami — nezachytávajú napríklad farebný
> lane-dots indikátor v karte „Práve teraz", chipy
> „nezvyčajne voľno / obsadené" a „sviatok", sparkline v karte „Dnes"
> alebo popup nad bunkami heatmapy. Funkcionalita je však popísaná
> v sekcii [Funkcie](#funkcie).

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
<summary>Trend tab</summary>

Záložka **Trend** ukazuje 7 × 76 heatmapu priemernej voľnosti dráh za
posledných 8 týždňov, jeden riadok per deň v týždni. Dátumy uvedené
v `pricing.json.holidays` sa pri priemerovaní vyfiltrujú. Každá bunka
je klikateľná (klik aj Enter cez klávesovú navigáciu) a otvorí popup
s priemerom + 🔗 tlačidlom na plný detail modal.

_Snímka sa doplní — cieľové umiestnenie: [`docs/screenshot-trend.png`](docs/)._

</details>

<details>
<summary>Popup nad bunkou heatmapy + detail modal</summary>

Klik (alebo Enter) na bunku dashboard alebo trend heatmapy ukáže
kompaktný popup so základnými údajmi — deň, čas, počet voľných dráh —
a 🔗 tlačidlom, ktoré otvorí plný slot detail modal: priemer z trendu
(zafarbený pri odchýlke ≥ 1,5 dráhy), chip „sviatok" ak je, akcie
**Pridať do kalendára** (`.ics`), **Pridať do obľúbených**
a **Skopírovať odkaz** (`?slot=YYYY-MM-DDTHH:MM`).

_Snímky sa doplnia — cieľové umiestnenia: [`docs/screenshot-heatmap-popup.png`](docs/) a [`docs/screenshot-slot-modal.png`](docs/)._

</details>

<details>
<summary>Sparkline v karte „Dnes“</summary>

Inline mini-graf SVG zo 76 hodnôt `day.free` tesne pod nadpisom karty
„Dnes" so zvislou žltou značkou v aktuálnom 15-min slote — prehľad
celého dňa bez skoku do heatmapy.

_Snímka sa doplní — cieľové umiestnenie: [`docs/screenshot-sparkline.png`](docs/)._

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

## Funkcie

- **Prepínač bazénov** 25 m / 50 m.
- **Karta „Práve teraz“** — výrazne zvýraznená, pulzujúce orámovanie počas
  prebiehajúceho verejného bloku, počet voľných dráh, kedy blok končí alebo
  kedy začne najbližší verejný blok. Chip **„nezvyčajne voľno / obsadené"**
  sa objaví, keď sa aktuálny stav líši od priemeru v `trend.json` pre daný
  deň a čas aspoň o 1,5 dráhy.
- **Vyhľadávač voľných blokov** — nastavte najskorší čas, minimálny počet
  dráh a minimálnu dĺžku, dashboard vyhľadá všetky vyhovujúce okná a zvýrazní
  ich v heatmape.
- **Heatmapa 14 dní × 76 blokov** — farba podľa pomeru voľných/celkových
  dráh (4 úrovne + zatvorené), zvýraznený dnešný riadok a aktuálny stĺpec.
  Prepínateľné farebné témy (Semafor / Viridis / Modrá / Rozhranie 50 %).
  **Klik (alebo Enter cez klávesovú navigáciu) na bunku** ukáže kompaktný
  popup so základnými údajmi a 🔗 tlačidlo, ktoré otvorí plný slot detail
  modal s trend-priemerom, ICS, favorit a deep-link akciami.
- **Trend obsadenosti** — záložka **Trend** s 7×76 heatmapou priemernej
  voľnosti za posledných 8 týždňov, per deň-v-týždni a 15-min slot.
  Dátumy uvedené v `pricing.json.holidays` sa pri priemerovaní
  vyfiltrujú, takže sviatky neťahajú priemer daného dňa týždňa dole.
  Bunky sú klikateľné (aj cez klávesnicu) — ukážu rovnaký popup so
  základnými údajmi a 🔗 tlačidlom, ktoré otvorí slot detail modal
  pre najbližší výskyt daného dňa v 14-dňovom rozvrhu.
- **Sparkline dňa** — inline mini-graf krivky voľných dráh v karte „Dnes"
  so zvislou značkou aktuálneho slotu; prehľad celého dňa bez skoku
  do heatmapy.
- **Obľúbené sloty** — ★ pri bloku v karte „Dnes" uloží (pool + deň + čas)
  favoritu do `localStorage`; heatmapa zvýrazní favoritné riadky a bunky.
- **Upozornenia na voľný slot** — sekcia „Sledovať voľný slot" (deň / čas /
  min. dráhy / dĺžka); pri novej zhode pošle lokálnu Notifikáciu, kým je
  stránka otvorená.
- **Export do kalendára** — ikonka 📅 v karte „Dnes" a pri výsledku
  vyhľadávača stiahne `.ics` súbor s UTC DTSTART/DTEND a popisom slotu.
- **Zdieľanie odkazu** — URL sa synchronizuje s vyhľadávačom
  (`?pool=…&date=…&from=…&lanes=…&len=…`); tlačidlo „Skopírovať odkaz"
  vloží aktuálny stav do schránky.
- **Deep-link na slot** — 🔗 pri každom dnešnom bloku otvorí detail modal
  (dráhy, priemer z trendu, ICS, favorit, „Skopírovať odkaz"). URL tvaru
  `?slot=YYYY-MM-DDTHH:MM` otvorí ten istý modal rovno po načítaní.
- **Print / share karta** — 📸 Zdieľať v karte „Dnes" otvorí kompaktný
  screenshot-friendly prehľad dňa s „Tlačiť / Uložiť PDF" cez `@media print`.
- **OG image** — denne pred-renderovaný `og.png` (1200×630) pre náhľad
  na Slacku / Messengeri / LinkedIne.
- **PWA / offline** — `manifest.json` + `sw.js` (cache-first pre assety,
  network-first pre JSON). Dá sa „pridať na plochu" a funguje offline
  s poslednými staženými dátami.
- **Stale banner** — ak sú dáta staršie ako 3 dni alebo chýbajú, zobrazí sa
  červený pruh nad obsahom s odkazom na zdrojovú stránku; heatmapa a karta
  sa medzitým vykreslia z `localStorage` cache.
- **Stale cenník** — keď SHA-256 aktuálneho PDF cenníka na stránke bazéna
  nesedí s referenčnou kópiou, zobrazí sa žltý banner a ⚠ pri každej cene.
- **Chips pre sviatky** — keď je dátum v `pricing.json.holidays`, karta
  „Práve teraz", karta „Dnes", slot detail modal a share karta dostanú
  fialový odznak **sviatok**; v heatmape má sviatočný deň subtílny tint
  a ✦ mark v rowheadi.
- **Slovenčina / Angličtina** — prepínač sk/en v hlavičke, jazyk sa ukladá
  do `localStorage` a rešpektuje `?lang=en` v URL.
- **Prístupnosť** — heatmapa má `role="grid"` + `aria-label` na bunkách,
  klávesová navigácia (šípky / Home / End / Enter) a fokus-ring.
- **Externé odkazy** — tlačidlá na oficiálnu stránku vybraného bazéna, na
  zdrojovú tabuľku STARZ a na PDF cenník.
- **Cenník** — karta s cenami z `pricing.json`.
- Automatická obnova každých 30 s.

## TODO

Otvorené nápady na ďalšie iterácie — nič z toho nie je blokujúce. Kompletný
zoznam (vrátane archívu dokončených položiek a internej infraštruktúry) je
v [`TODO.md`](TODO.md).

- [ ] **Ďalšie STARZ bazény** — Rosnička, Delfín, Tehelné pole; rovnaký
      formát `schedule*.json`, len s iným pool-tabom.
- [ ] **Odporúčač najlepšieho času** — využiť `trend.json` a ponúknuť
      „najtichšie okno tento týždeň" pre zadanú dĺžku + min. dráhy.
- [ ] **Kalkulačka ceny** — typ vstupu × dĺžka × všedný deň/sviatok →
      EUR, z `pricing.json`.
- [ ] **Mesačný prehľad (1 bunka / deň)** — dlhšia farebná mriežka nad
      rámec 14 dní, s priemerom z `trend.json`.
- [ ] **Odber kalendára (`subscribe.ics`)** — denne generovaný ICS feed
      so všetkými verejnými blokmi na 14 dní.

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

Výsledná URL má tvar `https://<user>.github.io/starzpools/`. Hodinový
workflow `update-data.yml` commituje čerstvé JSON-y do `main`,
čo automaticky spustí redeployment.

## Súbory

| Súbor | Obsah |
|---|---|
| `index.html` | rozloženie stránky |
| `styles.css` | štýly (tmavá téma) |
| `app.js` | načítanie dát, render, vyhľadávač, modal |
| `lib/helpers.js` | čisté helpery (pokryté `tests/helpers.test.mjs`) |
| `i18n.json` | preklady (sk + en) |
| `schedule.json` | údaje 25 m bazéna |
| `schedule-50m.json` | údaje 50 m bazéna |
| `pricing.json` | cenník + `bands`, `holidays` |
| `trend.json` | agregovaný trend obsadenosti (per pool × weekday × slot) |
| `manifest.json`, `sw.js`, `icons/` | PWA (pridanie na plochu, offline cache) |
| `og.png` | pred-renderovaný share obrázok (denný) |
| `scripts/` | scraper (`update_data.py`), trend (`compute_trend.py`), OG (`generate_og.py`) |
| `tests/` | pytest (scraper golden + trend holiday filter) a node `--test` (JS helpery) |
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
