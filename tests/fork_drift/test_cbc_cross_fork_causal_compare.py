"""Offline anti-forgery tests for original M11.5 multi-layer causal-DAG comparison."""
import json
import pathlib
import sys
import tempfile
import unittest

TOOLS = pathlib.Path(__file__).resolve().parents[2] / "tools"
sys.path.insert(0, str(TOOLS))
from cbc_cross_fork_probe import TARGETS, canonical, sha
from cbc_cross_fork_causal_probe import SCHEMA, M11_PIN, TEST_TARGET, TEST_NAME
from cbc_cross_fork_causal_compare import combine


class OriginalCausalComparisonContract(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = pathlib.Path(self.temp.name)
        self.probe = self.root / "original-M11.rs"
        self.probe.write_bytes(b"// exact original causal-DAG test source fixture")
        self.evidence = self.root / "evidence"
        self.evidence.mkdir()

    def target(self, name):
        path = self.evidence / ("causal-" + name)
        path.mkdir(exist_ok=True)
        original = b"// real production Finalizer bytes"
        lock = b"original Cargo lock"
        stdout = (f"running 1 test\ntest {TEST_NAME} ... ok\n\n"
                  "test result: ok. 1 passed; 0 failed; 0 ignored; 0 measured\n").encode()
        outputs = {
            "original-m11-5-causal-test.rs": self.probe.read_bytes(),
            "production-finalizer.rs": original,
            "source-Cargo.lock": lock,
            "effective-Cargo.lock": lock,
            "stdout.log": stdout,
            "stderr.log": b"",
        }
        for filename, data in outputs.items():
            (path / filename).write_bytes(data)
        repo, source_sha = TARGETS[name]
        body = {
            "schema": SCHEMA,
            "target": name,
            "repository": repo,
            "source_sha": source_sha,
            "producer_repository": "aixaria0/RCHAIN-COMPLIER",
            "original_probe_source_sha": M11_PIN,
            "original_causal_test_sha256": sha(self.probe.read_bytes()),
            "original_finalizer_sha256": sha(original),
            "source_cargo_lock_sha256": sha(lock),
            "effective_cargo_lock_sha256": sha(lock),
            "cargo_lock_modified": False,
            "cargo_command": ["cargo", "test", "-p", "rchain-block-storage", "--test",
                              TEST_TARGET, TEST_NAME, "--", "--nocapture", "--test-threads=1"],
            "stdout_sha256": sha(stdout), "stderr_sha256": sha(b""),
            "exit_code": 0,
            "observed_assertions_passed": True,
            "case": "multi-layer causal DAG test",
            "claim_boundary": "source-level only",
        }
        (path / "record.json").write_text(json.dumps({
            **body, "record_sha256": sha(canonical(body)),
        }))
        return path

    def all_targets(self):
        for name in TARGETS:
            self.target(name)

    def test_requires_all_four_exact_original_source_successes(self):
        self.all_targets()
        report = combine(self.evidence, self.probe)
        self.assertTrue(report["allFourOriginalCausalTestsPassed"])
        self.assertEqual(len(report["targets"]), 4)
        self.assertEqual(set(report["observedCausalDagResults"]), set(TARGETS))

    def test_missing_fourth_target_rejected(self):
        self.target("community")
        with self.assertRaises(FileNotFoundError):
            combine(self.evidence, self.probe)

    def test_failure_rejected_even_if_record_resealed(self):
        self.all_targets()
        path = self.evidence / "causal-nzpr" / "record.json"
        record = json.loads(path.read_text())
        record["exit_code"] = 101
        record["observed_assertions_passed"] = False
        record["record_sha256"] = sha(canonical({
            k: v for k, v in record.items() if k != "record_sha256"
        }))
        path.write_text(json.dumps(record))
        with self.assertRaisesRegex(ValueError, "exit_code"):
            combine(self.evidence, self.probe)

    def test_changed_original_rust_test_rejected(self):
        self.all_targets()
        (self.evidence / "causal-bill_kunj" / "original-m11-5-causal-test.rs").write_bytes(b"other code")
        with self.assertRaisesRegex(ValueError, "Tampered original-m11"):
            combine(self.evidence, self.probe)

    def test_forged_stdout_rejected(self):
        self.all_targets()
        (self.evidence / "causal-shplarggle" / "stdout.log").write_bytes(b"fake pass")
        with self.assertRaisesRegex(ValueError, "Tampered stdout"):
            combine(self.evidence, self.probe)


if __name__ == "__main__":
    unittest.main()
