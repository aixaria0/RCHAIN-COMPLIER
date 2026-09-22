#!/usr/bin/env python3
"""Fail-closed four-implementation CBC Finalizer observation comparison.

This is a uniform, reduced admission-gate test, not identical M27 causal DAG
replay, upstream fix validation, deployed network attack, or performance ranking.
"""
import argparse
import hashlib
import json
from pathlib import Path
import sys

from cbc_cross_fork_probe import (TARGETS, SCHEMA, canonical, sha,
                                  validated_fixture, parse_observation)

RESULT_SCHEMA = "aria-cbc-four-implementation-differential/v1"
FILES = {
    "stdout_sha256": "stdout.log",
    "stderr_sha256": "stderr.log",
    "original_finalizer_sha256": "production-finalizer.rs",
    "injected_test_sha256": "injected-probe.rs",
    "original_cargo_lock_sha256": "source-Cargo.lock",
    "effective_cargo_lock_sha256": "effective-Cargo.lock",
}


def verify_record(target, path, fixture, fixture_sha, probe_sha):
    source = Path(path)
    record = json.loads((source / "record.json").read_text(encoding="utf-8"))
    record_digest = record.pop("record_sha256", None)
    if sha(canonical(record)) != record_digest:
        raise ValueError("Tampered record digest: " + target)
    record["record_sha256"] = record_digest
    repo, pin = TARGETS[target]
    expected = {
        "schema": SCHEMA, "target": target, "repository": repo,
        "source_sha": pin, "exit_code": 0,
        "fixture_transport_sha256": fixture["payloadSha256"],
        "fixture_file_sha256": fixture_sha,
        "injected_test_sha256": probe_sha,
    }
    for key, expected_value in expected.items():
        if record.get(key) != expected_value:
            raise ValueError("Invalid " + key + ": " + target)
    if record.get("cargo_command") != [
        "cargo", "test", "-p", "rchain-block-storage",
        "aria_cbc_differential_v1::identical_four_entry_bonded_sender_admission_fixture",
        "--", "--nocapture", "--test-threads=1"
    ]:
        raise ValueError("Different test command: " + target)
    for field, filename in FILES.items():
        if sha((source / filename).read_bytes()) != record.get(field):
            raise ValueError("Tampered evidence bytes (" + filename + "): " + target)
    before = (source / "source-Cargo.lock").read_bytes()
    after = (source / "effective-Cargo.lock").read_bytes()
    if record.get("cargo_lock_modified") != (before != after):
        raise ValueError("Incorrect lockfile-resolution disclosure: " + target)
    probe = (source / "injected-probe.rs").read_bytes()
    prod = (source / "production-finalizer.rs").read_bytes()
    effective = sha(prod + b"\n" + probe + b"\n")
    if record.get("effective_test_finalizer_sha256") != effective:
        raise ValueError("Injected Finalizer does not match original plus identical probe")
    observation = parse_observation(
        (source / "stdout.log").read_bytes().decode("utf-8", "replace")
    )
    if observation != record.get("rust_observation"):
        raise ValueError("Forged Rust observation: " + target)
    if observation["fixture_sha256"] != fixture["payloadSha256"]:
        raise ValueError("Fixture mismatch: " + target)
    return record


def combine(root, fixture_path, probe_path):
    root = Path(root)
    fixture_path = Path(fixture_path)
    fixture = json.loads(fixture_path.read_text(encoding="utf-8"))
    validated_fixture(fixture)
    fixture_sha = sha(fixture_path.read_bytes())
    probe_sha = sha(Path(probe_path).read_bytes())
    records = [
        verify_record(target, root / ("target-" + target),
                      fixture, fixture_sha, probe_sha)
        for target in sorted(TARGETS)
    ]
    columns = ("control_count_gate", "control_sender_count", "control_local_fringe",
               "duplicate_count_gate", "duplicate_sender_count", "duplicate_local_fringe")
    observations = {
        column: {record["target"]: record["rust_observation"][column]
                 for record in records}
        for column in columns
    }
    differing_fields = [
        key for key, values in observations.items()
        if len(set(values.values())) > 1
    ]
    equivalent_fields = [
        key for key in columns if key not in differing_fields
    ]
    # This is an observed local admission-gate discrepancy *within a source*,
    # not proof of an exploit, faulty deployed finality or relative code quality.
    local_sender_coverage = {
        record["target"]: {
            "count_gate_passed_with_three_of_four_distinct_bonded_senders":
                record["rust_observation"]["duplicate_count_gate"] is True
                and record["rust_observation"]["duplicate_sender_count"] == 3,
            "local_fringe_advanced_in_reduced_fixture":
                record["rust_observation"]["duplicate_local_fringe"],
        }
        for record in records
    }
    body = {
        "schema": RESULT_SCHEMA,
        "sourceFixtureSchema": fixture["schema"],
        "sourceM27Commit": fixture["source"]["commit"],
        "sourceM27ReportDigest": fixture["sourceReportDigest"],
        "inputTransportSha256": fixture["payloadSha256"],
        "inputFileSha256": fixture_sha,
        "identicalInjectedProbeSha256": probe_sha,
        "protocolPath": "rchain-block-storage::dag::finalizer",
        "scenario": "Four distinct message IDs, with M27-reported one-replacement/three-sender labels on a REDUCED local DAG; control uses four distinct bonded senders; bonds 70/10/10/10.",
        "targets": records,
        "observationsByField": observations,
        "observedDifferingFields": differing_fields,
        "observedEqualFields": equivalent_fields,
        "localCountVsDistinctSenderCoverage": local_sender_coverage,
        "basis": "Actual temporary identical Rust test executed in each immutable checkout's real Finalizer implementation with one source-derived fixture and retained original/finalizer/lockfile/log bytes.",
        "limitations": [
            "The locally constructed four-message DAG is NOT the full M27 reachability-valid or finalizing causal DAG; labels alone transfer from the M27 report.",
            "Local check_min_messages acceptance is not full Casper block validation, finality or deployed-network exploit evidence.",
            "Local fringe flags refer only to the reduced no-parent fixture, not the pinned M27 finalization witness.",
            "A Rust test observation and exact source-revision pin do not authenticate the producer or imply an immutable dependency graph when effective lockfile differs.",
            "No cross-version performance, security superiority or accepted upstream remediation claim; inspect source and raw artifacts for each behavior.",
            "This probe appends identical test-only code to disposable CI checkouts; no third-party repository is modified on GitHub.",
        ],
    }
    return {**body, "reportSha256": sha(canonical(body))}


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--input-dir", required=True)
    p.add_argument("--fixture", required=True)
    p.add_argument("--probe", required=True)
    p.add_argument("--output", required=True)
    a = p.parse_args()
    try:
        report = combine(a.input_dir, a.fixture, a.probe)
        out = Path(a.output)
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        print(json.dumps({
            "result": "FOUR_RUST_IMPLEMENTATIONS_OBSERVED",
            "fixtureSha256": report["inputTransportSha256"],
            "comparedRevisions": {rec["target"]: rec["source_sha"] for rec in report["targets"]},
            "differingObservationFields": report["observedDifferingFields"],
            "sharedObservationFields": report["observedEqualFields"],
            "boundary": "REDUCED_SOURCE_LEVEL_ADMISSION_GATE_ONLY_NOT_FULL_M27_DAG",
        }))
        return 0
    except (OSError, ValueError, KeyError, TypeError, json.JSONDecodeError) as error:
        print("Four-implementation evidence rejected: " + str(error), file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
