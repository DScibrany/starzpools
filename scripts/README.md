# Data update pipeline

`scripts/update_data.py` refreshes the dashboard's data files from the
public STARZ pool pages. It runs daily in GitHub Actions
(`.github/workflows/update-data.yml`) and can be invoked locally for
testing.

## Install

```sh
pip install -r scripts/requirements.txt
```

## Commands

```sh
# Discover URLs on the pool pages and download XLSX + cenník PDF
python scripts/update_data.py fetch

# Convert local XLSX files to schedule.json / schedule-50m.json
python scripts/update_data.py transform

# Update pricing.json.status from the last stored PDF (compare to reference)
python scripts/update_data.py pricing [--url <pdf-url>] [--page <pool-page>]

# Full daily pipeline: fetch + transform + pricing
python scripts/update_data.py update
```

## What it does

1. **Schedule** — for each pool, scrapes the page for the
   *"Časový rozpis voľných plaveckých dráh pre verejnosť"* link (a
   rotating SharePoint URL), downloads the XLSX, then reads the
   `Verejnost` sheet. Each day block is 9 rows; the last row
   (`Počet voľných dráh`) has 76 free-lane values in 15-min slots.
   Output is `schedule.json` (25 m) and `schedule-50m.json` (50 m).

2. **Pricing** — downloads the current cenník PDF from the same pool
   pages, compares its SHA-256 to the reference stored in
   `pricing.json.status.referenceSha256`. If they differ (or if the link
   is missing/unreachable), `status.upToDate` is set to `false` and the
   dashboard shows a warning banner pointing to the pool page.

   Updates to the reference fingerprint are intentionally manual:
   after reviewing the new PDF and updating `pricing.json`, run
   `jq '.status.referenceSha256 = .status.storedSha256' pricing.json`
   (or edit it by hand) to adopt the new hash as the reference.

## Data location

Downloaded source files live in `data/starz/`:

| File | Purpose |
|---|---|
| `2026-Rezervacie-MPP25-Verejnost.xlsx` | 25 m pool reservations |
| `2026-Rezervacie-MPP50-Verejnost.xlsx` | 50 m pool reservations |
| `pricing-current.pdf` | latest downloaded cenník |
