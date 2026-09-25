#!/usr/bin/env python3
"""Fail-closed evidence comparison of the exact same model-selected causal DAG
compiled into each of four real, pinned Rust Finalizers.

Compare source-model predictions to source-level Rust observations without
labelling a fringe result as live Casper finality or an exploitable defect.
"""
import argparse
from html import escape
import json
from pathlib import Path
import sys

from cbc_cross_fork_probe import TARGETS, canonical, sha, sha_file
from cbc_run_exact_rust_dag import SCHEMA, TEST_TARGET, TEST_NAME, parse
from cbc_emit_exact_rust_dag import emit, check

SCHEMA_OUT = "aria-cbc-exact-dag-four-real-finalizers/v1"
FIELDS = (
    "unique_justifications", "minimum_message_ids", "minimum_unique_senders",
    "count_gate", "next_layer_senders", "new_fringe", "new_fringe_ids",
    "next_layer_ids", "support_map", "supporting_stake", "total_stake", "initial_fringe_predicate",
)


def combine(directory, packet_path, census_path, test_file):
    directory = Path(directory)
    packet = json.loads(Path(packet_path).read_text(encoding="utf8"))
    census = json.loads(Path(census_path).read_text(encoding="utf8"))
    source = Path(test_file).read_bytes()
    check(packet)
    census_body = {k: v for k, v in census.items() if k != "recordSha256"}
    if sha(canonical(census_body)) != census.get("recordSha256"):
        raise ValueError("Census integrity mismatch")
    if source != emit(packet).encode("utf8"):
        raise ValueError("Generated Rust source differs from packet")
    if packet.get("selection") != "MODEL_CANDIDATE_READY_FOR_INDEPENDENT_RUST_REPLAY":
        raise ValueError("Missing selected source-model candidate")
    if packet.get("rustReplayVerified") is not False or packet.get("wireIngressVerified") is not False:
        raise ValueError("Input falsely claims prior Rust or wire verification")
    if packet.get("censusSha256") != census.get("recordSha256"):
        raise ValueError("Input packet does not match census")
    by_family = next((item for item in census["datasets"]
                      if item["name"] == packet["sourceDAGFamily"]), None)
    if not by_family:
        raise ValueError("Missing original source-model DAG family")
    candidate = next((item for item in by_family["candidates"]
                      if item["messageIds"] == packet["selectedJustificationIds"]), None)
    if candidate is None:
        raise ValueError("Selected source-model candidate not in original census")
    records = []
    for name in sorted(TARGETS):
        folder = directory / ("exact-" + name)
        record = json.loads((folder / "record.json").read_text(encoding="utf8"))
        seal = record.pop("recordSha256", None)
        if seal != sha(canonical(record)):
            raise ValueError("Tampered exact-DAG execution record: " + name)
        record["recordSha256"] = seal
        repo, pin = TARGETS[name]
        required = {
            "schema": SCHEMA, "target": name, "repository": repo,
            "sourceSha": pin, "packetSha256": packet["packetSha256"],
            "graphSha256": packet["exactGraphSha256"],
            "identicalRustTestSha256": sha(source), "exitCode": 0,
            "command": ["cargo", "test", "-p", "rchain-block-storage", "--test",
                        TEST_TARGET, TEST_NAME, "--", "--nocapture", "--test-threads=1"],
        }
        for key, expected in required.items():
            if record.get(key) != expected:
                raise ValueError("Wrong " + key + " in exact-DAG source record: " + name)
        evidence = {
            "sourceFinalizerSha256": "source-finalizer.rs",
            "identicalRustTestSha256": "generated-exact-dag.rs",
            "sourceCargoLockSha256": "source-Cargo.lock",
            "effectiveCargoLockSha256": "effective-Cargo.lock",
            "stdoutSha256": "stdout.log", "stderrSha256": "stderr.log",
        }
        for field, filename in evidence.items():
            if sha_file(folder / filename) != record.get(field):
                raise ValueError("Tampered " + filename + " for " + name)
        before = (folder / "source-Cargo.lock").read_bytes()
        after = (folder / "effective-Cargo.lock").read_bytes()
        if record.get("cargoLockModified") != (before != after):
            raise ValueError("Incorrect dependency lock-change flag for " + name)
        observation = parse((folder / "stdout.log").read_text(encoding="utf8", errors="replace"))
        if observation != record.get("rustObservation"):
            raise ValueError("Forged actual Rust Finalizer observation for " + name)
        if (observation["graph_sha256"] != packet["exactGraphSha256"] or
            observation["packet_sha256"] != packet["packetSha256"] or
            observation["source_message_count"] != len(packet["sourceGraph"]["messages"])):
            raise ValueError("Actual Rust test did not use the exact model-selected source graph")
        records.append(record)
    comparisons = []
    for record in records:
        observed = record["rustObservation"]
        field_results = [
            ("minimum_message_ids",
             sorted(candidate["traceMinimumMessageIds"]),
             sorted(observed["minimum_message_ids"])),
            ("minimum_unique_senders",
             candidate["traceDistinctMinimumSenders"],
             observed["minimum_unique_senders"]),
            ("count_gate", candidate["modelCountGatePassed"], observed["count_gate"]),
            ("next_layer_ids", candidate["modelNextLayer"], observed["next_layer_ids"]),
            ("support_map", candidate["modelSupportMap"], observed["support_map"]),
            ("supporting_stake", candidate["modelReportedSupportStake"], observed["supporting_stake"]),
            ("total_stake", candidate["modelTotalStake"], observed["total_stake"]),
            ("initial_fringe_predicate", candidate["modelReportedFinalized"], observed["initial_fringe_predicate"]),
            ("new_fringe", candidate["modelReportedFinalized"], observed["new_fringe"]),
        ]
        first_mismatch = next((
            {"stage": name, "model": expected, "rust": actual}
            for name, expected, actual in field_results if expected != actual
        ), None)
        comparisons.append({
            "target": record["target"], "sourceSha": record["sourceSha"],
            "observedRust": observed,
            "intermediateComparisons": [
                {"stage": n, "model": e, "rust": a, "equal": e == a}
                for n, e, a in field_results
            ],
            "comparisonScope": "Initial iteration; minimum extraction is a test projection of a private method. Public support/gate/fringe methods and the complete Finalizer execute independently. No internal trace of subsequent iterations is claimed.",
            "modelPredictedCountGate": candidate["modelCountGatePassed"],
            "modelPredictedNewFringe": candidate["modelReportedFinalized"],
            "firstComparedModelVsRustDifference": first_mismatch,
            "exactSourceGraphWasExecutedByRust": True,
            "wireIngressVerified": False,
            "conflictingFinalityEstablished": False,
        })
    observed_diffs = [
        field for field in FIELDS if len({json.dumps(record["rustObservation"][field],
                                                     sort_keys=True) for record in records}) > 1
    ]
    body = {
        "schema": SCHEMA_OUT,
        "selectedSourceDAGFamily": packet["sourceDAGFamily"],
        "exactSourceGraphSha256": packet["exactGraphSha256"],
        "exactInputPacketSha256": packet["packetSha256"],
        "identicalGeneratedRustTestSha256": sha(source),
        "selectedFourUniqueJustificationIds": packet["selectedJustificationIds"],
        "modelSourceMinimumMessageIds": candidate["traceMinimumMessageIds"],
        "modelSourceFinalized": candidate["modelReportedFinalized"],
        "rustRepresentation": {
            "messageIdentity": "Original ASCII IDs in generic Message<String,String>; not signed block hashes",
            "senderIdentity": "Original v0..v3 labels; not cryptographic validator keys",
            "globalBonds": "Original stakes passed to calculate_finalization",
            "unmodeledMessageFields": "height=0, bonds_map={}, fringe={}; no source-model values exist for these fields",
        },
        "fourPinnedRustSourceResults": records,
        "modelVsRustByTarget": comparisons,
        "observedDifferentFieldsAcrossFourRustSnapshots": observed_diffs,
        "claimBoundary": "Same exact model-selected complete source DAG was built in and tested through four real Rust Finalizer source snapshots. This is source-level local finalizer behavior only; no authenticated source, wire-valid BlockReceiver ingress, deployed-network exploit, conflicting finality, protocol-fix approval or cross-implementation quality ranking.",
    }
    return {**body, "reportSha256": sha(canonical(body))}


def render(report):
    """Offline view generated only after combine has validated all raw records."""
    enc = lambda v: escape(json.dumps(v, ensure_ascii=False, sort_keys=True))
    rows = []
    for result in report["modelVsRustByTarget"]:
        target = escape(result["target"])
        rows.append("<h2>" + target + "</h2><p>Source: <code>" +
                    escape(result["sourceSha"]) + "</code></p><p>First compared difference: <code>" +
                    enc(result["firstComparedModelVsRustDifference"]) + "</code></p>")
        rows.append("<table><tr><th>Stage</th><th>Model</th><th>Rust</th><th>Equal</th></tr>")
        for item in result["intermediateComparisons"]:
            rows.append("<tr>" + "".join("<td><code>" + enc(item[k]) + "</code></td>"
                for k in ("stage", "model", "rust", "equal")) + "</tr>")
        rows.append("</table><p>" + escape(result["comparisonScope"]) + "</p>")
        rows.append("<p><a href='evidence/exact-" + target + "/stdout.log'>Raw stdout</a> · " +
                    "<a href='evidence/exact-" + target + "/stderr.log'>Raw stderr</a></p>")
    return ("<!doctype html><html lang='en'><meta charset='utf-8'>"
        "<meta name='viewport' content='width=device-width,initial-scale=1'>"
        "<title>Exact CBC DAG — source-level evidence</title>"
        "<style>body{font:16px system-ui;max-width:1100px;margin:30px auto;padding:16px;background:#111923;color:#e9edf3}"
        "table{border-collapse:collapse;display:block;overflow:auto}td,th{border:1px solid #536170;padding:10px}"
        "code{overflow-wrap:anywhere}a{color:#86c7ff}</style>"
        "<h1>Exact CBC DAG replay</h1><p><strong>SOURCE-LEVEL RUST · INGRESS UNVERIFIED · LIVE NETWORK UNVERIFIED</strong></p>"
        "<p>Candidate: <code>" + enc(report["selectedFourUniqueJustificationIds"]) + "</code></p>"
        "<p>Graph SHA-256: <code>" + escape(report["exactSourceGraphSha256"]) + "</code></p>"
        "<p>Packet SHA-256: <code>" + escape(report["exactInputPacketSha256"]) + "</code></p>"
        "<p>Rust test SHA-256: <code>" + escape(report["identicalGeneratedRustTestSha256"]) + "</code></p>"
        "<p>" + escape(report["claimBoundary"]) + "</p>" + "".join(rows) + "</html>")


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--input-dir", required=True)
    p.add_argument("--packet", required=True)
    p.add_argument("--census", required=True)
    p.add_argument("--rust-source", required=True)
    p.add_argument("--output", required=True)
    a = p.parse_args()
    try:
        report = combine(a.input_dir, a.packet, a.census, a.rust_source)
        path = Path(a.output)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n", encoding="utf8")
        path.with_suffix(".html").write_text(render(report), encoding="utf8")
        print(json.dumps({
            "result": "FOUR_REAL_RUST_FINALIZERS_EXACT_SOURCE_DAG_OBSERVED",
            "graphSha256": report["exactSourceGraphSha256"],
            "modelPredictedFinalized": report["modelSourceFinalized"],
            "observedNewFringeByTarget": {
                row["target"]: row["observedRust"]["new_fringe"]
                for row in report["modelVsRustByTarget"]
            },
            "firstModelVsRustDifferenceByTarget": {
                row["target"]: row["firstComparedModelVsRustDifference"]
                for row in report["modelVsRustByTarget"]
            },
            "boundary": "SOURCE_LEVEL_RUST_FINALIZER_NOT_LIVE_NODE_OR_DEPLOYED_FINALITY",
        }))
        return 0
    except (OSError, ValueError, KeyError, TypeError, json.JSONDecodeError) as error:
        print("Exact DAG source evidence rejected: " + str(error), file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
