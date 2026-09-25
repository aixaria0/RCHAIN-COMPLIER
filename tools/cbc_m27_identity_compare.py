#!/usr/bin/env python3
"""Compare four real Rust identity-realizability audits and identify the first
proven semantic boundary, with no invented full-DAG/finality verdict.
"""
import argparse
import json
from pathlib import Path
import sys
from cbc_cross_fork_probe import TARGETS, canonical, sha, sha_file
from cbc_m27_identity_audit import SCHEMA, PROBE_TEST, parse_observation, audit_fixture

EVIDENCE_FILES = {
    "fixture_file_sha256": None,
    "probe_sha256": "injected-identity-probe.rs",
    "source_finalizer_sha256": "source-finalizer.rs",
    "source_cargo_lock_sha256": "source-Cargo.lock",
    "effective_cargo_lock_sha256": "effective-Cargo.lock",
    "stdout_sha256": "stdout.log",
    "stderr_sha256": "stderr.log",
}


def combine(root, fixture_path, probe_path):
    root = Path(root)
    fixture_path = Path(fixture_path)
    probe_path = Path(probe_path)
    fixture = json.loads(fixture_path.read_text(encoding="utf-8"))
    ids, labels = audit_fixture(fixture)
    content_sha = fixture["payloadSha256"]
    fixture_file_sha = sha_file(fixture_path)
    probe_sha = sha_file(probe_path)
    records = []
    for name in sorted(TARGETS):
        path = root / ("identity-" + name)
        record = json.loads((path / "record.json").read_text(encoding="utf-8"))
        recorded_seal = record.pop("record_sha256", None)
        if recorded_seal != sha(canonical(record)):
            raise ValueError("Identity record digest mismatch for " + name)
        record["record_sha256"] = recorded_seal
        repo, pinned_sha = TARGETS[name]
        required = {
            "schema": SCHEMA, "target": name, "repository": repo, "source_sha": pinned_sha,
            "fixture_sha256": content_sha, "fixture_file_sha256": fixture_file_sha,
            "probe_sha256": probe_sha, "exit_code": 0,
            "command": ["cargo", "test", "-p", "rchain-block-storage",
                        PROBE_TEST, "--", "--nocapture", "--test-threads=1"],
        }
        for field, expected in required.items():
            if record.get(field) != expected:
                raise ValueError("Incorrect " + field + " for " + name)
        for field, filename in EVIDENCE_FILES.items():
            if filename is not None and record.get(field) != sha_file(path / filename):
                raise ValueError("Altered " + filename + " for " + name)
        orig = (path / "source-finalizer.rs").read_bytes()
        injected = (path / "injected-identity-probe.rs").read_bytes()
        if record.get("effective_finalizer_sha256") != sha(orig + b"\n" + injected + b"\n"):
            raise ValueError("Different effective source for " + name)
        source_lock = (path / "source-Cargo.lock").read_bytes()
        effective_lock = (path / "effective-Cargo.lock").read_bytes()
        if record.get("cargo_lock_modified") != (source_lock != effective_lock):
            raise ValueError("Misreported lockfile change for " + name)
        stdout = (path / "stdout.log").read_bytes().decode("utf8", "replace")
        obs = parse_observation(stdout)
        if obs != record.get("observation"):
            raise ValueError("Forged Rust identity observation for " + name)
        expected_observation = {
            "fixture_sha256": content_sha,
            "tuple_entries": 4,
            "unique_message_ids": len(set(ids)),
            "representable_as_four_unique_ids": len(set(ids)) == 4,
            "post_set_count_gate": len(set(ids)) == 4,
            "distinct_sender_count": len(set(labels)),
        }
        if obs != expected_observation:
            raise ValueError("Rust identity observation differs from original M27 IDs for " + name)
        records.append(record)
    all_observations = {rec["target"]: rec["observation"] for rec in records}
    if len({json.dumps(x, sort_keys=True) for x in all_observations.values()}) != 1:
        first_disagreement = sorted(TARGETS)
    else:
        first_disagreement = []
    is_representable = len(set(ids)) == 4
    finding = ("M27_FIRST_SELECTED_TUPLE_NOT_REPRESENTABLE_AS_FOUR_UNIQUE_MESSAGE_IDS"
               if not is_representable else "FOUR_UNIQUE_IDS_NO_IDENTITY_GAP_DETECTED")
    body = {
        "schema": "aria-cbc-m27-first-semantic-divergence/v1",
        "firstSelectedSourceIds": ids,
        "sourceReportedSenderIds": labels,
        "sourceReportedTupleEntries": len(ids),
        "actualUniqueMessageIds": len(set(ids)),
        "sourceReportFixtureSha256": content_sha,
        "sameInjectedTestSha256": probe_sha,
        "firstDivergence": {
            "layer": "message_identity_to_finalizer_justification_set",
            "sourceRepresentation": "ordered four-entry research tuple (may repeat exact ID)",
            "targetRepresentation": "Rust Finalizer::calculate_finalization BTreeSet<Message>",
            "observedFinding": finding,
            "sourceTupleCount": len(ids),
            "actualUniqueSetSize": len(set(ids)),
            "representableAsFourDistinctIds": is_representable,
            "canDirectlyReplaySelectedFourEntryTupleInProductionSet": is_representable,
            "note": ("Repeated same message IDs collapse before the real Finalizer's four-entry gate. "
                     "A separate fixture with distinct message IDs is necessary to test a four-entry missing-sender case."
                     if not is_representable else
                     "This checks identity count only; causal DAG reachability and all downstream gates remain unverified."),
        },
        "fourImplementations": records,
        "differingObservedImplementationOutputs": first_disagreement,
        "claimsNotEstablished": [
            "Full exact M27 causal-DAG replay on all implementations",
            "Wire-valid BlockReceiver admission or deployed-network exploit",
            "Conflicting Casper finality or a protocol-specification verdict",
            "Comparative superiority or security ranking",
            "Producer authentication from a content digest",
        ],
        "relatedDistinctMessageControl": (
            "The separately executed original M11.5 multi-layer test uses distinct message IDs "
            "for its two v0 messages and was observed passing on all four pinned Finalizer source snapshots. "
            "It is a DIFFERENT constructed fixture, not a repair of the selected M27 tuple."),
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
        out.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n", encoding="utf8")
        print(json.dumps({
            "result": report["firstDivergence"]["observedFinding"],
            "source_ids": report["firstSelectedSourceIds"],
            "unique_message_ids": report["actualUniqueMessageIds"],
            "checked_revisions": {item["target"]: item["source_sha"] for item in report["fourImplementations"]},
            "boundary": "IDENTITY_REALIZABILITY_ONLY_NOT_FULL_M27_FINALITY",
        }))
        return 0
    except (OSError, ValueError, KeyError, TypeError, json.JSONDecodeError) as error:
        print("M27 identity comparison rejected: " + str(error), file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
