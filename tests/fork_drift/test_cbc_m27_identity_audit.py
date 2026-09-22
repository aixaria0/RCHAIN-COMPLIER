"""Offline checks: selected M27 tuple must not be silently promoted to a
four-distinct-message Finalizer witness after Rust set deduplication.
"""
import json
import pathlib
import sys
import tempfile
import unittest

TOOLS = pathlib.Path(__file__).resolve().parents[2] / "tools"
sys.path.insert(0, str(TOOLS))
from cbc_cross_fork_probe import canonical, sha, TARGETS
from cbc_m27_identity_audit import audit_fixture, parse_observation
from cbc_m27_identity_compare import combine


def fixture(ids=None):
    ids = ids or ["a3", "a3", "c3", "d3"]
    senders = {"a3": "v0", "b3": "v1", "c3": "v2", "d3": "v3"}
    body = {
        "schema": "aria-cbc-four-implementation-input/v1",
        "source": {"commit": "2d2c3d879b1a078693c8551385efb54a811d7172"},
        "sourceReportDigest": "a" * 64,
        "justifications": ids,
        "senderIds": [senders[x] for x in ids],
        "bondedStake": {"v0": 70, "v1": 10, "v2": 10, "v3": 10},
    }
    return {**body, "payloadSha256": sha(canonical(body))}


class IdentityAuditTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = pathlib.Path(self.tmp.name)
        self.probe = self.root / "probe.rs"
        self.probe.write_bytes(b"// unmodified identical source")
        self.input = self.root / "input.json"
        self.input.write_text(json.dumps(fixture()) + "\n")
        self.evidence = self.root / "evidence"
        self.evidence.mkdir()

    def record(self, target, ids=None):
        ids = ids or ["a3", "a3", "c3", "d3"]
        p = self.evidence / ("identity-" + target)
        p.mkdir(exist_ok=True)
        input_value = json.loads(self.input.read_text())
        probe = self.probe.read_bytes()
        src = b"// independent actual finalizer source snapshot"
        lock = b"original dependency lockfile"
        unique = len(set(ids))
        stdout = (
            "ARIA_M27_REALIZABILITY_V1|fixture_sha256=" + input_value["payloadSha256"] +
            "|tuple_entries=4|unique_message_ids=" + str(unique) +
            "|representable_as_four_unique_ids=" + str(unique == 4).lower() +
            "|post_set_count_gate=" + str(unique == 4).lower() +
            "|distinct_sender_count=" + str(unique) + "\n"
        ).encode()
        output = {
            "stdout.log": stdout, "stderr.log": b"",
            "source-finalizer.rs": src, "injected-identity-probe.rs": probe,
            "source-Cargo.lock": lock, "effective-Cargo.lock": lock,
        }
        for file, payload in output.items():
            (p / file).write_bytes(payload)
        repo, head = TARGETS[target]
        body = {
            "schema": "aria-cbc-m27-id-realizability-run/v1", "target": target,
            "repository": repo, "source_sha": head,
            "fixture_sha256": input_value["payloadSha256"],
            "fixture_file_sha256": sha(self.input.read_bytes()),
            "probe_sha256": sha(probe),
            "source_finalizer_sha256": sha(src),
            "effective_finalizer_sha256": sha(src + b"\n" + probe + b"\n"),
            "source_cargo_lock_sha256": sha(lock), "effective_cargo_lock_sha256": sha(lock),
            "cargo_lock_modified": False,
            "command": ["cargo", "test", "-p", "rchain-block-storage",
                        "aria_m27_identity_realizability_v1::selected_tuple_can_enter_actual_unique_justification_set",
                        "--", "--nocapture", "--test-threads=1"],
            "exit_code": 0,
            "stdout_sha256": sha(stdout), "stderr_sha256": sha(b""),
            "observation": parse_observation(stdout.decode()),
            "scope": "tuple vs set identity audit",
        }
        (p / "record.json").write_text(json.dumps({
            **body, "record_sha256": sha(canonical(body)),
        }))

    def all(self):
        for target in TARGETS: self.record(target)

    def test_duplicated_message_id_is_first_semantic_gap(self):
        ids, labels = audit_fixture(fixture())
        self.assertEqual(ids, ["a3", "a3", "c3", "d3"])
        self.assertEqual(labels, ["v0", "v0", "v2", "v3"])
        self.all()
        report = combine(self.evidence, self.input, self.probe)
        self.assertEqual(report["actualUniqueMessageIds"], 3)
        self.assertFalse(report["firstDivergence"]["canDirectlyReplaySelectedFourEntryTupleInProductionSet"])
        self.assertEqual(report["firstDivergence"]["layer"], "message_identity_to_finalizer_justification_set")
        self.assertEqual(len(report["fourImplementations"]), 4)

    def test_missing_one_actual_implementation_is_not_success(self):
        self.record("community")
        with self.assertRaises(FileNotFoundError):
            combine(self.evidence, self.input, self.probe)

    def test_changed_injected_source_or_stdout_is_rejected(self):
        self.all()
        (self.evidence / "identity-nzpr" / "injected-identity-probe.rs").write_bytes(b"// alternative")
        with self.assertRaisesRegex(ValueError, "Altered"):
            combine(self.evidence, self.input, self.probe)

    def test_full_identity_control_is_not_misidentified_as_selected_three_sender_m27_case(self):
        value = fixture(["a3", "b3", "c3", "d3"])
        with self.assertRaisesRegex(ValueError, "Expected one replacement"):
            audit_fixture(value)

    def test_inconsistent_source_report_is_rejected(self):
        value = fixture()
        value["senderIds"][1] = "v1"
        value["payloadSha256"] = sha(canonical({
            k: v for k, v in value.items() if k != "payloadSha256"
        }))
        with self.assertRaisesRegex(ValueError, "mapping mismatch"):
            audit_fixture(value)


if __name__ == "__main__":
    unittest.main()
