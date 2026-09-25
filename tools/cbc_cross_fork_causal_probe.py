#!/usr/bin/env python3
"""Execute the original read-only PR #16 M11.5 causal-DAG test against a pinned
Rust Finalizer checkout. This fixture is NOT the selected M27 top-layer witness
and does not reproduce live RNode block ingress or a deployed-network exploit.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys

from cbc_cross_fork_probe import TARGETS, canonical, sha, sha_file

M11_PIN = "2d2c3d879b1a078693c8551385efb54a811d7172"
SCHEMA = "aria-cbc-m11-causal-four-implementation/v1"
TEST_NAME = "upstream_m11_5_duplicate_minimum_messages_pass_count_gate_and_finalize"
TEST_TARGET = "aria_cbc_m11_causal"


def git_sha(path):
    return subprocess.run(["git", "rev-parse", "HEAD"], cwd=path, text=True,
                          capture_output=True, check=True, timeout=20).stdout.strip()


def run(target, checkout, pinned_harness, out_dir):
    repo, pin = TARGETS[target]
    checkout = Path(checkout).resolve()
    pinned_harness = Path(pinned_harness).resolve()
    output = Path(out_dir).resolve()
    output.mkdir(parents=True, exist_ok=True)
    if git_sha(checkout) != pin or git_sha(pinned_harness) != M11_PIN:
        raise ValueError("Target or original causal-DAG test is not pinned")
    dirty = subprocess.run(["git", "status", "--porcelain"], cwd=checkout,
                           capture_output=True, text=True, check=True, timeout=20)
    if dirty.stdout.strip():
        raise ValueError("Target must be a clean, unmodified checkout")
    production = checkout / "block-storage/src/dag/finalizer.rs"
    original = production.read_bytes()
    test = (pinned_harness / "scripts/upstream/m11-5-duplicate-minimum-messages.rs").read_bytes()
    if not original or b"upstream_m11_5_duplicate_minimum_messages" not in test:
        raise ValueError("Missing original Finalizer implementation or causal test")
    lockfile = checkout / "Cargo.lock"
    lock = lockfile.read_bytes()
    (output / "production-finalizer.rs").write_bytes(original)
    (output / "source-Cargo.lock").write_bytes(lock)
    (output / "original-m11-5-causal-test.rs").write_bytes(test)
    integration = checkout / "block-storage/tests" / (TEST_TARGET + ".rs")
    integration.parent.mkdir(parents=True, exist_ok=True)
    if integration.exists():
        raise ValueError("Injection would overwrite a pre-existing test")
    integration.write_bytes(test)
    command = ["cargo", "test", "-p", "rchain-block-storage", "--test", TEST_TARGET,
               TEST_NAME, "--", "--nocapture", "--test-threads=1"]
    result = subprocess.run(command, cwd=checkout, capture_output=True,
                            timeout=2400, check=False, env=dict(os.environ))
    (output / "stdout.log").write_bytes(result.stdout)
    (output / "stderr.log").write_bytes(result.stderr)
    effective_lock = lockfile.read_bytes()
    (output / "effective-Cargo.lock").write_bytes(effective_lock)
    stdout = result.stdout.decode("utf-8", "replace")
    observed_test_pass = (result.returncode == 0
                          and ("test " + TEST_NAME + " ... ok") in stdout
                          and "test result: ok. 1 passed; 0 failed" in stdout)
    record_body = {
        "schema": SCHEMA,
        "target": target,
        "repository": repo,
        "source_sha": pin,
        "producer_repository": "aixaria0/RCHAIN-COMPLIER",
        "original_probe_source_sha": M11_PIN,
        "original_causal_test_sha256": sha(test),
        "original_finalizer_sha256": sha(original),
        "source_cargo_lock_sha256": sha(lock),
        "effective_cargo_lock_sha256": sha(effective_lock),
        "cargo_lock_modified": lock != effective_lock,
        "cargo_command": command,
        "stdout_sha256": sha(result.stdout),
        "stderr_sha256": sha(result.stderr),
        "exit_code": result.returncode,
        "observed_assertions_passed": observed_test_pass,
        "case": "M11.5 hand-constructed, multi-layer causal DAG with two distinct v0 messages and missing fourth validator; upstream Finalizer count gate and new-fringe assertions.",
        "claim_boundary": "Source-level hand-constructed M11.5 DAG, not the first M27 top-layer witness, not a wire-valid RNode admission proof, not conflicting finality or deployed-network exploit evidence.",
    }
    record = {**record_body, "record_sha256": sha(canonical(record_body))}
    (output / "record.json").write_text(json.dumps(record, indent=2) + "\n", encoding="utf-8")
    return record


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--target", required=True, choices=TARGETS)
    p.add_argument("--checkout", required=True)
    p.add_argument("--pinned-harness", required=True)
    p.add_argument("--out-dir", required=True)
    a = p.parse_args()
    try:
        record = run(a.target, a.checkout, a.pinned_harness, a.out_dir)
        print(json.dumps({
            "target": record["target"], "source_sha": record["source_sha"],
            "exit_code": record["exit_code"], "causal_test_passed": record["observed_assertions_passed"],
            "original_m11_test_sha256": record["original_causal_test_sha256"],
            "boundary": "HAND_CONSTRUCTED_CAUSAL_DAG_NOT_SELECTED_M27_OR_LIVE_NODE",
        }))
        return 0 if record["observed_assertions_passed"] else 1
    except (OSError, ValueError, KeyError, subprocess.SubprocessError) as exc:
        print("Causal-dag probe failed: " + str(exc), file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
