"""Dashboard rendering contract: real-source fields and HTML escaping."""
import pathlib
import sys
import unittest

TOOLS = pathlib.Path(__file__).resolve().parents[2] / "tools"
sys.path.insert(0, str(TOOLS))
import four_repo_evidence as evidence
from render_four_repo_dashboard import render


def report():
    entries = []
    for component, spec in sorted(evidence.SOURCES.items()):
        entries.append(evidence.sealed({
            "schema": evidence.SCHEMA,
            "component": component,
            "repository": spec["repository"],
            "source_sha": spec["sha"],
            "scope": spec["scope"],
            "command": spec["command"],
            "exit_code": 0,
            "stdout_sha256": "a" * 64,
            "stderr_sha256": "b" * 64,
            "stdout_bytes": 0,
            "stderr_bytes": 0,
            "evidence_kind": "source-test-execution",
            "live_network": False,
            "interoperability_verified": False,
            "dependency_lockfile": None,
        }))
    return evidence.sealed({
        "schema": "aria-four-repo-bundle/v1",
        "entries": entries,
        "components_passed": 4,
        "limits": evidence.LIMITS,
    })


class DashboardTests(unittest.TestCase):
    def test_four_real_source_scopes_rendered(self):
        page = render(report())
        for spec in evidence.SOURCES.values():
            self.assertIn(spec["repository"], page)
            self.assertIn(spec["sha"], page)
        self.assertIn("No live-node or cross-protocol correctness", page)
        self.assertIn("Four real repositories", page)

    def test_escaping_untrusted_report_strings(self):
        item = report()
        item["entries"][0]["scope"] = '<script>alert("x")</script>'
        item["entries"][0] = evidence.sealed(
            {k: v for k, v in item["entries"][0].items() if k != "record_sha256"}
        )
        item = evidence.sealed({k: v for k, v in item.items() if k != "record_sha256"})
        page = render(item)
        self.assertNotIn("<script>", page)
        self.assertIn("&lt;script&gt;", page)

    def test_tampered_bundle_rejected(self):
        item = report()
        item["entries"][0]["source_sha"] = "f" * 40
        with self.assertRaisesRegex(ValueError, "Record digest"):
            render(item)

    def test_failed_record_cannot_appear_as_pass(self):
        item = report()
        item["entries"][0]["exit_code"] = 101
        item["entries"][0] = evidence.sealed(
            {k: v for k, v in item["entries"][0].items() if k != "record_sha256"}
        )
        item = evidence.sealed({k: v for k, v in item.items() if k != "record_sha256"})
        with self.assertRaisesRegex(ValueError, "Failed source-test"):
            render(item)


if __name__ == "__main__":
    unittest.main()
