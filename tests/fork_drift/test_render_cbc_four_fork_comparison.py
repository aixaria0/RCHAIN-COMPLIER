"""Offline renderer regressions: source pins, exact common fixture and honest claim boundary."""
import pathlib
import sys
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "tools"))
import test_cbc_cross_fork_compare as contract
from cbc_cross_fork_compare import combine
from cbc_cross_fork_probe import TARGETS, canonical, sha
from render_cbc_four_fork_comparison import render


class ComparisonDashboardTests(unittest.TestCase):
    def setUp(self):
        self.mock = contract.DifferentialContractTests(methodName="test_one_fixture_four_real_source_records_are_required")
        self.mock.setUp()
        self.addCleanup(self.mock.doCleanups)
        self.mock.write_all()
        self.report = combine(self.mock.evidence, self.mock.fixture, self.mock.probe)

    def test_real_four_target_fields_and_bounded_claim_are_visible(self):
        page = render(self.report)
        for repository, pin in TARGETS.values():
            self.assertIn(repository, page)
            self.assertIn(pin, page)
        self.assertIn("No differences in these six observed fields.", page)
        self.assertIn("does not establish block validation, finality, or an exploit", page)
        self.assertIn("source-level CBC Finalizer", page.lower().replace("source-level cbc finalizer", "source-level CBC Finalizer"))

    def test_descriptive_differential_does_not_rank_forks(self):
        self.mock.write_target("nzpr", duplicate_gate=False)
        page = render(combine(self.mock.evidence, self.mock.fixture, self.mock.probe))
        self.assertIn("Different observed fields: duplicate_count_gate", page)
        self.assertNotIn("winner", page)
        self.assertNotIn("best implementation", page)

    def test_tampered_comparison_or_wrong_source_cannot_render(self):
        self.report["targets"][0]["source_sha"] = "f" * 40
        with self.assertRaisesRegex(ValueError, "digest mismatch"):
            render(self.report)
        body = {k: v for k, v in self.report.items() if k != "reportSha256"}
        self.report["reportSha256"] = sha(canonical(body))
        with self.assertRaisesRegex(ValueError, "Unsupported source revision"):
            render(self.report)

    def test_escapes_untrusted_limit_string(self):
        self.report["limitations"].append("<script>alert('x')</script>")
        body = {k: v for k, v in self.report.items() if k != "reportSha256"}
        self.report["reportSha256"] = sha(canonical(body))
        page = render(self.report)
        self.assertNotIn("<script>", page)
        self.assertIn("&lt;script&gt;", page)


if __name__ == "__main__":
    unittest.main()
