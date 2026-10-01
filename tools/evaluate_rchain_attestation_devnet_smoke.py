#!/usr/bin/env python3
import json
import math
import os
import re
import sys
from pathlib import Path

def read_marks(path):
    marks = {}
    for line in path.read_text(encoding="utf-8").splitlines():
        if "\t" in line:
            key, value = line.split("\t", 1)
            marks[key] = value
    return marks

def read_blocks(path):
    rows = []
    for line in path.read_text(encoding="utf-8").splitlines():
        if not line.strip() or line.startswith("#"):
            continue
        t, num, sender, deploy_count, parents, block_hash = line.split("\t")
        rows.append({
            "epoch": int(t),
            "number": int(num),
            "sender": sender,
            "deploy_count": int(deploy_count),
            "parents": int(parents),
            "hash": block_hash,
        })
    return rows

def read_series(path):
    out = {}
    for line in path.read_text(encoding="utf-8").splitlines():
        if not line.strip() or line.startswith("#") or line.startswith("utc\t"):
            continue
        parts = line.split("\t")
        if len(parts) != 6:
            continue
        _utc, epoch, node, _height, finalized, _alive = parts
        if finalized.isdigit():
            out.setdefault(node, []).append((int(epoch), int(finalized)))
    return out

def time_to_finality(series, deploy_epoch, target):
    if not series:
        return None
    nodes = sorted(series)
    epochs = sorted({
        epoch for rows in series.values() for epoch, _finalized in rows
        if epoch >= deploy_epoch
    })
    for epoch in epochs:
        for node in nodes:
            values = [
                finalized for sample_epoch, finalized in series[node]
                if deploy_epoch - 1 <= sample_epoch <= epoch
            ]
            if not values or max(values) < target:
                break
        else:
            return epoch - deploy_epoch
    return None

def resolve_sweep(root):
    root = Path(root)
    children = sorted(p for p in root.iterdir() if p.is_dir())
    if len(children) != 1:
        raise RuntimeError(f"expected exactly one sweep directory under {root}, found {len(children)}")
    return children[0]

def summarize(root):
    sweep = resolve_sweep(root)
    run = sweep / "n3-noauto-a1"
    if not run.is_dir():
        raise RuntimeError(f"missing N=3 primary arm: {run}")

    void_file = run / "void.txt"
    if void_file.exists():
        return {
            "sweep": str(sweep),
            "run": str(run),
            "void": True,
            "voidReason": void_file.read_text(encoding="utf-8").strip(),
        }

    marks = read_marks(run / "marks.tsv")
    blocks = read_blocks(run / "blocks.tsv")
    series = read_series(run / "series.tsv")
    deploy_epoch = int(marks["idle_end_and_deploy"])
    settle_end = int(marks["settle_end"])
    read_end = int(marks["read_end"])

    idle = [b for b in blocks if settle_end <= b["epoch"] < deploy_epoch]
    post = [b for b in blocks if b["epoch"] >= deploy_epoch]
    carriers = [b for b in post if b["deploy_count"] >= 1]
    target = carriers[0]["number"] if len(carriers) == 1 else None
    ttf = time_to_finality(series, deploy_epoch, target) if target is not None else None

    errors_file = run / "blocks-read-errors.txt"
    read_errors = 0
    if errors_file.exists():
        read_errors = sum(
            1 for line in errors_file.read_text(encoding="utf-8").splitlines()
            if line.strip() and not line.startswith("#")
        )

    return {
        "sweep": str(sweep),
        "run": str(run),
        "void": False,
        "idleBlocks": len(idle),
        "deployBearingBlocks": len(carriers),
        "postDeployBlocks": len(post),
        "senders": len({b["sender"] for b in post}),
        "maxParents": max((b["parents"] for b in post), default=0),
        "timeToFinalitySeconds": ttf,
        "sampledNodes": len(series),
        "blockReadErrors": read_errors,
        "readWindowSeconds": read_end - deploy_epoch,
    }

def main():
    if len(sys.argv) not in (4, 5):
        raise SystemExit(
            "usage: evaluate_rchain_attestation_devnet_smoke.py "
            "<control-root> <candidate-root> <read-seconds> [output-json]"
        )

    control = summarize(sys.argv[1])
    candidate = summarize(sys.argv[2])
    read_seconds = int(sys.argv[3])

    # CI smoke threshold only, not a protocol law:
    # upstream records a healthy three-validator envelope of 12-16 blocks/min.
    # Give that high end a 1.5x guard band, then scale to this reading window.
    smoke_blocks_per_minute = 24
    max_candidate_blocks = math.ceil(smoke_blocks_per_minute * read_seconds / 60)

    blocked = []
    failed = []

    if control.get("void"):
        blocked.append("control devnet was void: " + control.get("voidReason", "unknown"))
    else:
        if control["blockReadErrors"]:
            blocked.append("control has failed block reads")
        if control["idleBlocks"] != 0:
            blocked.append("control minted during the no-autopropose idle window")
        if control["deployBearingBlocks"] != 1:
            blocked.append("control did not contain exactly one deploy-bearing block")
        if control["sampledNodes"] != 3 or control["senders"] != 3:
            blocked.append("control did not observe all three validators")
        if control["timeToFinalitySeconds"] is not None:
            blocked.append(
                "control no longer reproduces C192: the deploy finalized inside the smoke window"
            )

    if candidate.get("void"):
        failed.append("candidate devnet was void: " + candidate.get("voidReason", "unknown"))
    else:
        if candidate["blockReadErrors"]:
            failed.append("candidate has failed block reads")
        if candidate["idleBlocks"] != 0:
            failed.append("candidate minted during the no-autopropose idle window")
        if candidate["deployBearingBlocks"] != 1:
            failed.append("candidate did not contain exactly one deploy-bearing block")
        if candidate["sampledNodes"] != 3 or candidate["senders"] != 3:
            failed.append("candidate did not observe all three validators")
        if candidate["timeToFinalitySeconds"] is None:
            failed.append("C192 smoke failed: candidate did not finalize the deploy")
        if candidate["postDeployBlocks"] > max_candidate_blocks:
            failed.append(
                f"C171 smoke failed: {candidate['postDeployBlocks']} post-deploy blocks "
                f"exceed the CI smoke ceiling {max_candidate_blocks}"
            )

    status = "BLOCKED" if blocked else ("FAIL" if failed else "PASS")
    report = {
        "schema": "rchain-c192-c171-devnet-smoke/v1",
        "status": status,
        "control": control,
        "candidate": candidate,
        "acceptance": {
            "validatorCount": 3,
            "attempts": 1,
            "readWindowSeconds": read_seconds,
            "candidateMustFinalize": True,
            "candidateSmokeBlocksPerMinuteCeiling": smoke_blocks_per_minute,
            "candidatePostDeployBlockCeiling": max_candidate_blocks,
            "thresholdNature": (
                "CI smoke threshold derived from a 12-16 blocks/min healthy envelope "
                "with a 1.5x guard band; not a protocol law and not C171 closure"
            ),
        },
        "blockedReasons": blocked,
        "failureReasons": failed,
        "claimBoundary": [
            "PASS is a one-attempt N=3 devnet smoke result, not the full preregistered campaign.",
            "C192 closure still requires repeated controlled runs.",
            "C171 closure still requires a pre-registered rate experiment with an explicit unit.",
            "No Byzantine-safety or production-readiness conclusion follows from this gate.",
        ],
    }

    encoded = json.dumps(report, indent=2, sort_keys=True) + "\n"
    if len(sys.argv) == 5:
        Path(sys.argv[4]).write_text(encoded, encoding="utf-8")
    print(encoded, end="")

    if status == "BLOCKED":
        raise SystemExit(2)
    if status == "FAIL":
        raise SystemExit(1)

if __name__ == "__main__":
    main()
