#!/usr/bin/env python3
"""Compute rolling occupancy trend from git history of schedule*.json.

For every snapshot (commit) in the last N weeks we load
`schedule.json` (25 m) and `schedule-50m.json` (50 m) at that commit,
and record each `(pool, date) -> free[]` once using the MOST RECENT
snapshot that contained that date. Dates listed in
`pricing.json.holidays` are excluded so that holiday-specific opening
hours don't skew the per-weekday averages. We then average
`free[slotIdx]` across all recorded dates grouped by weekday.

Output: `trend.json` at the repo root.
"""
from __future__ import annotations

import json
import subprocess
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

POOLS = {"25m": "schedule.json", "50m": "schedule-50m.json"}
DEFAULT_WEEKS = 8
PRICING_PATH = Path("pricing.json")


def load_holidays() -> set[str]:
    """Return the set of ISO dates declared as holidays in pricing.json.

    Falls back to an empty set when pricing.json is missing or malformed
    so the script stays functional on fresh checkouts / partial data.
    """
    try:
        pricing = json.loads(PRICING_PATH.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return set()
    holidays = pricing.get("holidays")
    if not isinstance(holidays, list):
        return set()
    return {h for h in holidays if isinstance(h, str)}


def git_commits(paths: list[str], weeks: int) -> list[str]:
    since = (datetime.now(timezone.utc) - timedelta(weeks=weeks)).isoformat()
    # newest-first
    result = subprocess.run(
        ["git", "log", f"--since={since}", "--format=%H", "--", *paths],
        capture_output=True,
        text=True,
        check=True,
    )
    return [line for line in result.stdout.splitlines() if line.strip()]


def git_show_json(sha: str, path: str):
    try:
        out = subprocess.run(
            ["git", "show", f"{sha}:{path}"],
            capture_output=True,
            text=True,
            check=True,
        ).stdout
        return json.loads(out)
    except (subprocess.CalledProcessError, json.JSONDecodeError):
        return None


def compute(weeks: int = DEFAULT_WEEKS) -> dict:
    commits = git_commits(list(POOLS.values()), weeks)
    holidays = load_holidays()
    # (pool, date_iso) -> (weekday, free[])
    observations: dict[tuple[str, str], tuple[str, list]] = {}
    pool_meta: dict[str, dict] = {}
    skipped_holiday_dates: set[str] = set()

    for sha in commits:  # already newest-first
        for pool, path in POOLS.items():
            data = git_show_json(sha, path)
            if not isinstance(data, dict):
                continue
            days = data.get("days")
            if not isinstance(days, list):
                continue
            if pool not in pool_meta:
                pool_meta[pool] = {
                    "maxLanes": data.get("maxLanes"),
                    "dayStart": data.get("dayStart", "05:00"),
                    "dayEnd": data.get("dayEnd", "24:00"),
                    "slotMinutes": data.get("slotMinutes", 15),
                }
            for day in days:
                iso = day.get("date")
                wd = day.get("weekday")
                free = day.get("free")
                if not iso or not wd or not isinstance(free, list):
                    continue
                if iso in holidays:
                    skipped_holiday_dates.add(iso)
                    continue
                key = (pool, iso)
                if key in observations:
                    continue
                observations[key] = (wd, free)

    # Aggregate per (pool, weekday)
    aggregated: dict[str, dict[str, dict]] = {}
    for (pool, _iso), (wd, free) in observations.items():
        by_wd = aggregated.setdefault(pool, {})
        bucket = by_wd.setdefault(wd, {"sums": [], "counts": [], "samples": 0})
        # grow buckets if new file has more slots than previous
        n = len(free)
        if len(bucket["sums"]) < n:
            bucket["sums"].extend([0.0] * (n - len(bucket["sums"])))
            bucket["counts"].extend([0] * (n - len(bucket["counts"])))
        for i, v in enumerate(free):
            if isinstance(v, (int, float)):
                bucket["sums"][i] += float(v)
                bucket["counts"][i] += 1
        bucket["samples"] += 1

    result_pools: dict[str, dict] = {}
    for pool, by_wd in aggregated.items():
        by_weekday = {}
        for wd, bucket in by_wd.items():
            avg = [
                round(s / c, 2) if c > 0 else 0.0
                for s, c in zip(bucket["sums"], bucket["counts"])
            ]
            by_weekday[wd] = {"avg": avg, "samples": bucket["samples"]}
        result_pools[pool] = {
            **pool_meta.get(pool, {}),
            "byWeekday": by_weekday,
        }

    return {
        "updated": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        "windowWeeks": weeks,
        "totalObservations": len(observations),
        "holidayDatesExcluded": sorted(skipped_holiday_dates),
        "pools": result_pools,
    }


def main() -> int:
    weeks = DEFAULT_WEEKS
    if len(sys.argv) > 1:
        try:
            weeks = int(sys.argv[1])
        except ValueError:
            pass
    trend = compute(weeks=weeks)
    out = Path("trend.json")
    out.write_text(json.dumps(trend, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    pools_count = len(trend.get("pools", {}))
    obs = trend.get("totalObservations", 0)
    excluded = len(trend.get("holidayDatesExcluded", []))
    excl_note = f", {excluded} holiday date(s) excluded" if excluded else ""
    print(
        f"Wrote {out} — {pools_count} pool(s), {obs} unique date observations, "
        f"window={weeks}w{excl_note}"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
