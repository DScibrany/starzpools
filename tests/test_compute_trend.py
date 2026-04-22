"""Unit tests for scripts/compute_trend.py holiday filter.

The git-log ingestion path is mocked — we only verify that dates listed
in pricing.json.holidays are excluded from the per-weekday aggregation
and surface under holidayDatesExcluded in the output.
"""
from __future__ import annotations

import sys
import unittest
from pathlib import Path
from unittest.mock import patch

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))

import compute_trend  # noqa: E402


def _schedule(days):
    return {
        "maxLanes": 4,
        "dayStart": "05:00",
        "dayEnd": "24:00",
        "slotMinutes": 15,
        "days": days,
    }


class TestHolidayFilter(unittest.TestCase):
    def _fake_show(self, workbook_25m, workbook_50m):
        def fake(sha, path):
            return workbook_25m if path == "schedule.json" else workbook_50m
        return fake

    def test_excludes_holiday_dates_from_average(self):
        non_hol = {"date": "2026-04-21", "weekday": "utorok", "free": [4, 4, 4]}
        hol = {"date": "2026-04-22", "weekday": "streda", "free": [0, 0, 0]}
        workbook_25m = _schedule([non_hol, hol])
        workbook_50m = _schedule([non_hol, hol])

        with patch.object(compute_trend, "git_commits", return_value=["fakesha"]):
            with patch.object(
                compute_trend, "git_show_json",
                side_effect=self._fake_show(workbook_25m, workbook_50m),
            ):
                with patch.object(
                    compute_trend, "load_holidays",
                    return_value={"2026-04-22"},
                ):
                    result = compute_trend.compute(weeks=1)

        self.assertEqual(result["totalObservations"], 2)
        self.assertEqual(result["holidayDatesExcluded"], ["2026-04-22"])

        p25 = result["pools"]["25m"]["byWeekday"]
        self.assertIn("utorok", p25)
        self.assertEqual(p25["utorok"]["avg"], [4.0, 4.0, 4.0])
        self.assertNotIn("streda", p25)

    def test_no_holidays_keeps_all_dates(self):
        day = {"date": "2026-04-22", "weekday": "streda", "free": [2, 2]}
        workbook = _schedule([day])

        with patch.object(compute_trend, "git_commits", return_value=["fakesha"]):
            with patch.object(
                compute_trend, "git_show_json",
                side_effect=self._fake_show(workbook, workbook),
            ):
                with patch.object(
                    compute_trend, "load_holidays", return_value=set(),
                ):
                    result = compute_trend.compute(weeks=1)

        self.assertEqual(result["holidayDatesExcluded"], [])
        self.assertEqual(result["totalObservations"], 2)
        self.assertIn("streda", result["pools"]["25m"]["byWeekday"])

    def test_load_holidays_handles_missing_pricing(self):
        with patch.object(compute_trend, "PRICING_PATH", Path("/nonexistent/pricing.json")):
            self.assertEqual(compute_trend.load_holidays(), set())

    def test_load_holidays_handles_malformed_pricing(self, tmp=None):
        import tempfile
        with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False) as f:
            f.write("not valid json")
            path = Path(f.name)
        try:
            with patch.object(compute_trend, "PRICING_PATH", path):
                self.assertEqual(compute_trend.load_holidays(), set())
        finally:
            path.unlink()


if __name__ == "__main__":
    unittest.main()
