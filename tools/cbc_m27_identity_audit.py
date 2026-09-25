#!/usr/bin/env python3
"""Audit first M27 witness ID realizability using *actual* pinned Rust Finalizers.

M27's ordered tuple can repeat the same top-layer message ID; the Rust
Finalizer's public calculate_finalization input is a BTreeSet<Message>.
This test measures where the tuple and set semantics first diverge. It does
not claim the whole M27 DAG was replayed or that the protocol has a bug.
"""
import argparse
import json
import os
from pathlib import Path
import re
import subprocess
import sys
from cbc_cross_fork_probe import TARGETS, canonical, sha, sha_file, validated_fixture

SCHEMA = "aria-cbc-m27-id-realizability-run/v1"
PROBE_TEST = "aria_m27_identity_realizability_v1::selected_tuple_can_enter_actual_unique_justification_set"
EXPECTED_KEYS = ("fixture_sha256", "tuple_entries", "unique_message_ids",
                 "representable_as_four_unique_ids", "post_set_count_gate",
                 "distinct_sender_count")
SENDER_BY_ID = {"a3": "v0", "b3": "v1", "c3": "v2", "d3": "v3"}


def audit_fixture(fixture):
    ids = fixture["justifications"]
    claimed_senders = fixture["senderIds"]
    if len(ids) != 4 or len(claimed_senders) != 4 or any(
            SENDER_BY_ID.get(key) != sender
            for key, sender in zip(ids, claimed_senders)):
        raise ValueError("M27 ID/sender mapping mismatch")
    senders = validated_fixture(fixture)
    unique = len(set(ids))
    if unique != len(set(senders)):
        raise ValueError("M27 fixture maps identities inconsistently")
    return ids, senders


def parse_observation(stdout):
    lines = [line.strip() for line in stdout.splitlines()
             if "ARIA_M27_REALIZABILITY_V1|" in line]
    if len(lines) != 1:
        raise ValueError("Exactly one real Rust ID-realizability marker required")
    tail = lines[0].split("ARIA_M27_REALIZABILITY_V1|", 1)[1]
    parts = [part.split("=", 1) for part in tail.split("|")]
    if any(len(pair) != 2 for pair in parts) or tuple(pair[0] for pair in parts) != EXPECTED_KEYS:
        raise ValueError("Malformed Rust ID-realizability observation")
    result = dict(parts)
    if not re.fullmatch(r"[a-f0-9]{64}", result["fixture_sha256"]):
        raise ValueError("Invalid fixture digest in Rust observation")
    for field in ("tuple_entries", "unique_message_ids", "distinct_sender_count"):
        if result[field] not in ("1", "2", "3", "4"):
            raise ValueError("Unexpected message cardinality")
        result[field] = int(result[field])
    for field in ("representable_as_four_unique_ids", "post_set_count_gate"):
        if result[field] not in ("true", "false"):
            raise ValueError("Malformed Rust boolean")
        result[field] = result[field] == "true"
    return result


def run(target, checkout, fixture_path, probe_path, output):
    repo, expected_sha = TARGETS[target]
    checkout = Path(checkout).resolve()
    output = Path(output).resolve()
    output.mkdir(parents=True, exist_ok=True)
    fixture_path = Path(fixture_path).resolve()
    probe_path = Path(probe_path).resolve()
    fixture = json.loads(fixture_path.read_text(encoding="utf-8"))
    ids, senders = audit_fixture(fixture)
    head = subprocess.run(["git", "rev-parse", "HEAD"], cwd=checkout,
                          capture_output=True, text=True, check=True, timeout=20).stdout.strip()
    if head != expected_sha:
        raise ValueError("Actual checkout does not match pinned " + target)
    dirty = subprocess.run(["git", "status", "--porcelain"], cwd=checkout,
                           capture_output=True, text=True, check=True, timeout=20).stdout
    if dirty.strip():
        raise ValueError("Refusing to append to dirty target source checkout")
    finalizer = checkout / "block-storage/src/dag/finalizer.rs"
    original = finalizer.read_bytes()
    probe = probe_path.read_bytes()
    if not original or b"mod aria_m27_identity_realizability_v1" in original or not probe:
        raise ValueError("Source missing or probe already injected")
    lock = checkout / "Cargo.lock"
    original_lock = lock.read_bytes()
    (output / "source-finalizer.rs").write_bytes(original)
    (output / "injected-identity-probe.rs").write_bytes(probe)
    (output / "source-Cargo.lock").write_bytes(original_lock)
    finalizer.write_bytes(original + b"\n" + probe + b"\n")
    env = dict(os.environ)
    env["ARIA_M27_JUSTIFICATION_IDS"] = ",".join(ids)
    env["ARIA_M27_SENDERS"] = ",".join(senders)
    env["ARIA_M27_FIXTURE_SHA256"] = fixture["payloadSha256"]
    cmd = ["cargo", "test", "-p", "rchain-block-storage",
           PROBE_TEST, "--", "--nocapture", "--test-threads=1"]
    proc = subprocess.run(cmd, cwd=checkout, capture_output=True,
                          timeout=2400, env=env, check=False)
    (output / "stdout.log").write_bytes(proc.stdout)
    (output / "stderr.log").write_bytes(proc.stderr)
    effective_lock = lock.read_bytes()
    (output / "effective-Cargo.lock").write_bytes(effective_lock)
    obs = parse_observation(proc.stdout.decode("utf-8", "replace")) if proc.returncode == 0 else None
    if obs:
        expected = {
            "fixture_sha256": fixture["payloadSha256"],
            "tuple_entries": len(ids),
            "unique_message_ids": len(set(ids)),
            "representable_as_four_unique_ids": len(set(ids)) == 4,
            "post_set_count_gate": len(set(ids)) == 4,
            "distinct_sender_count": len(set(senders)),
        }
        if obs != expected:
            raise ValueError("Actual Rust observation differs from source-derived identity expectation")
    body = {
        "schema": SCHEMA, "target": target, "repository": repo, "source_sha": head,
        "fixture_sha256": fixture["payloadSha256"],
        "fixture_file_sha256": sha_file(fixture_path),
        "probe_sha256": sha(probe),
        "source_finalizer_sha256": sha(original),
        "effective_finalizer_sha256": sha(original + b"\n" + probe + b"\n"),
        "source_cargo_lock_sha256": sha(original_lock),
        "effective_cargo_lock_sha256": sha(effective_lock),
        "cargo_lock_modified": original_lock != effective_lock,
        "command": cmd, "exit_code": proc.returncode,
        "stdout_sha256": sha(proc.stdout), "stderr_sha256": sha(proc.stderr),
        "observation": obs,
        "scope": "Identity cardinality of selected source-reported M27 tuple at actual Rust Finalizer BTreeSet boundary; not complete M27 causal-DAG replay, ingress, finality, or deployed-network vulnerability.",
    }
    record = {**body, "record_sha256": sha(canonical(body))}
    (output / "record.json").write_text(json.dumps(record, indent=2) + "\n", encoding="utf-8")
    return record


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--target", required=True, choices=TARGETS)
    p.add_argument("--checkout", required=True)
    p.add_argument("--fixture", required=True)
    p.add_argument("--probe", required=True)
    p.add_argument("--out-dir", required=True)
    a = p.parse_args()
    try:
        result = run(a.target, a.checkout, a.fixture, a.probe, a.out_dir)
        print(json.dumps({"target": a.target, "source_sha": result["source_sha"],
                          "exit_code": result["exit_code"], "observation": result["observation"],
                          "boundary": "M27_ID_REALIZABILITY_NOT_FULL_DAG"}))
        return 0 if result["exit_code"] == 0 else 1
    except (ValueError, KeyError, OSError, TypeError, subprocess.SubprocessError) as e:
        print("M27 identity audit error: " + str(e), file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
