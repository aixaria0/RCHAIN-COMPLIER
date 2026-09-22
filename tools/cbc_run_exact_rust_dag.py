#!/usr/bin/env python3
"""Execute the same generated, four-distinct-message Rust DAG test at an exact
pinned RChain Finalizer source revision. Capture failures as failures; do not
infer block ingress, live finality, security, or a comparative winner.
"""
import argparse
import json
import os
from pathlib import Path
import re
import subprocess
import sys
from cbc_cross_fork_probe import TARGETS, sha, sha_file, canonical

TEST_TARGET = "aria_exact_distinct_id_dag"
TEST_NAME = "aria_exact_source_dag_finalizer_observation"
FIELDS = ("graph_sha256", "packet_sha256", "source_message_count",
          "unique_justifications", "minimum_message_ids", "minimum_unique_senders",
          "count_gate", "next_layer_senders", "new_fringe", "new_fringe_ids")
SCHEMA = "aria-cbc-exact-source-dag-rust-observation/v1"


def parse(stdout):
    markers = [line.split("ARIA_EXACT_DAG_V1|", 1)[1].strip()
               for line in stdout.splitlines() if "ARIA_EXACT_DAG_V1|" in line]
    if len(markers) != 1:
        raise ValueError("Expected one real Rust exact-DAG observation")
    fields = [part.split("=", 1) for part in markers[0].split("|")]
    if any(len(pair) != 2 for pair in fields) or tuple(x[0] for x in fields) != FIELDS:
        raise ValueError("Unexpected exact Rust observation fields")
    observation = dict(fields)
    for name in ("graph_sha256", "packet_sha256"):
        if not re.fullmatch(r"[0-9a-f]{64}", observation[name]):
            raise ValueError("Invalid source-graph or packet digest")
    for key in ("source_message_count", "unique_justifications",
                "minimum_unique_senders", "next_layer_senders"):
        observation[key] = int(observation[key])
    for key in ("count_gate", "new_fringe"):
        if observation[key] not in ("true", "false"):
            raise ValueError("Invalid Rust boolean")
        observation[key] = observation[key] == "true"
    observation["minimum_message_ids"] = (
        observation["minimum_message_ids"].split(",") if observation["minimum_message_ids"] else [])
    observation["new_fringe_ids"] = (
        observation["new_fringe_ids"].split(",") if observation["new_fringe_ids"] else [])
    if observation["unique_justifications"] != 4 or (
        observation["new_fringe"] != bool(observation["new_fringe_ids"])):
        raise ValueError("Inconsistent Rust source witness observation")
    return observation


def execute(target, checkout, packet_path, test_source_path, out_dir):
    repo, pin = TARGETS[target]
    checkout = Path(checkout).resolve()
    out = Path(out_dir).resolve()
    out.mkdir(parents=True, exist_ok=True)
    packet = json.loads(Path(packet_path).read_text(encoding="utf8"))
    source = Path(test_source_path).read_bytes()
    if packet.get("rustReplayVerified") is not False or packet.get("wireIngressVerified") is not False:
        raise ValueError("Source-model packet elevates unverified claims")
    if not source or b"fn aria_exact_source_dag_finalizer_observation()" not in source:
        raise ValueError("Missing generated exact-DAG Rust integration test")
    sha_response = subprocess.run(["git", "rev-parse", "HEAD"], cwd=checkout,
                                  check=True, text=True, capture_output=True, timeout=20)
    if sha_response.stdout.strip() != pin:
        raise ValueError("Wrong pinned source for " + target)
    dirty = subprocess.run(["git", "status", "--porcelain"], cwd=checkout,
                           check=True, text=True, capture_output=True, timeout=20)
    if dirty.stdout.strip():
        raise ValueError("Refusing modified source checkout")
    finalizer = checkout / "block-storage/src/dag/finalizer.rs"
    production = finalizer.read_bytes()
    lock_path = checkout / "Cargo.lock"
    original_lock = lock_path.read_bytes()
    test_file = checkout / "block-storage/tests" / (TEST_TARGET + ".rs")
    if test_file.exists():
        raise ValueError("Refusing to overwrite existing integration test")
    test_file.parent.mkdir(parents=True, exist_ok=True)
    test_file.write_bytes(source)
    (out / "source-finalizer.rs").write_bytes(production)
    (out / "generated-exact-dag.rs").write_bytes(source)
    (out / "source-Cargo.lock").write_bytes(original_lock)
    cmd = ["cargo", "test", "-p", "rchain-block-storage", "--test",
           TEST_TARGET, TEST_NAME, "--", "--nocapture", "--test-threads=1"]
    result = subprocess.run(cmd, cwd=checkout, capture_output=True,
                            check=False, timeout=2400, env=dict(os.environ))
    (out / "stdout.log").write_bytes(result.stdout)
    (out / "stderr.log").write_bytes(result.stderr)
    updated_lock = lock_path.read_bytes()
    (out / "effective-Cargo.lock").write_bytes(updated_lock)
    observation = parse(result.stdout.decode("utf8", "replace")) if result.returncode == 0 else None
    if observation is not None and (observation["graph_sha256"] != packet["exactGraphSha256"] or
                                    observation["packet_sha256"] != packet["packetSha256"] or
                                    observation["source_message_count"] != len(packet["sourceGraph"]["messages"])):
        raise ValueError("Actual Rust observation differs from hash-bound exact source DAG")
    body = {
        "schema": SCHEMA,
        "target": target, "repository": repo, "sourceSha": pin,
        "packetSha256": packet["packetSha256"],
        "graphSha256": packet["exactGraphSha256"],
        "sourceFinalizerSha256": sha(production),
        "identicalRustTestSha256": sha(source),
        "sourceCargoLockSha256": sha(original_lock),
        "effectiveCargoLockSha256": sha(updated_lock),
        "cargoLockModified": original_lock != updated_lock,
        "command": cmd, "exitCode": result.returncode,
        "stdoutSha256": sha(result.stdout), "stderrSha256": sha(result.stderr),
        "rustObservation": observation,
        "evidenceScope": "Real pinned Finalizer on exact four-unique-message model-selected graph; not RNode ingress, conflicting finality or deployed-network safety.",
    }
    record = {**body, "recordSha256": sha(canonical(body))}
    (out / "record.json").write_text(json.dumps(record, indent=2) + "\n", encoding="utf8")
    return record


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--target", choices=TARGETS, required=True)
    p.add_argument("--checkout", required=True)
    p.add_argument("--packet", required=True)
    p.add_argument("--rust-source", required=True)
    p.add_argument("--out-dir", required=True)
    a = p.parse_args()
    try:
        record = execute(a.target, a.checkout, a.packet, a.rust_source, a.out_dir)
        print(json.dumps({"target": a.target, "sourceSha": record["sourceSha"],
                          "exitCode": record["exitCode"], "observation": record["rustObservation"],
                          "boundary": "REAL_FINALIZER_EXACT_DAG_ONLY_NO_LIVE_NODE_CLAIM"}))
        return 0 if record["exitCode"] == 0 else 1
    except (OSError, ValueError, KeyError, subprocess.SubprocessError) as error:
        print("Exact source DAG Rust execution failed: " + str(error), file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
