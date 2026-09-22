#!/usr/bin/env python3
"""Validate the SAME original M11.5 causal-DAG source test across four real
Rust implementations. Never substitute a simpler M27 sender-shape probe for
this separately labelled original constructed-DAG test.
"""
import argparse
import json
from pathlib import Path
import sys

from cbc_cross_fork_probe import TARGETS, canonical, sha, sha_file
from cbc_cross_fork_causal_probe import SCHEMA, M11_PIN, TEST_TARGET, TEST_NAME


def combine(evidence_dir, original_test):
    root = Path(evidence_dir)
    test = Path(original_test).read_bytes()
    expected_test_hash = sha(test)
    rows = []
    for label in sorted(TARGETS):
        folder = root / ("causal-" + label)
        record = json.loads((folder / "record.json").read_text(encoding="utf-8"))
        seal = record.pop("record_sha256", None)
        if seal != sha(canonical(record)):
            raise ValueError("Tampered causal evidence record for " + label)
        record["record_sha256"] = seal
        repository, expected_source = TARGETS[label]
        expected = {
            "schema": SCHEMA,
            "target": label,
            "repository": repository,
            "source_sha": expected_source,
            "producer_repository": "aixaria0/RCHAIN-COMPLIER",
            "original_probe_source_sha": M11_PIN,
            "original_causal_test_sha256": expected_test_hash,
            "cargo_command": [
                "cargo", "test", "-p", "rchain-block-storage", "--test",
                TEST_TARGET, TEST_NAME, "--", "--nocapture", "--test-threads=1",
            ],
            "exit_code": 0,
            "observed_assertions_passed": True,
        }
        for field, value in expected.items():
            if record.get(field) != value:
                raise ValueError("Wrong " + field + " in causal test of " + label)
        stored = {
            "original_causal_test_sha256": "original-m11-5-causal-test.rs",
            "original_finalizer_sha256": "production-finalizer.rs",
            "source_cargo_lock_sha256": "source-Cargo.lock",
            "effective_cargo_lock_sha256": "effective-Cargo.lock",
            "stdout_sha256": "stdout.log",
            "stderr_sha256": "stderr.log",
        }
        for field, filename in stored.items():
            if sha_file(folder / filename) != record.get(field):
                raise ValueError("Tampered " + filename + " for " + label)
        original_lock = (folder / "source-Cargo.lock").read_bytes()
        effective_lock = (folder / "effective-Cargo.lock").read_bytes()
        if record.get("cargo_lock_modified") != (original_lock != effective_lock):
            raise ValueError("Misreported dependency-graph change for " + label)
        stdout = (folder / "stdout.log").read_text(encoding="utf-8", errors="replace")
        if not (("test " + TEST_NAME + " ... ok") in stdout
                and "test result: ok. 1 passed; 0 failed" in stdout):
            raise ValueError("Missing actual Rust causal-DAG test success for " + label)
        rows.append(record)
    body = {
        "schema": "aria-cbc-original-m11-causal-four-implementation/v1",
        "originalTestSource": "aixaria0/RCHAIN-COMPLIER@" + M11_PIN +
                              ":scripts/upstream/m11-5-duplicate-minimum-messages.rs",
        "identicalOriginalCausalTestSha256": expected_test_hash,
        "targets": rows,
        "allFourOriginalCausalTestsPassed": True,
        "observedCausalDagResults": {
            record["target"]: {
                "original_m11_5_assertions_passed": record["observed_assertions_passed"],
                "source_sha": record["source_sha"],
                "production_finalizer_sha256": record["original_finalizer_sha256"],
                "resolved_dependency_lock_sha256": record["effective_cargo_lock_sha256"],
            }
            for record in rows
        },
        "scope": "Same original source-level M11.5 hand-constructed multi-layer DAG test compiled against each pinned real RChain Finalizer. It asserts count-only duplicate minimum admission, three next-layer sender keys and that a new local fringe advances.",
        "limitations": [
            "This M11.5 constructed DAG is distinct from the exact first M27 source-reported top-layer witness; passing it does not reproduce that full M27 candidate.",
            "Source-level Finalizer success does not imply wire-valid block ingress, full Casper validation, conflicting finality, live-node reachability or a remotely exploitable defect.",
            "A four-of-four observed match cannot establish a comparative winner or general superiority of any implementation.",
            "The test is temporarily copied into disposable local checkouts, and retains original source and effective dependency hashes; no third-party GitHub repository is modified.",
        ],
    }
    return {**body, "reportSha256": sha(canonical(body))}


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--input-dir", required=True)
    p.add_argument("--test-source", required=True)
    p.add_argument("--output", required=True)
    args = p.parse_args()
    try:
        result = combine(args.input_dir, args.test_source)
        out = Path(args.output)
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
        print(json.dumps({
            "result": "FOUR_REAL_FINALIZERS_PASSED_ORIGINAL_CONSTRUCTED_CAUSAL_DAG",
            "targets": {entry["target"]: entry["source_sha"] for entry in result["targets"]},
            "sameOriginalRustTestSha256": result["identicalOriginalCausalTestSha256"],
            "boundary": "M11_SOURCE_LEVEL_CAUSAL_DAG_NOT_SELECTED_M27_OR_LIVE_NODE",
        }))
        return 0
    except (OSError, KeyError, ValueError, TypeError, json.JSONDecodeError) as error:
        print("Causal-DAG evidence rejected: " + str(error), file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
