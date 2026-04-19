#!/usr/bin/env python3
"""Daily update pipeline for the STARZ Pasienky dashboard.

The pool pages on bratislava.sk expose two artefacts under the
"Otváracie hodiny a vyťaženosť bazéna" section:

  * "Časový rozpis voľných plaveckých dráh pre verejnosť" — SharePoint
    link that serves an XLSX workbook with 14 days of 15-min lane data.
  * Cenník — a PDF on bratislavask.s3.bratislava.sk.

Both URLs rotate (SharePoint tokens, S3 object IDs), so the script
discovers the current ones by scraping the public page.

Commands:
  fetch       — download XLSX + PDF from the public pages into data/starz/
  transform   — read local XLSX files, write schedule*.json
  pricing     — compare downloaded cenník to the stored copy, update
                pricing.json.status accordingly
  update      — fetch, transform, pricing (what the daily cron runs)
"""
from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import io
import json
import os
import re
import sys
import urllib.parse
from pathlib import Path
from typing import Iterable

try:
    import requests
except ImportError:
    requests = None  # transform-only runs do not need it

try:
    from bs4 import BeautifulSoup
except ImportError:
    BeautifulSoup = None

import openpyxl

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "data" / "starz"

POOL_PAGES = {
    "25m": "https://bratislava.sk/vzdelavanie-a-volny-cas/starz/prevadzky-sportoviska/mestska-plavaren-pasienky-25m",
    "50m": "https://bratislava.sk/vzdelavanie-a-volny-cas/starz/prevadzky-sportoviska/mestska-plavaren-pasienky-50m",
}
XLSX_FILES = {
    "25m": DATA_DIR / "2026-Rezervacie-MPP25-Verejnost.xlsx",
    "50m": DATA_DIR / "2026-Rezervacie-MPP50-Verejnost.xlsx",
}
POOL_META = {
    "25m": {
        "out": ROOT / "schedule.json",
        "name": "Mestská plaváreň Pasienky 25 m",
        "max_lanes": 4,
    },
    "50m": {
        "out": ROOT / "schedule-50m.json",
        "name": "Mestská plaváreň Pasienky 50 m",
        "max_lanes": 8,
    },
}
PRICING_PDF = DATA_DIR / "pricing-current.pdf"
PRICING_JSON = ROOT / "pricing.json"

SCHEDULE_LINK_TEXT = "Časový rozpis voľných plaveckých dráh"
PRICING_LINK_TEXT = "Cenník"

SLOT_MINUTES = 15
DAY_START_HOUR = 5
DAY_END_HOUR = 24
SLOTS_PER_DAY = (DAY_END_HOUR - DAY_START_HOUR) * 60 // SLOT_MINUTES  # 76
DATA_COL_START = 4  # column E (0-based) in the Verejnost sheet
ROWS_PER_DAY = 9    # date row + 7 service rows + "Počet voľných dráh" row
COUNTER_ROW_OFFSET = 8
SK_WEEKDAYS = {
    0: "pondelok", 1: "utorok", 2: "streda", 3: "štvrtok",
    4: "piatok", 5: "sobota", 6: "nedeľa",
}


# ---------------------------------------------------------------- scraping --

def _require(module, name: str):
    if module is None:
        raise SystemExit(f"Missing dependency '{name}'. Run: pip install {name}")


def _http_get(url: str, **kw) -> "requests.Response":
    _require(requests, "requests")
    headers = {
        "User-Agent": (
            "Mozilla/5.0 (compatible; starzpools-bot/1.0; "
            "+https://github.com/DScibrany/starzpools)"
        ),
    }
    headers.update(kw.pop("headers", {}))
    resp = requests.get(url, headers=headers, timeout=60, allow_redirects=True, **kw)
    resp.raise_for_status()
    return resp


def discover_links(page_url: str) -> dict:
    """Return {'xlsx': url | None, 'pdf': url | None, 'pdf_text': str | None}."""
    _require(BeautifulSoup, "beautifulsoup4")
    html = _http_get(page_url).text
    soup = BeautifulSoup(html, "html.parser")
    xlsx_url = None
    pdf_url = None
    pdf_text = None
    for a in soup.find_all("a", href=True):
        text = " ".join(a.get_text(" ", strip=True).split())
        href = a["href"]
        if not href:
            continue
        abs_url = urllib.parse.urljoin(page_url, href)
        low = text.lower()
        if xlsx_url is None and "časový rozpis" in low and "voľn" in low:
            xlsx_url = abs_url
        if pdf_url is None and low.startswith("cenník"):
            pdf_url = abs_url
            pdf_text = text
    return {"xlsx": xlsx_url, "pdf": pdf_url, "pdf_text": pdf_text}


def _download_binary(url: str, dest: Path) -> Path:
    resp = _http_get(url, stream=True)
    dest.parent.mkdir(parents=True, exist_ok=True)
    with dest.open("wb") as f:
        for chunk in resp.iter_content(chunk_size=65536):
            if chunk:
                f.write(chunk)
    return dest


def fetch_sources() -> dict:
    """Download XLSX for both pools and the current pricing PDF.

    Returns a dict with URLs found and file paths written.
    """
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    report = {"pools": {}, "pricing": {}}

    for pool, page_url in POOL_PAGES.items():
        info = discover_links(page_url)
        report["pools"][pool] = info
        if not info["xlsx"]:
            raise RuntimeError(
                f"Could not find the 'Časový rozpis…' link on {page_url}"
            )
        _download_binary(info["xlsx"], XLSX_FILES[pool])

    # Pricing PDF — discover on the 25m page (same PDF on both).
    pdf_info = report["pools"]["25m"]
    pdf_url = pdf_info.get("pdf")
    report["pricing"]["url"] = pdf_url
    report["pricing"]["source_page"] = POOL_PAGES["25m"]
    if pdf_url:
        _download_binary(pdf_url, PRICING_PDF)
        report["pricing"]["downloaded"] = True
    else:
        report["pricing"]["downloaded"] = False
    return report


# ----------------------------------------------------------- xlsx transform -

def _row_values(ws, row_idx: int) -> list:
    return next(ws.iter_rows(min_row=row_idx, max_row=row_idx, values_only=True))


def transform_xlsx(xlsx_path: Path, meta: dict, source_page: str) -> dict:
    wb = openpyxl.load_workbook(xlsx_path, data_only=True)
    ws = wb["Verejnost"]
    days = []
    date_row = 6  # 1-based; first date always at row 6
    while date_row <= ws.max_row:
        date_val = ws.cell(row=date_row, column=1).value
        if not isinstance(date_val, dt.datetime):
            break
        counter_row = date_row + COUNTER_ROW_OFFSET
        label = ws.cell(row=counter_row, column=1).value
        if label != "Počet voľných dráh":
            raise RuntimeError(
                f"Unexpected layout: row {counter_row} col A = {label!r}, "
                "expected 'Počet voľných dráh'"
            )
        row = _row_values(ws, counter_row)
        slots = row[DATA_COL_START: DATA_COL_START + SLOTS_PER_DAY]
        free = [int(v) if isinstance(v, (int, float)) else 0 for v in slots]
        if len(free) != SLOTS_PER_DAY:
            raise RuntimeError(
                f"Row {counter_row}: got {len(free)} slots, expected {SLOTS_PER_DAY}"
            )
        days.append({
            "date": date_val.strftime("%Y-%m-%d"),
            "weekday": SK_WEEKDAYS[date_val.weekday()],
            "free": free,
        })
        date_row += ROWS_PER_DAY

    if not days:
        raise RuntimeError(f"No day rows found in {xlsx_path}")

    return {
        "pool": meta["name"],
        "source": source_page,
        "updated": dt.date.today().strftime("%Y-%m-%d"),
        "note": (
            f"Hodnoty = počet voľných dráh pre verejnosť v danom 15-min bloku "
            f"(max {meta['max_lanes']}). Zdroj: STARZ tabuľka."
        ),
        "timezone": "Europe/Bratislava",
        "slotMinutes": SLOT_MINUTES,
        "dayStart": f"{DAY_START_HOUR:02d}:00",
        "dayEnd": f"{DAY_END_HOUR:02d}:00",
        "maxLanes": meta["max_lanes"],
        "days": days,
    }


def write_schedules() -> list[Path]:
    written = []
    for pool, meta in POOL_META.items():
        xlsx = XLSX_FILES[pool]
        if not xlsx.exists():
            print(f"[transform] skip {pool}: {xlsx} missing", file=sys.stderr)
            continue
        data = transform_xlsx(xlsx, meta, POOL_PAGES[pool])
        meta["out"].write_text(
            json.dumps(data, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
        print(f"[transform] wrote {meta['out'].relative_to(ROOT)} "
              f"({len(data['days'])} days)")
        written.append(meta["out"])
    return written


# --------------------------------------------------------------- pricing --

def _sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()


def update_pricing_status(pdf_info: dict | None = None) -> dict:
    """Compare the stored PDF to the freshly downloaded one.

    If pdf_info is not supplied, only the stored PDF's fingerprint is
    recorded. Expected keys: url, source_page, downloaded.
    """
    doc = json.loads(PRICING_JSON.read_text(encoding="utf-8"))
    status = doc.get("status", {})
    stored_hash = _sha256(PRICING_PDF) if PRICING_PDF.exists() else None
    status["storedSha256"] = stored_hash
    status["lastChecked"] = dt.datetime.utcnow().strftime("%Y-%m-%dT%H:%MZ")

    if pdf_info is not None:
        status["currentUrl"] = pdf_info.get("url")
        status["sourcePage"] = pdf_info.get("source_page")
        if not pdf_info.get("url"):
            status["upToDate"] = False
            status["reason"] = "missing-link"
        elif pdf_info.get("downloaded"):
            ref = status.get("referenceSha256")
            if ref is None:
                # First run — adopt the downloaded PDF as the reference.
                status["referenceSha256"] = stored_hash
                status["upToDate"] = True
                status.pop("reason", None)
            else:
                status["upToDate"] = stored_hash == ref
                if status["upToDate"]:
                    status.pop("reason", None)
                else:
                    status["reason"] = "pdf-changed"
        else:
            status["upToDate"] = False
            status["reason"] = "download-failed"

    doc["status"] = status
    PRICING_JSON.write_text(
        json.dumps(doc, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    return status


# ------------------------------------------------------------------- CLI ---

def cmd_fetch(args):
    report = fetch_sources()
    print(json.dumps(report, ensure_ascii=False, indent=2))


def cmd_transform(args):
    write_schedules()


def cmd_pricing(args):
    # Use last known discovery if caller provides --url / --page, else just
    # refresh the stored fingerprint.
    pdf_info = None
    if args.url or args.page:
        pdf_info = {
            "url": args.url,
            "source_page": args.page or POOL_PAGES["25m"],
            "downloaded": PRICING_PDF.exists(),
        }
    status = update_pricing_status(pdf_info)
    print(json.dumps(status, ensure_ascii=False, indent=2))


def cmd_update(args):
    report = fetch_sources()
    write_schedules()
    pdf_info = {
        "url": report["pricing"].get("url"),
        "source_page": report["pricing"].get("source_page"),
        "downloaded": report["pricing"].get("downloaded", False),
    }
    status = update_pricing_status(pdf_info)
    print(json.dumps({"fetch": report, "pricing_status": status},
                     ensure_ascii=False, indent=2))


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description=__doc__,
                                formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = p.add_subparsers(dest="cmd", required=True)

    sub.add_parser("fetch", help="download XLSX + cenník PDF").set_defaults(func=cmd_fetch)
    sub.add_parser("transform", help="convert local XLSX to schedule*.json").set_defaults(func=cmd_transform)

    pp = sub.add_parser("pricing", help="refresh pricing.status")
    pp.add_argument("--url", help="current cenník PDF URL (skip discovery)")
    pp.add_argument("--page", help="pool page URL where the PDF lives")
    pp.set_defaults(func=cmd_pricing)

    sub.add_parser("update", help="fetch + transform + pricing (daily cron)").set_defaults(func=cmd_update)

    args = p.parse_args(argv)
    args.func(args)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
