#!/usr/bin/env python3
"""Generate an Open Graph preview image for social link unfurls.

Reads schedule-50m.json (the default pool on the dashboard), collapses
today's public blocks, and renders a 1200×630 PNG at repo root as
`og.png`. Embedded by index.html via <meta property="og:image">, so
Slack/Messenger/LinkedIn/Twitter show today's plan in link previews
instead of a generic screenshot.

Runs from .github/workflows/update-data.yml after trend.json is
recomputed, so the preview is always one day fresh. Idempotent: if the
resulting PNG is bit-identical to the one on disk, the workflow
commit-step will detect no change.
"""
from __future__ import annotations

import datetime as dt
import json
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
SCHEDULE_PATH = ROOT / "schedule-50m.json"
OUT_PATH = ROOT / "og.png"

W, H = 1200, 630
BG = (15, 23, 42)        # #0f172a — matches theme-color
FG = (226, 232, 240)     # slate-200
MUTED = (148, 163, 184)  # slate-400
ACCENT = (56, 189, 248)  # sky-400

# Traffic-light palette (matches default dashboard theme).
LANE_COLORS = {
    0: (71, 85, 105),    # closed / no lanes
    1: (239, 68, 68),    # few
    2: (250, 204, 21),
    3: (132, 204, 22),
    4: (34, 197, 94),    # plenty
}

WEEKDAYS_SK = [
    "pondelok", "utorok", "streda", "štvrtok",
    "piatok", "sobota", "nedeľa",
]

FONT_CANDIDATES = [
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    "/Library/Fonts/Arial.ttf",
]


def load_font(bold: bool, size: int) -> ImageFont.FreeTypeFont:
    name = "DejaVuSans-Bold.ttf" if bold else "DejaVuSans.ttf"
    for p in FONT_CANDIDATES:
        if p.endswith(name) and Path(p).exists():
            return ImageFont.truetype(p, size=size)
    # Fallback: any available DejaVu.
    for p in FONT_CANDIDATES:
        if Path(p).exists():
            return ImageFont.truetype(p, size=size)
    return ImageFont.load_default()


def level_for(raw: int, max_lanes: int) -> int:
    if raw <= 0 or max_lanes <= 0:
        return 0
    r = raw / max_lanes
    if r <= 0.25:
        return 1
    if r <= 0.5:
        return 2
    if r <= 0.75:
        return 3
    return 4


def fmt_min(m: int) -> str:
    return f"{(m // 60) % 24:02d}:{m % 60:02d}"


def to_min(hhmm: str) -> int:
    h, m = hhmm.split(":")
    return int(h) * 60 + int(m)


def collapse_blocks(free, slot_minutes, start_min):
    blocks = []
    i, n = 0, len(free)
    while i < n:
        if free[i] == 0:
            i += 1
            continue
        j = i
        while j < n and free[j] == free[i]:
            j += 1
        blocks.append({
            "start": start_min + i * slot_minutes,
            "end": start_min + j * slot_minutes,
            "lanes": free[i],
        })
        i = j
    return blocks


def render(schedule: dict, today_iso: str) -> Image.Image:
    img = Image.new("RGB", (W, H), BG)
    draw = ImageDraw.Draw(img)

    font_brand = load_font(True, 52)
    font_pool = load_font(False, 26)
    font_date = load_font(True, 36)
    font_row_time = load_font(True, 32)
    font_row_lanes = load_font(False, 26)
    font_foot = load_font(False, 20)
    font_empty = load_font(False, 30)

    margin_x = 56
    top_y = 44

    draw.text((margin_x, top_y), "STARZ Pasienky", fill=FG, font=font_brand)
    pool_label = schedule.get("pool", "50 m bazén")
    draw.text((margin_x, top_y + 62), pool_label, fill=MUTED, font=font_pool)

    date_obj = dt.date.fromisoformat(today_iso)
    weekday = WEEKDAYS_SK[date_obj.weekday()]
    date_str = f"{weekday} {date_obj.day}. {date_obj.month}. {date_obj.year}"
    tw = draw.textlength(date_str, font=font_date)
    draw.text((W - margin_x - tw, top_y + 10), date_str, fill=ACCENT, font=font_date)

    div_y = top_y + 118
    draw.line([(margin_x, div_y), (W - margin_x, div_y)], fill=(30, 41, 59), width=2)

    body_y = div_y + 24
    foot_y = H - 52
    body_bottom = foot_y - 16

    day = next((d for d in schedule.get("days", []) if d.get("date") == today_iso), None)

    if not day:
        draw.text((margin_x, body_y + 80),
                  "Pre dnešok nie je v rozvrhu záznam.",
                  fill=MUTED, font=font_empty)
    else:
        blocks = collapse_blocks(
            day["free"],
            schedule.get("slotMinutes", 15),
            to_min(schedule.get("dayStart", "05:00")),
        )
        max_lanes = schedule.get("maxLanes", 8)
        if not blocks:
            draw.text((margin_x, body_y + 80),
                      "Dnes nie sú verejné bloky.",
                      fill=MUTED, font=font_empty)
        else:
            draw_blocks(draw, blocks, max_lanes, body_y, body_bottom, margin_x,
                        font_row_time, font_row_lanes)

    draw.text((margin_x, foot_y), "dscibrany.github.io/starzpools",
              fill=MUTED, font=font_foot)
    updated = schedule.get("updated")
    if updated:
        right = f"Dáta: {updated}"
        tw = draw.textlength(right, font=font_foot)
        draw.text((W - margin_x - tw, foot_y), right, fill=MUTED, font=font_foot)

    return img


def draw_blocks(draw, blocks, max_lanes, body_y, body_bottom, margin_x,
                font_time, font_lanes):
    row_h = 46
    overflow_h = 36
    available = body_bottom - body_y
    # Reserve space for "+ N more" line only if overflow actually happens.
    max_rows = available // row_h
    if len(blocks) > max_rows:
        max_rows = max(1, (available - overflow_h) // row_h)

    visible = blocks[:max_rows]
    for i, b in enumerate(visible):
        y = body_y + i * row_h
        lvl = level_for(b["lanes"], max_lanes)
        color = LANE_COLORS.get(lvl, LANE_COLORS[0])

        draw.rounded_rectangle(
            [(margin_x, y + 6), (margin_x + 12, y + row_h - 6)],
            radius=4, fill=color,
        )

        time_text = f"{fmt_min(b['start'])} – {fmt_min(b['end'])}"
        draw.text((margin_x + 28, y + 2), time_text, fill=FG, font=font_time)

        length_min = b["end"] - b["start"]
        lh, lm = divmod(length_min, 60)
        len_str = f"{lh} h {lm} min" if lh and lm else (f"{lh} h" if lh else f"{lm} min")

        lanes_word = "dráha" if b["lanes"] == 1 else (
            "dráhy" if 2 <= b["lanes"] <= 4 else "dráh"
        )
        lanes_text = f"{b['lanes']} {lanes_word} · {len_str}"
        tw = draw.textlength(lanes_text, font=font_lanes)
        draw.text((W - margin_x - tw, y + 8), lanes_text, fill=color, font=font_lanes)

    remaining = len(blocks) - len(visible)
    if remaining > 0:
        y = body_y + len(visible) * row_h
        more = f"+ {remaining} ďalších blokov"
        draw.text((margin_x, y + 2), more, fill=MUTED, font=font_lanes)


def main() -> int:
    if not SCHEDULE_PATH.exists():
        print(f"no {SCHEDULE_PATH.name}, skipping", file=sys.stderr)
        return 0
    schedule = json.loads(SCHEDULE_PATH.read_text(encoding="utf-8"))
    today_iso = dt.date.today().isoformat()
    img = render(schedule, today_iso)
    img.save(OUT_PATH, "PNG", optimize=True)
    print(f"wrote {OUT_PATH.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
