"""Offline, no-network acceptance tests for real-source evidence contracts."""
import importlib.util
import json
import pathlib
import subprocess
import tempfile
import unittest
from unittest.mock import patch

MODULE_PATH = pathlib.Path(__file__).resolve().parents[2] / "tools" / "four_repo_evidence.py"
spec = importlib.util.spec_from_file_location("four_repo_evidence", MODULE_PATH)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class FourRepoEvidenceTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = pathlib.Path(self.temp.name)
        self.source = self.root / "source"
        self.source.mkdir()
        (self.source / ".git").mkdir()
        self.artifacts = self.root / "artifacts"

    def record(self, component, exit_code=0):
        source = module.SOURCES[component]
        if "lockfile" in source:
            lock_path = self.source / source["lockfile"]
            lock_path.parent.mkdir(parents=True, exist_ok=True)
            lock_path.write_bytes(b"source-lock")
        def fake_run(args, **kwargs):
            if args == ["git", "rev-parse", "HEAD"]:
                return subprocess.CompletedProcess(args, 0, source["sha"] + "\n", "")
            self.assertEqual(args, source["command"])
            self.assertEqual(kwargs["cwd"], self.source.resolve())
            if "lockfile" in source:
                (self.source / source["lockfile"]).write_bytes(b"effective-lock")
            return subprocess.CompletedProcess(args, exit_code, b"real test output", b"")
        with patch.object(module.subprocess, "run", side_effect=fake_run):
            return module.capture(component, self.source,
                                  self.artifacts / ("component-" + component))

    def four_records(self):
        for component in module.SOURCES:
            self.record(component)

    def test_all_four_pinned_and_sealed(self):
        self.four_records()
        bundle = module.combine(self.artifacts, self.root / "bundle.json")
        self.assertEqual(bundle["components_passed"], 4)
        self.assertEqual(set(x["component"] for x in bundle["entries"]), set(module.SOURCES))
        module.verify_seal(bundle)
        for record in bundle["entries"]:
            module.verify_seal(record)
            self.assertEqual(record["source_sha"], module.SOURCES[record["component"]]["sha"])
            self.assertFalse(record["live_network"])
            self.assertFalse(record["interoperability_verified"])

    def test_missing_source_fails_closed(self):
        self.record("cbc")
        with self.assertRaises(FileNotFoundError):
            module.combine(self.artifacts, self.root / "bundle.json")

    def test_modified_output_fails_closed(self):
        self.four_records()
        path = self.artifacts / "component-sentinel" / "stdout.log"
        path.write_bytes(b"forged output")
        with self.assertRaisesRegex(ValueError, "Tampered stdout"):
            module.combine(self.artifacts, self.root / "bundle.json")

    def test_resealed_forgery_of_source_pin_is_rejected(self):
        self.four_records()
        path = self.artifacts / "component-lattice" / "record.json"
        record = json.loads(path.read_text())
        record["source_sha"] = "f" * 40
        path.write_text(json.dumps(module.sealed({k: v for k, v in record.items()
                                                   if k != "record_sha256"})))
        with self.assertRaisesRegex(ValueError, "Wrong source_sha"):
            module.combine(self.artifacts, self.root / "bundle.json")

    def test_tampered_lockfile_fails_closed(self):
        self.four_records()
        path = self.artifacts / "component-lattice" / "effective-Cargo.lock"
        path.write_bytes(b"substituted-lock")
        with self.assertRaisesRegex(ValueError, "Tampered dependency lockfile"):
            module.combine(self.artifacts, self.root / "bundle.json")

    def test_failed_test_is_rejected(self):
        self.four_records()
        self.record("workbench", exit_code=1)
        with self.assertRaisesRegex(ValueError, "Wrong exit_code"):
            module.combine(self.artifacts, self.root / "bundle.json")

    def test_mismatched_checkout_prevents_execution(self):
        with patch.object(module, "git_head", return_value="f" * 40):
            with patch.object(module.subprocess, "run") as runner:
                with self.assertRaisesRegex(ValueError, "Pinned SHA mismatch"):
                    module.capture("cbc", self.source, self.artifacts)
                runner.assert_not_called()

    def test_repeated_content_gives_same_bundle_digest(self):
        self.four_records()
        left = module.combine(self.artifacts, self.root / "one.json")
        right = module.combine(self.artifacts, self.root / "two.json")
        self.assertEqual(left, right)


if __name__ == "__main__":
    unittest.main()
