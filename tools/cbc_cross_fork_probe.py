#!/usr/bin/env python3
"""Run the SAME injected reduced CBC gate probe on four immutable Rust sources.

Never change upstream source repos on GitHub. The temporary local test append
is reported and hashed. The observed count gate and local fringe must not be
pre-labelled a vulnerability, a live attack, or a full M27 DAG replay.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import sys

TARGETS = {
    "community": ("rchain-community/rchain-rust", "7b986ee48cc1c0c09e21543c8ef01f84114d73b6"),
    "shplarggle": ("Shplarggle/rchain-rust", "1470256ecd9d1ce3926754c321f5703ef8f95e1a"),
    "nzpr": ("nzpr/rchain-rust", "0eabfc4a893bc42d1462f05ebb4bb477eabd0ee1"),
    "bill_kunj": ("Bill-Kunj/rchain-rust", "9e667e203861c791aa9349b0351397ccc29f0fc8"),
}
SCHEMA = "aria-cbc-four-implementation-run/v1"
FIELDS = [
    "fixture_sha256", "control_count_gate", "control_sender_count",
    "control_local_fringe", "duplicate_count_gate", "duplicate_sender_count",
    "duplicate_local_fringe",
]


def canonical(obj):
    return json.dumps(obj, sort_keys=True, ensure_ascii=False,
                      separators=(",", ":")).encode("utf-8")


def sha(data):
    return hashlib.sha256(data).hexdigest()


def sha_file(path):
    return sha(Path(path).read_bytes())


def validated_fixture(value):
    if value.get("schema") != "aria-cbc-four-implementation-input/v1":
        raise ValueError("Unsupported shared input schema")
    body = {k: v for k, v in value.items() if k != "payloadSha256"}
    if sha(canonical(body)) != value.get("payloadSha256"):
        raise ValueError("Shared fixture transport digest mismatch")
    src = value["source"]
    if src["commit"] != "2d2c3d879b1a078693c8551385efb54a811d7172":
        raise ValueError("Wrong M27 producer pin")
    if value["bondedStake"] != {"v0": 70, "v1": 10, "v2": 10, "v3": 10}:
        raise ValueError("Different stake distribution")
    labels = value["senderIds"]
    if (len(labels) != 4 or any(x not in ("v0", "v1", "v2", "v3") for x in labels)
            or len(set(labels)) != 3
            or sum(x != y for x, y in zip(labels, ["v0", "v1", "v2", "v3"])) != 1):
        raise ValueError("Expected one replacement and three unique senders")
    if len(value["justifications"]) != 4:
        raise ValueError("Expected four source-reported justifications")
    return labels


def parse_observation(stdout):
    lines = [line.strip() for line in stdout.splitlines() if "ARIA_CBC_DIFF_V1|" in line]
    if len(lines) != 1:
        raise ValueError("Expected exactly one real Rust probe observation")
    marker = lines[0]
    # Cargo's --nocapture reports the raw println line with this stable prefix.
    marker = marker[marker.index("ARIA_CBC_DIFF_V1|"):]
    fields = marker.split("|")[1:]
    if len(fields) != len(FIELDS):
        raise ValueError("Missing/extra probe observation fields")
    pairs = [part.split("=", 1) for part in fields]
    if any(len(part) != 2 for part in pairs) or [p[0] for p in pairs] != FIELDS:
        raise ValueError("Unexpected probe field ordering")
    obs = dict(pairs)
    if not re.fullmatch("[0-9a-f]{64}", obs["fixture_sha256"]):
        raise ValueError("Invalid probe fixture digest")
    for name in ("control_count_gate", "control_local_fringe",
                 "duplicate_count_gate", "duplicate_local_fringe"):
        if obs[name] not in ("true", "false"):
            raise ValueError("Invalid boolean observation")
        obs[name] = obs[name] == "true"
    for name in ("control_sender_count", "duplicate_sender_count"):
        if obs[name] not in ("3", "4"):
            raise ValueError("Invalid sender cardinality")
        obs[name] = int(obs[name])
    if obs["control_sender_count"] != 4 or obs["duplicate_sender_count"] != 3:
        raise ValueError("Unexpected common fixture cardinality")
    return obs


def run(target, checkout, fixture_path, probe_path, out_dir):
    repo, pin = TARGETS[target]
    checkout = Path(checkout).resolve()
    out_dir = Path(out_dir).resolve()
    out_dir.mkdir(parents=True, exist_ok=True)
    fixture = json.loads(Path(fixture_path).read_text(encoding="utf-8"))
    labels = validated_fixture(fixture)
    actual = subprocess.run(["git", "rev-parse", "HEAD"], cwd=checkout,
                            capture_output=True, text=True, check=True, timeout=20).stdout.strip()
    if actual != pin:
        raise ValueError("Wrong immutable target pin: " + target)
    # Reject dirty input, including a previously-injected copy.
    dirty = subprocess.run(["git", "status", "--porcelain"], cwd=checkout,
                           capture_output=True, text=True, check=True, timeout=20).stdout
    if dirty.strip():
        raise ValueError("Target checkout must be clean before injection")
    finalizer = checkout / "block-storage/src/dag/finalizer.rs"
    source = finalizer.read_bytes()
    probe = Path(probe_path).read_bytes()
    if not source or not probe or b"mod aria_cbc_differential_v1" in source:
        raise ValueError("Target missing production source or already contains the probe")
    lock = checkout / "Cargo.lock"
    original_lock = lock.read_bytes()
    (out_dir / "source-Cargo.lock").write_bytes(original_lock)
    (out_dir / "production-finalizer.rs").write_bytes(source)
    (out_dir / "injected-probe.rs").write_bytes(probe)
    finalizer.write_bytes(source + b"\n" + probe + b"\n")
    effective_finalizer_sha = sha_file(finalizer)
    env = dict(os.environ)
    env["ARIA_CBC_M27_SENDERS"] = ",".join(labels)
    env["ARIA_CBC_M27_TRANSPORT_SHA256"] = fixture["payloadSha256"]
    command = ["cargo", "test", "-p", "rchain-block-storage",
               "aria_cbc_differential_v1::identical_four_entry_bonded_sender_admission_fixture",
               "--", "--nocapture", "--test-threads=1"]
    # This command runs the exact SAME Rust source probe against each target's
    # actual Finalizer. The local temporary append is not an upstream patch.
    outcome = subprocess.run(command, cwd=checkout, capture_output=True,
                             timeout=2400, check=False, env=env)
    (out_dir / "stdout.log").write_bytes(outcome.stdout)
    (out_dir / "stderr.log").write_bytes(outcome.stderr)
    (out_dir / "effective-Cargo.lock").write_bytes(lock.read_bytes())
    obs = parse_observation(outcome.stdout.decode("utf-8", "replace")) if outcome.returncode == 0 else None
    if obs is not None and obs["fixture_sha256"] != fixture["payloadSha256"]:
        raise ValueError("Rust probe did not use the identical fixture")
    body = {
        "schema": SCHEMA, "target": target, "repository": repo,
        "source_sha": pin, "cargo_command": command, "exit_code": outcome.returncode,
        "fixture_transport_sha256": fixture["payloadSha256"],
        "fixture_file_sha256": sha_file(fixture_path),
        "injected_test_sha256": sha(probe),
        "original_finalizer_sha256": sha(source),
        "effective_test_finalizer_sha256": effective_finalizer_sha,
        "original_cargo_lock_sha256": sha(original_lock),
        "effective_cargo_lock_sha256": sha_file(lock),
        "cargo_lock_modified": original_lock != lock.read_bytes(),
        "stdout_sha256": sha(outcome.stdout), "stderr_sha256": sha(outcome.stderr),
        "rust_observation": obs,
        "evidence_scope": "Same temporary source-level reduced four-message CBC Finalizer admission-gate fixture, using source-reported M27 sender labels; not full causal M27 DAG, live ingress, performance, safety or finality proof.",
    }
    record = {**body, "record_sha256": sha(canonical(body))}
    (out_dir / "record.json").write_text(json.dumps(record, indent=2) + "\n", encoding="utf-8")
    return record


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--target", choices=TARGETS, required=True)
    p.add_argument("--checkout", required=True)
    p.add_argument("--fixture", required=True)
    p.add_argument("--probe", required=True)
    p.add_argument("--out-dir", required=True)
    a = p.parse_args()
    try:
        record = run(a.target, a.checkout, a.fixture, a.probe, a.out_dir)
        print(json.dumps({"target": a.target, "source_sha": record["source_sha"],
                          "exit_code": record["exit_code"],
                          "fixture_sha256": record["fixture_transport_sha256"],
                          "observation": record["rust_observation"]}))
        return 0 if record["exit_code"] == 0 else 1
    except (ValueError, KeyError, OSError, subprocess.SubprocessError,
            json.JSONDecodeError) as exc:
        print("CBC cross-implementation probe failed: " + str(exc), file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
