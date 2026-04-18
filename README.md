# STARZ Pasienky — dostupnosť dráh

Jednoduchý statický dashboard, ktorý vizualizuje obsadenosť dráh 25-metrového
bazénu Mestskej plavárne Pasienky (STARZ Bratislava) po dňoch a časových
blokoch.

Zdroj rozvrhu:
https://bratislava.sk/vzdelavanie-a-volny-cas/starz/prevadzky-sportoviska/mestska-plavaren-pasienky-25m

## Spustenie

Je to statická stránka — stačí ju otvoriť cez lokálny HTTP server (kvôli
`fetch("schedule.json")`):

```
python3 -m http.server 8000
# a v prehliadači: http://localhost:8000
```

## Ako aktualizovať rozvrh

Zdrojová stránka STARZ blokuje automatické sťahovanie, preto sa rozvrh
udržiava ručne v súbore [`schedule.json`](./schedule.json). Hodnoty v
repozitári sú **šablóna** — prekopírujte do nej aktuálny rozvrh zo stránky
STARZ.

Štruktúra:

- `lanes` — počet dráh (Pasienky 25 m má 6).
- `dayStart`, `dayEnd`, `slotMinutes` — rozsah a granularita mriežky
  (30-minútové bloky 04:00–22:00).
- `hours[deň]` — otváracie hodiny pre daný deň.
- `schedule[deň]` — pole blokov:
  - `start`, `end` — čas bloku (`HH:MM`).
  - `lanes` — zoznam čísel dráh, ktorých sa blok týka.
  - `status` — `public` (verejnosť) alebo `reserved` (klub/škola/tréning).
  - `label` — voliteľný popis rezervácie (zobrazí sa v tooltipe).

Bloky sa môžu prekrývať iba v zmysle „iné dráhy v tom istom čase“. Bunka sa
kreslí ako *closed* vtedy, keď pre danú dráhu a čas neexistuje žiadny blok,
alebo keď je mimo otváracích hodín.

## Funkcie

- Výber dňa (s označením „dnes“).
- Mriežka dráha × čas so stavmi verejnosť / rezervované / zatvorené.
- Pre dnešok zvýraznený aktuálny 30-minútový blok a súhrn
  „X/6 dráh voľných pre verejnosť“.
- Automatická obnova každých 30 s.

## Súbory

- `index.html` — rozloženie stránky.
- `styles.css` — štýly.
- `app.js` — načítanie dát a render mriežky.
- `schedule.json` — údaje rozvrhu (upravujte ručne).
