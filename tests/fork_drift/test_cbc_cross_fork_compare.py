"""Offline regression tests for the identical-fixture four-Rust-implementation differential."""
import pathlib
import sys
import tempfile
import unittest
import json

TOOLS = pathlib.Path(__file__).resolve().parents[2] / "tools"
sys.path.insert(0, str(TOOLS))
from cbc_cross_fork_probe import TARGETS, canonical, sha, validated_fixture, parse_observation
from cbc_cross_fork_compare import combine


class DifferentialContractTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = pathlib.Path(self.tmp.name)
        self.fixture = self.root / "comparison-input.json"
        self.probe = self.root / "probe.rs"
        self.probe.write_bytes(b"// identical injected test fixture")
        body = {
            "schema": "aria-cbc-four-implementation-input/v1",
            "source": {"commit": "2d2c3d879b1a078693c8551385efb54a811d7172"},
            "senderIds": ["v0", "v0", "v2", "v3"],
            "bondedStake": {"v0": 70, "v1": 10, "v2": 10, "v3": 10},
            "justifications": ["a3", "a3", "c3", "d3"],
            "sourceReportDigest": "f" * 64,
        }
        self.body = {**body, "payloadSha256": sha(canonical(body))}
        self.fixture.write_text(json.dumps(self.body) + "\n")
        self.evidence = self.root / "evidence"
        self.evidence.mkdir()

    def write_target(self, target, duplicate_gate=True):
        directory = self.evidence / ("target-" + target)
        directory.mkdir(exist_ok=True)
        source = b"// original production source"
        probe = self.probe.read_bytes()
        lock = b"pinned lock data"
        stdout = ("ARIA_CBC_DIFF_V1|fixture_sha256=" + self.body["payloadSha256"] +
                  "|control_count_gate=true|control_sender_count=4|control_local_fringe=false"
                  "|duplicate_count_gate=" + str(duplicate_gate).lower() +
                  "|duplicate_sender_count=3|duplicate_local_fringe=false\n").encode()
        files = {
            "stdout.log": stdout, "stderr.log": b"",
            "production-finalizer.rs": source, "injected-probe.rs": probe,
            "source-Cargo.lock": lock, "effective-Cargo.lock": lock,
        }
        for filename, contents in files.items():
            (directory / filename).write_bytes(contents)
        repo, pin = TARGETS[target]
        body = {
            "schema": "aria-cbc-four-implementation-run/v1", "target": target,
            "repository": repo, "source_sha": pin,
            "cargo_command": [
                "cargo", "test", "-p", "rchain-block-storage",
                "aria_cbc_differential_v1::identical_four_entry_bonded_sender_admission_fixture",
                "--", "--nocapture", "--test-threads=1",
            ],
            "exit_code": 0,
            "fixture_transport_sha256": self.body["payloadSha256"],
            "fixture_file_sha256": sha(self.fixture.read_bytes()),
            "injected_test_sha256": sha(probe),
            "original_finalizer_sha256": sha(source),
            "effective_test_finalizer_sha256": sha(source + b"\n" + probe + b"\n"),
            "original_cargo_lock_sha256": sha(lock), "effective_cargo_lock_sha256": sha(lock),
            "cargo_lock_modified": False,
            "stdout_sha256": sha(stdout), "stderr_sha256": sha(b""),
            "rust_observation": parse_observation(stdout.decode()),
            "evidence_scope": "reduced synthetic source-level fixture",
        }
        record = {**body, "record_sha256": sha(canonical(body))}
        (directory / "record.json").write_text(json.dumps(record) + "\n")

    def write_all(self):
        for target in TARGETS:
            self.write_target(target)

    def test_one_fixture_four_real_source_records_are_required(self):
        self.write_all()
        report = combine(self.evidence, self.fixture, self.probe)
        self.assertEqual(len(report["targets"]), 4)
        self.assertEqual(report["observedDifferingFields"], [])
        self.assertEqual(report["observationsByField"]["duplicate_sender_count"]["nzpr"], 3)
        self.assertTrue(report["localCountVsDistinctSenderCoverage"]["community"][
            "count_gate_passed_with_three_of_four_distinct_bonded_senders"])

    def test_report_records_observed_difference_without_ranking(self):
        self.write_all()
        self.write_target("nzpr", duplicate_gate=False)
        report = combine(self.evidence, self.fixture, self.probe)
        self.assertEqual(report["observedDifferingFields"], ["duplicate_count_gate"])
        self.assertNotIn("winner", report)
        self.assertNotIn("ranking", report)

    def test_forged_fixture_digest_is_rejected(self):
        self.write_all()
        fixture = json.loads(self.fixture.read_text())
        fixture["senderIds"][0] = "v1"
        self.fixture.write_text(json.dumps(fixture))
        with self.assertRaisesRegex(ValueError, "digest mismatch"):
            combine(self.evidence, self.fixture, self.probe)

    def test_missing_implementation_fails_closed(self):
        self.write_target("community")
        with self.assertRaises(FileNotFoundError):
            combine(self.evidence, self.fixture, self.probe)

    def test_altered_test_stdout_fails_closed(self):
        self.write_all()
        (self.evidence / "target-community" / "stdout.log").write_bytes(b"forged pass")
        with self.assertRaisesRegex(ValueError, "Tampered evidence bytes"):
            combine(self.evidence, self.fixture, self.probe)

    def test_changed_injected_probe_is_rejected(self):
        self.write_all()
        path = self.evidence / "target-bill_kunj" / "injected-probe.rs"
        path.write_bytes(b"// a different test was run")
        with self.assertRaisesRegex(ValueError, "Tampered evidence bytes"):
            combine(self.evidence, self.fixture, self.probe)

    def test_resealed_wrong_source_pin_still_rejected(self):
        self.write_all()
        path = self.evidence / "target-shplarggle" / "record.json"
        record = json.loads(path.read_text())
        record["source_sha"] = "f" * 40
        record["record_sha256"] = sha(canonical({
            k: v for k, v in record.items() if k != "record_sha256"
        }))
        path.write_text(json.dumps(record))
        with self.assertRaisesRegex(ValueError, "source_sha"):
            combine(self.evidence, self.fixture, self.probe)


if __name__ == "__main__":
    unittest.main()
