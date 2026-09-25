"""Offline regression tests for pinned fork-ancestry reporting."""
import importlib.util
import json
import pathlib
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location("cbc_fork_drift", ROOT / "tools" / "cbc_fork_drift.py")
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

UPSTREAM = "rchain-community/rchain-rust"
FORK = "Shplarggle/rchain-rust"


def fixture(path):
    if path == "/repos/" + UPSTREAM + "/commits/dev":
        return {"sha": "a" * 40}
    if path == "/repos/" + FORK + "/commits/dev":
        return {"sha": "b" * 40}
    if path == "/repos/" + UPSTREAM + "/compare/dev...Shplarggle:dev":
        return {"ahead_by": 2, "behind_by": 7, "status": "diverged",
                "html_url": "https://github.com/rchain-community/rchain-rust/compare/dev...Shplarggle:dev",
                "merge_base_commit": {"sha": "c" * 40}}
    raise AssertionError("Unexpected request: " + path)


class DriftTests(unittest.TestCase):
    def test_direction_and_pins(self):
        entry = module.compare_one(UPSTREAM, FORK, fetch=fixture)
        self.assertEqual(entry["fork_only_commits"], 2)
        self.assertEqual(entry["upstream_only_commits"], 7)
        self.assertEqual(entry["fork_sha"], "b" * 40)
        self.assertEqual(entry["upstream_sha"], "a" * 40)
        self.assertEqual(entry["merge_base_sha"], "c" * 40)

    def test_replay_digest_is_order_independent(self):
        first = module.build_report(UPSTREAM, [FORK], fetch=fixture)
        second = module.build_report(UPSTREAM, [FORK], fetch=fixture)
        self.assertEqual(first, second)
        payload = {key: value for key, value in first.items() if key != "sha256"}
        import hashlib
        canonical = json.dumps(payload, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
        self.assertEqual(first["sha256"], hashlib.sha256(canonical.encode("utf-8")).hexdigest())

    def test_reject_bad_inputs_before_network(self):
        for value in ("", "owner", "owner/repo/extra", "../repo", "owner/re po"):
            with self.subTest(value=value):
                with self.assertRaises(ValueError):
                    module.repository_name(value)
        with self.assertRaises(ValueError):
            module.compare_one(UPSTREAM, UPSTREAM, fetch=fixture)
        with self.assertRaises(ValueError):
            module.compare_one(UPSTREAM, FORK, ref="dev/../../bad", fetch=fixture)
        with self.assertRaises(ValueError):
            module.build_report(UPSTREAM, [FORK, FORK], fetch=fixture)

    def test_fixture_detects_upstream_only_revision(self):
        def linear(path):
            result = fixture(path)
            if "/compare/" in path:
                return {**result, "ahead_by": 0, "behind_by": 200, "status": "behind"}
            return result
        entry = module.compare_one(UPSTREAM, FORK, fetch=linear)
        self.assertEqual(entry["fork_only_commits"], 0)
        self.assertEqual(entry["upstream_only_commits"], 200)
        self.assertEqual(entry["relationship"], "behind")


if __name__ == "__main__":
    unittest.main()
